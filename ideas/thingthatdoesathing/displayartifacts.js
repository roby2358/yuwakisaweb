// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: hex/counter geometry, colors, names, and the one-line
// "what it does" text for each Thing. None of this affects adjudication; only GameUI (and
// the pixel helpers in hex.js) read it. Keyed off GameArtifacts, so it loads after it.
const GameDisplayArtifacts = (function () {
    const T = GameArtifacts.TERRAIN;

    return {
        HEX_SIZE: 34,
        COUNTER_SIZE: 30,
        HOP_MS: 140,                 // ms per animated hop in a tick
        TERRAIN_COLORS: {
            [T.WATER]: '#2a6faa',
            [T.PLAINS]: '#7db344',
            [T.MOUNTAIN]: '#7a7a7a',
            [T.ICE]: '#cfeaf2',
        },
        TERRAIN_NAMES: {
            [T.WATER]: 'Water — pieces sink',
            [T.PLAINS]: 'Plains',
            [T.MOUNTAIN]: 'Mountain — blocks',
            [T.ICE]: 'Ice — pieces slide across',
        },
        // Per-Thing look: name, short verb line, base fill, accent, and how much of the hex
        // its tile covers.
        THING_LOOK: {
            BELT:    { name: 'Belt',    does: 'moves what is on it 1 hex',                fill: '#3a3f47', ink: '#ffd633', inset: 0.84 },
            SPRING:  { name: 'Spring',  does: 'flings what is on it 3 hexes',             fill: '#4a3a2a', ink: '#ff9a3c', inset: 0.84 },
            PULLER:  { name: 'Puller',  does: 'pulls what is 2 hexes ahead 1 hex closer', fill: '#1f4a4a', ink: '#5ef0d8', inset: 0.84 },
            WALL:    { name: 'Wall',    does: 'nothing gets in',                          fill: '#8a5a3c', ink: '#5c3a24', inset: 1 },
            BRIDGE:  { name: 'Bridge',  does: 'water you can cross (build on water)',     fill: '#a07a4a', ink: '#6b4f2c', inset: 0.84 },
        },
        // Per-piece look: hover name, and a display color for pieces with none of their own
        // (gremlins carry a seeded color in state; crates don't).
        PIECE_LOOK: {
            crate:   { name: 'Crate',             color: '#d8b07a' },
            gremlin: { name: 'Gremlin — wanders', color: null },
        },
        SOURCE_COLOR: '#4ce08a',
        TARGET_COLOR: '#ff6600',
        // Canvas chrome — mirror --bg and --font in index.css.
        BG_COLOR: '#0e1116',
        UI_FONT: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        REACH_COLOR: '255, 214, 51',   // rgb of --accent
    };
})();
