// config.js — PowerRange constants, tables, and unit archetypes.
//
// The damage/shield MATCHUP and the unit ARCHETYPES are the two data tables that keep the
// game's variety out of the control flow: combat reads MATCHUP instead of branching on
// damage type, and every unit is a parameter set over a small number of templates rather
// than a bespoke class. (See DYNAMICS.md §5, §6.)

const HEX_SIZE = 24;
const COUNTER_SIZE = 30;

const MAP_COLS = 40;
const MAP_ROWS = 26;

// ---- Terrain ----
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
    [TERRAIN.GOLD]: 1,
    [TERRAIN.QUARRY]: 2
};

const TERRAIN_COLORS = {
    [TERRAIN.WATER]: '#2a6faa',
    [TERRAIN.PLAINS]: '#6f9e3e',
    [TERRAIN.HILLS]: '#b89a4a',
    [TERRAIN.MOUNTAIN]: '#7a7a7a',
    [TERRAIN.FOREST]: '#2d6e2d',
    [TERRAIN.GOLD]: '#d4a017',
    [TERRAIN.QUARRY]: '#9e8c6c'
};

const TERRAIN_NAMES = {
    [TERRAIN.WATER]: 'Water',
    [TERRAIN.PLAINS]: 'Plains',
    [TERRAIN.HILLS]: 'Hills',
    [TERRAIN.MOUNTAIN]: 'Mountain',
    [TERRAIN.FOREST]: 'Forest',
    [TERRAIN.GOLD]: 'Gold',
    [TERRAIN.QUARRY]: 'Quarry'
};

// Mountains and forests block line of fire (DYNAMICS §9).
const LOS_BLOCKERS = new Set([TERRAIN.MOUNTAIN, TERRAIN.FOREST]);
const FOREST_COVER = 2;   // power subtracted from shots landing in forest
const HILL_RANGE_BONUS = 1;
const FIELD_SHIELD = 12;  // an idle Engineer fortifies into this (immobile, refreshing) shield

// ---- Damage & shield types ----
const DAMAGE = {
    KINETIC: 'KINETIC',
    LASER: 'LASER',
    PLASMA: 'PLASMA',
    INCENDIARY: 'INCENDIARY'
};

const SHIELD = {
    PHYSICAL: 'PHYSICAL',
    ENERGY: 'ENERGY',
    PHASE: 'PHASE',
    NONE: 'NONE'
};

// MATCHUP[damageType][shieldType] = multiplier on the defender's shield pool.
// >1 = shield is strong here; <1 = shield is weak; 0 = shield gives no protection.
// PHASE (the knight's shield) absorbs every type at full value but has a tiny pool.
const MATCHUP = {
    [DAMAGE.KINETIC]:    { PHYSICAL: 1.5, ENERGY: 0.5, PHASE: 1.0, NONE: 0 },
    [DAMAGE.LASER]:      { PHYSICAL: 0.5, ENERGY: 1.5, PHASE: 1.0, NONE: 0 },
    [DAMAGE.PLASMA]:     { PHYSICAL: 0.5, ENERGY: 1.0, PHASE: 1.0, NONE: 0 },
    [DAMAGE.INCENDIARY]: { PHYSICAL: 0.0, ENERGY: 0.0, PHASE: 1.0, NONE: 0 }
};

// ---- Shield refresh policy (read at the start of each faction's turn) ----
// ENERGY/PHASE regenerate free to full; PHYSICAL only repairs at the home Foundry.
const SHIELD_REFRESH = {
    [SHIELD.ENERGY]: 'always',
    [SHIELD.PHASE]: 'always',
    [SHIELD.PHYSICAL]: 'atFoundry',
    [SHIELD.NONE]: 'never'
};

// ---- Unit kinds (capabilities, not stat buckets) ----
const KIND = {
    PLATFORM: 'PLATFORM',
    ENGINEER: 'ENGINEER',
    KNIGHT: 'KNIGHT',
    FOUNDRY: 'FOUNDRY'
};

// ---- Unit archetypes: parameter sets over the Platform / Knight / Foundry templates ----
// Every buildable and the Foundry is one entry here; Unit.create reads this table.
const ARCHETYPES = {
    RAILGUN: {
        kind: KIND.PLATFORM, label: 'R', name: 'Railgun',
        power: 6, range: 3, mp: 2, hp: 10,
        damage: DAMAGE.KINETIC, shieldType: SHIELD.PHYSICAL, shield: 6,
        cost: 30, upkeep: 3, ignites: false, siege: false, indirect: false
    },
    LASER: {
        kind: KIND.PLATFORM, label: 'L', name: 'Laser',
        power: 3, range: 6, mp: 2, hp: 8,
        damage: DAMAGE.LASER, shieldType: SHIELD.ENERGY, shield: 8,
        cost: 35, upkeep: 3, ignites: false, siege: false, indirect: false
    },
    PLASMA: {
        kind: KIND.PLATFORM, label: 'P', name: 'Plasma Siege',
        power: 10, range: 3, mp: 2, hp: 12,
        damage: DAMAGE.PLASMA, shieldType: SHIELD.ENERGY, shield: 8,
        cost: 60, upkeep: 6, ignites: false, siege: false, indirect: false
    },
    INCENDIARY: {
        kind: KIND.PLATFORM, label: 'I', name: 'Incendiary',
        power: 2, range: 3, mp: 2, hp: 8,
        damage: DAMAGE.INCENDIARY, shieldType: SHIELD.PHYSICAL, shield: 6,
        cost: 25, upkeep: 2, ignites: true, siege: false, indirect: false
    },
    BOMBARD: {
        // Indirect artillery: the only weapon that lobs over mountains/forests (ignores LOS).
        // Kinetic arc cracks energy shields but is weak vs physical — the Laser's mirror.
        // Longest reach on the board, but light rear armor makes it knight/engineer bait.
        kind: KIND.PLATFORM, label: 'B', name: 'Bombard',
        power: 5, range: 8, mp: 2, hp: 8,
        damage: DAMAGE.KINETIC, shieldType: SHIELD.PHYSICAL, shield: 4,
        cost: 50, upkeep: 5, ignites: false, siege: false, indirect: true
    },
    ENGINEER: {
        // Cheap, fragile saboteur: does the disable/capture grunt work, but no shield, so it
        // dies on the approach to a defended target — needs cover or an escort to get there.
        kind: KIND.ENGINEER, label: 'E', name: 'Engineer',
        power: 1, range: 1, mp: 4, hp: 3,
        damage: DAMAGE.KINETIC, shieldType: SHIELD.NONE, shield: 0,
        cost: 6, upkeep: 1, ignites: false, siege: true, indirect: false
    },
    KNIGHT: {
        // Elite commando: the only unit whose phase shield survives a walk through the kill
        // zone to siege a defended platform. That survivability is what makes it priciest.
        kind: KIND.KNIGHT, label: 'K', name: 'Shield Knight',
        power: 2, range: 1, mp: 5, hp: 6,
        damage: DAMAGE.KINETIC, shieldType: SHIELD.PHASE, shield: 8,
        cost: 75, upkeep: 7, ignites: false, siege: true, indirect: false
    },
    FOUNDRY: {
        kind: KIND.FOUNDRY, label: '⌂', name: 'Foundry',
        power: 0, range: 0, mp: 0, hp: 30,
        damage: DAMAGE.KINETIC, shieldType: SHIELD.PHYSICAL, shield: 10,
        cost: 0, upkeep: 0, ignites: false, siege: false, indirect: false
    }
};

// Order of the player's build palette.
const BUILD_MENU = ['RAILGUN', 'LASER', 'PLASMA', 'INCENDIARY', 'BOMBARD', 'ENGINEER', 'KNIGHT'];

// ---- Factions ----
const FACTION = { PLAYER: 'PLAYER', ENEMY: 'ENEMY' };

const FACTION_COLORS = {
    [FACTION.PLAYER]: '#daa520',
    [FACTION.ENEMY]: '#c0392b'
};

// ---- Economy (first-pass tuning; halve-and-double later) ----
const START_TREASURY = 120;
const FOUNDRY_INCOME = 6;     // per turn while the Foundry stands
const GOLD_INCOME = 12;       // per controlled, unburned gold hex
const QUARRY_DISCOUNT = 0.10; // build discount per controlled quarry
const QUARRY_DISCOUNT_CAP = 0.30;
const BUILD_RADIUS = 2;       // build within this many hexes of the Foundry
const CONTROL_RADIUS = 1;     // a unit controls hexes within this radius
const BANKRUPT_LIMIT = 3;     // consecutive bankrupt turns → economic collapse

// ---- Fire / terrain denial ----
const FIRE_TURNS = 3;         // how long an ignited hex burns
const FIRE_SPREAD = 0.2;      // chance/round a burning hex ignites a flammable neighbor
const FLAMMABLE = new Set([TERRAIN.PLAINS, TERRAIN.FOREST, TERRAIN.GOLD]);
