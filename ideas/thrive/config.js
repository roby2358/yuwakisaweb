// config.js — Game constants (plain <script> globals; no ES modules, so the game
// can be launched by double-clicking index.html from the filesystem).

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

// Smaller arena than the baseline: stamina-budgeted expeditions want a hub you can
// round-trip from, with the deep wastes a deliberate reach.
const MAP_COLS = 34;
const MAP_ROWS = 24;

// ---- Display constants ----
const COUNTER_SIZE = 28;
const HUD_WIDTH = 248;          // right HUD panel reserves this many px of the window

const TERRAIN_COLORS = {
    [TERRAIN.WATER]: '#2a6faa',
    [TERRAIN.PLAINS]: '#a8924e', // sandy dust plain
    [TERRAIN.HILLS]: '#b08a3e',
    [TERRAIN.MOUNTAIN]: '#6d6258',
    [TERRAIN.FOREST]: '#3f6b3a',
    [TERRAIN.GOLD]: '#c89b2c',
    [TERRAIN.QUARRY]: '#9e8c6c',
};

const TERRAIN_NAMES = {
    [TERRAIN.WATER]: 'Caustic flat',
    [TERRAIN.PLAINS]: 'Dust plain',
    [TERRAIN.HILLS]: 'Slag hills',
    [TERRAIN.MOUNTAIN]: 'Spires',
    [TERRAIN.FOREST]: 'Thornscrub',
    [TERRAIN.GOLD]: 'Glint field',
    [TERRAIN.QUARRY]: 'Quarry',
};

const PLAYER_COLOR = '#daa520';
const HUB_COLOR = '#e8e0c0';

// ---- THRIVE Slice 1 tuning (see DYNAMICS.md §13 and SPEC.md) ----
const TUNE = {
    staminaMax: 24,
    hpMax: 100,
    startRations: 4,
    rationsMax: 12,
    startCredits: 30,

    ticketPrice: 1000,
    upkeep: 8,

    resbedSecureCost: 120,      // includes the first charge
    resbedRechargeCost: 40,
    resbedMaxCharges: 3,

    notorietyMax: 100,
    notorietyDecay: 3,          // per day at hub rest
    grudgeScavenge: 1,
    grudgeKill: 8,
    amendsCostPerPoint: 2,      // Market: pay to bleed Notoriety

    workStamina: 2,             // scavenge a node
    attackStamina: 1,
    fieldRestStaminaGain: 8,    // resting in the wastes (costs a ration)
    fieldRestsPerDay: 3,        // every Nth field rest beds you down for the night (ends the day)
    starveHp: 8,                // HP lost resting with no rations
    exhaustHpPerPoint: 5,       // HP per point of stamina shortfall on an exhausted step

    foodCost: 6,                // Market: one ration
    medkitCost: 25,
    medkitHeal: 40,
};

// Goods produced by the wastes and sold at the Market. baseValue anchors the price walk.
const GOODS = {
    scrap: { label: 'Scrap', baseValue: 25 },
    hide:  { label: 'Hide',  baseValue: 45 },
    meat:  { label: 'Meat',  baseValue: 20 },
};

// Buyable melee weapons and armor (Slice 1: melee only, no durability).
const WEAPONS = {
    knife:   { label: 'Shiv',        dmg: 8,  cost: 0 },
    machete: { label: 'Slag-cleaver', dmg: 15, cost: 90 },
};
const ARMORS = {
    none:    { label: 'None',      reduce: 0, cost: 0 },
    vest:    { label: 'Hide vest', reduce: 5, cost: 70 },
};

// Fauna kinds. wary/hostile are Notoriety thresholds at which disposition flips:
// below wary they ignore/graze, between they avoid, at/above hostile they hunt you.
const FAUNA = {
    grazer: {
        label: 'Grazer', glyph: 'g', hp: 12, toughness: 2, dmg: 5,
        speed: 1, aggro: 4, wary: 45, hostile: 75,
        drops: { hide: 1, meat: 2 }, xp: 6,
    },
    lurker: {
        label: 'Lurker', glyph: 'l', hp: 22, toughness: 4, dmg: 13,
        speed: 1, aggro: 5, wary: 15, hostile: 35,
        drops: { hide: 2 }, xp: 11,
    },
};
