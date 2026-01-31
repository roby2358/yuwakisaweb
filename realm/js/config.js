// Game Configuration Constants

export const HEX_SIZE = 21; // radius of hex

export const TERRAIN = {
    WATER: 'water',
    PLAINS: 'plains',
    HILLS: 'hills',
    MOUNTAIN: 'mountain'
};

export const TERRAIN_COLORS = {
    [TERRAIN.WATER]: '#1e5799',
    [TERRAIN.PLAINS]: '#7cb342',
    [TERRAIN.HILLS]: '#9e9d24',
    [TERRAIN.MOUNTAIN]: '#6d4c41'
};

export const TERRAIN_MOVEMENT = {
    [TERRAIN.WATER]: Infinity,
    [TERRAIN.PLAINS]: 1,
    [TERRAIN.HILLS]: 2,
    [TERRAIN.MOUNTAIN]: Infinity
};

export const TERRAIN_DEFENSE = {
    [TERRAIN.WATER]: 0,
    [TERRAIN.PLAINS]: 0,
    [TERRAIN.HILLS]: 1,
    [TERRAIN.MOUNTAIN]: 2
};

export const RESOURCE_TYPE = {
    FOREST: 'forest',
    QUARRY: 'quarry',
    GOLD_DEPOSIT: 'gold_deposit'
};

export const RESOURCE_PRODUCTION = {
    [RESOURCE_TYPE.FOREST]: { materials: 1 },
    [RESOURCE_TYPE.QUARRY]: { materials: 2 },
    [RESOURCE_TYPE.GOLD_DEPOSIT]: { gold: 2 }
};

export const RESOURCE_COLORS = {
    [RESOURCE_TYPE.FOREST]: '#2e7d32',
    [RESOURCE_TYPE.QUARRY]: '#78909c',
    [RESOURCE_TYPE.GOLD_DEPOSIT]: '#ffc107'
};

// Settlement levels 1-10 (0-indexed internally as 0-9)
export const SETTLEMENT_LEVEL = {
    CAMP: 0,
    HAMLET: 1,
    VILLAGE: 2,
    TOWN: 3,
    LARGE_TOWN: 4,
    SMALL_CITY: 5,
    CITY: 6,          // Requires manual upgrade from level 6
    LARGE_CITY: 7,
    METROPOLIS: 8,
    CAPITAL: 9        // Requires manual upgrade from level 9
};

export const SETTLEMENT_NAMES = [
    'Camp',           // 1
    'Hamlet',         // 2
    'Village',        // 3
    'Town',           // 4
    'Large Town',     // 5
    'Small City',     // 6
    'City',           // 7
    'Large City',     // 8
    'Metropolis',     // 9
    'Capital'         // 10
];

// Levels that require manual upgrade (cannot auto-advance past these)
export const SETTLEMENT_UPGRADE_LEVELS = [
    SETTLEMENT_LEVEL.SMALL_CITY,  // 6 -> 7 requires click
    SETTLEMENT_LEVEL.METROPOLIS   // 9 -> 10 requires click
];

// Production scales with level (food removed - settlements grow automatically)
export const SETTLEMENT_PRODUCTION = {
    0: { gold: 1, materials: 1 },      // Camp
    1: { gold: 2, materials: 2 },      // Hamlet
    2: { gold: 4, materials: 3 },      // Village
    3: { gold: 7, materials: 5 },      // Town
    4: { gold: 12, materials: 8 },     // Large Town
    5: { gold: 20, materials: 12 },    // Small City
    6: { gold: 35, materials: 18 },    // City
    7: { gold: 55, materials: 25 },    // Large City
    8: { gold: 80, materials: 35 },    // Metropolis
    9: { gold: 120, materials: 50 }    // Capital
};

// Population contribution per settlement tier
export const SETTLEMENT_POPULATION = {
    0: 1,   // Camp
    1: 2,   // Hamlet
    2: 3,   // Village
    3: 4,   // Town
    4: 5,   // Large Town
    5: 6,   // Small City
    6: 8,   // City
    7: 10,  // Large City
    8: 12,  // Metropolis
    9: 15   // Capital
};

// Growth thresholds: floor(50 * 2.1^tier) - exponential
export const SETTLEMENT_GROWTH_THRESHOLD = {
    0: 50,     // Camp -> Hamlet
    1: 105,    // Hamlet -> Village
    2: 220,    // Village -> Town
    3: 463,    // Town -> Large Town
    4: 972,    // Large Town -> Small City
    5: 2041,   // Small City -> City
    6: 4286,   // City -> Large City
    7: 9001,   // Large City -> Metropolis
    8: 18902   // Metropolis -> Capital
};

// Growth per turn: floor(10 * (1 + tier)^1.5) - polynomial
export function getSettlementGrowth(tier) {
    return Math.floor(10 * Math.pow(1 + tier, 1.5));
}

// Influence radius scales with level
export const SETTLEMENT_INFLUENCE = {
    0: { strength: 1, radius: 1 },   // 7 hexes
    1: { strength: 2, radius: 1 },   // 7 hexes
    2: { strength: 3, radius: 2 },   // 19 hexes
    3: { strength: 4, radius: 2 },   // 19 hexes
    4: { strength: 5, radius: 2 },   // 19 hexes
    5: { strength: 6, radius: 3 },   // 37 hexes
    6: { strength: 8, radius: 3 },   // 37 hexes
    7: { strength: 10, radius: 3 },  // 37 hexes
    8: { strength: 12, radius: 4 },  // 61 hexes
    9: { strength: 15, radius: 4 }   // 61 hexes
};

// Cost for manual upgrades (only at threshold levels)
export const SETTLEMENT_UPGRADE_COST = {
    [SETTLEMENT_LEVEL.CITY]: { gold: 100, materials: 150 },      // 6 -> 7
    [SETTLEMENT_LEVEL.CAPITAL]: { gold: 300, materials: 400 }    // 9 -> 10
};

// Colors gradient from light to dark as settlement grows
export const SETTLEMENT_COLORS = {
    0: '#bcaaa4',  // Camp - lightest
    1: '#a1887f',
    2: '#8d6e63',
    3: '#795548',
    4: '#6d4c41',
    5: '#5d4037',
    6: '#4e342e',
    7: '#3e2723',
    8: '#2d1f1a',
    9: '#1a1210'   // Capital - darkest
};

// Alias for backwards compatibility
export const SETTLEMENT_TIER = SETTLEMENT_LEVEL;

export const UNIT_TYPE = {
    WORKER: 'worker',
    INFANTRY: 'infantry',
    HEAVY_INFANTRY: 'heavy_infantry',
    CAVALRY: 'cavalry'
};

export const UNIT_STATS = {
    [UNIT_TYPE.WORKER]: { attack: 1, defense: 1, speed: 2, health: 10, cost: { gold: 5, materials: 5 } },
    [UNIT_TYPE.INFANTRY]: { attack: 2, defense: 2, speed: 2, health: 10, cost: { gold: 5, materials: 2 } },
    [UNIT_TYPE.HEAVY_INFANTRY]: { attack: 3, defense: 4, speed: 1, health: 15, cost: { gold: 10, materials: 7 } },
    [UNIT_TYPE.CAVALRY]: { attack: 4, defense: 1, speed: 3, health: 8, cost: { gold: 15, materials: 5 } }
};

export const UNIT_COLORS = {
    [UNIT_TYPE.WORKER]: '#d7a86e',
    [UNIT_TYPE.INFANTRY]: '#42a5f5',
    [UNIT_TYPE.HEAVY_INFANTRY]: '#1565c0',
    [UNIT_TYPE.CAVALRY]: '#7e57c2'
};

export const INSTALLATION_TYPE = {
    OUTPOST: 'outpost',
    FORT: 'fort',
    GARRISON: 'garrison'
};

export const INSTALLATION_STATS = {
    [INSTALLATION_TYPE.OUTPOST]: { defense: 1, cost: { gold: 15, materials: 20 } },
    [INSTALLATION_TYPE.FORT]: { defense: 2, cost: { gold: 40, materials: 60 } },
    [INSTALLATION_TYPE.GARRISON]: { defense: 3, cost: { gold: 100, materials: 150 } }
};

export const ERA = {
    BARBARIAN: 'Barbarian',
    KINGDOM: 'Kingdom',
    EMPIRE: 'Empire'
};

export const ERA_THRESHOLDS = {
    [ERA.KINGDOM]: { settlements: 4 },
    [ERA.EMPIRE]: { settlements: 7 }
};

export const ERA_INFO = {
    [ERA.BARBARIAN]: {
        description: 'A fledgling tribe struggling to survive. Resources are scarce, but the realm is young and uncorrupted.',
        effects: [
            'Decadence +0.5 per turn',
            'Base production rates apply'
        ],
        advance: {
            nextEra: ERA.KINGDOM,
            requirements: [
                'Settlements: 4+'
            ]
        }
    },
    [ERA.KINGDOM]: {
        description: 'A growing realm with established settlements. The people prosper, but the seeds of ambition take root.',
        effects: [
            'Decadence +1 per turn',
            'Base production rates apply'
        ],
        advance: {
            nextEra: ERA.EMPIRE,
            requirements: [
                'Settlements: 7+'
            ]
        }
    },
    [ERA.EMPIRE]: {
        description: 'A vast domain spanning many lands. Power and wealth abound, but decadence gnaws at the foundations of civilization.',
        effects: [
            'Decadence +2 per turn',
            'Decadence reduces all production by up to 50%'
        ],
        advance: null
    }
};

export const COLLAPSE_INFO = {
    description: 'If any two society parameters reach 100%, civilization collapses.',
    parameters: [
        { name: 'Corruption', effect: 'Reduces gold income proportionally' },
        { name: 'Unrest', effect: 'Can trigger settlement revolts at 75%+' },
        { name: 'Decadence', effect: 'Reduces all production (Empire only)' },
        { name: 'Overextension', effect: 'Grows when territory exceeds sustainable limits' }
    ],
    consequence: 'All settlements except one become danger points. Units are disbanded. Resources reset.'
};

export const SOCIETY_PARAMS = {
    CORRUPTION: 'corruption',
    UNREST: 'unrest',
    DECADENCE: 'decadence',
    OVEREXTENSION: 'overextension'
};

// Starting resources (population is derived from settlements, not stored)
export const STARTING_RESOURCES = {
    gold: 100,
    materials: 50
};

// Danger point settings
export const DANGER_SPAWN_INTERVAL = 6; // turns between spawns
export const DANGER_SPAWN_STRENGTH = { min: 1, max: 3 }; // enemy units spawned
