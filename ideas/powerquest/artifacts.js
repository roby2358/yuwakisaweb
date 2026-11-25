// artifacts.js — GameArtifacts
//
// Static rules-data for Power Quest: terrain, movement costs, the module and perk
// templates, enemy kinds, and every tunable number (each is listed by name in
// ONTOLOGY.md §6). Server-side data: no colors, no pixels (those live in
// GameDisplayArtifacts). Plain-script global so the page runs from file:// on double-click.
const GameArtifacts = (function () {
    const TERRAIN = { WATER: 0, PLAINS: 1, JUNGLE: 2, MESA: 3 };

    // ---- Module templates (D-10): passive {stat}, weapon {range,dmg,cost}, active {effect,amount,cost}
    // 'tier' gates blueprint drops by distance and the village tier needed to craft (tier - 1).
    const MODULES = {
        pulse_rifle: { name: 'Pulse Rifle',  template: 'weapon',  tier: 1, range: 3, dmg: 3, cost: 1, price: { scrap: 5, cells: 0 } },
        plating:     { name: 'Plating',      template: 'passive', tier: 1, stat: 'armor',      amount: 1, price: { scrap: 6, cells: 0 } },
        servos:      { name: 'Servos',       template: 'passive', tier: 1, stat: 'mp',         amount: 1, price: { scrap: 4, cells: 1 } },
        scope:       { name: 'Scope',        template: 'passive', tier: 1, stat: 'sight',      amount: 1, price: { scrap: 3, cells: 1 } },
        scatter_arc: { name: 'Scatter Arc',  template: 'weapon',  tier: 2, range: 2, dmg: 6, cost: 2, price: { scrap: 8, cells: 2 } },
        cell_pack:   { name: 'Cell Pack',    template: 'passive', tier: 2, stat: 'chargeMax',  amount: 2, price: { scrap: 6, cells: 2 } },
        mender:      { name: 'Mender',       template: 'active',  tier: 2, effect: 'heal',    amount: 6, cost: 2, price: { scrap: 6, cells: 2 } },
        long_rail:   { name: 'Long Rail',    template: 'weapon',  tier: 3, range: 5, dmg: 5, cost: 2, price: { scrap: 8, cells: 4 } },
        aegis:       { name: 'Aegis',        template: 'active',  tier: 3, effect: 'shield',  amount: 6, cost: 2, price: { scrap: 4, cells: 4 } },
        reactor:     { name: 'Reactor',      template: 'passive', tier: 3, stat: 'chargeRegen', amount: 1, price: { scrap: 8, cells: 4 } },
        hardsuit:    { name: 'Hardsuit',     template: 'passive', tier: 3, stat: 'armor',      amount: 2, price: { scrap: 12, cells: 4 } }
    };

    // ---- Perk template (D-9): every perk is a stat modifier that stacks by rank.
    const PERKS = {
        tough:     { name: 'Tough',     stat: 'hpMax',       amount: 6 },
        fleet:     { name: 'Fleet',     stat: 'mp',          amount: 1 },
        wired:     { name: 'Wired',     stat: 'chargeMax',   amount: 2 },
        tuned:     { name: 'Tuned',     stat: 'chargeRegen', amount: 1 },
        keen:      { name: 'Keen',      stat: 'sight',       amount: 1 },
        brutal:    { name: 'Brutal',    stat: 'melee',       amount: 2 },
        hardened:  { name: 'Hardened',  stat: 'armor',       amount: 1 },
        scavenger: { name: 'Scavenger', stat: 'loot',        amount: 1 }
    };

    // ---- Enemy kinds (D-12): one template, parameter sets. group: raider | beast | relic.
    const ENEMY_KINDS = {
        scavenger: { name: 'Scavenger', group: 'raider', tier: 1, hp: 6,  dmg: 2, range: 1, speed: [1, 2], xp: 3,  drop: { scrap: 2, cells: 0 } },
        slinger:   { name: 'Slinger',   group: 'raider', tier: 2, hp: 8,  dmg: 3, range: 2, speed: [1, 2], xp: 5,  drop: { scrap: 3, cells: 0 } },
        brute:     { name: 'Brute',     group: 'raider', tier: 3, hp: 18, dmg: 5, range: 1, speed: [1, 2], xp: 9,  drop: { scrap: 5, cells: 1 } },
        warlord:   { name: 'Warlord',   group: 'raider', tier: 4, hp: 32, dmg: 7, range: 1, speed: [1, 2], xp: 20, drop: { scrap: 8, cells: 2 } },
        jackal:    { name: 'Jackal',    group: 'beast',  tier: 1, hp: 5,  dmg: 2, range: 1, speed: [2, 3], xp: 3,  drop: { scrap: 1, cells: 0 } },
        stalker:   { name: 'Stalker',   group: 'beast',  tier: 2, hp: 12, dmg: 4, range: 1, speed: [2, 3], xp: 7,  drop: { scrap: 1, cells: 1 } },
        tusker:    { name: 'Tusker',    group: 'beast',  tier: 3, hp: 24, dmg: 6, range: 1, speed: [1, 2], xp: 12, drop: { scrap: 2, cells: 2 } },
        thunderbeast: { name: 'Thunderbeast', group: 'beast', tier: 4, hp: 40, dmg: 8, range: 1, speed: [1, 2], xp: 26, drop: { scrap: 3, cells: 4 } },
        drone:     { name: 'Drone',     group: 'relic',  tier: 2, hp: 9,  dmg: 3, range: 3, speed: [1, 2], xp: 6,  drop: { scrap: 0, cells: 2 } },
        walker:    { name: 'Walker',    group: 'relic',  tier: 3, hp: 22, dmg: 5, range: 2, speed: [1, 2], xp: 14, drop: { scrap: 1, cells: 4 } },
        colossus:  { name: 'Colossus',  group: 'relic',  tier: 4, hp: 45, dmg: 9, range: 3, speed: [1, 1], xp: 40, drop: { scrap: 2, cells: 8 } }
    };

    return {
        TERRAIN,
        MOVEMENT_COST: {
            [TERRAIN.WATER]: Infinity,
            [TERRAIN.PLAINS]: 1,
            [TERRAIN.JUNGLE]: 2,
            [TERRAIN.MESA]: 3
        },
        MODULES, PERKS, ENEMY_KINDS,
        STARTER_MODULE: 'pulse_rifle',
        STAT_KEYS: ['hpMax', 'mp', 'chargeMax', 'chargeRegen', 'sight', 'melee', 'armor', 'loot'],

        // ---- Map ----
        MAP_COLS: 80,
        MAP_ROWS: 60,
        GEN_MAX_ATTEMPTS: 10,        // tries per seed before falling back to KNOWN_GOOD_SEED
        KNOWN_GOOD_SEED: 1,
        MIN_LAND_FRAC: 0.45,         // the largest connected land mass must hold this fraction of inner hexes
        HEIGHTMAP_SIZE: 129,         // diamond-square grid side; must be 2^n + 1
        HEIGHTMAP_ROUGHNESS: 0.55,
        WATER_PCT: 0.18,             // elevation percentile cut: below -> water
        MESA_PCT: 0.90,              //   at/above -> mesa (the high flat tops)
        JUNGLE_FRAC: 0.30,           // of plains hexes, the wettest become jungle

        // ---- Sites ----
        VILLAGE_COUNT: 5,
        VILLAGE_MIN_DIST: 14,
        RUIN_COUNT: 14,
        CAMP_COUNT: 4,
        DEN_COUNT: 5,
        SITE_MIN_DIST: 4,            // between any two sites
        HOME_SAFE_DIST: 10,          // lairs keep this far from the home village
        LAIR_VILLAGE_MIN: 7,         // lairs keep this far from any village
        START_RUIN_DIST: [4, 7],     // the guaranteed first ruin lies this far from home
        JUNGLE_HIDE_RADIUS: 2,       // sites on jungle are only discovered inside this distance

        // ---- Hero ----
        BASE_HP: 20,
        BASE_MP: 6,
        BASE_CHARGE: 6,
        CHARGE_REGEN_WILD: 1,        // per world phase
        BASE_SIGHT: 4,
        MESA_SIGHT_BONUS: 2,
        JUNGLE_SIGHT_PENALTY: 2,
        MIN_SIGHT: 1,
        MESA_RANGE_BONUS: 1,
        MELEE_MP: 1,
        MELEE_BASE: 3,
        DMG_SPREAD: 2,               // damage rolls base + 0..DMG_SPREAD
        MIN_DMG: 1,                  // armor never reduces a hit below this
        BOOST_MP_PER_CHARGE: 1,
        BASE_SOCKETS: 2,
        SOCKET_LEVEL_STEP: 3,        // one more socket every this many levels
        MAX_SOCKETS: 6,
        XP_STEP: 25,                 // xp to leave level L is XP_STEP * L
        PERK_OFFER: 3,

        // ---- Villages and trust ----
        START_TRUST: -3,
        HOME_TRUST: 6,
        TRUST_MAX: 12,
        OPEN_TRUST: 1,               // a village serves you at this trust or more
        TRUST_RADIUS: 8,             // a kill within this of a village earns it trust
        KILL_TRUST_PER_TIER: 1,
        CELL_VALUE: 3,               // a cell is worth this many scrap when deposited
        GIFT_VALUE_PER_TRUST: 4,
        GIFT_CAP: 4,                 // trust a village will take from gifts in one burst
        GIFT_REFILL: 0.25,           // per turn
        TIER_COSTS: [0, 12, 30, 60, 100, 160],   // deposited value to reach tier index
        MAX_TIER: 5,
        VILLAGE_HP_BASE: 12,
        VILLAGE_HP_PER_TIER: 6,
        VILLAGE_HP_REGEN: 1,
        VILLAGE_REGEN_PER_TIER: 1,
        HEAL_BASE: 3,                // hero hp per world phase on a village hex you may use
        HEAL_PER_TIER: 2,
        DECAY_PERIOD: 10,            // turns between trust losses when neglected
        NEGLECT_RADIUS: 14,
        FOUND_SCRAP: 15,
        FOUND_CELLS: 3,
        FOUND_MIN_DIST: 10,
        FOUND_TRUST: 4,
        FOUND_RADIUS: 20,
        FOUNDER_TRUST: 4,

        // ---- Shutdown ----
        SHUTDOWN_HP: 1,
        SHUTDOWN_DAYS: 3,
        LOSE_PACK_FRAC: 0.5,
        LOSE_XP_FRAC: 0.5,
        SHUTDOWN_TRUST: 1,

        // ---- Ecology ----
        ROAMER_COUNT: 16,
        LAIR_SPAWN_PERIOD: 6,
        LAIR_CAP: 3,
        ENEMY_CAP: 60,
        ROAMER_FLOOR: 16,            // below this many non-guardians, wild ones may appear
        ROAMER_SPAWN_CHANCE: 0.5,    // per world phase while under the floor
        ROAMER_SPAWN_MIN_DIST: 8,    // and never this close to the hero
        LAIR_REARM: 60,              // turns after its guardian dies before a lair stirs again
        TIER_DIST: 12,               // hexes from the nearest village per extra enemy tier
        TIER_LEVELS: 3,              // hero levels per extra enemy tier
        MAX_ENEMY_TIER: 4,
        GUARDIAN_HP_MULT: 1.5,
        AGGRO: 4,
        ROAM_LEASH: 8,
        GUARD_LEASH: 4,
        HOME_RADIUS: 6,
        HOME_XP_MULT: 0.5,
        REVENGE_XP_MULT: 2,
        DISCOVERY_XP: 8,
        VILLAGE_DISCOVERY_XP: 3,
        RUIN_CELLS: 2,
        RAID_DAMAGE_PER_HIT: 0.5,    // multiplier on the raider's dmg against a village, before walls
        LOG_MAX: 40
    };
})();
