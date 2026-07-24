// artifacts.js — GameArtifacts
//
// Static definitions of the game's *pieces and rules* — the vocabulary the engine reasons
// over: terrain, movement cost tables (foot vs. gravbike), materials, resource nodes,
// predator kinds, bandit stats, the upgrade catalog, and the economy/world constants.
// This is server-side data: no colors, no pixels, nothing the engine wouldn't need to
// adjudicate a move. Display attributes live separately in GameDisplayArtifacts.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
const GameArtifacts = (function () {
    const TERRAIN = {
        STORM: 0,      // edge ring — impassable storm wall
        ACID: 1,       // acid flats — gravbike only
        HARDPAN: 2,
        SCRUB: 3,
        BROKEN: 4,     // broken ground
        CRAG: 5,       // impassable
        GLOWVINE: 6,   // resource nodes (overwrite base terrain, revert when depleted)
        SHARD: 7,
        ORESCARP: 8,
        GEODE: 9
    };
    const T = TERRAIN;

    // On foot: acid flats are death to walk; everything rough costs 2.
    const FOOT_COST = {
        [T.STORM]: Infinity, [T.ACID]: Infinity, [T.HARDPAN]: 1, [T.SCRUB]: 1,
        [T.BROKEN]: 2, [T.CRAG]: Infinity,
        [T.GLOWVINE]: 2, [T.SHARD]: 2, [T.ORESCARP]: 2, [T.GEODE]: 2
    };
    // Mounted: the gravbike skims acid flats at full speed. Crags/storm still block.
    const BIKE_COST = {
        [T.STORM]: Infinity, [T.ACID]: 1, [T.HARDPAN]: 1, [T.SCRUB]: 1,
        [T.BROKEN]: 2, [T.CRAG]: Infinity,
        [T.GLOWVINE]: 2, [T.SHARD]: 2, [T.ORESCARP]: 2, [T.GEODE]: 2
    };

    // Resource node terrain -> what it yields and what it reverts to when depleted.
    const NODES = {
        [T.GLOWVINE]: { mat: 'resin', base: T.SCRUB, yieldMin: 3, yieldMax: 5 },
        [T.SHARD]: { mat: 'shardglass', base: T.HARDPAN, yieldMin: 3, yieldMax: 5 },
        [T.ORESCARP]: { mat: 'ore', base: T.BROKEN, yieldMin: 4, yieldMax: 6 },
        [T.GEODE]: { mat: 'heartstone', base: T.HARDPAN, yieldMin: 2, yieldMax: 3 }
    };
    // Initial node counts and the bloom weighting for new ones.
    const NODE_PLAN = [
        { terrain: T.GLOWVINE, count: 24, weight: 4 },
        { terrain: T.SHARD, count: 18, weight: 3 },
        { terrain: T.ORESCARP, count: 14, weight: 3 },
        { terrain: T.GEODE, count: 6, weight: 1 }
    ];

    // Everything that rides in cargo, one slot per unit. Prices are the flat base;
    // settlement demand and wealth multiply them at sale time.
    const MATERIALS = {
        resin: { name: 'Glowvine Resin', price: 16 },
        shardglass: { name: 'Shardglass', price: 28 },
        ore: { name: 'Ferric Ore', price: 22 },
        heartstone: { name: 'Heartstone', price: 120 },
        tag: { name: 'Bandit Tag', price: 50 },
        trophy: { name: 'Predator Trophy', price: 200 },
        chitin: { name: 'Chitin Plate', price: 80 }
    };

    const PREDATOR_KINDS = {
        howler: {
            name: 'Dust Howler', hp: 8, atk: 2, speed: 4,
            scentMounted: 7, scentBike: 0, scentBandit: 3,
            crossesAcid: false, eatsBikes: false,
            drops: { trophy: 1, chitin: 1 }
        },
        gravemaw: {
            name: 'Gravemaw', hp: 16, atk: 4, speed: 2,
            scentMounted: 6, scentBike: 4, scentBandit: 3,
            crossesAcid: true, eatsBikes: true,   // one hit swallows a gravbike whole
            drops: { trophy: 2, chitin: 2 }
        }
    };

    const BANDIT = {
        hp: 3, atk: 1, speed: 2,
        aggro: 3,            // chases the player inside this radius
        spawnChance: 0.08,   // per camp per day
        maxPerCamp: 3,
        steal: 15            // wealth taken per successful raid
    };

    // Workshop catalog (starport only). Each upgrade is a parameter set for one apply
    // path: effects are summed onto the base stats; rangeTwo is a set-flag.
    // Tiers gate on `requires`.
    const UPGRADES = [
        { id: 'engine1', name: 'Engine Tune I', credits: 150, mats: { ore: 3 }, requires: null, effects: { bikeMp: 2 } },
        { id: 'engine2', name: 'Engine Tune II', credits: 400, mats: { ore: 6 }, requires: 'engine1', effects: { bikeMp: 2 } },
        { id: 'engine3', name: 'Engine Tune III', credits: 900, mats: { ore: 10 }, requires: 'engine2', effects: { bikeMp: 2 } },
        { id: 'rack1', name: 'Cargo Rack I', credits: 120, mats: { resin: 3 }, requires: null, effects: { cargo: 3 } },
        { id: 'rack2', name: 'Cargo Rack II', credits: 300, mats: { shardglass: 4 }, requires: 'rack1', effects: { cargo: 3 } },
        { id: 'rack3', name: 'Cargo Rack III', credits: 700, mats: { heartstone: 2 }, requires: 'rack2', effects: { cargo: 4 } },
        { id: 'plate1', name: 'Hull Plating I', credits: 150, mats: { ore: 4 }, requires: null, effects: { bikeHp: 2 } },
        { id: 'plate2', name: 'Hull Plating II', credits: 400, mats: { ore: 6, chitin: 1 }, requires: 'plate1', effects: { bikeHp: 3 } },
        { id: 'blaster1', name: 'Blaster I', credits: 200, mats: { shardglass: 4 }, requires: null, effects: { atk: 1, rangeTwo: true } },
        { id: 'blaster2', name: 'Blaster II', credits: 500, mats: { shardglass: 8 }, requires: 'blaster1', effects: { atk: 1 } },
        { id: 'blaster3', name: 'Blaster III', credits: 1000, mats: { heartstone: 2 }, requires: 'blaster2', effects: { atk: 1 } },
        { id: 'vest', name: 'Padded Duster', credits: 150, mats: { resin: 4 }, requires: null, effects: { maxHp: 2 } },
        { id: 'carapace', name: 'Chitin Carapace', credits: 600, mats: { chitin: 2 }, requires: 'vest', effects: { maxHp: 3 } },
        { id: 'harv1', name: 'Sonic Harvester I', credits: 180, mats: { ore: 3 }, requires: null, effects: { harvest: 1 } },
        { id: 'harv2', name: 'Sonic Harvester II', credits: 450, mats: { shardglass: 6 }, requires: 'harv1', effects: { harvest: 1 } },
        { id: 'cloak', name: 'Dust Cloak', credits: 250, mats: { resin: 6 }, requires: null, effects: { scentFoot: -2 } }
    ];

    return {
        TERRAIN, FOOT_COST, BIKE_COST, NODES, NODE_PLAN, MATERIALS,
        PREDATOR_KINDS, BANDIT, UPGRADES,

        // Base player/bike stats before upgrades (see GameEngine.stats()).
        BASE: {
            atk: 1, range: 1, maxHp: 5, footMp: 5, bikeMp: 10,
            cargo: 6, harvest: 2, scentFoot: 3, bikeMaxHp: 4
        },
        MOUNT_COST: 1,
        HARVEST_COST: 2,
        ATTACK_COST: 2,
        START_CREDITS: 40,

        ECON: {
            TICKET: 4000,
            BIKE: 400,
            REPAIR_PER_HP: 10,
            WEALTH_START: 100,
            WEALTH_MAX: 120,
            DEMAND_MIN: 0.7,
            DEMAND_MAX: 1.5,
            DRIFT_CHANCE: 0.05,   // per day: one settlement re-rolls one demand
            CAMP_BANK: 50,        // starting bank; +25 per camp already razed
            CAMP_BANK_ESCALATION: 25
        },

        WORLD: {
            MAP_COLS: 60, MAP_ROWS: 40,
            TOWNS: 3, SETTLEMENTS: 6, CAMPS: 4, CAMP_MAX: 5,
            TOWN_DIST: [8, 14], SETTLEMENT_DIST: [10, 20], CAMP_DIST: [18, 99],
            LOC_SEP: 5,           // min hex distance between placed locations
            SETTLE_FENCE: 2,      // predators never come this close to a settlement
            SIGHT: 6,             // live entities render within this of the player
            REVEAL: 5,            // hexes within this of the player become seen
            PRED_INIT: 5, PRED_MAX: 9, PRED_SPAWN: 0.03, PRED_MIN_DIST: 12,
            PRED_GRAVEMAW_SHARE: 0.3,
            FRINGE: 18,           // new camps/predators appear at least this far out
            BLOOM_CHANCE: 0.25, NODE_MAX: 70,
            RICH_DIST: 14, RICH_BONUS: 2,   // nodes past RICH_DIST yield +RICH_BONUS
            CAMP_FOUND_CHANCE: 0.02
        },

        // Flavor name pools (drawn through the seeded Rando during generation).
        NAMES: {
            LOC_A: ['Rust', 'Kesh', 'Dry', 'Bone', 'Glass', 'Vesper', 'Mund', 'Tallow',
                'Sallow', 'Ferrous', 'Grit', 'Vane', 'Ochre', 'Cinder', 'Sump', 'Bray'],
            LOC_B: [' Hollow', ' Well', ' Reach', ' Gulch', ' Flat', ' Cross', ' Landing',
                ' Point', ' Rest', ' Verge', ' Stand', ' Bar'],
            STARPORT: 'Kess Spindle Starport',
            GANGS: ['Red Quill', 'Ash Vipers', 'Hollow Suns', 'Glasstooth', 'Rustdogs',
                'Pale Riders', 'Sand Eels', 'Broken Crowns', 'Vesk Jackals', 'Grey Talons']
        }
    };
})();
