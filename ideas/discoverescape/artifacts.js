// artifacts.js — GameArtifacts
//
// Static definitions of the game's *pieces and rules* — the vocabulary the engine reasons
// over: terrain types, their movement costs, sight radii, and the tuning constants of the
// relic hunt (see DYNAMICS.md for why each number is what it is). This is server-side
// data: no colors, no pixels, nothing the engine wouldn't need to adjudicate a move.
// Display attributes (colors, hex/counter geometry) live separately in
// GameDisplayArtifacts so a headless server can drop this file in and ignore that one.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
const GameArtifacts = (function () {
    const TERRAIN = {
        WATER: 0,
        PLAINS: 1,
        HILLS: 2,
        MOUNTAIN: 3,
        FOREST: 4
    };

    return {
        TERRAIN,
        MOVEMENT_COST: {
            [TERRAIN.WATER]: Infinity,
            [TERRAIN.PLAINS]: 1,
            [TERRAIN.HILLS]: 2,
            [TERRAIN.MOUNTAIN]: Infinity,
            [TERRAIN.FOREST]: 2
        },
        PLAYER_MP: 6,
        MAP_COLS: 60,
        MAP_ROWS: 40,

        // Fog of war: how far entering a hex reveals, by what you're standing on.
        SIGHT: {
            BASE: 3,      // plains / forest
            HILLS: 4,     // the high ground is worth the climb
            CAIRN: 6,     // one-shot reveal on entering a standing-stone hex
            LANDING: 3,   // revealed around the boat at game start
            GLIMPSE: 8    // faded line-of-sight beyond the reveal: shape, not details
        },
        // Terrain tall enough to block the distant glimpse (never the reveal radius).
        LOS_BLOCKERS: [TERRAIN.HILLS, TERRAIN.MOUNTAIN, TERRAIN.FOREST],

        RELIC: {
            COUNT: 5,
            MIN_COL_FRAC: 0.35,   // tombs sit in the deep two-thirds of the island
            MIN_SPACING: 8        // pairwise hex distance between tombs
        },
        CAIRN: {
            COUNT: 5,
            MIN_COL_FRAC: 0.15,
            MIN_SPACING: 6
        },

        NIGHT_TURN: 60,           // at this turn, night falls: the isle fully wakes

        HUNTER: {
            SPEED_BY_ROLL: { 1: 2, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4 },  // d6 → MP per turn
            NIGHT_BONUS_MP: 1,
            HESITATE_CHANCE: 0.3,  // ancient, torpid things — sometimes a hunter pauses
            // Hunters smell the stolen relics, not you: pursuit only within
            // SCENT_BASE + SCENT_PER_CARRIED * carried (+ bonus at night) hexes.
            // Beyond that they stand torpid — outrun them far enough and you break
            // contact; carry more and you smell louder.
            SCENT_BASE: 9,
            SCENT_PER_CARRIED: 2,
            NIGHT_SCENT_BONUS: 4,
            BURST_SIZE: 2,        // hunters erupting when a tomb is plundered
            BURST_MIN_DIST: 6,    // burst ring around the plundered tomb...
            BURST_MAX_DIST: 10,   // ...never close enough for a same-turn kill
            // Greed accelerates the trickle: every plundered tomb births one hunter
            // every max(TRICKLE_MIN, TRICKLE_BASE - TRICKLE_PER_CARRIED * carried)
            // turns — minus one more at night.
            TRICKLE_BASE: 7,
            TRICKLE_PER_CARRIED: 1,
            TRICKLE_MIN: 2,
            NIGHT_TRICKLE_BONUS: 1,
            TRICKLE_DIST: 2,      // trickle spawns within this radius of the tomb
            SPAWN_MIN_PLAYER_DIST: 5,  // no spawn of any kind within this of the player
            MAX: 10,
            DECAY_DISTANCE: 15,   // hunters farther than this from the player...
            DECAY_CHANCE: 0.2,    // ...lose the scent and may sink back each turn
            PATH_MAX_COST: 300    // A* abandon threshold (bounds worst-case search)
        }
    };
})();
