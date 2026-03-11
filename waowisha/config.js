// config.js — Waowisha game constants

export const HEX_SIZE = 24;
export const MAP_SIZE = 60; // 60x60 rect grid

export const TERRAIN = {
    PALE: 0, VEIN: 1, GROVE: 2, MIRE: 3, SCARP: 4, DEEP: 5, CRAG: 6
};

export const TERRAIN_INFO = {
    [TERRAIN.PALE]:  { name: 'Pale',  color: '#c8b87a', moveCost: 1, resource: null },
    [TERRAIN.VEIN]:  { name: 'Vein',  color: '#8a5cc4', moveCost: 2, resource: 'R0a' },
    [TERRAIN.GROVE]: { name: 'Grove', color: '#3d8a4e', moveCost: 2, resource: 'R0b' },
    [TERRAIN.MIRE]:  { name: 'Mire',  color: '#6a7a3d', moveCost: 2, resource: 'R0c' },
    [TERRAIN.SCARP]: { name: 'Scarp', color: '#7a6a5a', moveCost: 2, resource: 'R0d' },
    [TERRAIN.DEEP]:  { name: 'Deep',  color: '#2a4a7a', moveCost: Infinity, resource: null },
    [TERRAIN.CRAG]:  { name: 'Crag',  color: '#5a5a5a', moveCost: Infinity, resource: null },
};

export const UNIT_TYPES = {
    warden:   { name: 'Warden',   symbol: 'W', color: '#daa520', mp: 4, strength: 2, gather: 7, build: 1, reveal: 0, cost: null },
    gatherer: { name: 'Gatherer', symbol: 'G', color: '#66bb6a', mp: 5, strength: 0, gather: 7, build: 0, reveal: 0, cost: { R0d: 3 } },
    sentinel: { name: 'Sentinel', symbol: 'S', color: '#e53935', mp: 4, strength: 3, gather: 0, build: 0, reveal: 0, cost: { R0d: 2, R0a: 2 } },
    mason:    { name: 'Mason',    symbol: 'M', color: '#8d6e63', mp: 3, strength: 1, gather: 0, build: 2, reveal: 0, cost: { R0d: 2, R0c: 1 } },
    seeker:   { name: 'Seeker',   symbol: 'K', color: '#42a5f5', mp: 6, strength: 1, gather: 0, build: 0, reveal: 3, cost: { R0b: 1, R0a: 1 } },
};

export const ENEMY_TYPES = {
    E0:          { strength: 1, speed: 1,    behavior: 'random',         symbol: 'm', color: '#555' },
    E1:          { strength: 2, speed: [1,3], behavior: 'seekUnit',      symbol: 'h', color: '#833' },
    E2:          { strength: 1, speed: 2,    behavior: 'seekSettlement', symbol: 't', color: '#538' },
    broodMother: { strength: 4, speed: 1,    behavior: 'seekResource',   symbol: 'B', color: '#a22' },
};

// Spoils dropped on kill
export const SPOILS = {
    E0:          { R0: 1 },
    E1:          { R0: 2 },
    E2:          { R0: 1 },
    broodMother: { R0: 2, P1: 1 },
};

export const RECIPES = {
    P1a: { inputs: { R0a: 2 }, tier: 1 },
    P1b: { inputs: { R0b: 2 }, tier: 1 },
    P1c: { inputs: { R0c: 2 }, tier: 1 },
    P1d: { inputs: { R0d: 2 }, tier: 1 },
    P2a: { inputs: { P1a: 1, P1b: 1 }, tier: 2 },
    P2b: { inputs: { P1a: 1, P1c: 1 }, tier: 2 },
    P2c: { inputs: { P1d: 1, P1b: 1 }, tier: 2 },
    P2d: { inputs: { P1c: 1, P1d: 1 }, tier: 2 },
    P3a: { inputs: { P2a: 1, P1d: 1 }, tier: 3 },
    P3b: { inputs: { P2b: 1, P1b: 1 }, tier: 3 },
    P3c: { inputs: { P2c: 1, P1a: 1 }, tier: 3 },
    P3d: { inputs: { P2d: 1, R0b: 1 }, tier: 3 },
};

export const STRUCTURE_TYPES = {
    refinery:    { name: 'Refinery',      category: 'production', tier: 1, cost: { R0d: 3 },  buildTime: 2 },
    foundry:     { name: 'Foundry',       category: 'production', tier: 2, cost: { P1d: 2, P1a: 1 }, buildTime: 3 },
    atelier:     { name: 'Atelier',       category: 'production', tier: 3, cost: { P2c: 2, P2a: 1 }, buildTime: 5 },
    spike:       { name: 'Spike',         category: 'defense', cost: { R0c: 1 },  buildTime: 1, range: 3, power: 1, targeting: 'weakest' },
    watchPost:   { name: 'Watch Post',    category: 'defense', cost: { R0a: 2, R0c: 1 }, buildTime: 2, range: 3, power: 2, targeting: 'strongest' },
    beaconTower: { name: 'Beacon Tower',  category: 'defense', cost: { P3a: 1 }, buildTime: 3, range: 3, power: 3, targeting: 'strongest' },
    wardPylon:   { name: 'Ward Pylon',    category: 'defense', cost: { P3b: 1 }, buildTime: 3, range: 3, power: 4, targeting: 'all' },
    longbow:     { name: 'Longbow',       category: 'defense', cost: { P3c: 1 }, buildTime: 3, range: 8, power: 2, targeting: 'weakest' },
    harvesterPlant: { name: 'Harvester Plant', category: 'harvest', range: 3, power: 1 },
};

// Which recipes each production tier can process
export const PRODUCTION_RECIPES = {
    1: ['P1a', 'P1b', 'P1c', 'P1d'],
    2: ['P2a', 'P2b', 'P2c', 'P2d'],
    3: ['P3a', 'P3b', 'P3c', 'P3d'],
};

// CRT: crt[column][d6roll-1] = 'AE'|'DE'|'EX'
export const CRT_COLUMNS = ['1:2', '1:1', '2:1', '3:1', '4:1'];
export const CRT = {
    '1:2': ['AE','AE','AE','EX','EX','DE'],
    '1:1': ['AE','AE','EX','DE','DE','DE'],
    '2:1': ['EX','DE','DE','DE','DE','DE'],
    '3:1': ['DE','DE','DE','DE','DE','DE'],
    '4:1': ['DE','DE','DE','DE','DE','DE'],
};

export const SUPPLY_CRATE = { R0d: 4, R0a: 2, R0b: 2, R0c: 2 };

export const VISIBILITY_RANGE = 4;
export const SURGE_INTERVAL = 10;
export const WINDFALL_CHANCE = 0.05;
export const BASE_SPAWN_CHANCE = 1/3; // ~5-6 on d6
export const GATHER_RANGE = 1;
export const HARVESTER_RANGE = 3;
export const DRIFT_CHARGE_RANGE = 3;
export const DRIFT_CHARGE_RADIUS = 2;

export const ALL_R0 = ['R0a', 'R0b', 'R0c', 'R0d'];
export const ALL_P1 = ['P1a', 'P1b', 'P1c', 'P1d'];

// Color dot for each resource/product slot (derived from source terrain)
const V = '#8a5cc4', G = '#3d8a4e', M = '#6a7a3d', S = '#7a6a5a';
export const SLOT_COLORS = {
    R0a: V, R0b: G, R0c: M, R0d: S,
    P1a: V, P1b: G, P1c: M, P1d: S,
    P2a: V, P2b: V, P2c: S, P2d: M, // primary input terrain
    P3a: V, P3b: V, P3c: S, P3d: M,
};
