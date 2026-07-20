// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: how terrain, foes, nodes, and counters look and
// measure on screen. None of this affects adjudication; only GameUI (and the pixel
// helpers in hex.js) read it. Keyed off GameArtifacts, so it loads after artifacts.js.
const GameDisplayArtifacts = (function () {
    const T = GameArtifacts.TERRAIN;

    return {
        HEX_SIZE: 24,
        COUNTER_SIZE: 28,
        FOE_RADIUS: 10,

        TERRAIN_COLORS: {
            [T.MEADOW]: '#7da75a',
            [T.COPPICE]: '#4e7d3c',
            [T.HILL]: '#8f7d5a',
            [T.MOOR]: '#6b6478',
            [T.ASHEN]: '#5c3a35',
            [T.CRAG]: '#3c3a42',
            [T.MERE]: '#1d4254'
        },
        // Danger rings darken the land toward the dread — the map itself is the
        // difficulty gradient (UI reveals mechanics).
        RING_SHADE: [1.0, 0.92, 0.82, 0.7, 0.58],

        NODE_GLYPHS: { forage: '❀', ore: '◆', relic: '✦' },
        NODE_COLORS: { forage: '#d8e8b0', ore: '#e8d090', relic: '#c9a9ff' },
        NODE_SPENT: '#00000055',

        TIER_COLORS: { 1: '#d8cfa8', 2: '#e09050', 3: '#c04858' },
        PREY_RING: '#ffffff',
        HOSTILE_RING: '#ff3333',
        CHAMPION_RING: '#ffd24a',

        HERO_COLOR: '#ffd24a',
        HALL_COLOR: '#f0ead6',
        HOLDING_COLOR: '#d8c9a3',
        MONUMENT_COLOR: '#cfd6e8',
        DOOM_COLOR: '#170820',
        DOOM_GLYPH_COLOR: '#c04858',
        BAR_BACK: '#00000088',
        HP_BAR: '#7dd87d',
        DOOM_BAR: '#c04858'
    };
})();
