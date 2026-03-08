// Waowisha - Game Configuration

export const HEX_SIZE = 22;
export const MAP_RADIUS = 8;

// --- Terrain ---

export const TERRAIN = {
    WATER: 'water',
    PLAINS: 'plains',
    HILLS: 'hills',
    MOUNTAIN: 'mountain',
    VOID: 'void'
};

export const TERRAIN_COLORS = {
    [TERRAIN.WATER]: '#1a3a5c',
    [TERRAIN.PLAINS]: '#4a6741',
    [TERRAIN.HILLS]: '#7a6e3a',
    [TERRAIN.MOUNTAIN]: '#5a4a3a',
    [TERRAIN.VOID]: '#2a0a2a'
};

export const TERRAIN_MOVEMENT = {
    [TERRAIN.WATER]: Infinity,
    [TERRAIN.PLAINS]: 1,
    [TERRAIN.HILLS]: 2,
    [TERRAIN.MOUNTAIN]: Infinity,
    [TERRAIN.VOID]: 2   // default; actual cost is 2x original terrain
};

export const TERRAIN_DEFENSE = {
    [TERRAIN.WATER]: 0,
    [TERRAIN.PLAINS]: 0,
    [TERRAIN.HILLS]: 1,
    [TERRAIN.MOUNTAIN]: 2,
    [TERRAIN.VOID]: 0
};

// --- Resources (used by terrain.js, not central to Waowisha gameplay) ---

export const RESOURCE_TYPE = {
    FOREST: 'forest',
    QUARRY: 'quarry',
    GOLD_DEPOSIT: 'gold_deposit'
};

export const RESOURCE_COLORS = {
    [RESOURCE_TYPE.FOREST]: '#2e5a2e',
    [RESOURCE_TYPE.QUARRY]: '#6a7a8a',
    [RESOURCE_TYPE.GOLD_DEPOSIT]: '#c8a020'
};

// Danger spawn rates by strength level (turns between spawns)
export const DANGER_SPAWN_RATES = [5, 4, 3, 3, 2, 2];

// --- Unit Types ---

export const UNIT_FACTION = {
    PLAYER: 'player',
    ENEMY: 'enemy'
};

export const UNIT_TYPE = {
    // Player units - weird fantasy/sci-fi
    HEXBLADE: 'hexblade',
    GLITCH_MAGE: 'glitch_mage',
    SPORE_MARINE: 'spore_marine',
    PHASE_MONK: 'phase_monk',
    // Enemy units
    VOID_THRALL: 'void_thrall',
    REALITY_EATER: 'reality_eater',
    HOLLOW_KNIGHT: 'hollow_knight'
};

export const UNIT_STATS = {
    [UNIT_TYPE.HEXBLADE]:      { name: 'Hexblade',      faction: 'player', attack: 5, defense: 3, maxHp: 8, speed: 2, symbol: '⚔', desc: 'Warrior with a crystallized-algorithm sword' },
    [UNIT_TYPE.GLITCH_MAGE]:   { name: 'Glitch Mage',   faction: 'player', attack: 4, defense: 1, maxHp: 5, speed: 2, symbol: '✧', desc: 'Casts spells by exploiting bugs in reality' },
    [UNIT_TYPE.SPORE_MARINE]:  { name: 'Spore Marine',   faction: 'player', attack: 3, defense: 4, maxHp: 10, speed: 2, symbol: '⛨', desc: 'Power-armored soldier bonded with sentient fungus' },
    [UNIT_TYPE.PHASE_MONK]:    { name: 'Phase Monk',     faction: 'player', attack: 3, defense: 2, maxHp: 6, speed: 4, symbol: '◇', desc: 'Exists partially in multiple dimensions' },
    [UNIT_TYPE.VOID_THRALL]:   { name: 'Void Thrall',    faction: 'enemy',  attack: 3, defense: 1, maxHp: 4, speed: 2, symbol: '▲', desc: 'Corrupted humanoid servant of the Unraveling' },
    [UNIT_TYPE.REALITY_EATER]: { name: 'Reality Eater',  faction: 'enemy',  attack: 5, defense: 2, maxHp: 7, speed: 1, symbol: '◈', desc: 'Devours the fabric of existence' },
    [UNIT_TYPE.HOLLOW_KNIGHT]: { name: 'Hollow Knight',  faction: 'enemy',  attack: 4, defense: 3, maxHp: 6, speed: 2, symbol: '♛', desc: 'An echo of a fallen champion' }
};

export const ENEMY_SPAWN_WEIGHTS = [
    { item: UNIT_TYPE.VOID_THRALL, weight: 5 },
    { item: UNIT_TYPE.REALITY_EATER, weight: 2 },
    { item: UNIT_TYPE.HOLLOW_KNIGHT, weight: 1 }
];

// --- Void Rift / Unraveling ---

// Void spread chance per terrain type (averages ~16%, unevenly)
export const VOID_SPREAD_CHANCE = {
    [TERRAIN.PLAINS]: 0.22,
    [TERRAIN.HILLS]: 0.12,
    [TERRAIN.MOUNTAIN]: 0.06
};
export const VOID_DAMAGE_PER_TURN = 1;         // damage to units standing on void
export const RIFT_SEAL_TURNS = 1;              // turns a unit must stand on rift to seal it

// --- Colors ---

export const PLAYER_COLOR = '#30b0ff';
export const ENEMY_COLOR = '#ff4040';
export const VOID_GLOW = '#8030c0';
export const HIGHLIGHT_MOVE = 'rgba(255, 230, 50, 0.4)';
export const HIGHLIGHT_ATTACK = 'rgba(255, 60, 60, 0.4)';
export const HIGHLIGHT_SELECTED = 'rgba(100, 200, 255, 0.5)';
