// gameengine.js — GameEngine
//
// All rules and world generation for RADIO FREE SECTOR 9, operating on a GameState.
// DOM-free and render-free: commands mutate state and *return outcomes plus events*; the
// caller (GameUI today, a network handler tomorrow) decides what to animate or broadcast.
//
// The turn: player (move / plant / retrieve) → broadcast (the Wake, ONTOLOGY "Broadcast")
// → regime (Sweepers hunt, sedate, and the Alert spawns more). Rule names in comments match
// ONTOLOGY.md's rule headings; criteria IDs (R-n) are cited where a rule is tested.
//
// Server-readiness: all randomness routes through the seeded Rando, so a game reproduces
// from state.seed and the command sequence; every command re-derives its own legality.
const GameEngine = (function () {
    const {
        TERRAIN, PLAYER_MP, PLANT_MP, RIG_NAMES, MAP_COLS, MAP_ROWS,
        TX_RANGE, TX_RANGE_MAX, WAKE_THRESHOLD, FADE_THRESHOLD, WIN_FRAC,
        JAM_RADIUS, AWAKE_DRAG, SWEEPER_SIGHT, BASE_SWEEPERS, AWAKE_PER_SWEEPER,
        SPAWN_PER_TURN, RECALL_PER_TURN, MAX_SWEEPERS, SWEEPER_KINDS,
        GEN_MAX_ATTEMPTS, KNOWN_GOOD_SEED, HEIGHTMAP_SIZE, HEIGHTMAP_ROUGHNESS, DENSITY_ROUGHNESS, DENSITY_JITTER,
        CANAL_PCT, ARCOLOGY_PCT, BLOCK_FRAC, INDUSTRIAL_FRAC, RUINS_FRAC,
        PLACE_SLICE_FRAC, PLACE_SLICE_MIN, PRECINCT_COUNT, PRECINCT_MIN_COL_FRAC, STATION_SPACING
    } = GameArtifacts;

    const dist = (a, b) => new Hex(a.q, a.r).distance(b);

    // The key in `keys` with the lowest plan cost, or null if none is reachable.
    const nearest = (keys, cost) => {
        let best = null, bestCost = Infinity;
        for (const k of keys) {
            const c = cost.get(k);
            if (c !== undefined && c < bestCost) { best = k; bestCost = c; }
        }
        return best;
    };

    // Target choice: a Sweeper that finds none of its preferred prey tries the other kind.
    const OTHER_PREY = { rig: 'frontier', frontier: 'rig' };

    // Is a committed target still worth chasing? (engine, Sweeper, target q, r) → bool.
    const TARGET_STILL_VALID = {
        player: (e, sw, q, r) => e.sees(sw) && e.state.player.isAt(q, r),
        rig: (e, sw, q, r) => !!e.rigAt(q, r),
        frontier: (e, sw, q, r) => e.isFrontier(e.board.get(q, r)),
        patrol: (e, sw, q, r) => !sw.isAt(q, r),   // until reached
    };

    class GameEngine {
        constructor(state) {
            this.state = state;
        }

        // ---- Occupancy helpers ----

        sweeperKeys() {
            return new Set(this.state.sweepers.map(s => s.key()));
        }

        stationKeys() {
            return new Set(this.state.stations.map(s => s.key()));
        }

        plantedRigs() {
            return this.state.rigs.filter(r => r.status === 'planted');
        }

        carriedRigs() {
            return this.state.rigs.filter(r => r.status === 'carried');
        }

        rigAt(q, r) {
            return this.plantedRigs().find(rig => rig.isAt(q, r)) || null;
        }

        isOver() {
            return this.state.outcome !== null;
        }

        // ---- Wake bookkeeping ----

        awakeCount() {
            let n = 0;
            for (const [, hex] of this.state.hexes) if (hex.awake) n++;
            return n;
        }

        blockCount() {
            return this.board.blocks().length;
        }

        // Awake blocks needed to win: ceil(WIN_FRAC × blocks).
        winTarget() {
            return Math.ceil(WIN_FRAC * this.blockCount());
        }

        // Keys of every hex within JAM_RADIUS of a Sweeper.
        jammedKeys() {
            const out = new Set();
            for (const s of this.state.sweepers)
                for (const h of this.board.within(s.q, s.r, JAM_RADIUS)) out.add(Hex.key(h.q, h.r));
            return out;
        }

        // Alert quota: how many Sweepers the Ministry wants on the street right now.
        alertQuota() {
            return Math.min(MAX_SWEEPERS, BASE_SWEEPERS + Math.floor(this.awakeCount() / AWAKE_PER_SWEEPER));
        }

        // ---- New game / world generation ----

        // The caller picks the seed (the UI rolls one); the engine never reads Math.random.
        newGame(seed) {
            const s = this.state;
            s.seed = seed >>> 0;
            if (!this.generateMap(s.seed, GEN_MAX_ATTEMPTS)) {
                s.seed = KNOWN_GOOD_SEED;
                this.generateMap(s.seed, 1);
            }
            s.rigs = RIG_NAMES.map((name, i) => new Rig(i, name));
            s.sweepers = [];
            s.nextSweeperId = 1;
            s.turn = 1;
            s.mp = PLAYER_MP;
            s.phase = 'player';
            s.outcome = null;
            this.spawnSweepers(Infinity, []);   // the opening patrol, not animated
            return { ok: true };
        }

        // Seed Rando and build up to `attempts` maps, stopping at the first valid one: all
        // stations placed and a path from @ to the Ministry. The last map is kept either way.
        generateMap(seed, attempts) {
            const s = this.state;
            Rando.seed(seed);
            for (let i = 0; i < attempts; i++) {
                s.hexes = this.generateRectGrid();
                this.board = new Board(s.hexes);
                this.assignTerrain();
                const placed = this.placePlayerAndStations();
                if (placed && this.board.hasPath(s.player, s.stations[0])) return true;
            }
            return false;
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
        // flagged. Elevation and density sampled from two fresh heightmaps (generation-only);
        // density gets DENSITY_JITTER of per-hex noise so neighborhoods have ragged, gappy edges.
        generateRectGrid() {
            const hexes = new Map();
            const elev = this.diamondSquare(HEIGHTMAP_SIZE, HEIGHTMAP_ROUGHNESS);
            const dens = this.diamondSquare(HEIGHTMAP_SIZE, DENSITY_ROUGHNESS);
            const last = HEIGHTMAP_SIZE - 1;

            for (let row = 0; row < MAP_ROWS; row++) {
                const qOffset = -Math.floor(row / 2);
                for (let col = 0; col < MAP_COLS; col++) {
                    const q = col + qOffset;
                    const r = row;
                    const gx = Math.round(col / (MAP_COLS - 1) * last);
                    const gy = Math.round(row / (MAP_ROWS - 1) * last);
                    const i = gy * HEIGHTMAP_SIZE + gx;
                    const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;
                    hexes.set(Hex.key(q, r), {
                        q, r, col, row, elevation: elev[i], density: dens[i] + Rando.random() * DENSITY_JITTER,
                        isEdge, terrain: null, awake: false
                    });
                }
            }
            return hexes;
        }

        // Edges → canal; elevation bands → canal / open / arcology; the densest open hexes
        // → blocks; the rest of the open ground split into industrial, ruins, plaza.
        assignTerrain() {
            const inner = [];
            for (const [, hex] of this.state.hexes) {
                if (hex.isEdge) { hex.terrain = TERRAIN.CANAL; continue; }
                inner.push(hex);
            }
            inner.sort((a, b) => a.elevation - b.elevation);
            const n = inner.length;
            const open = [];
            for (let i = 0; i < n; i++) {
                const pct = i / n;
                if (pct < CANAL_PCT) inner[i].terrain = TERRAIN.CANAL;
                else if (pct >= ARCOLOGY_PCT) inner[i].terrain = TERRAIN.ARCOLOGY;
                else open.push(inner[i]);
            }

            open.sort((a, b) => b.density - a.density);
            const blockCount = Math.round(open.length * BLOCK_FRAC);
            for (let i = 0; i < blockCount; i++) open[i].terrain = TERRAIN.BLOCK;

            const rest = open.slice(blockCount);
            Rando.shuffle(rest);
            const indCount = Math.round(rest.length * INDUSTRIAL_FRAC);
            const ruinCount = Math.round(rest.length * RUINS_FRAC);
            rest.forEach((hex, i) => {
                hex.terrain = i < indCount ? TERRAIN.INDUSTRIAL
                    : i < indCount + ruinCount ? TERRAIN.RUINS
                    : TERRAIN.PLAZA;
            });
        }

        // @ on the far-left passable slice, the Ministry on the far-right; PRECINCT_COUNT
        // precincts in the right part of the city, STATION_SPACING apart. Stations stand only
        // on non-block hexes so they never wake. Returns false if a station can't be placed.
        placePlayerAndStations() {
            const s = this.state;
            const passable = this.board.passableHexes();
            passable.sort((a, b) => a.col - b.col);
            const sliceLen = Math.max(PLACE_SLICE_MIN, Math.floor(passable.length * PLACE_SLICE_FRAC));

            const ph = Rando.choice(passable.slice(0, sliceLen));
            s.player = new Piece(ph.q, ph.r, null, '@');

            const right = passable.slice(-sliceLen).filter(h => !this.board.isBlock(h));
            if (right.length === 0) return false;
            const mh = Rando.choice(right);
            s.stations = [new Piece(mh.q, mh.r, null, 'M')];

            const minCol = Math.floor(PRECINCT_MIN_COL_FRAC * MAP_COLS);
            const candidates = passable.filter(h => h.col >= minCol && !this.board.isBlock(h));
            Rando.shuffle(candidates);
            for (const h of candidates) {
                if (s.stations.length > PRECINCT_COUNT) break;
                if (s.stations.every(st => dist(st, h) >= STATION_SPACING))
                    s.stations.push(new Piece(h.q, h.r, null, 'P'));
            }
            return s.stations.length === PRECINCT_COUNT + 1;
        }

        // ---- Player-side queries (the preview *is* the rule) ----

        // Hexes @ can reach this turn: terrain cost only (awake blocks are open road for
        // the operator); Sweeper and station hexes are walls.
        computeReachable() {
            const s = this.state;
            if (s.mp <= 0 || this.isOver()) return new Map();
            const blocked = this.sweeperKeys();
            for (const k of this.stationKeys()) blocked.add(k);
            const costs = bfsHexes(s.player, s.hexes, hex => {
                if (blocked.has(Hex.key(hex.q, hex.r))) return Infinity;
                return this.board.moveCost(hex);
            }, s.mp);
            costs.delete(s.player.key());
            return costs;
        }

        // A planted rig's broadcast range: TX_RANGE, +1 per unjammed broadcast, capped.
        rigRange(rig) {
            return Math.min(TX_RANGE + rig.airtime, TX_RANGE_MAX);
        }

        // Sleeping, unjammed blocks a live rig at (q, r) with `range` would wake at the next
        // broadcast, given the jammed keys `jam`. The broadcast rule calls this same function.
        rigWakeSet(q, r, jam, range) {
            const out = [];
            if (jam.has(Hex.key(q, r))) return out;   // a jammed rig is silent
            for (const h of this.board.within(q, r, range)) {
                if (!this.board.isBlock(h) || h.awake) continue;
                if (jam.has(Hex.key(h.q, h.r))) continue;
                out.push(h);
            }
            return out;
        }

        canPlant() {
            const s = this.state;
            return !this.isOver() && s.phase === 'player' && s.mp >= PLANT_MP &&
                this.carriedRigs().length > 0 && !this.rigAt(s.player.q, s.player.r);
        }

        canRetrieve() {
            const s = this.state;
            return !this.isOver() && s.phase === 'player' && s.mp >= PLANT_MP &&
                !!this.rigAt(s.player.q, s.player.r);
        }

        // Does Sweeper `sw` see @? Within SWEEPER_SIGHT, and @ not sheltered on an awake block.
        sees(sw) {
            const p = this.state.player;
            const here = this.board.get(p.q, p.r);
            return dist(sw, p) <= SWEEPER_SIGHT && !(here && here.awake);
        }

        // L3 / L2.1 extension points, inert: no attacks, no interactive locations.
        computeAttackable() {
            return new Set();
        }

        locationAt(/* p */) {
            return null;
        }

        // ---- Commands (mutate state, return { ok, ... }; ok:false = illegal, no change) ----

        movePlayer(q, r) {
            const s = this.state;
            if (this.isOver()) return { ok: false };
            const cost = this.computeReachable().get(Hex.key(q, r));
            if (cost === undefined) return { ok: false };
            s.player.moveTo(q, r);
            s.mp -= cost;
            return this.afterSpend({ ok: true });
        }

        // Plant the first carried rig (roster order) on @'s hex.
        plant() {
            if (!this.canPlant()) return { ok: false };
            const s = this.state;
            const rig = this.carriedRigs()[0];
            rig.moveTo(s.player.q, s.player.r);
            rig.status = 'planted';
            rig.airtime = 0;
            s.mp -= PLANT_MP;
            return this.afterSpend({ ok: true, rig: rig.id });
        }

        retrieve() {
            if (!this.canRetrieve()) return { ok: false };
            const s = this.state;
            const rig = this.rigAt(s.player.q, s.player.r);
            rig.moveTo(null, null);
            rig.status = 'carried';
            rig.airtime = 0;
            s.mp -= PLANT_MP;
            return this.afterSpend({ ok: true, rig: rig.id });
        }

        // L1.4: spending the last MP ends the turn; the result carries endTurn's outcome.
        afterSpend(res) {
            if (this.state.mp > 0) return res;
            const end = this.endTurn();
            return { ...res, endedTurn: true, events: end.events, outcome: end.outcome };
        }

        // Broadcast, then (unless won) the regime phase, then the next player turn.
        endTurn() {
            const s = this.state;
            if (this.isOver()) return { ok: false };
            const events = [];
            s.phase = 'broadcast';
            this.broadcast(events);
            if (!this.isOver()) {
                s.phase = 'regime';
                this.regime(events);
            }
            s.phase = 'player';
            if (!this.isOver()) {
                s.turn++;
                s.mp = PLAYER_MP;
            }
            return { ok: true, events, outcome: s.outcome };
        }

        // ---- Broadcast: the Wake, fading, rig growth, and the win check ----
        // What the next broadcast would do, decided from the current state (synchronous).
        // `without` leaves one planted rig out (the UI's "if I pull this rig" preview), or is
        // null. The broadcast applies exactly this plan.
        planBroadcast(without) {
            const jam = this.jammedKeys();
            const live = this.plantedRigs().filter(rig => rig !== without && !jam.has(rig.key()));
            const held = new Set();   // blocks inside a live rig's range never fade
            const wake = new Map(), fade = new Map();
            for (const rig of live) {
                const range = this.rigRange(rig);
                for (const h of this.board.within(rig.q, rig.r, range)) held.add(Hex.key(h.q, h.r));
                for (const h of this.rigWakeSet(rig.q, rig.r, jam, range)) wake.set(Hex.key(h.q, h.r), h);
            }
            for (const hex of this.board.blocks()) {
                const key = Hex.key(hex.q, hex.r);
                const awakeNbrs = this.board.neighbors(hex.q, hex.r).filter(n => n.awake).length;
                if (hex.awake) {
                    if (!held.has(key) && awakeNbrs < FADE_THRESHOLD) fade.set(key, hex);
                } else if (!jam.has(key) && !wake.has(key) && awakeNbrs >= WAKE_THRESHOLD) {
                    wake.set(key, hex);
                }
            }
            return { wake, fade, live };
        }

        broadcast(events) {
            const { wake, fade, live } = this.planBroadcast(null);
            for (const hex of wake.values()) hex.awake = true;
            for (const hex of fade.values()) hex.awake = false;
            for (const rig of live) rig.airtime++;
            if (wake.size > 0) events.push({ type: 'woke', keys: [...wake.keys()] });
            if (fade.size > 0) events.push({ type: 'faded', keys: [...fade.keys()] });
            if (this.awakeCount() >= this.winTarget()) {
                this.state.outcome = 'won';
                events.push({ type: 'won' });
            }
        }

        // ---- Regime: hunt, sedate, alert ----
        regime(events) {
            const s = this.state;
            for (const sw of s.sweepers) {
                this.walkSweeper(sw, events);
                if (this.isOver()) return;
            }
            this.sedate(events);
            if (s.rigs.every(r => r.status === 'smashed')) {
                s.outcome = 'deadair';
                events.push({ type: 'deadair' });
                return;
            }
            this.recallSweepers(events);
            this.spawnSweepers(SPAWN_PER_TURN, events);
        }

        // The Alert stands down too (R-25): over quota, up to RECALL_PER_TURN Sweepers leave
        // the street — the latest-spawned first, never one that is chasing @.
        recallSweepers(events) {
            const s = this.state;
            let excess = Math.min(RECALL_PER_TURN, s.sweepers.length - this.alertQuota());
            for (let i = s.sweepers.length - 1; i >= 0 && excess > 0; i--) {
                const sw = s.sweepers[i];
                if (sw.target && sw.target.kind === 'player') continue;
                s.sweepers.splice(i, 1);
                events.push({ type: 'recalled', id: sw.id });
                excess--;
            }
        }

        // A Sweeper's plan cost: terrain + AWAKE_DRAG on awake blocks; stations and other
        // Sweepers are walls. @'s hex is ordinary ground — they don't know you're there.
        sweeperCostFn(sw) {
            const walls = this.stationKeys();
            for (const o of this.state.sweepers) if (o !== sw) walls.add(o.key());
            return hex => {
                if (walls.has(Hex.key(hex.q, hex.r))) return Infinity;
                return this.board.moveCost(hex) + (hex.awake ? AWAKE_DRAG : 0);
            };
        }

        // The edge of the unrest: a sleeping block with at least one awake neighbor. Where
        // Wardens go to choke the Wake's spread.
        isFrontier(hex) {
            return !!hex && this.board.isBlock(hex) && !hex.awake &&
                this.board.neighbors(hex.q, hex.r).some(n => n.awake);
        }

        // Is the Sweeper's committed target still worth chasing? One test per target kind.
        targetValid(sw) {
            const t = sw.target;
            if (!t) return false;
            const { q, r } = Hex.fromKey(t.key);
            return TARGET_STILL_VALID[t.kind](this, sw, q, r);
        }

        // Target choice (R-18): a seen @ overrides everything; otherwise keep a valid
        // commitment; otherwise the nearest (by plan cost) of its preferred kind — 'frontier'
        // (Wardens) or 'rig' (Hounds, Hunters) — then the other kind; otherwise patrol to a
        // random reachable hex.
        pickTarget(sw, plan) {
            const s = this.state;
            if (this.sees(sw)) { sw.target = { kind: 'player', key: s.player.key() }; return; }
            if (this.targetValid(sw) && plan.cost.has(sw.target.key)) return;
            const rigKeys = this.plantedRigs().map(r => r.key());
            const frontKeys = this.board.blocks().filter(h => this.isFrontier(h)).map(h => Hex.key(h.q, h.r));
            const keysOf = { rig: rigKeys, frontier: frontKeys };
            for (const kind of [sw.prefers, OTHER_PREY[sw.prefers]]) {
                const best = nearest(keysOf[kind], plan.cost);
                if (best) { sw.target = { kind, key: best }; return; }
            }
            const spots = [...plan.cost.keys()].filter(k => k !== sw.key()).sort();
            sw.target = spots.length ? { kind: 'patrol', key: Rando.choice(spots) } : null;
        }

        // Plan over the whole map (global vision), then walk the path within the Sweeper's
        // MP. Entering @ captures; entering a planted rig smashes it and ends the walk.
        walkSweeper(sw, events) {
            const s = this.state;
            const costFn = this.sweeperCostFn(sw);
            const plan = dijkstraHexes(sw, s.hexes, costFn);
            this.pickTarget(sw, plan);
            if (!sw.target) return;
            const path = pathFromPrev(plan.prev, sw.key(), sw.target.key);
            if (!path) return;
            const walked = [sw.key()];
            const after = [];   // what the walk ran into, reported after its 'moved'
            let mp = sw.mp;
            for (let i = 1; i < path.length && after.length === 0; i++) {
                const hex = s.hexes.get(path[i]);
                const step = costFn(hex);
                if (step > mp) break;
                mp -= step;
                sw.moveTo(hex.q, hex.r);
                walked.push(path[i]);
                after.push(...this.enterHex(sw, hex));
            }
            if (walked.length > 1) events.push({ type: 'moved', id: sw.id, path: walked });
            events.push(...after);
        }

        // A Sweeper steps onto `hex`: @ there is captured, a planted rig there is smashed.
        // Returns the resulting events; an empty list means the walk goes on.
        enterHex(sw, hex) {
            const s = this.state;
            if (s.player.isAt(hex.q, hex.r)) {
                s.outcome = 'captured';
                return [{ type: 'captured', by: sw.id }];
            }
            const rig = this.rigAt(hex.q, hex.r);
            if (!rig) return [];
            rig.status = 'smashed';
            sw.target = null;
            return [{ type: 'smashed', rig: rig.id, by: sw.id }];
        }

        // Sedation (R-22): a Sweeper's own hex falls asleep. (Its wider JAM_RADIUS only blocks
        // waking and silences rigs, at broadcast; the Wake heals a hole once it moves on.)
        sedate(events) {
            const keys = [];
            for (const sw of this.state.sweepers) {
                const h = this.state.hexes.get(sw.key());
                if (h.awake) { h.awake = false; keys.push(sw.key()); }
            }
            if (keys.length > 0) events.push({ type: 'sedated', keys });
        }

        // The Alert (R-24): spawn up to `limit` Sweepers toward the quota, each at a random
        // station's free passable neighbor, kind rolled on one d6.
        spawnSweepers(limit, events) {
            const s = this.state;
            const n = Math.min(limit, this.alertQuota() - s.sweepers.length);
            for (let i = 0; i < n; i++) {
                const taken = this.sweeperKeys();
                for (const k of this.stationKeys()) taken.add(k);
                taken.add(s.player.key());
                const station = Rando.choice(s.stations);
                const spots = this.board.neighbors(station.q, station.r)
                    .filter(h => this.board.isPassable(h) && !taken.has(Hex.key(h.q, h.r)));
                if (spots.length === 0) continue;
                const h = Rando.choice(spots);
                const kind = SWEEPER_KINDS[Rando.int(1, 6) - 1];
                const sw = new Sweeper(s.nextSweeperId++, h.q, h.r, kind);
                s.sweepers.push(sw);
                events.push({ type: 'spawned', id: sw.id, key: sw.key() });
            }
        }
    }

    return GameEngine;
})();
