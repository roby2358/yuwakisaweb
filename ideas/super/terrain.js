// terrain.js — Procedural 30x30 hex map generation per archetype.

import { hexKey, hexesInRange } from './hex.js';
import { MAP_COLS, MAP_ROWS, ARCHETYPES, TERRAIN } from './config.js';

const weightedPick = (weights, rnd) => {
    let total = 0;
    for (const k in weights) total += weights[k];
    let roll = rnd() * total;
    for (const k in weights) {
        roll -= weights[k];
        if (roll <= 0) return k;
    }
    return Object.keys(weights)[0];
};

// mulberry32 seeded PRNG.
const makeRng = (seed) => {
    let s = Math.floor(seed * 1e9) >>> 0;
    return () => {
        s |= 0; s = s + 0x6d2b79f5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
};

export const generateMap = (archetypeKey, seed = Math.random()) => {
    const rnd = makeRng(seed);
    const archetype = ARCHETYPES[archetypeKey] ?? ARCHETYPES.city;
    const hexes = new Map();

    // Rectangular patch of axial hexes (offset -> axial for pointy-top).
    for (let row = 0; row < MAP_ROWS; row++) {
        for (let col = 0; col < MAP_COLS; col++) {
            const q = col - Math.floor(row / 2);
            const r = row;
            const terrainId = weightedPick(archetype.weights, rnd);
            hexes.set(hexKey(q, r), { q, r, terrain: terrainId, archetype: archetypeKey });
        }
    }

    // Carve a safe spawn zone in the center.
    const center = { q: 15 - Math.floor(15 / 2), r: 15 };
    for (const h of hexesInRange(center.q, center.r, 3)) {
        const hx = hexes.get(hexKey(h.q, h.r));
        if (hx) hx.terrain = 'open';
    }

    return { archetypeKey, archetype, hexes, cols: MAP_COLS, rows: MAP_ROWS, spawnHero: center };
};

const terrainUpper = (id) => {
    if (!id) return TERRAIN.OPEN;
    return TERRAIN[id.toUpperCase()] ?? TERRAIN.OPEN;
};

export const moveCostOf = (terrainId) => terrainUpper(terrainId).move;
export const coverOf = (terrainId) => terrainUpper(terrainId).cover;
export const blocksLOS = (terrainId) => terrainUpper(terrainId).blocks;
