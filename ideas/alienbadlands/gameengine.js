// gameengine.js — GameEngine
//
// All game rules and world simulation, operating on a GameState. Deliberately DOM-free
// and render-free: methods mutate state and *return outcomes* — action methods return
// { ok, events } and endTurn returns the world phase's event list; the caller (GameUI
// today, a network handler tomorrow) decides what to log, play, or redraw.
//
// Server-readiness notes:
//  - Generation and world simulation route all randomness through the seeded Rando.
//  - Every action re-derives its own legality (movePlayer from computeReachable, attack
//    from range/MP, craft from carried materials) — the "never trust the client" rule.
//  - NPCs use full A* with the same terrain costs as walkers (global vision, no local
//    horizon), then walk the path within their MP budget.
const GameEngine = (function () {
    const {
        TERRAIN, FOOT_COST, BIKE_COST, NODES, NODE_PLAN, MATERIALS,
        PREDATOR_KINDS, BANDIT, UPGRADES, BASE,
        MOUNT_COST, HARVEST_COST, ATTACK_COST, START_CREDITS, ECON, WORLD, NAMES
    } = GameArtifacts;
    const T = TERRAIN;

    const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
    const GEODE_MIN_DIST = 16;   // geode blooms only appear this far from the starport

    function dist(a, b) {
        return new Hex(a.q, a.r).distance(new Hex(b.q, b.r));
    }

    function cargoTotal(cargo) {
        return Object.values(cargo).reduce((s, n) => s + n, 0);
    }

    class GameEngine {
        constructor(state) {
            this.setState(state);
        }

        // Swap in a (loaded) state and drop derived caches.
        setState(state) {
            this.state = state;
            this._region = null;   // foot-reachable keys from the starport (stable per world)
            this._fence = null;    // keys within SETTLE_FENCE of a settlement (stable per world)
        }

        // ---- Derived player/bike stats: base + owned upgrade effects (one apply path) ----
        stats() {
            const st = { ...BASE };
            for (const id of this.state.upgrades) {
                const u = UPGRADE_BY_ID[id];
                for (const [k, v] of Object.entries(u.effects)) {
                    if (k === 'rangeTwo') st.range = 2;
                    else if (k === 'bikeHp') st.bikeMaxHp += v;
                    else st[k] += v;
                }
            }
            st.scentFoot = Math.max(1, st.scentFoot);
            return st;
        }

        // ---- Terrain passability ----
        playerCost(hex) {
            const table = this.state.player.mounted ? BIKE_COST : FOOT_COST;
            return table[hex.terrain] ?? Infinity;
        }

        // The playable pocket: every foot-reachable hex from the starport. Nodes only
        // toggle between cost 1 and 2 (never passability), so this is stable per world.
        region() {
            if (!this._region) {
                const sp = this.state.settlements[0];
                this._region = bfsHexes(sp, this.state.hexes,
                    h => FOOT_COST[h.terrain] ?? Infinity, Infinity);
            }
            return this._region;
        }

        fence() {
            if (!this._fence) {
                this._fence = new Set();
                for (const loc of this.state.settlements)
                    for (const h of new Hex(loc.q, loc.r).inRange(WORLD.SETTLE_FENCE))
                        this._fence.add(h.key());
            }
            return this._fence;
        }

        inFence(pos) {
            return this.fence().has(Hex.key(pos.q, pos.r));
        }

        // ---- New game / world generation ----
        newGame(seed) {
            const s = this.state;
            s.seed = (seed === undefined || seed === null)
                ? Math.floor(Math.random() * 0x100000000)
                : (seed >>> 0);
            Rando.seed(s.seed);

            let attempts = 0;
            let ok = false;
            do {
                s.hexes = this.generateRectGrid();
                this.assignTerrain();
                ok = this.placeLocations();
                attempts++;
            } while (!ok && attempts < 20);

            this.placeNodes();
            s.predators = [];
            for (let i = 0; i < WORLD.PRED_INIT; i++) this.spawnPredator(WORLD.PRED_MIN_DIST);
            s.bandits = [];
            s.caches = [];
            s.upgrades = [];
            s.campsRazed = 0;

            const sp = s.settlements[0];
            s.player = {
                q: sp.q, r: sp.r, hp: this.stats().maxHp,
                credits: START_CREDITS, cargo: {}, mounted: true
            };
            s.bike = { q: sp.q, r: sp.r, hp: this.stats().bikeMaxHp };
            s.day = 1;
            s.mp = this.stats().bikeMp;
            s.phase = 'player';
            s.gameWon = false;
            s.seen = new Set();
            this.reveal();
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

        generateRectGrid() {
            const hexes = new Map();
            const hm = this.diamondSquare(129, 0.55);

            for (let row = 0; row < WORLD.MAP_ROWS; row++) {
                const qOffset = -Math.floor(row / 2);
                for (let col = 0; col < WORLD.MAP_COLS; col++) {
                    const q = col + qOffset;
                    const r = row;
                    const gx = Math.round(col / (WORLD.MAP_COLS - 1) * 128);
                    const gy = Math.round(row / (WORLD.MAP_ROWS - 1) * 128);
                    const elevation = hm[gy * 129 + gx];
                    const isEdge = row === 0 || row === WORLD.MAP_ROWS - 1 ||
                        col === 0 || col === WORLD.MAP_COLS - 1;

                    hexes.set(Hex.key(q, r), {
                        q, r, col, row, elevation, isEdge,
                        terrain: null, yield: null
                    });
                }
            }
            return hexes;
        }

        // Badlands by elevation percentile: acid pools in the low ground, crags on top.
        assignTerrain() {
            const inner = [];
            for (const [, hex] of this.state.hexes) {
                if (hex.isEdge) { hex.terrain = T.STORM; continue; }
                inner.push(hex);
            }
            inner.sort((a, b) => a.elevation - b.elevation);
            const n = inner.length;
            for (let i = 0; i < n; i++) {
                const pct = i / n;
                if (pct < 0.12) inner[i].terrain = T.ACID;
                else if (pct < 0.57) inner[i].terrain = T.HARDPAN;
                else if (pct < 0.77) inner[i].terrain = T.SCRUB;
                else if (pct < 0.94) inner[i].terrain = T.BROKEN;
                else inner[i].terrain = T.CRAG;
            }
        }

        // Starport at the center, then towns / settlements / camps in their distance
        // bands, all inside the foot-reachable region, min LOC_SEP apart. Returns false
        // (regenerate) if the region is too small or a band can't be filled.
        placeLocations() {
            const s = this.state;
            const centerCol = Math.floor(WORLD.MAP_COLS / 2);
            const centerRow = Math.floor(WORLD.MAP_ROWS / 2);

            let spHex = null, bestD = Infinity;
            for (const [, hex] of s.hexes) {
                if (hex.isEdge || (FOOT_COST[hex.terrain] ?? Infinity) === Infinity) continue;
                const d = (hex.col - centerCol) ** 2 + (hex.row - centerRow) ** 2;
                if (d < bestD) { bestD = d; spHex = hex; }
            }
            if (!spHex) return false;

            this._region = bfsHexes(spHex, s.hexes, h => FOOT_COST[h.terrain] ?? Infinity, Infinity);
            this._fence = null;
            if (this._region.size < 600) return false;   // starport pocket too small

            s.settlements = [{
                q: spHex.q, r: spHex.r, name: NAMES.STARPORT, kind: 'starport',
                wealth: ECON.WEALTH_START, demand: {}
            }];
            s.camps = [];

            const pool = [];
            for (const key of this._region.keys()) pool.push(s.hexes.get(key));
            Rando.shuffle(pool);

            const nameA = Rando.shuffle([...NAMES.LOC_A]);
            const nameB = Rando.shuffle([...NAMES.LOC_B]);
            const gangs = Rando.shuffle([...NAMES.GANGS]);
            const placed = [spHex];
            let nameIdx = 0;

            const pickHex = (range) => {
                for (let i = 0; i < pool.length; i++) {
                    const h = pool[i];
                    const d = dist(h, spHex);
                    if (d < range[0] || d > range[1]) continue;
                    if (placed.some(p => dist(p, h) < WORLD.LOC_SEP)) continue;
                    pool.splice(i, 1);
                    placed.push(h);
                    return h;
                }
                return null;
            };

            for (let i = 0; i < WORLD.TOWNS; i++) {
                const h = pickHex(WORLD.TOWN_DIST);
                if (!h) return false;
                s.settlements.push({
                    q: h.q, r: h.r, name: nameA[nameIdx] + nameB[nameIdx], kind: 'town',
                    wealth: ECON.WEALTH_START, demand: this.rollDemand()
                });
                nameIdx++;
            }
            for (let i = 0; i < WORLD.SETTLEMENTS; i++) {
                const h = pickHex(WORLD.SETTLEMENT_DIST);
                if (!h) return false;
                s.settlements.push({
                    q: h.q, r: h.r, name: nameA[nameIdx] + nameB[nameIdx], kind: 'settlement',
                    wealth: ECON.WEALTH_START, demand: this.rollDemand()
                });
                nameIdx++;
            }
            for (let i = 0; i < WORLD.CAMPS; i++) {
                const h = pickHex(WORLD.CAMP_DIST);
                if (!h) return false;
                s.camps.push({ q: h.q, r: h.r, gang: gangs[i], bank: ECON.CAMP_BANK });
            }
            return true;
        }

        rollDemand() {
            const demand = {};
            for (const mat of Object.keys(MATERIALS))
                demand[mat] = Math.round(Rando.float(ECON.DEMAND_MIN, ECON.DEMAND_MAX) * 100) / 100;
            return demand;
        }

        locationKeys() {
            const keys = new Set();
            for (const l of this.state.settlements) keys.add(Hex.key(l.q, l.r));
            for (const c of this.state.camps) keys.add(Hex.key(c.q, c.r));
            return keys;
        }

        placeNodes() {
            const s = this.state;
            const sp = s.settlements[0];
            const locKeys = this.locationKeys();
            for (const plan of NODE_PLAN) {
                const node = NODES[plan.terrain];
                const minDist = plan.terrain === T.GEODE ? GEODE_MIN_DIST : 0;
                const cands = [];
                for (const key of this.region().keys()) {
                    const hex = s.hexes.get(key);
                    if (hex.terrain !== node.base) continue;
                    if (locKeys.has(key)) continue;
                    if (dist(hex, sp) < minDist) continue;
                    cands.push(hex);
                }
                Rando.shuffle(cands);
                for (let i = 0; i < plan.count && i < cands.length; i++)
                    this.makeNode(cands[i], plan.terrain);
            }
        }

        makeNode(hex, terrain) {
            const node = NODES[terrain];
            const sp = this.state.settlements[0];
            hex.terrain = terrain;
            hex.yield = Rando.int(node.yieldMin, node.yieldMax) +
                (dist(hex, sp) > WORLD.RICH_DIST ? WORLD.RICH_BONUS : 0);
        }

        spawnPredator(minDist) {
            const s = this.state;
            const sp = s.settlements[0];
            const cands = [];
            for (const key of this.region().keys()) {
                const hex = s.hexes.get(key);
                if (dist(hex, sp) < minDist) continue;
                if (this.fence().has(key)) continue;
                cands.push(hex);
            }
            const h = Rando.choice(cands);
            if (!h) return;
            const kind = Rando.bool(WORLD.PRED_GRAVEMAW_SHARE) ? 'gravemaw' : 'howler';
            s.predators.push({ q: h.q, r: h.r, kind, hp: PREDATOR_KINDS[kind].hp });
        }

        // ---- Fog of exploration ----
        reveal() {
            const s = this.state;
            for (const h of new Hex(s.player.q, s.player.r).inRange(WORLD.REVEAL)) {
                const key = h.key();
                if (s.hexes.has(key)) s.seen.add(key);
            }
        }

        // ---- Lookups ----
        locationAt(p) {
            return this.state.settlements.find(l => l.q === p.q && l.r === p.r) ?? null;
        }

        campAt(p) {
            return this.state.camps.find(c => c.q === p.q && c.r === p.r) ?? null;
        }

        nodeAt(p) {
            const hex = this.state.hexes.get(Hex.key(p.q, p.r));
            return hex && NODES[hex.terrain] && hex.yield > 0 ? hex : null;
        }

        nearestSettlement(pos) {
            let best = null, bestD = Infinity;
            for (const l of this.state.settlements) {
                if (l.kind === 'starport') continue;   // the starport is guarded
                const d = dist(l, pos);
                if (d < bestD) { bestD = d; best = l; }
            }
            return best;
        }

        // ---- Legal-move computation ----

        // Cost-limited flood fill by remaining MP with the current mode's cost table;
        // bandit and predator hexes are walls.
        computeReachable() {
            const s = this.state;
            if (s.mp <= 0) return new Map();
            const blocked = new Set();
            for (const b of s.bandits) blocked.add(Hex.key(b.q, b.r));
            for (const p of s.predators) blocked.add(Hex.key(p.q, p.r));
            const costs = bfsHexes(s.player, s.hexes, hex => {
                if (blocked.has(Hex.key(hex.q, hex.r))) return Infinity;
                return this.playerCost(hex);
            }, s.mp);
            costs.delete(Hex.key(s.player.q, s.player.r));
            return costs;
        }

        // L3 attackable set: enemies within weapon range, on foot, with MP for the swing.
        computeAttackable() {
            const s = this.state;
            const out = new Set();
            if (s.player.mounted || s.mp < ATTACK_COST) return out;
            const range = this.stats().range;
            for (const b of s.bandits)
                if (dist(b, s.player) <= range) out.add(Hex.key(b.q, b.r));
            for (const p of s.predators)
                if (dist(p, s.player) <= range) out.add(Hex.key(p.q, p.r));
            return out;
        }

        // ---- Cargo and caches ----

        // Add materials to cargo; overflow drops as a cache at the player's feet.
        gainCargo(mat, n, events) {
            const s = this.state;
            const free = this.stats().cargo - cargoTotal(s.player.cargo);
            const k = Math.min(n, Math.max(0, free));
            if (k > 0) {
                s.player.cargo[mat] = (s.player.cargo[mat] || 0) + k;
                events.push({ type: 'gain', mat, n: k });
            }
            if (n - k > 0) {
                this.addCache(s.player.q, s.player.r, { [mat]: n - k }, 0);
                events.push({ type: 'cache-drop', mat, n: n - k, q: s.player.q, r: s.player.r });
            }
        }

        addCache(q, r, cargo, credits) {
            const s = this.state;
            let cache = s.caches.find(c => c.q === q && c.r === r);
            if (!cache) {
                cache = { q, r, cargo: {}, credits: 0 };
                s.caches.push(cache);
            }
            for (const [mat, n] of Object.entries(cargo))
                cache.cargo[mat] = (cache.cargo[mat] || 0) + n;
            cache.credits += credits;
        }

        // Walking onto a cache auto-collects the credits and whatever cargo fits.
        collectCache(events) {
            const s = this.state;
            const i = s.caches.findIndex(c => c.q === s.player.q && c.r === s.player.r);
            if (i < 0) return;
            const cache = s.caches[i];
            const got = { credits: cache.credits, mats: {} };
            s.player.credits += cache.credits;
            cache.credits = 0;
            for (const [mat, n] of Object.entries(cache.cargo)) {
                const free = this.stats().cargo - cargoTotal(s.player.cargo);
                const k = Math.min(n, Math.max(0, free));
                if (k <= 0) continue;
                s.player.cargo[mat] = (s.player.cargo[mat] || 0) + k;
                cache.cargo[mat] -= k;
                if (cache.cargo[mat] <= 0) delete cache.cargo[mat];
                got.mats[mat] = k;
            }
            if (Object.keys(cache.cargo).length === 0) s.caches.splice(i, 1);
            if (got.credits > 0 || Object.keys(got.mats).length > 0)
                events.push({ type: 'cache-pickup', ...got });
        }

        // ---- Actions (mutate state, return { ok, events }; no rendering) ----

        movePlayer(q, r) {
            const s = this.state;
            const reachable = this.computeReachable();
            const cost = reachable.get(Hex.key(q, r));
            if (cost === undefined) return { ok: false };

            const events = [];
            s.player.q = q;
            s.player.r = r;
            if (s.player.mounted) { s.bike.q = q; s.bike.r = r; }
            s.mp -= cost;
            this.reveal();
            this.collectCache(events);
            return { ok: true, cost, location: this.locationAt(s.player), events };
        }

        // Mounting needs the bike underfoot; dismounting parks it here and caps the
        // rest of the turn at foot speed (no ride-out-then-sprint exploit).
        toggleMount() {
            const s = this.state;
            if (s.mp < MOUNT_COST) return { ok: false, reason: 'mp' };
            if (s.player.mounted) {
                // No dismounting over terrain feet can't stand on (acid flats).
                const hex = s.hexes.get(Hex.key(s.player.q, s.player.r));
                if ((FOOT_COST[hex.terrain] ?? Infinity) === Infinity)
                    return { ok: false, reason: 'terrain' };
                s.player.mounted = false;
                s.mp = Math.min(s.mp - MOUNT_COST, this.stats().footMp);
            } else {
                if (!s.bike || s.bike.q !== s.player.q || s.bike.r !== s.player.r)
                    return { ok: false, reason: 'nobike' };
                s.player.mounted = true;
                s.mp -= MOUNT_COST;
            }
            return { ok: true };
        }

        harvest() {
            const s = this.state;
            const hex = this.nodeAt(s.player);
            if (!hex || s.player.mounted || s.mp < HARVEST_COST) return { ok: false };
            const node = NODES[hex.terrain];
            const events = [];
            const amount = Math.min(hex.yield, this.stats().harvest);
            s.mp -= HARVEST_COST;
            this.gainCargo(node.mat, amount, events);
            hex.yield -= amount;
            if (hex.yield <= 0) {
                hex.terrain = node.base;
                hex.yield = null;
                events.push({ type: 'depleted' });
            }
            return { ok: true, events };
        }

        attack(q, r) {
            const s = this.state;
            if (s.player.mounted || s.mp < ATTACK_COST) return { ok: false };
            const target = { q, r };
            if (dist(target, s.player) > this.stats().range) return { ok: false };
            const events = [];
            const atk = this.stats().atk;

            const bi = s.bandits.findIndex(b => b.q === q && b.r === r);
            if (bi >= 0) {
                const b = s.bandits[bi];
                b.hp -= atk;
                if (b.hp <= 0) {
                    s.bandits.splice(bi, 1);
                    if (b.loot > 0) {
                        s.player.credits += b.loot;
                        events.push({ type: 'loot-recovered', n: b.loot });
                    }
                    events.push({ type: 'bandit-killed', gang: b.gang });
                    this.gainCargo('tag', 1, events);
                } else {
                    events.push({ type: 'hit-bandit', gang: b.gang, hp: b.hp });
                }
                s.mp -= ATTACK_COST;
                return { ok: true, events };
            }

            const pi = s.predators.findIndex(p => p.q === q && p.r === r);
            if (pi >= 0) {
                const p = s.predators[pi];
                const K = PREDATOR_KINDS[p.kind];
                p.hp -= atk;
                if (p.hp <= 0) {
                    s.predators.splice(pi, 1);
                    events.push({ type: 'pred-killed', kind: p.kind });
                    for (const [mat, n] of Object.entries(K.drops))
                        this.gainCargo(mat, n, events);
                } else {
                    events.push({ type: 'hit-pred', kind: p.kind, hp: p.hp });
                }
                s.mp -= ATTACK_COST;
                return { ok: true, events };
            }
            return { ok: false };
        }

        // Razing a camp: on foot, on the hex, no gang member within 4. Pays the bank.
        raidCamp() {
            const s = this.state;
            const camp = this.campAt(s.player);
            if (!camp) return { ok: false };
            if (s.player.mounted) return { ok: false, reason: 'mounted' };
            const guards = s.bandits.filter(b => b.gang === camp.gang && dist(b, camp) <= 4);
            if (guards.length > 0) return { ok: false, reason: 'guards', n: guards.length };
            const events = [];
            s.player.credits += camp.bank;
            events.push({ type: 'camp-razed', gang: camp.gang, bank: camp.bank, broadcast: true });
            this.gainCargo('tag', 2, events);
            s.camps.splice(s.camps.indexOf(camp), 1);
            s.campsRazed++;
            return { ok: true, events };
        }

        // ---- Market / workshop (free actions at a location) ----

        price(mat, loc) {
            const base = MATERIALS[mat].price;
            if (loc.kind === 'starport') return base;
            const demand = loc.demand[mat] ?? 1;
            const wealthF = 0.5 + loc.wealth / 200;
            return Math.max(1, Math.round(base * demand * wealthF));
        }

        sell(mat, n) {
            const s = this.state;
            const loc = this.locationAt(s.player);
            if (!loc) return { ok: false };
            const have = s.player.cargo[mat] || 0;
            const k = Math.min(n, have);
            if (k <= 0) return { ok: false };
            const paid = k * this.price(mat, loc);
            s.player.credits += paid;
            s.player.cargo[mat] -= k;
            if (s.player.cargo[mat] <= 0) delete s.player.cargo[mat];
            return { ok: true, events: [{ type: 'sell', mat, n: k, credits: paid, loc: loc.name }] };
        }

        canCraft(u) {
            const s = this.state;
            const loc = this.locationAt(s.player);
            if (!loc || loc.kind !== 'starport') return false;
            if (s.upgrades.includes(u.id)) return false;
            if (u.requires && !s.upgrades.includes(u.requires)) return false;
            if (s.player.credits < u.credits) return false;
            for (const [mat, n] of Object.entries(u.mats))
                if ((s.player.cargo[mat] || 0) < n) return false;
            return true;
        }

        craft(id) {
            const s = this.state;
            const u = UPGRADE_BY_ID[id];
            if (!u || !this.canCraft(u)) return { ok: false };
            s.player.credits -= u.credits;
            for (const [mat, n] of Object.entries(u.mats)) {
                s.player.cargo[mat] -= n;
                if (s.player.cargo[mat] <= 0) delete s.player.cargo[mat];
            }
            s.upgrades.push(id);
            // Plating installs onto the current bike immediately.
            if (u.effects.bikeHp && s.bike) s.bike.hp += u.effects.bikeHp;
            return { ok: true, events: [{ type: 'craft', name: u.name }] };
        }

        buyBike() {
            const s = this.state;
            const loc = this.locationAt(s.player);
            if (!loc || loc.kind !== 'starport') return { ok: false };
            if (s.bike || s.player.credits < ECON.BIKE) return { ok: false };
            s.player.credits -= ECON.BIKE;
            s.bike = { q: s.player.q, r: s.player.r, hp: this.stats().bikeMaxHp };
            return { ok: true, events: [{ type: 'buy-bike' }] };
        }

        repairBike() {
            const s = this.state;
            const loc = this.locationAt(s.player);
            if (!loc || !s.bike) return { ok: false };
            if (s.bike.q !== s.player.q || s.bike.r !== s.player.r) return { ok: false };
            const missing = this.stats().bikeMaxHp - s.bike.hp;
            const k = Math.min(missing, Math.floor(s.player.credits / ECON.REPAIR_PER_HP));
            if (k <= 0) return { ok: false };
            s.player.credits -= k * ECON.REPAIR_PER_HP;
            s.bike.hp += k;
            return { ok: true, events: [{ type: 'repair', n: k, credits: k * ECON.REPAIR_PER_HP }] };
        }

        buyTicket() {
            const s = this.state;
            const loc = this.locationAt(s.player);
            if (!loc || loc.kind !== 'starport') return { ok: false };
            if (s.gameWon || s.player.credits < ECON.TICKET) return { ok: false };
            s.player.credits -= ECON.TICKET;
            s.gameWon = true;
            return { ok: true, events: [{ type: 'ticket', broadcast: true }] };
        }

        // ---- End of day: the world phase ----
        endTurn() {
            const s = this.state;
            const events = [];
            s.phase = 'world';
            this.banditPhase(events);
            this.predatorPhase(events);
            this.spawnPhase(events);
            this.marketPhase(events);
            s.day++;
            if (this.locationAt(s.player) && s.player.hp < this.stats().maxHp) {
                s.player.hp = this.stats().maxHp;
                events.push({ type: 'rest' });
            }
            s.phase = 'player';
            s.mp = s.player.mounted ? this.stats().bikeMp : this.stats().footMp;
            return events;
        }

        // Everything else standing on the board, minus the moving actor.
        occupiedExcept(actor) {
            const s = this.state;
            const occ = new Set([Hex.key(s.player.q, s.player.r)]);
            for (const b of s.bandits) if (b !== actor) occ.add(Hex.key(b.q, b.r));
            for (const p of s.predators) if (p !== actor) occ.add(Hex.key(p.q, p.r));
            return occ;
        }

        // A* to the destination (global vision), then walk the path within the MP
        // budget. stopAdjacent leaves the last hex to the target itself.
        stepNpc(actor, dest, budget, stopAdjacent, costFn, occupied) {
            const s = this.state;
            const destKey = Hex.key(dest.q, dest.r);
            const isPassable = (q, r) => {
                const key = Hex.key(q, r);
                const hex = s.hexes.get(key);
                if (!hex) return false;
                if (key === destKey) return true;
                if ((costFn(hex)) === Infinity) return false;
                if (occupied.has(key)) return false;
                return true;
            };
            const moveCost = (q, r) => costFn(s.hexes.get(Hex.key(q, r)));
            const path = findPath(actor, dest, isPassable, moveCost, 300);
            if (!path || path.length < 2) return;
            let spent = 0;
            for (let i = 1; i < path.length; i++) {
                const step = path[i];
                const key = step.key();
                if (stopAdjacent && key === destKey) break;
                if (occupied.has(key)) break;
                const c = costFn(s.hexes.get(key));
                if (spent + c > budget) break;
                actor.q = step.q;
                actor.r = step.r;
                spent += c;
            }
        }

        banditPhase(events) {
            const s = this.state;
            const foot = h => FOOT_COST[h.terrain] ?? Infinity;
            for (const b of [...s.bandits]) {
                if (!s.bandits.includes(b)) continue;   // eaten mid-phase (safety)
                const occupied = this.occupiedExcept(b);

                // A full-bagged (or any nearby) player is the better prize.
                if (dist(b, s.player) <= BANDIT.aggro) {
                    if (dist(b, s.player) > 1)
                        this.stepNpc(b, s.player, BANDIT.speed, true, foot, occupied);
                    if (dist(b, s.player) <= 1) {
                        s.player.hp -= BANDIT.atk;
                        events.push({ type: 'player-hit', by: 'bandit', gang: b.gang, q: b.q, r: b.r });
                        this.deathCheck(events);
                    }
                    continue;
                }

                // Carrying stolen wealth: walk it home and bank it.
                if (b.loot > 0) {
                    const home = s.camps.find(c => c.gang === b.gang);
                    if (!home) { b.loot = 0; continue; }
                    if (b.q === home.q && b.r === home.r) {
                        home.bank += b.loot;
                        events.push({ type: 'banked', gang: b.gang, n: b.loot, q: b.q, r: b.r });
                        b.loot = 0;
                    } else {
                        this.stepNpc(b, home, BANDIT.speed, false, foot, occupied);
                    }
                    continue;
                }

                // Otherwise: walk to the target settlement and steal.
                let t = b.target && s.settlements.find(l => l.q === b.target.q && l.r === b.target.r);
                if (!t) {
                    t = this.nearestSettlement(b);
                    if (!t) continue;
                    b.target = { q: t.q, r: t.r };
                }
                if (b.q === t.q && b.r === t.r) {
                    const take = Math.min(BANDIT.steal, t.wealth);
                    t.wealth -= take;
                    b.loot = take;
                    events.push({ type: 'raided', gang: b.gang, loc: t.name, broadcast: true });
                } else {
                    this.stepNpc(b, t, BANDIT.speed, false, foot, occupied);
                }
            }
        }

        predatorPhase(events) {
            const s = this.state;
            for (const p of [...s.predators]) {
                if (!s.predators.includes(p)) continue;
                const K = PREDATOR_KINDS[p.kind];
                const fence = this.fence();
                const pcost = h => {
                    if (fence.has(Hex.key(h.q, h.r))) return Infinity;   // sonic fences
                    if (h.terrain === T.ACID) return K.crossesAcid ? 1 : Infinity;
                    return FOOT_COST[h.terrain] ?? Infinity;
                };

                // Scent: nearest of player / parked bike / any bandit, each with its
                // own radius. Nothing scented -> wander.
                const cands = [];
                const pl = s.player;
                const scentPlayer = pl.mounted ? K.scentMounted : this.stats().scentFoot;
                if (!this.inFence(pl) && dist(p, pl) <= scentPlayer)
                    cands.push({ d: dist(p, pl), type: 'player', pos: pl });
                if (s.bike && !pl.mounted && K.scentBike > 0 &&
                    !this.inFence(s.bike) && dist(p, s.bike) <= K.scentBike)
                    cands.push({ d: dist(p, s.bike), type: 'bike', pos: s.bike });
                for (const b of s.bandits)
                    if (dist(p, b) <= K.scentBandit)
                        cands.push({ d: dist(p, b), type: 'bandit', pos: b, ref: b });

                if (cands.length === 0) { this.wander(p, pcost); continue; }
                cands.sort((a, b) => a.d - b.d);
                const tgt = cands[0];
                if (dist(p, tgt.pos) > 1)
                    this.stepNpc(p, tgt.pos, K.speed, true, pcost, this.occupiedExcept(p));
                if (dist(p, tgt.pos) <= 1) this.predatorStrike(p, K, tgt, events);
            }
        }

        predatorStrike(p, K, tgt, events) {
            const s = this.state;
            if (tgt.type === 'player' && s.player.mounted && s.bike) {
                // Mounted: the bike takes the hit. A Gravemaw swallows it whole.
                s.bike.hp -= K.eatsBikes ? 999 : K.atk;
                if (s.bike.hp <= 0) {
                    s.bike = null;
                    s.player.mounted = false;
                    events.push({ type: 'bike-eaten', kind: p.kind, q: s.player.q, r: s.player.r, broadcast: true });
                } else {
                    events.push({ type: 'bike-hit', kind: p.kind, hp: s.bike.hp, q: s.player.q, r: s.player.r });
                }
            } else if (tgt.type === 'player') {
                s.player.hp -= K.atk;
                events.push({ type: 'player-hit', by: p.kind, q: p.q, r: p.r });
                this.deathCheck(events);
            } else if (tgt.type === 'bike') {
                s.bike.hp -= K.eatsBikes ? 999 : K.atk;
                if (s.bike.hp <= 0) {
                    events.push({ type: 'bike-eaten', kind: p.kind, q: s.bike.q, r: s.bike.r, broadcast: true });
                    s.bike = null;
                } else {
                    events.push({ type: 'bike-hit', kind: p.kind, hp: s.bike.hp, q: s.bike.q, r: s.bike.r });
                }
            } else {
                const b = tgt.ref;
                b.hp -= K.atk;
                if (b.hp <= 0) {
                    s.bandits.splice(s.bandits.indexOf(b), 1);
                    this.addCache(b.q, b.r, { tag: 1 }, b.loot);
                    events.push({ type: 'pred-ate-bandit', kind: p.kind, gang: b.gang, q: b.q, r: b.r });
                }
            }
        }

        wander(p, pcost) {
            const valid = new Hex(p.q, p.r).neighbors().filter(n => {
                const hex = this.state.hexes.get(n.key());
                if (!hex || pcost(hex) === Infinity) return false;
                if (this.occupiedExcept(p).has(n.key())) return false;
                return true;
            });
            if (valid.length > 0 && Rando.bool(0.6)) {
                const dest = Rando.choice(valid);
                p.q = dest.q;
                p.r = dest.r;
            }
        }

        // Death is a corpse run: cargo + half your credits drop where you fell; you wake
        // at the starport. A parked (or just-ridden) bike stays behind on that hex.
        deathCheck(events) {
            const s = this.state;
            if (s.player.hp > 0) return;
            const lost = Math.floor(s.player.credits / 2);
            if (lost > 0 || cargoTotal(s.player.cargo) > 0)
                this.addCache(s.player.q, s.player.r, { ...s.player.cargo }, lost);
            s.player.credits -= lost;
            s.player.cargo = {};
            s.player.mounted = false;
            const sp = s.settlements[0];
            s.player.q = sp.q;
            s.player.r = sp.r;
            s.player.hp = this.stats().maxHp;
            this.reveal();
            events.push({ type: 'death', broadcast: true });
        }

        spawnPhase(events) {
            const s = this.state;
            const sp = s.settlements[0];

            // Camps muster raiders.
            for (const camp of s.camps) {
                const alive = s.bandits.filter(b => b.gang === camp.gang).length;
                if (alive >= BANDIT.maxPerCamp || !Rando.bool(BANDIT.spawnChance)) continue;
                const t = this.nearestSettlement(camp);
                if (!t) continue;
                s.bandits.push({
                    q: camp.q, r: camp.r, hp: BANDIT.hp, gang: camp.gang,
                    loot: 0, target: { q: t.q, r: t.r }
                });
            }

            // A new gang moves into the waste now and then; razed camps make the next
            // ones richer.
            if (s.camps.length < WORLD.CAMP_MAX && Rando.bool(WORLD.CAMP_FOUND_CHANCE)) {
                const used = new Set(s.camps.map(c => c.gang));
                const gang = Rando.choice(NAMES.GANGS.filter(g => !used.has(g)));
                const spot = this.pickFringeHex();
                if (gang && spot) {
                    s.camps.push({
                        q: spot.q, r: spot.r, gang,
                        bank: ECON.CAMP_BANK + s.campsRazed * ECON.CAMP_BANK_ESCALATION
                    });
                    events.push({ type: 'camp-new', gang, broadcast: true });
                }
            }

            // Predators drift in from the deep waste — no announcement.
            if (s.predators.length < WORLD.PRED_MAX && Rando.bool(WORLD.PRED_SPAWN))
                this.spawnPredator(WORLD.FRINGE);

            // New nodes bloom; geode blooms are rumored with a bearing.
            const nodeCount = [...s.hexes.values()].filter(h => NODES[h.terrain]).length;
            if (nodeCount < WORLD.NODE_MAX && Rando.bool(WORLD.BLOOM_CHANCE)) {
                const plan = Rando.weighted(NODE_PLAN.map(p => ({ item: p, weight: p.weight })));
                const node = NODES[plan.terrain];
                const minDist = plan.terrain === T.GEODE ? GEODE_MIN_DIST : 0;
                const locKeys = this.locationKeys();
                const cands = [];
                for (const key of this.region().keys()) {
                    const hex = s.hexes.get(key);
                    if (hex.terrain !== node.base || locKeys.has(key)) continue;
                    if (dist(hex, sp) < minDist) continue;
                    cands.push(hex);
                }
                const hex = Rando.choice(cands);
                if (hex) {
                    this.makeNode(hex, plan.terrain);
                    if (plan.terrain === T.GEODE)
                        events.push({ type: 'geode-rumor', q: hex.q, r: hex.r, broadcast: true });
                }
            }
        }

        pickFringeHex() {
            const s = this.state;
            const sp = s.settlements[0];
            const cands = [];
            for (const key of this.region().keys()) {
                const hex = s.hexes.get(key);
                if (dist(hex, sp) < WORLD.FRINGE) continue;
                if (s.settlements.some(l => dist(l, hex) < WORLD.LOC_SEP)) continue;
                if (s.camps.some(c => dist(c, hex) < WORLD.LOC_SEP)) continue;
                cands.push(hex);
            }
            return Rando.choice(cands);
        }

        marketPhase() {
            const s = this.state;
            for (const loc of s.settlements) {
                if (loc.kind === 'starport') continue;
                loc.wealth = Math.min(ECON.WEALTH_MAX, loc.wealth + 1);
            }
            if (Rando.bool(ECON.DRIFT_CHANCE)) {
                const locs = s.settlements.filter(l => l.kind !== 'starport');
                const loc = Rando.choice(locs);
                const mat = Rando.choice(Object.keys(MATERIALS));
                if (loc) loc.demand[mat] =
                    Math.round(Rando.float(ECON.DEMAND_MIN, ECON.DEMAND_MAX) * 100) / 100;
            }
        }
    }

    return GameEngine;
})();
