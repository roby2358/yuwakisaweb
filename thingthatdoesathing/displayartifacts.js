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
        RUN_GAP_MS: 250,             // Go: pause between ticks
        MILESTONE_MS: 3500,          // how long the milestone banner stays up
        // New Game menu note per GameArtifacts.MAP_SIZES key.
        MAP_SIZE_NOTES: {
            small:  'fits the screen',
            medium: 'drag to pan',
            large:  'drag to pan',
            huge:   'drag to pan',
        },
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
        // its tile covers. A colored kind (THINGS.colored) draws its accent in its Thing's color
        // instead (COLOR_INK); its card, not yet colored, uses COLOR_INK.white.
        THING_LOOK: {
            BELT:    { name: 'Belt',    does: 'moves what is on it 1 hex',                fill: '#3a3f47', ink: '#ffd633', inset: 0.84 },
            SPRING:  { name: 'Spring',  does: 'flings what is on it 3 hexes, over lakes', fill: '#4a3a2a', ink: '#ff9a3c', inset: 0.84 },
            ROCKET:  { name: 'Rocket',  does: 'blasts what is on it up to 8 hexes, over lakes; splats gremlins', fill: '#4a2234', ink: '#ff5c8a', inset: 0.84 },
            PUSHER:  { name: 'Pusher',  does: 'pushes what is in front of it 1 hex on',   fill: '#2c2f4a', ink: '#ffffff', inset: 0.84 },
            PULLER:  { name: 'Puller',  does: 'pulls what is 2 hexes ahead 1 hex closer', fill: '#1f4a4a', ink: '#ffffff', inset: 0.84 },
            WALL:    { name: 'Wall',    does: 'nothing gets in',                          fill: '#8a5a3c', ink: '#5c3a24', inset: 1 },
            TRAP:    { name: 'Trap',    does: 'a gremlin that comes onto it dies (crates are safe)', fill: '#3d3a33', ink: '#d9d4c7', inset: 0.84 },
            BRIDGE:  { name: 'Bridge',  does: 'carries what is on it 1 hex over water (build on water)', fill: '#a07a4a', ink: '#3d2812', inset: 0.84 },
            SLIDE:   { name: 'Slide',   does: 'what comes onto it slides on, like ice (build on land or water)', fill: '#9fd3e6', ink: '#ffffff', inset: 0.84 },
        },
        // Accent per color for colored kinds: white (a card), or the crate color's lit face.
        COLOR_PICKER_PX: 84,   // the color picker's width and height (D-32), for placing it beside the hex
        COLOR_INK: { white: '#ffffff', red: '#ff7a6b', green: '#8ff08a', blue: '#8ec4ff', yellow: '#fff08a' },
        // Per-piece hover name. Gremlins carry their own counter color in state.
        PIECE_LOOK: {
            crate:   { name: 'Crate' },
            bigcrate: { name: 'Big crate — worth 10' },
            gremlin: { name: 'Gremlin — wanders' },
        },
        // Isometric crate faces per CRATE_COLORS name: lit top, mid left, dark right.
        CRATE_SHADES: {
            red:    { top: '#ff7a6b', left: '#d83a2e', right: '#8e1f18' },
            green:  { top: '#8ff08a', left: '#3fbf45', right: '#22762a' },
            blue:   { top: '#8ec4ff', left: '#3d7fe0', right: '#204a8e' },
            yellow: { top: '#fff08a', left: '#e8c230', right: '#9a7a12' },
        },
        BIG_CRATE_SCALE: 1.5,        // a big crate is drawn this much bigger than a crate (D-34)
        SPLAT_BLOTS: 8,              // drops in a splat burst
        SOURCE_COLOR: '#4ce08a',
        // Canvas chrome — mirror --bg and --font in index.css.
        BG_COLOR: '#0e1116',
        UI_FONT: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        REACH_COLOR: '255, 214, 51',   // rgb of --accent
    };
})();
