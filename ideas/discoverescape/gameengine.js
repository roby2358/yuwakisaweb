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
//  - movePlayer re-derives legality from the engine's own computeReachable rather than
//    trusting a caller-supplied cost — the "never trust the client" rule, baked in now
//    so a future command/network layer doesn't have to re-audit every action.
const GameEngine = (function () {
    const { TERRAIN, MOVEMENT_COST, PLAYER_MP, MAP_COLS, MAP_ROWS,
        SIGHT, LOS_BLOCKERS, RELIC, CAIRN, NIGHT_TURN, HUNTER } = GameArtifacts;
    const BLOCKS_LOS = new Set(LOS_BLOCKERS);

    class GameEngine {
        constructor(state) {
            this.state = state;
        }

        // ---- Terrain passability (single source of truth) ----
        // A hex is passable iff its terrain has a finite movement cost; water/mountain
        // are Infinity. Hunter movement, spawning, and placement all route through here.
        moveCost(hex) {
            return MOVEMENT_COST[hex.terrain] ?? Infinity;
        }

        isPassable(hex) {
            return this.moveCost(hex) !== Infinity;
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

        // ---- New game / world generation ----
        // Regenerates (up to 20 tries) until every tomb is reachable from the boat.
        // A seed may be supplied for reproducibility; otherwise one is drawn once and
        // stored, so the resulting game can always be reproduced from state.seed.
        newGame(seed) {
            const s = this.state;
            s.seed = (seed === undefined || seed === null)
                ? Math.floor(Math.random() * 0x100000000)
                : (seed >>> 0);
            Rando.seed(s.seed);

            let attempts = 0;
            let placed = false;
            do {
                s.hexes = this.generateRectGrid();
                this.assignTerrain();
                placed = this.placeBoat() && this.placeRelics();
                attempts++;
            } while (!placed && attempts < 20);
            this.placeCairns();

            s.hunters = [];
            s.carried = 0;
            s.turn = 1;
            s.mp = PLAYER_MP;
            s.night = false;
            s.phase = 'player';
            s.gameWon = false;
            s.gameLost = false;

            this.reveal(s.boat, SIGHT.LANDING);
            this.glimpse(s.boat);
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
        // Every hex starts unexplored — the fog is the game.
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
                        terrain: null, explored: false, glimpsed: false
                    });
                }
            }
            return hexes;
        }

        // Base terrain by elevation percentile, then forests scattered among plains;
        // edges forced to water so the island is an island.
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

            // Scatter forests among plains (~12% of total)
            const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS);
            Rando.shuffle(plains);
            const forestCount = Math.round(n * 0.12);
            for (let i = 0; i < forestCount && i < plains.length; i++)
                plains[i].terrain = TERRAIN.FOREST;
        }

        // The open sea: every water hex connected to the map edge (all edges are
        // water), flood-filled — so inland lakes don't count as ocean.
        oceanKeys() {
            const s = this.state;
            const ocean = new Set();
            const stack = [];
            for (const [key, hex] of s.hexes) {
                if (hex.isEdge) { ocean.add(key); stack.push(hex); }
            }
            while (stack.length) {
                const hex = stack.pop();
                for (const n of new Hex(hex.q, hex.r).neighbors()) {
                    const key = n.key();
                    const nh = s.hexes.get(key);
                    if (!nh || ocean.has(key)) continue;
                    if (nh.terrain !== TERRAIN.WATER) continue;
                    ocean.add(key);
                    stack.push(nh);
                }
            }
            return ocean;
        }

        // The boat lands on a waterfront hex — passable, touching the open sea (a
        // lakeshore is no place for a boat) — on the far-left slice of the coast.
        // Returns false if the map has no waterfront (caller regenerates).
        placeBoat() {
            const ocean = this.oceanKeys();
            const waterfront = this.passableHexes().filter(h =>
                new Hex(h.q, h.r).neighbors().some(n => ocean.has(n.key())));
            if (waterfront.length === 0) return false;
            waterfront.sort((a, b) => a.col - b.col);
            const leftSlice = waterfront.slice(0, Math.max(5, Math.floor(waterfront.length * 0.03)));
            const bh = Rando.choice(leftSlice);
            this.state.boat = { q: bh.q, r: bh.r };
            this.state.player = { q: bh.q, r: bh.r };
            return true;
        }

        // Tombs sit deep in the island: right of MIN_COL_FRAC, pairwise spaced, and
        // each reachable from the boat. Returns false if a full set couldn't be placed
        // (caller regenerates the map).
        placeRelics() {
            const s = this.state;
            const minCol = Math.floor(MAP_COLS * RELIC.MIN_COL_FRAC);
            const candidates = this.passableHexes().filter(h => h.col >= minCol);
            Rando.shuffle(candidates);

            s.relics = [];
            for (const h of candidates) {
                if (s.relics.length >= RELIC.COUNT) break;
                const hexH = new Hex(h.q, h.r);
                if (s.relics.some(t => hexH.distance(t) < RELIC.MIN_SPACING)) continue;
                if (!this.hasPath(s.boat, h)) continue;
                s.relics.push({ q: h.q, r: h.r, taken: false });
            }
            return s.relics.length === RELIC.COUNT;
        }

        // Standing stones: spaced, off the tombs, anywhere past the landing strip.
        // Best-effort — a map with fewer cairns is playable, so no regeneration.
        placeCairns() {
            const s = this.state;
            const minCol = Math.floor(MAP_COLS * CAIRN.MIN_COL_FRAC);
            const relicKeys = new Set(s.relics.map(t => Hex.key(t.q, t.r)));
            const candidates = this.passableHexes()
                .filter(h => h.col >= minCol && !relicKeys.has(Hex.key(h.q, h.r)));
            Rando.shuffle(candidates);

            s.cairns = [];
            for (const h of candidates) {
                if (s.cairns.length >= CAIRN.COUNT) break;
                const hexH = new Hex(h.q, h.r);
                if (s.cairns.some(c => hexH.distance(c) < CAIRN.MIN_SPACING)) continue;
                s.cairns.push({ q: h.q, r: h.r, used: false });
            }
        }

        hasPath(from, to) {
            if (!from || !to) return false;
            const costs = bfsHexes(from, this.state.hexes, hex => this.moveCost(hex), Infinity);
            return costs.has(Hex.key(to.q, to.r));
        }

        // ---- Fog of war ----

        reveal(center, radius) {
            for (const h of new Hex(center.q, center.r).inRange(radius)) {
                const hex = this.state.hexes.get(h.key());
                if (hex) hex.explored = true;
            }
        }

        // How far you see from a hex: hills buy the long view.
        sightRadius(hex) {
            return hex.terrain === TERRAIN.HILLS ? SIGHT.HILLS : SIGHT.BASE;
        }

        // The distant glimpse: beyond the reveal radius, straight sightlines out to
        // GLIMPSE mark hexes as glimpsed — the shape of the land, not its details.
        // Hills, mountains, and forests block the line (the blocker itself is seen;
        // what's behind it isn't). Glimpses are sticky, like exploration.
        glimpse(center) {
            const from = new Hex(center.q, center.r);
            for (const h of from.inRange(SIGHT.GLIMPSE)) {
                const hex = this.state.hexes.get(h.key());
                if (!hex || hex.glimpsed) continue;
                if (this.losClear(from, h)) hex.glimpsed = true;
            }
        }

        // True when no LOS-blocking terrain stands strictly between the endpoints.
        losClear(from, to) {
            const line = from.lineTo(to);
            for (let i = 1; i < line.length - 1; i++) {
                const hex = this.state.hexes.get(line[i].key());
                if (!hex || BLOCKS_LOS.has(hex.terrain)) return false;
            }
            return true;
        }

        // ---- Legal-move computation (the rules the UI highlights and the engine enforces) ----

        // Cost-limited flood fill bounded by remaining MP. Hunter hexes are walls, and
        // so is the fog: you can only move onto hexes you have seen. Baked into the
        // movement cost so the UI's highlights *are* the rule.
        computeReachable() {
            const s = this.state;
            if (s.mp <= 0) return new Map();
            const hunterKeys = new Set(s.hunters.map(h => Hex.key(h.q, h.r)));
            const costs = bfsHexes(s.player, s.hexes, hex => {
                if (!hex.explored) return Infinity;
                if (hunterKeys.has(Hex.key(hex.q, hex.r))) return Infinity;
                return this.moveCost(hex);
            }, s.mp);
            costs.delete(Hex.key(s.player.q, s.player.r));
            return costs;
        }

        // L3 attackable set — extension point. No combat: the isle is escaped, not fought.
        computeAttackable() {
            return new Set();
        }

        // L2.1 extension point: an interactive location at this hex, or null.
        locationAt(/* p */) {
            return null;
        }

        // ---- Actions (mutate state, return an outcome; no rendering) ----

        // Move the player to (q, r) if legal. Re-derives legality here rather than
        // trusting a caller-supplied cost. Returns:
        //   { ok:false }                     illegal, nothing changed
        //   { ok:true, ... }                 moved; flags describe what the hex did:
        //     relic:true                     took a relic (a tomb burst awake)
        //     cairn:true                     lit a standing stone (big reveal)
        //     won:true                       reached the boat carrying a relic
        //     endedTurn:true                 spent the last MP (turn auto-ended)
        //     caught:true                    the auto-ended turn let a hunter reach you
        movePlayer(q, r) {
            const s = this.state;
            const reachable = this.computeReachable();
            const cost = reachable.get(Hex.key(q, r));
            if (cost === undefined) return { ok: false };

            s.player = { q, r };
            s.mp -= cost;

            const outcome = { ok: true };
            const hex = s.hexes.get(Hex.key(q, r));
            this.reveal(hex, this.sightRadius(hex));
            this.glimpse(hex);

            const cairn = s.cairns.find(c => !c.used && c.q === q && c.r === r);
            if (cairn) {
                cairn.used = true;
                this.reveal(cairn, SIGHT.CAIRN);
                outcome.cairn = true;
            }

            const relic = s.relics.find(t => !t.taken && t.q === q && t.r === r);
            if (relic) {
                relic.taken = true;
                s.carried++;
                this.burstFromTomb(relic);
                outcome.relic = true;
            }

            if (q === s.boat.q && r === s.boat.r && s.carried > 0) {
                s.gameWon = true;
                outcome.won = true;
                return outcome;
            }
            if (s.mp <= 0) {
                const end = this.endTurn();
                outcome.endedTurn = true;
                if (end.caught) outcome.caught = true;
            }
            return outcome;
        }

        // Resolve the enemy phase and advance to the player's next turn.
        // Returns { caught } so callers know if the hunters ended the game.
        endTurn() {
            const s = this.state;
            if (s.gameWon || s.gameLost) return { caught: s.gameLost };
            s.phase = 'enemy';
            this.moveHunters();
            if (!s.gameLost) {
                this.trickleFromTombs();
                this.decayFarHunters();
            }
            s.turn++;
            if (s.turn >= NIGHT_TURN) s.night = true;
            s.phase = 'player';
            s.mp = PLAYER_MP;
            return { caught: s.gameLost };
        }

        // ---- Hunters ----

        // A hunter's MP budget for one enemy phase.
        hunterBudget(hunter) {
            return hunter.speed + (this.state.night ? HUNTER.NIGHT_BONUS_MP : 0);
        }

        // How far the stolen relics can be smelled: pursuit range, growing with greed.
        scentRange() {
            const s = this.state;
            return HUNTER.SCENT_BASE + HUNTER.SCENT_PER_CARRIED * s.carried
                + (s.night ? HUNTER.NIGHT_SCENT_BONUS : 0);
        }

        // Each hunter A*-paths to the player (full path, then walk the budget — no
        // local-horizon wandering) paying the same terrain costs as the player.
        // Another hunter in the way ends its walk; stepping onto the player kills.
        moveHunters() {
            const s = this.state;
            const occupied = new Set(s.hunters.map(h => Hex.key(h.q, h.r)));
            const passable = (q, r) => {
                const hex = s.hexes.get(Hex.key(q, r));
                return !!hex && this.isPassable(hex);
            };
            const cost = (q, r) => this.moveCost(s.hexes.get(Hex.key(q, r)));

            const player = new Hex(s.player.q, s.player.r);
            const scent = this.scentRange();
            for (const hunter of s.hunters) {
                // Burst-spawned hunters spend their first enemy phase clawing out of
                // the earth — the player always gets a full turn of head start, so a
                // burst can never seal a pocket before there's a chance to run.
                if (hunter.dormant) { hunter.dormant = false; continue; }
                // Out of scent range: the hunter stands torpid. Breaking contact is
                // the counterplay — run far enough and the pack forgets you.
                if (player.distance(hunter) > scent) continue;
                if (Rando.random() < HUNTER.HESITATE_CHANCE) continue;
                const path = findPath(hunter, s.player, passable, cost, HUNTER.PATH_MAX_COST);
                if (!path) continue;

                let budget = this.hunterBudget(hunter);
                for (let i = 1; i < path.length; i++) {
                    const step = path[i];
                    const stepKey = step.key();
                    budget -= cost(step.q, step.r);
                    if (budget < 0) break;
                    if (stepKey === Hex.key(s.player.q, s.player.r)) {
                        this.moveHunterTo(hunter, step, occupied);
                        s.gameLost = true;
                        return;
                    }
                    if (occupied.has(stepKey)) break;
                    this.moveHunterTo(hunter, step, occupied);
                }
            }
        }

        moveHunterTo(hunter, step, occupied) {
            occupied.delete(Hex.key(hunter.q, hunter.r));
            hunter.q = step.q;
            hunter.r = step.r;
            occupied.add(Hex.key(hunter.q, hunter.r));
        }

        // Spawn one hunter on a Rando-chosen hex from `candidates`, rolling its speed.
        // All spawn paths (burst + trickle) route through here so the cap, the
        // keep-away-from-the-player rule, and the speed roll live in one place.
        spawnHunter(candidates, dormant) {
            const s = this.state;
            if (s.hunters.length >= HUNTER.MAX) return;
            const player = new Hex(s.player.q, s.player.r);
            const taken = new Set(s.hunters.map(h => Hex.key(h.q, h.r)));
            const legal = candidates.filter(h =>
                !taken.has(Hex.key(h.q, h.r)) &&
                player.distance(h) >= HUNTER.SPAWN_MIN_PLAYER_DIST);
            if (legal.length === 0) return;
            const spot = Rando.choice(legal);
            const speed = HUNTER.SPEED_BY_ROLL[Rando.int(1, 6)];
            s.hunters.push({ q: spot.q, r: spot.r, speed, dormant });
        }

        // Passable hexes in a distance band around a center — spawn real estate.
        ringHexes(center, minDist, maxDist) {
            const c = new Hex(center.q, center.r);
            return c.inRange(maxDist)
                .map(h => this.state.hexes.get(h.key()))
                .filter(hex => hex && this.isPassable(hex) && c.distance(hex) >= minDist);
        }

        // Taking a relic wakes the tomb: hunters erupt in a ring 6-10 hexes out —
        // the drums start, but never close enough for a same-turn kill.
        burstFromTomb(tomb) {
            const ring = this.ringHexes(tomb, HUNTER.BURST_MIN_DIST, HUNTER.BURST_MAX_DIST);
            for (let i = 0; i < HUNTER.BURST_SIZE; i++) this.spawnHunter(ring, true);
        }

        // The greed clock: every plundered tomb births one more hunter on an interval
        // that shrinks with every relic carried (and shrinks again at night).
        trickleFromTombs() {
            const s = this.state;
            const every = Math.max(HUNTER.TRICKLE_MIN,
                HUNTER.TRICKLE_BASE - HUNTER.TRICKLE_PER_CARRIED * s.carried
                - (s.night ? HUNTER.NIGHT_TRICKLE_BONUS : 0));
            if (s.turn % every !== 0) return;
            // Trickle spawns land after this turn's movement, so they already sit
            // out one enemy phase — no dormancy needed on top.
            for (const tomb of s.relics) {
                if (!tomb.taken) continue;
                this.spawnHunter(this.ringHexes(tomb, 0, HUNTER.TRICKLE_DIST), false);
            }
        }

        // Hunters that fall far behind may sink back into the earth — the chase stays
        // a chase near the player, not an ever-growing wall.
        decayFarHunters() {
            const s = this.state;
            const player = new Hex(s.player.q, s.player.r);
            s.hunters = s.hunters.filter(h =>
                player.distance(h) <= HUNTER.DECAY_DISTANCE ||
                Rando.random() >= HUNTER.DECAY_CHANCE);
        }
    }

    return GameEngine;
})();
