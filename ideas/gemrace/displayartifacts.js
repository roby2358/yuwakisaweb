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
            [T.GOLD]: '#d4a017',
            [T.QUARRY]: '#9e8c6c',
        },
        TERRAIN_NAMES: {
            [T.WATER]: 'Water',
            [T.PLAINS]: 'Plains',
            [T.HILLS]: 'Hills',
            [T.MOUNTAIN]: 'Mountain',
            [T.FOREST]: 'Forest',
            [T.GOLD]: 'Gold',
            [T.QUARRY]: 'Quarry',
        },
        PLAYER_COLOR: '#daa520',
        HOME_COLOR: '#ff6600',
        // Normalized cut-stone silhouettes, stable by palette across every game.
        GEM_CUTS: {
            sunstone: [[-0.65,-0.75],[0.5,-0.85],[0.9,-0.2],[0.1,1],[-0.9,-0.1]],   // brilliant
            ruby: [[-0.65,-0.8],[0.65,-0.8],[0.95,-0.45],[0.95,0.45],[0.6,0.85],[-0.6,0.85],[-0.95,0.45],[-0.95,-0.45]], // cushion
            jade: [[-0.55,-0.95],[0.55,-0.95],[0.85,-0.65],[0.85,0.65],[0.55,0.95],[-0.55,0.95],[-0.85,0.65],[-0.85,-0.65]], // emerald
            cobalt: [[0,-1],[0.95,0.75],[-0.95,0.75]],                              // trillion
            violet: [[0,-1],[0.55,-0.55],[0.82,0.15],[0.5,0.72],[0,1],[-0.65,0.55],[-0.75,-0.15]], // pear
            pearl: [[-0.35,-0.95],[0.35,-0.95],[0.8,-0.6],[1,0],[0.75,0.7],[0.2,1],[-0.45,0.9],[-0.9,0.45],[-0.95,-0.25],[-0.7,-0.75]], // round
            ember: [[0,-1],[0.65,-0.35],[1,0],[0.55,0.45],[0,1],[-0.55,0.45],[-1,0],[-0.65,-0.35]] // marquise
        },
    };
})();
