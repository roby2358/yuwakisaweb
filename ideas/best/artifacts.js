// artifacts.js — GameArtifacts
//
// Static definitions of the game's pieces and rules — the vocabulary the engine
// reasons over: terrain, resource nodes, foes, skills, ranks, and the fixed numeric
// constants of the world and a turn. Server-side data: no colors, no pixels.
// Display attributes live in GameDisplayArtifacts.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
const GameArtifacts = (function () {
    const TERRAIN = {
        MEADOW: 0,
        COPPICE: 1,
        HILL: 2,
        MOOR: 3,
        ASHEN: 4,
        CRAG: 5,
        MERE: 6
    };
    const T = TERRAIN;

    // Per-terrain rules. moveCost Infinity = impassable. nodeKind/nodeChance seed
    // harvestable nodes at world gen.
    const TERRAIN_RULES = {
        [T.MEADOW]: { label: 'meadow', moveCost: 1, nodeKind: 'forage', nodeChance: 0.08 },
        [T.COPPICE]: { label: 'coppice', moveCost: 1, nodeKind: 'forage', nodeChance: 0.30 },
        [T.HILL]: { label: 'hills', moveCost: 2, nodeKind: 'ore', nodeChance: 0.25 },
        [T.MOOR]: { label: 'moor', moveCost: 2, nodeKind: 'ore', nodeChance: 0.10 },
        [T.ASHEN]: { label: 'ashenland', moveCost: 2, nodeKind: 'relic', nodeChance: 0.22 },
        [T.CRAG]: { label: 'crag', moveCost: Infinity, nodeKind: null, nodeChance: 0 },
        [T.MERE]: { label: 'mere', moveCost: Infinity, nodeKind: null, nodeChance: 0 }
    };

    // Terrain mix per danger ring (0 = hearthlands around the Hall, 4 = the dread).
    // Weighted draws at world gen; crags/meres are sprinkled on top.
    const RING_TERRAIN = [
        [{ item: T.MEADOW, weight: 70 }, { item: T.COPPICE, weight: 25 }, { item: T.HILL, weight: 5 }],
        [{ item: T.MEADOW, weight: 45 }, { item: T.COPPICE, weight: 35 }, { item: T.HILL, weight: 20 }],
        [{ item: T.MEADOW, weight: 15 }, { item: T.COPPICE, weight: 30 }, { item: T.HILL, weight: 35 }, { item: T.MOOR, weight: 20 }],
        [{ item: T.MOOR, weight: 45 }, { item: T.HILL, weight: 25 }, { item: T.COPPICE, weight: 15 }, { item: T.ASHEN, weight: 15 }],
        [{ item: T.ASHEN, weight: 65 }, { item: T.MOOR, weight: 25 }, { item: T.HILL, weight: 10 }]
    ];

    // Resource nodes: base value per harvest, scaled by the ring multiplier and the
    // matching skill. `skill` is the thriving skill that harvests (and levels from) it.
    const NODES = {
        forage: { label: 'forage', base: 4, skill: 'gathering' },
        ore: { label: 'ore vein', base: 6, skill: 'delving' },
        relic: { label: 'buried relic', base: 10, skill: 'delving' }
    };
    const RING_YIELD = [1.0, 1.3, 1.8, 2.6, 3.6];

    // Foes: one template. role picks the behavior from the engine's ROLES dispatch —
    // prey flees and is hunted; stalkers chase the hero; raiders spawn from dooms and
    // besiege when the Reckoning is high; champions are named and hunt structures.
    const FOES = {
        fen_deer: { label: 'fen deer', tier: 1, role: 'prey', hp: 3, dmg: 0, speed: 1, aggro: 0, spoils: 4, atkVerb: null },
        dire_boar: { label: 'dire boar', tier: 1, role: 'stalker', hp: 6, dmg: 2, speed: 1, aggro: 2, spoils: 6, atkVerb: 'gores' },
        crag_wolf: { label: 'crag wolf', tier: 2, role: 'stalker', hp: 8, dmg: 3, speed: 2, aggro: 4, spoils: 9, atkVerb: 'savages' },
        moor_troll: { label: 'moor troll', tier: 3, role: 'stalker', hp: 16, dmg: 5, speed: 1, aggro: 3, spoils: 18, atkVerb: 'crushes' },
        husk: { label: 'husk', tier: 1, role: 'raider', hp: 5, dmg: 2, speed: 1, aggro: 5, spoils: 5, atkVerb: 'claws' },
        ravener: { label: 'ravener', tier: 2, role: 'raider', hp: 9, dmg: 4, speed: 1, aggro: 5, spoils: 10, atkVerb: 'rends' },
        wraith_knight: { label: 'wraith-knight', tier: 3, role: 'raider', hp: 14, dmg: 6, speed: 2, aggro: 6, spoils: 16, atkVerb: 'cleaves' },
        herald: { label: 'herald', tier: 3, role: 'champion', hp: 22, dmg: 7, speed: 1, aggro: 8, spoils: 30, atkVerb: 'smites' }
    };

    // Which wild beasts roam each ring (weighted). Raiders come from dooms instead.
    const WILD_BY_RING = [
        [{ item: 'fen_deer', weight: 100 }],
        [{ item: 'fen_deer', weight: 60 }, { item: 'dire_boar', weight: 40 }],
        [{ item: 'dire_boar', weight: 40 }, { item: 'crag_wolf', weight: 50 }, { item: 'fen_deer', weight: 10 }],
        [{ item: 'crag_wolf', weight: 55 }, { item: 'moor_troll', weight: 45 }],
        [{ item: 'moor_troll', weight: 70 }, { item: 'crag_wolf', weight: 30 }]
    ];

    // Raider tier drawn per doom: doom tier ± the Reckoning's upward pressure.
    const RAIDERS_BY_TIER = { 1: 'husk', 2: 'ravener', 3: 'wraith_knight' };

    // The thriving skills: one mechanical template — use-based xp equal to the
    // magnitude of the deed, uncapped levels, one `per`-level bump applied by the
    // engine's derived-stat getters. mode 'pct' multiplies, 'flat' adds.
    const SKILLS = [
        { key: 'gathering', name: 'Gathering', mode: 'pct', per: 0.15, desc: '+15% forage yield per level' },
        { key: 'delving', name: 'Delving', mode: 'pct', per: 0.15, desc: '+15% ore and relic yield per level' },
        { key: 'hunting', name: 'Hunting', mode: 'pct', per: 0.15, desc: '+15% spoils from slain foes per level' },
        { key: 'combat', name: 'Combat', mode: 'flat', per: 1, desc: '+1 attack damage per level' },
        { key: 'warding', name: 'Warding', mode: 'flat', per: 1, desc: '-1 damage taken per level' },
        { key: 'crafting', name: 'Crafting', mode: 'pct', per: 0.10, desc: 'treasures worth +10% more per level' },
        { key: 'trading', name: 'Trading', mode: 'pct', per: 0.10, desc: '+10% wealth when banking per level' },
        { key: 'building', name: 'Building', mode: 'pct', per: 0.04, desc: 'monuments cost 4% less per level (max 50%)' },
        { key: 'presence', name: 'Presence', mode: 'pct', per: 0.08, desc: '+8% renown from deeds per level' }
    ];

    // Rank ladder: title held while renown >= at. Privileges are cumulative.
    // `priv` is the engine hook key; the desc is repeated in the skills panel.
    const RANKS = [
        { key: 'unsung', title: 'the Unsung', at: 0, priv: null, privDesc: 'no one knows your name' },
        { key: 'whispered', title: 'the Whispered', at: 15, priv: 'carry', privDesc: '+4 pack capacity' },
        { key: 'known', title: 'the Known', at: 40, priv: 'tithes', privDesc: 'each holding pays 1 wealth per dawn' },
        { key: 'honored', title: 'the Honored', at: 100, priv: 'falter', privDesc: 'foes falter: 25% chance an attacker misses' },
        { key: 'famed', title: 'the Famed', at: 250, priv: 'dread', privDesc: 'tier-1 foes flee your presence' },
        { key: 'exalted', title: 'the Exalted', at: 600, priv: 'chorus', privDesc: 'monuments sing: their renown is doubled' },
        { key: 'legendary', title: 'the Legendary', at: 1500, priv: 'heroic', privDesc: 'heroic strikes: +50% attack damage' },
        { key: 'mythic', title: 'the Mythic', at: 3500, priv: 'watched', privDesc: 'the world watches: all renown gains +50%' }
    ];

    // The six works of a hero's life, each raised at most once at a time (a razed
    // form can be raised again). Income is the form's voice — a renown floor at full
    // build-out, never a passive engine to the top of the ladder.
    const MONUMENT_FORMS = [
        { form: 'Cairn', income: 2 },
        { form: 'Standing Stone', income: 3 },
        { form: 'Obelisk', income: 4 },
        { form: 'Statue', income: 6 },
        { form: 'Triumphal Arch', income: 8 },
        { form: 'Colossus', income: 10 }
    ];

    // Doom epithets by tier — harm-coded names on harm-doing things.
    const DOOM_EPITHETS = {
        1: ['the Gnawing Warren', 'the Husk Meadow', 'the Sunken Fane', 'the Rotting Palisade'],
        2: ['the Hollow Court', 'the Weeping Gate', 'the Pale Furnace', 'the Withering Choir'],
        3: ['the Throne of Ash', 'the Unmade Spire', 'the Devouring Dark', 'the Crown of Ruin']
    };

    // Every tuned number in one place. See DYNAMICS.md for why each is what it is.
    const RULES = {
        MAP_COLS: 56,
        MAP_ROWS: 40,
        RING_WIDTH: 6,             // hexes per danger ring, measured from the Hall
        RING_MAX: 4,
        CRAG_SPRINKLE: 0.05,       // extra crags anywhere
        MERE_BLOBS: 3,             // lakes, random-walked
        MERE_SIZE: 8,

        ROLL_SPREAD: 0.25,         // every payout is a gaussian roll around its rule
                                   // value; stddev = value * this. Costs never roll.

        HERO_HP: 24,
        HERO_MP: 5,
        HERO_ATTACK: 4,
        ATTACK_MP: 2,
        BANK_MP: 1,
        CRAFT_MP: 1,
        BUILD_MP: 2,
        MIN_DAMAGE: 1,             // warding can never reduce a hit below this

        PACK_CAP: 8,               // spoils carried; +4 at Whispered
        CARRY_PRIV: 4,

        NODE_STOCK_MIN: 2,         // harvests before a node is spent
        NODE_STOCK_MAX: 4,
        NODE_REGROW: 0.03,         // chance per dawn a spent node restocks

        DECAY_DIVISOR: 10,         // dawn tax: renown -= floor(renown / this)
        DECAY_FLOOR: 10,           // small fame lingers: no decay at or below this
        RANK_HOLD: 0.8,            // hysteresis: a title is held until renown falls
                                   // below this fraction of its threshold
        DEATH_RENOWN_KEPT: 0.85,   // falling in the field bruises your standing
        BANK_RENOWN_DIVISOR: 4,    // renown per banked value = value / this
        KILL_RENOWN_PER_TIER: 2,
        CHAMPION_RENOWN: 20,

        CRAFT_BATCH: 3,            // raw spoils fused per craft; treasures are final —
                                   // they cannot be re-fused into greater treasures
        CRAFT_MULT: 1.3,           // treasure value = sum * (this + crafting per-level)

        MONUMENT_BASE_COST: 60,    // cost = base * (form number), less the Building
                                   // discount; grander forms cost more
        BUILD_DISCOUNT_MAX: 0.5,
        MONUMENT_HP: 20,
        MONUMENT_HP_PER: 4,        // later monuments are sturdier too
        MONUMENT_MIN_DIST: 3,      // from any other anchor
        MONUMENT_LOSS_RENOWN: 40,  // toppled monuments wound your standing

        STRUCTURE_REGEN: 1,        // holdings and monuments are repaired each dawn —
                                   // a siege must outpace the masons

        HOLDING_COUNT: 5,
        HOLDING_HP: 30,
        HOLDING_MILITIA: 3,        // the small folk man the walls: damage per dawn to
                                   // one adjacent hostile — lone raiders can't take a
                                   // holding, packs and champions can
        HOLDING_MIN_DIST: 7,       // between anchors at world gen
        HOLDING_MAX_RING: 2,
        REST_HEAL: 6,              // ending the turn at the Hall or a holding
        TITHE_WEALTH: 1,           // per holding per dawn at Known+

        SACK_SPOILS: 3,            // plunder spoils gained
        SACK_SPOIL_VALUE: 30,
        SACK_RENOWN: 60,
        SACK_RECKONING: 2,

        DOOM_START: [1, 1, 2],     // tiers of the dooms the world begins with
        DOOM_HP_PER_TIER: 18,
        DOOM_REWARD_PER_TIER: 55,  // renown for a toppling
        DOOM_SPOILS_PER_TIER: 2,   // relic spoils dropped, each worth ~relic base * tier
        DOOM_MIN_DIST_HALL: 10,
        DOOM_MIN_DIST: 6,
        DOOM_SPAWN_CHANCE: 0.12,   // raider spawn roll per doom per dawn
        DOOM_RAIDER_CAP: 2,        // + tier
        RAIDER_LEASH: 8,           // raiders this far from their doom AND the hero
        RAIDER_DECAY: 0.15,        //   slink home at this chance per dawn; orphans of
                                   //   toppled dooms scatter at the same rate anywhere
        DOOM_FESTER_SPAWN: 0.002,  // spawn chance grows by this per fester point
        CHAMPION_FESTER: 80,       // festering this long lets a champion rise
        CHAMPION_CHANCE: 0.08,
        DOOMRISE_TURNS: 10,        // countdown after a doom falls
        DOOM_MAX: 8,               // living dooms cap — the world escalates, it
                                   // doesn't silt up
        RECKONING_HP_SCALE: 0.08,  // raiders gain this fraction of hp/dmg per Reckoning
        SIEGE_RECKONING: 2,        // raiders besiege structures once Reckoning reaches this

        WILD_CAP: 22,
        WILD_SPAWN_CHANCE: 0.35,   // per dawn while under cap
        SPAWN_MIN_DIST: 4,         // from the hero
        WANDER_CHANCE: 0.4,
        PREY_FLEE: 0.5,            // chance prey bolts when the hero closes
        FALTER_CHANCE: 0.25,
        FAST_SPEED_CHANCE: 0.2,    // any spawn might be the quick one: +1 speed

        LOG_LIMIT: 40
    };

    return {
        TERRAIN,
        TERRAIN_RULES,
        RING_TERRAIN,
        NODES,
        RING_YIELD,
        FOES,
        WILD_BY_RING,
        RAIDERS_BY_TIER,
        SKILLS,
        RANKS,
        MONUMENT_FORMS,
        DOOM_EPITHETS,
        RULES
    };
})();
