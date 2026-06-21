// config.js — Game constants

const HEX_SIZE = 24;

const TERRAIN = {
    WATER: 0,
    PLAINS: 1,
    HILLS: 2,
    MOUNTAIN: 3,
    FOREST: 4,
    GOLD: 5,
    QUARRY: 6
};

const MOVEMENT_COST = {
    [TERRAIN.WATER]: Infinity,
    [TERRAIN.PLAINS]: 1,
    [TERRAIN.HILLS]: 2,
    [TERRAIN.MOUNTAIN]: Infinity,
    [TERRAIN.FOREST]: 2,
    [TERRAIN.GOLD]: 2,
    [TERRAIN.QUARRY]: 2
};

const PLAYER_MP = 5;
const MAP_COLS = 60;
const MAP_ROWS = 40;

// ---- Healer (the player unit) ----
const HEALER_MAX_HP = 30;
const HEALER_MAX_AETHER = 12;
const AETHER_REGEN = 3;        // Aether recovered at the start of each player turn

// ---- Party ----
const PARTY_MP = 4;            // movement budget per party member per turn
const LEADER_LEASH = 5;        // leader will not advance past this distance from the healer
const REVIVE_WINDOW = 3;       // turns a downed hero survives before permanent death

// ---- Enemies ----
const ENEMY_MIN = 5;           // initial wave size (inclusive range)
const ENEMY_MAX = 8;
const REINFORCE_CHANCE = 0.25; // per-turn chance to spawn one reinforcement

// ---- Reputation ----
const REP_PER_KILL = 2;        // for each enemy the party fells
const REP_TREASURE = 25;       // collecting the treasure
const REP_RETURN = 50;         // returning home with it (victory bonus)
const TIER2_REP = 20;          // reputation needed to unlock tier-2 skills
const TIER3_REP = 50;          // ...and tier-3 skills

// ---- Display constants ----
const COUNTER_SIZE = 28;

const TERRAIN_COLORS = {
    [TERRAIN.WATER]: '#2a6faa',
    [TERRAIN.PLAINS]: '#7db344',
    [TERRAIN.HILLS]: '#c4a44a',
    [TERRAIN.MOUNTAIN]: '#7a7a7a',
    [TERRAIN.FOREST]: '#2d6e2d',
    [TERRAIN.GOLD]: '#d4a017',
    [TERRAIN.QUARRY]: '#9e8c6c',
};

const TERRAIN_NAMES = {
    [TERRAIN.WATER]: 'Water',
    [TERRAIN.PLAINS]: 'Plains',
    [TERRAIN.HILLS]: 'Hills',
    [TERRAIN.MOUNTAIN]: 'Mountain',
    [TERRAIN.FOREST]: 'Forest',
    [TERRAIN.GOLD]: 'Gold',
    [TERRAIN.QUARRY]: 'Quarry',
};

const PLAYER_COLOR = '#daa520';   // the healer's counter (fixed; allies/enemies use ColorTheory)
const TARGET_COLOR = '#ff6600';   // the treasure objective
const HOME_COLOR = '#5ad1c8';     // the home/return landmark
