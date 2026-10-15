// artifacts.js — GameArtifacts
//
// Static definitions of the game's *pieces and rules* — the vocabulary the engine reasons
// over: terrain types, their movement costs, and the fixed sizing and generation constants
// of the map and a turn. This is server-side data: no colors, no pixels, nothing the engine
// wouldn't need to adjudicate a move. Display attributes (colors, hex/counter geometry) live
// separately in GameDisplayArtifacts so a headless server can drop this file in and ignore
// that one. Every tunable number here is listed by name in ONTOLOGY.md §6.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
const GameArtifacts = (function () {
    const TERRAIN = {
        WATER: 0,
        PLAINS: 1,
        HILLS: 2,
        MOUNTAIN: 3,
        FOREST: 4,
        SCRUB: 5,
        ROUGH: 6
    };

    return {
        TERRAIN,
        MOVEMENT_COST: {
            [TERRAIN.WATER]: Infinity,
            [TERRAIN.PLAINS]: 1,
            [TERRAIN.HILLS]: 2,
            [TERRAIN.MOUNTAIN]: Infinity,
            [TERRAIN.FOREST]: 2,
            [TERRAIN.SCRUB]: 2,
            [TERRAIN.ROUGH]: 2
        },
        PLAYER_MP: 6,
        MAP_COLS: 60,
        MAP_ROWS: 40,

        // ---- Map generation ----
        GEN_MAX_ATTEMPTS: 10,        // tries per seed before falling back to KNOWN_GOOD_SEED
        KNOWN_GOOD_SEED: 1,          // generates a player→target path on its first attempt (R-22)
        HEIGHTMAP_SIZE: 129,         // diamond-square grid side; must be 2^n + 1
        HEIGHTMAP_ROUGHNESS: 0.55,
        WATER_PCT: 0.25,             // elevation percentile cut: below → water
        HILLS_PCT: 0.85,             //   below → plains; at/above → hills
        MOUNTAIN_PCT: 0.95,          //   at/above → mountain
        FOREST_FRAC: 0.10,           // of inner hexes, carved out of plains
        SCRUB_FRAC: 0.01,            // of inner hexes, carved out of plains
        SCRUB_MIN: 3,
        ROUGH_FRAC: 0.02,            // of inner hexes, carved out of hills
        ROUGH_MIN: 2,
        PLACE_SLICE_FRAC: 0.03,      // player/target drawn from this end-fraction of passable hexes by col
        PLACE_SLICE_MIN: 5,
        ENEMY_DICE_COUNT: 2,         // enemies = ENEMY_DICE_COUNT d ENEMY_DICE_SIDES
        ENEMY_DICE_SIDES: 6,
    };
})();
