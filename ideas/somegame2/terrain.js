// terrain.js — Signal City map generation
//
// Builds a circular hex grid (radius MAP_RADIUS) and partitions the inner
// hexes into 6 named Districts via voronoi-style seed assignment.

import { ALL_DISTRICTS, DISTRICT_NAMES, MAP_RADIUS } from './config.js';
import { hexKey, hexDistance, hexesInRange } from './hex.js';
import { Rando } from './rando.js';

function makeHex(q, r, isEdge) {
    return {
        q, r,
        isEdge,
        district: null,        // district type (DISTRICT.*)
        districtId: null,      // index into state.districts
        ruined: false,
        crisis: null,          // { id, category, difficulty }
        revealedAsClear: false // mastermind not here (post-lieutenant kill)
    };
}

function buildGrid() {
    const hexes = new Map();
    for (const { q, r } of hexesInRange(0, 0, MAP_RADIUS)) {
        const dist = hexDistance(0, 0, q, r);
        hexes.set(hexKey(q, r), makeHex(q, r, dist === MAP_RADIUS));
    }
    return hexes;
}

function pickSeeds(hexes) {
    // One seed per district type, from inner (non-edge) hexes
    const candidates = [];
    for (const hex of hexes.values()) {
        if (!hex.isEdge && hexDistance(0, 0, hex.q, hex.r) >= 2) candidates.push(hex);
    }
    Rando.shuffle(candidates);
    const seeds = [];
    for (let i = 0; i < ALL_DISTRICTS.length && i < candidates.length; i++) {
        seeds.push({ type: ALL_DISTRICTS[i], hex: candidates[i] });
    }
    return seeds;
}

function assignByNearestSeed(hexes, seeds) {
    for (const hex of hexes.values()) {
        let best = null, bestDist = Infinity;
        for (const seed of seeds) {
            const d = hexDistance(hex.q, hex.r, seed.hex.q, seed.hex.r);
            if (d < bestDist) { bestDist = d; best = seed; }
        }
        hex.district = best.type;
    }
}

function buildDistrictRecords(hexes) {
    // Group hexes by district type, name each cluster, assign IDs
    const byType = new Map();
    for (const hex of hexes.values()) {
        if (!byType.has(hex.district)) byType.set(hex.district, []);
        byType.get(hex.district).push(hex);
    }

    const districts = [];
    for (const [type, members] of byType) {
        const namePool = DISTRICT_NAMES[type];
        const name = 'the ' + Rando.choice(namePool);
        const id = districts.length;
        for (const hex of members) hex.districtId = id;
        districts.push({ id, type, name, hexes: members, fallen: false });
    }
    return districts;
}

export function generateMap() {
    const hexes = buildGrid();
    const seeds = pickSeeds(hexes);
    assignByNearestSeed(hexes, seeds);
    const districts = buildDistrictRecords(hexes);
    return { hexes, districts };
}
