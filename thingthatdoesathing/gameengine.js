// gameengine.js — GameEngine
//
// All game rules and world generation, operating on a GameState. DOM-free and render-free:
// commands mutate state and *return outcomes* ({ ok, events }); the client decides
// what to animate.
//
// Every command re-checks its own legality; every legal command but rotate runs exactly one tick. All randomness goes through the seeded Rando.
const GameEngine = (function () {
    const {
        TERRAIN, THINGS, UNLOCKS, PIECES, CRATE_COLORS, WHITE, aims, nextMilestone, MAP_SIZES, ENHANCE_CHANCE, HAND_SIZE, IDLE_REDRAW_TICKS, BUMP_ADVANCE,
        gremlinDice, GREMLIN_DICE_SIDES, crateCap, milestonesReached, bigCrateChance,
        GEN_MAX_ATTEMPTS, HEIGHTMAP_ROUGHNESS,
        WATER_PCT, MOUNTAIN_PCT, ICE_FRAC, PLACE_SLICE_FRAC, PLACE_SLICE_MIN
    } = GameArtifacts;

    const KINDS = Object.keys(THINGS);
    // A wanderer's own step, as a push; `wrecks` comes from its piece template.
    const wanderOf = piece => ({ n: 1, splat: false, flies: false, overMountains: false, clears: 0, wrecks: PIECES[piece.kind].wrecks });
    // How each phase of a motion travels, one hex per hop (D-38):
    //   over   — a shot's cleared hexes: passes over everything, unseen (D-36)
    //   air    — a flight: meets what's on each hex it enters
    //   ground — a ground push (slick ground free); skid — a landing's slide (D-37);
    //   line   — a bumped line's advance; follow — the bumper following it (D-33);
    //   drop   — a flight stopped over a mountain dropping back (D-35)
    // `lift` is how it meets other pieces; `bumps`: stopped by a still piece on slick ground,
    // it bumps it.
    const PHASES = {
        over:   { lift: 'over',   bumps: false },
        air:    { lift: 'air',    bumps: true },
        ground: { lift: 'ground', bumps: true },
        skid:   { lift: 'ground', bumps: true },
        line:   { lift: 'ground', bumps: false },
        follow: { lift: 'ground', bumps: false },
        drop:   { lift: 'ground', bumps: false },
    };
    // Is the proposed hex open to a motion, by lift, before pieces count? A shot's cleared
    // hex always (aimed at launch), a flight's while it has hexes left (its length was set at
    // launch), a ground step if terrain and Things allow it.
    const OPEN_TO = {
        over: (engine, m, hex) => !!hex,
        air: (engine, m) => m.left > 0,
        ground: (engine, m, hex) => engine.groundOpen(m.piece, hex),
    };
    // What arriving on a hex does, and what being stopped does, by phase (engine methods).
    const ARRIVED = { over: 'passedOver', air: 'flewInto', ground: 'walkedInto', skid: 'skidInto', line: 'advancedInto', follow: 'followedInto', drop: 'droppedInto' };
    const STOPPED = { over: 'finish', air: 'comeDownHere', ground: 'groundStopped', skid: 'finish', line: 'finish', follow: 'followStopped', drop: 'dropStopped' };
    // Fates after which a mover has left its hex this hop.
    const VACATES = new Set(['go', 'collide', 'wreck', 'splat']);
    // Same-hex ties: the earlier Thing in the tick's order, then the earlier motion.
    const byRank = (a, b) => a.m.rank - b.m.rank || a.m.seq - b.m.seq;
    const MAX_HOPS = 1000;   // a guard: no tick should come near it
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
        unslick: t => t === TERRAIN.PLAINS || t === TERRAIN.WATER,   // where slick ground would be new (D-29)
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

        // Crates on the board now (a big crate counts as one, D-34), and how many it may hold:
        // the size's cap plus one per milestone reached.
        crateCount() {
            return this.state.pieces.filter(p => PIECES[p.kind].cargo).length;
        }

        crateMax() {
            return crateCap(this.state.size) + milestonesReached(this.state.delivered);
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
            s.spawnCycle = Rando.shuffle([...CRATE_COLORS]);   // fixed for the game (D-43)
            s.spawnSlot = 0;
            s.sources = [{ q: ends.source.q, r: ends.source.r, colors: [color] }];
            s.targets = [{ q: ends.target.q, r: ends.target.r, color, delivered: 0 }];
            s.things = [];
            s.pieces = [];
            s.nextId = 1;
            this.spawnCrate(color, s.sources[0]);
            this.spawnGremlins();
            s.unlocks = 1;   // the starting cards; before the hand, which draws from them
            s.hand = Array.from({ length: HAND_SIZE }, () => this.draw());   // after targets: the deck reads them
            s.turn = 1;
            s.delivered = 0;
            s.lost = 0;
            s.exGremlins = 0;
            s.trapped = 0;
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

        // Hexes in an end slice where a new source or target may open: any not already a
        // source or target. Whatever stands on the one picked is cleared (D-44).
        openEndHexes(end) {
            return this.endSlice(end).filter(h => !this.isEndpoint(h));
        }

        // Open the next color, if the board has room for one (R-38): ENHANCE_CHANCE that it
        // comes out of an existing source, else a new source on the left; its target goes on
        // the right, with a land path from its source. Each newly placed hex is cleared
        // (D-44); its splats fade at `hop`, the tick's last. Returns the open event then the
        // clears, or [] when nothing opens.
        openColor(hop) {
            const s = this.state;
            if (s.targets.length >= MAP_SIZES[s.size].colors) return [];
            const color = Rando.choice(CRATE_COLORS.filter(c => !this.openColors().includes(c)));
            const enhance = Rando.random() < ENHANCE_CHANCE;
            const src = enhance ? Rando.choice(s.sources) : Rando.choice(this.openEndHexes('left'));
            const reachable = src ? this.openEndHexes('right').filter(h => this.board.hasPath(src, h)) : [];
            const tgt = Rando.choice(reachable);
            if (!tgt) return [];
            if (enhance) src.colors.push(color);
            else s.sources.push({ q: src.q, r: src.r, colors: [color] });
            s.targets.push({ q: tgt.q, r: tgt.r, color, delivered: 0 });
            const cleared = enhance ? [tgt] : [src, tgt];
            return [{ type: 'open', color, source: { q: src.q, r: src.r }, target: { q: tgt.q, r: tgt.r } },
                ...cleared.flatMap(h => this.clearHex(h, hop))];
        }

        // A newly opened endpoint takes its hex (D-44): its Thing is removed (no card back),
        // its piece destroyed (a crate's value counts as lost; the tick's tally counts a
        // gremlin's splat as an ex-gremlin and lets it re-emerge). Returns the events.
        clearHex(h, hop) {
            const s = this.state;
            const events = [];
            const thing = this.thingAt(h.q, h.r);
            if (thing) {
                s.things.splice(s.things.indexOf(thing), 1);
                events.push({ type: 'clear', kind: thing.kind, q: h.q, r: h.r });
            }
            const piece = this.pieceAt(h.q, h.r);
            if (piece) {
                this.removePiece(piece);
                this.loseValue(piece);
                events.push({ type: 'splat', id: piece.id, by: null, trap: false, hop });
            }
            return events;
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
            return this.addPiece(this.spawnKind(), src.q, src.r, color);
        }

        // A spawn is a big crate with bigCrateChance(milestones reached), else a crate; one
        // Rando roll per spawn, from the start (D-34, D-45).
        spawnKind() {
            return Rando.random() < bigCrateChance(milestonesReached(this.state.delivered)) ? 'bigcrate' : 'crate';
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

        // A card: a kind drawn with probability weight / total weight. Cards have no color;
        // a colored kind's color is picked when it's placed (D-32).
        draw() {
            return { kind: this.drawKind(this.drawableKinds()) };
        }

        // The deck: the unlocked kinds (R-49), less the colored ones while one color is open
        // (they only split colors, D-22).
        drawableKinds() {
            const unlocked = this.unlockedKinds();
            const twoColors = this.openColors().length > 1;
            return KINDS.filter(k => unlocked.includes(k) && (twoColors || !THINGS[k].colored));
        }

        unlockedKinds() {
            return UNLOCKS.slice(0, this.state.unlocks).flat();
        }

        // Can this board ever deal `kind`? A colored kind needs a second color (D-22).
        everDealt(kind) {
            return !THINGS[kind].colored || MAP_SIZES[this.state.size].colors > 1;
        }

        // Open the next UNLOCKS step this board can ever deal from, passing over any it can't
        // (D-30). Returns the unlock event, or null past the last step.
        unlock() {
            const s = this.state;
            const skip = UNLOCKS.slice(s.unlocks).findIndex(step => step.some(k => this.everDealt(k)));
            if (skip < 0) return null;
            s.unlocks += skip + 1;
            return { type: 'unlock', kinds: UNLOCKS[s.unlocks - 1] };
        }

        // One milestone event per milestone crossed going from `before` to `after` delivered,
        // each followed by its open and clears (if the board has room for a color) and its
        // unlock (if a step is left). Crossing several at once does each in turn. `hop` is
        // when the clears' splats fade.
        reachMilestones(before, after, hop) {
            const events = [];
            for (let m = nextMilestone(before); m <= after; m = nextMilestone(m)) {
                events.push({ type: 'milestone', count: m });
                events.push(...this.openColor(hop));
                const unlocked = this.unlock();
                if (unlocked) events.push(unlocked);
            }
            return events;
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

        // The colors `kind` may be placed in: any open color for a colored kind (the player
        // picks, D-32), WHITE for every other kind.
        colorChoices(kind) {
            return THINGS[kind].colored ? this.openColors() : [WHITE];
        }

        // Does this Thing act on this piece? White ones act on everything; a colored one only
        // on crates of its color, and on every gremlin.
        affects(thing, piece) {
            return thing.color === WHITE || !PIECES[piece.kind].cargo || piece.color === thing.color;
        }

        // ---- Movement: the lockstep hop simulation (D-38) ----
        // Every piece that gets a motion this tick (from its Thing, a wander, a bump) advances
        // one hex per hop, all together. Each hop every moving piece proposes its next hex and
        // the proposals are resolved at once (`resolve`); then the movers arrive and the
        // stopped ones stop (`applyHop`). Hop k here is hop k in the animation.

        // Can a piece step into this hex at all? (Water accepts it — and sinks it.) A still
        // board's question: wander directions and shore hexes ask it.
        canEnter(hex) {
            if (!hex || hex.terrain === TERRAIN.MOUNTAIN || this.wallAt(hex)) return false;
            return !this.pieceAt(hex.q, hex.r);
        }

        // Is there a Thing that blocks on this hex (a Wall)?
        wallAt(hex) {
            const thing = this.thingAt(hex.q, hex.r);
            return !!thing && THINGS[thing.kind].blocks;
        }

        // Is `hex` open to `piece` stepping on the ground, terrain and Things alone (pieces are
        // the hop's business): on the map, no mountain, no Wall, not another color's target.
        groundOpen(piece, hex) {
            return !!hex && hex.terrain !== TERRAIN.MOUNTAIN && !this.wallAt(hex) && !this.wrongTarget(piece, hex);
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
            this.loseValue(piece);
        }

        // A piece destroyed (sunk, wrecked, blasted, crashed) adds its value to `lost`: 0 for a
        // gremlin, 1 for a crate, 10 for a big crate (D-34).
        loseValue(piece) {
            this.state.lost += PIECES[piece.kind].value;
        }

        // The board hex one step from `at` in `dir` (undefined off the map).
        neighborHex(at, dir) {
            const d = NEIGHBOR_DIRS[dir];
            return this.board.get(at.q + d.q, at.r + d.r);
        }

        hexOf(piece) {
            return this.board.get(piece.q, piece.r);
        }

        // The target that takes `piece` on `hex`: its color's, if it's cargo; else null.
        goalFor(piece, hex) {
            const goal = PIECES[piece.kind].cargo && this.targetAt(hex.q, hex.r);
            return goal && goal.color === piece.color ? goal : null;
        }

        // `piece` is delivered to `goal`: gone, and its value counted there and in the tally.
        deliver(piece, goal) {
            this.removePiece(piece);
            goal.delivered += PIECES[piece.kind].value;
            this.state.delivered += PIECES[piece.kind].value;
        }

        // What coming onto `hex` on the ground does to `piece`: delivered on its color's target,
        // killed on a Trap or a target (a piece that splats), sunk in open water.
        // Returns 'moved' | 'delivered' | 'trapped' | 'sank'.
        groundResult(piece, hex) {
            const goal = this.goalFor(piece, hex);
            if (goal) { this.deliver(piece, goal); return 'delivered'; }
            if (this.trapsPiece(piece, hex)) { this.removePiece(piece); return 'trapped'; }
            if (this.isOpenWater(hex)) { this.sink(piece); return 'sank'; }
            return 'moved';
        }

        // What flying over `hex` does: its color's target takes it; the outer sea (an edge hex)
        // takes it; inland water, Traps and other targets pass under. 'moved' | 'delivered' | 'sank'.
        airResult(piece, hex) {
            const goal = this.goalFor(piece, hex);
            if (goal) { this.deliver(piece, goal); return 'delivered'; }
            if (this.isOpenWater(hex) && hex.isEdge) { this.sink(piece); return 'sank'; }
            return 'moved';
        }

        // What landing on its hex does to a piece that came down there: delivered on its color's
        // target, sunk in open water, killed on a Trap (a piece that splats); else 'moved'.
        landingResult(piece) {
            const here = this.hexOf(piece);
            const goal = this.goalFor(piece, here);
            if (goal) { this.deliver(piece, goal); return 'delivered'; }
            if (this.isOpenWater(here)) { this.sink(piece); return 'sank'; }
            if (this.trapsPiece(piece, here)) { this.removePiece(piece); return 'trapped'; }
            return 'moved';
        }

        // May a flight carrying `piece` come down on `hex`? Not on a mountain (only a flight
        // overMountains is ever over one), nor on another color's target.
        canLand(piece, hex) {
            return hex.terrain !== TERRAIN.MOUNTAIN && !this.wrongTarget(piece, hex);
        }

        // Could `piece` stand on `hex` once it's there: no Wall, no other piece.
        standable(piece, hex) {
            return !this.wallAt(hex) && !this.state.pieces.some(p => p !== piece && p.isAt(hex.q, hex.r));
        }

        // Could `piece` come down on `hex` from a shot: standable, and not open water (D-36).
        groundTakes(piece, hex) {
            return this.standable(piece, hex) && !this.isOpenWater(hex);
        }

        // The event for a piece a motion ended at `hop`: sunk, delivered, or killed on a Trap or
        // a target (a splat, `by` null, `trap` says which).
        endEvent(piece, res, hop) {
            if (res === 'sank') return { type: 'sink', id: piece.id, hop };
            if (res === 'delivered') return { type: 'deliver', id: piece.id, hop };
            return { type: 'splat', id: piece.id, by: null, trap: this.isTrap(this.hexOf(piece)), hop };
        }

        // The piece a Thing acts on this tick, and which way and how far it goes.
        // Movers (push) move the piece on their own hex along their facing; Pushers (shove)
        // move the piece on the hex they face on along their facing; Pullers (pull) reach
        // across the near hex and pull the piece on the far hex back into the near one.
        actionOf(thing) {
            const tpl = THINGS[thing.kind];
            const how = n => ({ n, splat: tpl.splat, flies: tpl.flies, overMountains: tpl.overMountains, clears: tpl.clears, wrecks: false });
            const d = aims(thing.kind) && NEIGHBOR_DIRS[thing.facing];
            if (tpl.push) return { piece: this.pieceAt(thing.q, thing.r), dir: thing.facing, how: how(tpl.push) };
            if (tpl.shove) return { piece: this.pieceAt(thing.q + d.q, thing.r + d.r), dir: thing.facing, how: how(tpl.shove) };
            if (tpl.pull) return { piece: this.pieceAt(thing.q + 2 * d.q, thing.r + 2 * d.r), dir: Hex.opposite(thing.facing), how: how(tpl.pull) };
            return null;
        }

        // Directions a wandering piece may take: enterable (or holding cargo it wrecks), and
        // not into open water. Asked once, at hop 1, of the board as the tick starts.
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

        // ---- Motions: launched at the start of the tick, run hop by hop ----

        // A new motion for `piece` (it's claimed: one motion per piece per tick, R-13).
        // `rank` settles same-hex ties: the earlier Thing in the tick's order wins (D-38).
        newMotion(run, piece, dir, rank, phase, left) {
            const m = {
                piece, dir, rank, seq: run.motions.length, phase, left, groundLeft: 0,
                start: { q: piece.q, r: piece.r }, path: [], hop: null, over: 0, flown: [],
                splat: false, wrecks: false, doomed: false, aloft: false, overhead: false,
                leader: null, followed: 0, waitHop: 0, dropTo: null,
            };
            run.motions.push(m);
            run.byId.set(piece.id, m);
            run.claimed.add(piece.id);
            return m;
        }

        // Start `piece` going `dir` as `how` says ({ n, splat, flies, overMountains, clears,
        // wrecks }, from a Thing's template or wanderOf). A shot (`clears`) is aimed by
        // `aimShot`; a flight's length is fixed now (`flightLength`, D-35); a ground push goes
        // up to n hexes, slick ground free.
        launch(run, piece, dir, how, rank) {
            if (how.clears) return this.aimShot(run, piece, dir, how, rank);
            const m = how.flies
                ? this.newMotion(run, piece, dir, rank, 'air', this.flightLength(piece, dir, how))
                : this.newMotion(run, piece, dir, rank, 'ground', how.n);
            m.splat = how.splat;
            m.wrecks = how.wrecks;
            m.doomed = how.splat && PIECES[piece.kind].splats;   // a gremlin on a Rocket
            return m;
        }

        // How many hexes a flight goes, settled at launch from what doesn't move (D-35, D-38):
        // up to n hexes, stopping before the map's edge, a Wall, or a mountain (unless it flies
        // overMountains), and on its color's target or the outer sea (which take it); then
        // backed up off any mountain or other color's target it would end over.
        flightLength(piece, dir, how) {
            const hexes = [];
            for (let at = piece; hexes.length < how.n;) {
                const hex = this.neighborHex(at, dir);
                if (!hex || this.wallAt(hex) || (hex.terrain === TERRAIN.MOUNTAIN && !how.overMountains)) break;
                hexes.push(hex);
                at = hex;
                if (this.goalFor(piece, hex) || (this.isOpenWater(hex) && hex.isEdge)) break;
            }
            while (hexes.length && !this.canLand(piece, hexes[hexes.length - 1])) hexes.pop();
            return hexes.length;
        }

        // A shot passes over its first `clears` hexes touching nothing (D-36), then goes on
        // the ground. It doesn't fire if that stretch leaves the map, or if the hex beyond is
        // closed to it and the last cleared hex couldn't take it (as the board stands now);
        // the piece is still claimed.
        aimShot(run, piece, dir, how, rank) {
            let last = piece;
            for (let k = 0; k < how.clears; k++) {
                last = this.neighborHex(last, dir);
                if (!last) { run.claimed.add(piece.id); return null; }
            }
            const beyond = this.neighborHex(last, dir);
            const fires = this.groundOpen(piece, beyond) || (this.canLand(piece, last) && this.groundTakes(piece, last));
            if (!fires) { run.claimed.add(piece.id); return null; }
            const m = this.newMotion(run, piece, dir, rank, 'over', how.clears);
            m.groundLeft = how.n - how.clears;
            return m;
        }

        // Run every motion to its end, one hop at a time. Returns the tick's movement events:
        // one move per piece that moved ({ path, hop: the hop of path[0], over: how many of
        // its first hexes it passed over }), then every end (sink/deliver/splat) with its hop.
        runHops(run) {
            while (run.motions.some(m => m.phase !== 'done')) {
                if (++run.hop > MAX_HOPS) throw new Error('a tick ran past MAX_HOPS hops');
                this.runHop(run);
            }
            const moves = run.motions.filter(m => m.path.length)
                .map(m => ({ type: 'move', id: m.piece.id, path: m.path, hop: m.hop, over: m.over }));
            return [...moves, ...run.ends];
        }

        // One hop: propose, resolve, and if a bump starts a line moving, resolve again with
        // the line in it (the bumper waits this hop); then apply.
        runHop(run) {
            for (;;) {
                const props = run.motions.filter(m => m.phase !== 'done').map(m => this.propose(m, run)).filter(p => p);
                const fates = this.resolve(props, run);
                const bump = props.filter(p => fates.get(p.m).kind === 'bump').sort(byRank)[0];
                if (!bump) return this.applyHop(props, fates, run);
                this.startBump(bump.m, fates.get(bump.m).victim, run);
            }
        }

        // A motion's proposal this hop: { m, hex, lift, blocked } (blocked: terrain or Things
        // close the hex to it, or it has nowhere left to go), or null if it sits this hop out.
        propose(m, run) {
            if (m.phase === 'follow') return this.proposeFollow(m, run);
            const lift = PHASES[m.phase].lift;
            const hex = m.phase === 'drop' ? this.board.get(m.dropTo.q, m.dropTo.r) : this.neighborHex(m.piece, m.dir);
            return { m, hex, lift, blocked: !OPEN_TO[lift](this, m, hex) };
        }

        // A bumper follows its line one hop behind, as far as the line's first piece went.
        proposeFollow(m, run) {
            if (run.hop === m.waitHop) return null;
            const more = m.followed < m.leader.path.length;
            if (!more && m.leader.phase !== 'done') return null;
            const hex = this.neighborHex(m.piece, m.dir);
            return { m, hex, lift: 'ground', blocked: !more || !this.groundOpen(m.piece, hex) };
        }

        // Where each piece that isn't passing over stands as the hop starts, by hex key.
        occupancy(run) {
            const at = new Map();
            for (const p of this.state.pieces) {
                const m = run.byId.get(p.id);
                if (!m || !m.overhead) at.set(p.key(), p);
            }
            return at;
        }

        // Every proposal's fate this hop, by motion: { kind, victim?, other? } with kind
        // 'go' | 'blocked' | 'collide' (two flights meet) | 'wreck' | 'splat' | 'bump'.
        // A shot passing over always goes. Two flights after one hex both crash; otherwise
        // the earliest-ranked claimant gets it and the rest are blocked. Then chains: a hex
        // is free if its occupant leaves this hop (`resolveChain`).
        resolve(props, run) {
            const fates = new Map();
            props.filter(p => p.blocked).forEach(p => fates.set(p.m, { kind: 'blocked' }));
            props.filter(p => !p.blocked && p.lift === 'over').forEach(p => fates.set(p.m, { kind: 'go' }));
            const claims = props.filter(p => !fates.has(p.m));
            this.settleTies(claims, fates);
            const occupants = this.occupancy(run);
            const propOf = new Map(props.map(p => [p.m.piece.id, p]));
            claims.forEach(p => this.resolveChain(p, propOf, occupants, fates, run));
            return fates;
        }

        // Claims on one hex: two or more flights crash there (and ground claimants are
        // blocked); else the earliest rank wins and the rest are blocked.
        settleTies(claims, fates) {
            const byHex = new Map();
            for (const p of claims) {
                const k = p.hex.q + ',' + p.hex.r;
                byHex.set(k, [...(byHex.get(k) || []), p]);
            }
            for (const group of [...byHex.values()].filter(g => g.length > 1)) {
                const air = group.filter(p => p.lift === 'air');
                const crash = air.length > 1;
                const winner = crash ? null : [...group].sort(byRank)[0];
                for (const p of group) {
                    if (crash && p.lift === 'air') fates.set(p.m, { kind: 'collide', other: air.find(o => o !== p).m.piece });
                    else if (p !== winner) fates.set(p.m, { kind: 'blocked' });
                }
            }
        }

        // Follow `p`'s chain of occupants forward to a free hex, a piece that stays, a fate
        // already known, or a cycle; then settle it from the front back. A cycle of 3 or more
        // all go (they rotate); a 2-cycle (a swap) fails, and two flights swapping crash.
        resolveChain(p, propOf, occupants, fates, run) {
            const chain = [];
            for (let cur = p; cur && !fates.has(cur.m);) {
                const i = chain.indexOf(cur);
                if (i >= 0) { this.settleCycle(chain.splice(i), fates); break; }
                chain.push(cur);
                const occ = occupants.get(cur.hex.q + ',' + cur.hex.r);
                cur = occ ? propOf.get(occ.id) : null;
            }
            for (const node of chain.reverse()) {
                const occ = occupants.get(node.hex.q + ',' + node.hex.r);
                const out = occ && propOf.get(occ.id);
                const leaves = !occ || (!!out && VACATES.has(fates.get(out.m).kind));
                fates.set(node.m, leaves ? { kind: 'go' } : this.meet(node, occ, run));
            }
        }

        settleCycle(cycle, fates) {
            if (cycle.length > 2) { cycle.forEach(p => fates.set(p.m, { kind: 'go' })); return; }
            const [a, b] = cycle;
            const crash = a.lift === 'air' && b.lift === 'air';
            fates.set(a.m, crash ? { kind: 'collide', other: b.m.piece } : { kind: 'blocked' });
            fates.set(b.m, crash ? { kind: 'collide', other: a.m.piece } : { kind: 'blocked' });
        }

        // A mover meets `occ`, a piece staying on the hex it wants. A Rocket's flight splats a
        // piece that splats and takes the hex; a wanderer wrecks cargo and takes the hex; a
        // mover that bumps, meeting a piece that has had no motion this tick standing on slick
        // ground, bumps it (D-33); anything else is blocked.
        meet(node, occ, run) {
            const m = node.m;
            if (m.phase === 'air' && m.splat && PIECES[occ.kind].splats) return { kind: 'splat', victim: occ };
            if (m.wrecks && PIECES[occ.kind].cargo) return { kind: 'wreck', victim: occ };
            const still = !run.claimed.has(occ.id) && this.isSlick(this.hexOf(occ));
            return PHASES[m.phase].bumps && still ? { kind: 'bump', victim: occ } : { kind: 'blocked' };
        }

        // `m` bumped `first` (D-33): the line from it on (it and the pieces right behind it in
        // `m.dir` that have had no motion this tick) starts advancing BUMP_ADVANCE hexes this
        // hop, ranked as `m`; `m` waits this hop and then follows as far as `first` went.
        startBump(m, first, run) {
            const line = this.lineFrom(first, m.dir, run);
            const motions = line.map(p => this.newMotion(run, p, m.dir, m.rank, 'line', BUMP_ADVANCE));
            m.aloft = m.aloft || m.phase === 'air';
            m.phase = 'follow';
            m.leader = motions[0];
            m.followed = 0;
            m.waitHop = run.hop;
        }

        lineFrom(first, dir, run) {
            const occupants = this.occupancy(run);
            const line = [first];
            for (;;) {
                const hex = this.neighborHex(line[line.length - 1], dir);
                const next = hex && occupants.get(hex.q + ',' + hex.r);
                if (!next || run.claimed.has(next.id)) return line;
                line.push(next);
            }
        }

        // Carry out the hop's fates: victims go, every mover moves (all at once), then each
        // arrives (its phase decides what that means), then each blocked motion stops.
        applyHop(props, fates, run) {
            const moving = props.filter(p => VACATES.has(fates.get(p.m).kind));
            for (const p of moving) {
                const { victim } = fates.get(p.m);
                if (victim) this.destroy(victim, p.m.piece.id, run);
                p.m.piece.moveTo(p.hex.q, p.hex.r);
                this.record(p.m, p.hex, run.hop);
            }
            for (const p of moving) this.arrive(p.m, fates.get(p.m), p.hex, run);
            const stopped = props.filter(p => fates.get(p.m).kind === 'blocked' && p.m.phase !== 'done');
            for (const p of stopped) this[STOPPED[p.m.phase]](p.m, run);
        }

        // A piece a mover splatted or wrecked: gone, its value lost, its motion over.
        destroy(victim, by, run) {
            this.removePiece(victim);
            this.loseValue(victim);
            const vm = run.byId.get(victim.id);
            if (vm) vm.phase = 'done';
            run.ends.push({ type: 'splat', id: victim.id, by, trap: false, hop: run.hop });
        }

        // Add `hex` to `m`'s path at `hop`, one entry per hop since its first: a hop it sat out
        // repeats its hex (passed over, if it's still up in a shot).
        record(m, hex, hop) {
            if (m.hop === null) m.hop = hop;
            while (m.path.length < hop - m.hop) {
                m.path.push(m.path[m.path.length - 1]);
                if (m.overhead) m.over++;
            }
            m.path.push({ q: hex.q, r: hex.r });
        }

        arrive(m, fate, hex, run) {
            if (fate.kind === 'collide') return this.crash(m, run, fate.other.id);
            if (fate.kind === 'splat') return this.land(m, run, false);
            return this[ARRIVED[m.phase]](m, hex, run);
        }

        // Arrival, by phase (ARRIVED).
        passedOver(m) {
            m.overhead = true;
            m.over++;
            if (--m.left > 0) return;
            m.phase = 'ground';
            m.left = m.groundLeft;
            m.aloft = true;   // still coming down until its first ground step
        }

        flewInto(m, hex, run) {
            m.flown.push(hex);
            const res = this.airResult(m.piece, hex);
            if (res !== 'moved') return this.end(m, res, run);
            if (--m.left === 0) this.land(m, run, true);
        }

        walkedInto(m, hex, run) {
            m.overhead = m.aloft = false;
            if (this.groundEnds(m, hex, run)) return;
            if (!this.isSlick(hex)) m.left--;
            if (m.left <= 0) this.finish(m, run);
        }

        skidInto(m, hex, run) {
            if (this.groundEnds(m, hex, run)) return;
            if (!this.isSlick(hex)) this.finish(m, run);
        }

        advancedInto(m, hex, run) {
            if (this.groundEnds(m, hex, run)) return;
            if (--m.left === 0) this.finish(m, run);
        }

        followedInto(m, hex, run) {
            m.overhead = m.aloft = false;
            m.followed++;
            this.groundEnds(m, hex, run);
        }

        droppedInto(m, hex, run) {
            this.land(m, run, true);
        }

        // A ground arrival that ends the piece (delivered, trapped, sunk) ends its motion.
        groundEnds(m, hex, run) {
            const res = this.groundResult(m.piece, hex);
            if (res !== 'moved') this.end(m, res, run);
            return res !== 'moved';
        }

        // `m` comes down where it is: the landing checks, then a skid on slick ground (D-37)
        // unless `skids` is false (it splatted a gremlin) or it's a gremlin on a Rocket, which
        // splats instead.
        land(m, run, skids) {
            m.overhead = m.aloft = false;
            const res = this.landingResult(m.piece);
            if (res !== 'moved') return this.end(m, res, run);
            if (skids && !m.doomed && this.isSlick(this.hexOf(m.piece))) { m.phase = 'skid'; return; }
            this.finish(m, run);
        }

        // Stopping, by phase (STOPPED). A flight, or a shot not yet down, comes down where it
        // is (`comeDownHere`); a bumper whose line didn't move does too; others just stop.
        groundStopped(m, run) {
            return m.aloft ? this.comeDownHere(m, run) : this.finish(m, run);
        }

        followStopped(m, run) {
            return m.aloft && m.followed === 0 ? this.comeDownHere(m, run) : this.finish(m, run);
        }

        // Nowhere to come down: the drop back was taken.
        dropStopped(m, run) {
            this.crash(m, run, null);
        }

        // An airborne piece stopped by a piece comes down on the hex it's over. Over a
        // mountain or another color's target, a flight drops back next hop to the last hex it
        // flew over that it may land on, or where it started (D-35). A shot over a hex that
        // can't take it (a mountain, another color's target, a Wall, another piece) crashes.
        comeDownHere(m, run) {
            const hex = this.hexOf(m.piece);
            const lands = this.canLand(m.piece, hex) && (!m.overhead || this.standable(m.piece, hex));
            if (lands) return this.land(m, run, true);
            if (m.overhead) return this.crash(m, run, null);
            m.phase = 'drop';
            m.dropTo = [...m.flown].reverse().find(h => this.canLand(m.piece, h)) || m.start;
        }

        // `m`'s piece is destroyed in the air: gone, its value lost (splat, `by` what it hit).
        crash(m, run, by) {
            this.removePiece(m.piece);
            this.loseValue(m.piece);
            run.ends.push({ type: 'splat', id: m.piece.id, by, trap: false, hop: run.hop });
            m.phase = 'done';
        }

        // The motion is over with its piece still on the board; a gremlin on a Rocket splats.
        finish(m, run) {
            if (m.doomed) {
                this.removePiece(m.piece);
                run.ends.push({ type: 'splat', id: m.piece.id, by: null, trap: false, hop: run.hop });
            }
            m.phase = 'done';
        }

        // The motion ended its piece with `res` ('sank' | 'delivered' | 'trapped').
        end(m, res, run) {
            run.ends.push(this.endEvent(m.piece, res, run.hop));
            m.phase = 'done';
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
            const run = { hop: 0, motions: [], byId: new Map(), claimed: new Set(), ends: [] };

            // Claims, as the tick starts: Things that reach ahead (Pusher, Puller) first, so one
            // beside a moving line catches the crate in front before a Belt carries it on; then
            // the rest; each group in placement order (D-24). A piece already claimed isn't
            // claimed again. This order is also each motion's rank for same-hex ties (D-38).
            const reaches = t => THINGS[t.kind].shove > 0 || THINGS[t.kind].pull > 0;
            const order = [...s.things.filter(reaches), ...s.things.filter(t => !reaches(t))];
            order.forEach((thing, rank) => {
                const act = this.actionOf(thing);
                if (!act || !act.piece || !this.affects(thing, act.piece) || run.claimed.has(act.piece.id)) return;
                this.launch(run, act.piece, act.dir, act.how, rank);
            });
            // Unclaimed wanderers pick a direction from the board as it stands, ranked after
            // every Thing. One with nowhere to go has no motion (a bump can still move it).
            s.pieces.filter(p => PIECES[p.kind].wanders && !run.claimed.has(p.id)).forEach((p, i) => {
                const dirs = this.wanderDirs(p);
                if (dirs.length) this.launch(run, p, Rando.choice(dirs), wanderOf(p), order.length + i);
            });
            events.push(...this.runHops(run));

            // Every tick takes the next slot of the spawn cycle (D-43): an open color's source
            // makes its crate if the board is under the cap and the source is clear; a closed
            // color, a full board or a blocked source skips the slot, no retry.
            const color = s.spawnCycle[s.spawnSlot];
            s.spawnSlot = (s.spawnSlot + 1) % s.spawnCycle.length;
            const src = this.openColors().includes(color) && this.crateCount() < this.crateMax() && this.sourceOf(color);
            if (src && !this.pieceAt(src.q, src.r)) {
                const c = this.spawnCrate(color, src);
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

            // Milestones run before the tally, so a gremlin a newly opened endpoint cleared
            // counts and re-emerges like any splat (D-44); their events still go last.
            const reached = this.reachMilestones(deliveredBefore, s.delivered, run.hop);

            // Gremlins a Trap caught count in `trapped`; every other gremlin gone in `exGremlins`.
            const ends = [...events, ...reached].filter(e => e.type === 'sink' || e.type === 'splat');
            const gone = [...first.gone, ...ends.map(e => kindOf.get(e.id))];
            const trappedNow = ends.filter(e => e.trap && kindOf.get(e.id) === 'gremlin').length;
            s.trapped += trappedNow;
            s.exGremlins += gone.filter(kind => kind === 'gremlin').length - trappedNow;
            events.push(...this.emerge(gone), ...reached);

            s.turn++;
            s.phase = 'player';
            return { ok: true, events: [...first.events, ...events] };
        }

        // ---- Commands (every one returns { ok, ... }; ok:false = illegal, unchanged) ----

        // `color` is the Thing's: one of colorChoices(kind) (D-32).
        place(slot, q, r, facing, color) {
            const s = this.state;
            if (!Number.isInteger(slot) || slot < 0 || slot >= s.hand.length) return { ok: false };
            const { kind } = s.hand[slot];
            const aimed = aims(kind);
            if (aimed && !(Number.isInteger(facing) && facing >= 0 && facing < 6)) return { ok: false };
            if (!this.colorChoices(kind).includes(color)) return { ok: false };
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
        // Its splat is at hop 0, before the tick's first hop.
        blast(q, r) {
            const piece = this.pieceAt(q, r);
            if (!piece || !PIECES[piece.kind].cargo) return { ok: false };
            this.removePiece(piece);
            this.loseValue(piece);
            return this.tick({ events: [{ type: 'splat', id: piece.id, by: null, trap: false, hop: 0 }], gone: [piece.kind], usedCard: false });
        }

        // Take a placed Thing off the board, leaving the hex bare. The Thing's card is
        // spent: nothing returns to the hand. (Placing on it replaces it instead, D-28.)
        remove(q, r) {
            const s = this.state;
            const thing = this.thingAt(q, r);
            if (!thing) return { ok: false };
            s.things.splice(s.things.indexOf(thing), 1);
            // A piece left standing on open water (its Bridge is gone) sinks before the tick (hop 0).
            const piece = this.pieceAt(q, r);
            if (!piece || !this.isOpenWater(this.board.get(q, r))) return this.tick(NOTHING_FIRST);
            this.sink(piece);
            return this.tick({ events: [{ type: 'sink', id: piece.id, hop: 0 }], gone: [piece.kind], usedCard: false });
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
