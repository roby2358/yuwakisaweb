// config.js — Reclaimer constants (plain-global; loaded via <script>, no ES modules)

const HEX_SIZE = 22;

const MAP_COLS = 40;
const MAP_ROWS = 26;

const TERRAIN = {
    WATER: 0,
    PLAINS: 1,
    FOREST: 2,
    HILLS: 3,
    MOUNTAIN: 4,
};

// Base cost to enter a hex. Corruption adds +level on top (see engine.moveCost).
const MOVEMENT_COST = {
    [TERRAIN.WATER]: Infinity,
    [TERRAIN.PLAINS]: 1,
    [TERRAIN.FOREST]: 2,
    [TERRAIN.HILLS]: 2,
    [TERRAIN.MOUNTAIN]: Infinity,
};

// Healthy naturalistic terrain; the gameplay overlays (silver control, violet corruption,
// red enemies) are distinct hues so they still read clearly on top.
const TERRAIN_COLORS = {
    [TERRAIN.WATER]: '#2578c4',
    [TERRAIN.PLAINS]: '#6faa3c',
    [TERRAIN.FOREST]: '#357a38',
    [TERRAIN.HILLS]: '#87693e',
    [TERRAIN.MOUNTAIN]: '#9b9b9b',
};

const TERRAIN_NAMES = {
    [TERRAIN.WATER]: 'Water',
    [TERRAIN.PLAINS]: 'Plains',
    [TERRAIN.FOREST]: 'Forest',
    [TERRAIN.HILLS]: 'Hills',
    [TERRAIN.MOUNTAIN]: 'Mountain',
};

const DEPOSIT = { MINERALS: 'minerals', BIOMASS: 'biomass', RELIC: 'relic' };
const DEPOSIT_NAMES = { minerals: 'Minerals', biomass: 'Biomass', relic: 'Relic cache' };

// Structure templates (see DYNAMICS §6). Each is a parameter set over three templates:
// producer (adds resources), aura (radius effect), defender (auto-fires), wall (blocks).
const STRUCTURES = {
    farm:      { name: 'Farm',      hotkey: '1', cost: 4, template: 'producer', res: 'rations',   yield: 2, needs: DEPOSIT.BIOMASS,  hp: 8,  glyph: 'F' },
    extractor: { name: 'Extractor', hotkey: '2', cost: 5, template: 'producer', res: 'materials', yield: 2, needs: DEPOSIT.MINERALS, hp: 8,  glyph: 'E' },
    purifier:  { name: 'Purifier',  hotkey: '3', cost: 6, template: 'aura',     effect: 'purify', radius: 2, hp: 10, glyph: 'P' },
    beacon:    { name: 'Beacon',    hotkey: '4', cost: 6, template: 'aura',     effect: 'influence', radius: 6, hp: 10, glyph: 'B' },
    turret:    { name: 'Turret',    hotkey: '5', cost: 6, template: 'defender', range: 4, dmg: 4, hp: 12, glyph: 'T' },
    wall:      { name: 'Wall',      hotkey: '6', cost: 3, template: 'wall',     hp: 24, glyph: 'W' },
};
const STRUCTURE_ORDER = ['farm', 'extractor', 'purifier', 'beacon', 'turret', 'wall'];

// All tunable game values live here (DYNAMICS §10 — halve-and-double from these).
const RECLAIMER = {
    // setup
    frozenColonists: 8,
    breederNodes: 5,
    landerHp: 30,
    landerInfluence: 6,      // control/build radius (BFS steps through clean hexes) from the Lander
    pocketRadius: 1,         // clean starting pocket (corruption at the doorstep)
    corruptionMax: 3,
    breederHp: 6,

    // units
    sightRadius: 6,         // every unit and the Lander reveal fog within this many hexes
    captain: { hp: 10, mp: 5, weaponRange: 4, weaponDmg: 3 },
    colonist: { hp: 6, mp: 4, weaponRange: 1, weaponDmg: 1 },
    respawnCost: 5,         // rations to respawn the captain
    respawnDelay: 2,        // turns

    // cleansing is free — throttled by a unit's one action/turn, not materials

    // economy (per turn)
    baseMaterials: 2,       // Lander recycler
    baseRations: 2,
    areaRationsPer: 4,      // +1 ration per N controlled clean hexes
    awakenCost: 6,          // rations
    upkeepPerColonist: 1,   // rations/turn

    // cleansing: materials to lower corruption from level L to L-1  (index by L)

    // escalation engine (threat T = base + k_t*turn + k_u*awake + k_c*controlled)
    threatBase: 1,
    threatPerTurn: 0.3,
    threatPerColonist: 1,
    threatPerControlled: 0.2,
    spawnDivisor: 160,      // spawn chance per node = clamp(T / spawnDivisor, min, max)
    spawnMin: 0.04,
    spawnMax: 0.45,
    spreadBase: 0.10,
    spreadPerThreat: 1 / 200,
    spreadMax: 0.50,
    alienHpPerThreat: 22,   // +1 alien hp per this much threat
    maxAliens: 30,

    // aliens
    aliens: {
        swarmling: { hp: 2, dmg: 2, targets: 'any',        glyph: 's' },
        mauler:    { hp: 6, dmg: 3, targets: 'structures', glyph: 'M' },
        spitter:   { hp: 3, dmg: 0, targets: 'any', spitRange: 2, glyph: 'x' },
    },
};

// ---- display ----
const COUNTER_SIZE = 26;
const CAPTAIN_COLOR = '#f2b825';   // you — warm gold
const COLONIST_COLOR = '#d8c88a';  // your people — pale gold
const LANDER_COLOR = '#cdd7e0';    // home — pale steel

// Enemies are ONE consistent warm/red family so a hostile counter is instantly readable
// (no more random per-alien palettes). Type is told apart by its glyph, not its hue.
const ALIEN_COLORS = { swarmling: '#e8483c', mauler: '#8f1d24', spitter: '#d9552b' };

const COLORS = {
    reachable:  'rgba(240,220,90,0.28)',   // where you can move
    attack:     'rgba(230,60,50,0.45)',    // fire targets (enemies)
    cleanse:    'rgba(110,230,120,0.50)',  // restore = green
    build:      'rgba(90,150,250,0.50)',   // build spots
    gather:     'rgba(240,170,60,0.50)',
    controlEdge:'#54555c',                 // YOUR territory — dark-gray lining
    controlFill:'rgba(120,124,132,0.10)',
    corruption: ['rgba(150,45,190,0.52)', 'rgba(148,36,178,0.67)', 'rgba(150,26,165,0.84)'], // the blight (violet)
    node:       '#ff5027',                 // a nest — warm red "destroy this"
    fog:        'rgba(6,6,12,0.74)',
    selectEdge: '#ffe14a',
};
