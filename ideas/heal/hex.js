// Hex Grid Utilities
// Axial coordinates (q, r), pointy-top hexes.


const SQRT3 = Math.sqrt(3);

const NEIGHBOR_DIRS = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
];

// A single axial hex coordinate. Pure value type: the coordinate math that used to be
// free hex*(q, r) functions now lives here as methods, with factories for the inverse
// directions (pixel → hex, key → hex). Methods return new Hex values rather than mutating.
class Hex {
    constructor(q, r) {
        this.q = q;
        this.r = r;
    }

    // Map/Set key for this coordinate.
    key() {
        return Hex.key(this.q, this.r);
    }

    // Pixel center of this hex (before any pan offset).
    toPixel() {
        const x = HEX_SIZE * (SQRT3 * this.q + SQRT3 / 2 * this.r);
        const y = HEX_SIZE * (3 / 2 * this.r);
        return { x, y };
    }

    // The 6 adjacent hexes.
    neighbors() {
        return NEIGHBOR_DIRS.map(d => new Hex(this.q + d.q, this.r + d.r));
    }

    // Axial distance to another hex.
    distance(other) {
        return (Math.abs(this.q - other.q) +
            Math.abs(this.q + this.r - other.q - other.r) +
            Math.abs(this.r - other.r)) / 2;
    }

    // Every hex within `radius` steps (inclusive), including this one.
    inRange(radius) {
        const out = [];
        for (let dq = -radius; dq <= radius; dq++) {
            const lo = Math.max(-radius, -dq - radius);
            const hi = Math.min(radius, -dq + radius);
            for (let dr = lo; dr <= hi; dr++) out.push(new Hex(this.q + dq, this.r + dr));
        }
        return out;
    }

    // ---- factories / coordinate helpers ----

    // Key for a loose (q, r) pair — for callers holding coordinate-bearing objects
    // (rich terrain hexes, units) that are not themselves Hex instances.
    static key(q, r) {
        return `${q},${r}`;
    }

    static fromKey(key) {
        const [q, r] = key.split(',').map(Number);
        return new Hex(q, r);
    }

    // Round fractional axial coordinates to the nearest hex.
    static round(q, r) {
        const s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);

        if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
        else if (rDiff > sDiff) rr = -rq - rs;

        return new Hex(rq, rr);
    }

    // Nearest hex to a pixel point (before pan offset).
    static fromPixel(x, y) {
        const q = (SQRT3 / 3 * x - 1 / 3 * y) / HEX_SIZE;
        const r = (2 / 3 * y) / HEX_SIZE;
        return Hex.round(q, r);
    }
}

// ---- Pixel drawing (operates on screen coordinates, not axial) ----

// Get corner points of a hex for drawing
function hexCorners(centerX, centerY, size) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 180 * (60 * i - 30);
        corners.push({
            x: centerX + size * Math.cos(angle),
            y: centerY + size * Math.sin(angle)
        });
    }
    return corners;
}

// Draw a hex path on canvas context
function drawHexPath(ctx, centerX, centerY, size) {
    const corners = hexCorners(centerX, centerY, size);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
}

// ---- Graph search over a hex Map ----

// Cost-aware BFS (Dijkstra) for hex grids.
// Returns a Map of hexKey -> cost for all reachable hexes within maxCost.
// - startHex: { q, r }
// - hexes: Map of hexKey -> hex objects
// - movementCost(hex): returns cost to enter hex, or Infinity if impassable
// - maxCost: stop exploring when cost exceeds this
function bfsHexes(startHex, hexes, movementCost, maxCost) {
    const costs = new Map();
    costs.set(Hex.key(startHex.q, startHex.r), 0);

    // Priority queue as sorted array (fine for hex-grid BFS with small cost values)
    const queue = [{ hex: startHex, cost: 0 }];

    while (queue.length > 0) {
        const { hex: current, cost: currentCost } = queue.shift();

        for (const n of new Hex(current.q, current.r).neighbors()) {
            const key = n.key();
            const neighbor = hexes.get(key);
            if (!neighbor) continue;

            const cost = movementCost(neighbor);
            if (cost === Infinity) continue;

            const totalCost = currentCost + cost;
            if (totalCost > maxCost) continue;

            if (!costs.has(key) || totalCost < costs.get(key)) {
                costs.set(key, totalCost);
                // Insert sorted by cost for correct Dijkstra ordering
                const idx = queue.findIndex(e => e.cost > totalCost);
                if (idx === -1) queue.push({ hex: neighbor, cost: totalCost });
                else queue.splice(idx, 0, { hex: neighbor, cost: totalCost });
            }
        }
    }

    return costs;
}

// All hexes reachable by a unit with given movement points.
// Returns a Map of hexKey -> cost (excluding the starting hex).
function getReachableHexes(startHex, hexes, movementPoints, terrainMovement) {
    const costs = bfsHexes(
        startHex,
        hexes,
        hex => terrainMovement[hex.terrain] ?? Infinity,
        movementPoints
    );
    costs.delete(Hex.key(startHex.q, startHex.r));
    return costs;
}

// ---- A* pathfinding over a hex Map ----

// Find the key with lowest fScore in openSet
function findLowestFScoreKey(openSet, fScore) {
    let bestKey = null;
    let lowestF = Infinity;
    for (const [key] of openSet) {
        const f = fScore.get(key) || Infinity;
        if (f < lowestF) {
            lowestF = f;
            bestKey = key;
        }
    }
    return bestKey;
}

// Reconstruct path from cameFrom map
function reconstructPath(cameFrom, endKey) {
    const path = [];
    let key = endKey;
    while (key) {
        path.unshift(Hex.fromKey(key));
        key = cameFrom.get(key);
    }
    return path;
}

// A* pathfinding state container
class PathfinderState {
    constructor(start, end) {
        this.endKey = Hex.key(end.q, end.r);
        this.openSet = new Map();
        this.closedSet = new Set();
        this.cameFrom = new Map();
        this.gScore = new Map();
        this.fScore = new Map();

        const startKey = Hex.key(start.q, start.r);
        this.gScore.set(startKey, 0);
        this.fScore.set(startKey, new Hex(start.q, start.r).distance(end));
        this.openSet.set(startKey, start);
    }

    processNeighbor(neighbor, currentKey, end, isPassable, movementCost, maxCost) {
        const neighborKey = neighbor.key();

        if (this.closedSet.has(neighborKey)) return;
        if (!isPassable(neighbor.q, neighbor.r)) return;

        const cost = movementCost(neighbor.q, neighbor.r);
        const tentativeG = (this.gScore.get(currentKey) || 0) + cost;

        if (tentativeG > maxCost) return;

        const isBetterPath = !this.openSet.has(neighborKey) ||
                             tentativeG < (this.gScore.get(neighborKey) || Infinity);

        if (isBetterPath) {
            this.cameFrom.set(neighborKey, currentKey);
            this.gScore.set(neighborKey, tentativeG);
            this.fScore.set(neighborKey, tentativeG + neighbor.distance(end));
            this.openSet.set(neighborKey, neighbor);
        }
    }
}

// A* pathfinding for hex grid. Returns an array of Hex from start to end, or null.
// - isPassable(q, r): whether the hex at (q, r) can be entered
// - movementCost(q, r): cost to enter the hex at (q, r)
// - maxCost: abandon paths whose accumulated cost exceeds this
function findPath(start, end, isPassable, movementCost, maxCost) {
    if (Hex.key(start.q, start.r) === Hex.key(end.q, end.r)) return [start];
    if (!isPassable(end.q, end.r)) return null;

    const state = new PathfinderState(start, end);

    while (state.openSet.size > 0) {
        const currentKey = findLowestFScoreKey(state.openSet, state.fScore);

        if (currentKey === state.endKey) {
            return reconstructPath(state.cameFrom, state.endKey);
        }

        const current = state.openSet.get(currentKey);
        state.openSet.delete(currentKey);
        state.closedSet.add(currentKey);

        for (const neighbor of new Hex(current.q, current.r).neighbors()) {
            state.processNeighbor(neighbor, currentKey, end, isPassable, movementCost, maxCost);
        }
    }

    return null;
}
