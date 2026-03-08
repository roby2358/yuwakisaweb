// Terrain Generation using Diamond-Square (Fractal Plasma) Algorithm

import { TERRAIN } from './config.js';
import { hexKey, hexDistance, hexNeighbors, bfsHexes } from './hex.js';
import { Rando } from './rando.js';

// Diamond-Square algorithm for heightmap generation
function diamondSquare(size, roughness) {
    // Size must be 2^n + 1
    const gridSize = size;
    const grid = new Array(gridSize * gridSize).fill(0);

    const get = (x, y) => grid[y * gridSize + x];
    const set = (x, y, val) => { grid[y * gridSize + x] = val; };

    // Initialize corners
    set(0, 0, Math.random());
    set(gridSize - 1, 0, Math.random());
    set(0, gridSize - 1, Math.random());
    set(gridSize - 1, gridSize - 1, Math.random());

    let step = gridSize - 1;
    let scale = roughness;

    while (step > 1) {
        const half = step / 2;

        // Diamond step
        for (let y = half; y < gridSize - 1; y += step) {
            for (let x = half; x < gridSize - 1; x += step) {
                const avg = (
                    get(x - half, y - half) +
                    get(x + half, y - half) +
                    get(x - half, y + half) +
                    get(x + half, y + half)
                ) / 4;
                set(x, y, avg + (Math.random() - 0.5) * scale);
            }
        }

        // Square step
        for (let y = 0; y < gridSize; y += half) {
            for (let x = (y + half) % step; x < gridSize; x += step) {
                let sum = 0;
                let count = 0;

                if (x >= half) { sum += get(x - half, y); count++; }
                if (x + half < gridSize) { sum += get(x + half, y); count++; }
                if (y >= half) { sum += get(x, y - half); count++; }
                if (y + half < gridSize) { sum += get(x, y + half); count++; }

                set(x, y, sum / count + (Math.random() - 0.5) * scale);
            }
        }

        step = half;
        scale *= roughness;
    }

    // Normalize to 0-100
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < grid.length; i++) {
        min = Math.min(min, grid[i]);
        max = Math.max(max, grid[i]);
    }
    for (let i = 0; i < grid.length; i++) {
        grid[i] = ((grid[i] - min) / (max - min)) * 100;
    }

    return { grid, size: gridSize };
}

// Sample heightmap at hex coordinates
function sampleHeight(heightmap, q, r, mapRadius) {
    // Convert hex coords to grid coords with proper centering
    const normX = (q + mapRadius) / (mapRadius * 2);
    const normY = (r + mapRadius) / (mapRadius * 2);

    const gridX = Math.round(normX * (heightmap.size - 1));
    const gridY = Math.round(normY * (heightmap.size - 1));

    const clampedX = Math.max(0, Math.min(heightmap.size - 1, gridX));
    const clampedY = Math.max(0, Math.min(heightmap.size - 1, gridY));

    return heightmap.grid[clampedY * heightmap.size + clampedX];
}

// Generate terrain-only hex grid (no resources, danger points, or starting location)
export function generateTerrain(mapRadius) {
    const hexes = new Map();

    // Generate heightmap (use next power of 2 + 1)
    const heightmapSize = 129; // 2^7 + 1
    const heightmap = diamondSquare(heightmapSize, 0.55);

    // Create all hexes in the map and collect elevations
    const innerHexes = []; // Non-edge hexes for percentile calculation

    for (let q = -mapRadius; q <= mapRadius; q++) {
        for (let r = -mapRadius; r <= mapRadius; r++) {
            if (hexDistance(0, 0, q, r) <= mapRadius) {
                const key = hexKey(q, r);
                const elevation = sampleHeight(heightmap, q, r, mapRadius);
                const isEdge = hexDistance(0, 0, q, r) >= mapRadius - 1;

                const hex = {
                    q, r,
                    elevation,
                    isEdge,
                    terrain: null,
                    settlement: null,
                    units: [],
                    dangerPoint: null,
                    installation: null,
                    controlled: false
                };
                hexes.set(key, hex);

                // Only include non-edge hexes in percentile calculation
                if (!isEdge) {
                    innerHexes.push(hex);
                }
            }
        }
    }

    // Sort inner hexes by elevation to find percentile thresholds
    innerHexes.sort((a, b) => a.elevation - b.elevation);
    const count = innerHexes.length;

    // Calculate elevation thresholds based on actual percentiles
    // Water: 20%, Plains: 68%, Hills: 10%, Mountains: 2%
    const waterThreshold = innerHexes[Math.floor(count * 0.20)]?.elevation ?? 0;
    const hillsThreshold = innerHexes[Math.floor(count * 0.88)]?.elevation ?? 88;
    const mountainThreshold = innerHexes[Math.floor(count * 0.98)]?.elevation ?? 98;

    // Assign terrain based on percentile thresholds
    for (const [key, hex] of hexes) {
        if (hex.isEdge) {
            // Edge hexes are always water (ocean border)
            hex.terrain = TERRAIN.WATER;
        } else if (hex.elevation < waterThreshold) {
            hex.terrain = TERRAIN.WATER;
        } else if (hex.elevation >= mountainThreshold) {
            hex.terrain = TERRAIN.MOUNTAIN;
        } else if (hex.elevation >= hillsThreshold) {
            hex.terrain = TERRAIN.HILLS;
        } else {
            hex.terrain = TERRAIN.PLAINS;
        }
    }

    return hexes;
}

// Place resources, danger points, and find accessible hexes on an existing hex grid
export function populateTerrain(hexes, mapRadius, dangerSum, maxDangerLevel) {
    // Find starting settlement location FIRST (before resources/danger points)
    const startingSettlement = findBestStartingHex(hexes, mapRadius, false);

    // Build set of accessible hexes via BFS from starting settlement
    const accessibleKeys = startingSettlement
        ? computeAccessibleHexes(startingSettlement, hexes)
        : new Set();

    // Place resources only on accessible hexes
    placeResources(hexes, mapRadius, accessibleKeys);

    // Place danger points only on accessible edge hexes
    if (startingSettlement) {
        placeDangerPoints(hexes, mapRadius, accessibleKeys, dangerSum, maxDangerLevel);
    }

    return accessibleKeys;
}

// Score a hex as a starting location candidate
function scoreStartingHex(hex, hexes, mapRadius, scoreResources) {
    if (hex.terrain !== TERRAIN.PLAINS) return -Infinity;
    if (scoreResources && hex.dangerPoint) return -Infinity;

    const distFromCenter = hexDistance(0, 0, hex.q, hex.r);
    if (distFromCenter > mapRadius * 0.4) return -Infinity;

    // Score: prefer center, with nearby plains
    let score = (mapRadius - distFromCenter) * 2;

    const neighbors = hexNeighbors(hex.q, hex.r);
    for (const n of neighbors) {
        const nHex = hexes.get(hexKey(n.q, n.r));
        if (!nHex) continue;
        if (nHex.terrain === TERRAIN.PLAINS) score += 1;
        if (scoreResources && (nHex.terrain === TERRAIN.FOREST || nHex.terrain === TERRAIN.GOLD)) score += 5;
    }

    return score;
}

// Find best starting location. scoreResources=true when resources have been placed.
function findBestStartingHex(hexes, mapRadius, scoreResources) {
    let best = null;
    let bestScore = -Infinity;

    for (const [key, hex] of hexes) {
        const score = scoreStartingHex(hex, hexes, mapRadius, scoreResources);
        if (score > bestScore) {
            bestScore = score;
            best = hex;
        }
    }

    return best;
}

// Accessible hexes for map generation: all plains/hills reachable by land,
// plus mountains adjacent to reachable hexes (for gold placement)
function computeAccessibleHexes(startHex, hexes) {
    const reachable = bfsHexes(
        startHex,
        hexes,
        hex => (hex.terrain === TERRAIN.PLAINS || hex.terrain === TERRAIN.HILLS) ? 1 : Infinity,
        Infinity
    );

    // Add mountains adjacent to reachable hexes (for gold placement)
    const accessible = new Set(reachable.keys());
    for (const key of reachable.keys()) {
        const hex = hexes.get(key);
        for (const n of hexNeighbors(hex.q, hex.r)) {
            const nKey = hexKey(n.q, n.r);
            const neighbor = hexes.get(nKey);
            if (neighbor && neighbor.terrain === TERRAIN.MOUNTAIN) {
                accessible.add(nKey);
            }
        }
    }

    return accessible;
}

// Convert some plains to forest and some hills to gold (healing terrain variants)
function placeResources(hexes, mapRadius, accessibleKeys) {
    const GOLD_COUNT = 3;
    const FOREST_COUNT = 8;

    const plains = [];
    const hills = [];

    for (const [key, hex] of hexes) {
        if (!accessibleKeys.has(key)) continue;
        if (hex.terrain === TERRAIN.PLAINS) plains.push(hex);
        else if (hex.terrain === TERRAIN.HILLS) hills.push(hex);
    }

    Rando.shuffle(plains);
    Rando.shuffle(hills);

    // Convert some plains to forest
    for (let i = 0; i < FOREST_COUNT && i < plains.length; i++) {
        plains[i].terrain = TERRAIN.FOREST;
    }

    // Convert some hills to gold
    for (let i = 0; i < GOLD_COUNT && i < hills.length; i++) {
        hills[i].terrain = TERRAIN.GOLD;
    }
}

// Distribute a total sum among n parts, each part >= 1
function distributeRandomly(total, parts) {
    // Start with 1 for each part
    const result = new Array(parts).fill(1);
    let remaining = total - parts;

    // Randomly distribute remaining points
    while (remaining > 0) {
        const idx = Math.floor(Math.random() * parts);
        result[idx]++;
        remaining--;
    }

    Rando.shuffle(result);
    return result;
}

// Place danger points on the map edges (only on accessible hexes)
function placeDangerPoints(hexes, mapRadius, accessibleKeys, dangerSum, maxDangerLevel) {
    const dangerCount = 6;
    const sizes = distributeRandomly(dangerSum, dangerCount);

    const edgeHexes = [];

    for (const [key, hex] of hexes) {
        const dist = hexDistance(0, 0, hex.q, hex.r);
        // Danger points appear on outer ring, must be accessible (not water/mountain, reachable)
        if (dist >= mapRadius - 2 && dist <= mapRadius) {
            // Only plains and hills that are accessible (exclude mountains from accessible set for danger points)
            if ((hex.terrain === TERRAIN.PLAINS || hex.terrain === TERRAIN.HILLS) && accessibleKeys.has(key)) {
                edgeHexes.push(hex);
            }
        }
    }

    Rando.shuffle(edgeHexes);

    // Place danger points (all equal strength — spawn chance is global)
    for (let i = 0; i < Math.min(dangerCount, edgeHexes.length); i++) {
        edgeHexes[i].dangerPoint = true;
    }
}

// Find a good starting location (center-ish, plains, no dangers nearby)
export function findStartingLocation(hexes, mapRadius) {
    return findBestStartingHex(hexes, mapRadius, true);
}
