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
    const { TERRAIN, MOVEMENT_COST, PLAYER_MP, MAP_COLS, MAP_ROWS } = GameArtifacts;

    class GameEngine {
        constructor(state) {
            this.state = state;
        }

        // ---- Terrain passability (single source of truth) ----
        // A hex is passable iff its terrain has a finite movement cost; water/mountain
        // are Infinity. Enemy movement, spawning, and placement all route through here.
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
        // Regenerates (up to 20 tries) until a path exists from player to target.
        // A seed may be supplied for reproducibility; otherwise one is drawn once and
        // stored, so the resulting game can always be reproduced from state.seed.
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
                this.placePlayerAndTarget();
                attempts++;
            } while (!this.hasPath(s.player, s.target) && attempts < 20);

            this.spawnEnemies();
            s.turn = 1;
            s.mp = PLAYER_MP;
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
                        terrain: null, resource: null,
                        units: [], controlled: false
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

            // Scatter forests among plains (~10% of total)
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

        // Player on the far-left passable slice, target on the far-right.
        placePlayerAndTarget() {
            const passable = this.passableHexes();
            passable.sort((a, b) => a.col - b.col);

            const leftSlice = passable.slice(0, Math.max(5, Math.floor(passable.length * 0.03)));
            const ph = Rando.choice(leftSlice);
            this.state.player = { q: ph.q, r: ph.r };

            const rightSlice = passable.slice(-Math.max(5, Math.floor(passable.length * 0.03)));
            const th = Rando.choice(rightSlice);
            this.state.target = { q: th.q, r: th.r };
        }

        hasPath(from, to) {
            if (!from || !to) return false;
            const costs = bfsHexes(from, this.state.hexes, hex => this.moveCost(hex), Infinity);
            return costs.has(Hex.key(to.q, to.r));
        }

        // 2d6 enemies on passable hexes, each given a distinct color for identity.
        spawnEnemies() {
            const s = this.state;
            const count = Rando.int(1, 6) + Rando.int(1, 6);
            s.enemies = [];
            const occupied = new Set([Hex.key(s.player.q, s.player.r), Hex.key(s.target.q, s.target.r)]);
            const candidates = this.passableHexes().filter(hex => !occupied.has(Hex.key(hex.q, hex.r)));
            Rando.shuffle(candidates);
            for (let i = 0; i < count && i < candidates.length; i++) {
                const h = candidates[i];
                s.enemies.push({ q: h.q, r: h.r });
                occupied.add(Hex.key(h.q, h.r));
            }

            s.enemyColors = [];
            const scheme = ColorTheory.randomScheme(() => Rando.random());
            for (let i = 0; i < s.enemies.length; i++) {
                const [r, g, b] = scheme[i % scheme.length];
                s.enemyColors.push(ColorTheory.rgbToHex(r, g, b));
            }
        }

        // ---- Legal-move computation (the rules the UI highlights and the engine enforces) ----

        // Cost-limited flood fill bounded by remaining MP; enemy hexes are walls.
        computeReachable() {
            const s = this.state;
            if (s.mp <= 0) return new Map();
            const enemyKeys = new Set(s.enemies.map(e => Hex.key(e.q, e.r)));
            const costs = bfsHexes(s.player, s.hexes, hex => {
                if (enemyKeys.has(Hex.key(hex.q, hex.r))) return Infinity;
                return this.moveCost(hex);
            }, s.mp);
            costs.delete(Hex.key(s.player.q, s.player.r));
            return costs;
        }

        // L3 attackable set — extension point. No combat yet, so it is always empty.
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
        //   { ok:false }                 illegal, nothing changed
        //   { ok:true }                  moved, player's turn continues
        //   { ok:true, won:true }        moved onto the target
        //   { ok:true, endedTurn:true }  moved and spent the last MP (turn auto-ended)
        movePlayer(q, r) {
            const s = this.state;
            const reachable = this.computeReachable();
            const cost = reachable.get(Hex.key(q, r));
            if (cost === undefined) return { ok: false };

            s.player = { q, r };
            s.mp -= cost;

            if (q === s.target.q && r === s.target.r) {
                s.gameWon = true;
                return { ok: true, won: true };
            }
            if (s.mp <= 0) {
                this.endTurn();
                return { ok: true, endedTurn: true };
            }
            return { ok: true };
        }

        // Resolve the enemy phase and advance to the player's next turn.
        endTurn() {
            const s = this.state;
            if (s.gameWon) return;
            s.phase = 'enemy';
            this.moveEnemies();
            s.phase = 'player';
            s.turn++;
            s.mp = PLAYER_MP;
        }

        // Each enemy steps to one random passable, unoccupied neighbor (or stays put).
        moveEnemies() {
            const s = this.state;
            const occupied = new Set([Hex.key(s.player.q, s.player.r)]);
            for (const e of s.enemies) occupied.add(Hex.key(e.q, e.r));

            for (const enemy of s.enemies) {
                const neighbors = new Hex(enemy.q, enemy.r).neighbors();
                const valid = neighbors.filter(n => {
                    const key = n.key();
                    const hex = s.hexes.get(key);
                    if (!hex) return false;
                    if (!this.isPassable(hex)) return false;
                    if (occupied.has(key)) return false;
                    return true;
                });
                if (valid.length > 0) {
                    occupied.delete(Hex.key(enemy.q, enemy.r));
                    const dest = Rando.choice(valid);
                    enemy.q = dest.q;
                    enemy.r = dest.r;
                    occupied.add(Hex.key(enemy.q, enemy.r));
                }
            }
        }
    }

    return GameEngine;
})();
