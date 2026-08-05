// gameengine.js — GameEngine
//
// All game rules and world generation, operating on a GameState. Deliberately
// DOM-free and render-free: methods mutate state and *return outcomes*; the caller
// (GameUI today, a network handler tomorrow) decides what to redraw or broadcast.
// This is the half that would run server-side unchanged.
//
// Server-readiness notes:
//  - Generation, combat rolls, revolt rolls, and AI all route randomness through the
//    seeded Rando, so a game is reproducible from state.seed alone.
//  - Every action (moveStack, resolveCombat, bombard, build) re-derives legality from
//    engine-owned computations rather than trusting caller-supplied sets — the "never
//    trust the client" rule, baked in now so a future command layer doesn't re-audit.
//  - runOpponentRound() is a generator yielding one event per state mutation, so a
//    client can animate the opponents' round action by action from the same code path.
const GameEngine = (function () {
    const {
        TERRAIN, MOVEMENT_COST, UNITS, SHARED_BUILD, FACTIONS, COMBAT, ECON, CITIES,
        STACK_LIMIT, AI, PARTISAN, MAP_COLS, MAP_ROWS
    } = GameArtifacts;

    const CITY_SYLLABLES = ['kar', 'vel', 'dun', 'mor', 'ash', 'bre', 'tor', 'gal',
        'hol', 'ran', 'stez', 'vik', 'nor', 'sul', 'gard', 'mund', 'lek', 'thal'];

    function stats(unit) { return UNITS[unit.type]; }
    function flagsOf(unit) { return UNITS[unit.type].flags; }
    function hexDist(a, b) { return new Hex(a.q, a.r).distance(new Hex(b.q, b.r)); }

    class GameEngine {
        constructor(state) {
            this.state = state;
        }

        // ---- Small lookups ----
        factionOf(id) {
            return this.state.factions.find(f => f.id === id) ?? null;
        }

        unitsAt(q, r) {
            return this.state.units.filter(u => u.q === q && u.r === r);
        }

        stackAt(key) {
            const { q, r } = Hex.fromKey(key);
            return this.unitsAt(q, r);
        }

        cityHexes() {
            return this.state.cityKeys.map(k => this.state.hexes.get(k));
        }

        citiesOwnedBy(fid) {
            return this.cityHexes().filter(h => h.owner === fid);
        }

        victoryCityCount(fid) {
            return this.cityHexes().filter(h => h.city.victory && h.owner === fid).length;
        }

        unitCountOfType(fid, type) {
            return this.state.units.filter(u => u.faction === fid && u.type === type).length;
        }

        aliveFactions() {
            return this.state.factions.filter(f => !f.eliminated);
        }

        // ---- Terrain passability ----
        // Per-unit terrain cost is where flight and all-terrain drive break the rules;
        // a stack pays the worst cost among its members (they move together).
        unitMoveCost(unit, hex) {
            const flags = flagsOf(unit);
            if (flags.flies) return 1;
            if (flags.allTerrain) return hex.terrain === TERRAIN.WATER ? Infinity : 1;
            if (hex.terrain === TERRAIN.CITY || hex.terrain === TERRAIN.CAPITAL)
                return hex.owner === unit.faction ? 1 : 2;
            return MOVEMENT_COST[hex.terrain] ?? Infinity;
        }

        stackMoveCost(stack, hex) {
            return Math.max(...stack.map(u => this.unitMoveCost(u, hex)));
        }

        groundPassable(hex) {
            return (MOVEMENT_COST[hex.terrain] ?? Infinity) !== Infinity;
        }

        passableHexes() {
            const out = [];
            for (const [, hex] of this.state.hexes) {
                if (hex.isEdge) continue;
                if (!this.groundPassable(hex)) continue;
                out.push(hex);
            }
            return out;
        }

        // ---- Hostility, occupancy, zones of control ----
        // Free-for-all: every faction id (partisans included) is hostile to every other.
        hostileOccupancy(fid) {
            const out = new Set();
            for (const u of this.state.units)
                if (u.faction !== fid) out.add(Hex.key(u.q, u.r));
            return out;
        }

        zocOf(fid) {
            const out = new Set();
            for (const u of this.state.units) {
                if (u.faction === fid) continue;
                for (const n of new Hex(u.q, u.r).neighbors()) out.add(n.key());
            }
            return out;
        }

        // ---- Command web & activation ----
        inCommandWeb(key, faction) {
            const at = Hex.fromKey(key);
            const capitalHex = this.state.hexes.get(faction.capital);
            if (capitalHex.owner === faction.id &&
                hexDist(at, capitalHex) <= ECON.COMMAND_RADIUS) return true;
            return this.state.units.some(u =>
                u.faction === faction.id && flagsOf(u).command &&
                hexDist(at, u) <= flagsOf(u).command);
        }

        activationCost(stack, originKey) {
            if (stack.every(u => u.freeMP > 0)) return 0;                   // breakthrough follow-up
            if (stack.some(u => flagsOf(u).cohesion)) return ECON.ACTIVATE_WEB;  // wardens
            const faction = this.factionOf(stack[0].faction);
            if (!faction) return 0;                                          // partisans: no economy
            return this.inCommandWeb(originKey, faction) ? ECON.ACTIVATE_WEB : ECON.ACTIVATE_FAR;
        }

        // What a fresh activation of this stack would charge (0 if already activated).
        pendingCharge(stack, originKey) {
            if (stack.every(u => u.activated)) return 0;
            return this.activationCost(stack, originKey);
        }

        canAfford(stack, charge) {
            const faction = this.factionOf(stack[0].faction);
            return !faction || faction.cp >= charge;
        }

        // ---- Legal-move computation ----
        // Cost-limited Dijkstra for a whole stack: hostile hexes are walls, hostile ZOC
        // hexes can be entered but not left (unless the whole stack flies), friendly
        // stacks can be passed through but the move can't end where stacking would
        // exceed the limit. Returns Map<key, cost> of hexes the stack may END on.
        // unitIds selects a sub-stack to move (splitting); null means the whole stack.
        computeStackReachable(originKey, unitIds) {
            const s = this.state;
            const stack = this.moversOf(this.subsetOf(this.stackAt(originKey), unitIds));
            if (stack.length === 0) return new Map();

            const free = stack.every(u => u.freeMP > 0);
            if (!free && stack.some(u => u.activated || u.attacked)) return new Map();
            const mp = free
                ? Math.min(...stack.map(u => u.freeMP))
                : Math.min(...stack.map(u => stats(u).mp));
            if (mp <= 0) return new Map();

            const fid = stack[0].faction;
            const hostileOcc = this.hostileOccupancy(fid);
            const zoc = this.zocOf(fid);
            const ignoreZoc = stack.every(u => flagsOf(u).flies);

            const costs = new Map([[originKey, 0]]);
            const queue = [{ key: originKey, cost: 0 }];
            while (queue.length > 0) {
                const { key, cost } = queue.shift();
                if (key !== originKey && !ignoreZoc && zoc.has(key)) continue;  // ZOC stops movement
                for (const n of Hex.fromKey(key).neighbors()) {
                    const nKey = n.key();
                    const hex = s.hexes.get(nKey);
                    if (!hex) continue;
                    if (hostileOcc.has(nKey)) continue;
                    const step = this.stackMoveCost(stack, hex);
                    if (step === Infinity) continue;
                    const total = cost + step;
                    if (total > mp) continue;
                    if (costs.has(nKey) && costs.get(nKey) <= total) continue;
                    costs.set(nKey, total);
                    const idx = queue.findIndex(e => e.cost > total);
                    if (idx === -1) queue.push({ key: nKey, cost: total });
                    else queue.splice(idx, 0, { key: nKey, cost: total });
                }
            }

            costs.delete(originKey);
            const out = new Map();
            for (const [key, cost] of costs) {
                const here = this.stackAt(key);
                if (here.length + stack.length > STACK_LIMIT) continue;      // pass-through only
                out.set(key, cost);
            }
            return out;
        }

        // The subset of a stack that a move would actually carry: breakthrough units
        // when a free move is banked, otherwise everything that can march (an MP-0 Air
        // Wing stays on its base rather than pinning the ground units under it).
        moversOf(stack) {
            const free = stack.filter(u => u.freeMP > 0);
            if (free.length > 0) return free;
            return stack.filter(u => stats(u).mp > 0);
        }

        subsetOf(stack, unitIds) {
            if (!unitIds) return stack;
            return stack.filter(u => unitIds.includes(u.id));
        }

        // Occupiers may not leave friendly-controlled territory: a garrison among the
        // moving units restricts the reachable set to hexes the faction already owns
        // (split the garrison out of the selection and the rest march freely).
        computeReachableFor(originKey, unitIds) {
            const stack = this.subsetOf(this.stackAt(originKey), unitIds);
            const reachable = this.computeStackReachable(originKey, unitIds);
            if (!stack.some(u => flagsOf(u).occupier)) return reachable;
            const s = this.state;
            const out = new Map();
            for (const [key, cost] of reachable)
                if (s.hexes.get(key).owner === stack[0].faction) out.set(key, cost);
            return out;
        }

        // ---- Combat math ----
        // Dry-run odds for attacking from originKey into targetKey. A declared attack is
        // one operation: every ready friendly stack adjacent to the target joins in
        // (spending its action, but only the initiator pays activation), plus artillery
        // and air support in range. Null if the attack can't be declared.
        computeOdds(originKey, targetKey) {
            const s = this.state;
            const stack = this.stackAt(originKey);
            const defStack = this.stackAt(targetKey);
            if (stack.length === 0 || defStack.length === 0) return null;
            if (defStack[0].faction === stack[0].faction) return null;

            const joinKeys = [];
            for (const n of Hex.fromKey(targetKey).neighbors()) {
                const key = n.key();
                if (key === originKey) continue;
                const joiners = this.stackAt(key);
                if (joiners.length === 0 || joiners[0].faction !== stack[0].faction) continue;
                if (joiners.some(u => u.attacked)) continue;
                if (joiners.reduce((sum, u) => sum + stats(u).atk, 0) === 0) continue;
                joinKeys.push(key);
            }
            const attackers = [originKey, ...joinKeys].flatMap(key => this.stackAt(key));

            let atk = attackers.reduce((sum, u) => sum + stats(u).atk, 0);
            if (atk === 0) return null;

            // Per-hex attack contribution, for the UI to badge each contributing stack.
            const contributions = new Map();
            for (const key of [originKey, ...joinKeys])
                contributions.set(key, this.stackAt(key).reduce((sum, u) => sum + stats(u).atk, 0));

            const target = Hex.fromKey(targetKey);
            const attackerIds = new Set(attackers.map(u => u.id));
            const supportIds = [];
            for (const u of s.units) {
                if (u.faction !== stack[0].faction || u.attacked) continue;
                if (attackerIds.has(u.id)) continue;
                const range = flagsOf(u).support ?? flagsOf(u).strike;
                if (!range || hexDist(u, target) > range) continue;
                atk += stats(u).atk;
                supportIds.push(u.id);
                const key = Hex.key(u.q, u.r);
                contributions.set(key, (contributions.get(key) ?? 0) + stats(u).atk);
            }

            const hex = s.hexes.get(targetKey);
            let mult = COMBAT.TERRAIN_DEF_MULT[hex.terrain] * (hex.city ? COMBAT.CITY_DEF_MULT : 1);
            if (attackers.some(u => flagsOf(u).siege)) mult = Math.min(mult, COMBAT.SIEGE_CAP);
            const def = defStack.reduce((sum, u) =>
                sum + stats(u).def * (u.entrenched ? COMBAT.ENTRENCH_MULT : 1), 0) * mult;

            const odds = Math.min(COMBAT.MAX_ODDS, Math.floor(atk / def));
            return { odds, atk, def, supportIds, joinKeys, contributions };
        }

        // Adjacent hostile hexes this stack could attack right now at >= 1:1,
        // given readiness and CP. Occupiers never attack.
        computeAttackable(originKey) {
            const stack = this.stackAt(originKey);
            const out = new Set();
            if (stack.length === 0) return out;
            if (stack.some(u => u.attacked)) return out;
            if (stack.some(u => flagsOf(u).occupier)) return out;
            if (!this.canAfford(stack, this.pendingCharge(stack, originKey))) return out;
            for (const n of Hex.fromKey(originKey).neighbors()) {
                const odds = this.computeOdds(originKey, n.key());
                if (odds && odds.odds >= 1) out.add(n.key());
            }
            return out;
        }

        // Hostile stacks or hostile faction cities a ready rocket in this stack could hit.
        computeBombardable(originKey) {
            const s = this.state;
            const stack = this.stackAt(originKey);
            const out = new Set();
            const rocket = stack.find(u => flagsOf(u).bombard && !u.attacked);
            if (!rocket) return out;
            if (!this.canAfford(stack, this.pendingCharge(stack, originKey))) return out;
            const range = flagsOf(rocket).bombard;
            const origin = Hex.fromKey(originKey);

            for (const u of s.units) {
                if (u.faction === rocket.faction) continue;
                if (!u.entrenched) continue;
                if (hexDist(origin, u) <= range) out.add(Hex.key(u.q, u.r));
            }
            for (const hex of this.cityHexes()) {
                const owner = this.factionOf(hex.owner);
                if (!owner || owner.id === rocket.faction || owner.cp <= 0) continue;
                if (hexDist(origin, hex) <= range) out.add(Hex.key(hex.q, hex.r));
            }
            return out;
        }

        // Everything the UI needs to light up a selected stack, with CP checks applied.
        // A sub-stack selection (unitIds) is movement-only: attacks and bombardments
        // always pool the whole hex (and its neighbors), so they light up only when the
        // whole stack is selected.
        selectionSets(originKey, unitIds) {
            return {
                reachable: this.canAffordFreshMove(originKey, unitIds)
                    ? this.computeReachableFor(originKey, unitIds) : new Map(),
                attackable: unitIds ? new Set() : this.computeAttackable(originKey),
                bombardable: unitIds ? new Set() : this.computeBombardable(originKey),
            };
        }

        canAffordFreshMove(originKey, unitIds) {
            const movers = this.moversOf(this.subsetOf(this.stackAt(originKey), unitIds));
            if (movers.length === 0) return false;
            return this.canAfford(movers, this.activationCost(movers, originKey));
        }

        // ---- Actions (mutate state, return an outcome; no rendering) ----

        moveStack(originKey, destKey, unitIds) {
            const s = this.state;
            const stack = this.moversOf(this.subsetOf(this.stackAt(originKey), unitIds));
            const reachable = this.computeReachableFor(originKey, unitIds);
            if (!reachable.has(destKey)) return { ok: false };

            const charge = this.activationCost(stack, originKey);
            if (!this.canAfford(stack, charge)) return { ok: false, reason: 'cp' };
            const faction = this.factionOf(stack[0].faction);
            if (faction) faction.cp -= charge;

            const dest = Hex.fromKey(destKey);
            for (const u of stack) {
                u.q = dest.q; u.r = dest.r;
                u.entrenched = false;
                u.activated = true;
                u.freeMP = 0;
            }
            this.claimHex(s.hexes.get(destKey), stack[0].faction);
            return { ok: true };
        }

        // Flip a hex (and its city) to fid; a fallen capital cascades revolts across the
        // loser's ungarrisoned conquests — the empire's death spiral is immediate.
        claimHex(hex, fid) {
            const prev = hex.owner;
            if (prev === fid) return;
            hex.owner = fid;
            if (!hex.city) return;
            hex.city.heldTurns = 0;
            const loser = this.factionOf(prev);
            if (loser && loser.capital === Hex.key(hex.q, hex.r)) this.capitalFallen(loser);
        }

        capitalFallen(faction) {
            for (const hex of this.citiesOwnedBy(faction.id)) {
                if (hex.city.homelandOf === faction.id) continue;
                if (this.unitsAt(hex.q, hex.r).length > 0) continue;    // held cities stay loyal
                this.revoltCity(hex);
            }
        }

        revoltCity(hex) {
            hex.owner = PARTISAN;
            hex.city.heldTurns = 0;
            if (this.unitsAt(hex.q, hex.r).length === 0)
                this.spawnUnit('militia', PARTISAN, hex.q, hex.r);
        }

        resolveCombat(originKey, targetKey) {
            const stack = this.stackAt(originKey);
            if (stack.length === 0 || stack.some(u => u.attacked)) return { ok: false };
            if (stack.some(u => flagsOf(u).occupier)) return { ok: false };
            if (hexDist(Hex.fromKey(originKey), Hex.fromKey(targetKey)) !== 1) return { ok: false };
            const odds = this.computeOdds(originKey, targetKey);
            if (!odds || odds.odds < 1) return { ok: false };

            const charge = this.pendingCharge(stack, originKey);
            if (!this.canAfford(stack, charge)) return { ok: false, reason: 'cp' };
            const faction = this.factionOf(stack[0].faction);
            if (faction) faction.cp -= charge;

            for (const id of odds.supportIds)
                this.state.units.find(u => u.id === id).attacked = true;
            const attackers = [originKey, ...odds.joinKeys].flatMap(key => this.stackAt(key));
            for (const u of attackers) { u.activated = true; u.attacked = true; }

            const roll = Rando.int(1, 6);
            const result = COMBAT.CRT[odds.odds][roll - 1];
            const defStack = this.stackAt(targetKey);

            if (result === 'AR') {
                this.retreatStack(stack, targetKey, 1);   // initiator falls back; joiners hold
            } else if (result === 'EX') {
                this.eliminateUnit(this.leastExpensive(defStack));
                this.eliminateUnit(this.leastExpensive(attackers));
            } else if (result === 'DR') {
                if (!this.retreatStack(defStack, originKey, COMBAT.RETREAT_STEPS))
                    defStack.forEach(u => this.eliminateUnit(u));  // pocketed: no path out
            } else if (result === 'DE') {
                defStack.forEach(u => this.eliminateUnit(u));
            }

            const vacated = result !== 'AR' && this.stackAt(targetKey).length === 0;
            const advanced = vacated ? this.advanceAfterCombat(originKey, targetKey) : false;
            return { ok: true, result, odds: odds.odds, roll, vacated, advanced };
        }

        // Breakthrough: exploit units surge into the vacated hex (others hold the line);
        // a stack with no exploiters advances whole, minus artillery — it never advances.
        // Exploiters earn a free follow-up move.
        advanceAfterCombat(originKey, targetKey) {
            const survivors = this.stackAt(originKey);
            if (survivors.length === 0) return false;
            const exploiters = survivors.filter(u => flagsOf(u).exploit);
            const movers = exploiters.length > 0 ? exploiters
                : survivors.filter(u => !flagsOf(u).support);
            if (movers.length === 0) return false;
            const dest = Hex.fromKey(targetKey);
            for (const u of movers) {
                u.q = dest.q; u.r = dest.r;
                u.entrenched = false;
                if (flagsOf(u).exploit) u.freeMP = COMBAT.EXPLOIT_MP;
            }
            this.claimHex(this.state.hexes.get(targetKey), movers[0].faction);
            return true;
        }

        // Step a stack away from awayKey; each step must dodge hostiles, hostile ZOC,
        // impassable terrain, and overstacking. False if any step has no way out.
        retreatStack(stack, awayKey, steps) {
            const s = this.state;
            const away = Hex.fromKey(awayKey);
            const fid = stack[0].faction;
            for (let i = 0; i < steps; i++) {
                const hostileOcc = this.hostileOccupancy(fid);
                const zoc = this.zocOf(fid);
                const cur = new Hex(stack[0].q, stack[0].r);
                const options = cur.neighbors().filter(n => {
                    const hex = s.hexes.get(n.key());
                    if (!hex) return false;
                    if (this.stackMoveCost(stack, hex) === Infinity) return false;
                    if (hostileOcc.has(n.key())) return false;
                    if (zoc.has(n.key())) return false;
                    return this.stackAt(n.key()).length + stack.length <= STACK_LIMIT;
                });
                if (options.length === 0) return false;
                const best = Math.max(...options.map(o => o.distance(away)));
                const dest = Rando.choice(options.filter(o => o.distance(away) === best));
                for (const u of stack) {
                    u.q = dest.q; u.r = dest.r;
                    u.entrenched = false;
                }
            }
            return true;
        }

        leastExpensive(stack) {
            return stack.reduce((best, u) => stats(u).cost < stats(best).cost ? u : best);
        }

        eliminateUnit(unit) {
            const s = this.state;
            s.units = s.units.filter(u => u.id !== unit.id);
            if (unit.type === 'dragon') {
                const faction = this.factionOf(unit.faction);
                if (faction) faction.uniqueCostBump += ECON.DRAGON_REBUILD_BUMP;
            }
        }

        // Rocket strike: strips entrenchment from a dug-in stack, otherwise burns one
        // CP from a hostile city's stockpile. Consumes the whole stack's activation.
        bombard(originKey, targetKey) {
            const s = this.state;
            const stack = this.stackAt(originKey);
            if (!this.computeBombardable(originKey).has(targetKey)) return { ok: false };

            const charge = this.pendingCharge(stack, originKey);
            if (!this.canAfford(stack, charge)) return { ok: false, reason: 'cp' };
            const faction = this.factionOf(stack[0].faction);
            if (faction) faction.cp -= charge;
            for (const u of stack) { u.activated = true; u.attacked = true; }

            const defStack = this.stackAt(targetKey);
            if (defStack.some(u => u.entrenched)) {
                defStack.forEach(u => { u.entrenched = false; });
                return { ok: true, effect: 'entrench' };
            }
            const owner = this.factionOf(s.hexes.get(targetKey).owner);
            owner.cp -= 1;
            return { ok: true, effect: 'cp' };
        }

        // Build one unit at a friendly city (one build per city per turn). New units
        // arrive activated: they fight next turn.
        build(cityKey, type) {
            const s = this.state;
            const hex = s.hexes.get(cityKey);
            const faction = this.factionOf(hex.owner);
            if (!faction || !hex.city || hex.city.builtThisTurn) return { ok: false };
            const err = this.buildBlocked(faction, cityKey, type);
            if (err) return { ok: false, reason: err };

            faction.cp -= this.buildCost(faction, type);
            hex.city.builtThisTurn = true;
            const unit = this.spawnUnit(type, faction.id, hex.q, hex.r);
            unit.activated = true;
            unit.attacked = true;
            return { ok: true, unit };
        }

        buildableTypes(faction) {
            return [...SHARED_BUILD, faction.unique];
        }

        buildCost(faction, type) {
            const base = UNITS[type].cost;
            return type === faction.unique ? base + faction.uniqueCostBump : base;
        }

        // Why this build is impossible right now, or null if it's allowed —
        // one function so the UI's disabled-button reasons match the engine's rules.
        buildBlocked(faction, cityKey, type) {
            if (!this.buildableTypes(faction).includes(type)) return 'type';
            if (this.unitCountOfType(faction.id, type) >= UNITS[type].cap) return 'cap';
            if (this.stackAt(cityKey).length >= STACK_LIMIT) return 'stack';
            if (faction.cp < this.buildCost(faction, type)) return 'cp';
            return null;
        }

        spawnUnit(type, fid, q, r) {
            const unit = {
                id: this.state.nextUnitId++, type, faction: fid, q, r,
                entrenched: false, activated: false, attacked: false, freeMP: 0,
            };
            this.state.units.push(unit);
            return unit;
        }

        // ---- Turn structure ----

        startFactionTurn(faction) {
            const s = this.state;
            const capitalHeld = s.hexes.get(faction.capital).owner === faction.id;
            let income = 0;
            for (const hex of this.citiesOwnedBy(faction.id)) {
                if (faction.capital === Hex.key(hex.q, hex.r)) income += ECON.CP_CAPITAL;
                else if (hex.city.homelandOf === faction.id)
                    income += capitalHeld ? ECON.CP_HOMELAND : ECON.CP_HOMELAND_NO_CAPITAL;
                else if (hex.city.heldTurns >= 1) income += ECON.CP_CONQUERED;
                hex.city.builtThisTurn = false;
            }
            faction.cp += income;
        }

        // Entrench idle units, age city holds, roll revolts, sweep eliminations,
        // and advance the public victory countdown. Returns animatable events.
        endFactionTurn(faction) {
            const s = this.state;
            const events = [];
            for (const u of s.units) {
                if (u.faction !== faction.id) continue;
                if (!u.activated && !u.attacked) u.entrenched = true;
                u.activated = false;
                u.attacked = false;
                u.freeMP = 0;
            }
            for (const hex of this.citiesOwnedBy(faction.id)) {
                hex.city.heldTurns++;
                if (hex.city.homelandOf === faction.id) continue;
                if (this.unitsAt(hex.q, hex.r).length > 0) continue;     // occupied = suppressed
                if (Rando.int(1, 6) < ECON.REVOLT_ON) continue;
                this.revoltCity(hex);
                events.push({ type: 'revolt', key: Hex.key(hex.q, hex.r) });
            }
            this.sweepEliminations(events);
            this.checkVictory(faction);
            return events;
        }

        sweepEliminations(events) {
            for (const faction of this.aliveFactions()) {
                if (this.citiesOwnedBy(faction.id).length > 0) continue;
                faction.eliminated = true;
                this.state.units = this.state.units.filter(u => u.faction !== faction.id);
                events.push({ type: 'eliminated', faction: faction.id });
            }
        }

        checkVictory(faction) {
            const s = this.state;
            const count = this.victoryCityCount(faction.id);
            faction.victoryStreak = count >= CITIES.VICTORY_NEED ? faction.victoryStreak + 1 : 0;
            if (faction.victoryStreak >= CITIES.VICTORY_STREAK) s.winner = faction.id;
            const alive = this.aliveFactions();
            if (alive.length === 1) s.winner = alive[0].id;
        }

        // The whole opponents' round as a generator: player's end-of-turn strain, each
        // AI faction's full turn, the partisan phase, then the player's next income.
        // Yields one event per mutation so the client can animate step by step.
        *runOpponentRound() {
            const s = this.state;
            const player = this.factionOf(s.playerFaction);
            yield* this.endFactionTurn(player);
            if (s.winner) return;

            s.phase = 'ai';
            for (const faction of s.factions) {
                if (faction.id === s.playerFaction || faction.eliminated) continue;
                this.startFactionTurn(faction);
                yield* this.aiOperations(faction);
                yield* this.endFactionTurn(faction);
                if (s.winner) return;
            }
            yield* this.partisanOperations();

            s.turn++;
            if (!player.eliminated) this.startFactionTurn(player);
            s.phase = 'player';
        }

        // ---- AI ----
        // Constraints per DYNAMICS.md: same economy and CRT, one committed objective at
        // a time, full A* pathing walked within reach, balance-of-power targeting.

        factionStackKeys(fid) {
            const keys = new Set();
            for (const u of this.state.units)
                if (u.faction === fid) keys.add(Hex.key(u.q, u.r));
            return [...keys];
        }

        *aiOperations(faction) {
            this.aiBuild(faction);
            this.aiPickObjective(faction);
            const objective = faction.aiObjective && this.state.hexes.get(faction.aiObjective);

            let keys = this.factionStackKeys(faction.id);
            if (objective) {
                keys.sort((a, b) =>
                    hexDist(Hex.fromKey(a), objective) - hexDist(Hex.fromKey(b), objective));
                // Concentrate CP on the stacks nearest the front; the rear entrenches.
                keys = keys.slice(0, AI.FRONT_STACKS);
            }

            for (const originKey of keys) {
                if (faction.cp <= 0) break;
                const stack = this.stackAt(originKey);
                if (stack.length === 0) continue;                        // merged or destroyed
                if (stack.every(u => u.activated || u.attacked)) continue;
                if (stack.every(u => flagsOf(u).occupier || stats(u).mp === 0)) continue;

                const bombEv = this.aiTryBombard(originKey);
                if (bombEv) { yield bombEv; continue; }

                let ev = this.aiTryAttack(originKey, faction);
                if (ev) { yield ev; continue; }

                const moveEv = this.aiMoveToward(originKey, faction);
                if (!moveEv) continue;
                yield moveEv;
                ev = this.aiTryAttack(moveEv.to, faction);
                if (ev) yield ev;
            }
        }

        aiTryBombard(originKey) {
            const targets = this.computeBombardable(originKey);
            if (targets.size === 0) return null;
            const origin = Hex.fromKey(originKey);
            const targetKey = [...targets].sort((a, b) =>
                hexDist(origin, Hex.fromKey(a)) - hexDist(origin, Hex.fromKey(b)))[0];
            const res = this.bombard(originKey, targetKey);
            return res.ok ? { type: 'bombard', from: originKey, targetKey, effect: res.effect } : null;
        }

        // Attack the best-odds adjacent target; cautious at 1:1 unless the defenders are
        // rabble or the prize is the committed objective.
        aiTryAttack(originKey, faction) {
            const attackable = this.computeAttackable(originKey);
            let best = null;
            for (const key of attackable) {
                const odds = this.computeOdds(originKey, key);
                if (!best || odds.odds > best.odds.odds) best = { key, odds };
            }
            if (!best) return null;
            const defenders = this.stackAt(best.key);
            // Press at 1:1 against rabble, the committed objective, or once the
            // offensive has stalled — attrition is how entrenched walls come down.
            const softTarget = defenders.every(u => u.type === 'militia') ||
                best.key === faction.aiObjective ||
                faction.aiObjectiveAge >= AI.GRIND_AGE;
            if (best.odds.odds < AI.MIN_ODDS && !softTarget) return null;
            const res = this.resolveCombat(originKey, best.key);
            if (!res.ok) return null;
            return { type: 'combat', from: originKey, targetKey: best.key, ...res };
        }

        aiMoveToward(originKey, faction) {
            const s = this.state;
            const objective = faction.aiObjective && s.hexes.get(faction.aiObjective);
            if (!objective) return null;
            const reachable = this.computeReachableFor(originKey, null);
            if (reachable.size === 0) return null;

            const origin = Hex.fromKey(originKey);
            let destKey = null;
            const path = this.aiPath(originKey, faction.aiObjective);
            if (path) {
                for (let i = path.length - 1; i > 0 && !destKey; i--) {
                    const key = path[i].key();
                    if (reachable.has(key)) destKey = key;
                }
            }
            if (!destKey) {
                // No walkable path progress: fall back to the reachable hex nearest the goal.
                let bestDist = origin.distance(objective);
                for (const key of reachable.keys()) {
                    const d = Hex.fromKey(key).distance(objective);
                    if (d < bestDist) { bestDist = d; destKey = key; }
                }
            }
            if (!destKey) return null;
            const res = this.moveStack(originKey, destKey, null);
            return res.ok ? { type: 'move', from: originKey, to: destKey } : null;
        }

        // Full A* to the objective (never MP-horizon search). Hostile-held hexes block
        // the route except the objective itself; if that seals every path, plan through
        // them — combat will clear the way when the stack bumps into the blocker.
        aiPath(originKey, targetKey) {
            const s = this.state;
            const stack = this.stackAt(originKey);
            const origin = Hex.fromKey(originKey);
            const target = Hex.fromKey(targetKey);
            const costOf = (q, r) => this.stackMoveCost(stack, s.hexes.get(Hex.key(q, r)));
            const open = (q, r) => {
                const hex = s.hexes.get(Hex.key(q, r));
                return !!hex && costOf(q, r) !== Infinity;
            };
            const hostileOcc = this.hostileOccupancy(stack[0].faction);
            const openUnblocked = (q, r) =>
                open(q, r) && (Hex.key(q, r) === targetKey || !hostileOcc.has(Hex.key(q, r)));

            return findPath(origin, target, openUnblocked, costOf, Infinity)
                ?? findPath(origin, target, open, costOf, Infinity);
        }

        // Balance of power: dogpile whoever is closest to winning; otherwise expand into
        // the nearest partisan or rival city. Committed until the objective is taken —
        // with a timeout so a stalled offensive eventually picks a new front.
        aiPickObjective(faction) {
            const s = this.state;
            if (faction.aiObjective) {
                const hex = s.hexes.get(faction.aiObjective);
                faction.aiObjectiveAge++;
                if (hex.owner !== faction.id && faction.aiObjectiveAge <= AI.OBJECTIVE_TIMEOUT) return;
                faction.aiObjective = null;
            }
            faction.aiObjectiveAge = 0;

            const rivals = this.aliveFactions().filter(f => f.id !== faction.id);
            if (rivals.length === 0) return;
            const leader = rivals.reduce((best, f) =>
                this.victoryCityCount(f.id) > this.victoryCityCount(best.id) ? f : best);
            const dogpile = this.victoryCityCount(leader.id) >= CITIES.VICTORY_NEED - 1;

            // Dogpile whoever is about to win; otherwise the nearest city not ours —
            // partisan or rival alike, so no power gets to sit out the war. Only cities
            // the army can actually walk to count: no committing to island objectives.
            const anchors = this.state.units.filter(u => u.faction === faction.id);
            if (anchors.length === 0) return;
            const walkable = bfsHexes(anchors[0], s.hexes,
                hex => MOVEMENT_COST[hex.terrain] ?? Infinity, Infinity);
            const candidates = this.cityHexes().filter(hex =>
                walkable.has(Hex.key(hex.q, hex.r)) &&
                (dogpile ? hex.owner === leader.id : hex.owner !== faction.id));
            if (candidates.length === 0) return;

            const distToUs = hex => Math.min(...anchors.map(u => hexDist(u, hex)));
            const nearest = candidates.reduce((best, hex) =>
                distToUs(hex) < distToUs(best) ? hex : best);
            faction.aiObjective = Hex.key(nearest.q, nearest.r);
        }

        // Builds: garrison every naked conquest first (cohesion), then combat power,
        // with the unique when the treasury runs deep. Keeps a CP reserve for operations.
        aiBuild(faction) {
            for (const hex of this.citiesOwnedBy(faction.id)) {
                if (hex.city.homelandOf === faction.id) continue;
                if (this.unitsAt(hex.q, hex.r).length > 0) continue;
                if (faction.cp < UNITS.garrison.cost) break;
                this.build(Hex.key(hex.q, hex.r), 'garrison');
            }

            // Don't bloat: past the per-city cap the AI banks CP for operations instead.
            const maxUnits = this.citiesOwnedBy(faction.id).length * AI.UNITS_PER_CITY + 3;
            if (this.state.units.filter(u => u.faction === faction.id).length >= maxUnits) return;

            const reserve = AI.RESERVE_CP;
            const wishlist = ['armor', 'infantry', 'artillery', 'infantry'];
            if (this.unitCountOfType(faction.id, faction.unique) < UNITS[faction.unique].cap &&
                faction.cp >= this.buildCost(faction, faction.unique) + reserve)
                wishlist.unshift(faction.unique);

            const sites = this.citiesOwnedBy(faction.id)
                .filter(hex => !hex.city.builtThisTurn);
            for (const type of wishlist) {
                if (faction.cp < this.buildCost(faction, type) + reserve) continue;
                const site = sites.find(hex =>
                    !hex.city.builtThisTurn && this.stackAt(Hex.key(hex.q, hex.r)).length < STACK_LIMIT);
                if (!site) break;
                this.build(Hex.key(site.q, site.r), type);
            }
        }

        // Partisans hold their ground and maul anything adjacent they can catch at 1:1.
        *partisanOperations() {
            for (const originKey of this.factionStackKeys(PARTISAN)) {
                const stack = this.stackAt(originKey);
                if (stack.length === 0) continue;
                let best = null;
                for (const key of this.computeAttackable(originKey)) {
                    const odds = this.computeOdds(originKey, key);
                    if (!best || odds.odds > best.odds.odds) best = { key, odds };
                }
                if (!best) continue;
                const res = this.resolveCombat(originKey, best.key);
                if (res.ok) yield { type: 'combat', from: originKey, targetKey: best.key, ...res };
            }
            for (const u of this.state.units) {
                if (u.faction !== PARTISAN) continue;
                u.activated = false;
                u.attacked = false;
            }
        }

        // ---- New game / world generation ----
        // Regenerates (up to 20 tries) until every capital can reach every other by land.
        newGame(seed, playerFactionId) {
            const s = this.state;
            s.seed = (seed === undefined || seed === null)
                ? Math.floor(Math.random() * 0x100000000)
                : (seed >>> 0);
            Rando.seed(s.seed);

            let attempts = 0;
            do {
                s.hexes = this.generateRectGrid();
                this.assignTerrain();
                this.placeCitiesAndFactions();
                attempts++;
            } while (!this.capitalsConnected() && attempts < 20);

            s.playerFaction = playerFactionId;
            this.paintInitialControl();
            this.spawnStartingUnits();
            s.turn = 1;
            s.phase = 'player';
            s.winner = null;
            this.startFactionTurn(this.factionOf(playerFactionId));
        }

        // Diamond-square heightmap over a (size x size) grid, normalized to [0, 100].
        diamondSquare(size, roughness) {
            const grid = new Float64Array(size * size);
            const get = (x, y) => grid[y * size + x];
            const set = (x, y, v) => { grid[y * size + x] = v; };

            set(0, 0, Rando.random());
            set(size - 1, 0, Rando.random());
            set(0, size - 1, Rando.random());
            set(size - 1, size - 1, Rando.random());

            let step = size - 1;
            let scale = roughness;
            while (step > 1) {
                const half = step / 2;
                for (let y = half; y < size - 1; y += step)
                    for (let x = half; x < size - 1; x += step)
                        set(x, y, (get(x - half, y - half) + get(x + half, y - half) +
                            get(x - half, y + half) + get(x + half, y + half)) / 4 +
                            (Rando.random() - 0.5) * scale);
                for (let y = 0; y < size; y += half)
                    for (let x = (y + half) % step; x < size; x += step) {
                        let sum = 0, cnt = 0;
                        if (x >= half) { sum += get(x - half, y); cnt++; }
                        if (x + half < size) { sum += get(x + half, y); cnt++; }
                        if (y >= half) { sum += get(x, y - half); cnt++; }
                        if (y + half < size) { sum += get(x, y + half); cnt++; }
                        set(x, y, sum / cnt + (Rando.random() - 0.5) * scale);
                    }
                step = half;
                scale *= roughness;
            }

            let min = Infinity, max = -Infinity;
            for (let i = 0; i < grid.length; i++) { min = Math.min(min, grid[i]); max = Math.max(max, grid[i]); }
            for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / (max - min) * 100;
            return grid;
        }

        // Rectangle of MAP_COLS x MAP_ROWS axial hexes with a per-row q offset; edges
        // flagged. Elevation sampled from a fresh heightmap. Terrain filled in later.
        generateRectGrid() {
            const hexes = new Map();
            const hm = this.diamondSquare(129, 0.55);

            for (let row = 0; row < MAP_ROWS; row++) {
                const qOffset = -Math.floor(row / 2);
                for (let col = 0; col < MAP_COLS; col++) {
                    const q = col + qOffset;
                    const r = row;
                    const gx = Math.round(col / (MAP_COLS - 1) * 128);
                    const gy = Math.round(row / (MAP_ROWS - 1) * 128);
                    const elevation = hm[gy * 129 + gx];
                    const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;

                    hexes.set(Hex.key(q, r), {
                        q, r, col, row, elevation, isEdge,
                        terrain: null, owner: null, city: null
                    });
                }
            }
            return hexes;
        }

        // Base terrain by elevation percentile, then forests scattered among plains;
        // edges forced to water.
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
            for (let i = 0; i < forestCount && i < plains.length; i++)
                plains[i].terrain = TERRAIN.FOREST;
        }

        cityName() {
            const parts = Rando.int(2, 3);
            let name = '';
            for (let i = 0; i < parts; i++) name += Rando.choice(CITY_SYLLABLES);
            return name.charAt(0).toUpperCase() + name.slice(1);
        }

        // Scatter cities with minimum spacing, seat the four capitals as far apart as
        // possible, deal each faction its nearest homeland cities, leave the rest to the
        // partisans, and crown the victory cities.
        placeCitiesAndFactions() {
            const s = this.state;
            const candidates = Rando.shuffle(this.passableHexes());
            const cities = [];
            for (const hex of candidates) {
                if (cities.some(c => hexDist(c, hex) < CITIES.MIN_SPACING)) continue;
                cities.push(hex);
                if (cities.length === CITIES.COUNT) break;
            }
            for (const hex of cities) {
                hex.city = { name: this.cityName(), victory: false, homelandOf: null, heldTurns: 0, builtThisTurn: false };
                hex.terrain = TERRAIN.CITY;
            }
            s.cityKeys = cities.map(h => Hex.key(h.q, h.r));

            const capitals = this.spreadPick(cities, [], FACTIONS.length);
            s.factions = FACTIONS.map((def, i) => ({
                id: def.id, name: def.name, unique: def.unique,
                capital: Hex.key(capitals[i].q, capitals[i].r),
                cp: ECON.START_CP, eliminated: false, victoryStreak: 0,
                uniqueCostBump: 0, aiObjective: null, aiObjectiveAge: 0,
            }));
            for (let i = 0; i < capitals.length; i++) {
                capitals[i].city.victory = true;
                capitals[i].city.homelandOf = s.factions[i].id;
                capitals[i].owner = s.factions[i].id;
                capitals[i].terrain = TERRAIN.CAPITAL;
            }

            // Homelands: round-robin so no faction hoards all the close cities.
            const unclaimed = cities.filter(h => !h.city.homelandOf);
            for (let round = 0; round < CITIES.HOMELAND_PER_FACTION; round++) {
                for (let i = 0; i < s.factions.length; i++) {
                    const pool = unclaimed.filter(h => !h.city.homelandOf);
                    if (pool.length === 0) break;
                    const home = pool.reduce((best, h) =>
                        hexDist(h, capitals[i]) < hexDist(best, capitals[i]) ? h : best);
                    home.city.homelandOf = s.factions[i].id;
                    home.owner = s.factions[i].id;
                }
            }

            const neutrals = cities.filter(h => !h.city.homelandOf);
            for (const hex of neutrals) hex.owner = PARTISAN;
            for (const hex of this.spreadPick(neutrals, capitals, CITIES.VICTORY_NEUTRALS))
                hex.city.victory = true;
        }

        // Greedy max-min-distance picks from `pool`, spacing against `seeded` + earlier picks.
        spreadPick(pool, seeded, count) {
            const picks = [];
            const spacers = () => [...seeded, ...picks];
            for (let i = 0; i < count && picks.length < pool.length; i++) {
                let best = null, bestDist = -1;
                for (const hex of pool) {
                    if (picks.includes(hex)) continue;
                    const others = spacers();
                    const d = others.length === 0 ? Infinity
                        : Math.min(...others.map(o => hexDist(o, hex)));
                    if (d > bestDist) { bestDist = d; best = hex; }
                }
                if (best) picks.push(best);
            }
            return picks;
        }

        capitalsConnected() {
            const s = this.state;
            if (s.factions.length === 0) return false;
            const start = Hex.fromKey(s.factions[0].capital);
            const costs = bfsHexes(start, s.hexes,
                hex => MOVEMENT_COST[hex.terrain] ?? Infinity, Infinity);
            return s.factions.every(f => costs.has(f.capital));
        }

        paintInitialControl() {
            const s = this.state;
            const owned = this.cityHexes().filter(h => this.factionOf(h.owner));
            for (const [, hex] of s.hexes) {
                if (hex.owner !== null) continue;
                let best = null, bestDist = Infinity;
                for (const cityHex of owned) {
                    const d = hexDist(hex, cityHex);
                    if (d <= CITIES.CONTROL_RADIUS && d < bestDist) { bestDist = d; best = cityHex; }
                }
                if (best) hex.owner = best.owner;
            }
        }

        spawnStartingUnits() {
            const s = this.state;
            s.units = [];
            s.nextUnitId = 1;
            for (const faction of s.factions) {
                const cap = Hex.fromKey(faction.capital);
                this.spawnUnit('infantry', faction.id, cap.q, cap.r);
                this.spawnUnit('artillery', faction.id, cap.q, cap.r);
                this.spawnUnit('armor', faction.id, cap.q, cap.r);
                for (const hex of this.citiesOwnedBy(faction.id)) {
                    if (Hex.key(hex.q, hex.r) === faction.capital) continue;
                    this.spawnUnit('infantry', faction.id, hex.q, hex.r);
                }
            }
            for (const hex of this.cityHexes())
                if (hex.owner === PARTISAN) this.spawnUnit('militia', PARTISAN, hex.q, hex.r);
        }
    }

    return GameEngine;
})();
