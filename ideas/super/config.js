// config.js — Game constants for Super

export const HEX_SIZE = 18;
export const MAP_COLS = 30;
export const MAP_ROWS = 30;

// Terrain types. Each has display info + movement cost + cover modifier.
export const TERRAIN = {
    OPEN:     { id: 'open',     move: 1,        cover: 0, blocks: false },
    ROUGH:    { id: 'rough',    move: 2,        cover: 0, blocks: false },
    COVER:    { id: 'cover',    move: 1,        cover: 2, blocks: false },
    WALL:     { id: 'wall',     move: Infinity, cover: 0, blocks: true  },
    WATER:    { id: 'water',    move: Infinity, cover: 0, blocks: false },
    HAZARD:   { id: 'hazard',   move: 2,        cover: 0, blocks: false }
};

// Map archetype palettes. Each maps terrain id -> fill color.
export const ARCHETYPES = {
    city: {
        name: 'City Block',
        palette: {
            open:   '#40413a',
            rough:  '#555247',
            cover:  '#6b7280',
            wall:   '#1f2430',
            water:  '#1e3a5f',
            hazard: '#8a3a1a'
        },
        weights: { open: 55, rough: 10, cover: 15, wall: 18, water: 0, hazard: 2 }
    },
    field: {
        name: 'Grassy Field',
        palette: {
            open:   '#3f6b3f',
            rough:  '#5e7a44',
            cover:  '#2a5a2a',
            wall:   '#4a3a2a',
            water:  '#2b5f8a',
            hazard: '#8a7a1a'
        },
        weights: { open: 65, rough: 15, cover: 10, wall: 3, water: 6, hazard: 1 }
    },
    lair: {
        name: 'Evil Lair',
        palette: {
            open:   '#2a1f28',
            rough:  '#3d2933',
            cover:  '#4a2a3a',
            wall:   '#14090f',
            water:  '#3a0a1a',
            hazard: '#b23a1f'
        },
        weights: { open: 50, rough: 8, cover: 12, wall: 22, water: 2, hazard: 6 }
    }
};

export const DEFAULT_HERO_ATTRS = {
    hp: 30,
    maxHp: 30,
    ap: 6,
    maxAp: 6,
    speed: 5,
    toughness: 2,
    willpower: 2,
    focus: 3
};

export const TRACKS = [
    'Popularity', 'Science', 'Government', 'Economic',
    'Mystical', 'Underworld', 'Media', 'Military',
    'Academic', 'Religious', 'Cosmic', 'Personal'
];

export const SAVE_KEY = 'super.campaign.v1';

export const START_DOWNTIME = 3;
