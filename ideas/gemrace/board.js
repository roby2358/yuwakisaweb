// board.js — Board
//
// The playing surface: a Map of axial hexes plus the spatial and terrain queries every
// game asks of it — what's here, what's adjacent, what can be entered, and whether one hex
// can be reached from another. A transient query layer wrapped around GameState.hexes, which
// stays the plain, serializable source of truth; games built on this base extend Board with
// their own terrain reasoning (zones of control, elevation effects, roads).
//
// DOM-free: reads movement costs from GameArtifacts, never from display artifacts, so it runs
// server-side alongside the engine. Plain-script global (no ES modules) for file:// launch.
const Board = (function () {
    const { MOVEMENT_COST } = GameArtifacts;

    class Board {
        constructor(hexes) {
            this.hexes = hexes;   // Map<"q,r", hex> — the same reference GameState holds
        }

        get(q, r) {
            return this.hexes.get(Hex.key(q, r));
        }

        has(q, r) {
            return this.hexes.has(Hex.key(q, r));
        }

        // Cost to enter a hex; Infinity for impassable terrain (water/mountain). Single
        // source of truth for passability — reachability, spawning, and AI all route here.
        moveCost(hex) {
            return MOVEMENT_COST[hex.terrain] ?? Infinity;
        }

        isPassable(hex) {
            return this.moveCost(hex) !== Infinity;
        }

        // Every non-edge passable hex, as a fresh array the caller may sort/filter.
        passableHexes() {
            const out = [];
            for (const [, hex] of this.hexes) {
                if (hex.isEdge) continue;
                if (!this.isPassable(hex)) continue;
                out.push(hex);
            }
            return out;
        }

        // The adjacent hexes that exist on the board (off-map neighbors dropped).
        neighbors(q, r) {
            const out = [];
            for (const n of new Hex(q, r).neighbors()) {
                const hex = this.hexes.get(n.key());
                if (hex) out.push(hex);
            }
            return out;
        }

        // Can `to` be reached from `from` over passable terrain, ignoring pieces?
        hasPath(from, to) {
            if (!from || !to) return false;
            const costs = bfsHexes(from, this.hexes, hex => this.moveCost(hex), Infinity);
            return costs.has(Hex.key(to.q, to.r));
        }
    }

    return Board;
})();
