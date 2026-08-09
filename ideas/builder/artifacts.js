// artifacts.js — GameArtifacts
//
// Static definitions of the game's *pieces and rules* — the vocabulary the engine reasons
// over: terrain types and movement costs, building types (what they sit on, cost, and
// produce), Monument stages, recruiting, beast ecology rates, and the fixed sizing
// constants of the map and a turn. This is server-side data: no colors, no pixels,
// nothing the engine wouldn't need to adjudicate a move. Display attributes (colors,
// hex/counter geometry, labels) live separately in GameDisplayArtifacts so a headless
// server can drop this file in and ignore that one.
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
            [TERRAIN.PLAINS]: 2,
            [TERRAIN.HILLS]: 3,
            [TERRAIN.MOUNTAIN]: Infinity,
            [TERRAIN.FOREST]: 3,
            [TERRAIN.GOLD]: 3,
            [TERRAIN.QUARRY]: 3
        },
        WORKER_MP: 6,
        MAP_COLS: 96,
        MAP_ROWS: 64,

        START_RESOURCES: { wood: 10, stone: 4, gold: 0 },
        START_WORKERS: 3,

        // Building rules-table: where it may sit, what it costs (resources + builder MP),
        // and what it adds to the stockpile each production tick. One table, one build
        // code path — a new building type is a new row, not new branches.
        BUILDINGS: {
            sawmill: {
                name: 'Sawmill',
                terrain: [TERRAIN.FOREST],
                cost: { wood: 4 },
                mp: 2,
                produces: { wood: 2 }
            },
            stoneworks: {
                name: 'Stoneworks',
                terrain: [TERRAIN.QUARRY],
                cost: { wood: 6 },
                mp: 2,
                produces: { stone: 2 }
            },
            mine: {
                name: 'Mine',
                terrain: [TERRAIN.GOLD],
                cost: { wood: 4, stone: 4 },
                mp: 2,
                produces: { gold: 1 }
            },
            hall: {
                name: 'Hall',
                terrain: [TERRAIN.PLAINS],
                cost: { wood: 8, stone: 4 },
                mp: 2,
                produces: null
            },
            tower: {
                name: 'Watchtower',
                terrain: [TERRAIN.PLAINS, TERRAIN.HILLS, TERRAIN.FOREST, TERRAIN.GOLD, TERRAIN.QUARRY],
                cost: { wood: 2, stone: 3 },
                mp: 2,
                produces: null
            }
        },

        // Roads are hex flags, not buildings: any passable buildingless hex, and the
        // hex's movement cost becomes 1 (baked into the engine's moveCost).
        ROAD: { cost: { stone: 1 }, mp: 1 },
        TOWER_RADIUS: 2,

        // The win condition: three staged payments made by a worker standing on the
        // Monument hex. Each stage leans on a different arm of the economy.
        MONUMENT_STAGES: [
            { name: 'Foundation', cost: { stone: 12 } },
            { name: 'Frame', cost: { wood: 20 } },
            { name: 'Crown', cost: { gold: 6 } }
        ],
        MONUMENT_MP: 2,

        // Recruit cost escalates with crew size: 2 + 2 x (current workers) wood.
        RECRUIT: { baseWood: 2, woodPerWorker: 2 },

        // Beast ecology: spawn pressure scales with how much the player has built.
        BEAST: {
            SPAWN_BASE: 0.08,        // per-turn spawn chance floor
            SPAWN_PER_BUILDING: 0.02,
            SPAWN_CAP: 0.5,
            MAX: 12,                 // hard cap on beasts in play
            SPAWN_MIN_DIST: 8,       // no gotcha spawns next to workers/buildings
            FAST_ROLL: 5,            // d6 >= this at spawn -> speed 2, else speed 1
            SHOO_MP: 2,
            SHOO_MIN_DIST: 4,        // shooed beasts land 4-7 hexes away
            SHOO_MAX_DIST: 7
        }
    };
})();
