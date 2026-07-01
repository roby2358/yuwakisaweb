// gameengine.js — GameEngine: all rules and mutations (DYNAMICS §5).
// Owns the turn loop, map generation, the player-action verbs, and the animated
// enemy-phase state machine that GameUI drives one step at a time.

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

class GameEngine {
    constructor(state) { this.state = state; }

    // ================================================================= setup
    initGame() {
        const s = this.state;
        s.hexes.clear();
        s.units = [];
        s.aliens = [];
        s.controlled = new Set();
        s.revealed = new Set();
        s.materials = 6;
        s.rations = 6;
        s.frozen = RECLAIMER.frozenColonists;
        s.relics = 0;
        s.turn = 1;
        s.phase = 'player';
        s.gameOver = null;
        s.nextId = 1;
        s.captainRespawnAt = null;
        s.enemy = null;
        s.log = 'Grounded. Reclaim the planet — hex by hex.';

        this.generateMap();
        this.placeLanderAndCaptain();
        this.seedCorruption();
        this.ensureStarterDeposits();
        this.computeControl();
        this.reveal();
    }

    // Guarantee a Minerals and a Biomass deposit in the near frontier so the economy is always
    // bootstrappable — otherwise a run can spawn with no reachable deposit to build on.
    ensureStarterDeposits() {
        const s = this.state, L = new Hex(s.lander.q, s.lander.r);
        const ring = [...s.hexes.values()]
            .filter(h => s.isLand(h.q, h.r) && !s.isLander(h.q, h.r))
            .map(h => ({ h, d: L.distance(new Hex(h.q, h.r)) }))
            .filter(x => x.d >= 2 && x.d <= 3)
            .sort((a, b) => a.d - b.d);
        const place = (terrain, deposit) => {
            const i = ring.findIndex(x => x.h.deposit === null && x.h.breederHp <= 0);
            if (i < 0) return;
            const h = ring[i].h; h.terrain = terrain; h.deposit = deposit; ring.splice(i, 1);
        };
        place(TERRAIN.HILLS, DEPOSIT.MINERALS);
        place(TERRAIN.PLAINS, DEPOSIT.BIOMASS);
    }

    // Coherent heightmap by smoothing random noise, then terrain by elevation bands.
    generateMap() {
        const s = this.state;
        const cols = MAP_COLS, rows = MAP_ROWS;
        const elev = [];
        for (let row = 0; row < rows; row++) {
            elev[row] = [];
            for (let col = 0; col < cols; col++) elev[row][col] = Math.random();
        }
        for (let pass = 0; pass < 4; pass++) {
            const next = [];
            for (let row = 0; row < rows; row++) {
                next[row] = [];
                for (let col = 0; col < cols; col++) {
                    let sum = 0, n = 0;
                    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                        const rr = row + dr, cc = col + dc;
                        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) { sum += elev[rr][cc]; n++; }
                    }
                    next[row][col] = sum / n;
                }
            }
            for (let row = 0; row < rows; row++) elev[row] = next[row];
        }

        // percentile thresholds
        const flat = [];
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) flat.push(elev[row][col]);
        flat.sort((a, b) => a - b);
        const pct = p => flat[Math.floor(p * (flat.length - 1))];
        const wLo = pct(0.28), hHi = pct(0.80), mHi = pct(0.93);

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const q = col - Math.floor(row / 2);
                const r = row;
                const e = elev[row][col];
                let terrain;
                if (e < wLo) terrain = TERRAIN.WATER;
                else if (e < hHi) terrain = (Math.random() < 0.28) ? TERRAIN.FOREST : TERRAIN.PLAINS;
                else if (e < mHi) terrain = TERRAIN.HILLS;
                else terrain = TERRAIN.MOUNTAIN;

                let deposit = null;
                if (terrain === TERRAIN.HILLS && Math.random() < 0.22) deposit = DEPOSIT.MINERALS;
                else if ((terrain === TERRAIN.FOREST || terrain === TERRAIN.PLAINS) && Math.random() < 0.14) deposit = DEPOSIT.BIOMASS;
                else if (terrain === TERRAIN.HILLS && Math.random() < 0.06) deposit = DEPOSIT.RELIC;

                s.hexes.set(Hex.key(q, r), {
                    q, r, col, row, elevation: e, terrain,
                    corruption: 0, deposit, structure: null, breederHp: 0,
                });
            }
        }
    }

    placeLanderAndCaptain() {
        const s = this.state;
        const centerRow = Math.floor(MAP_ROWS / 2);
        const centerCol = Math.floor(MAP_COLS / 2);
        // spiral out from center to first passable hex
        let best = null;
        for (let radius = 0; radius < 12 && !best; radius++) {
            for (let dr = -radius; dr <= radius && !best; dr++) {
                for (let dc = -radius; dc <= radius && !best; dc++) {
                    const row = centerRow + dr, col = centerCol + dc;
                    const q = col - Math.floor(row / 2), r = row;
                    if (s.isLand(q, r)) best = { q, r };
                }
            }
        }
        s.lander = { q: best.q, r: best.r, hp: RECLAIMER.landerHp, maxHp: RECLAIMER.landerHp };
        const c = RECLAIMER.captain;
        const spot = this.firstEmptyAround(best.q, best.r) || best;
        s.units.push({
            id: s.nextId++, kind: 'captain', q: spot.q, r: spot.r,
            hp: c.hp, maxHp: c.hp, mp: c.mp, maxMp: c.mp,
            weapon: { range: c.weaponRange, dmg: c.weaponDmg }, acted: false,
        });
    }

    // Corruption gradient outward from the Lander, plus far-flung breeder nodes.
    seedCorruption() {
        const s = this.state, L = s.lander;
        const lh = new Hex(L.q, L.r);
        // Most of the world starts as clean wilderness; a thin corruption FRONT hugs the
        // pocket so cleansing matters from turn 1, and the nests below add local gradients.
        for (const h of s.hexes.values()) {
            if (!s.isLand(h.q, h.r)) continue;
            const d = lh.distance(new Hex(h.q, h.r));
            h.corruption = (d >= 2 && d <= 4) ? 1 : 0;
        }
        // place breeder nodes far from the Lander, spread apart
        const candidates = [...s.hexes.values()].filter(h =>
            s.isLand(h.q, h.r) && lh.distance(new Hex(h.q, h.r)) >= 8);
        Rando.shuffle(candidates);
        const nodes = [];
        for (const h of candidates) {
            if (nodes.length >= RECLAIMER.breederNodes) break;
            if (nodes.every(n => new Hex(n.q, n.r).distance(new Hex(h.q, h.r)) >= 5)) {
                h.corruption = RECLAIMER.corruptionMax;
                h.breederHp = RECLAIMER.breederHp;
                nodes.push(h);
                for (const nb of this.landNeighbors(h.q, h.r)) nb.corruption = Math.max(nb.corruption, 2);
            }
        }
    }

    // ============================================================== geometry
    landNeighbors(q, r) {
        const out = [];
        for (const n of new Hex(q, r).neighbors()) {
            const h = this.state.hex(n.q, n.r);
            if (h && this.state.isLand(n.q, n.r)) out.push(h);
        }
        return out;
    }

    firstEmptyAround(q, r) {
        for (const n of new Hex(q, r).neighbors()) {
            if (this.state.isLand(n.q, n.r) && !this.state.isBlocked(n.q, n.r) && !this.state.isLander(n.q, n.r))
                return { q: n.q, r: n.r };
        }
        return null;
    }

    // ============================================================ control/fog
    // Control radiates from the Lander and Beacons, but only along un-corrupted ground: a
    // bounded BFS out from each source, `radius` steps, refusing to cross corrupted hexes.
    // So the frontier follows what you've actually cleansed — the blight walls control off.
    computeControl() {
        const s = this.state;
        const clean = (q, r) => s.isLand(q, r) && s.hex(q, r).corruption === 0;
        const sources = [{ q: s.lander.q, r: s.lander.r, radius: RECLAIMER.landerInfluence }];
        for (const h of s.hexes.values()) {
            if (h.structure && h.structure.type === 'beacon') sources.push({ q: h.q, r: h.r, radius: STRUCTURES.beacon.radius });
        }
        const controlled = new Set();
        for (const src of sources) {
            const seen = new Set([Hex.key(src.q, src.r)]);
            const queue = [{ q: src.q, r: src.r, d: 0 }];
            controlled.add(Hex.key(src.q, src.r)); // the source hex itself is always yours
            while (queue.length) {
                const cur = queue.shift();
                if (cur.d >= src.radius) continue;
                for (const n of new Hex(cur.q, cur.r).neighbors()) {
                    const k = n.key();
                    if (seen.has(k) || !clean(n.q, n.r)) continue; // only extend through clean hexes
                    seen.add(k);
                    controlled.add(k);
                    queue.push({ q: n.q, r: n.r, d: cur.d + 1 });
                }
            }
        }
        s.controlled = controlled;
    }

    reveal() {
        const s = this.state, R = RECLAIMER.sightRadius;
        const mark = (q, r) => {
            for (const h of new Hex(q, r).inRange(R)) if (s.inBounds(h.q, h.r)) s.revealed.add(h.key());
        };
        mark(s.lander.q, s.lander.r);
        for (const u of s.units) mark(u.q, u.r);
        for (const k of s.controlled) s.revealed.add(k); // your territory is always visible
    }

    // ============================================================== economy
    production() {
        const s = this.state;
        let materials = RECLAIMER.baseMaterials, rations = RECLAIMER.baseRations;
        for (const h of s.hexes.values()) {
            if (!h.structure || !s.isControlled(h.q, h.r)) continue;
            const def = STRUCTURES[h.structure.type];
            if (def.template === 'producer') { if (def.res === 'materials') materials += def.yield; else rations += def.yield; }
        }
        rations += Math.floor(s.controlledCount() / RECLAIMER.areaRationsPer);
        return { materials, rations };
    }

    // ============================================================ player verbs
    // Movement cost for a colony unit entering `hex` (Infinity if it can't).
    moveCost(hex) {
        const s = this.state;
        if (!hex || MOVEMENT_COST[hex.terrain] === Infinity) return Infinity;
        if (hex.structure && hex.structure.type === 'wall') return Infinity;
        if (s.isLander(hex.q, hex.r)) return Infinity;
        if (s.alienAt(hex.q, hex.r) || s.colonyUnitAt(hex.q, hex.r)) return Infinity;
        return MOVEMENT_COST[hex.terrain] + hex.corruption;
    }

    reachable(unit) {
        const s = this.state;
        const costs = bfsHexes(unit, s.hexes, h => this.moveCost(h), unit.mp);
        costs.delete(Hex.key(unit.q, unit.r));
        return costs;
    }

    // One action per turn, independent of movement — you can move your full MP and still
    // cleanse/build/fire/gather once. (Movement still costs MP; acting does not.)
    canAct(unit) { return !unit.acted; }

    // Fire: aliens or live nodes within weapon range. Returns Map key -> {kind, ref}.
    fireTargets(unit) {
        const out = new Map();
        if (!unit.weapon || !this.canAct(unit)) return out;
        const uh = new Hex(unit.q, unit.r);
        for (const a of this.state.aliens) {
            if (uh.distance(new Hex(a.q, a.r)) <= unit.weapon.range) out.set(Hex.key(a.q, a.r), { kind: 'alien', ref: a });
        }
        for (const h of this.state.hexes.values()) {
            if (h.breederHp > 0 && uh.distance(new Hex(h.q, h.r)) <= unit.weapon.range) out.set(Hex.key(h.q, h.r), { kind: 'node', ref: h });
        }
        return out;
    }

    cleanseTargets(unit) {
        const s = this.state, out = new Set();
        if (!this.canAct(unit)) return out;
        for (const nh of new Hex(unit.q, unit.r).inRange(1)) {
            const h = s.hex(nh.q, nh.r);
            if (!h || h.corruption === 0 || s.isNode(h)) continue;
            out.add(nh.key()); // cleansing is free — throttled by the unit's one action, not materials
        }
        return out;
    }

    // Ground a unit could build on at all: its own controlled, clean, empty, adjacent hexes.
    // (Ignores a specific structure's cost/deposit needs — that's buildTargets' job.)
    buildableGround(unit) {
        const s = this.state, out = new Set();
        if (!this.canAct(unit)) return out;
        for (const nh of new Hex(unit.q, unit.r).inRange(1)) {
            const h = s.hex(nh.q, nh.r);
            if (!h || !s.isLand(h.q, h.r)) continue;
            if (h.corruption !== 0 || h.structure || s.isLander(h.q, h.r)) continue;
            if (s.colonyUnitAt(h.q, h.r) || s.alienAt(h.q, h.r)) continue;
            if (!s.isControlled(h.q, h.r)) continue;
            out.add(nh.key());
        }
        return out;
    }

    buildTargets(unit, structKey) {
        const s = this.state, out = new Set();
        const def = STRUCTURES[structKey];
        if (s.materials < def.cost) return out;
        for (const k of this.buildableGround(unit)) {
            if (def.needs && s.get(k).deposit !== def.needs) continue;
            out.add(k);
        }
        return out;
    }

    gatherTargets(unit) {
        const s = this.state, out = new Map();
        if (!this.canAct(unit)) return out;
        for (const nh of new Hex(unit.q, unit.r).inRange(1)) {
            const h = s.hex(nh.q, nh.r);
            if (!h) continue;
            if (h.deposit === DEPOSIT.RELIC) out.set(nh.key(), { kind: 'relic', ref: h });
            else if (h.structure && h.structure.hp < STRUCTURES[h.structure.type].hp && s.materials >= 2)
                out.set(nh.key(), { kind: 'repair', ref: h });
        }
        return out;
    }

    // --- verb executions (each spends the unit's remaining turn) ---
    performMove(unit, targetKey, costs) {
        const cost = costs.get(targetKey);
        if (cost === undefined) return false;
        const h = Hex.fromKey(targetKey);
        unit.q = h.q; unit.r = h.r; unit.mp -= cost;
        this.reveal();
        return true;
    }

    performFire(unit, targetKey) {
        const t = this.fireTargets(unit).get(targetKey);
        if (!t) return null;
        unit.acted = true;
        if (t.kind === 'alien') {
            t.ref.hp -= unit.weapon.dmg;
            if (t.ref.hp <= 0) { this.removeAlien(t.ref); this.state.log = `${unit.kind} dropped a ${t.ref.kind}.`; }
            else this.state.log = `${unit.kind} hit a ${t.ref.kind}.`;
        } else {
            t.ref.breederHp -= unit.weapon.dmg;
            if (t.ref.breederHp <= 0) { t.ref.breederHp = 0; this.state.log = 'Breeder destroyed — the node can be cleansed now.'; }
            else this.state.log = `Breeder wounded (${t.ref.breederHp} hp).`;
        }
        return { from: { q: unit.q, r: unit.r }, to: Hex.fromKey(targetKey) };
    }

    performCleanse(unit, targetKey) {
        if (!this.cleanseTargets(unit).has(targetKey)) return false;
        const h = this.state.get(targetKey);
        h.corruption -= 1;
        unit.acted = true;
        this.computeControl(); this.reveal();
        this.state.log = h.corruption === 0 ? 'Ground cleansed.' : 'Corruption pushed back.';
        return true;
    }

    performBuild(unit, structKey, targetKey) {
        if (!this.buildTargets(unit, structKey).has(targetKey)) return false;
        const def = STRUCTURES[structKey], h = this.state.get(targetKey);
        this.state.materials -= def.cost;
        h.structure = { type: structKey, hp: def.hp };
        unit.acted = true;
        this.computeControl(); this.reveal();
        this.state.log = `${def.name} built.`;
        return true;
    }

    performGather(unit, targetKey) {
        const t = this.gatherTargets(unit).get(targetKey);
        if (!t) return false;
        unit.acted = true;
        if (t.kind === 'relic') {
            t.ref.deposit = null;
            this.state.relics += 1;
            this.upgradeCaptain();
            this.state.log = 'Relic recovered — blaster upgraded!';
        } else {
            this.state.materials -= 2;
            t.ref.structure.hp = Math.min(STRUCTURES[t.ref.structure.type].hp, t.ref.structure.hp + 4);
            this.state.log = 'Structure repaired.';
        }
        return true;
    }

    upgradeCaptain() {
        const cap = this.state.captain();
        if (!cap) return;
        if (this.state.relics % 2 === 1) cap.weapon.range += 1; else cap.weapon.dmg += 1;
    }

    // Lander actions (no unit needed).
    canAwaken() { return this.state.frozen > 0 && this.state.rations >= RECLAIMER.awakenCost; }
    performAwaken() {
        if (!this.canAwaken()) return false;
        const spot = this.firstEmptyAround(this.state.lander.q, this.state.lander.r);
        if (!spot) { this.state.log = 'No clear ground by the Lander to wake anyone.'; return false; }
        const c = RECLAIMER.colonist;
        this.state.rations -= RECLAIMER.awakenCost;
        this.state.frozen -= 1;
        this.state.units.push({
            id: this.state.nextId++, kind: 'colonist', q: spot.q, r: spot.r,
            hp: c.hp, maxHp: c.hp, mp: 0, maxMp: c.mp,
            weapon: { range: c.weaponRange, dmg: c.weaponDmg }, acted: true, // groggy — acts next turn
        });
        this.reveal();
        this.state.log = 'A colonist wakes. The swarm can feel it.';
        return true;
    }

    removeAlien(a) { this.state.aliens = this.state.aliens.filter(x => x !== a); }
    removeUnit(u) { this.state.units = this.state.units.filter(x => x !== u); }

    // =========================================================== enemy phase
    // Driven one atomic step at a time by GameUI so consequences are watchable.
    beginEnemyPhase() {
        this.runEconomy();
        this.state.phase = 'enemy';
        this.state.enemy = { stage: 'defense', list: null, current: null, hops: 0 };
    }

    runEconomy() {
        const s = this.state, prod = this.production();
        s.materials += prod.materials;
        s.rations += prod.rations - s.upkeep();
        if (s.rations < 0) {
            s.rations = 0;
            for (const u of [...s.units]) {
                if (u.kind !== 'colonist') continue;
                u.hp -= 1;
                if (u.hp <= 0) { this.removeUnit(u); s.log = 'A colonist starved.'; }
            }
        }
    }

    enemyStep() {
        const s = this.state, E = s.enemy;
        if (E.stage === 'defense') {
            const flashes = this.turretsFire();
            E.stage = 'corruption';
            return { type: 'defense', flashes };
        }
        if (E.stage === 'corruption') {
            this.applyCorruption();
            E.stage = 'spawn';
            return { type: 'corruption' };
        }
        if (E.stage === 'spawn') {
            const spawned = this.spawnAliens();
            E.stage = 'move';
            E.list = [...s.aliens];
            return { type: 'spawn', spawned };
        }
        if (E.stage === 'move') {
            // find a living current alien
            while (!E.current || E.current.hp <= 0 || !s.aliens.includes(E.current)) {
                if (!E.list.length) { E.stage = 'done'; return { type: 'done' }; }
                E.current = E.list.shift();
                E.hops = E.current ? E.current.speed : 0;
            }
            const result = this.alienHop(E.current);
            E.hops -= 1;
            if (E.hops <= 0 || E.current.hp <= 0) E.current = null;
            if (s.gameOver) E.stage = 'done';
            return { type: 'hop', ...result };
        }
        return { type: 'done' };
    }

    finishEnemyPhase() {
        const s = this.state;
        s.enemy = null;
        if (!s.gameOver) {
            s.turn += 1;
            s.phase = 'player';
            for (const u of s.units) { u.mp = u.maxMp; u.acted = false; }
            this.maybeRespawnCaptain();
            this.computeControl();
            this.reveal();
            this.checkWinLose();
        }
    }

    turretsFire() {
        const s = this.state, flashes = [];
        for (const h of s.hexes.values()) {
            if (!h.structure || h.structure.type !== 'turret') continue;
            const def = STRUCTURES.turret;
            const th = new Hex(h.q, h.r);
            let target = null, best = Infinity;
            for (const a of s.aliens) {
                const d = th.distance(new Hex(a.q, a.r));
                if (d <= def.range && d < best) { best = d; target = a; }
            }
            if (target) {
                target.hp -= def.dmg;
                flashes.push({ from: { q: h.q, r: h.r }, to: { q: target.q, r: target.r } });
                if (target.hp <= 0) this.removeAlien(target);
            }
        }
        return flashes;
    }

    applyCorruption() {
        const s = this.state, R = RECLAIMER;
        const p = clamp(R.spreadBase + R.spreadPerThreat * s.threat(), R.spreadBase, R.spreadMax);
        // Spread from every corrupted hex. Ambient blight tops out at level 2 (a territorial
        // and economic pressure); only a live NODE can scar an adjacent hex to level 3. Nests
        // themselves are the fixed seeded set — they don't multiply, so "destroy every Breeder"
        // stays a bounded, targetable goal. Escalation comes from the threat curve, not new nests.
        const sources = [...s.hexes.values()].filter(h => h.corruption > 0);
        for (const src of sources) {
            if (!Rando.bool(p)) continue;
            const cap = src.breederHp > 0 ? R.corruptionMax : R.corruptionMax - 1;
            const nbrs = this.landNeighbors(src.q, src.r).filter(h => h.corruption < cap);
            const t = Rando.choice(nbrs);
            if (t) t.corruption += 1;
        }
        // purifiers push back (never below a live node's floor)
        for (const h of s.hexes.values()) {
            if (!h.structure || h.structure.type !== 'purifier') continue;
            for (const nh of new Hex(h.q, h.r).inRange(STRUCTURES.purifier.radius)) {
                const t = s.hex(nh.q, nh.r);
                if (t && t.corruption > 0 && t.breederHp <= 0) t.corruption -= 1;
            }
        }
    }

    spawnAliens() {
        const s = this.state, R = RECLAIMER, spawned = [];
        const p = clamp(s.threat() / R.spawnDivisor, R.spawnMin, R.spawnMax);
        const hpBonus = Math.floor(s.threat() / R.alienHpPerThreat);
        for (const h of s.hexes.values()) {
            if (h.breederHp <= 0) continue;
            if (s.aliens.length >= R.maxAliens) break;
            if (!Rando.bool(p)) continue;
            const spot = Rando.choice(this.landNeighbors(h.q, h.r).filter(n =>
                !s.isBlocked(n.q, n.r) && !s.isLander(n.q, n.r)));
            if (!spot) continue;
            const type = Rando.weighted([
                { item: 'swarmling', weight: 3 },
                { item: 'mauler', weight: s.threat() > 15 ? 2 : 0.5 },
                { item: 'spitter', weight: s.threat() > 10 ? 1.2 : 0.3 },
            ]);
            const def = RECLAIMER.aliens[type];
            const speedRoll = Rando.int(1, 6);
            const baseSpeed = speedRoll <= 3 ? 1 : (speedRoll <= 5 ? 2 : 3);
            // ~half the swarm are ranged skirmishers: attack from 3 hexes, but move at half pace.
            const ranged = Rando.bool(0.5);
            const a = {
                id: s.nextId++, kind: type, faction: 'alien', q: spot.q, r: spot.r,
                hp: def.hp + hpBonus, maxHp: def.hp + hpBonus, dmg: def.dmg,
                attackRange: ranged ? 3 : 1,
                speed: ranged ? Math.max(1, Math.floor(baseSpeed / 2)) : baseSpeed,
            };
            s.aliens.push(a);
            spawned.push(a);
        }
        return spawned;
    }

    // Candidate assets this alien wants to reach, by its targeting preference.
    nearestTarget(a) {
        const s = this.state, ah = new Hex(a.q, a.r);
        const assets = [];
        const wantsUnits = RECLAIMER.aliens[a.kind].targets === 'any';
        if (wantsUnits) for (const u of s.units) assets.push({ q: u.q, r: u.r, kind: 'unit', ref: u });
        for (const h of s.hexes.values()) if (h.structure) assets.push({ q: h.q, r: h.r, kind: 'structure', ref: h });
        assets.push({ q: s.lander.q, r: s.lander.r, kind: 'lander', ref: s.lander });
        if (!wantsUnits && !assets.length) for (const u of s.units) assets.push({ q: u.q, r: u.r, kind: 'unit', ref: u });
        let best = null, bestD = Infinity;
        for (const t of assets) {
            const d = ah.distance(new Hex(t.q, t.r));
            if (d < bestD) { bestD = d; best = t; }
        }
        return best ? { ...best, dist: bestD } : null;
    }

    // One hex of movement (or an attack / spit if already in reach).
    alienHop(a) {
        const s = this.state;
        const target = this.nearestTarget(a);
        if (!target) return { alien: a, action: 'idle' };

        if (a.kind === 'spitter' && target.dist <= RECLAIMER.aliens.spitter.spitRange) {
            const nbrs = this.landNeighbors(target.q, target.r).filter(h => h.corruption < RECLAIMER.corruptionMax - 1);
            const t = Rando.choice(nbrs);
            if (t) t.corruption += 1; // spitters re-seed ambient blight, but never a new nest
            return { alien: a, action: 'spit', at: { q: target.q, r: target.r } };
        }

        if (target.dist <= a.attackRange) return this.alienAttack(a, target);

        const goalKey = Hex.key(target.q, target.r);
        const passable = (q, r) => {
            if (!s.isLand(q, r)) return false;
            if (Hex.key(q, r) === goalKey) return true;
            const h = s.hex(q, r);
            if (h.structure && h.structure.type === 'wall') return false;
            if (s.isLander(q, r) || s.colonyUnitAt(q, r) || s.alienAt(q, r)) return false;
            return true;
        };
        const path = findPath({ q: a.q, r: a.r }, { q: target.q, r: target.r }, passable, () => 1, 999);
        if (!path || path.length < 2) return { alien: a, action: 'idle' };
        const next = path[1];
        if (Hex.key(next.q, next.r) === goalKey) return this.alienAttack(a, target); // adjacent after all
        const from = { q: a.q, r: a.r };
        a.q = next.q; a.r = next.r;
        if (s.hex(a.q, a.r).corruption > 0) a.hp = Math.min(a.maxHp, a.hp + 1); // corruption shelters them
        return { alien: a, action: 'move', from, to: { q: a.q, r: a.r } };
    }

    alienAttack(a, target) {
        const s = this.state;
        const from = { q: a.q, r: a.r };
        if (target.kind === 'unit') {
            target.ref.hp -= a.dmg;
            if (target.ref.hp <= 0) {
                const killed = target.ref;
                this.removeUnit(killed);
                if (killed.kind === 'captain') s.captainRespawnAt = s.turn + RECLAIMER.respawnDelay;
                s.log = `A ${a.kind} killed your ${killed.kind}!`;
                return { alien: a, action: 'kill', from, at: { q: killed.q, r: killed.r }, died: true };
            }
            return { alien: a, action: 'attack', from, at: { q: target.q, r: target.r } };
        }
        if (target.kind === 'structure') {
            target.ref.structure.hp -= a.dmg;
            if (target.ref.structure.hp <= 0) { target.ref.structure = null; this.computeControl(); s.log = `A ${a.kind} wrecked a structure!`; }
            return { alien: a, action: 'attack', from, at: { q: target.q, r: target.r } };
        }
        // lander
        s.lander.hp -= a.dmg;
        if (s.lander.hp <= 0) { s.lander.hp = 0; s.gameOver = 'lose'; s.log = 'The Lander has fallen. The colony is lost.'; }
        return { alien: a, action: 'attack', from, at: { q: target.q, r: target.r } };
    }

    maybeRespawnCaptain() {
        const s = this.state;
        if (s.captain() || s.captainRespawnAt === null) return;
        if (s.turn < s.captainRespawnAt) return;
        if (s.rations < RECLAIMER.respawnCost) return;
        const spot = this.firstEmptyAround(s.lander.q, s.lander.r);
        if (!spot) return;
        const c = RECLAIMER.captain;
        s.rations -= RECLAIMER.respawnCost;
        s.captainRespawnAt = null;
        s.units.push({
            id: s.nextId++, kind: 'captain', q: spot.q, r: spot.r,
            hp: c.hp, maxHp: c.hp, mp: c.mp, maxMp: c.mp,
            weapon: { range: c.weaponRange, dmg: c.weaponDmg }, acted: false,
        });
        s.log = 'The captain is revived at the Lander.';
    }

    checkWinLose() {
        const s = this.state;
        if (s.gameOver) return;
        if (s.breedersRemaining() === 0 && s.frozen === 0) { s.gameOver = 'win'; s.log = 'The planet is reclaimed. The colony lives.'; }
        else if (s.units.length === 0 && s.frozen === 0) { s.gameOver = 'lose'; s.log = 'No colonists left to carry on.'; }
    }
}
