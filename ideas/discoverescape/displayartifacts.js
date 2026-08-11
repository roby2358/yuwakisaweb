// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: how the pieces and terrain *look and measure* on screen —
// hex/counter geometry and the per-terrain / per-counter colors and labels. None of this
// affects adjudication, so it stays out of GameArtifacts and out of any server port; only
// GameUI (and the pixel helpers in hex.js) read it. Keyed off GameArtifacts.TERRAIN, so it
// must load after artifacts.js.
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
        },
        TERRAIN_NAMES: {
            [T.WATER]: 'Water',
            [T.PLAINS]: 'Plains',
            [T.HILLS]: 'Hills',
            [T.MOUNTAIN]: 'Mountain',
            [T.FOREST]: 'Forest',
        },
        FOG_COLOR: '#1a1a24',
        GLIMPSE_ALPHA: 0.35,    // distant terrain drawn this faded over the fog
        NIGHT_TINT: 'rgba(10, 10, 45, 0.30)',   // washed over explored terrain after dark
        PLAYER_COLOR: '#daa520',
        BOAT_COLOR: '#5ad0e0',
        RELIC_COLOR: '#ffd633',
        CAIRN_COLOR: '#cfcfd8',
        // Hunter counters shade by speed: the bright ones are the fast ones.
        HUNTER_COLORS: { 2: '#7e3030', 3: '#c22b2b', 4: '#ff2d2d' },
    };
})();
