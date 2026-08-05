// artifacts.js — GameArtifacts
//
// Static definitions of the game's *pieces and rules* — the vocabulary the engine reasons
// over: terrain, movement, unit stats, factions, the CRT, and the economy/victory numbers.
// This is server-side data: no colors, no pixels, nothing the engine wouldn't need to
// adjudicate a move. Display attributes (colors, labels, blurbs) live in
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
        CITY: 5,      // replaces a city hex's underlying terrain at generation
        CAPITAL: 6,   // ... same, for the four capitals
    };

    // Every unit is a parameter set for one template: { atk, def, mp, cost, cap, flags }.
    // Identity comes from the flags — the rule each type breaks — not stat spreads:
    //   exploit    participates in Breakthrough advances (and gets the free follow-up move)
    //   support:N  adds attack to combats within N hexes without advancing (artillery)
    //   strike:N   adds attack to one combat within N hexes per turn, from a city base (air)
    //   occupier   suppresses revolt; cannot attack, cannot leave friendly territory
    //   command:N  projects a radius-N command web (1-CP activations)
    //   bombard:N  ranged strike vs cities/stacks within N: burns stockpiled CP or
    //              strips entrenchment
    //   flies      all terrain costs 1 (water and mountains included); ignores ZOC
    //   allTerrain land terrain costs 1, mountains passable (water still impassable)
    //   siege      defenders it attacks cap their terrain+city multiplier at SIEGE_CAP
    //   cohesion   stack always activates for 1 CP; its city never revolts
    const UNITS = {
        infantry:  { name: 'Infantry',       atk: 2, def: 3, mp: 3, cost: 3,  cap: Infinity, flags: {} },
        armor:     { name: 'Armor',          atk: 4, def: 3, mp: 6, cost: 6,  cap: Infinity, flags: { exploit: true } },
        artillery: { name: 'Artillery',      atk: 3, def: 1, mp: 2, cost: 4,  cap: Infinity, flags: { support: 2 } },
        air:       { name: 'Air Wing',       atk: 3, def: 1, mp: 0, cost: 6,  cap: Infinity, flags: { strike: 6 } },
        garrison:  { name: 'Garrison',       atk: 0, def: 2, mp: 2, cost: 2,  cap: Infinity, flags: { occupier: true } },
        hq:        { name: 'HQ',             atk: 0, def: 1, mp: 3, cost: 8,  cap: 2, flags: { command: 4 } },
        rocket:    { name: 'Rocket Battery', atk: 0, def: 1, mp: 2, cost: 7,  cap: 2, flags: { bombard: 8 } },
        dragon:    { name: 'Dragon',         atk: 12, def: 5, mp: 8, cost: 10, cap: 1, flags: { exploit: true, flies: true } },
        wardens:   { name: 'Wardens',        atk: 3, def: 3, mp: 4, cost: 5,  cap: 12, flags: { cohesion: true } },
        colossus:  { name: 'Colossus',       atk: 8, def: 8, mp: 4, cost: 10, cap: 1, flags: { allTerrain: true, siege: true } },
        militia:   { name: 'Partisan Militia', atk: 2, def: 2, mp: 2, cost: 0, cap: Infinity, flags: {} },
    };

    // The six types every faction can build; each faction adds its unique on top.
    const SHARED_BUILD = ['infantry', 'armor', 'artillery', 'air', 'garrison', 'hq'];

    const FACTIONS = [
        { id: 'concord',   name: 'The Iron Concord',      unique: 'rocket' },
        { id: 'thornwood', name: 'The Thornwood Compact', unique: 'dragon' },
        { id: 'marches',   name: 'The Grey Marches',      unique: 'wardens' },
        { id: 'vault',     name: 'The Vault Ascendancy',  unique: 'colossus' },
    ];

    // Combat Results Table, the Third Reich homage. Columns keyed by odds (1:1 .. 4:1+),
    // rows indexed by d6-1. AR attacker retreats, EX both lose their most expensive
    // unit, DR defender retreats 2 (eliminated if it can't), DE defender eliminated.
    const COMBAT = {
        CRT: {
            1: ['AR', 'AR', 'EX', 'EX', 'DR', 'DR'],
            2: ['AR', 'EX', 'DR', 'DR', 'DE', 'DE'],
            3: ['EX', 'DR', 'DR', 'DE', 'DE', 'DE'],
            4: ['DR', 'DR', 'DE', 'DE', 'DE', 'DE'],
        },
        MAX_ODDS: 4,
        TERRAIN_DEF_MULT: {
            [TERRAIN.WATER]: 1,
            [TERRAIN.PLAINS]: 1,
            [TERRAIN.HILLS]: 1.5,
            [TERRAIN.MOUNTAIN]: 2,
            [TERRAIN.FOREST]: 1.5,
            [TERRAIN.CITY]: 1,      // the city bonus itself comes from CITY_DEF_MULT below
            [TERRAIN.CAPITAL]: 1,
        },
        CITY_DEF_MULT: 2,
        ENTRENCH_MULT: 1.5,
        SIEGE_CAP: 1.5,           // colossus caps terrain×city at this
        EXPLOIT_MP: 2,            // free follow-up MP after a breakthrough
        RETREAT_STEPS: 2,         // DR distance; failing any step = elimination (pockets)
    };

    const ECON = {
        START_CP: 10,
        CP_CAPITAL: 5,
        CP_HOMELAND: 3,
        CP_CONQUERED: 2,          // only once heldTurns >= 1 (no capture-and-cash farming)
        CP_HOMELAND_NO_CAPITAL: 1,// homeland cities pay this while your capital is lost
        ACTIVATE_WEB: 1,          // stack activation inside the command web
        ACTIVATE_FAR: 2,          // ... and beyond it (the empire's distance tax)
        COMMAND_RADIUS: 4,        // around a held capital (HQs use flags.command)
        REVOLT_ON: 5,             // d6 >= this revolts an unheld conquered city
        DRAGON_REBUILD_BUMP: 3,   // dragon rebuild cost escalator per death
    };

    const CITIES = {
        COUNT: 24,
        MIN_SPACING: 4,
        HOMELAND_PER_FACTION: 3,  // cities beyond the capital
        VICTORY_NEUTRALS: 5,      // victory cities = 4 capitals + this many neutrals
        VICTORY_NEED: 5,
        VICTORY_STREAK: 3,        // consecutive turns holding VICTORY_NEED to win
        CONTROL_RADIUS: 3,        // initial ownership painted around homeland cities
    };

    const STACK_LIMIT = 3;

    // AI temperament — how the non-player powers wage the war.
    const AI = {
        FRONT_STACKS: 8,        // stacks operated per turn, nearest-to-objective first
        RESERVE_CP: 8,          // build no deeper than this; the rest funds operations
        UNITS_PER_CITY: 3,      // army-size cap multiplier before builds pause
        OBJECTIVE_TIMEOUT: 10,  // turns committed to one objective before repicking
        GRIND_AGE: 3,           // stalled this long, the AI starts pressing 1:1 attacks
        MIN_ODDS: 2,            // preferred attack odds otherwise
    };

    return {
        TERRAIN,
        MOVEMENT_COST: {
            [TERRAIN.WATER]: Infinity,
            [TERRAIN.PLAINS]: 1,
            [TERRAIN.HILLS]: 2,
            [TERRAIN.MOUNTAIN]: Infinity,
            [TERRAIN.FOREST]: 2,
            [TERRAIN.CITY]: 2,      // 1 for the hex's owning faction — see unitMoveCost
            [TERRAIN.CAPITAL]: 2,
        },
        UNITS,
        SHARED_BUILD,
        FACTIONS,
        COMBAT,
        ECON,
        CITIES,
        STACK_LIMIT,
        AI,
        PARTISAN: 'partisan',     // pseudo-faction id: hostile to all, no CP economy
        MAP_COLS: 60,
        MAP_ROWS: 40,
    };
})();
