// Terrain Generation — Circular cosmic hex map

import { MAP_RADIUS, PATTERN_TYPES } from './config.js';
import { hexKey, hexDistance } from './hex.js';
import { Rando } from './rando.js';

function weightedTerrain(weights) {
    const total = weights.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [terrain, weight] of weights) {
        r -= weight;
        if (r <= 0) return terrain;
    }
    return weights[0][0];
}

export function generateMap() {
    const hexes = new Map();

    for (let q = -MAP_RADIUS; q <= MAP_RADIUS; q++) {
        for (let r = -MAP_RADIUS; r <= MAP_RADIUS; r++) {
            const dist = hexDistance(0, 0, q, r);
            if (dist > MAP_RADIUS) continue;

            let terrain;
            if (dist === 0) {
                terrain = 'nexus';
            } else if (dist === 1) {
                terrain = weightedTerrain([
                    ['wellspring', 30], ['crystal', 20], ['nebula', 20],
                    ['starfield', 20], ['aether', 10],
                ]);
            } else if (dist <= 3) {
                terrain = weightedTerrain([
                    ['starfield', 25], ['nebula', 18], ['wellspring', 16],
                    ['crystal', 14], ['shadow', 12], ['aether', 8], ['voidhex', 7],
                ]);
            } else {
                terrain = weightedTerrain([
                    ['starfield', 15], ['shadow', 20], ['voidhex', 20],
                    ['nebula', 14], ['crystal', 12], ['wellspring', 8], ['aether', 11],
                ]);
            }

            hexes.set(hexKey(q, r), {
                q, r, terrain,
                unraveled: false,
                world: null,
                rift: false,
                pattern: null,
            });
        }
    }

    // Place 7 patterns on non-nexus hexes at distance >= 2
    const candidates = [...hexes.values()].filter(
        h => h.terrain !== 'nexus' && hexDistance(0, 0, h.q, h.r) >= 2
    );
    Rando.shuffle(candidates);

    const patternPool = Rando.shuffle(
        Array.from({ length: 7 }, (_, i) => ({ ...PATTERN_TYPES[i % PATTERN_TYPES.length] }))
    );

    for (let i = 0; i < 7 && i < candidates.length; i++) {
        candidates[i].pattern = { ...patternPool[i], revealed: false };
    }

    return hexes;
}
