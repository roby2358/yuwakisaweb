// artifacts.js — GameArtifacts
//
// Static definitions of the game's *pieces and rules* — the vocabulary the engine reasons
// over: biomes and their war/movement/hazard/yield rules, creature archetypes, talent
// definitions, and the fixed numeric constants of the world and a turn. This is
// server-side data: no colors, no pixels, nothing the engine wouldn't need to adjudicate
// a move. Display attributes (colors, hex/counter geometry) live separately in
// GameDisplayArtifacts so a headless server can drop this file in and ignore that one.
//
// The archetype `label`s here are rules-data (the engine writes them into log messages);
// generated proper names (settlements, species, some biomes) live in GameState.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
const GameArtifacts = (function () {
    const BIOMES = {
        SEA: 0,
        CRAG: 1,
        MEADOW: 2,
        SPORE: 3,
        CRYSTAL: 4,
        ASH: 5,
        WRITHE: 6
    };
    const B = BIOMES;

    // Per-biome rules. `warring` biomes fight the pressure war; sea/crag are neutral
    // firebreaks. `hazard` is damage per turn standing there; `yield` is essence per
    // gather; `nameStyle` picks the phoneme set NameGen uses for this culture.
    const BIOME_RULES = {
        [B.SEA]: { label: 'sea', moveCost: Infinity, hazard: 0, yield: 0, warring: false, nameStyle: null, hazardVerb: null },
        [B.CRAG]: { label: 'crag', moveCost: Infinity, hazard: 0, yield: 0, warring: false, nameStyle: null, hazardVerb: null },
        [B.MEADOW]: { label: 'verdant meadow', moveCost: 1, hazard: 0, yield: 2, warring: true, nameStyle: 'soft', hazardVerb: null },
        [B.SPORE]: { label: 'spore forest', moveCost: 2, hazard: 0, yield: 3, warring: true, nameStyle: 'fungal', hazardVerb: null },
        [B.CRYSTAL]: { label: 'crystal barrens', moveCost: 2, hazard: 1, yield: 4, warring: true, nameStyle: 'crystal', hazardVerb: 'lacerates' },
        [B.ASH]: { label: 'ash waste', moveCost: 2, hazard: 2, yield: 6, warring: true, nameStyle: 'ash', hazardVerb: 'sears' },
        [B.WRITHE]: { label: 'writhe', moveCost: 3, hazard: 3, yield: 9, warring: true, nameStyle: 'eldritch', hazardVerb: 'gnaws at' }
    };

    const SETTLED_BIOMES = [B.MEADOW, B.SPORE, B.CRYSTAL];   // host settlements
    const BLIGHT_BIOMES = [B.ASH, B.WRITHE];                 // host blights
    const WARRING_BIOMES = SETTLED_BIOMES.concat(BLIGHT_BIOMES);

    // Creature archetypes, one per warring biome. `label` is the archetype (species
    // proper names are generated per world); friendly creatures heal an adjacent hero,
    // hostile ones chase him — but never across a biome border.
    const CREATURES = {
        [B.MEADOW]: { label: 'puffgrazer', hp: 4, dmg: 0, speed: 1, aggro: 0, essence: 2, friendly: true, atkVerb: null },
        [B.SPORE]: { label: 'spore drifter', hp: 4, dmg: 0, speed: 1, aggro: 0, essence: 3, friendly: true, atkVerb: null },
        [B.CRYSTAL]: { label: 'shardling', hp: 5, dmg: 2, speed: 1, aggro: 3, essence: 4, friendly: false, atkVerb: 'lacerates' },
        [B.ASH]: { label: 'cinder hound', hp: 8, dmg: 3, speed: 2, aggro: 4, essence: 7, friendly: false, atkVerb: 'savages' },
        [B.WRITHE]: { label: 'null horror', hp: 14, dmg: 5, speed: 1, aggro: 5, essence: 15, friendly: false, atkVerb: 'unmakes a little of' }
    };

    // Talents: one mechanical template — a passive stat bump with repeatable levels.
    // cost to buy the next level = base * (currentLevel + 1). `per` is the effect
    // magnitude per level; the engine's derived-stat getters apply it.
    const TALENTS = [
        { key: 'vigor', name: 'Vigor', desc: '+6 max HP per level', per: 6, base: 20, max: 5 },
        { key: 'strike', name: 'Strike', desc: '+2 attack damage per level', per: 2, base: 20, max: 5 },
        { key: 'fleet', name: 'Fleet', desc: '+1 MP per turn per level', per: 1, base: 30, max: 3 },
        { key: 'harvest', name: 'Harvest', desc: '+1 essence per gather per level', per: 1, base: 15, max: 5 },
        { key: 'warding', name: 'Warding', desc: '-1 biome hazard damage per level', per: 1, base: 25, max: 3 },
        { key: 'carapace', name: 'Carapace', desc: '-1 creature damage taken per level', per: 1, base: 25, max: 3 },
        { key: 'voice', name: 'Voice', desc: '+2 prosperity per feed per level', per: 2, base: 20, max: 3 },
        { key: 'strider', name: 'Strider', desc: 'move costs above 1 reduced by 1', per: 1, base: 60, max: 1 }
    ];

    // Every tuned number in one place. See DYNAMICS.md for why each is what it is.
    const RULES = {
        MAP_COLS: 60,
        MAP_ROWS: 40,

        HERO_HP: 20,
        HERO_MP: 5,
        HERO_ATTACK: 3,
        ATTACK_MP: 2,
        FEED_MP: 1,

        GATHER_MIN_VITALITY: 40,   // land weaker than this has nothing to give
        GATHER_DRAIN: 40,          // vitality a harvest strips from the hex
        VITALITY_REGROW: 4,        // per turn when a hex isn't under pressure
        PRESSURE_DRAIN: 8,         // vitality lost per point of pressure deficit
        FLIP_VITALITY: 30,         // a freshly conquered hex starts this healthy

        FEED_ESSENCE: 10,
        FEED_PROSPERITY: 5,
        SETTLEMENT_HEAL: 5,        // resting (ending the turn) at a settlement
        PROSPERITY_MAX: 100,
        SETTLEMENT_START: 30,
        SETTLEMENT_SELF_CAP: 50,   // settlements plateau here on their own; only feeding
                                   // (or a golden age) pushes them higher — the player is
                                   // the difference between holding and losing the war
        SETTLEMENT_GROWTH_FRACTION: 0.6,  // radius-2 home-biome share needed to grow
        BLIGHT_START: 50,
        BLIGHT_HP: 25,
        BLIGHT_REWARD: 30,         // essence windfall for cleansing one
        BLIGHT_GROWTH: 1,          // prosperity per turn — the doom clock
        BLIGHT_GROWTH_HP: 10,      // per eruption
        BLIGHT_GROWTH_PROSPERITY: 10,
        SIEGE_DRAIN: 3,            // prosperity lost per turn on a foreign biome

        AURA_RADIUS_MAX: 30,       // hard perf ceiling; reach otherwise follows power
        AURA_PROSPERITY_DIV: 20,   // aura power = 1 + prosperity / this
        AURA_FALLOFF: 0.5,         // pressure lost per hex of distance — prosperity buys reach

        CREATURE_CAP: 6,           // per biome
        SPAWN_CHANCE: 0.15,        // per biome per turn while under cap
        SPAWN_MIN_DIST: 3,         // hexes from the hero

        SETTLEMENTS_PER_BIOME: 2,
        ANCHOR_MIN_DIST: 8,
        BIOME_NAME_CHANCE: 0.5,    // chance a warring biome earns a proper name

        GOLDEN_AGE_TURNS: 12,
        ERUPTION_BASE: 2,          // blights per eruption = this + eruptions
        ERUPTION_MIN_DIST: 5,      // from settlements and the hero
        ERUPTION_SPREAD: 6,        // between new blights
        ERUPTION_DISK: 2,          // radius converted around each new blight

        LOG_LIMIT: 40
    };

    return {
        BIOMES,
        BIOME_RULES,
        SETTLED_BIOMES,
        BLIGHT_BIOMES,
        WARRING_BIOMES,
        CREATURES,
        TALENTS,
        RULES
    };
})();
