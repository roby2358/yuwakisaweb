// artifacts.js — GameArtifacts
//
// Static definitions of the game's *pieces and rules* — the vocabulary the engine reasons
// over: terrain types, their movement costs, the fixed sizing constants of the map and a
// turn, and the tuning numbers for the living world (villages, raiders, prestige). This is
// server-side data: no colors, no pixels, nothing the engine wouldn't need to adjudicate
// a move. Display attributes (colors, hex/counter geometry) live separately in
// GameDisplayArtifacts so a headless server can drop this file in and ignore that one.
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
        QUARRY: 6,
        FARM: 7,
        VILLAGE: 8
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
            [TERRAIN.QUARRY]: 2,
            [TERRAIN.FARM]: 1,
            [TERRAIN.VILLAGE]: 1
        },
        PLAYER_MP: 5,
        PLAYER_HP: 3,
        MAP_COLS: 60,
        MAP_ROWS: 40,

        // ---- Villages (see DYNAMICS.md "Villages and Farmland") ----
        VILLAGE_MIN: 3,             // village count rolled per game: int(MIN, MAX)
        VILLAGE_MAX: 5,
        VILLAGE_MIN_DIST: 10,       // hexes between villages
        VILLAGE_HP: 3,              // structural hits before a village falls
        VILLAGE_GROWTH_CHANCE: 0.20, // per village per turn: add one farm hex

        // ---- Raiders (see DYNAMICS.md "Danger: Raiders") ----
        RAIDER_SPAWN_PER_FARM: 0.01, // spawn chance per turn = totalFarms × this
        RAIDER_WILD_DIST: 8,         // raiders spawn farther than this from every village
        RAIDER_SATED_FARMS: 3,       // farms burned before a raider heads home
        // Speed die (1d6): value → hexes per turn
        RAIDER_SPEED_DIE: { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3 },

        // ---- Prestige (see DYNAMICS.md "Prestige") ----
        PRESTIGE_KILL: 1,            // any raider killed
        PRESTIGE_DEFENSE_BONUS: 2,   // …within DEFENSE_RADIUS of farmland or a village
        PRESTIGE_DEFENSE_RADIUS: 3,
        PRESTIGE_PLUNDER_BONUS: 2,   // …while sated (plunder recovered)
        PRESTIGE_DECAY_DIVISOR: 10,  // decay per turn = floor(prestige / divisor)
        STATUS_PROMOTE_MULT: 3,      // promote when prestige > mult × status
        KNOCKOUT_PRESTIGE_DIVISOR: 2, // prestige halves on knockout

        // ---- Privileges: one row per status rank, cumulative and complete ----
        // The engine reads exactly one row (indexed by status, clamped to the last row) —
        // the single dispatch point for every rank-dependent rule. Ranks: Wanderer,
        // Yeoman, Reeve, Protector, Warden, Lord (titles live in GameDisplayArtifacts).
        PRIVILEGES: [
            { healAtVillage: 0, mpBonus: 0, attackCost: 2, growthRolls: 1, dreadChance: 0 },
            { healAtVillage: 1, mpBonus: 0, attackCost: 2, growthRolls: 1, dreadChance: 0 },
            { healAtVillage: 1, mpBonus: 1, attackCost: 2, growthRolls: 1, dreadChance: 0 },
            { healAtVillage: 1, mpBonus: 1, attackCost: 1, growthRolls: 1, dreadChance: 0 },
            { healAtVillage: 1, mpBonus: 1, attackCost: 1, growthRolls: 2, dreadChance: 0 },
            { healAtVillage: 1, mpBonus: 1, attackCost: 1, growthRolls: 2, dreadChance: 0.5 }
        ],
        PRIVILEGE_AURA_RADIUS: 3,    // Warden: villages within this range of the player roll growth extra times
    };
})();
