// gameengine.js — The rules that run the game, independent of any UI.
//
// GameEngine owns a GameState (`this.state`) and is the only thing that mutates it: it builds
// the map, spawns units, resolves the healer's actions, and runs the AI turn. It draws nothing
// and sleeps for nothing — the animated turn loop in index.js is reconstructed from the *frames*
// resolveTurn() returns (each a board snapshot + an optional combat flash). Win/loss is reported
// by setting state.outcome, not by popping an overlay.
//
// Low-level math (status effects, damage, skill application, attacks) lives in mechanics.js;
// targeting/positioning policy in PartyAI / EnemyAI; the move-within-budget primitive in
// Movement. This class wires them to the live state.
//
// No ES modules — plain <script> global, loaded after GameState and the AI strategies.
class GameEngine {
    constructor() {
        this.state = null;
    }

    // ---- New game ----
    // Regenerate terrain + landmarks until a path links home and treasure (DYNAMICS: the
    // journey must be possible), then place units and the opening warbands.
    newGame() {
        const st = new GameState();
        this.state = st;
        st.partyScheme = ColorTheory.randomScheme(() => Math.random());
        st.enemyScheme = ColorTheory.randomScheme(() => Math.random());
        st.enemyColorIdx = 0;

        let attempts = 0;
        do {
            st.hexes = GameEngine.generateRectGrid();
            this.assignTerrain();
            this.placeLandmarks();
            attempts++;
        } while (!this.hasPath(st.homeHex, st.treasureHex) && attempts < 20);

        this.setupUnits();
        this.spawnEnemies();

        st.turn = 1;
        st.reputation = 0;
        st.treasureCollected = false;
        st.objectiveHex = st.treasureHex;
        st.outcome = null;
        st.outcomeMessage = '';
        st.healer.mp = PLAYER_MP;
        st.healer.aether = HEALER_MAX_AETHER;
    }

    // ---- Heightmap generation (diamond-square) ----
    static diamondSquare(size, roughness) {
        const grid = new Float64Array(size * size);
        const get = (x, y) => grid[y * size + x];
        const set = (x, y, v) => { grid[y * size + x] = v; };

        set(0, 0, Math.random());
        set(size - 1, 0, Math.random());
        set(0, size - 1, Math.random());
        set(size - 1, size - 1, Math.random());

        let step = size - 1;
        let scale = roughness;
        while (step > 1) {
            const half = step / 2;
            for (let y = half; y < size - 1; y += step)
                for (let x = half; x < size - 1; x += step)
                    set(x, y, (get(x - half, y - half) + get(x + half, y - half) +
                        get(x - half, y + half) + get(x + half, y + half)) / 4 +
                        (Math.random() - 0.5) * scale);
            for (let y = 0; y < size; y += half)
                for (let x = (y + half) % step; x < size; x += step) {
                    let sum = 0, cnt = 0;
                    if (x >= half) { sum += get(x - half, y); cnt++; }
                    if (x + half < size) { sum += get(x + half, y); cnt++; }
                    if (y >= half) { sum += get(x, y - half); cnt++; }
                    if (y + half < size) { sum += get(x, y + half); cnt++; }
                    set(x, y, sum / cnt + (Math.random() - 0.5) * scale);
                }
            step = half;
            scale *= roughness;
        }

        let min = Infinity, max = -Infinity;
        for (let i = 0; i < grid.length; i++) { min = Math.min(min, grid[i]); max = Math.max(max, grid[i]); }
        for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / (max - min) * 100;
        return grid;
    }

    // ---- Map generation ----
    static generateRectGrid() {
        const grid = new Map();
        const hm = GameEngine.diamondSquare(129, 0.55);

        for (let row = 0; row < MAP_ROWS; row++) {
            const qOffset = -Math.floor(row / 2);
            for (let col = 0; col < MAP_COLS; col++) {
                const q = col + qOffset;
                const r = row;
                const gx = Math.round(col / (MAP_COLS - 1) * 128);
                const gy = Math.round(row / (MAP_ROWS - 1) * 128);
                const elevation = hm[gy * 129 + gx];
                const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;
                grid.set(Hex.key(q, r), { q, r, col, row, elevation, isEdge, terrain: null });
            }
        }
        return grid;
    }

    assignTerrain() {
        const inner = [];
        for (const [, hex] of this.state.hexes) {
            if (hex.isEdge) { hex.terrain = TERRAIN.WATER; continue; }
            inner.push(hex);
        }
        inner.sort((a, b) => a.elevation - b.elevation);
        const n = inner.length;

        for (let i = 0; i < n; i++) {
            const pct = i / n;
            if (pct < 0.25) inner[i].terrain = TERRAIN.WATER;
            else if (pct < 0.85) inner[i].terrain = TERRAIN.PLAINS;
            else if (pct < 0.95) inner[i].terrain = TERRAIN.HILLS;
            else inner[i].terrain = TERRAIN.MOUNTAIN;
        }

        const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS);
        Rando.shuffle(plains);
        const forestCount = Math.round(n * 0.10);
        const goldCount = Math.max(3, Math.round(n * 0.01));
        let idx = 0;
        for (let i = 0; i < forestCount && idx < plains.length; i++, idx++)
            plains[idx].terrain = TERRAIN.FOREST;
        for (let i = 0; i < goldCount && idx < plains.length; i++, idx++)
            plains[idx].terrain = TERRAIN.GOLD;

        const hills = inner.filter(h => h.terrain === TERRAIN.HILLS);
        Rando.shuffle(hills);
        const quarryCount = Math.max(2, Math.round(n * 0.02));
        for (let i = 0; i < quarryCount && i < hills.length; i++)
            hills[i].terrain = TERRAIN.QUARRY;
    }

    // Home on the left, treasure on the right — a real journey out and back (DYNAMICS:
    // "Home Bases Give the Map Emotional Weight"). Both sit EDGE_MARGIN hexes in from the
    // border so the party lands on a clear entrance beach, not buried in the interior.
    placeLandmarks() {
        const passable = this.state.passableHexes();
        const home = GameEngine.landmarkNearColumn(passable, EDGE_MARGIN);
        const treasure = GameEngine.landmarkNearColumn(passable, MAP_COLS - 1 - EDGE_MARGIN);
        this.state.homeHex = { q: home.q, r: home.r };
        this.state.treasureHex = { q: treasure.q, r: treasure.r };
    }

    // The passable hex nearest a target column — pulls home/treasure to a fixed margin in
    // from the edge. Ties (same column distance, different rows) break randomly for variety.
    static landmarkNearColumn(passable, targetCol) {
        const best = Math.min(...passable.map(h => Math.abs(h.col - targetCol)));
        const band = passable.filter(h => Math.abs(h.col - targetCol) === best);
        return Rando.choice(band);
    }

    hasPath(from, to) {
        if (!from || !to) return false;
        const costs = bfsHexes(from, this.state.hexes, hex => this.state.moveCost(hex), Infinity);
        return costs.has(Hex.key(to.q, to.r));
    }

    // ---- Unit factories ----
    makeHealer(q, r) {
        const cooldowns = {};
        for (const s of SKILLS) cooldowns[s.id] = 0;
        return {
            id: this.state.nextId++, kind: 'healer', cls: 'healer', name: 'Healer', label: 'H', color: PLAYER_COLOR,
            q, r, hp: HEALER_MAX_HP, maxHp: HEALER_MAX_HP, armor: 0, damage: 0, attackRange: 0,
            statuses: [], alive: true, gone: false,
            mp: PLAYER_MP, aether: HEALER_MAX_AETHER, maxAether: HEALER_MAX_AETHER,
            aetherRegen: AETHER_REGEN, cooldowns
        };
    }

    makePartyMember(def, q, r, color) {
        return {
            id: this.state.nextId++, kind: 'party', cls: def.cls, name: def.name, label: def.label,
            color, q, r, hp: def.maxHp, maxHp: def.maxHp, armor: def.armor, damage: def.damage,
            attackRange: def.attackRange, statuses: [], alive: true, downedTurns: 0, gone: false
        };
    }

    static rollSpeed() {
        const roll = Rando.int(1, 6);
        return roll <= 3 ? 2 : roll <= 5 ? 3 : 4;   // most slow, some fast, rare very fast
    }

    makeEnemy(def, tier, q, r) {
        const st = this.state;
        const color = ColorTheory.rgbToHex(...st.enemyScheme[st.enemyColorIdx++ % st.enemyScheme.length]);
        return {
            id: st.nextId++, kind: 'enemy', cls: def.cls, name: def.name, label: def.label, color,
            q, r, hp: Math.round(def.baseHp * tier), maxHp: Math.round(def.baseHp * tier),
            damage: Math.round(def.baseDamage * tier), armor: 0, attackRange: def.attackRange,
            damageType: def.damageType, speed: GameEngine.rollSpeed(), tier,
            statuses: [], alive: true, targetId: null
        };
    }

    static pickEnemyClass() {
        return Rando.weighted(ENEMY_CLASSES.map(c => ({ item: c, weight: c.weight })));
    }

    rollTier() {
        const t = this.state.currentTier();
        if (t >= 3) return Rando.bool(0.5) ? 2 : 1;
        if (t >= 2) return Rando.bool(0.3) ? 2 : 1;
        return 1;
    }

    // ---- Setup ----
    setupUnits() {
        const st = this.state;
        st.healer = this.makeHealer(st.homeHex.q, st.homeHex.r);
        st.party = [];

        const origin = new Hex(st.healer.q, st.healer.r);
        const taken = new Set([Hex.key(st.healer.q, st.healer.r), Hex.key(st.treasureHex.q, st.treasureHex.r)]);
        const spots = st.passableHexes().sort((a, b) => origin.distance(a) - origin.distance(b));

        let si = 0;
        PARTY_CLASSES.forEach((def, i) => {
            while (si < spots.length && taken.has(Hex.key(spots[si].q, spots[si].r))) si++;
            const spot = spots[si] ?? spots[0];
            taken.add(Hex.key(spot.q, spot.r));
            si++;
            const color = ColorTheory.rgbToHex(...st.partyScheme[i % st.partyScheme.length]);
            st.party.push(this.makePartyMember(def, spot.q, spot.r, color));
        });
    }

    // Enemies arrive as warbands, not a scatter: pick center hexes far from home, then cluster
    // 1-4 enemies on and around each until the wave's total is met.
    spawnEnemies() {
        const st = this.state;
        st.enemies = [];
        const count = Rando.int(ENEMY_MIN, ENEMY_MAX);
        const occupied = st.boardKeySet();
        const home = new Hex(st.homeHex.q, st.homeHex.r);
        const centers = st.passableHexes().filter(h =>
            !occupied.has(Hex.key(h.q, h.r)) && home.distance(h) > 8);
        Rando.shuffle(centers);
        let ci = 0;
        while (st.enemies.length < count && ci < centers.length) {
            const size = Math.min(Rando.int(GROUP_MIN, GROUP_MAX), count - st.enemies.length);
            this.spawnGroup(centers[ci++], size, 1, occupied);
        }
    }

    // Spawn `size` enemies of the given tier on a center hex and the nearest free passable
    // hexes around it. Mutates `occupied` so warbands don't overlap.
    spawnGroup(center, size, tier, occupied) {
        const origin = new Hex(center.q, center.r);
        const spots = this.state.passableHexes()
            .filter(h => !occupied.has(Hex.key(h.q, h.r)) && origin.distance(h) <= GROUP_RADIUS)
            .sort((a, b) => origin.distance(a) - origin.distance(b));
        for (let i = 0; i < size && i < spots.length; i++) {
            const h = spots[i];
            occupied.add(Hex.key(h.q, h.r));
            this.state.enemies.push(this.makeEnemy(GameEngine.pickEnemyClass(), tier, h.q, h.r));
        }
    }

    // Low-probability per-turn pressure that converges on the party's destination.
    spawnReinforcement() {
        const st = this.state;
        const occupied = st.boardKeySet();
        const obj = new Hex(st.objectiveHex.q, st.objectiveHex.r);
        const candidates = st.passableHexes().filter(h => {
            const d = obj.distance(h);
            return !occupied.has(Hex.key(h.q, h.r)) && d >= 3 && d <= 7;
        });
        if (candidates.length === 0) return;
        const h = Rando.choice(candidates);
        st.enemies.push(this.makeEnemy(GameEngine.pickEnemyClass(), this.rollTier(), h.q, h.r));
    }

    // ---- Danger heat map + AI context ----
    // How threatening an enemy's presence is, stamped onto the danger map. Offense is the
    // natural measure — it's what a hex near this enemy will cost you. One place to retune.
    static enemyStrength(enemy) {
        return enemy.damage;
    }

    // Flat danger heat map: every hex within AGGRO_RANGE of a living enemy accumulates that
    // enemy's strength (no falloff — a warband stamps a uniform plateau, and overlapping
    // warbands sum into hotter crossfire zones). The leader's pathing pays this on top of
    // terrain, so it routes around a warband's footprint instead of wading through it.
    buildDangerMap() {
        const st = this.state;
        const map = new Map();
        for (const e of st.enemies) {
            if (!e.alive) continue;
            const strength = GameEngine.enemyStrength(e);
            for (const c of new Hex(e.q, e.r).inRange(AGGRO_RANGE)) {
                const key = Hex.key(c.q, c.r);
                if (!st.hexes.has(key)) continue;
                map.set(key, (map.get(key) || 0) + strength);
            }
        }
        return map;
    }

    // Zone-of-control hexes for a set of units: every hex adjacent to a living unit. Entering one
    // costs ZOC_PENALTY times normal. The frontline's bodies thus wall off a band, not just their
    // own hexes.
    static zocKeysFor(units) {
        const keys = new Set();
        for (const u of units) {
            if (!u.alive || u.gone) continue;
            for (const n of new Hex(u.q, u.r).neighbors()) keys.add(n.key());
        }
        return keys;
    }

    // AI context: closures over live terrain + a mutable occupancy set + the hostile zone of
    // control. `moveCost` is what a step actually spends from the budget; `planCost` is what the
    // A* route planner minimizes. They're identical here — terrain only — so the planner and the
    // walk agree. dangerAwareCtx swaps in a planCost that also pays danger, bending the route.
    aiCtx(live, zoc) {
        const st = this.state;
        const terrain = (q, r) => { const h = st.hexAt(q, r); return h ? st.moveCost(h) : Infinity; };
        return {
            terrainPassable: (q, r) => { const h = st.hexAt(q, r); return !!h && st.isPassable(h); },
            moveCost: terrain,
            planCost: terrain,
            occupied: key => live.has(key),
            zoc: (q, r) => zoc.has(Hex.key(q, r))
        };
    }

    // A planning view that biases routes away from danger WITHOUT slowing the unit down: the A*
    // planner pays terrain + DANGER_WEIGHT · heat, but the walk still spends only `moveCost`
    // (terrain × ZOC) from the budget. So the leader picks a safer-shaped path yet moves at full
    // speed. Danger is additive, never Infinity — it bends the route but never forbids a hex, so
    // when the only way to the treasure runs through a warband the leader still commits.
    dangerAwareCtx(base, danger) {
        return {
            ...base,
            planCost: (q, r) => base.moveCost(q, r) + DANGER_WEIGHT * (danger.get(Hex.key(q, r)) || 0)
        };
    }

    // ---- Player (healer) actions ----
    // Cost-limited flood fill bounded by remaining MP; every other unit is a wall, and enemy
    // ZOC walls the healer off too (symmetric). The UI uses this both to highlight reachable
    // hexes and to validate a requested move.
    computeReachable() {
        const st = this.state;
        const h = st.healer;
        if (h.mp <= 0) return new Map();
        const blocked = st.occupancyExcluding(h);
        const foeZoc = GameEngine.zocKeysFor(st.enemies);
        const costs = bfsHexes(h, st.hexes, hex => {
            const key = Hex.key(hex.q, hex.r);
            if (blocked.has(key)) return Infinity;
            return st.moveCost(hex) * (foeZoc.has(key) ? ZOC_PENALTY : 1);
        }, h.mp);
        costs.delete(Hex.key(h.q, h.r));
        return costs;
    }

    // Move the healer to (q, r) if reachable, spending MP and provoking attacks of opportunity
    // for any enemy it tore free of. Returns whether the move happened; the UI reads state for
    // the rest (remaining MP, a defeat outcome if the healer fell).
    moveHealer(q, r) {
        const h = this.state.healer;
        const cost = this.computeReachable().get(Hex.key(q, r));
        if (cost === undefined) return { moved: false };
        const fromQ = h.q, fromR = h.r;
        h.q = q;
        h.r = r;
        h.mp -= cost;
        this.disengagementStrikes(h, fromQ, fromR);
        if (!h.alive) this.defeat('The healer has fallen.');
        return { moved: true };
    }

    // Living allies the skill may legally target right now (predicate + range from the healer).
    validSkillTargets(skill) {
        return validSkillTargets(skill, this.state.allies(), this.state.healer);
    }

    skillUsable(skill) {
        const h = this.state.healer;
        if (h.cooldowns[skill.id] > 0) return false;
        if (h.aether < skill.aetherCost) return false;
        return this.validSkillTargets(skill).length > 0;
    }

    // Cast `skill` at the unit on `hex`. Returns whether it landed; rejects an illegal target.
    castSkill(skill, hex) {
        const h = this.state.healer;
        const target = this.state.unitAt(hex.q, hex.r);
        if (!target || !this.validSkillTargets(skill).includes(target)) return false;
        applySkill(skill, target, this.state.allies());
        h.aether -= skill.aetherCost;
        h.cooldowns[skill.id] = skill.cooldown;
        return true;
    }

    // Start of the player's turn: refill MP, regen Aether, tick cooldowns down.
    beginPlayerTurn() {
        const h = this.state.healer;
        h.mp = PLAYER_MP;
        h.aether = Math.min(h.maxAether, h.aether + h.aetherRegen);
        for (const id of Object.keys(h.cooldowns)) {
            if (h.cooldowns[id] > 0) h.cooldowns[id] -= 1;
        }
    }

    // ---- Turn resolution ----
    // Resolve the party phase, then the enemy phase, then the end-of-turn tick, and advance to
    // the next player turn. Returns an ordered list of frames — one board snapshot (plus an
    // optional combat flash) per unit action — that the UI replays as animation. Stops early
    // and leaves the trailing steps undone the moment state.outcome is set (victory/defeat).
    resolveTurn() {
        const frames = [];
        this.runPartyPhase(frames);
        if (!this.state.outcome) this.runEnemyPhase(frames);
        if (!this.state.outcome) this.resolutionTick();
        if (!this.state.outcome) {
            if (Rando.bool(REINFORCE_CHANCE)) this.spawnReinforcement();
            this.state.turn += 1;
            this.beginPlayerTurn();
        }
        return frames;
    }

    frame(flash) {
        return { snapshot: this.state.snapshot(), flash: flash ?? null };
    }

    runPartyPhase(frames) {
        const st = this.state;
        const leader = PartyAI.leader(st);
        const order = [...st.party].sort((a, b) => (a === leader ? 0 : 1) - (b === leader ? 0 : 1));
        const live = st.boardKeySet();
        const foeZoc = GameEngine.zocKeysFor(st.enemies);   // enemies hold still this phase — fixed ZOC
        const danger = this.buildDangerMap();               // ...and fixed danger heat

        for (const member of order) {
            if (member.gone || !member.alive) continue;
            const fromQ = member.q, fromR = member.r;
            const goal = PartyAI.goal(member, st);
            // Only the objective-bound route skirts danger; a member diverting to fight a threat
            // (goal is the foe's hex, not objectiveHex) charges in regardless.
            const ctx = this.aiCtx(live, foeZoc);
            const planning = goal === st.objectiveHex ? this.dangerAwareCtx(ctx, danger) : ctx;
            const dest = Movement.walkToward(member, goal, PartyAI.budget(member, st), planning);
            this.moveUnit(member, dest, live);
            this.disengagementStrikes(member, fromQ, fromR);   // enemies it tore free of get free swings
            if (!member.alive) { frames.push(this.frame(null)); continue; }

            const here = new Hex(member.q, member.r);
            const foe = st.nearest(member, st.enemies.filter(e => here.distance(e) <= member.attackRange));
            if (foe) {
                applyDamage(foe, effectiveDamage(member));
                if (!foe.alive) this.removeEnemy(foe, live);
            }

            this.handleObjective(member);
            frames.push(this.frame(null));
            if (st.outcome) return;
        }
    }

    runEnemyPhase(frames) {
        const st = this.state;
        const live = st.boardKeySet();
        // The party and healer wall enemies off; they hold still this phase, so their ZOC is fixed.
        const foeZoc = GameEngine.zocKeysFor([...st.party, st.healer]);

        for (const enemy of [...st.enemies]) {
            if (!enemy.alive) continue;
            const target = EnemyAI.target(enemy, st);
            if (!target) continue;                         // dormant: no hero within aggro range
            const fromQ = enemy.q, fromR = enemy.r;
            const dest = Movement.walkToward(enemy, target, EnemyAI.budget(enemy), this.aiCtx(live, foeZoc));
            this.moveUnit(enemy, dest, live);
            this.disengagementStrikes(enemy, fromQ, fromR);    // frontliners it tore free of get free swings
            if (!enemy.alive) { this.removeEnemy(enemy, live); frames.push(this.frame(null)); continue; }

            const inReach = new Hex(enemy.q, enemy.r).distance(target) <= enemy.attackRange;
            let flash = null;
            if (inReach) {
                enemyAttack(enemy, target);
                flash = { q: target.q, r: target.r };
            }
            frames.push(this.frame(flash));

            if (!st.healer.alive) { this.defeat('The healer has fallen.'); return; }
        }
    }

    // Resolution tick: status effects, downed heroes aging toward permanent death, defeat check.
    resolutionTick() {
        const st = this.state;
        for (const u of st.allies()) tickStatuses(u);
        for (const e of st.enemies) tickStatuses(e);

        if (!st.healer.alive) { this.defeat('The healer has fallen.'); return; }

        for (const member of st.party) {
            if (member.gone || member.alive) continue;
            member.downedTurns += 1;
            if (member.downedTurns > REVIVE_WINDOW) member.gone = true;
        }

        if (st.party.every(p => p.gone)) this.defeat('The party has perished.');
    }

    // ---- Movement + combat helpers ----
    // Relocate a unit to dest, keeping the live occupancy set in sync so the next mover
    // sees the new position. Shared by both AI phases.
    moveUnit(unit, dest, live) {
        live.delete(Hex.key(unit.q, unit.r));
        unit.q = dest.q;
        unit.r = dest.r;
        live.add(Hex.key(unit.q, unit.r));
    }

    // Living hostile units adjacent to (q, r) from `mover`'s point of view. A mover's foes are the
    // other faction; the healer counts as a friend of the party for this purpose.
    adjacentHostiles(mover, q, r) {
        const st = this.state;
        const foes = mover.kind === 'enemy' ? [...st.party, st.healer] : st.enemies;
        const here = new Hex(q, r);
        return foes.filter(f => f.alive && !f.gone && here.distance(f) === 1);
    }

    // Attacks of opportunity: every hostile the mover was adjacent to at (fromQ, fromR) but is no
    // longer adjacent to after its move gets one free strike. Sliding from one of a hostile's ZOC
    // hexes to another keeps you adjacent — no strike; only fully breaking away provokes. Strikes
    // stack, so tearing free of three engagements at once is usually fatal. Stops early once the
    // mover drops.
    disengagementStrikes(mover, fromQ, fromR) {
        const after = new Set(this.adjacentHostiles(mover, mover.q, mover.r));
        for (const h of this.adjacentHostiles(mover, fromQ, fromR)) {
            if (after.has(h)) continue;
            opportunityStrike(h, mover);
            if (!mover.alive) return;
        }
    }

    removeEnemy(enemy, live) {
        const st = this.state;
        st.enemies = st.enemies.filter(e => e !== enemy);
        live.delete(Hex.key(enemy.q, enemy.r));
        st.reputation += REP_PER_KILL;
    }

    handleObjective(member) {
        const st = this.state;
        if (!st.treasureCollected && member.q === st.treasureHex.q && member.r === st.treasureHex.r) {
            st.treasureCollected = true;
            st.reputation += REP_TREASURE;
            st.objectiveHex = st.homeHex;
            return;
        }
        if (st.treasureCollected && member.q === st.homeHex.q && member.r === st.homeHex.r) {
            this.victory();
        }
    }

    victory() {
        const st = this.state;
        st.reputation += REP_RETURN;
        st.outcome = 'victory';
        st.outcomeMessage = `Returned home with the treasure. Reputation ${st.reputation} in ${st.turn} turns.`;
    }

    defeat(reason) {
        const st = this.state;
        st.outcome = 'defeat';
        st.outcomeMessage = `${reason} Final reputation ${st.reputation}.`;
    }

    snapshot() {
        return this.state.snapshot();
    }
}
