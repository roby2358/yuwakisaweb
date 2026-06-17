// config.js — Game constants

export const HEX_SIZE = 24;

// Terrain (re-skinned for Solar Corsair):
//   WATER    -> Void Rift   (impassable)
//   PLAINS   -> Open Space  (cost 1)
//   HILLS    -> Asteroid Field (cost 2, blocks line-of-sight to Dreadnought)
//   MOUNTAIN -> Star        (impassable)
//   FOREST   -> Nebula      (cost 2, conceals you from the Dreadnought)
//   GOLD     -> Derelict Hulk (loot site)
//   QUARRY   -> Trade Station (repair for doubloons)
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
    [TERRAIN.FOREST]: 2,
    [TERRAIN.GOLD]: 2,
    [TERRAIN.QUARRY]: 2
};

export const PLAYER_MP = 5;
export const MAP_COLS = 60;
export const MAP_ROWS = 40;

// Solar Corsair tuning
export const START_HP = 10;
export const LOOT_GOAL = 3;        // derelicts to loot before the wormhole opens
export const REPAIR_COST = 2;      // doubloons to repair 1 hull at a station
export const FREIGHTER_COUNT_DICE = [2, 6]; // 2d6 freighters
