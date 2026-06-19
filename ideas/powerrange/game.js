// game.js — the PowerRange model. Holds all mutable state (hexes, units, factions, turn)
// and exposes concrete query/command methods. The view (index.js) and the AI (ai.js) both
// drive the game only through these methods, so the rules live in exactly one place.
// Classic script: depends on config.js, hex.js, rando.js, unit.js, mapgen.js, combat.js.

class Faction {
    constructor(id) {
        this.id = id;
        this.treasury = START_TREASURY;
        this.income = 0;
        this.bankruptTurns = 0;
    }
}

class Game {
    constructor() {
        this.init();
    }

    init() {
        this.hexes = generateMap();
        this.units = [];
        this.nextId = 1;
        this.turn = 1;
        this.winner = null;
        this.log = [];
        this.factions = {
            [FACTION.PLAYER]: new Faction(FACTION.PLAYER),
            [FACTION.ENEMY]: new Faction(FACTION.ENEMY)
        };
        this.placeStartForces();
        this.beginTurn(FACTION.PLAYER);
    }

    // ---- Terrain / occupancy helpers ----
    hex(q, r) { return this.hexes.get(Hex.key(q, r)); }
    moveCost(hex) { return MOVEMENT_COST[hex.terrain] ?? Infinity; }
    isPassable(hex) { return this.moveCost(hex) !== Infinity; }

    unitAt(q, r) {
        const key = Hex.key(q, r);
        return this.units.find(u => Hex.key(u.q, u.r) === key) || null;
    }

    factionUnits(owner) { return this.units.filter(u => u.owner === owner); }
    enemyOf(owner) { return owner === FACTION.PLAYER ? FACTION.ENEMY : FACTION.PLAYER; }
    foundryOf(owner) { return this.units.find(u => u.owner === owner && u.isFoundry()) || null; }

    spawn(archetypeKey, owner, q, r) {
        const u = Unit.create(archetypeKey, owner, q, r, this.nextId++);
        this.units.push(u);
        return u;
    }

    // ---- Initial placement ----
    placeStartForces() {
        const land = [];
        for (const [, h] of this.hexes) {
            if (!h.isEdge && this.isPassable(h)) land.push(h);
        }
        land.sort((a, b) => a.col - b.col);
        const leftHex = land[Math.floor(land.length * 0.04)];
        const rightHex = land[land.length - 1 - Math.floor(land.length * 0.04)];

        this.deployBase(FACTION.PLAYER, leftHex);
        this.deployBase(FACTION.ENEMY, rightHex);
    }

    deployBase(owner, foundryHex) {
        this.spawn('FOUNDRY', owner, foundryHex.q, foundryHex.r);
        const open = this.openNear(foundryHex, BUILD_RADIUS);
        if (open[0]) this.spawn('RAILGUN', owner, open[0].q, open[0].r);
        if (open[1]) this.spawn('ENGINEER', owner, open[1].q, open[1].r);
    }

    // Empty passable hexes within `radius` of a center, nearest first.
    openNear(center, radius) {
        const c = new Hex(center.q, center.r);
        return c.inRange(radius)
            .map(h => this.hex(h.q, h.r))
            .filter(h => h && !h.isEdge && this.isPassable(h) && !this.unitAt(h.q, h.r))
            .sort((a, b) => c.distance(new Hex(a.q, a.r)) - c.distance(new Hex(b.q, b.r)));
    }

    // ---- Turn lifecycle ----
    beginTurn(owner) {
        this.runIncome(owner);
        this.runUpkeep(owner);
        for (const u of this.factionUnits(owner)) {
            u.mpLeft = u.mp;
            u.hasFired = false;
            this.refreshShield(u);
            this.clearStaleSiege(u);
        }
        this.checkVictory();
    }

    endTurn(owner) {
        for (const u of this.factionUnits(owner)) {
            u.disabled = false;
            this.maybeFortify(u);
        }
    }

    // An Engineer that spent its whole turn idle (didn't move or act) digs in as a Field
    // Shield: immobile, but with a strong, fully-refreshing shield. A permanent conversion.
    maybeFortify(u) {
        if (!u.isEngineer() || u.fortified) return;
        if (u.hasFired || u.mpLeft !== u.mp) return;   // must have stayed completely still
        u.fortified = true;
        u.mp = 0;
        u.mpLeft = 0;
        u.shieldType = SHIELD.PHASE;   // absorbs all damage types, refreshes each turn
        u.shield = FIELD_SHIELD;
        u.shieldLeft = FIELD_SHIELD;
        u.name = 'Field Shield';
        u.label = 'F';
        this.note('Engineer fortifies into a Field Shield');
    }

    refreshShield(unit) {
        const policy = SHIELD_REFRESH[unit.shieldType];
        if (policy === 'always') unit.shieldLeft = unit.shield;
        else if (policy === 'atFoundry' && this.atOwnFoundry(unit)) unit.shieldLeft = unit.shield;
    }

    atOwnFoundry(unit) {
        const f = this.foundryOf(unit.owner);
        if (!f) return false;
        return new Hex(unit.q, unit.r).distance(new Hex(f.q, f.r)) <= BUILD_RADIUS;
    }

    // A unit no longer adjacent to an enemy knight loses its capture mark.
    clearStaleSiege(unit) {
        if (!unit.capturingBy) return;
        const beset = this.units.some(u =>
            u.canSiege() && u.owner === unit.capturingBy &&
            new Hex(u.q, u.r).distance(new Hex(unit.q, unit.r)) === 1);
        if (!beset) unit.capturingBy = null;
    }

    // ---- Economy ----
    controllerOf(hex) {
        let player = false, enemy = false;
        const c = new Hex(hex.q, hex.r);
        for (const u of this.units) {
            if (new Hex(u.q, u.r).distance(c) > CONTROL_RADIUS) continue;
            if (u.owner === FACTION.PLAYER) player = true; else enemy = true;
        }
        if (player === enemy) return null;   // both or neither → contested/neutral
        return player ? FACTION.PLAYER : FACTION.ENEMY;
    }

    controlledQuarries(owner) {
        let n = 0;
        for (const [, h] of this.hexes) {
            if (h.terrain === TERRAIN.QUARRY && this.controllerOf(h) === owner) n++;
        }
        return n;
    }

    buildDiscount(owner) {
        return Math.min(QUARRY_DISCOUNT_CAP, QUARRY_DISCOUNT * this.controlledQuarries(owner));
    }

    runIncome(owner) {
        const fac = this.factions[owner];
        let income = this.foundryOf(owner) ? FOUNDRY_INCOME : 0;
        for (const [, h] of this.hexes) {
            if (h.terrain !== TERRAIN.GOLD || h.onFire > 0) continue;
            h.controlledBy = this.controllerOf(h);
            if (h.controlledBy === owner) income += GOLD_INCOME;
        }
        fac.income = income;
        fac.treasury += income;
    }

    runUpkeep(owner) {
        const fac = this.factions[owner];
        const total = this.factionUnits(owner).reduce((s, u) => s + u.upkeep, 0);
        fac.treasury -= total;
        if (fac.treasury >= 0) { fac.bankruptTurns = 0; return; }
        // Bankrupt: disband the most expensive non-Foundry units until solvent.
        fac.bankruptTurns++;
        const disbandable = this.factionUnits(owner)
            .filter(u => !u.isFoundry())
            .sort((a, b) => b.cost - a.cost);
        for (const u of disbandable) {
            if (fac.treasury >= 0) break;
            fac.treasury += u.upkeep;   // refund the upkeep we just over-charged
            this.removeUnit(u);
        }
        this.note(`${owner} is bankrupt and disbands units`);
    }

    // ---- Movement ----
    // Hexes a unit can reach this turn: cost-limited BFS with every other unit as a wall.
    reachable(unit) {
        if (unit.mpLeft <= 0 || unit.disabled || unit.mp === 0) return new Map();
        const blocked = new Set(this.units
            .filter(u => u !== unit)
            .map(u => Hex.key(u.q, u.r)));
        const costs = bfsHexes(unit, this.hexes, hex => {
            if (blocked.has(Hex.key(hex.q, hex.r))) return Infinity;
            return this.moveCost(hex);
        }, unit.mpLeft);
        costs.delete(Hex.key(unit.q, unit.r));
        return costs;
    }

    move(unit, q, r) {
        const cost = this.reachable(unit).get(Hex.key(q, r));
        if (cost === undefined) return false;
        unit.q = q;
        unit.r = r;
        unit.mpLeft -= cost;
        unit.capturingBy = null;   // moving abandons any siege in progress on this unit
        return true;
    }

    // ---- Firing ----
    // Hex keys this unit may fire on: in effective range + line of sight, and either holding
    // an enemy unit or (for igniters) a gold hex to deny it.
    // A unit fires only if it hasn't moved this turn (mpLeft still full) — lumbering platforms
    // must stop, charge, and fire, or keep rolling. Move OR shoot, never both.
    fireTargets(unit) {
        if (!unit.canFire() || unit.hasFired || unit.disabled || unit.mpLeft !== unit.mp) return new Set();
        const home = this.hex(unit.q, unit.r);
        const range = unit.effectiveRange(home.terrain);
        const origin = new Hex(unit.q, unit.r);
        const out = new Set();
        for (const cell of origin.inRange(range)) {
            const h = this.hex(cell.q, cell.r);
            if (!h || h === home) continue;
            if (origin.distance(cell) < 1) continue;
            if (!lineOfSight(unit, h, this.hexes)) continue;
            const occupant = this.unitAt(cell.q, cell.r);
            const enemyThere = occupant && occupant.owner !== unit.owner;
            const burnable = unit.ignites && h.terrain === TERRAIN.GOLD;   // deny the gold
            if (enemyThere || burnable) out.add(Hex.key(h.q, h.r));
        }
        return out;
    }

    fire(unit, q, r) {
        if (!this.fireTargets(unit).has(Hex.key(q, r))) return null;
        const dist = new Hex(unit.q, unit.r).distance(new Hex(q, r));
        const cost = unit.power * dist;
        const fac = this.factions[unit.owner];
        if (fac.treasury < cost) return null;   // can't afford the ammunition
        fac.treasury -= cost;
        unit.hasFired = true;
        unit.mpLeft = 0;        // firing ends the turn — no rolling away after the shot

        const hex = this.hex(q, r);
        const result = { cost, dmg: 0, killed: false };
        const target = this.unitAt(q, r);
        if (target && target.owner !== unit.owner) {
            const { dmg, newShield } = resolveFire(unit.power, unit.damage, target, hex.terrain);
            target.shieldLeft = newShield;
            target.hp -= dmg;
            result.dmg = dmg;
            if (!target.alive()) { this.removeUnit(target); result.killed = true; }
        }
        if (unit.ignites) this.ignite(hex);
        this.checkVictory();
        return result;
    }

    ignite(hex) {
        if (FLAMMABLE.has(hex.terrain)) hex.onFire = FIRE_TURNS;
    }

    // ---- Knight siege: disable, then capture on the next adjacent action ----
    siegeTargets(unit) {
        if (!unit.canSiege() || unit.hasFired || unit.disabled) return new Set();
        const here = new Hex(unit.q, unit.r);
        const out = new Set();
        for (const u of this.units) {
            if (u.owner === unit.owner) continue;
            if (!(u.isPlatform() || u.isFoundry())) continue;
            if (here.distance(new Hex(u.q, u.r)) !== 1) continue;
            if (this.isEscorted(u)) continue;   // a friendly defender screens it from siege
            out.add(Hex.key(u.q, u.r));
        }
        return out;
    }

    // A unit is escorted if any other unit of its own faction stands adjacent — the escort
    // repels boarders, so an escorted platform/Foundry cannot be disabled or captured.
    isEscorted(target) {
        const c = new Hex(target.q, target.r);
        return this.units.some(u =>
            u !== target && u.owner === target.owner &&
            new Hex(u.q, u.r).distance(c) === 1);
    }

    siege(unit, q, r) {
        if (!this.siegeTargets(unit).has(Hex.key(q, r))) return null;
        const target = this.unitAt(q, r);
        unit.hasFired = true;
        if (target.capturingBy === unit.owner) {
            // Second adjacent action: the asset changes hands — the windfall.
            target.owner = unit.owner;
            target.capturingBy = null;
            target.disabled = true;        // can't act on its new side until next turn
            target.mpLeft = 0;
            this.note(`Shield Knight captures the ${target.name}!`);
            this.checkVictory();
            return { captured: true };
        }
        target.disabled = true;
        target.capturingBy = unit.owner;
        this.note(`Shield Knight disables the ${target.name}`);
        return { captured: false };
    }

    // ---- Building ----
    buildHexes(owner) {
        const f = this.foundryOf(owner);
        if (!f) return new Set();
        return new Set(this.openNear(f, BUILD_RADIUS).map(h => Hex.key(h.q, h.r)));
    }

    buildCost(owner, archetypeKey) {
        return Math.round(ARCHETYPES[archetypeKey].cost * (1 - this.buildDiscount(owner)));
    }

    build(owner, archetypeKey, q, r) {
        if (!this.buildHexes(owner).has(Hex.key(q, r))) return null;
        const fac = this.factions[owner];
        const cost = this.buildCost(owner, archetypeKey);
        if (fac.treasury < cost) return null;
        fac.treasury -= cost;
        const u = this.spawn(archetypeKey, owner, q, r);
        u.mpLeft = 0;            // built units sit out the turn they are made
        u.hasFired = true;
        return u;
    }

    // ---- Round end (after both factions have acted) ----
    advanceFires() {
        const igniting = [];
        for (const [, h] of this.hexes) {
            if (h.onFire <= 0) continue;
            if (Rando.bool(FIRE_SPREAD)) {
                const nbr = Rando.choice(new Hex(h.q, h.r).neighbors()
                    .map(n => this.hex(n.q, n.r))
                    .filter(x => x && x.onFire <= 0 && FLAMMABLE.has(x.terrain)));
                if (nbr) igniting.push(nbr);
            }
        }
        for (const [, h] of this.hexes) if (h.onFire > 0) h.onFire--;
        for (const h of igniting) h.onFire = FIRE_TURNS;
    }

    // ---- Removal / victory ----
    removeUnit(unit) {
        const i = this.units.indexOf(unit);
        if (i >= 0) this.units.splice(i, 1);
    }

    checkVictory() {
        if (this.winner) return;
        const playerDead = this.collapsed(FACTION.PLAYER);
        const enemyDead = this.collapsed(FACTION.ENEMY);
        if (enemyDead && !playerDead) this.winner = FACTION.PLAYER;
        else if (playerDead) this.winner = FACTION.ENEMY;
    }

    // A faction is finished when it has lost its Foundry or stayed bankrupt too long.
    collapsed(owner) {
        if (!this.foundryOf(owner)) return true;
        return this.factions[owner].bankruptTurns >= BANKRUPT_LIMIT;
    }

    note(msg) { this.log.push(msg); }

    // ---- Pathfinding for the AI (full A*, so it can plan detours; DYNAMICS tuning) ----
    pathTo(unit, q, r) {
        const blocked = new Set(this.units
            .filter(u => u !== unit && !(u.q === q && u.r === r))
            .map(u => Hex.key(u.q, u.r)));
        const passable = (hq, hr) => {
            const h = this.hex(hq, hr);
            if (!h || !this.isPassable(h)) return false;
            return !blocked.has(Hex.key(hq, hr));
        };
        const cost = (hq, hr) => this.moveCost(this.hex(hq, hr));
        return findPath(unit, { q, r }, passable, cost, 9999);
    }
}
