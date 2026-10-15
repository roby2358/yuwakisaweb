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
            [T.SCRUB]: '#a3a84e',
            [T.ROUGH]: '#9e8c6c',
        },
        TERRAIN_NAMES: {
            [T.WATER]: 'Water',
            [T.PLAINS]: 'Plains',
            [T.HILLS]: 'Hills',
            [T.MOUNTAIN]: 'Mountain',
            [T.FOREST]: 'Forest',
            [T.SCRUB]: 'Scrub',
            [T.ROUGH]: 'Rough',
        },
        PLAYER_COLOR: '#daa520',
        TARGET_COLOR: '#ff6600',
        // Canvas chrome — mirror --bg and --font in index.css so drawn text matches the HUD.
        BG_COLOR: '#0e1116',
        UI_FONT: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        REACH_COLOR: '255, 214, 51',   // rgb of --accent; tinted per use
    };
})();
