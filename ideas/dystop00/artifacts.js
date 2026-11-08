// artifacts.js — GameArtifacts
//
// Static rules-data for RADIO FREE SECTOR 9: terrain types and their movement costs, the
// rig roster, the Sweeper kind table, and every tunable number of the map, the Wake, and
// the Alert. Server-side data: no colors, no pixels. Display attributes live in
// GameDisplayArtifacts. Every tunable number here is listed by name in ONTOLOGY.md's
// Numbers table; the docs cite these by name, never by value.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
const GameArtifacts = (function () {
    const TERRAIN = {
        CANAL: 0,       // toxic canal — impassable, firebreak
        PLAZA: 1,       // open concrete — firebreak
        BLOCK: 2,       // tenement block — the only terrain that can wake
        INDUSTRIAL: 3,  // factory district — slow, firebreak
        RUINS: 4,       // rubble — slow, firebreak
        ARCOLOGY: 5     // corporate monolith — impassable, firebreak
    };

    return {
        TERRAIN,
        MOVEMENT_COST: {
            [TERRAIN.CANAL]: Infinity,
            [TERRAIN.PLAZA]: 1,
            [TERRAIN.BLOCK]: 1,
            [TERRAIN.INDUSTRIAL]: 2,
            [TERRAIN.RUINS]: 2,
            [TERRAIN.ARCOLOGY]: Infinity
        },
        MAP_COLS: 48,
        MAP_ROWS: 32,

        // ---- The operator ----
        PLAYER_MP: 6,
        PLANT_MP: 2,                 // plant or retrieve a rig
        RIG_NAMES: [                 // RIG_COUNT = RIG_NAMES.length; label = first letter
            'KILO-9', 'NOVA FM', 'ECHO BASE', 'VOLTAGE', 'ZERO HOUR'
        ],

        // ---- The Wake (core) ----
        TX_RANGE: 2,                 // a freshly planted rig's broadcast range
        TX_RANGE_MAX: 4,             // range grows +1 per unjammed broadcast, up to this
        WAKE_THRESHOLD: 2,           // a sleeping block wakes with this many awake neighbors
        FADE_THRESHOLD: 2,           // an awake block outside every live rig's range sleeps with fewer awake neighbors
        WIN_FRAC: 0.5,               // fraction of all blocks awake at once to win

        // ---- The regime ----
        JAM_RADIUS: 1,               // nothing within this distance of a Sweeper wakes; rigs there are silent
        AWAKE_DRAG: 1,               // extra MP a Sweeper pays to enter an awake block
        SWEEPER_SIGHT: 3,            // a Sweeper sees @ within this distance (unless sheltered)
        BASE_SWEEPERS: 2,            // Alert quota floor
        AWAKE_PER_SWEEPER: 20,       // +1 Sweeper per this many awake blocks
        SPAWN_PER_TURN: 1,           // at most this many Sweepers appear per regime phase
        RECALL_PER_TURN: 1,          // over quota, at most this many stand down per regime phase
        MAX_SWEEPERS: 16,
        // One d6 per Sweeper at spawn: index = roll - 1.
        SWEEPER_KINDS: [
            { name: 'WARDEN', mp: 3, prefers: 'frontier' },
            { name: 'WARDEN', mp: 3, prefers: 'frontier' },
            { name: 'WARDEN', mp: 3, prefers: 'frontier' },
            { name: 'HOUND', mp: 4, prefers: 'rig' },
            { name: 'HOUND', mp: 4, prefers: 'rig' },
            { name: 'HUNTER', mp: 6, prefers: 'rig' }
        ],

        // ---- Map generation ----
        GEN_MAX_ATTEMPTS: 10,        // tries per seed before falling back to KNOWN_GOOD_SEED
        KNOWN_GOOD_SEED: 1,          // must generate a valid map on its first attempt (R-6)
        HEIGHTMAP_SIZE: 129,         // diamond-square grid side; must be 2^n + 1
        HEIGHTMAP_ROUGHNESS: 0.55,   // elevation field: canals low, arcologies high
        DENSITY_ROUGHNESS: 0.7,      // density field: where the tenements clump
        DENSITY_JITTER: 80,          // per-hex noise added to density (0–100 scale): ragged edges
        CANAL_PCT: 0.15,             // elevation percentile cut: below → canal
        ARCOLOGY_PCT: 0.94,          //   at/above → arcology
        BLOCK_FRAC: 0.45,            // of open hexes, densest first, become blocks
        INDUSTRIAL_FRAC: 0.3,        // of the remaining open hexes
        RUINS_FRAC: 0.2,             // of the remaining open hexes; the rest is plaza
        PLACE_SLICE_FRAC: 0.03,      // @ / Ministry drawn from this end-fraction of passable hexes by col
        PLACE_SLICE_MIN: 5,
        PRECINCT_COUNT: 2,
        PRECINCT_MIN_COL_FRAC: 0.5,  // precincts stand in the right part of the city
        STATION_SPACING: 6,          // min hex distance between stations
    };
})();
