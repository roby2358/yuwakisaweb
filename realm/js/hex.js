// Hex Grid Utilities
// Using axial coordinates (q, r) with pointy-top hexes

import { HEX_SIZE } from './config.js';

// Convert axial to pixel coordinates
export function hexToPixel(q, r) {
    const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
    const y = HEX_SIZE * (3 / 2 * r);
    return { x, y };
}

// Convert pixel to axial coordinates
export function pixelToHex(x, y) {
    const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / HEX_SIZE;
    const r = (2 / 3 * y) / HEX_SIZE;
    return hexRound(q, r);
}

// Round fractional hex coordinates to nearest hex
export function hexRound(q, r) {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
        rq = -rr - rs;
    } else if (rDiff > sDiff) {
        rr = -rq - rs;
    }

    return { q: rq, r: rr };
}

// Get the 6 neighboring hexes
export function hexNeighbors(q, r) {
    const directions = [
        { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
        { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];
    return directions.map(d => ({ q: q + d.q, r: r + d.r }));
}

// Calculate distance between two hexes
export function hexDistance(q1, r1, q2, r2) {
    return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

// Get all hexes within a certain radius
export function hexesInRange(q, r, radius) {
    const results = [];
    for (let dq = -radius; dq <= radius; dq++) {
        for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
            results.push({ q: q + dq, r: r + dr });
        }
    }
    return results;
}

// Create a hex key for use in Maps/Sets
export function hexKey(q, r) {
    return `${q},${r}`;
}

// Parse a hex key back to coordinates
export function parseHexKey(key) {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
}

// Get corner points of a hex for drawing
export function hexCorners(centerX, centerY, size = HEX_SIZE) {
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
export function drawHexPath(ctx, centerX, centerY, size = HEX_SIZE) {
    const corners = hexCorners(centerX, centerY, size);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
}

// A* pathfinding for hex grid
export function findPath(start, end, isPassable, movementCost, maxCost = Infinity) {
    const startKey = hexKey(start.q, start.r);
    const endKey = hexKey(end.q, end.r);

    if (startKey === endKey) return [start];
    if (!isPassable(end.q, end.r)) return null;

    const openSet = new Map();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    gScore.set(startKey, 0);
    fScore.set(startKey, hexDistance(start.q, start.r, end.q, end.r));
    openSet.set(startKey, start);

    while (openSet.size > 0) {
        // Find node with lowest fScore
        let currentKey = null;
        let lowestF = Infinity;
        for (const [key, _] of openSet) {
            const f = fScore.get(key) || Infinity;
            if (f < lowestF) {
                lowestF = f;
                currentKey = key;
            }
        }

        if (currentKey === endKey) {
            // Reconstruct path
            const path = [];
            let key = endKey;
            while (key) {
                path.unshift(parseHexKey(key));
                key = cameFrom.get(key);
            }
            return path;
        }

        const current = openSet.get(currentKey);
        openSet.delete(currentKey);
        closedSet.add(currentKey);

        for (const neighbor of hexNeighbors(current.q, current.r)) {
            const neighborKey = hexKey(neighbor.q, neighbor.r);

            if (closedSet.has(neighborKey)) continue;
            if (!isPassable(neighbor.q, neighbor.r)) continue;

            const cost = movementCost(neighbor.q, neighbor.r);
            const tentativeG = (gScore.get(currentKey) || 0) + cost;

            if (tentativeG > maxCost) continue;

            if (!openSet.has(neighborKey) || tentativeG < (gScore.get(neighborKey) || Infinity)) {
                cameFrom.set(neighborKey, currentKey);
                gScore.set(neighborKey, tentativeG);
                fScore.set(neighborKey, tentativeG + hexDistance(neighbor.q, neighbor.r, end.q, end.r));
                openSet.set(neighborKey, neighbor);
            }
        }
    }

    return null; // No path found
}
