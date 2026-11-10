// gameengine.js — GameEngine
//
// All game rules and world generation, operating on a GameState. DOM-free and render-free:
// commands mutate state and *return outcomes* ({ ok, events }); the client decides
// what to animate. This is the half that would run server-side unchanged.
//
// Every command re-checks its own legality (never trust the client) and every legal
// command runs exactly one tick. All randomness goes through the seeded Rando.
const GameEngine = (function () {
    const {
        TERRAIN, THINGS, PIECES, CRATE_COLORS, aims, nextMilestone, MAP_COLS, MAP_ROWS, SOURCE_INTERVAL, HAND_SIZE,
        GREMLIN_DICE_COUNT, GREMLIN_DICE_SIDES,
        GEN_MAX_ATTEMPTS, KNOWN_GOOD_SEED, HEIGHTMAP_SIZE, HEIGHTMAP_ROUGHNESS,
        WATER_PCT, MOUNTAIN_PCT, ICE_FRAC, PLACE_SLICE_FRAC, PLACE_SLICE_MIN
    } = GameArtifacts;

    const KINDS = Object.keys(THINGS);
    const isLand = t => t === TERRAIN.PLAINS || t === TERRAIN.ICE;
    // Where a Thing may be built, keyed by its template's `on`.
    const BUILDS_ON = {
        land: isLand,
        water: t => t === TERRAIN.WATER,
    };

    class GameEngine {
        constructor(state) {
            this.state = state;
        }

        // ---- Queries ----
        thingAt(q, r) {
            return this.state.things.find(t => t.q === q && t.r === r) || null;
        }

        pieceAt(q, r) {
            return this.state.pieces.find(p => p.isAt(q, r)) || null;
        }

        // May `kind` be built on `hex`? The one placement rule: place() checks it, and
        // legalPlacements() filters the board with it, so the UI's highlight is the rule.
        canPlace(kind, hex) {
            const tpl = THINGS[kind];
            if (!tpl || !hex) return false;
            if (Hex.same(hex, this.state.target)) return false;
            if (this.thingAt(hex.q, hex.r)) return false;
            if (!BUILDS_ON[tpl.on](hex.terrain)) return false;
            return !(tpl.blocks && this.pieceAt(hex.q, hex.r));
        }

        legalPlacements(kind) {
            const keys = [...this.state.hexes].filter(([, hex]) => this.canPlace(kind, hex)).map(([key]) => key);
            return new Set(keys);
        }

        // ---- New game / generation ----
        // The caller picks the seed (the client rolls one; tests and replays pass theirs).
        newGame(seed) {
            if (!Number.isInteger(seed) || seed < 0) return { ok: false };
            const s = this.state;
            s.seed = seed >>> 0;
            if (!this.generateMap(s.seed, GEN_MAX_ATTEMPTS)) {
                s.seed = KNOWN_GOOD_SEED;
                this.generateMap(s.seed, 1);
            }
            s.things = [];
            s.pieces = [];
            s.nextId = 1;
            this.spawnCrate();
            this.spawnGremlins();
            s.hand = Array.from({ length: HAND_SIZE }, () => this.draw());
            s.turn = 1;
            s.delivered = 0;
            s.lost = 0;
            s.spawnTimer = 0;
            s.phase = 'player';
            return { ok: true };
        }

        // Seed Rando and build up to `attempts` maps, stopping at the first with a
        // source→target land path.
        generateMap(seed, attempts) {
            const s = this.state;
            Rando.seed(seed);
            for (let i = 0; i < attempts; i++) {
                s.hexes = this.generateRectGrid();
                this.board = new Board(s.hexes);
                this.assignTerrain();
                this.placeSourceAndTarget();
                if (this.board.hasPath(s.source, s.target)) return true;
            }
            return false;
        }

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
            const hm = this.diamondSquare(HEIGHTMAP_SIZE, HEIGHTMAP_ROUGHNESS);
            const last = HEIGHTMAP_SIZE - 1;
            for (let row = 0; row < MAP_ROWS; row++) {
                const qOffset = -Math.floor(row / 2);
                for (let col = 0; col < MAP_COLS; col++) {
                    const q = col + qOffset;
                    const r = row;
                    const gx = Math.round(col / (MAP_COLS - 1) * last);
                    const gy = Math.round(row / (MAP_ROWS - 1) * last);
                    const elevation = hm[gy * HEIGHTMAP_SIZE + gx];
                    const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;
                    hexes.set(Hex.key(q, r), { q, r, col, row, elevation, isEdge, terrain: null });
                }
            }
            return hexes;
        }

        // Base terrain by elevation percentile, then ice carved out of plains.
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
                if (pct < WATER_PCT) inner[i].terrain = TERRAIN.WATER;
                else if (pct < MOUNTAIN_PCT) inner[i].terrain = TERRAIN.PLAINS;
                else inner[i].terrain = TERRAIN.MOUNTAIN;
            }
            const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS);
            Rando.shuffle(plains);
            const iceCount = Math.round(n * ICE_FRAC);
            for (let i = 0; i < iceCount && i < plains.length; i++) plains[i].terrain = TERRAIN.ICE;
        }

        placeSourceAndTarget() {
            const passable = this.board.passableHexes();
            passable.sort((a, b) => a.col - b.col);
            const sliceLen = Math.max(PLACE_SLICE_MIN, Math.floor(passable.length * PLACE_SLICE_FRAC));
            const sh = Rando.choice(passable.slice(0, sliceLen));
            const th = Rando.choice(passable.slice(-sliceLen));
            this.state.source = { q: sh.q, r: sh.r };
            this.state.target = { q: th.q, r: th.r };
        }

        addPiece(kind, q, r, color) {
            const s = this.state;
            const p = new Piece(q, r, color, PIECES[kind].label);
            p.id = s.nextId++;
            p.kind = kind;
            s.pieces.push(p);
            return p;
        }

        spawnCrate() {
            const s = this.state;
            return this.addPiece('crate', s.source.q, s.source.r, Rando.choice(CRATE_COLORS));
        }

        spawnGremlins() {
            const s = this.state;
            let count = 0;
            for (let i = 0; i < GREMLIN_DICE_COUNT; i++) count += Rando.int(1, GREMLIN_DICE_SIDES);
            const candidates = this.board.passableHexes().filter(h => !Hex.same(h, s.source) && !Hex.same(h, s.target));
            Rando.shuffle(candidates);
            const scheme = ColorTheory.randomScheme(() => Rando.random());
            for (let i = 0; i < count && i < candidates.length; i++) {
                const [r, g, b] = scheme[i % scheme.length];
                this.addPiece('gremlin', candidates[i].q, candidates[i].r, ColorTheory.rgbToHex(r, g, b));
            }
        }

        // Land hexes next to the outer water (an edge hex) that a piece could stand on.
        shoreHexes() {
            const s = this.state;
            return this.board.passableHexes().filter(h =>
                this.canEnter(h) && !Hex.same(h, s.source) && !Hex.same(h, s.target) &&
                this.board.neighbors(h.q, h.r).some(n => n.isEdge));
        }

        // For each sunk kind that reemerges, a new one (fresh color, new id) climbs out on a
        // random shore hex. None if the shore is full. Returns the spawn events.
        emerge(sunkKinds) {
            const events = [];
            for (const kind of sunkKinds.filter(k => PIECES[k].reemerges)) {
                const shore = this.shoreHexes();
                if (!shore.length) break;
                const h = Rando.choice(shore);
                const [r, g, b] = Rando.choice(ColorTheory.randomScheme(() => Rando.random()));
                const p = this.addPiece(kind, h.q, h.r, ColorTheory.rgbToHex(r, g, b));
                events.push({ type: 'spawn', id: p.id, q: p.q, r: p.r });
            }
            return events;
        }

        // A kind drawn with probability weight / total weight.
        draw() {
            const total = KINDS.reduce((sum, k) => sum + THINGS[k].weight, 0);
            let roll = Rando.random() * total;
            for (const k of KINDS) {
                roll -= THINGS[k].weight;
                if (roll < 0) return k;
            }
            return KINDS[KINDS.length - 1];
        }

        // ---- Movement: one code path for movers, springs, ice, and gremlins ----

        // Can a piece step into this hex at all? (Water accepts it — and sinks it.)
        canEnter(hex) {
            if (!hex || hex.terrain === TERRAIN.MOUNTAIN) return false;
            const thing = this.thingAt(hex.q, hex.r);
            if (thing && THINGS[thing.kind].blocks) return false;
            return !this.pieceAt(hex.q, hex.r);
        }

        // Is this hex wet — water with nothing built over it?
        isOpenWater(hex) {
            return hex.terrain === TERRAIN.WATER && !this.thingAt(hex.q, hex.r);
        }

        removePiece(piece) {
            const s = this.state;
            s.pieces.splice(s.pieces.indexOf(piece), 1);
        }

        // A piece goes into open water: gone, and counted as lost if it was cargo.
        sink(piece) {
            this.removePiece(piece);
            if (PIECES[piece.kind].cargo) this.state.lost++;
        }

        // The board hex one step from `at` in `dir` (undefined off the map).
        neighborHex(at, dir) {
            const d = NEIGHBOR_DIRS[dir];
            return this.board.get(at.q + d.q, at.r + d.r);
        }

        // One hex in `dir`. Returns 'moved' | 'blocked' | 'sank' | 'delivered'.
        step(piece, dir) {
            const s = this.state;
            const cargo = PIECES[piece.kind].cargo;
            const hex = this.neighborHex(piece, dir);
            if (!this.canEnter(hex)) return 'blocked';
            piece.moveTo(hex.q, hex.r);
            if (cargo && Hex.same(hex, s.target)) {
                this.removePiece(piece);
                s.delivered++;
                return 'delivered';
            }
            if (this.isOpenWater(hex)) {
                this.sink(piece);
                return 'sank';
            }
            return 'moved';
        }

        // Shove `piece` up to n hexes in `dir`. Bare ice is free: the piece slides on.
        // Returns this push's events: one move (if it moved), then a sink/deliver if it
        // ended so.
        push(piece, dir, n) {
            const events = [];
            const path = [];
            let left = n, res = 'moved';
            while (left > 0) {
                res = this.step(piece, dir);
                if (res === 'blocked') break;
                path.push({ q: piece.q, r: piece.r });
                if (res !== 'moved') break;
                const hex = this.board.get(piece.q, piece.r);
                if (hex.terrain === TERRAIN.ICE && !this.thingAt(hex.q, hex.r)) continue;
                left--;
            }
            if (path.length) events.push({ type: 'move', id: piece.id, path });
            if (res === 'sank') events.push({ type: 'sink', id: piece.id });
            if (res === 'delivered') events.push({ type: 'deliver', id: piece.id });
            return events;
        }

        // The piece a Thing acts on this tick, and which way and how far it goes.
        // Pushers move the piece on their own hex along their facing; pullers reach across
        // the near hex and pull the piece on the far hex back into the near one.
        actionOf(thing) {
            const tpl = THINGS[thing.kind];
            if (tpl.push) return { piece: this.pieceAt(thing.q, thing.r), dir: thing.facing, n: tpl.push };
            if (tpl.pull) {
                const d = NEIGHBOR_DIRS[thing.facing];
                return { piece: this.pieceAt(thing.q + 2 * d.q, thing.r + 2 * d.r), dir: Hex.opposite(thing.facing), n: tpl.pull };
            }
            return null;
        }

        // Directions a wandering piece may take: enterable, and not into open water.
        wanderDirs(piece) {
            return NEIGHBOR_DIRS.map((_, dir) => dir).filter(dir => {
                const hex = this.neighborHex(piece, dir);
                return this.canEnter(hex) && !this.isOpenWater(hex);
            });
        }

        // ---- The tick: every Thing does its thing ----
        tick() {
            const s = this.state;
            s.phase = 'tick';
            const deliveredBefore = s.delivered;
            const kindOf = new Map(s.pieces.map(p => [p.id, p.kind]));
            const events = [];
            const moved = new Set();

            for (const thing of s.things) {
                const act = this.actionOf(thing);
                if (!act || !act.piece || moved.has(act.piece.id)) continue;
                moved.add(act.piece.id);
                events.push(...this.push(act.piece, act.dir, act.n));
            }

            // Only a push removes a piece, and pushed pieces are in `moved`, so every
            // wanderer here is still on the board.
            for (const p of s.pieces.filter(p => PIECES[p.kind].wanders && !moved.has(p.id))) {
                const dirs = this.wanderDirs(p);
                if (dirs.length) events.push(...this.push(p, Rando.choice(dirs), 1));
            }

            s.spawnTimer++;
            if (s.spawnTimer >= SOURCE_INTERVAL && !this.pieceAt(s.source.q, s.source.r)) {
                const c = this.spawnCrate();
                s.spawnTimer = 0;
                events.push({ type: 'spawn', id: c.id, q: c.q, r: c.r });
            }

            const drowned = events.filter(e => e.type === 'sink').map(e => kindOf.get(e.id));
            events.push(...this.emerge(drowned));

            // One milestone event per milestone this tick's deliveries reached.
            for (let m = nextMilestone(deliveredBefore); m <= s.delivered; m = nextMilestone(m)) {
                events.push({ type: 'milestone', count: m });
            }

            s.turn++;
            s.phase = 'player';
            return { ok: true, events };
        }

        // ---- Commands (every one returns { ok, ... }; ok:false = illegal, unchanged) ----

        place(slot, q, r, facing) {
            const s = this.state;
            if (!Number.isInteger(slot) || slot < 0 || slot >= s.hand.length) return { ok: false };
            const kind = s.hand[slot];
            const aimed = aims(kind);
            if (aimed && !(Number.isInteger(facing) && facing >= 0 && facing < 6)) return { ok: false };
            if (!this.canPlace(kind, this.board.get(q, r))) return { ok: false };
            s.things.push({ kind, q, r, facing: aimed ? facing : null });
            s.hand[slot] = this.draw();
            return this.tick();
        }

        rotate(q, r) {
            const thing = this.thingAt(q, r);
            if (!thing || !aims(thing.kind)) return { ok: false };
            thing.facing = Hex.clockwise(thing.facing);
            return this.tick();
        }

        // Take a placed Thing off the board. The card is spent: nothing returns to the hand.
        remove(q, r) {
            const s = this.state;
            const thing = this.thingAt(q, r);
            if (!thing) return { ok: false };
            s.things.splice(s.things.indexOf(thing), 1);
            // A piece left standing on open water (its Bridge is gone) sinks before the tick.
            const piece = this.pieceAt(q, r);
            const adrift = piece && this.isOpenWater(this.board.get(q, r));
            if (adrift) this.sink(piece);
            const res = this.tick();
            if (adrift) res.events.unshift({ type: 'sink', id: piece.id });
            if (adrift) res.events.push(...this.emerge([piece.kind]));
            return res;
        }

        wait() {
            return this.tick();
        }
    }

    return GameEngine;
})();
