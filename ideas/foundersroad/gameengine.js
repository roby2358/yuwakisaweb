// gameengine.js — GameEngine
//
// All game rules and world generation, operating on a GameState. Deliberately
// DOM-free and render-free: methods mutate state and *return outcomes*; the caller
// (GameUI today, a network handler tomorrow) decides what to redraw or broadcast.
// This is the half that would run server-side unchanged.
//
// Server-readiness notes:
//  - Generation and AI route all randomness through the seeded Rando, so a game is
//    reproducible from state.seed alone.
//  - Every action (moveWorker, build, shooBeast, ...) re-derives legality from the
//    engine's own rules rather than trusting caller-supplied costs — the "never
//    trust the client" rule, baked in now so a future command/network layer
//    doesn't have to re-audit every action.
const GameEngine = (function () {
    const {
        TERRAIN, MOVEMENT_COST, WORKER_MP, MAP_COLS, MAP_ROWS,
        START_RESOURCES, START_WORKERS, BUILDINGS, ROAD, TOWER_RADIUS,
        MONUMENT_STAGES, MONUMENT_MP, RECRUIT, BEAST
    } = GameArtifacts;

    class GameEngine {
        constructor(state) {
            this.state = state;
        }

        // ---- Terrain passability (single source of truth) ----
        // Improvements are baked in here so every consumer (worker BFS, pathing,
        // placement) sees the same board: a road or building hex always costs 1.
        // Beasts ignore improvements and use rawMoveCost — hooves don't care about roads.
        rawMoveCost(hex) {
            return MOVEMENT_COST[hex.terrain] ?? Infinity;
        }

        moveCost(hex) {
            if (hex.road || this.buildingAt(hex.q, hex.r)) return 1;
            return this.rawMoveCost(hex);
        }

        isPassable(hex) {
            return this.rawMoveCost(hex) !== Infinity;
        }

        // All non-edge passable hexes, as a fresh array the caller may sort/filter.
        passableHexes() {
            const out = [];
            for (const [, hex] of this.state.hexes) {
                if (hex.isEdge) continue;
                if (!this.isPassable(hex)) continue;
                out.push(hex);
            }
            return out;
        }

        // ---- Occupancy lookups ----
        buildingAt(q, r) {
            return this.state.buildings.find(b => b.q === q && b.r === r) ?? null;
        }

        workerAt(q, r) {
            return this.state.workers.find(w => w.q === q && w.r === r) ?? null;
        }

        workerById(id) {
            return this.state.workers.find(w => w.id === id) ?? null;
        }

        beastAt(q, r) {
            return this.state.beasts.find(b => b.q === q && b.r === r) ?? null;
        }

        isMonumentHex(q, r) {
            const m = this.state.monument;
            return m.q === q && m.r === r;
        }

        // True when an unbroken chain of road/building hexes links the Monument to
        // EVERY Hall. Each Hall founded is a commitment the network must absorb;
        // Monument stages may only be built once the whole realm is one supply line.
        monumentConnected() {
            const s = this.state;
            const halls = s.buildings.filter(b => b.type === 'hall');
            if (halls.length === 0) return false;
            const reached = new Set();
            const visited = new Set([Hex.key(s.monument.q, s.monument.r)]);
            const frontier = [new Hex(s.monument.q, s.monument.r)];
            while (frontier.length > 0) {
                for (const n of frontier.pop().neighbors()) {
                    const key = n.key();
                    if (visited.has(key)) continue;
                    const hex = s.hexes.get(key);
                    if (!hex) continue;
                    const building = this.buildingAt(n.q, n.r);
                    if (!hex.road && !building) continue;
                    if (building && building.type === 'hall') reached.add(building.id);
                    visited.add(key);
                    frontier.push(n);
                }
            }
            return reached.size === halls.length;
        }

        // Every hex key within TOWER_RADIUS of a watchtower — beasts may not enter.
        protectedKeys() {
            const keys = new Set();
            for (const b of this.state.buildings) {
                if (b.type !== 'tower') continue;
                for (const h of new Hex(b.q, b.r).inRange(TOWER_RADIUS)) keys.add(h.key());
            }
            return keys;
        }

        // ---- New game / world generation ----
        // Regenerates (up to 20 tries) until a path exists from Hall to Monument site.
        // A seed may be supplied for reproducibility; otherwise one is drawn once and
        // stored, so the resulting game can always be reproduced from state.seed.
        newGame(seed) {
            const s = this.state;
            s.seed = (seed === undefined || seed === null)
                ? Math.floor(Math.random() * 0x100000000)
                : (seed >>> 0);
            Rando.seed(s.seed);

            s.buildings = [];
            s.workers = [];
            s.beasts = [];
            s.nextId = 1;

            let hall, monumentSite;
            let attempts = 0;
            do {
                s.hexes = this.generateRectGrid();
                this.assignTerrain();
                ({ hall, monumentSite } = this.pickHallAndMonumentSites());
                attempts++;
            } while (!this.hasPath(hall, monumentSite) && attempts < 20);

            s.monument = { q: monumentSite.q, r: monumentSite.r, stage: 0 };
            s.resources = { ...START_RESOURCES };
            this.foundHall(hall);
            this.makePalettes();
            this.spawnInitialBeasts();
            s.turn = 1;
            s.phase = 'player';
            s.gameWon = false;
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
                        terrain: null, road: false
                    });
                }
            }
            return hexes;
        }

        // Base terrain by elevation percentile, then forests/gold on plains and quarries
        // on hills scattered in; edges forced to water.
        assignTerrain() {
            const inner = [];
            for (const [, hex] of this.state.hexes) {
                if (hex.isEdge) { hex.terrain = TERRAIN.WATER; continue; }
                inner.push(hex);
            }
            inner.sort((a, b) => a.elevation - b.elevation);
            const n = inner.length;

            // Base terrain by elevation percentile
            for (let i = 0; i < n; i++) {
                const pct = i / n;
                if (pct < 0.25) inner[i].terrain = TERRAIN.WATER;
                else if (pct < 0.85) inner[i].terrain = TERRAIN.PLAINS;
                else if (pct < 0.95) inner[i].terrain = TERRAIN.HILLS;
                else inner[i].terrain = TERRAIN.MOUNTAIN;
            }

            // Scatter forests and gold veins among plains
            const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS);
            Rando.shuffle(plains);
            const forestCount = Math.round(n * 0.10);
            const goldCount = Math.max(3, Math.round(n * 0.01));
            let idx = 0;
            for (let i = 0; i < forestCount && idx < plains.length; i++, idx++)
                plains[idx].terrain = TERRAIN.FOREST;
            for (let i = 0; i < goldCount && idx < plains.length; i++, idx++)
                plains[idx].terrain = TERRAIN.GOLD;

            // Scatter quarries among hills (~2% of total)
            const hills = inner.filter(h => h.terrain === TERRAIN.HILLS);
            Rando.shuffle(hills);
            const quarryCount = Math.max(2, Math.round(n * 0.02));
            for (let i = 0; i < quarryCount && i < hills.length; i++)
                hills[i].terrain = TERRAIN.QUARRY;
        }

        // Hall on the far-left passable slice (plains preferred — it must host a Hall),
        // Monument site on the far-right slice: the whole map lies between home and goal.
        pickHallAndMonumentSites() {
            const passable = this.passableHexes();
            passable.sort((a, b) => a.col - b.col);

            const sliceLen = Math.max(5, Math.floor(passable.length * 0.03));
            const leftSlice = passable.slice(0, sliceLen);
            const leftPlains = leftSlice.filter(h => h.terrain === TERRAIN.PLAINS);
            const hall = Rando.choice(leftPlains.length > 0 ? leftPlains : leftSlice);

            const rightSlice = passable.slice(-sliceLen);
            const monumentSite = Rando.choice(rightSlice.filter(h => h !== hall));
            return { hall, monumentSite };
        }

        // The founding Hall plus the starting crew on the nearest walkable hexes.
        foundHall(hallHex) {
            const s = this.state;
            s.buildings.push({ id: s.nextId++, type: 'hall', q: hallHex.q, r: hallHex.r });

            // Cheapest-first flood out from the Hall gives tight, unstacked start spots.
            const costs = bfsHexes(hallHex, s.hexes, hex => this.moveCost(hex), Infinity);
            const spots = [...costs.entries()]
                .sort((a, b) => a[1] - b[1])
                .map(([key]) => Hex.fromKey(key))
                .slice(0, START_WORKERS);
            for (const spot of spots)
                s.workers.push({ id: s.nextId++, q: spot.q, r: spot.r, mp: WORKER_MP });
        }

        makePalettes() {
            const s = this.state;
            const toHexes = scheme => scheme.map(([r, g, b]) => ColorTheory.rgbToHex(r, g, b));
            s.workerPalette = toHexes(ColorTheory.randomScheme(() => Rando.random()));
            s.beastPalette = toHexes(ColorTheory.randomScheme(() => Rando.random()));
        }

        hasPath(from, to) {
            if (!from || !to) return false;
            const costs = bfsHexes(from, this.state.hexes, hex => this.moveCost(hex), Infinity);
            return costs.has(Hex.key(to.q, to.r));
        }

        // ---- Beast ecology ----
        rollBeastSpeed() {
            return Rando.int(1, 6) >= BEAST.FAST_ROLL ? 2 : 1;
        }

        // 2d6 beasts scattered at start, well away from the founding site.
        spawnInitialBeasts() {
            const s = this.state;
            const count = Rando.int(1, 6) + Rando.int(1, 6);
            const candidates = this.beastSpawnCandidates();
            Rando.shuffle(candidates);
            for (let i = 0; i < count && i < candidates.length; i++) {
                const h = candidates[i];
                s.beasts.push({ q: h.q, r: h.r, speed: this.rollBeastSpeed() });
            }
        }

        // Passable, unoccupied, untowered hexes at least SPAWN_MIN_DIST from every
        // worker and building — beasts appear in the wilds, never on your doorstep.
        beastSpawnCandidates() {
            const s = this.state;
            const guarded = this.protectedKeys();
            const anchors = [...s.workers, ...s.buildings, s.monument];
            return this.passableHexes().filter(hex => {
                const key = Hex.key(hex.q, hex.r);
                if (guarded.has(key)) return false;
                if (this.workerAt(hex.q, hex.r) || this.beastAt(hex.q, hex.r)) return false;
                if (this.buildingAt(hex.q, hex.r)) return false;
                const h = new Hex(hex.q, hex.r);
                return anchors.every(a => h.distance(a) >= BEAST.SPAWN_MIN_DIST);
            });
        }

        // Escalation tied to progress: every building you own raises the spawn odds.
        maybeSpawnBeast() {
            const s = this.state;
            if (s.beasts.length >= BEAST.MAX) return;
            const p = Math.min(BEAST.SPAWN_CAP,
                BEAST.SPAWN_BASE + BEAST.SPAWN_PER_BUILDING * s.buildings.length);
            if (!Rando.bool(p)) return;
            const spot = Rando.choice(this.beastSpawnCandidates());
            if (spot) s.beasts.push({ q: spot.q, r: spot.r, speed: this.rollBeastSpeed() });
        }

        // ---- Legal-move computation (the rules the UI highlights and the engine enforces) ----

        // Cost-limited flood fill bounded by the worker's remaining MP; beast and
        // fellow-worker hexes are walls. Roads/buildings cost 1 via moveCost.
        computeReachable(worker) {
            const s = this.state;
            if (worker.mp <= 0) return new Map();
            const blocked = new Set();
            for (const b of s.beasts) blocked.add(Hex.key(b.q, b.r));
            for (const w of s.workers) if (w.id !== worker.id) blocked.add(Hex.key(w.q, w.r));
            const costs = bfsHexes(worker, s.hexes, hex => {
                if (blocked.has(Hex.key(hex.q, hex.r))) return Infinity;
                return this.moveCost(hex);
            }, worker.mp);
            costs.delete(Hex.key(worker.q, worker.r));
            return costs;
        }

        // L3 attackable set, filled in: adjacent beasts a worker with enough MP can shoo.
        computeAttackable(worker) {
            const keys = new Set();
            if (worker.mp < BEAST.SHOO_MP) return keys;
            for (const n of new Hex(worker.q, worker.r).neighbors()) {
                if (this.beastAt(n.q, n.r)) keys.add(n.key());
            }
            return keys;
        }

        // L2.1 extension point: an interactive location at this hex, or null.
        locationAt(/* p */) {
            return null;
        }

        // ---- Stockpile helpers ----
        canAfford(cost) {
            const res = this.state.resources;
            return Object.entries(cost).every(([k, v]) => res[k] >= v);
        }

        pay(cost) {
            const res = this.state.resources;
            for (const [k, v] of Object.entries(cost)) res[k] -= v;
        }

        recruitCost() {
            return { wood: RECRUIT.baseWood + RECRUIT.woodPerWorker * this.state.workers.length };
        }

        // Summed per-turn production across all buildings, for the HUD income readout.
        incomePerTurn() {
            const income = { wood: 0, stone: 0, gold: 0 };
            for (const b of this.state.buildings) {
                const produces = BUILDINGS[b.type].produces;
                if (!produces) continue;
                for (const [k, v] of Object.entries(produces)) income[k] += v;
            }
            return income;
        }

        // ---- Build options (what the UI's build panel renders — concrete descriptors) ----
        // Everything a worker could construct on its current hex, affordable or not;
        // `enabled` carries the verdict so the panel can show grayed-out costs.
        buildOptions(worker) {
            const s = this.state;
            const hex = s.hexes.get(Hex.key(worker.q, worker.r));
            const options = [];
            const onMonument = this.isMonumentHex(worker.q, worker.r);
            const occupied = this.buildingAt(worker.q, worker.r) !== null;

            if (onMonument && s.monument.stage < MONUMENT_STAGES.length) {
                const stage = MONUMENT_STAGES[s.monument.stage];
                const connected = this.monumentConnected();
                options.push({
                    action: 'monument', type: null, name: stage.name, cost: stage.cost,
                    mp: MONUMENT_MP,
                    enabled: connected && this.canAfford(stage.cost) && worker.mp >= MONUMENT_MP,
                    note: connected ? null : 'no road link to every Hall'
                });
            }

            if (!onMonument && !occupied) {
                for (const [type, def] of Object.entries(BUILDINGS)) {
                    if (!def.terrain.includes(hex.terrain)) continue;
                    options.push({
                        action: 'building', type, name: def.name, cost: def.cost,
                        mp: def.mp,
                        enabled: this.canAfford(def.cost) && worker.mp >= def.mp,
                        note: null
                    });
                }
                if (!hex.road) {
                    options.push({
                        action: 'road', type: null, name: 'Road', cost: ROAD.cost,
                        mp: ROAD.mp,
                        enabled: this.canAfford(ROAD.cost) && worker.mp >= ROAD.mp,
                        note: null
                    });
                }
            }
            return options;
        }

        // ---- Actions (mutate state, return an outcome; no rendering) ----

        // Move a worker to (q, r) if legal. Re-derives legality here rather than
        // trusting a caller-supplied cost. Returns { ok } — movement never wins or
        // auto-ends anything; a worker at 0 MP simply has an empty reachable set.
        moveWorker(workerId, q, r) {
            const worker = this.workerById(workerId);
            if (!worker) return { ok: false };
            const reachable = this.computeReachable(worker);
            const cost = reachable.get(Hex.key(q, r));
            if (cost === undefined) return { ok: false };

            worker.q = q;
            worker.r = r;
            worker.mp -= cost;
            return { ok: true };
        }

        // Construct a building on the worker's hex. Validity is re-derived from
        // buildOptions — the same table the UI rendered from.
        build(workerId, type) {
            const worker = this.workerById(workerId);
            if (!worker) return { ok: false };
            const option = this.buildOptions(worker)
                .find(o => o.action === 'building' && o.type === type);
            if (!option || !option.enabled) return { ok: false };

            this.pay(option.cost);
            worker.mp -= option.mp;
            this.state.buildings.push({ id: this.state.nextId++, type, q: worker.q, r: worker.r });
            return { ok: true };
        }

        buildRoad(workerId) {
            const worker = this.workerById(workerId);
            if (!worker) return { ok: false };
            const option = this.buildOptions(worker).find(o => o.action === 'road');
            if (!option || !option.enabled) return { ok: false };

            this.pay(option.cost);
            worker.mp -= option.mp;
            this.state.hexes.get(Hex.key(worker.q, worker.r)).road = true;
            return { ok: true };
        }

        // Pay for the next Monument stage; completing the last one wins the game.
        buildMonumentStage(workerId) {
            const worker = this.workerById(workerId);
            if (!worker) return { ok: false };
            const option = this.buildOptions(worker).find(o => o.action === 'monument');
            if (!option || !option.enabled) return { ok: false };

            this.pay(option.cost);
            worker.mp -= option.mp;
            const s = this.state;
            s.monument.stage++;
            if (s.monument.stage >= MONUMENT_STAGES.length) {
                s.gameWon = true;
                return { ok: true, won: true };
            }
            return { ok: true };
        }

        // A new worker joins at the newest Hall (the frontier one) with full MP.
        recruit() {
            const s = this.state;
            const cost = this.recruitCost();
            if (!this.canAfford(cost)) return { ok: false };
            const halls = s.buildings.filter(b => b.type === 'hall');
            const hall = halls[halls.length - 1];
            const spot = this.recruitSpot(hall);
            if (!spot) return { ok: false };

            this.pay(cost);
            const worker = { id: s.nextId++, q: spot.q, r: spot.r, mp: WORKER_MP };
            s.workers.push(worker);
            return { ok: true, worker };
        }

        // The Hall hex itself, or the nearest free neighbor if someone's standing there.
        recruitSpot(hall) {
            const candidates = [new Hex(hall.q, hall.r), ...new Hex(hall.q, hall.r).neighbors()];
            return candidates.find(h => {
                const hex = this.state.hexes.get(h.key());
                if (!hex || !this.isPassable(hex)) return false;
                return !this.workerAt(h.q, h.r) && !this.beastAt(h.q, h.r);
            }) ?? null;
        }

        // Shoo an adjacent beast: it flees 4-7 hexes away, the worker spends 2 MP.
        // Counterplay without combat — nothing dies, the board just breathes again.
        shooBeast(workerId, q, r) {
            const worker = this.workerById(workerId);
            if (!worker) return { ok: false };
            if (!this.computeAttackable(worker).has(Hex.key(q, r))) return { ok: false };
            const beast = this.beastAt(q, r);
            const spot = this.fleeSpot(beast);
            if (!spot) return { ok: false };

            worker.mp -= BEAST.SHOO_MP;
            beast.q = spot.q;
            beast.r = spot.r;
            return { ok: true };
        }

        // A random valid hex 4-7 away from the beast; if the area is too crowded,
        // fall back to anywhere at least 2 away so a shoo can never fizzle silently.
        fleeSpot(beast) {
            const pick = minDist => {
                const guarded = this.protectedKeys();
                const candidates = new Hex(beast.q, beast.r).inRange(BEAST.SHOO_MAX_DIST)
                    .filter(h => {
                        if (new Hex(beast.q, beast.r).distance(h) < minDist) return false;
                        const hex = this.state.hexes.get(h.key());
                        if (!hex || !this.isPassable(hex)) return false;
                        if (guarded.has(h.key())) return false;
                        if (this.isMonumentHex(h.q, h.r)) return false;
                        return !this.workerAt(h.q, h.r) && !this.beastAt(h.q, h.r) &&
                            !this.buildingAt(h.q, h.r);
                    });
                return Rando.choice(candidates);
            };
            return pick(BEAST.SHOO_MIN_DIST) ?? pick(2);
        }

        // ---- Turn resolution ----

        // Resolve the enemy phase and advance to the player's next turn:
        // beasts move (and smash), one may spawn, then surviving buildings produce.
        // Destruction before production — a mill smashed this turn pays nothing.
        endTurn() {
            const s = this.state;
            if (s.gameWon) return { events: [] };
            s.phase = 'enemy';
            const events = this.moveBeasts();
            this.maybeSpawnBeast();
            this.produce();
            s.phase = 'player';
            s.turn++;
            for (const w of s.workers) w.mp = WORKER_MP;
            return { events };
        }

        produce() {
            const res = this.state.resources;
            for (const [k, v] of Object.entries(this.incomePerTurn())) res[k] += v;
        }

        // Each beast wanders `speed` random steps. Beasts respect raw terrain (roads
        // mean nothing to them), never stack with anyone, avoid the Monument, and
        // refuse tower cover — unless already inside it, so towers never cage one.
        // Stepping onto a building destroys it and stops the beast: an event.
        moveBeasts() {
            const s = this.state;
            const events = [];
            const guarded = this.protectedKeys();
            const occupied = new Set(s.workers.map(w => Hex.key(w.q, w.r)));
            for (const b of s.beasts) occupied.add(Hex.key(b.q, b.r));

            for (const beast of s.beasts) {
                for (let step = 0; step < beast.speed; step++) {
                    const inCover = guarded.has(Hex.key(beast.q, beast.r));
                    const valid = new Hex(beast.q, beast.r).neighbors().filter(n => {
                        const key = n.key();
                        const hex = s.hexes.get(key);
                        if (!hex || this.rawMoveCost(hex) === Infinity) return false;
                        if (occupied.has(key)) return false;
                        if (this.isMonumentHex(n.q, n.r)) return false;
                        if (guarded.has(key) && !inCover) return false;
                        return true;
                    });
                    if (valid.length === 0) break;

                    occupied.delete(Hex.key(beast.q, beast.r));
                    const dest = Rando.choice(valid);
                    beast.q = dest.q;
                    beast.r = dest.r;
                    occupied.add(Hex.key(beast.q, beast.r));

                    const victim = this.buildingAt(beast.q, beast.r);
                    if (victim) {
                        s.buildings.splice(s.buildings.indexOf(victim), 1);
                        events.push(`A beast smashed your ${BUILDINGS[victim.type].name} at (${victim.q},${victim.r})`);
                        break;
                    }
                }
            }
            return events;
        }
    }

    return GameEngine;
})();
