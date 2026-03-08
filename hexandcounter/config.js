// config.js — Game constants

export const HEX_SIZE = 24;

export const TERRAIN = {
    WATER: 0,
    PLAINS: 1,
    HILLS: 2,
    MOUNTAIN: 3,
    FOREST: 4,
    GOLD: 5,
    QUARRY: 6
};

export const MOVEMENT_COST = {
    [TERRAIN.WATER]: Infinity,
    [TERRAIN.PLAINS]: 1,
    [TERRAIN.HILLS]: 2,
    [TERRAIN.MOUNTAIN]: Infinity,
    [TERRAIN.FOREST]: 1,
    [TERRAIN.GOLD]: 2,
    [TERRAIN.QUARRY]: 2
};

export const PLAYER_MP = 5;
export const MAP_COLS = 60;
export const MAP_ROWS = 40;
