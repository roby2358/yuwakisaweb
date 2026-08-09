// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: how the pieces and terrain *look and measure* on screen —
// hex/counter geometry and the per-terrain / per-building colors and labels. None of this
// affects adjudication, so it stays out of GameArtifacts and out of any server port; only
// GameUI (and the pixel helpers in hex.js) read it. Keyed off GameArtifacts.TERRAIN and
// GameArtifacts.BUILDINGS, so it must load after artifacts.js.
//
// Worker and beast counter colors are NOT here: they come from per-game ColorTheory
// palettes stored in GameState (piece identity, reproducible from the seed).
const GameDisplayArtifacts = (function () {
    const T = GameArtifacts.TERRAIN;

    return {
        HEX_SIZE: 24,
        COUNTER_SIZE: 28,
        TERRAIN_COLORS: {
            [T.WATER]: '#2a6faa',
            [T.PLAINS]: '#7db344',
            [T.HILLS]: '#c4a44a',
            [T.MOUNTAIN]: '#7a7a7a',
            [T.FOREST]: '#2d6e2d',
            [T.GOLD]: '#d4a017',
            [T.QUARRY]: '#9e8c6c',
        },
        TERRAIN_NAMES: {
            [T.WATER]: 'Water',
            [T.PLAINS]: 'Plains',
            [T.HILLS]: 'Hills',
            [T.MOUNTAIN]: 'Mountain',
            [T.FOREST]: 'Forest',
            [T.GOLD]: 'Gold Vein',
            [T.QUARRY]: 'Quarry',
        },
        // Fixed colors/labels per building type: buildings read by letter at a glance,
        // while the living counters (workers/beasts) carry the per-game palettes.
        BUILDING_COLORS: {
            hall: '#d9c778',
            sawmill: '#8a5a2b',
            stoneworks: '#b8b8b8',
            mine: '#ffd700',
            tower: '#9ecfdf',
        },
        BUILDING_LABELS: {
            hall: 'H',
            sawmill: 'S',
            stoneworks: 'Q',
            mine: 'M',
            tower: 'T',
        },
        ROAD_COLOR: '#6b5b45',
        MONUMENT_COLOR: '#ff6600',
    };
})();
