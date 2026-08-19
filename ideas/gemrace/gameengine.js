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
    const { TERRAIN, GEMS, GEM_EFFECTS, GEM_FREQUENCY, PLAYER_MP, MAP_COLS, MAP_ROWS } = GameArtifacts;

    class GameEngine {
        constructor(state) {
            this.state = state;
        }

        // Terrain queries (moveCost / isPassable / passableHexes / neighbors / hasPath) live
        // on this.board — a query layer over state.hexes, rebuilt whenever the map is.

        monsterKeys() {
            return new Set(this.state.monsters.map(monster => monster.key()));
        }

        // ---- New game / world generation ----
        // A seed may be supplied for reproducibility; otherwise one is drawn once and
        // stored, so the resulting game can always be reproduced from state.seed.
        newGame(seed) {
            const s = this.state;
            s.seed = (seed === undefined || seed === null)
                ? Math.floor(Math.random() * 0x100000000)
                : (seed >>> 0);
            Rando.seed(s.seed);

            s.hexes = this.generateRectGrid();
            this.board = new Board(s.hexes);
            this.assignTerrain();
            this.placePlayerAndHome();

            this.sinkIslands();
            this.spawnMonsters();
            s.inventory = {};
            const palettes = Object.keys(GEMS).filter(type => type !== 'sunstone');
            palettes.forEach(type => { s.inventory[type] = 0; });
            const effects = Object.keys(GEM_EFFECTS);
            Rando.shuffle(effects);
            s.effectByGem = {};
            palettes.forEach((type, i) => { s.effectByGem[type] = effects[i]; });
            s.sunstones = 0;
            s.activeEffect = null;
            s.gems = [];
            for (let i = 0; i < GameArtifacts.SUNSTONES_REQUIRED; i++) this.spawnGem(['sunstone']);
            for (let i = 0; i < GameArtifacts.INITIAL_ORDINARY_GEMS; i++) this.spawnGem(palettes);
            s.turn = 1;
            s.mp = PLAYER_MP;
            s.phase = 'player';
            s.status = 'playing';
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
                        terrain: null
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

        // Place home near the geometric center with a fully passable six-hex ring.
        placePlayerAndHome() {
            const centerCol = (MAP_COLS - 1) / 2;
            const centerRow = (MAP_ROWS - 1) / 2;
            const safe = this.board.passableHexes().filter(hex => {
                const ring = this.board.neighbors(hex.q, hex.r);
                return ring.length === 6 && ring.every(neighbor => this.board.isPassable(neighbor));
            });
            safe.sort((a, b) => {
                const da = (a.col - centerCol) ** 2 + (a.row - centerRow) ** 2;
                const db = (b.col - centerCol) ** 2 + (b.row - centerRow) ** 2;
                return da - db;
            });
            const home = Rando.choice(safe.slice(0, Math.min(7, safe.length)));
            if (!home) throw new Error('Unable to find a center city with a passable surrounding ring');
            this.state.player = new Piece(home.q, home.r, null, 'P');
            this.state.home = new Piece(home.q, home.r, null, '⌂');
        }

        reachableLandKeys(origin) {
            const reached = new Set([Hex.key(origin.q, origin.r)]);
            const queue = [{ q: origin.q, r: origin.r }];
            for (let i = 0; i < queue.length; i++) {
                const current = queue[i];
                for (const neighbor of this.board.neighbors(current.q, current.r)) {
                    const key = Hex.key(neighbor.q, neighbor.r);
                    if (reached.has(key) || !this.board.isPassable(neighbor)) continue;
                    reached.add(key);
                    queue.push(neighbor);
                }
            }
            return reached;
        }

        // Any land disconnected from the home city becomes water. All later spawns
        // therefore occur on the one player-traversable landmass.
        sinkIslands() {
            const connected = this.reachableLandKeys(this.state.player);
            for (const hex of this.board.passableHexes()) {
                if (!connected.has(Hex.key(hex.q, hex.r))) hex.terrain = TERRAIN.WATER;
            }
        }

        // 2d6 monsters on passable hexes, each carrying a distinct seeded color.
        spawnMonsters() {
            const s = this.state;
            const count = Rando.int(1, 6) + Rando.int(1, 6);
            s.monsters = [];
            const occupied = new Set([s.player.key(), s.home.key()]);
            const candidates = this.board.passableHexes().filter(hex => !occupied.has(Hex.key(hex.q, hex.r)));
            Rando.shuffle(candidates);
            const scheme = ColorTheory.randomScheme(() => Rando.random());
            for (let i = 0; i < count && i < candidates.length; i++) {
                const h = candidates[i];
                const [r, g, b] = scheme[i % scheme.length];
                s.monsters.push(new Piece(h.q, h.r, ColorTheory.rgbToHex(r, g, b), 'M'));
                occupied.add(Hex.key(h.q, h.r));
            }
        }

        // ---- Legal-move computation (the rules the UI highlights and the engine enforces) ----

        // Cost-limited flood fill bounded by remaining MP; monster hexes are walls.
        computeReachable() {
            const s = this.state;
            if (s.mp <= 0) return new Map();
            const monsterKeys = this.monsterKeys();
            const costs = bfsHexes(s.player, s.hexes, hex => {
                if (monsterKeys.has(Hex.key(hex.q, hex.r))) return Infinity;
                if (this.hasEffect('tread')) return this.board.isPassable(hex) ? 1 : Infinity;
                if (this.hasEffect('current') && (hex.terrain === TERRAIN.FOREST || hex.terrain === TERRAIN.HILLS)) return 1;
                return this.board.moveCost(hex);
            }, s.mp);
            costs.delete(s.player.key());
            return costs;
        }

        // ---- Actions (mutate state, return an outcome; no rendering) ----

        // Move the player to (q, r) if legal. Re-derives legality here rather than
        // trusting a caller-supplied cost. Returns:
        //   { ok:false }                 illegal, nothing changed
        //   { ok:true }                  moved, player's turn continues
        //   { ok:true, won:true }        returned home with three Sunstones
        //   { ok:true, endedTurn:true }  moved and spent the last MP (turn auto-ended)
        movePlayer(q, r) {
            const s = this.state;
            const reachable = this.computeReachable();
            const cost = reachable.get(Hex.key(q, r));
            if (cost === undefined) return { ok: false };

            s.player.moveTo(q, r);
            s.mp -= cost;

            const collected = this.collectGemsNear(q, r);

            if (q === s.home.q && r === s.home.r && s.sunstones >= GameArtifacts.SUNSTONES_REQUIRED) {
                s.status = 'won';
                return { ok: true, won: true, collected };
            }
            if (s.mp <= 0) {
                this.endTurn();
                return { ok: true, endedTurn: true, collected, lost: s.status === 'lost' };
            }
            return { ok: true, collected };
        }

        activeEffectId() {
            const active = this.state.activeEffect;
            return active ? this.state.effectByGem[active.gemType] : null;
        }

        hasEffect(id) { return this.activeEffectId() === id; }

        activateGem(type) {
            const s = this.state;
            if (s.phase !== 'player' || s.status !== 'playing' || !s.inventory[type]) return false;
            const id = s.effectByGem[type];
            const effect = GEM_EFFECTS[id];
            if (!effect) return false;
            s.inventory[type]--;
            s.activeEffect = { gemType: type, turnsLeft: effect.turns };
            if (id === 'sprint') s.mp += 6;
            if (id === 'haste') s.mp += 3;
            return true;
        }

        collectGemsNear(q, r) {
            const keys = new Set([Hex.key(q, r)]);
            if (this.hasEffect('magnet')) this.board.neighbors(q, r).forEach(h => keys.add(Hex.key(h.q, h.r)));
            const collected = [];
            for (let i = this.state.gems.length - 1; i >= 0; i--) {
                const gem = this.state.gems[i];
                if (!keys.has(Hex.key(gem.q, gem.r))) continue;
                this.state.gems.splice(i, 1);
                if (gem.type === 'sunstone') this.state.sunstones++;
                else this.state.inventory[gem.type]++;
                collected.push(gem.type);
                this.spawnGem(Object.keys(GEMS).filter(type => type !== 'sunstone'));
            }
            return collected;
        }

        spawnGem(allowedTypes) {
            const s = this.state;
            const occupied = new Set([s.player?.key(), ...s.monsters.map(monster => monster.key()), ...s.gems.map(g => Hex.key(g.q, g.r))]);
            const candidates = this.board.passableHexes().filter(h => GEM_FREQUENCY[h.terrain] && !occupied.has(Hex.key(h.q, h.r)));
            if (!candidates.length) return;
            const h = Rando.choice(candidates);
            const weights = Object.entries(GEM_FREQUENCY[h.terrain]).filter(([type]) => allowedTypes.includes(type));
            let roll = Rando.random() * weights.reduce((sum, [, n]) => sum + n, 0);
            let type = allowedTypes[0];
            for (const [candidate, weight] of weights) {
                roll -= weight;
                if (roll < 0) { type = candidate; break; }
            }
            s.gems.push({ q: h.q, r: h.r, type });
        }

        // Resolve the monster phase and advance to the player's next turn.
        endTurn() {
            const s = this.state;
            if (s.status !== 'playing') return;
            s.phase = 'monsters';
            const carriedMp = this.hasEffect('patience') ? s.mp : 0;
            this.moveMonsters();
            if (s.status === 'lost') return;
            if (s.activeEffect) {
                s.activeEffect.turnsLeft--;
                if (s.activeEffect.turnsLeft <= 0) s.activeEffect = null;
            }
            s.phase = 'player';
            s.turn++;
            s.mp = PLAYER_MP + carriedMp + (this.hasEffect('haste') ? 3 : 0);
        }

        // Monsters pursue inside aggro range and wander outside it.
        moveMonsters() {
            const s = this.state;
            if (this.hasEffect('freeze')) return;
            const occupied = this.monsterKeys();

            for (let step = 0; step < GameArtifacts.MONSTER_MOVEMENT; step++) {
                for (const monster of s.monsters) {
                    const valid = this.board.neighbors(monster.q, monster.r).filter(hex => {
                        if (!this.board.isPassable(hex)) return false;
                        if (occupied.has(Hex.key(hex.q, hex.r))) return false;
                        return true;
                    });
                    if (valid.length === 0) continue;
                    occupied.delete(monster.key());
                    const distance = new Hex(monster.q, monster.r).distance(s.player);
                    const aggro = this.hasEffect('mirage') ? 2 : GameArtifacts.MONSTER_AGGRO_RANGE;
                    const pursuing = distance <= aggro && !this.hasEffect('veil');
                    const fleeing = distance <= aggro && (this.hasEffect('howl') || this.hasEffect('blink'));
                    let dest;
                    if (pursuing || fleeing) {
                        const scored = valid.map(h => ({ h, d: new Hex(h.q, h.r).distance(s.player) }));
                        const desired = fleeing ? Math.max(...scored.map(x => x.d)) : Math.min(...scored.map(x => x.d));
                        dest = Rando.choice(scored.filter(x => x.d === desired).map(x => x.h));
                    } else dest = Rando.choice(valid);
                    monster.moveTo(dest.q, dest.r);
                    occupied.add(monster.key());
                    if (monster.isAt(s.player.q, s.player.r)) {
                        if (this.hasEffect('ward')) s.activeEffect = null;
                        else { s.status = 'lost'; return; }
                    }
                }
            }
        }
    }

    return GameEngine;
})();
