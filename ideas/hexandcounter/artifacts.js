// artifacts.js — GameArtifacts
//
// Static definitions of the game's *pieces and rules* — the vocabulary the engine reasons
// over: terrain types, their movement costs, and the fixed sizing constants of the map and
// a turn. This is server-side data: no colors, no pixels, nothing the engine wouldn't need
// to adjudicate a move. Display attributes (colors, hex/counter geometry) live separately
// in GameDisplayArtifacts so a headless server can drop this file in and ignore that one.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
const GameArtifacts = (function () {
    const TERRAIN = {
        WATER: 0,
        PLAINS: 1,
        HILLS: 2,
        MOUNTAIN: 3,
        FOREST: 4,
        GOLD: 5,
        QUARRY: 6
    };

    return {
        TERRAIN,
        MOVEMENT_COST: {
            [TERRAIN.WATER]: Infinity,
            [TERRAIN.PLAINS]: 1,
            [TERRAIN.HILLS]: 2,
            [TERRAIN.MOUNTAIN]: Infinity,
            [TERRAIN.FOREST]: 2,
            [TERRAIN.GOLD]: 2,
            [TERRAIN.QUARRY]: 2
        },
        PLAYER_MP: 5,
        MAP_COLS: 60,
        MAP_ROWS: 40,
    };
})();
