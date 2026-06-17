// config.js — Signal City constants

export const HEX_SIZE = 32;
export const MAP_RADIUS = 6;

// Districts (terrain types)
export const DISTRICT = {
    DOWNTOWN: 'downtown',
    SKYWAY: 'skyway',
    HARBOR: 'harbor',
    INDUSTRIAL: 'industrial',
    UNDERGROUND: 'underground',
    PARK: 'park'
};

export const ALL_DISTRICTS = [
    DISTRICT.DOWNTOWN,
    DISTRICT.SKYWAY,
    DISTRICT.HARBOR,
    DISTRICT.INDUSTRIAL,
    DISTRICT.UNDERGROUND,
    DISTRICT.PARK
];

// Naming pool — combined into "the {Name}" at gen time
export const DISTRICT_NAMES = {
    [DISTRICT.DOWNTOWN]:    ['Spire', 'Glass Mile', 'Central Vault'],
    [DISTRICT.SKYWAY]:      ['Skyway', 'Catwalks', 'Pigeon Court'],
    [DISTRICT.HARBOR]:      ['Harbor', 'Salt Quarter', 'Tideline'],
    [DISTRICT.INDUSTRIAL]:  ['Foundry', 'Slag Yards', 'Boilerworks'],
    [DISTRICT.UNDERGROUND]: ['Undercity', 'Slipways', 'Hollows'],
    [DISTRICT.PARK]:        ['Greens', 'Old Park', 'Lantern Walk']
};

// Per-district base movement cost (Flight overrides)
export const MOVE_COST = {
    [DISTRICT.DOWNTOWN]:    2,
    [DISTRICT.SKYWAY]:      Infinity,  // only flyers (overridden)
    [DISTRICT.HARBOR]:      1,
    [DISTRICT.INDUSTRIAL]:  1,
    [DISTRICT.UNDERGROUND]: 1,
    [DISTRICT.PARK]:        1
};

// Crisis categories
export const CRISIS = {
    FIRE:    'fire',
    HOSTAGE: 'hostage',
    MONSTER: 'monster',
    HEIST:   'heist',
    DISASTER:'disaster'
};

export const CRISIS_GLYPH = {
    [CRISIS.FIRE]:     '\u{1F525}', // 🔥
    [CRISIS.HOSTAGE]:  '!',
    [CRISIS.MONSTER]:  '\u{1F47E}', // 👾
    [CRISIS.HEIST]:    '$',
    [CRISIS.DISASTER]: '\u26A1'     // ⚡
};

// Per-district crisis spawn weights
export const CRISIS_WEIGHTS = {
    [DISTRICT.DOWNTOWN]:    [{ item: CRISIS.HOSTAGE, weight: 3 }, { item: CRISIS.HEIST, weight: 2 }, { item: CRISIS.FIRE, weight: 1 }],
    [DISTRICT.SKYWAY]:      [{ item: CRISIS.HEIST, weight: 3 }, { item: CRISIS.DISASTER, weight: 2 }],
    [DISTRICT.HARBOR]:      [{ item: CRISIS.MONSTER, weight: 3 }, { item: CRISIS.DISASTER, weight: 2 }, { item: CRISIS.HOSTAGE, weight: 1 }],
    [DISTRICT.INDUSTRIAL]:  [{ item: CRISIS.FIRE, weight: 4 }, { item: CRISIS.DISASTER, weight: 2 }, { item: CRISIS.MONSTER, weight: 1 }],
    [DISTRICT.UNDERGROUND]: [{ item: CRISIS.MONSTER, weight: 4 }, { item: CRISIS.HOSTAGE, weight: 1 }],
    [DISTRICT.PARK]:        [{ item: CRISIS.HOSTAGE, weight: 2 }, { item: CRISIS.MONSTER, weight: 1 }]
};

// ---------- Signature Powers ----------
//
// Each Power is a parameter set on one of three templates:
//   passive    — { rule, ... }     bends a movement / vision rule
//   resolver   — { matches, sideEffect } auto-resolves a crisis on entry
//   oneShot    — { effect }        single triggered effect
//
// Tags drive Power Collisions (adjacency interactions).

export const POWERS = [
    {
        id: 'stretch', name: 'Stretch', tag: 'reach',
        template: 'passive', rule: 'reachRadius', value: 2,
        blurb: 'Resolve crises up to 2 hexes away.'
    },
    {
        id: 'intangibility', name: 'Intangibility', tag: 'matter',
        template: 'passive', rule: 'ignoreDowntownCost',
        blurb: 'Downtown costs no extra MP. Pass through ruined hexes.'
    },
    {
        id: 'flight', name: 'Flight', tag: 'reach',
        template: 'passive', rule: 'flyer',
        blurb: 'Free Skyway movement, ignore Downtown cost.'
    },
    {
        id: 'pyrokinesis', name: 'Pyrokinesis', tag: 'force',
        template: 'resolver', matches: CRISIS.FIRE, sideEffect: 'doom+1',
        blurb: 'Auto-resolves Fire on entry. +1 Doom from collateral.'
    },
    {
        id: 'aquatic', name: 'Aquatic', tag: 'matter',
        template: 'resolver', matches: CRISIS.MONSTER, district: DISTRICT.HARBOR,
        blurb: 'Auto-resolves Monsters in the Harbor.'
    },
    {
        id: 'echo', name: 'Echo-location', tag: 'sense',
        template: 'passive', rule: 'undergroundVision',
        blurb: 'Sees through Underground fog.'
    },
    {
        id: 'telepathy', name: 'Telepathy', tag: 'mind',
        template: 'passive', rule: 'mindPeek',
        blurb: 'Entering a District peeks for the Mastermind.'
    },
    {
        id: 'shrink', name: 'Shrink', tag: 'matter',
        template: 'passive', rule: 'lieutenantHexFree',
        blurb: 'Costs 0 MP to enter a Lieutenant\u2019s hex (combat).'
    },
    {
        id: 'magnetism', name: 'Magnetism', tag: 'force',
        template: 'passive', rule: 'pull',
        blurb: 'Adjacent allies are pulled toward you on your move.'
    },
    {
        id: 'probability', name: 'Affect Probability', tag: 'mind',
        template: 'oneShot', effect: 'rerollSignal',
        blurb: 'Once per game: reroll the Signal phase.'
    }
];

export const HERO_NAMES = [
    'Hexline', 'The Inkblot', 'Dr. Fathom', 'Strut',
    'Marrow', 'Vellum', 'Chord', 'Sister Static',
    'Quill', 'Tinplate', 'Backwash', 'Mote'
];

export const LIEUTENANT_NAMES = [
    'Carapace', 'The Auger', 'Mistress Glass'
];

// ---------- Tuning ----------

export const HERO_COUNT = 4;
export const HERO_MP = 5;
export const HERO_HP = 2;
export const LIEUTENANT_HP = 3;

export const DOOM_MAX = 20;
export const DOOM_PROMOTE_EVERY = 4;     // tier-up per N doom
export const FALLEN_LIMIT = 4;            // game over

export const SPAWN_PER_TURN_MIN = 1;
export const SPAWN_PER_TURN_MAX = 2;

export const MASTERMIND_TIER_NAMES = ['Near Human', 'Superhuman', 'Planetary', 'Galactic', 'Cosmic'];
