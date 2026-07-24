// gameengine.js — GameEngine
//
// All game rules and world generation, operating on a GameState. Deliberately
// DOM-free and render-free: methods mutate state and *return outcomes* (including
// an events list from the predator phase); the caller (GameUI today, a network
// handler tomorrow) decides what to redraw or broadcast. This is the half that
// would run server-side unchanged.
//
// Server-readiness notes:
//  - Generation, spawns, and AI route all randomness through the seeded Rando, so a
//    game is reproducible from state.seed alone.
//  - Every action re-derives legality from state (movePlayer from computeReachable,
//    sell/craft from isDocked) rather than trusting the caller — the "never trust
//    the client" rule, baked in now so a future command layer doesn't re-audit.
const GameEngine = (function () {
    const {
        TERRAIN, BAND_PERCENTILES, NODE_TABLES, SELL_PRICES,
        UPGRADES, UPGRADE_KEYS, BEACON,
        SUB_MOVE_COST, DIVER_MOVE_COST, O2_DRAIN, LEVIATHAN_WATER, VENT_FRACTION,
        SUB_MP, GATHER_MP, DIVER_SIGHT, RESCUE_FEE,
        EEL_SENSE, EEL_SPEEDS, EEL_BASE_COUNT, EEL_PER_ATTENTION,
        EEL_SPAWN_CHANCE, EEL_SPAWN_MIN_DIST,
        LEVIATHAN_SPEED, LEVIATHAN_SENSE, LEVIATHAN_WAKE_ATTENTION,
        LEVIATHAN_SPAWN_MIN_DIST, LEVIATHAN_NAMES,
        MAP_COLS, MAP_ROWS
    } = GameArtifacts;

    const PATH_MAX_COST = 40;   // A* search cap for predator chases

    function countTotal(counts) {
        return Object.values(counts).reduce((sum, n) => sum + n, 0);
    }

    function addCount(counts, material, n) {
        counts[material] = (counts[material] || 0) + n;
        if (counts[material] <= 0) delete counts[material];
    }

    function dist(a, b) {
        return new Hex(a.q, a.r).distance(new Hex(b.q, b.r));
    }

    class GameEngine {
        constructor(state) {
            this.state = state;
            this.eelScheme = [[0.8, 0.2, 0.2]];   // replaced per game; display identity only
        }

        // ---- Derived stats (the upgrade template: one table lookup, no special cases) ----
        stat(key) {
            return UPGRADES[key].values[this.state.upgrades[key]];
        }

        attention() {
            return UPGRADE_KEYS.reduce((sum, k) => sum + this.state.upgrades[k], 0);
        }

        bagSpace() {
            return this.stat('bag') - countTotal(this.state.bag);
        }

        holdSpace() {
            return this.stat('hold') - countTotal(this.state.hold);
        }

        // ---- Terrain and movement (mode dispatch routed through one point) ----
        hexAt(p) {
            return this.state.hexes.get(Hex.key(p.q, p.r));
        }

        subMoveCost(hex) {
            return SUB_MOVE_COST[hex.terrain] ?? Infinity;
        }

        diverMoveCost(hex) {
            return DIVER_MOVE_COST[hex.terrain] ?? Infinity;
        }

        activeMoveCost(hex) {
            return this.state.diverOut ? this.diverMoveCost(hex) : this.subMoveCost(hex);
        }

        activePos() {
            return this.state.diverOut ? this.state.diver : this.state.sub;
        }

        // ---- New game / world generation ----
        newGame(seed) {
            const s = this.state;
            s.seed = (seed === undefined || seed === null)
                ? Math.floor(Math.random() * 0x100000000)
                : (seed >>> 0);
            Rando.seed(s.seed);

            let attempts = 0;
            do {
                s.hexes = this.generateRectGrid();
                this.assignTerrain();
                this.placeBase();
                attempts++;
            } while (!this.bandsReachable() && attempts < 20);

            this.spawnNodes();

            s.diverOut = false;
            s.diver = null;
            s.subMoved = false;
            s.upgrades = { o2: 0, fins: 0, bag: 0, hold: 0, hull: 0, sonar: 0 };
            s.o2 = this.stat('o2');
            s.hull = this.stat('hull');
            s.credits = 0;
            s.bag = {};
            s.hold = {};
            s.caches = [];
            s.leviathans = [];
            s.turn = 1;
            s.mp = SUB_MP;
            s.phase = 'player';
            s.gameWon = false;
            s.seen = new Set();

            this.spawnInitialEels();
            this.recomputeSight();
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
                        terrain: null, node: null
                    });
                }
            }
            return hexes;
        }

        // Depth bands by elevation percentile (trench floor to rock spires), then vent
        // fields scattered through the deep water; the map edge is the rift wall.
        assignTerrain() {
            const inner = [];
            for (const [, hex] of this.state.hexes) {
                if (hex.isEdge) { hex.terrain = TERRAIN.ROCK; continue; }
                inner.push(hex);
            }
            inner.sort((a, b) => a.elevation - b.elevation);
            const n = inner.length;

            for (let i = 0; i < n; i++) {
                const pct = i / n;
                inner[i].terrain = BAND_PERCENTILES.find(b => pct < b.pct).terrain;
            }

            const deepWater = inner.filter(h =>
                h.terrain === TERRAIN.DEEP || h.terrain === TERRAIN.TRENCH);
            Rando.shuffle(deepWater);
            const ventCount = Math.round(deepWater.length * VENT_FRACTION);
            for (let i = 0; i < ventCount; i++)
                deepWater[i].terrain = TERRAIN.VENT;
        }

        // Berth Station on the far-left shallows; the sub starts docked there.
        placeBase() {
            const shallows = [];
            for (const [, hex] of this.state.hexes)
                if (hex.terrain === TERRAIN.SHALLOWS) shallows.push(hex);
            shallows.sort((a, b) => a.col - b.col);

            const slice = shallows.slice(0, Math.max(5, Math.floor(shallows.length * 0.03)));
            const bh = Rando.choice(slice);
            bh.terrain = TERRAIN.BASE;
            this.state.base = { q: bh.q, r: bh.r };
            this.state.sub = { q: bh.q, r: bh.r };
        }

        // The diver must be able to swim from base to every band that holds materials —
        // in particular a trench hex and a vent hex (endgame gating must be O2, not walls).
        bandsReachable() {
            if (!this.state.base) return false;
            const costs = bfsHexes(this.state.base, this.state.hexes,
                hex => this.diverMoveCost(hex), Infinity);
            let trench = false, vent = false;
            for (const [, hex] of this.state.hexes) {
                if (!costs.has(Hex.key(hex.q, hex.r))) continue;
                if (hex.terrain === TERRAIN.TRENCH) trench = true;
                if (hex.terrain === TERRAIN.VENT) vent = true;
                if (trench && vent) return true;
            }
            return false;
        }

        // Roll each hex against its band's node table (subtractive roll over the
        // listed chances). Reproducible from the seed like everything else.
        spawnNodes() {
            for (const [, hex] of this.state.hexes) {
                const table = NODE_TABLES[hex.terrain];
                if (!table) continue;
                let roll = Rando.random();
                for (const entry of table) {
                    if (roll < entry.p) {
                        hex.node = { material: entry.material, amount: Rando.int(entry.min, entry.max) };
                        break;
                    }
                    roll -= entry.p;
                }
            }
        }

        // ---- Predator spawning ----
        predatorKeys() {
            const keys = new Set();
            for (const e of this.state.eels) keys.add(Hex.key(e.q, e.r));
            for (const l of this.state.leviathans) keys.add(Hex.key(l.q, l.r));
            return keys;
        }

        // Reef/kelp hexes far enough from both counters, for eel spawns.
        eelSpawnCandidates() {
            const s = this.state;
            const occupied = this.predatorKeys();
            const out = [];
            for (const [, hex] of s.hexes) {
                if (hex.terrain !== TERRAIN.REEF && hex.terrain !== TERRAIN.KELP) continue;
                if (occupied.has(Hex.key(hex.q, hex.r))) continue;
                if (dist(hex, s.sub) < EEL_SPAWN_MIN_DIST) continue;
                if (s.diverOut && dist(hex, s.diver) < EEL_SPAWN_MIN_DIST) continue;
                out.push(hex);
            }
            return out;
        }

        spawnEel() {
            const candidates = this.eelSpawnCandidates();
            if (candidates.length === 0) return;
            const h = Rando.choice(candidates);
            this.state.eels.push({ q: h.q, r: h.r, speed: Rando.choice(EEL_SPEEDS) });
            const [r, g, b] = this.eelScheme[(this.state.eels.length - 1) % this.eelScheme.length];
            this.state.eelColors.push(ColorTheory.rgbToHex(r, g, b));
        }

        spawnInitialEels() {
            this.state.eels = [];
            this.state.eelColors = [];
            this.eelScheme = ColorTheory.randomScheme(() => Rando.random());
            for (let i = 0; i < EEL_BASE_COUNT; i++) this.spawnEel();
        }

        // A leviathan wakes for each attention threshold crossed. Named, so the player
        // always knows which shadow is which.
        wakeLeviathans(events) {
            const s = this.state;
            const due = LEVIATHAN_WAKE_ATTENTION.filter(t => this.attention() >= t).length;
            while (s.leviathans.length < due) {
                const occupied = this.predatorKeys();
                let candidates = [];
                for (const [, hex] of s.hexes) {
                    if (hex.terrain !== TERRAIN.TRENCH) continue;
                    if (occupied.has(Hex.key(hex.q, hex.r))) continue;
                    candidates.push(hex);
                }
                const far = candidates.filter(h =>
                    dist(h, s.sub) >= LEVIATHAN_SPAWN_MIN_DIST &&
                    (!s.diverOut || dist(h, s.diver) >= LEVIATHAN_SPAWN_MIN_DIST));
                const pool = far.length > 0 ? far : candidates;
                if (pool.length === 0) return;
                const h = Rando.choice(pool);
                const name = LEVIATHAN_NAMES[s.leviathans.length % LEVIATHAN_NAMES.length];
                s.leviathans.push({ q: h.q, r: h.r, name });
                events.push({ type: 'wake', name });
            }
        }

        // ---- Sight and murk (information is a resource; sonar tiers widen it) ----
        sightRadius() {
            return this.state.diverOut ? DIVER_SIGHT : this.stat('sonar');
        }

        recomputeSight() {
            const s = this.state;
            const reveal = (pos, radius) => {
                for (const h of new Hex(pos.q, pos.r).inRange(radius)) {
                    const key = h.key();
                    if (s.hexes.has(key)) s.seen.add(key);
                }
            };
            reveal(s.sub, this.stat('sonar'));
            if (s.diverOut) reveal(s.diver, DIVER_SIGHT);
        }

        // A hex is inside current sight of either counter (predator visibility).
        inSight(p) {
            const s = this.state;
            if (dist(p, s.sub) <= this.stat('sonar')) return true;
            if (s.diverOut && dist(p, s.diver) <= DIVER_SIGHT) return true;
            return false;
        }

        // ---- Stealth (kelp cover) ----
        diverHidden() {
            const s = this.state;
            if (!s.diverOut) return true;
            const hex = this.hexAt(s.diver);
            return hex.terrain === TERRAIN.KELP && hex.node !== null && hex.node.amount > 0;
        }

        eelCanSense(eel) {
            const s = this.state;
            if (!s.diverOut) return false;
            if (this.diverHidden()) return false;
            return dist(eel, s.diver) <= EEL_SENSE;
        }

        // ---- Legal-move computation (the rules the UI highlights and the engine enforces) ----

        // Cost-limited flood fill bounded by remaining MP; predator hexes are walls.
        computeReachable() {
            const s = this.state;
            if (s.mp <= 0) return new Map();
            const predators = this.predatorKeys();
            const costs = bfsHexes(this.activePos(), s.hexes, hex => {
                if (predators.has(Hex.key(hex.q, hex.r))) return Infinity;
                return this.activeMoveCost(hex);
            }, s.mp);
            costs.delete(Hex.key(this.activePos().q, this.activePos().r));
            return costs;
        }

        // L3 attackable set — deliberately empty forever: fleeing is the combat.
        computeAttackable() {
            return new Set();
        }

        // L2.1 interactive location: the market, when docked at Berth Station.
        locationAt(p) {
            if (this.isDocked() && p.q === this.state.sub.q && p.r === this.state.sub.r)
                return 'market';
            return null;
        }

        // ---- Context-action availability (UI reads these to build its buttons) ----
        isDocked() {
            const s = this.state;
            return !s.diverOut && s.sub.q === s.base.q && s.sub.r === s.base.r;
        }

        canDive() {
            return !this.state.diverOut;
        }

        canBoard() {
            const s = this.state;
            return s.diverOut && s.diver.q === s.sub.q && s.diver.r === s.sub.r;
        }

        cacheAt(p) {
            return this.state.caches.find(c => c.q === p.q && c.r === p.r) || null;
        }

        canScoop() {
            const s = this.state;
            return s.diverOut && this.cacheAt(s.diver) !== null && this.bagSpace() > 0;
        }

        canGather() {
            const s = this.state;
            if (!s.diverOut || s.mp < GATHER_MP || this.bagSpace() <= 0) return false;
            const hex = this.hexAt(s.diver);
            return hex.node !== null && hex.node.amount > 0;
        }

        // ---- Actions (mutate state, return an outcome; no rendering) ----

        // Move the active counter to (q, r) if legal. Returns:
        //   { ok:false }                          illegal, nothing changed
        //   { ok:true }                           moved, turn continues
        //   { ok:true, endedTurn:true, events }   moved and spent the last MP
        movePlayer(q, r) {
            const s = this.state;
            const reachable = this.computeReachable();
            const cost = reachable.get(Hex.key(q, r));
            if (cost === undefined) return { ok: false };

            if (s.diverOut) {
                s.diver = { q, r };
            } else {
                s.sub = { q, r };
                s.subMoved = true;   // engine wake — what the leviathans listen for
            }
            s.mp -= cost;
            this.recomputeSight();

            if (s.mp <= 0) return { ok: true, endedTurn: true, events: this.endTurn() };
            return { ok: true };
        }

        // Leave the sub as the diver: full O2, MP capped to fins for the rest of the turn.
        dive() {
            const s = this.state;
            if (!this.canDive()) return { ok: false };
            s.diverOut = true;
            s.diver = { q: s.sub.q, r: s.sub.r };
            s.o2 = this.stat('o2');
            s.mp = Math.min(s.mp, this.stat('fins'));
            this.recomputeSight();
            return { ok: true };
        }

        // Board the sub: bag empties into the hold (overflow stays in the bag), O2 tops off.
        board() {
            const s = this.state;
            if (!this.canBoard()) return { ok: false };
            for (const [material, count] of Object.entries(s.bag)) {
                const moved = Math.min(count, this.holdSpace());
                if (moved <= 0) continue;
                addCount(s.hold, material, moved);
                addCount(s.bag, material, -moved);
            }
            s.diverOut = false;
            s.diver = null;
            s.o2 = this.stat('o2');
            s.mp = Math.min(s.mp, SUB_MP);
            this.recomputeSight();
            return { ok: true };
        }

        // Extract one unit from the node underfoot for GATHER_MP.
        gather() {
            const s = this.state;
            if (!this.canGather()) return { ok: false };
            const hex = this.hexAt(s.diver);
            const material = hex.node.material;
            hex.node.amount--;
            if (hex.node.amount <= 0) hex.node = null;   // depleted kelp loses its cover too
            addCount(s.bag, material, 1);
            s.mp -= GATHER_MP;

            if (s.mp <= 0) return { ok: true, material, endedTurn: true, events: this.endTurn() };
            return { ok: true, material };
        }

        // Recover a dropped bag or wreck: take as much as fits, free of MP.
        scoop() {
            const s = this.state;
            if (!this.canScoop()) return { ok: false };
            const cache = this.cacheAt(s.diver);
            const took = {};
            for (const [material, count] of Object.entries(cache.contents)) {
                const moved = Math.min(count, this.bagSpace());
                if (moved <= 0) continue;
                addCount(s.bag, material, moved);
                addCount(cache.contents, material, -moved);
                took[material] = moved;
            }
            if (countTotal(cache.contents) === 0)
                s.caches = s.caches.filter(c => c !== cache);
            return { ok: true, took };
        }

        // Docking is free repair + air; the market itself is sell()/craft() below.
        dock() {
            if (!this.isDocked()) return { ok: false };
            this.state.hull = this.stat('hull');
            this.state.o2 = this.stat('o2');
            return { ok: true };
        }

        // ---- Market (guarded by isDocked — never trust the client) ----
        sell(material) {
            const s = this.state;
            if (!this.isDocked()) return { ok: false };
            const count = s.hold[material] || 0;
            if (count === 0) return { ok: false };
            const gained = count * SELL_PRICES[material];
            s.credits += gained;
            delete s.hold[material];
            return { ok: true, sold: count, gained };
        }

        sellAll() {
            let gained = 0;
            for (const material of Object.keys(this.state.hold)) {
                const res = this.sell(material);
                if (res.ok) gained += res.gained;
            }
            return { ok: gained > 0, gained };
        }

        materialsAvailable(mats) {
            const s = this.state;
            return Object.entries(mats).every(([m, n]) =>
                (s.hold[m] || 0) + (s.bag[m] || 0) >= n);
        }

        deductMaterials(mats) {
            const s = this.state;
            for (const [material, n] of Object.entries(mats)) {
                const fromHold = Math.min(n, s.hold[material] || 0);
                if (fromHold > 0) addCount(s.hold, material, -fromHold);
                if (n - fromHold > 0) addCount(s.bag, material, -(n - fromHold));
            }
        }

        canCraft(key) {
            const s = this.state;
            if (!this.isDocked()) return false;
            const tier = s.upgrades[key];
            if (tier >= UPGRADES[key].tiers.length) return false;
            const recipe = UPGRADES[key].tiers[tier];
            return s.credits >= recipe.price && this.materialsAvailable(recipe.mats);
        }

        craft(key) {
            const s = this.state;
            if (!this.canCraft(key)) return { ok: false };
            const recipe = UPGRADES[key].tiers[s.upgrades[key]];
            s.credits -= recipe.price;
            this.deductMaterials(recipe.mats);
            s.upgrades[key]++;

            // Docked benefits land immediately; sight may widen on a sonar craft.
            s.hull = this.stat('hull');
            s.o2 = this.stat('o2');
            this.recomputeSight();
            return { ok: true, key, tier: s.upgrades[key] };
        }

        canCraftBeacon() {
            const s = this.state;
            return this.isDocked() && !s.gameWon &&
                s.credits >= BEACON.price && this.materialsAvailable(BEACON.mats);
        }

        craftBeacon() {
            const s = this.state;
            if (!this.canCraftBeacon()) return { ok: false };
            s.credits -= BEACON.price;
            this.deductMaterials(BEACON.mats);
            s.gameWon = true;
            return { ok: true, won: true };
        }

        // ---- Turn resolution ----

        // Resolve the predator phase and advance to the player's next turn.
        // Returns a list of events for the UI to toast/sound:
        //   { type:'blackout' } { type:'maul' } { type:'bite', name, hull }
        //   { type:'wreck', name } { type:'wake', name }
        endTurn() {
            const s = this.state;
            if (s.gameWon) return [];
            const events = [];
            s.phase = 'enemy';

            this.drainO2(events);        // your own math first — then the ocean's
            this.moveEels(events);
            this.moveLeviathans(events);
            this.spawnCheck();
            this.wakeLeviathans(events);

            s.subMoved = false;
            s.phase = 'player';
            s.turn++;
            s.mp = s.diverOut ? this.stat('fins') : SUB_MP;
            return events;
        }

        drainO2(events) {
            const s = this.state;
            if (!s.diverOut) return;
            const hex = this.hexAt(s.diver);
            if (hex.terrain === TERRAIN.BASE) { s.o2 = this.stat('o2'); return; }
            s.o2 -= O2_DRAIN[hex.terrain];
            if (s.o2 > 0) return;
            events.push({ type: 'blackout' });
            this.loseBag();
        }

        // Shared misadventure outcome (blackout, maul): the bag becomes a cache where
        // the diver stood, the rescue drone hauls them to the sub, the fee comes due.
        loseBag() {
            const s = this.state;
            if (countTotal(s.bag) > 0) {
                const existing = this.cacheAt(s.diver);
                if (existing) {
                    for (const [m, n] of Object.entries(s.bag)) addCount(existing.contents, m, n);
                } else {
                    s.caches.push({ q: s.diver.q, r: s.diver.r, contents: { ...s.bag } });
                }
                s.bag = {};
            }
            s.diverOut = false;
            s.diver = null;
            s.o2 = this.stat('o2');
            s.credits = Math.max(0, s.credits - RESCUE_FEE);
        }

        // Eels chase a sensed diver with full A* (no horizon stalls); otherwise they
        // drift one random hex. Reaching the diver is a maul. They never blunder onto
        // a hidden diver — kelp cover is a promise.
        moveEels(events) {
            const s = this.state;
            const occupied = this.predatorKeys();

            for (const eel of s.eels) {
                if (this.eelCanSense(eel)) {
                    if (this.chaseDiver(eel, occupied, events)) continue;
                }
                this.wander(eel, occupied, n => this.eelWanderable(n, occupied));
            }
        }

        eelWanderable(n, occupied) {
            const s = this.state;
            const hex = s.hexes.get(n.key());
            if (!hex) return false;
            if (this.diverMoveCost(hex) === Infinity) return false;
            if (hex.terrain === TERRAIN.BASE) return false;   // station lights repel them
            if (occupied.has(n.key())) return false;
            if (n.q === s.sub.q && n.r === s.sub.r) return false;
            if (s.diverOut && n.q === s.diver.q && n.r === s.diver.r) return false;
            return true;
        }

        // Walk the eel along an A* path toward the diver; entering the diver's hex
        // mauls. Returns true if the eel acted (chased or mauled).
        chaseDiver(eel, occupied, events) {
            const s = this.state;
            const diverKey = Hex.key(s.diver.q, s.diver.r);
            const path = findPath(eel, s.diver,
                (q, r) => {
                    const hex = s.hexes.get(Hex.key(q, r));
                    if (!hex) return false;
                    if (this.diverMoveCost(hex) === Infinity) return false;
                    const key = Hex.key(q, r);
                    if (key !== diverKey && occupied.has(key)) return false;
                    if (q === s.sub.q && r === s.sub.r) return false;
                    return true;
                },
                () => 1, PATH_MAX_COST);
            if (!path || path.length < 2) return false;

            occupied.delete(Hex.key(eel.q, eel.r));
            const steps = Math.min(eel.speed, path.length - 1);
            for (let i = 1; i <= steps; i++) {
                const next = path[i];
                if (next.key() === diverKey) {
                    // The maul: bag drops here, diver is dragged off and kicks free to
                    // the sub. The eel ends standing on the cache it just made.
                    const spot = { q: s.diver.q, r: s.diver.r };
                    events.push({ type: 'maul' });
                    this.loseBag();
                    eel.q = spot.q;
                    eel.r = spot.r;
                    break;
                }
                eel.q = next.q;
                eel.r = next.r;
            }
            occupied.add(Hex.key(eel.q, eel.r));
            return true;
        }

        wander(creature, occupied, allowed) {
            const options = new Hex(creature.q, creature.r).neighbors().filter(allowed);
            if (options.length === 0) return;
            occupied.delete(Hex.key(creature.q, creature.r));
            const dest = Rando.choice(options);
            creature.q = dest.q;
            creature.r = dest.r;
            occupied.add(Hex.key(creature.q, creature.r));
        }

        // Leviathans hear the sub's engine wake (only on turns it moved) and close in
        // through deep water; a leviathan adjacent to the sub — chasing or merely
        // wandering — always bites.
        moveLeviathans(events) {
            const s = this.state;
            const occupied = this.predatorKeys();

            for (const lev of s.leviathans) {
                const hunting = s.subMoved && dist(lev, s.sub) <= LEVIATHAN_SENSE;
                if (hunting) this.chaseSub(lev, occupied);
                else this.wander(lev, occupied, n => this.leviathanWanderable(n, occupied));

                if (dist(lev, s.sub) === 1) this.bite(lev, events);
            }
        }

        leviathanWanderable(n, occupied) {
            const s = this.state;
            const hex = s.hexes.get(n.key());
            if (!hex) return false;
            if (!LEVIATHAN_WATER.has(hex.terrain)) return false;
            if (occupied.has(n.key())) return false;
            if (n.q === s.sub.q && n.r === s.sub.r) return false;
            return true;
        }

        // A* to the sub hex (allowed as the path *end* even outside leviathan water,
        // so a sub parked one hex into the fringe can still be lunged at) — but the
        // leviathan never enters it: it stops adjacent, where the bite check lands.
        chaseSub(lev, occupied) {
            const s = this.state;
            const subKey = Hex.key(s.sub.q, s.sub.r);
            const path = findPath(lev, s.sub,
                (q, r) => {
                    const key = Hex.key(q, r);
                    if (key === subKey) return true;
                    const hex = s.hexes.get(key);
                    if (!hex) return false;
                    if (!LEVIATHAN_WATER.has(hex.terrain)) return false;
                    if (occupied.has(key)) return false;
                    return true;
                },
                () => 1, PATH_MAX_COST);
            if (!path || path.length < 2) return;

            occupied.delete(Hex.key(lev.q, lev.r));
            const steps = Math.min(LEVIATHAN_SPEED, path.length - 1);
            for (let i = 1; i <= steps; i++) {
                if (path[i].key() === subKey) break;   // never enters — stops adjacent
                lev.q = path[i].q;
                lev.r = path[i].r;
            }
            occupied.add(Hex.key(lev.q, lev.r));
        }

        bite(lev, events) {
            const s = this.state;
            s.hull--;
            events.push({ type: 'bite', name: lev.name, hull: s.hull });
            if (s.hull > 0) return;

            // The sub goes down: the hold spills as a wreck cache where it sank, and
            // the tender scoops diver and refloated sub back to Berth Station.
            if (countTotal(s.hold) > 0) {
                const existing = this.cacheAt(s.sub);
                if (existing) {
                    for (const [m, n] of Object.entries(s.hold)) addCount(existing.contents, m, n);
                } else {
                    s.caches.push({ q: s.sub.q, r: s.sub.r, contents: { ...s.hold } });
                }
                s.hold = {};
            }
            events.push({ type: 'wreck', name: lev.name });
            s.sub = { q: s.base.q, r: s.base.r };
            s.diverOut = false;
            s.diver = null;
            s.o2 = this.stat('o2');
            s.hull = this.stat('hull');
        }

        // Ecology upkeep: the eel population tracks Attention (escalation tied to
        // progress, not time), refilled one probabilistic spawn at a time.
        spawnCheck() {
            const target = EEL_BASE_COUNT + EEL_PER_ATTENTION * this.attention();
            if (this.state.eels.length >= target) return;
            if (!Rando.bool(EEL_SPAWN_CHANCE)) return;
            this.spawnEel();
        }
    }

    return GameEngine;
})();
