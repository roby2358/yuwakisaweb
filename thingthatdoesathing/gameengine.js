// gameengine.js — GameEngine
//
// All game rules and world generation, operating on a GameState. DOM-free and render-free:
// commands mutate state and *return outcomes* ({ ok, events }); the client decides
// what to animate.
//
// Every command re-checks its own legality; every legal command but rotate runs exactly one tick. All randomness goes through the seeded Rando.
const GameEngine = (function () {
    const {
        TERRAIN, THINGS, PIECES, CRATE_COLORS, WHITE, aims, nextMilestone, MAP_SIZES, SOURCE_INTERVAL, ENHANCE_CHANCE, HAND_SIZE, IDLE_REDRAW_TICKS,
        gremlinDice, GREMLIN_DICE_SIDES,
        GEN_MAX_ATTEMPTS, HEIGHTMAP_ROUGHNESS,
        WATER_PCT, MOUNTAIN_PCT, ICE_FRAC, PLACE_SLICE_FRAC, PLACE_SLICE_MIN
    } = GameArtifacts;

    const KINDS = Object.keys(THINGS);
    // A wanderer's own step, as a push; `wrecks` comes from its piece template.
    const wanderOf = piece => ({ n: 1, splat: false, flies: false, skids: false, wrecks: PIECES[piece.kind].wrecks });
    // What a command did before its tick: events to report first, and the kinds of pieces it
    // sank (for emerge). Most commands do nothing first.
    // What a command did before its tick: leading events, the kinds it removed (for emerge),
    // and whether it used a card (place, discard), which resets the idle count.
    const NOTHING_FIRST = Object.freeze({ events: [], gone: [], usedCard: false });
    const CARD_FIRST = Object.freeze({ events: [], gone: [], usedCard: true });
    // An end slice of the col-sorted passable hexes.
    const SLICE_OF = {
        left: (sorted, len) => sorted.slice(0, len),
        right: (sorted, len) => sorted.slice(-len),
    };
    const isLand = t => t === TERRAIN.PLAINS || t === TERRAIN.ICE;
    // Where a Thing may be built, keyed by its template's `on`.
    const BUILDS_ON = {
        land: isLand,
        water: t => t === TERRAIN.WATER,
        both: t => isLand(t) || t === TERRAIN.WATER,
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

        targetAt(q, r) {
            return this.state.targets.find(t => t.q === q && t.r === r) || null;
        }

        // Is this hex a source or a target?
        isSource(hex) {
            return this.state.sources.some(src => Hex.same(src, hex));
        }

        isEndpoint(hex) {
            const s = this.state;
            return [...s.sources, ...s.targets].some(e => Hex.same(e, hex));
        }

        // The colors open so far, in the order they opened.
        openColors() {
            return this.state.targets.map(t => t.color);
        }

        sourceOf(color) {
            return this.state.sources.find(src => src.colors.includes(color));
        }

        // Is `hex` a target for another color than this cargo piece's? (Solid to it on the
        // ground; a flight passes over but can't come down there.)
        wrongTarget(piece, hex) {
            const t = PIECES[piece.kind].cargo && this.targetAt(hex.q, hex.r);
            return !!t && t.color !== piece.color;
        }

        // May `kind` be built on `hex`? The one placement rule: place() checks it, and
        // legalPlacements() filters the board with it. A Thing already there doesn't count:
        // placing replaces it, so the hex is judged as if it were gone (D-28).
        canPlace(kind, hex) {
            const tpl = THINGS[kind];
            if (!tpl || !hex) return false;
            if (this.targetAt(hex.q, hex.r)) return false;
            if (!BUILDS_ON[tpl.on](hex.terrain)) return false;
            return !(tpl.blocks && (this.pieceAt(hex.q, hex.r) || this.isSource(hex)));   // the crates must flow
        }

        legalPlacements(kind) {
            const keys = [...this.state.hexes].filter(([, hex]) => this.canPlace(kind, hex)).map(([key]) => key);
            return new Set(keys);
        }

        // ---- New game / generation ----
        // The caller picks the seed (the client rolls one; tests and replays pass theirs)
        // and the board size, a key of MAP_SIZES.
        newGame(seed, size) {
            if (!Number.isInteger(seed) || seed < 0) return { ok: false };
            if (!Object.hasOwn(MAP_SIZES, size)) return { ok: false };
            const s = this.state;
            s.seed = seed >>> 0;
            s.size = size;
            let ends = this.generateMap(s.seed, GEN_MAX_ATTEMPTS);
            if (!ends) {
                s.seed = MAP_SIZES[size].knownGoodSeed;
                ends = this.generateMap(s.seed, 1);
            }
            const color = Rando.choice(CRATE_COLORS);
            s.sources = [{ q: ends.source.q, r: ends.source.r, colors: [color] }];
            s.targets = [{ q: ends.target.q, r: ends.target.r, color, delivered: 0 }];
            s.things = [];
            s.pieces = [];
            s.nextId = 1;
            this.spawnCrate(color, s.sources[0]);
            this.spawnGremlins();
            s.hand = Array.from({ length: HAND_SIZE }, () => this.draw());   // after targets: card colors read them
            s.turn = 1;
            s.delivered = 0;
            s.lost = 0;
            s.exGremlins = 0;
            s.trapped = 0;
            s.spawnTimer = 0;
            s.idleTicks = 0;
            s.phase = 'player';
            return { ok: true };
        }

        // Seed Rando and build up to `attempts` maps, stopping at the first with a
        // source→target land path. Returns that {source, target} pair of hexes, or null.
        generateMap(seed, attempts) {
            const s = this.state;
            Rando.seed(seed);
            for (let i = 0; i < attempts; i++) {
                s.hexes = this.generateRectGrid();
                this.board = new Board(s.hexes);
                this.assignTerrain();
                const ends = this.placeSourceAndTarget();
                if (this.board.hasPath(ends.source, ends.target)) return ends;
            }
            return null;
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
            const { cols, rows, heightmap } = MAP_SIZES[this.state.size];
            const hm = this.diamondSquare(heightmap, HEIGHTMAP_ROUGHNESS);
            const last = heightmap - 1;
            for (let row = 0; row < rows; row++) {
                const qOffset = -Math.floor(row / 2);
                for (let col = 0; col < cols; col++) {
                    const q = col + qOffset;
                    const r = row;
                    const gx = Math.round(col / (cols - 1) * last);
                    const gy = Math.round(row / (rows - 1) * last);
                    const elevation = hm[gy * heightmap + gx];
                    const isEdge = row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
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

        // The passable hexes at the left ('left') or right ('right') end of the board, by col.
        endSlice(end) {
            const passable = this.board.passableHexes();
            passable.sort((a, b) => a.col - b.col);
            const sliceLen = Math.max(PLACE_SLICE_MIN, Math.floor(passable.length * PLACE_SLICE_FRAC));
            return SLICE_OF[end](passable, sliceLen);
        }

        placeSourceAndTarget() {
            return { source: Rando.choice(this.endSlice('left')), target: Rando.choice(this.endSlice('right')) };
        }

        // Hexes in an end slice where a new source or target may open: no Thing, no piece,
        // not already a source or target.
        freeEndHexes(end) {
            return this.endSlice(end).filter(h => !this.thingAt(h.q, h.r) && !this.pieceAt(h.q, h.r) && !this.isEndpoint(h));
        }

        // Open the next color, if the board has room for one (R-38): ENHANCE_CHANCE that it
        // comes out of an existing source, else a new source on the left; its target goes on
        // the right, with a land path from its source. Returns the open event, or null.
        openColor() {
            const s = this.state;
            if (s.targets.length >= MAP_SIZES[s.size].colors) return null;
            const color = Rando.choice(CRATE_COLORS.filter(c => !this.openColors().includes(c)));
            const enhance = Rando.random() < ENHANCE_CHANCE;
            const src = enhance ? Rando.choice(s.sources) : Rando.choice(this.freeEndHexes('left'));
            const reachable = src ? this.freeEndHexes('right').filter(h => this.board.hasPath(src, h)) : [];
            const tgt = Rando.choice(reachable);
            if (!tgt) return null;
            if (enhance) src.colors.push(color);
            else s.sources.push({ q: src.q, r: src.r, colors: [color] });
            s.targets.push({ q: tgt.q, r: tgt.r, color, delivered: 0 });
            return { type: 'open', color, source: { q: src.q, r: src.r }, target: { q: tgt.q, r: tgt.r } };
        }

        addPiece(kind, q, r, color) {
            const s = this.state;
            const p = new Piece(q, r, color, PIECES[kind].label);
            p.id = s.nextId++;
            p.kind = kind;
            s.pieces.push(p);
            return p;
        }

        spawnCrate(color, src) {
            return this.addPiece('crate', src.q, src.r, color);
        }

        spawnGremlins() {
            const s = this.state;
            let count = 0;
            for (let i = 0; i < gremlinDice(s.size); i++) count += Rando.int(1, GREMLIN_DICE_SIDES);
            const candidates = this.board.passableHexes().filter(h => !this.isEndpoint(h));
            Rando.shuffle(candidates);
            const scheme = ColorTheory.randomScheme(() => Rando.random());
            for (let i = 0; i < count && i < candidates.length; i++) {
                const [r, g, b] = scheme[i % scheme.length];
                this.addPiece('gremlin', candidates[i].q, candidates[i].r, ColorTheory.rgbToHex(r, g, b));
            }
        }

        // Land hexes next to the outer water (an edge hex) that a piece could stand on.
        shoreHexes() {
            return this.board.passableHexes().filter(h =>
                this.canEnter(h) && !this.isEndpoint(h) &&
                this.board.neighbors(h.q, h.r).some(n => n.isEdge));
        }

        // For each sunk or splatted kind that reemerges, a new one (fresh color, new id) climbs out on a
        // random shore hex. None if the shore is full. Returns the spawn events.
        emerge(goneKinds) {
            const events = [];
            for (const kind of goneKinds.filter(k => PIECES[k].reemerges)) {
                const shore = this.shoreHexes();
                if (!shore.length) break;
                const h = Rando.choice(shore);
                const [r, g, b] = Rando.choice(ColorTheory.randomScheme(() => Rando.random()));
                const p = this.addPiece(kind, h.q, h.r, ColorTheory.rgbToHex(r, g, b));
                events.push({ type: 'spawn', id: p.id, q: p.q, r: p.r });
            }
            return events;
        }

        // A card: a kind drawn with probability weight / total weight, and its color.
        draw() {
            const kind = this.drawKind(this.drawableKinds());
            return { kind, color: THINGS[kind].colored ? this.cardColor() : WHITE };
        }

        // Colored kinds only split colors, so they're in the deck only once two are open.
        drawableKinds() {
            return this.openColors().length > 1 ? KINDS : KINDS.filter(k => !THINGS[k].colored);
        }

        drawKind(kinds) {
            const total = kinds.reduce((sum, k) => sum + THINGS[k].weight, 0);
            let roll = Rando.random() * total;
            for (const k of kinds) {
                roll -= THINGS[k].weight;
                if (roll < 0) return k;
            }
            return kinds[kinds.length - 1];
        }

        // A colored kind's card color: one of the open colors, each equally likely (never white).
        cardColor() {
            return Rando.choice(this.openColors());
        }

        // Does this Thing act on this piece? White ones act on everything; a colored one only
        // on crates of its color, and on every gremlin.
        affects(thing, piece) {
            return thing.color === WHITE || !PIECES[piece.kind].cargo || piece.color === thing.color;
        }

        // ---- Movement: one code path for movers, springs, ice, Slides, and gremlins ----

        // Can a piece step into this hex at all? (Water accepts it — and sinks it.)
        canEnter(hex) {
            if (!hex || hex.terrain === TERRAIN.MOUNTAIN) return false;
            const thing = this.thingAt(hex.q, hex.r);
            if (thing && THINGS[thing.kind].blocks) return false;
            return !this.pieceAt(hex.q, hex.r);
        }

        // Does a piece that comes onto this hex on the ground slide on? A Thing decides by its
        // `slides` (a Slide does, any other Thing covers the ground); bare ground slides if it's ice.
        isSlick(hex) {
            const thing = this.thingAt(hex.q, hex.r);
            return thing ? THINGS[thing.kind].slides : hex.terrain === TERRAIN.ICE;
        }

        // Does this hex kill this piece when it comes onto it? A Trap does, and so does a
        // target, for a piece that splats (gremlins can't camp the targets).
        trapsPiece(piece, hex) {
            const deadly = this.isTrap(hex) || !!this.targetAt(hex.q, hex.r);
            return deadly && PIECES[piece.kind].splats;
        }

        // Is there a Thing that traps on this hex?
        isTrap(hex) {
            const thing = this.thingAt(hex.q, hex.r);
            return !!thing && THINGS[thing.kind].traps;
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

        // One hex in `dir`. Returns 'moved' | 'blocked' | 'sank' | 'delivered' | 'trapped'.
        // A flying piece passes over inland open water (only the outer sea takes it), over
        // Traps, and over targets of other colors; on the ground those targets are solid.
        step(piece, dir, flies) {
            const s = this.state;
            const hex = this.neighborHex(piece, dir);
            if (!this.canEnter(hex)) return 'blocked';
            if (!flies && this.wrongTarget(piece, hex)) return 'blocked';
            piece.moveTo(hex.q, hex.r);
            const goal = PIECES[piece.kind].cargo && this.targetAt(hex.q, hex.r);
            if (goal && goal.color === piece.color) {
                this.removePiece(piece);
                goal.delivered++;
                s.delivered++;
                return 'delivered';
            }
            if (!flies && this.trapsPiece(piece, hex)) {
                this.removePiece(piece);
                return 'trapped';
            }
            if (this.isOpenWater(hex) && !(flies && !hex.isEdge)) {
                this.sink(piece);
                return 'sank';
            }
            return 'moved';
        }

        // Shove `piece` up to n hexes in `dir`. Slick ground (bare ice, a Slide) is free: the piece slides on.
        // `how` is { n, splat, flies, skids, wrecks } (from the Thing's template, or wanderOf).
        // A wrecking step (a gremlin's own) that's stopped by cargo destroys it (lost) and
        // takes its hex.
        // A splatting push (the Rocket) that's stopped by a piece that splats destroys it and
        // lands on its hex; then, if the launched piece itself splats, it does too.
        // A flying push counts every hex (ice is no shortcut mid-air), crosses inland water,
        // and sinks only if it comes down on water; if it skids, coming down on slick ground
        // slides on as usual. A piece that splats dies on a Trap it comes onto, or comes down on.
        // Returns this push's events: one move (if it moved), a splat for a piece it hit
        // (`by` the mover), then a sink/deliver/splat if the mover ended so (a Trap's kill is
        // a splat, `by` null).
        push(piece, dir, how) {
            const { n, splat, flies, skids, wrecks } = how;
            const events = [];
            const path = [];
            const start = { q: piece.q, r: piece.r };
            let left = n, res = 'moved', hit = null;
            while (left > 0) {
                res = this.step(piece, dir, flies);
                if (res === 'blocked' && splat) hit = this.victim(piece, dir, v => PIECES[v.kind].splats);
                if (res === 'blocked' && wrecks) hit = this.victim(piece, dir, v => PIECES[v.kind].cargo);
                if (hit && PIECES[hit.kind].cargo) this.state.lost++;
                if (hit) res = this.step(piece, dir, flies);
                if (res === 'blocked') break;
                path.push({ q: piece.q, r: piece.r });
                if (res !== 'moved' || hit) break;
                if (!flies && this.isSlick(this.board.get(piece.q, piece.r))) continue;
                left--;
            }
            // A skidding throw that ran its full range onto slick ground slides on, on the ground.
            while (skids && res === 'moved' && !hit && this.isSlick(this.board.get(piece.q, piece.r))) {
                res = this.step(piece, dir, false);
                if (res === 'blocked') break;
                path.push({ q: piece.q, r: piece.r });
            }
            const landed = flies && (res === 'moved' || res === 'blocked');
            // A flight can't come down on another color's target: it drops one hex short.
            if (landed && this.wrongTarget(piece, piece)) {
                path.pop();
                const back = path.length ? path[path.length - 1] : start;
                piece.moveTo(back.q, back.r);
            }
            const here = this.board.get(piece.q, piece.r);
            if (landed && this.isOpenWater(here)) {
                this.sink(piece);   // came down on inland water
                res = 'sank';
            } else if (landed && this.trapsPiece(piece, here)) {
                this.removePiece(piece);   // came down on a Trap
                res = 'trapped';
            }
            const splatsToo = splat && (res === 'moved' || res === 'blocked') && PIECES[piece.kind].splats;
            if (splatsToo) this.removePiece(piece);
            if (path.length) events.push({ type: 'move', id: piece.id, path });
            if (hit) events.push({ type: 'splat', id: hit.id, by: piece.id, trap: false });
            if (res === 'sank') events.push({ type: 'sink', id: piece.id });
            if (res === 'delivered') events.push({ type: 'deliver', id: piece.id });
            // A trapped piece died on a Trap or on a target; `trap` says which.
            if (splatsToo || res === 'trapped') events.push({ type: 'splat', id: piece.id, by: null, trap: res === 'trapped' && this.isTrap(here) });
            return events;
        }

        // The piece in the way of `piece` going `dir`, if `isVictim(it)`; removed from the board.
        victim(piece, dir, isVictim) {
            const hex = this.neighborHex(piece, dir);
            const victim = hex && this.pieceAt(hex.q, hex.r);
            if (!victim || !isVictim(victim)) return null;
            this.removePiece(victim);
            return victim;
        }

        // The piece a Thing acts on this tick, and which way and how far it goes.
        // Movers (push) move the piece on their own hex along their facing; Pushers (shove)
        // move the piece on the hex they face on along their facing; Pullers (pull) reach
        // across the near hex and pull the piece on the far hex back into the near one.
        actionOf(thing) {
            const tpl = THINGS[thing.kind];
            const how = n => ({ n, splat: tpl.splat, flies: tpl.flies, skids: tpl.skids, wrecks: false });
            const d = aims(thing.kind) && NEIGHBOR_DIRS[thing.facing];
            if (tpl.push) return { piece: this.pieceAt(thing.q, thing.r), dir: thing.facing, how: how(tpl.push) };
            if (tpl.shove) return { piece: this.pieceAt(thing.q + d.q, thing.r + d.r), dir: thing.facing, how: how(tpl.shove) };
            if (tpl.pull) return { piece: this.pieceAt(thing.q + 2 * d.q, thing.r + 2 * d.r), dir: Hex.opposite(thing.facing), how: how(tpl.pull) };
            return null;
        }

        // Directions a wandering piece may take: enterable (or holding cargo it wrecks), and
        // not into open water.
        wanderDirs(piece) {
            return NEIGHBOR_DIRS.map((_, dir) => dir).filter(dir => {
                const hex = this.neighborHex(piece, dir);
                return (this.canEnter(hex) || this.wrecksInto(piece, hex)) && !this.isOpenWater(hex);
            });
        }

        // Would `piece`'s own step into `hex` wreck the cargo standing there?
        wrecksInto(piece, hex) {
            const there = hex && this.pieceAt(hex.q, hex.r);
            return !!there && PIECES[piece.kind].wrecks && PIECES[there.kind].cargo;
        }

        // ---- The tick: every Thing does its thing ----
        // `first` is what the command did before ticking (NOTHING_FIRST, or remove's sink):
        // its events lead, and its sunk kinds emerge with the tick's own.
        tick(first) {
            const s = this.state;
            s.phase = 'tick';
            const deliveredBefore = s.delivered;
            const kindOf = new Map(s.pieces.map(p => [p.id, p.kind]));
            const events = [];
            const moved = new Set();

            // Things that reach ahead (Pusher, Puller) act first, so one beside a moving line
            // catches the crate in front before a Belt carries it on; then the rest. Each
            // group goes in placement order.
            const reaches = t => THINGS[t.kind].shove > 0 || THINGS[t.kind].pull > 0;
            const order = [...s.things.filter(reaches), ...s.things.filter(t => !reaches(t))];
            for (const thing of order) {
                const act = this.actionOf(thing);
                if (!act || !act.piece || !this.affects(thing, act.piece) || moved.has(act.piece.id)) continue;
                moved.add(act.piece.id);
                events.push(...this.push(act.piece, act.dir, act.how));
            }

            // Pieces a push removed are off s.pieces already, so every wanderer here is
            // still on the board.
            for (const p of s.pieces.filter(p => PIECES[p.kind].wanders && !moved.has(p.id))) {
                const dirs = this.wanderDirs(p);
                if (dirs.length) events.push(...this.push(p, Rando.choice(dirs), wanderOf(p)));
            }

            // When the timer is ready, roll an open color; its source makes the crate if it's
            // clear, else nothing this tick (the next tick rolls again).
            s.spawnTimer++;
            const color = s.spawnTimer >= SOURCE_INTERVAL ? Rando.choice(this.openColors()) : null;
            const src = color && this.sourceOf(color);
            if (src && !this.pieceAt(src.q, src.r)) {
                const c = this.spawnCrate(color, src);
                s.spawnTimer = 0;
                events.push({ type: 'spawn', id: c.id, q: c.q, r: c.r });
            }

            // IDLE_REDRAW_TICKS ticks in a row without a card used: one random card is redrawn.
            s.idleTicks = first.usedCard ? 0 : s.idleTicks + 1;
            if (s.idleTicks >= IDLE_REDRAW_TICKS) {
                const slot = Rando.int(0, s.hand.length - 1);
                s.hand[slot] = this.draw();
                s.idleTicks = 0;
                events.push({ type: 'redraw', slot });
            }

            // Gremlins a Trap caught count in `trapped`; every other gremlin gone in `exGremlins`.
            const ends = events.filter(e => e.type === 'sink' || e.type === 'splat');
            const gone = [...first.gone, ...ends.map(e => kindOf.get(e.id))];
            const trappedNow = ends.filter(e => e.trap && kindOf.get(e.id) === 'gremlin').length;
            s.trapped += trappedNow;
            s.exGremlins += gone.filter(kind => kind === 'gremlin').length - trappedNow;
            events.push(...this.emerge(gone));

            // One milestone event per milestone this tick's deliveries reached; each opens the
            // next color, if the board has room.
            for (let m = nextMilestone(deliveredBefore); m <= s.delivered; m = nextMilestone(m)) {
                events.push({ type: 'milestone', count: m });
                const open = this.openColor();
                if (open) events.push(open);
            }

            s.turn++;
            s.phase = 'player';
            return { ok: true, events: [...first.events, ...events] };
        }

        // ---- Commands (every one returns { ok, ... }; ok:false = illegal, unchanged) ----

        place(slot, q, r, facing) {
            const s = this.state;
            if (!Number.isInteger(slot) || slot < 0 || slot >= s.hand.length) return { ok: false };
            const { kind, color } = s.hand[slot];
            const aimed = aims(kind);
            if (aimed && !(Number.isInteger(facing) && facing >= 0 && facing < 6)) return { ok: false };
            if (!this.canPlace(kind, this.board.get(q, r))) return { ok: false };
            const old = this.thingAt(q, r);   // replaced: the new one goes last in placement order (D-28)
            if (old) s.things.splice(s.things.indexOf(old), 1);
            s.things.push({ kind, color, q, r, facing: aimed ? facing : null });
            s.hand[slot] = this.draw();
            return this.tick(CARD_FIRST);
        }

        // Turn a placed mover clockwise. Free: no tick, so nothing happens (D-19).
        rotate(q, r) {
            const thing = this.thingAt(q, r);
            if (!thing || !aims(thing.kind)) return { ok: false };
            thing.facing = Hex.clockwise(thing.facing);
            return { ok: true, events: [] };
        }

        // Blow up the crate at (q, r): it's gone and counts as lost, then one tick. Only crates.
        blast(q, r) {
            const piece = this.pieceAt(q, r);
            if (!piece || !PIECES[piece.kind].cargo) return { ok: false };
            this.removePiece(piece);
            this.state.lost++;
            return this.tick({ events: [{ type: 'splat', id: piece.id, by: null, trap: false }], gone: [piece.kind], usedCard: false });
        }

        // Take a placed Thing off the board, leaving the hex bare. The Thing's card is
        // spent: nothing returns to the hand. (Placing on it replaces it instead, D-28.)
        remove(q, r) {
            const s = this.state;
            const thing = this.thingAt(q, r);
            if (!thing) return { ok: false };
            s.things.splice(s.things.indexOf(thing), 1);
            // A piece left standing on open water (its Bridge is gone) sinks before the tick.
            const piece = this.pieceAt(q, r);
            if (!piece || !this.isOpenWater(this.board.get(q, r))) return this.tick(NOTHING_FIRST);
            this.sink(piece);
            return this.tick({ events: [{ type: 'sink', id: piece.id }], gone: [piece.kind], usedCard: false });
        }

        // Throw away a hand card: the slot gets a fresh draw, and the world ticks.
        discard(slot) {
            const s = this.state;
            if (!Number.isInteger(slot) || slot < 0 || slot >= s.hand.length) return { ok: false };
            s.hand[slot] = this.draw();
            return this.tick(CARD_FIRST);
        }

        wait() {
            return this.tick(NOTHING_FIRST);
        }
    }

    return GameEngine;
})();
