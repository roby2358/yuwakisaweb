// config.js — Embergrade constants

export const HEX_SIZE = 24;

export const TERRAIN = {
    WATER: 0,
    PLAINS: 1,
    HILLS: 2,
    MOUNTAIN: 3,
    FOREST: 4,
    FIREBREAK: 5,
    ASH: 6,
    VILLAGE: 7
};

// Cost to enter (Infinity = impassable to firefighters)
export const MOVEMENT_COST = {
    [TERRAIN.WATER]: Infinity,
    [TERRAIN.PLAINS]: 1,
    [TERRAIN.HILLS]: 2,
    [TERRAIN.MOUNTAIN]: Infinity,
    [TERRAIN.FOREST]: 2,
    [TERRAIN.FIREBREAK]: 1,
    [TERRAIN.ASH]: 1,
    [TERRAIN.VILLAGE]: 1
};

// Higher = burns more eagerly. 0 = will not catch.
export const FLAMMABILITY = {
    [TERRAIN.WATER]: 0,
    [TERRAIN.PLAINS]: 0.35,
    [TERRAIN.HILLS]: 0.10,
    [TERRAIN.MOUNTAIN]: 0,
    [TERRAIN.FOREST]: 0.85,
    [TERRAIN.FIREBREAK]: 0,
    [TERRAIN.ASH]: 0,
    [TERRAIN.VILLAGE]: 0.55
};

export const PLAYER_MP = 20;
export const FIREFIGHTER_COUNT = 3;
export const VILLAGE_COUNT = 5;
export const DIG_COST = 2;
export const DOUSE_COST = 3;
export const SURVIVE_TURNS = 15;
export const INITIAL_FIRES = 3;

export const MAP_COLS = 40;
export const MAP_ROWS = 28;
