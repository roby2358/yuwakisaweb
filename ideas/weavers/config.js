// Weavers of Worlds: The Loom — Configuration

export const HEX_SIZE = 34;
export const MAP_RADIUS = 5; // 91 hexes in a circular grid

export const WORLDS_TO_WIN = 7;
export const FIRST_RIFT_TURN = 3;
export const RIFT_INTERVAL = 4;
export const MAX_RIFTS = 5;

// Terrain definitions
export const TERRAIN = {
    nexus:      { name: 'Nexus',      fill: '#2a2848', outline: '#6a68a8', cost: 1, thread: null },
    starfield:  { name: 'Starfield',  fill: '#14142a', outline: '#34345a', cost: 1, thread: null },
    nebula:     { name: 'Nebula',     fill: '#301848', outline: '#604878', cost: 1, thread: 'dream' },
    crystal:    { name: 'Crystal',    fill: '#143038', outline: '#346878', cost: 2, thread: 'star' },
    wellspring: { name: 'Wellspring', fill: '#382814', outline: '#685834', cost: 1, thread: 'light' },
    shadow:     { name: 'Shadow',     fill: '#1e0e2e', outline: '#4e3e5e', cost: 2, thread: 'shadow' },
    voidhex:    { name: 'Void',       fill: '#0a0a18', outline: '#2a2a44', cost: 2, thread: 'void' },
    aether:     { name: 'Aether',     fill: '#1e2838', outline: '#4e6878', cost: 1, thread: 'any' },
};

// Thread types
export const THREADS = ['light', 'shadow', 'star', 'void', 'dream'];

export const THREAD_INFO = {
    light:  { name: 'Light',  color: '#FFD700', symbol: '\u2600' },
    shadow: { name: 'Shadow', color: '#A855F7', symbol: '\u25D0' },
    star:   { name: 'Star',   color: '#D4D4D8', symbol: '\u2605' },
    void:   { name: 'Void',   color: '#3B82F6', symbol: '\u25CB' },
    dream:  { name: 'Dream',  color: '#EC4899', symbol: '\u273B' },
};

// Weaver definitions
export const WEAVER_DEFS = [
    { name: 'Seer',      type: 'seer',      color: '#06B6D4', textColor: '#000', mp: 2, desc: 'Reveals Patterns within 3 hexes' },
    { name: 'Alchemist', type: 'alchemist',  color: '#F97316', textColor: '#000', mp: 2, desc: 'Transmute: convert 1 thread to another' },
    { name: 'Oracle',    type: 'oracle',     color: '#A855F7', textColor: '#fff', mp: 2, desc: 'Deflects 1 Unraveling spread per turn' },
    { name: 'Wanderer',  type: 'wanderer',   color: '#22C55E', textColor: '#000', mp: 4, desc: 'Swift explorer, -1 terrain cost (min 1)' },
    { name: 'Dreamer',   type: 'dreamer',    color: '#EC4899', textColor: '#000', mp: 2, desc: '+1 free Dream thread each dawn' },
    { name: 'Guardian',  type: 'guardian',    color: '#EAB308', textColor: '#000', mp: 2, desc: 'Cleanses 1 adjacent Unraveling at dawn' },
];

// World recipes
export const RECIPES = [
    { name: 'Dawnworld',        cost: { light: 2, star: 1 },                                     desc: 'Eternal sunrise' },
    { name: 'Twilight Realm',   cost: { shadow: 2, light: 1 },                                   desc: 'Where day meets night' },
    { name: 'Constellation',    cost: { star: 3 },                                                desc: 'Pure starlight' },
    { name: 'Dreamscape',       cost: { dream: 2, star: 1 },                                     desc: 'Dreams made real' },
    { name: 'Abyssal Garden',   cost: { void: 2, dream: 1 },                                     desc: 'Beauty in darkness' },
    { name: 'Prismatic Sphere', cost: { light: 1, shadow: 1, star: 1, void: 1, dream: 1 },       desc: 'Perfect balance' },
    { name: 'Shadow Theater',   cost: { shadow: 2, dream: 1 },                                   desc: 'Stories in shadow' },
    { name: 'Cosmic Forge',     cost: { star: 2, light: 2 },                                     desc: 'Birthplace of stars' },
    { name: 'Voidheart',        cost: { void: 3, shadow: 1 },                                    desc: 'Deepest space' },
    { name: 'Metamorph',        cost: { dream: 2, light: 2 },                                    desc: 'Ever-changing' },
];

// Pattern bonus types
export const PATTERN_TYPES = [
    { name: 'Thread Cache',    effect: 'cache',     desc: '+2 random threads' },
    { name: 'Ancient Loom',    effect: 'discount',   desc: 'Next World -1 thread' },
    { name: 'Starmap',         effect: 'reveal',     desc: 'Reveal all Patterns' },
    { name: 'Resonance Echo',  effect: 'resonance',  desc: 'All Worlds resonate' },
    { name: 'Weavers Rest',    effect: 'rest',       desc: 'All Weavers +2 MP' },
];
