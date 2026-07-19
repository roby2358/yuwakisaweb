// artifacts.js — GameArtifacts
//
// Server-portable rules data: every doom, ward, rank, and terrain is a parameter
// row here, never a bespoke code path. Riddle pools are per-kind on purpose —
// veiled facets draw from them, so an attentive player learns to read omens
// without paying for divination (see DYNAMICS.md: "Riddles are learnable").
const GameArtifacts = (function () {

    const TERRAIN = {
        WATER: 'water',
        MARSH: 'marsh',
        FIELD: 'field',
        FOREST: 'forest',
        HILL: 'hill'
    };

    // Fraction of hexes assigned to each terrain, lowest elevation first.
    const TERRAIN_BANDS = [
        { terrain: TERRAIN.WATER, upTo: 0.12 },
        { terrain: TERRAIN.MARSH, upTo: 0.20 },
        { terrain: TERRAIN.FIELD, upTo: 0.60 },
        { terrain: TERRAIN.FOREST, upTo: 0.85 },
        { terrain: TERRAIN.HILL, upTo: 1.00 }
    ];

    const MOVE_COST = {
        [TERRAIN.WATER]: Infinity,
        [TERRAIN.MARSH]: 3,
        [TERRAIN.FIELD]: 1,
        [TERRAIN.FOREST]: 2,
        [TERRAIN.HILL]: 2
    };

    // Dooms. targetPool picks victims-of-place:
    //   'flammable' | 'lowland' | 'rich' | 'any'  -> a building
    //   'villager'                                -> a person (place = their home)
    // riddles: what a veiled WHAT-facet sounds like. Same pool every time — learnable.
    const EVENTS = {
        fire: {
            name: 'Fire', prep: 'firebreak', targetPool: 'flammable',
            verb: 'burns', weight: 22,
            riddles: ['something with red teeth', 'a hungry light', 'smoke with no pipe beneath it', 'a warmth that will not be thanked']
        },
        flood: {
            name: 'Flood', prep: 'levee', targetPool: 'lowland',
            verb: 'drowns', weight: 16,
            riddles: ['something with wet hands', 'the river standing up', 'a guest who arrives through the floor', 'water with an opinion']
        },
        raid: {
            name: 'Raid', prep: 'militia', targetPool: 'rich',
            verb: 'plunders', weight: 16,
            riddles: ['iron voices on the road', 'strangers counting your roofs', 'a price put on quiet things', 'hoofbeats out of rhythm']
        },
        storm: {
            name: 'Storm', prep: 'shoring', targetPool: 'any',
            verb: 'batters', weight: 16,
            riddles: ['a sky with a grudge', 'wind enough to argue with stone', 'the clouds closing like a fist', 'thunder rehearsing']
        },
        plague: {
            name: 'Plague', prep: 'physic', targetPool: 'villager',
            verb: 'withers', weight: 15,
            riddles: ['a cold breath under the door', 'something patient and very small', 'a cough passed hand to hand', 'a pale visitor who knocks at every house']
        },
        beast: {
            name: 'Beast', prep: 'stakes', targetPool: 'villager',
            verb: 'takes', weight: 15,
            riddles: ['something with too many legs', 'eyes between the trees', 'a hunger that has learned your paths', 'old claws remembering the taste of the vale']
        }
    };

    // Wards. One per doom kind — the mapping is the readability.
    const PREPS = {
        firebreak: { name: 'Firebreak', desc: 'cleared brush, wetted thatch' },
        levee: { name: 'Levee', desc: 'earthworks against the water' },
        militia: { name: 'Militia', desc: 'mustered folk with sharpened tools' },
        physic: { name: 'Physic', desc: 'herbs, boiled linen, quarantine' },
        stakes: { name: 'Stakes', desc: 'warding stakes and watch-fires' },
        shoring: { name: 'Shoring', desc: 'braced beams and roped roofs' }
    };

    // Buildings. flammable/rich feed doom target pools; placeRiddles are what a
    // veiled WHERE-facet sounds like for a doom aimed here (learnable, like kinds).
    const BUILDINGS = {
        shrine: { name: 'the Shrine', glyph: 'S', flammable: false, rich: false, placeRiddles: ['where you keep your silences', 'under a roof that prays'] },
        stones: { name: 'the Standing Stones', glyph: 'O', flammable: false, rich: false, placeRiddles: ['on the old hill', 'among the patient stones'] },
        chapel: { name: 'the Chapel', glyph: 'C', flammable: true, rich: false, placeRiddles: ['under the bell', 'where the candles gather'] },
        tavern: { name: 'the Wan Hart', glyph: 'T', flammable: true, rich: true, placeRiddles: ['where the singing is', 'under the sign of the pale deer'] },
        granary: { name: 'the Granary', glyph: 'G', flammable: true, rich: true, placeRiddles: ['where the winter sleeps', 'behind the fattest door'] },
        mill: { name: 'the Old Mill', glyph: 'M', flammable: true, rich: true, placeRiddles: ['where water talks', 'beneath the turning wheel'] },
        smithy: { name: 'the Smithy', glyph: 'F', flammable: true, rich: true, placeRiddles: ['where the sparks live', 'at the ringing anvil'] },
        well: { name: 'the Well', glyph: 'W', flammable: false, rich: false, placeRiddles: ['where the buckets go', 'at the deep stone throat'] },
        bridge: { name: 'Mossgate Bridge', glyph: 'B', flammable: false, rich: false, placeRiddles: ['where the road crosses the water', 'at the mossy crossing'] },
        cottage: { name: 'Cottage', glyph: '⌂', flammable: true, rich: false, placeRiddles: ['under a low thatch roof', 'behind a door you have knocked on'] }
    };

    // The renown ladder. magMean is the difficulty dial: fame draws grander dooms.
    // cap = pending dooms allowed at once. Gifts are keyed by rank index in the engine.
    const RANKS = [
        { at: 0, name: 'Hedge Seer', cap: 2, magMean: 10, gift: null },
        { at: 30, name: 'Village Augur', cap: 3, magMean: 12, gift: 'Second Sight — new visions arrive with one more facet shown' },
        { at: 80, name: 'Far-Famed Oracle', cap: 3, magMean: 15, gift: 'Stone-Tongue — divining at the Standing Stones reveals a second facet, free' },
        { at: 160, name: 'Voice of the Vale', cap: 4, magMean: 18, gift: 'Turn Fate — once per 7 days, push a doom 3 days out (+10 Burden)' },
        { at: 280, name: 'Crown of Ravens', cap: 5, magMean: 22, gift: 'The ravens work for you now — +1 action every day' }
    ];

    const TUNING = {
        MP_PER_DAY: 6,
        ACTIONS_PER_DAY: 3,
        BURDEN_SLOW_1: 50,        // burden >= this: -1 action
        BURDEN_SLOW_2: 90,        // burden >= this: -1 more (floor 1)
        BURDEN_CLOUD: 70,         // burden >= this: new visions arrive with one facet fewer (floor 1)

        START_SUPPLIES: 12,
        START_TRUST: 50,

        PREP_COST: 2,             // supplies; costs never roll
        PREP_STRENGTH: 6,         // effects always roll (sd below)
        PREP_STRENGTH_SD: 1.5,
        VILLAGER_YIELD: 1,        // supplies/day per live villager — the unnamed hands in the fields
        WORK_YIELD: 4,
        WORK_YIELD_SD: 1,

        FESTIVAL_COST: 10,
        FESTIVAL_TRUST: 10,
        FESTIVAL_BURDEN: -10,

        DIVINE_BURDEN_SHRINE: 8,
        DIVINE_BURDEN_STONES: 4,
        DIVINE_WHIFF: 0.5,        // divination is a gamble: chance the veil holds and nothing comes
        DIVINE_UNBIDDEN: 0.5,     // when it works: chance the vision picks the facet, not the augur
        INSPIRATION_CHANCE: 0.1,  // per dawn: a random veiled facet reveals itself unasked

        VISION_CHANCE: 0.4,       // per dawn, when under the rank's cap
        VISION_DAYS_MEAN: 7,      // lands this many days out...
        VISION_DAYS_SD: 2,
        VISION_DAYS_MIN: 3,
        VISION_DAYS_MAX: 12,
        MAG_SD_FRAC: 0.2,         // magnitude rolls around the rank mean
        DMG_SD_FRAC: 0.25,        // damage rolls around magnitude

        FACETS_ON_ARRIVAL: 1,     // murky by design: one glimpse, the rest is divination
        FACET_WEIGHTS: [
            { item: 'kind', weight: 30 },
            { item: 'place', weight: 25 },
            { item: 'day', weight: 20 },
            { item: 'victim', weight: 15 },
            { item: 'magnitude', weight: 10 }
        ],

        WARN_BURDEN_RELIEF: 15,
        VIGIL_TRUST_DRAIN: 2,     // per warned doom, per dawn it hasn't landed
        VILLAGE_AID: 2.5,         // accrues on the warned target per dawn (rolls)
        VILLAGE_AID_SD: 0.8,

        RUIN_AT: 7,               // net damage thresholds
        DEATH_AT: 10,

        BURDEN_PER_PENDING: 1,    // per dusk; +1 more if 3+ facets known (knowing weighs)
        BURDEN_KNOWN_EXTRA: 1,
        BURDEN_DECAY: 1,          // per dusk, always

        REBUILD_DAYS: 6,
        TURN_FATE_COOLDOWN: 7,
        TURN_FATE_DELAY: 3,
        TURN_FATE_BURDEN: 10,

        // Resolution ledger (see DYNAMICS.md driver audit)
        AVERT_WARNED: { renown: 20, trust: 25, burden: -12 },
        AVERT_QUIET: { renown: 8, trust: 0, burden: -12 },
        HIT_WARNED: { renown: 6, trust: 10, burden: -12 },
        HIT_QUIET: { renown: 0, trust: -3, burden: -12 },
        HIT_KNEW: { renown: 0, trust: -8, burden: -2 },  // 3+ facets and said nothing
        DEATH_TRUST: -10,
        DEATH_BURDEN: 15,
        GOAT_RENOWN: 2            // the ballad of Barnabas
    };

    const FLAVOR = {
        mutterings: [
            '{name} swears the hens are laying warm eggs. An omen, surely.',
            '{name} asks if you have dreamt anything nice for a change.',
            '{name} left a turnip at the shrine. It is a very good turnip.',
            'The dogs barked at nothing all night. {name} blames you personally.',
            '{name} wants to know if the weather will hold. You know worse things.',
            'Barnabas the goat has eaten the churchwarden\'s hat again.',
            '{name} says the river sounded like whispering last night.',
            'A peddler passed through asking after "the seer". {name} pointed the wrong way, on principle.'
        ],
        arrival: [
            'The candle gutters. A vision comes:',
            'The bones fall wrong. You see it:',
            'Between one breath and the next, you see it:',
            'The tea leaves arrange themselves. Unwillingly, you look:'
        ],
        festival: [
            'There is dancing. Someone puts a garland on Barnabas.',
            'The Wan Hart runs dry by midnight. Nobody minds.',
            'Bonfires, bad singing, and for one evening nobody asks you about the future.'
        ],
        newcomer: [
            '{name} arrives on the north road, having heard of the vale\'s famous augur. One more soul to keep.',
            'Drawn by your renown, {name} builds where the field was. One more roof to watch.'
        ]
    };

    return { TERRAIN, TERRAIN_BANDS, MOVE_COST, EVENTS, PREPS, BUILDINGS, RANKS, TUNING, FLAVOR };
})();
