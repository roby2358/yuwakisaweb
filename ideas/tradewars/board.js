// Transient query layer over the authoritative hex Map in GameState.
const Board = (function () {
    const { MOVEMENT_COST } = GameArtifacts;

    class Board {
        constructor(hexes) {
            this.hexes = hexes;
        }

        get(q, r) {
            return this.hexes.get(Hex.key(q, r));
        }

        has(q, r) {
            return this.hexes.has(Hex.key(q, r));
        }

        moveCost(hex) {
            return MOVEMENT_COST[hex.terrain] ?? Infinity;
        }

        isPassable(hex) {
            return this.moveCost(hex) !== Infinity;
        }

        passableHexes() {
            const out = [];
            for (const [, hex] of this.hexes) {
                if (!hex.isEdge && this.isPassable(hex)) out.push(hex);
            }
            return out;
        }

        neighbors(q, r) {
            const out = [];
            for (const neighbor of new Hex(q, r).neighbors()) {
                const hex = this.hexes.get(neighbor.key());
                if (hex) out.push(hex);
            }
            return out;
        }

        hasPath(from, to) {
            if (!from || !to) return false;
            const costs = bfsHexes(from, this.hexes, hex => this.moveCost(hex), Infinity);
            return costs.has(Hex.key(to.q, to.r));
        }
    }

    return Board;
})();
