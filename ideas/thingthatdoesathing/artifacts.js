// artifacts.js — GameArtifacts
//
// Static rules-data: terrain, the Thing templates, and every tunable number the engine
// reasons over. Server-side: no colors, no pixels. Display attributes live in
// GameDisplayArtifacts. Every number here is listed by name in ONTOLOGY.md's Numbers table.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
const GameArtifacts = (function () {
    const TERRAIN = {
        WATER: 0,
        PLAINS: 1,
        MOUNTAIN: 2,
        ICE: 3
    };

    // Thing templates. Every kind is a parameter set, not a code path:
    //   push   — hexes it shoves the piece standing on it, in its facing
    //   pull   — hexes it pulls the piece on the far hex (two ahead) back into the near hex
    //   blocks — pieces can't enter
    //   on     — 'land' (plains/ice) or 'water': where it may be built
    //   weight — relative draw chance for the hand
    const THINGS = {
        BELT:    { push: 1, pull: 0, blocks: false, on: 'land',  weight: 6 },
        SPRING:  { push: 3, pull: 0, blocks: false, on: 'land',  weight: 2 },
        PULLER:  { push: 0, pull: 1, blocks: false, on: 'land',  weight: 2 },
        WALL:    { push: 0, pull: 0, blocks: true,  on: 'land',  weight: 2 },
        BRIDGE:  { push: 0, pull: 0, blocks: false, on: 'water', weight: 2 },
    };

    return {
        TERRAIN,
        THINGS,
        // Passability for Board: land is enterable, water and mountain are not. Water
        // still *accepts* a pushed piece (it sinks); that's the step rule, not this table.
        MOVEMENT_COST: {
            [TERRAIN.WATER]: Infinity,
            [TERRAIN.PLAINS]: 1,
            [TERRAIN.MOUNTAIN]: Infinity,
            [TERRAIN.ICE]: 1
        },
        MAP_COLS: 16,
        MAP_ROWS: 10,

        DELIVER_GOAL: 5,             // crates to win
        SOURCE_INTERVAL: 3,          // ticks between crates (if the source is clear)
        HAND_SIZE: 3,
        GREMLIN_DICE_COUNT: 1,       // gremlins = count d sides
        GREMLIN_DICE_SIDES: 4,

        // ---- Map generation ----
        GEN_MAX_ATTEMPTS: 10,
        KNOWN_GOOD_SEED: 1,          // has a source→target path on its first attempt (R-23)
        HEIGHTMAP_SIZE: 33,          // diamond-square grid side; 2^n + 1
        HEIGHTMAP_ROUGHNESS: 0.55,
        WATER_PCT: 0.18,             // elevation percentile: below → water
        MOUNTAIN_PCT: 0.90,          //   at/above → mountain
        ICE_FRAC: 0.08,              // of inner hexes, carved out of plains
        PLACE_SLICE_FRAC: 0.05,      // source/target from this end-fraction of passable hexes by col
        PLACE_SLICE_MIN: 3,
    };
})();
