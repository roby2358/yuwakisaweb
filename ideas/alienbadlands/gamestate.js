// gamestate.js — GameState
//
// The authoritative, serializable game data — nothing else. No DOM, no canvas, no rules
// behavior, no view/interaction state. This is exactly what a server would own and ship
// to clients, and exactly what the autosave writes to localStorage each day.
//
// Serialization: toJSON() flattens the hex Map into per-row terrain arrays (elevation is
// generation-only and not kept); fromJSON() rebuilds the grid with the same layout math.
// Prototype rule: no save migration — an old save that fails to load just starts fresh.
const GameState = (function () {
    const { WORLD } = GameArtifacts;

    class GameState {
        constructor() {
            this.seed = 0;                 // reproducibility anchor for world generation
            this.day = 1;
            this.hexes = null;             // Map<"q,r", {q,r,col,row,elevation,isEdge,terrain,yield}>
            this.seen = new Set();         // hex keys ever revealed (fog of exploration)
            this.player = null;            // { q,r, hp, credits, cargo:{mat:n}, mounted }
            this.bike = null;              // { q,r, hp } or null (destroyed/eaten)
            this.settlements = [];         // { q,r, name, kind:'starport'|'town'|'settlement', wealth, demand:{mat:mult} }
            this.camps = [];               // { q,r, gang, bank }
            this.bandits = [];             // { q,r, hp, gang, loot, target:{q,r} }
            this.predators = [];           // { q,r, kind, hp }
            this.caches = [];              // { q,r, cargo:{mat:n}, credits } — dropped goods
            this.upgrades = [];            // owned upgrade ids
            this.campsRazed = 0;           // escalation counter for new camp banks
            this.mp = 0;
            this.phase = 'player';         // 'player' | 'world'
            this.gameWon = false;          // ticket bought (play may continue)
        }

        toJSON() {
            const terrain = [];
            const yields = {};
            for (let row = 0; row < WORLD.MAP_ROWS; row++) {
                const qOffset = -Math.floor(row / 2);
                const rowArr = [];
                for (let col = 0; col < WORLD.MAP_COLS; col++) {
                    const hex = this.hexes.get(`${col + qOffset},${row}`);
                    rowArr.push(hex.terrain);
                    if (hex.yield != null) yields[`${col + qOffset},${row}`] = hex.yield;
                }
                terrain.push(rowArr);
            }
            return {
                seed: this.seed, day: this.day,
                terrain, yields, seen: Array.from(this.seen),
                player: this.player, bike: this.bike,
                settlements: this.settlements, camps: this.camps,
                bandits: this.bandits, predators: this.predators,
                caches: this.caches, upgrades: this.upgrades,
                campsRazed: this.campsRazed,
                mp: this.mp, phase: this.phase, gameWon: this.gameWon
            };
        }

        static fromJSON(obj) {
            const s = new GameState();
            s.seed = obj.seed; s.day = obj.day;
            s.hexes = new Map();
            for (let row = 0; row < WORLD.MAP_ROWS; row++) {
                const qOffset = -Math.floor(row / 2);
                for (let col = 0; col < WORLD.MAP_COLS; col++) {
                    const q = col + qOffset, r = row;
                    const isEdge = row === 0 || row === WORLD.MAP_ROWS - 1 ||
                        col === 0 || col === WORLD.MAP_COLS - 1;
                    s.hexes.set(`${q},${r}`, {
                        q, r, col, row, elevation: 0, isEdge,
                        terrain: obj.terrain[row][col], yield: null
                    });
                }
            }
            for (const [key, y] of Object.entries(obj.yields)) s.hexes.get(key).yield = y;
            s.seen = new Set(obj.seen);
            s.player = obj.player; s.bike = obj.bike;
            s.settlements = obj.settlements; s.camps = obj.camps;
            s.bandits = obj.bandits; s.predators = obj.predators;
            s.caches = obj.caches; s.upgrades = obj.upgrades;
            s.campsRazed = obj.campsRazed;
            s.mp = obj.mp; s.phase = obj.phase; s.gameWon = obj.gameWon;
            return s;
        }
    }

    return GameState;
})();
