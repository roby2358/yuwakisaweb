// config.js — Game constants

export const HEX_SIZE = 24;

export const TERRAIN = {
    WATER: 0,
    PLAINS: 1,
    HILLS: 2,
    MOUNTAIN: 3,
    FOREST: 4,
    GOLD: 5,
    QUARRY: 6,
    CITY: 7,
    // Inaccessible variants — same terrain, unreachable from start
    PLAINS_DARK: 11,
    HILLS_DARK: 12,
    MOUNTAIN_DARK: 13,
    FOREST_DARK: 14,
    GOLD_DARK: 15,
    QUARRY_DARK: 16,
};

// Map dark terrain to its accessible variant
export const LIGHT_VARIANT = {
    [TERRAIN.PLAINS_DARK]: TERRAIN.PLAINS,
    [TERRAIN.HILLS_DARK]: TERRAIN.HILLS,
    [TERRAIN.MOUNTAIN_DARK]: TERRAIN.MOUNTAIN,
    [TERRAIN.FOREST_DARK]: TERRAIN.FOREST,
    [TERRAIN.GOLD_DARK]: TERRAIN.GOLD,
    [TERRAIN.QUARRY_DARK]: TERRAIN.QUARRY,
};

// Set of accessible terrain types
export const ACCESSIBLE = new Set([
    TERRAIN.PLAINS, TERRAIN.HILLS, TERRAIN.MOUNTAIN,
    TERRAIN.FOREST, TERRAIN.GOLD, TERRAIN.QUARRY, TERRAIN.CITY,
]);

// Hecto: fragile scholar, terrain-sensitive movement
export const HECTO_COST = {
    [TERRAIN.PLAINS]: 1,
    [TERRAIN.HILLS]: 2,
    [TERRAIN.FOREST]: 2,
    [TERRAIN.GOLD]: 1,
    [TERRAIN.QUARRY]: 2,
    [TERRAIN.CITY]: 1,
};

// Evascor: stone giant, 1 MP per hex, 2 for mountain, can't enter water
export const EVASCOR_COST = {
    [TERRAIN.PLAINS]: 1,
    [TERRAIN.HILLS]: 1,
    [TERRAIN.MOUNTAIN]: 2,
    [TERRAIN.FOREST]: 1,
    [TERRAIN.GOLD]: 1,
    [TERRAIN.QUARRY]: 1,
    [TERRAIN.CITY]: 1,
};

export const PLAYER_MP = 5;
export const MAP_COLS = 60;
export const MAP_ROWS = 40;
