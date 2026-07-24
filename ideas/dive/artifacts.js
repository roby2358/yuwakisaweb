// artifacts.js — GameArtifacts
//
// Static definitions of the game's *pieces and rules* — the vocabulary the engine reasons
// over: terrain bands, movement/O2 tables, materials, node spawn tables, predator
// parameters, and the upgrade/recipe economy. This is server-side data: no colors, no
// pixels, nothing the engine wouldn't need to adjudicate a move. Display attributes live
// separately in GameDisplayArtifacts so a headless server can drop this file in alone.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
const GameArtifacts = (function () {
    const TERRAIN = {
        ROCK: 0,        // spires + map edge; impassable to everything
        SHALLOWS: 1,    // leviathan-proof safe lanes
        REEF: 2,
        KELP: 3,        // hides the diver while its fiber remains
        DEEP: 4,        // leviathan water
        VENT: 5,        // scattered in deep/trench
        TRENCH: 6,      // richest band, worst air, leviathan home
        BASE: 7         // Berth Station — dock, sell, craft; refills diver O2
    };

    const MATERIAL = {
        GLOWFIBER: 'glowfiber',
        PRISMSHARD: 'prismshard',
        PEARL: 'pearl',
        EMBERGLASS: 'emberglass',
        VOIDAMBER: 'voidamber'
    };

    // Ascending-elevation percentile bands: the first entry whose pct exceeds a hex's
    // elevation percentile wins. Trench is the ocean floor, rock spires the peaks.
    const BAND_PERCENTILES = [
        { pct: 0.12, terrain: TERRAIN.TRENCH },
        { pct: 0.50, terrain: TERRAIN.DEEP },
        { pct: 0.62, terrain: TERRAIN.KELP },
        { pct: 0.76, terrain: TERRAIN.REEF },
        { pct: 0.97, terrain: TERRAIN.SHALLOWS },
        { pct: 1.01, terrain: TERRAIN.ROCK }
    ];

    // Node spawn tables per terrain: independent chances tried in listed order
    // (subtractive roll), each yielding a node { material, amount: min..max }.
    const NODE_TABLES = {
        [TERRAIN.KELP]: [{ p: 1.00, material: MATERIAL.GLOWFIBER, min: 1, max: 4 }],
        [TERRAIN.REEF]: [
            { p: 0.04, material: MATERIAL.PEARL, min: 1, max: 2 },
            { p: 0.45, material: MATERIAL.PRISMSHARD, min: 2, max: 4 }
        ],
        [TERRAIN.SHALLOWS]: [{ p: 0.02, material: MATERIAL.PEARL, min: 1, max: 2 }],
        [TERRAIN.VENT]: [{ p: 1.00, material: MATERIAL.EMBERGLASS, min: 3, max: 6 }],
        [TERRAIN.TRENCH]: [{ p: 0.25, material: MATERIAL.VOIDAMBER, min: 1, max: 3 }]
    };

    const SELL_PRICES = {
        [MATERIAL.GLOWFIBER]: 2,
        [MATERIAL.PRISMSHARD]: 4,
        [MATERIAL.EMBERGLASS]: 8,
        [MATERIAL.PEARL]: 12,
        [MATERIAL.VOIDAMBER]: 15
    };

    // Every upgrade is the same template: credits + materials -> tier++, and the stat
    // is read straight from values[tier]. values[0] is the ungeared baseline.
    const UPGRADES = {
        o2:    { name: 'O2 Recycler', stat: 'O2 max', values: [10, 14, 18],
                 tiers: [{ price: 20, mats: { glowfiber: 4 } },
                         { price: 60, mats: { prismshard: 5, emberglass: 2 } }] },
        fins:  { name: 'Thrustfins', stat: 'diver MP', values: [4, 5, 6],
                 tiers: [{ price: 25, mats: { prismshard: 3 } },
                         { price: 70, mats: { emberglass: 4 } }] },
        bag:   { name: 'Cargo Sling', stat: 'bag slots', values: [6, 9, 12],
                 tiers: [{ price: 20, mats: { glowfiber: 5 } },
                         { price: 55, mats: { prismshard: 4, voidamber: 1 } }] },
        hold:  { name: 'Sub Hold', stat: 'hold slots', values: [20, 32, 48],
                 tiers: [{ price: 30, mats: { glowfiber: 6 } },
                         { price: 80, mats: { emberglass: 3 } }] },
        hull:  { name: 'Hull Plating', stat: 'hull', values: [3, 4, 6],
                 tiers: [{ price: 40, mats: { prismshard: 6 } },
                         { price: 90, mats: { emberglass: 5 } }] },
        sonar: { name: 'Sonar Array', stat: 'sub sight', values: [4, 6, 9],
                 tiers: [{ price: 30, mats: { glowfiber: 2, prismshard: 2 } },
                         { price: 75, mats: { emberglass: 2, voidamber: 1 } }] }
    };
    const UPGRADE_KEYS = ['o2', 'fins', 'bag', 'hold', 'hull', 'sonar'];

    // The win condition: craft this at Berth Station and the tender ship comes.
    const BEACON = { name: 'Deepwave Beacon', price: 250,
                     mats: { voidamber: 6, emberglass: 6, pearl: 3 } };

    return {
        TERRAIN,
        MATERIAL,
        BAND_PERCENTILES,
        NODE_TABLES,
        SELL_PRICES,
        UPGRADES,
        UPGRADE_KEYS,
        BEACON,

        SUB_MOVE_COST: {
            [TERRAIN.ROCK]: Infinity,
            [TERRAIN.SHALLOWS]: 1,
            [TERRAIN.REEF]: 2,
            [TERRAIN.KELP]: 2,
            [TERRAIN.DEEP]: 1,
            [TERRAIN.VENT]: 1,
            [TERRAIN.TRENCH]: 1,
            [TERRAIN.BASE]: 1
        },
        DIVER_MOVE_COST: {
            [TERRAIN.ROCK]: Infinity,
            [TERRAIN.SHALLOWS]: 1,
            [TERRAIN.REEF]: 1,
            [TERRAIN.KELP]: 1,
            [TERRAIN.DEEP]: 1,
            [TERRAIN.VENT]: 1,
            [TERRAIN.TRENCH]: 1,
            [TERRAIN.BASE]: 1
        },
        // O2 lost per turn the diver ends outside the sub, by the hex stood on.
        // BASE is 0 because the station tops the diver off for free.
        O2_DRAIN: {
            [TERRAIN.SHALLOWS]: 1,
            [TERRAIN.REEF]: 1,
            [TERRAIN.KELP]: 1,
            [TERRAIN.DEEP]: 2,
            [TERRAIN.VENT]: 2,
            [TERRAIN.TRENCH]: 3,
            [TERRAIN.BASE]: 0
        },
        LEVIATHAN_WATER: new Set([TERRAIN.DEEP, TERRAIN.VENT, TERRAIN.TRENCH]),
        VENT_FRACTION: 0.04,   // of deep+trench hexes converted to vent fields

        SUB_MP: 8,
        GATHER_MP: 2,
        DIVER_SIGHT: 4,
        RESCUE_FEE: 15,        // charged (floored at 0 credits) on blackout or maul

        EEL_SENSE: 5,
        EEL_SPEEDS: [1, 1, 1, 2, 2, 3],   // rolled per eel at spawn (1d6)
        EEL_BASE_COUNT: 5,
        EEL_PER_ATTENTION: 2,
        EEL_SPAWN_CHANCE: 0.25,
        EEL_SPAWN_MIN_DIST: 8,

        LEVIATHAN_SPEED: 3,
        LEVIATHAN_SENSE: 8,               // hears engine wake only on turns the sub moved
        LEVIATHAN_WAKE_ATTENTION: [2, 5, 8],
        LEVIATHAN_SPAWN_MIN_DIST: 12,
        LEVIATHAN_NAMES: ['Old Chorus', 'The Pale Ribbon', 'Mother Sieve', 'Saint Undertow'],

        MAP_COLS: 60,
        MAP_ROWS: 40
    };
})();
