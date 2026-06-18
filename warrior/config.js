// config.js — Game constants and data definitions
import { Rando } from './rando.js';
// Legacy hand-crafted items retired from play — kept sentimentally in origitems.js.
// import { ORIG_WEAPONS, ORIG_ARMORS, ORIG_ARTIFACTS } from './origitems.js';

export const HEX_SIZE = 24;

export const TERRAIN = {
    WATER: 0,
    PLAINS: 1,
    HILLS: 2,
    MOUNTAIN: 3,
    FOREST: 4,
    GOLD: 5,
    QUARRY: 6,
    SHATTERED_PLAINS: 7,
    SHATTERED_HILLS: 8,
    SHATTERED_FOREST: 9,
    SHATTERED_GOLD: 10,
    SHATTERED_QUARRY: 11,
    DISTRESSED_PLAINS: 12,
    DISTRESSED_HILLS: 13,
    DISTRESSED_FOREST: 14,
    DISTRESSED_GOLD: 15,
    DISTRESSED_QUARRY: 16,
    RUINS: 17,
    BREACH: 18,
    MAW: 19
};

export function isChaosTerrain(t) { return t >= TERRAIN.SHATTERED_PLAINS && t <= TERRAIN.DISTRESSED_QUARRY; }

export const RANGER_TERRAIN = [
    TERRAIN.FOREST, TERRAIN.HILLS, TERRAIN.QUARRY,
    TERRAIN.SHATTERED_FOREST, TERRAIN.DISTRESSED_FOREST,
    TERRAIN.SHATTERED_HILLS, TERRAIN.DISTRESSED_HILLS,
    TERRAIN.SHATTERED_QUARRY, TERRAIN.DISTRESSED_QUARRY,
    TERRAIN.RUINS
];

export const SELL_PRICE_RATIO = 0.4;

export const TERRAIN_NAMES = {
    [TERRAIN.WATER]: 'Water',
    [TERRAIN.PLAINS]: 'Plains',
    [TERRAIN.HILLS]: 'Hills',
    [TERRAIN.MOUNTAIN]: 'Mountain',
    [TERRAIN.FOREST]: 'Forest',
    [TERRAIN.GOLD]: 'Gold Deposit',
    [TERRAIN.QUARRY]: 'Quarry',
    [TERRAIN.SHATTERED_PLAINS]: 'Shattered Plains',
    [TERRAIN.SHATTERED_HILLS]: 'Shattered Hills',
    [TERRAIN.SHATTERED_FOREST]: 'Shattered Forest',
    [TERRAIN.SHATTERED_GOLD]: 'Shattered Gold Deposit',
    [TERRAIN.SHATTERED_QUARRY]: 'Shattered Quarry',
    [TERRAIN.DISTRESSED_PLAINS]: 'Distressed Plains',
    [TERRAIN.DISTRESSED_HILLS]: 'Distressed Hills',
    [TERRAIN.DISTRESSED_FOREST]: 'Distressed Forest',
    [TERRAIN.DISTRESSED_GOLD]: 'Distressed Gold Deposit',
    [TERRAIN.DISTRESSED_QUARRY]: 'Distressed Quarry',
    [TERRAIN.RUINS]: 'Ruins',
    [TERRAIN.BREACH]: 'Breach',
    [TERRAIN.MAW]: 'Maw'
};

export const MOVEMENT_COST = {
    [TERRAIN.WATER]: Infinity,
    [TERRAIN.PLAINS]: 1,
    [TERRAIN.HILLS]: 2,
    [TERRAIN.MOUNTAIN]: Infinity,
    [TERRAIN.FOREST]: 2,
    [TERRAIN.GOLD]: 1,
    [TERRAIN.QUARRY]: 2,
    [TERRAIN.SHATTERED_PLAINS]: 2,
    [TERRAIN.SHATTERED_HILLS]: 3,
    [TERRAIN.SHATTERED_FOREST]: 3,
    [TERRAIN.SHATTERED_GOLD]: 2,
    [TERRAIN.SHATTERED_QUARRY]: 3,
    [TERRAIN.DISTRESSED_PLAINS]: 1,
    [TERRAIN.DISTRESSED_HILLS]: 2,
    [TERRAIN.DISTRESSED_FOREST]: 2,
    [TERRAIN.DISTRESSED_GOLD]: 1,
    [TERRAIN.DISTRESSED_QUARRY]: 2,
    [TERRAIN.RUINS]: 2,
    // Chaos rifts are impassable terrain — the BREACH_GUARDIAN spawns onto one
    // as the "door," but once any unit (guardian included) steps off it can
    // never path back. Sealed via Restore, they revert to HILLS.
    [TERRAIN.BREACH]: Infinity,
    [TERRAIN.MAW]: Infinity
};

// Shattered <-> normal terrain lookups
export const SHATTERED_VERSION = {
    [TERRAIN.PLAINS]: TERRAIN.SHATTERED_PLAINS,
    [TERRAIN.HILLS]: TERRAIN.SHATTERED_HILLS,
    [TERRAIN.FOREST]: TERRAIN.SHATTERED_FOREST,
    [TERRAIN.GOLD]: TERRAIN.SHATTERED_GOLD,
    [TERRAIN.QUARRY]: TERRAIN.SHATTERED_QUARRY
};

export const UNSHATTERED_VERSION = {
    [TERRAIN.SHATTERED_PLAINS]: TERRAIN.PLAINS,
    [TERRAIN.SHATTERED_HILLS]: TERRAIN.HILLS,
    [TERRAIN.SHATTERED_FOREST]: TERRAIN.FOREST,
    [TERRAIN.SHATTERED_GOLD]: TERRAIN.GOLD,
    [TERRAIN.SHATTERED_QUARRY]: TERRAIN.QUARRY
};

export const DISTRESSED_VERSION = {
    [TERRAIN.PLAINS]: TERRAIN.DISTRESSED_PLAINS,
    [TERRAIN.HILLS]: TERRAIN.DISTRESSED_HILLS,
    [TERRAIN.FOREST]: TERRAIN.DISTRESSED_FOREST,
    [TERRAIN.GOLD]: TERRAIN.DISTRESSED_GOLD,
    [TERRAIN.QUARRY]: TERRAIN.DISTRESSED_QUARRY
};

export const UNDISTRESSED_VERSION = {
    [TERRAIN.DISTRESSED_PLAINS]: TERRAIN.PLAINS,
    [TERRAIN.DISTRESSED_HILLS]: TERRAIN.HILLS,
    [TERRAIN.DISTRESSED_FOREST]: TERRAIN.FOREST,
    [TERRAIN.DISTRESSED_GOLD]: TERRAIN.GOLD,
    [TERRAIN.DISTRESSED_QUARRY]: TERRAIN.QUARRY
};

// +1 defense in forest (including shattered and distressed)
export const TERRAIN_DEFENSE_BONUS = {
    [TERRAIN.FOREST]: 1,
    [TERRAIN.SHATTERED_FOREST]: 1,
    [TERRAIN.DISTRESSED_FOREST]: 1
};

// +1 ranged range on hills (including shattered and distressed)
export const TERRAIN_RANGE_BONUS = {
    [TERRAIN.HILLS]: 1,
    [TERRAIN.SHATTERED_HILLS]: 1,
    [TERRAIN.DISTRESSED_HILLS]: 1,
    [TERRAIN.RUINS]: 1
};

export const CROP_ICONS = ['\u{1F33D}', '\u{1F345}', '\u{1F346}', '\u{1F955}', '\u{1F952}', '\u{1F33F}', '\u{1FAD1}', '\u{1F33E}'];

export const PLAYER_MP = 4;
export const MAP_COLS = 100;
export const MAP_ROWS = 100;
export const BASE_VISION = 6;


// ---- Player defaults ----
export const STARTING_STATS = { might: 3, reflex: 3, warding: 2, vigor: 3 };
export const STAT_POINTS_PER_LEVEL = 3;
export const MAX_DODGE = 90;
export const MAX_STUN_CHANCE = 90;
export const STUN_DIVISOR_PRIMARY = 40;
export const STUN_DIVISOR_OTHER = 60;

// HP = 50 + vigor * 10
export function maxHP(vigor) { return 50 + vigor * 10; }
// Aether = 5 + warding * 2
export function maxAether(warding) { return 5 + warding * 2; }

// ---- XP curve: 50 * level^1.8 rounded to nearest 10 ----
export function xpForLevel(level) {
    return Math.round(50 * Math.pow(level, 1.8) / 10) * 10;
}

// ---- POI types ----
export const POI = {
    HAVEN: 'haven',
    VILLAGE: 'village',
    RUIN: 'ruin',
    BREACH: 'breach',
    MAW: 'maw',
    HUT: 'hut',
    SCROLL: 'scroll',
    GARRISON_BUILD: 'garrison_build',
    GARRISON: 'garrison'
};

export const POI_DEFENSE_BONUS = {
    [POI.HAVEN]: 3,
    [POI.VILLAGE]: 2,
    [POI.GARRISON]: 3
};

export const POI_RANGE_BONUS = {
    [POI.GARRISON]: 2
};

export const POI_SYMBOLS = {
    [POI.HAVEN]: '\u{1F3F0}', // 🏰 castle
    [POI.VILLAGE]: '\u{1F3E1}', // 🏡 house with garden
    [POI.RUIN]: '\u26EB',    // ⛫ castle ruins
    [POI.BREACH]: '\u058D',  // ֍ swirl
    [POI.MAW]: '\u2738',     // ✸ pulsing star
    [POI.HUT]: '\u2302',     // ⌂ house
    [POI.SCROLL]: '\u{1F4DC}', // 📜 scroll
    [POI.GARRISON_BUILD]: '\u{1F6A7}', // 🚧 construction sign
    [POI.GARRISON]: '\u265C'  // ♜ black rook
};

export const POI_COLORS = {
    [POI.HAVEN]: '#4fc3f7',
    [POI.VILLAGE]: '#ffb74d',
    [POI.RUIN]: '#b0bec5',
    [POI.BREACH]: '#e040fb',
    [POI.MAW]: '#ff1744',
    [POI.HUT]: '#b0bec5',
    [POI.SCROLL]: '#d8c690',
    [POI.GARRISON_BUILD]: '#ffb74d',
    [POI.GARRISON]: '#fff'
};

// ---- Enemy types ----
export const ENEMY_TYPE = {
    VOID_STALKER: 'void_stalker',
    BREACH_CRAWLER: 'breach_crawler',
    FLUX_ARCHER: 'flux_archer',
    PHASE_WRAITH: 'phase_wraith',
    BREACH_GUARDIAN: 'breach_guardian',
    UNRAVELER: 'unraveler'
};

export const ENEMY_DEFS = {
    [ENEMY_TYPE.VOID_STALKER]: {
        name: 'Void Stalker', label: 'V', hp: 15, attack: 5, rangedAttack: 3, defense: 1,
        speed: 2, detectRange: 5, xp: 15, gold: 2, behavior: 'chase',
        range: 2, chaosSpawned: true
    },
    [ENEMY_TYPE.BREACH_CRAWLER]: {
        name: 'Breach Crawler', label: 'C', hp: 30, attack: 8, defense: 4,
        speed: 1, detectRange: 3, xp: 30, gold: 4, behavior: 'chase',
        chaosSpawned: true
    },
    [ENEMY_TYPE.FLUX_ARCHER]: {
        name: 'Flux Archer', label: 'A', hp: 12, attack: 6, defense: 1,
        speed: 1, detectRange: 5, xp: 20, gold: 3, behavior: 'kite',
        range: 4, chaosSpawned: true
    },
    [ENEMY_TYPE.PHASE_WRAITH]: {
        name: 'Phase Wraith', label: 'W', hp: 10, attack: 5, defense: 1,
        speed: 2, detectRange: 4, aggroRange: 30, xp: 25, gold: 3, behavior: 'teleport',
        teleportRange: 3, teleportChance: 0.3, chaosSpawned: true
    },
    [ENEMY_TYPE.BREACH_GUARDIAN]: {
        name: 'Breach Guardian', label: 'G', hp: 50, attack: 10, rangedAttack: 8, defense: 5,
        speed: 1, detectRange: 6, xp: 80, gold: 10, behavior: 'guard',
        range: 5, guardRadius: 2, chaosSpawned: true
    },
    [ENEMY_TYPE.UNRAVELER]: {
        name: 'The Unraveler', label: '\u{1F480}', hp: 100, attack: 12, rangedAttack: 6, defense: 6,
        speed: 1, detectRange: 6, xp: 200, gold: 0, behavior: 'boss',
        range: 6, spawnChance: 0.16, chaosSpawned: true
    }
};

// ---- Equipment ----
export const EQUIP_SLOT = { WEAPON: 'weapon', ARMOR: 'armor', ARTIFACT: 'artifact' };

// Non-magical weapons
export const WEAPONS = [
    { id: 'rusty_blade', name: 'Rusty Blade', type: 'melee', damage: 1, range: 0, special: null, price: 0, tier: 0, magical: false },
    { id: 'iron_sword', name: 'Iron Sword', type: 'melee', damage: 2, range: 0, special: null, price: 12, tier: 1, magical: false },
    { id: 'spear', name: 'Spear', type: 'melee', damage: 2, range: 0, special: null, price: 12, tier: 1, magical: false },
    { id: 'battle_axe', name: 'Battle Axe', type: 'melee', damage: 3, range: 0, special: null, price: 25, tier: 2, magical: false },
    { id: 'warhammer', name: 'Warhammer', type: 'melee', damage: 4, range: 0, special: null, price: 45, tier: 3, magical: false },
    { id: 'blade_spear', name: 'Blade Spear', type: 'melee', damage: 4, range: 0, special: null, price: 45, tier: 3, magical: false },
    { id: 'greatsword', name: 'Greatsword', type: 'melee', damage: 5, range: 0, special: null, price: 70, tier: 4, magical: false },
    { id: 'stick_bow', name: 'Stick Bow', type: 'ranged', damage: 1, range: 2, special: null, price: 0, tier: 0, magical: false },
    { id: 'short_bow', name: 'Short Bow', type: 'ranged', damage: 1, range: 2, special: null, price: 5, tier: 1, magical: false },
    { id: 'hunting_bow', name: 'Hunting Bow', type: 'ranged', damage: 2, range: 2, special: null, price: 12, tier: 1, magical: false },
    { id: 'crossbow', name: 'Crossbow', type: 'ranged', damage: 3, range: 3, special: null, price: 25, tier: 2, magical: false },
    { id: 'war_bow', name: 'War Bow', type: 'ranged', damage: 4, range: 3, special: null, price: 45, tier: 3, magical: false },
    { id: 'great_bow', name: 'Great Bow', type: 'ranged', damage: 5, range: 4, special: null, price: 70, tier: 4, magical: false }
];

// A weapon counts as ranged iff it has reach — range > 0. This (not the `type`
// field) is the single source of truth for melee-vs-ranged behavior, so any
// weapon granted range, magical or otherwise, fires and flows as a bow.
export function weaponIsRanged(wep) {
    return !!(wep && wep.range > 0);
}

// Non-magical armor
export const ARMORS = [
    { id: 'worn_leather', name: 'Worn Leather', defense: 1, special: null, price: 0, tier: 0, magical: false },
    { id: 'leather_armor', name: 'Leather Armor', defense: 2, special: null, price: 15, tier: 1, magical: false },
    { id: 'chain_mail', name: 'Chain Mail', defense: 3, special: null, price: 30, tier: 2, magical: false },
    { id: 'scale_armor', name: 'Scale Armor', defense: 4, special: null, price: 50, tier: 3, magical: false },
    { id: 'plate_armor', name: 'Plate Armor', defense: 5, special: null, price: 75, tier: 4, magical: false }
];

// No static artifacts — all artifacts are magical and randomly generated
export const ARTIFACTS = [];

// All equipment in one lookup (generated items get registered here too)
export const ALL_EQUIPMENT = {};

export function resetEquipment() {
    for (const key of Object.keys(ALL_EQUIPMENT)) delete ALL_EQUIPMENT[key];
    for (const w of WEAPONS) ALL_EQUIPMENT[w.id] = { ...w, slot: EQUIP_SLOT.WEAPON };
    for (const a of ARMORS) ALL_EQUIPMENT[a.id] = { ...a, slot: EQUIP_SLOT.ARMOR };
    // Legacy hand-crafted items — retired from play, kept sentimentally in origitems.js.
    // for (const w of ORIG_WEAPONS) if (w.magical) ALL_EQUIPMENT[w.id] = { ...w, slot: EQUIP_SLOT.WEAPON };
    // for (const a of ORIG_ARMORS) if (a.magical) ALL_EQUIPMENT[a.id] = { ...a, slot: EQUIP_SLOT.ARMOR };
    // for (const a of ORIG_ARTIFACTS) ALL_EQUIPMENT[a.id] = { ...a, slot: EQUIP_SLOT.ARTIFACT };
}
resetEquipment();

export const NON_MAGICAL_ITEMS = [...WEAPONS, ...ARMORS];

// ---- Random Magical Item Generation ----

const MODES = [
    'Aether', 'Arc', 'Astral', 'Blast', 'Blink', 'Blood', 'Chaos', 'Dusk',
    'Ember', 'Flux', 'Gale', 'Hawk', 'Ley', 'Nova', 'Null', 'Phase', 'Pulse',
    'Rift', 'Rune', 'Smoke', 'Soul', 'Star', 'Stasis', 'Storm', 'Thorn',
    'Umbra', 'Void', 'Wrath', 'Wyrm'
];
const VERBING_GENERAL = [
    'Blazing', 'Burning', 'Flickering', 'Searing', 'Shrieking', 'Withering'
];
const VERBERS = [
    'breaker', 'caster', 'fang', 'piercer', 'reaver', 'runner', 'seeker',
    'splitter', 'strike', 'render', 'singer', 'ward', 'weave', 'wrath', 'bane'
];
const VERBS = [
    'blessed', 'bound', 'forged', 'kissed', 'sworn', 'tempered',
    'touched', 'ward', 'wrought', 'woven', 'scarred', 'claimed'
];
const ARCHETYPES_GENERAL = [
    'Navigator', 'Operator', 'Pilot', 'Replicant', 'Starpilot',
    'Technomancer', 'Wanderer', 'Witch', 'Wraith', 'Xenarch'
];
// Common nouns are listed three times so they roll roughly three times as often as the rest.
const COMMON_MELEE = [
    'Axe', 'Blade', 'Edge', 'Mace', 'Spear', 'Sword', 'Glaive', 'Slipblade', 'Ripper'
];
const OTHER_MELEE = [
    'Cleaver', 'Pick', 'Spike', 'Thorn', 'Flail', 'Scythe', 'Fist', 'Shard', 'Vane'
];
const MELEE_ITEMS = [...COMMON_MELEE, ...COMMON_MELEE, ...COMMON_MELEE, ...OTHER_MELEE];

const COMMON_RANGED = [
    'Bolt', 'Bow', 'Cannon', 'Launcher', 'Longbow', 'Rifle', 'Crossbow', 'Handcannon', 'Wand', 'Coilgun'
];
const OTHER_RANGED = [
    'Caster', 'Lance', 'Repeater', 'Rod', 'Sling', 'Arbalest', 'Javelin', 'Accelerator', 'Emitter'
];
const RANGED_ITEMS = [...COMMON_RANGED, ...COMMON_RANGED, ...COMMON_RANGED, ...OTHER_RANGED];
const ARMOR_ITEMS = [
    'Aegis', 'Cloak', 'Cuirass', 'Hide', 'Mail', 'Plate', 'Robe', 'Shield',
    'Tunic', 'Vest', 'Weave', 'Mantle', 'Carapace', 'Hauberk', 'Wrap', 'Cowl', 'Baldric'
];
const ARTIFACT_ITEMS = [
    'Amulet', 'Anchor', 'Boots', 'Bracers', 'Circlet', 'Compass', 'Crown',
    'Crystal', 'Gloves', 'Hood', 'Jewel', 'Lens', 'Ring', 'Shroud', 'Sigil',
    'Signet', 'Stone', 'Talisman', 'Torc', 'Veil', 'Ward', 'Wraps', 'Lantern',
    'Transponder', 'Injector', 'Capacitor'
];

// Effect-specific naming: first verb is unique to each effect (a thematic signature),
// remaining two are drawn from the shared pool. Vivid adjectives and -ing forms both fine.
const EFFECT_NAMING = {
    armor_pierce:      { v: ['Cleaving', 'Rending', 'Piercing'],     a: ['Slayer', 'Warden', 'Operator'] },
    aether_siphon:     { v: ['Draining', 'Weeping', 'Withering'],    a: ['Witch', 'Technomancer', 'Seer'] },
    burn:              { v: ['Igniting', 'Searing', 'Burning'],      a: ['Zealot', 'Witch', 'Xenarch'] },
    chain:             { v: ['Arcing', 'Shrieking', 'Flickering'],   a: ['Technomancer', 'Operator', 'Starpilot'] },
    chaos_bonus:       { v: ['Maddening', 'Warding', 'Sundering'],   a: ['Sentinel', 'Warden', 'Zealot'] },
    counter_mastery:   { v: ['Vigilant', 'Warding', 'Piercing'],     a: ['Warden', 'Sentinel', 'Slayer'] },
    counter_deflect:   { v: ['Parrying', 'Deflecting', 'Warding'],   a: ['Sentinel', 'Warden', 'Slayer'] },
    defense_shred:     { v: ['Shredding', 'Sundering', 'Rending'],   a: ['Surgeon', 'Operator', 'Slayer'] },
    double_strike:     { v: ['Twinning', 'Flickering', 'Blazing'],   a: ['Replicant', 'Slayer', 'Pilot'] },
    triple_strike:     { v: ['Trebling', 'Flickering', 'Shrieking'], a: ['Replicant', 'Slayer', 'Zealot'] },
    ignore_defense:    { v: ['Phasing', 'Piercing', 'Sundering'],    a: ['Xenarch', 'Surgeon', 'Technomancer'] },
    knockback:         { v: ['Hurling', 'Sundering', 'Shrieking'],   a: ['Warden', 'Sentinel', 'Slayer'] },
    lifesteal:         { v: ['Transfusioning', 'Thirsting', 'Weeping'], a: ['Wraith', 'Witch', 'Surgeon'] },
    charge:            { v: ['Slashing', 'Sundering', 'Shrieking'],  a: ['Slayer', 'Pilot', 'Wayfarer'] },
    channel:           { v: ['Kicking', 'Shrieking', 'Searing'],     a: ['Zealot', 'Slayer', 'Xenarch'] },
    reverberate:       { v: ['Echoing', 'Shrieking', 'Sundering'],   a: ['Technomancer', 'Xenarch', 'Operator'] },
    riposte:           { v: ['Riposting', 'Warding', 'Piercing'],    a: ['Warden', 'Sentinel', 'Slayer'] },
    double_shot:       { v: ['Volleying', 'Flickering', 'Blazing'],  a: ['Replicant', 'Ranger', 'Starpilot'] },
    triple_shot:       { v: ['Storming', 'Shrieking', 'Blazing'],    a: ['Replicant', 'Starpilot', 'Zealot'] },
    free_ranged:       { v: ['Loosing', 'Flickering', 'Warding'],    a: ['Navigator', 'Seer', 'Wanderer'] },
    free_action:       { v: ['Quickening', 'Flickering', 'Soaring'], a: ['Wanderer', 'Wayfarer', 'Pilot'] },
    piercing:          { v: ['Piercing', 'Rending', 'Sundering'],    a: ['Ranger', 'Scout', 'Slayer'] },
    sniper:            { v: ['Sniping', 'Warding', 'Searing'],       a: ['Ranger', 'Scout', 'Starpilot'] },
    splash:            { v: ['Bursting', 'Blazing', 'Shrieking'],    a: ['Operator', 'Technomancer', 'Xenarch'] },
    stun:              { v: ['Concussing', 'Stunning', 'Crushing'],  a: ['Sentinel', 'Slayer', 'Warden'] },
    sweep:             { v: ['Sweeping', 'Crashing', 'Reaping'],     a: ['Slayer', 'Warden', 'Sentinel'] },
    burning_aura:      { v: ['Smouldering', 'Blazing', 'Burning'],   a: ['Zealot', 'Witch', 'Xenarch'] },
    dodge_bonus:       { v: ['Slipping', 'Flickering', 'Vanishing'], a: ['Scout', 'Wanderer', 'Wraith'] },
    heal_on_kill:      { v: ['Devouring', 'Thirsting', 'Rending'],   a: ['Slayer', 'Wraith', 'Surgeon'] },
    high_def_mp_penalty: { v: ['Lumbering', 'Warding', 'Sundering'], a: ['Sentinel', 'Warden', 'Xenarch'] },
    last_stand:        { v: ['Defiant', 'Warding', 'Shrieking'],     a: ['Sentinel', 'Zealot', 'Warden'] },
    momentum:          { v: ['Crushing', 'Streaming', 'Overbearing'], a: ['Wraith', 'Navigator', 'Wayfarer'] },
    ranged_defense:    { v: ['Deflecting', 'Warding', 'Flickering'], a: ['Sentinel', 'Warden', 'Technomancer'] },
    ranged_immune:     { v: ['Mirrored', 'Warding', 'Flickering'],   a: ['Sentinel', 'Warden', 'Technomancer'] },
    thorns:            { v: ['Bristling', 'Piercing', 'Rending'],    a: ['Sentinel', 'Warden', 'Xenarch'] },
    wall_of_steel:     { v: ['Stalwart', 'Warding', 'Sundering'],    a: ['Sentinel', 'Warden', 'Slayer'] },
    aether_bonus:      { v: ['Brimming', 'Flickering', 'Glowing'],   a: ['Seer', 'Technomancer', 'Witch'] },
    aether_discount:   { v: ['Sparing', 'Whispering', 'Flickering'], a: ['Seer', 'Witch', 'Navigator'] },
    aether_regen:      { v: ['Welling', 'Whispering', 'Flickering'], a: ['Seer', 'Witch', 'Navigator'] },
    aether_signet:     { v: ['Anointing', 'Blazing', 'Searing'],     a: ['Technomancer', 'Xenarch', 'Zealot'] },
    blink_ring:        { v: ['Blinking', 'Flickering', 'Shifting'],  a: ['Navigator', 'Pilot', 'Wraith'] },
    breach_jewel:      { v: ['Sealing', 'Blazing', 'Warding'],       a: ['Sentinel', 'Warden', 'Zealot'] },
    chaos_attune:      { v: ['Resonant', 'Withering', 'Warping'],    a: ['Witch', 'Xenarch', 'Wanderer'] },
    chaos_circlet:     { v: ['Twisting', 'Withering', 'Flickering'], a: ['Witch', 'Xenarch', 'Wanderer'] },
    chaos_defense:     { v: ['Sheltering', 'Warding', 'Withering'],  a: ['Sentinel', 'Warden', 'Zealot'] },
    disengage:         { v: ['Stepping', 'Flickering', 'Drifting'],  a: ['Scout', 'Wanderer', 'Ranger'] },
    displacement_immune: { v: ['Anchored', 'Warding', 'Sundering'],  a: ['Sentinel', 'Warden', 'Navigator'] },
    heal:              { v: ['Mending', 'Soothing', 'Warding'],      a: ['Surgeon', 'Seer', 'Wanderer'] },
    hp_bonus:          { v: ['Hardy', 'Warding', 'Blazing'],         a: ['Warden', 'Sentinel', 'Zealot'] },
    mp_bonus:          { v: ['Striding', 'Flickering', 'Blazing'],   a: ['Wanderer', 'Wayfarer', 'Scout'] },
    opportunist:       { v: ['Stalking', 'Flickering', 'Thirsting'], a: ['Scout', 'Ranger', 'Operator'] },
    ranger_defense:    { v: ['Camouflaged', 'Warding', 'Flickering'], a: ['Ranger', 'Scout', 'Wanderer'] },
    reveal_maw:        { v: ['Scrying', 'Piercing', 'Flickering'],   a: ['Seer', 'Navigator', 'Scout'] },
    revive:            { v: ['Resurrecting', 'Renewing', 'Warding'], a: ['Surgeon', 'Seer', 'Wanderer'] },
    soul_harvest:      { v: ['Reaping', 'Thirsting', 'Withering'],   a: ['Wraith', 'Witch', 'Slayer'] },
    strider:           { v: ['Coursing', 'Flickering', 'Blazing'],   a: ['Wanderer', 'Wayfarer', 'Ranger'] },
    threat_shroud:     { v: ['Cloaking', 'Veiling', 'Flickering'],   a: ['Scout', 'Wraith', 'Wanderer'] },
    vigor_bonus:       { v: ['Thriving', 'Hardy', 'Warding'],        a: ['Warden', 'Sentinel', 'Surgeon'] },
    vision_bonus:      { v: ['Watching', 'Piercing', 'Flickering'],  a: ['Seer', 'Scout', 'Navigator'] },
    wraith_immune:     { v: ['Hallowed', 'Warding', 'Blazing'],      a: ['Sentinel', 'Warden', 'Technomancer'] },
};

// Effect pools — pure stat data, naming handled by EFFECT_NAMING
const MELEE_EFFECTS = [
    { special: 'armor_pierce', pierceAmount: 2, value: 2 },
    { special: 'armor_pierce', pierceAmount: 4, value: 3 },
    { special: 'aether_siphon', siphonAmount: 1, value: 2 },
    { special: 'aether_siphon', siphonAmount: 2, value: 3 },
    { special: 'burn', burnDamage: 2, value: 2 },
    { special: 'burn', burnDamage: 3, value: 3 },
    { special: 'burn', burnDamage: 5, value: 4 },
    { special: 'chain', chainCount: 2, value: 3 },
    { special: 'chain', chainCount: 3, value: 4 },
    { special: 'chain', chainCount: 5, value: 5 },
    { special: 'chaos_bonus', chaosBonus: 2, value: 1 },
    { special: 'chaos_bonus', chaosBonus: 4, value: 2 },
    { special: 'chaos_bonus', chaosBonus: 6, value: 3 },
    { special: 'counter_mastery', value: 3 },
    { special: 'defense_shred', shredAmount: 1, value: 2 },
    { special: 'defense_shred', shredAmount: 2, value: 3 },
    { special: 'double_strike', value: 4 },
    { special: 'triple_strike', value: 5 },
    { special: 'ignore_defense', value: 5 },
    { special: 'knockback', value: 2 },
    { special: 'lifesteal', lifestealAmount: 1, value: 2 },
    { special: 'lifesteal', lifestealAmount: 2, value: 3 },
    { special: 'lifesteal', lifestealAmount: 3, value: 4 },
    { special: 'charge', chargeBonus: 4, value: 2 },
    { special: 'charge', chargeBonus: 6, value: 3 },
    { special: 'charge', chargeBonus: 8, value: 4 },
    { special: 'charge', chargeMultiplier: 2, value: 5 },
    { special: 'channel', channelBonus: 3, channelDamage: 1, value: 1 },
    { special: 'channel', channelBonus: 5, channelDamage: 3, value: 2 },
    { special: 'channel', channelBonus: 8, channelDamage: 5, value: 3 },
    { special: 'reverberate', chainCount: 3, chainBonus: 2, value: 4 },
    { special: 'riposte', riposteDamage: 1, value: 2 },
    { special: 'riposte', riposteDamage: 2, value: 3 },
    { special: 'riposte', riposteDamage: 3, value: 4 },
    { special: 'sweep', sweepCount: 2, value: 2 },
    { special: 'sweep', sweepCount: 3, value: 3 },
    { special: 'sweep', sweepCount: 5, value: 4 },
    { special: 'stun', stunBonus: 20, value: 2 },
    { special: 'stun', stunBonus: 30, value: 3 },
    { special: 'stun', stunBonus: 40, value: 4 },
    { special: 'free_action', value: 4 },
];

const RANGED_EFFECTS = [
    { special: 'armor_pierce', pierceAmount: 2, value: 2 },
    { special: 'armor_pierce', pierceAmount: 4, value: 3 },
    { special: 'aether_siphon', siphonAmount: 1, value: 2 },
    { special: 'aether_siphon', siphonAmount: 2, value: 3 },
    { special: 'burn', burnDamage: 2, value: 2 },
    { special: 'burn', burnDamage: 3, value: 3 },
    { special: 'burn', burnDamage: 5, value: 4 },
    { special: 'chain', chainCount: 2, value: 3 },
    { special: 'chain', chainCount: 3, value: 4 },
    { special: 'chain', chainCount: 5, value: 5 },
    { special: 'chaos_bonus', chaosBonus: 2, value: 1 },
    { special: 'chaos_bonus', chaosBonus: 4, value: 2 },
    { special: 'chaos_bonus', chaosBonus: 6, value: 3 },
    { special: 'defense_shred', shredAmount: 1, value: 2 },
    { special: 'defense_shred', shredAmount: 2, value: 3 },
    { special: 'double_shot', value: 4 },
    { special: 'triple_shot', value: 5 },
    { special: 'free_ranged', value: 5 },
    { special: 'ignore_defense', value: 5 },
    { special: 'knockback', value: 2 },
    { special: 'lifesteal', lifestealAmount: 1, value: 2 },
    { special: 'lifesteal', lifestealAmount: 2, value: 3 },
    { special: 'lifesteal', lifestealAmount: 3, value: 4 },
    { special: 'piercing', value: 4 },
    { special: 'channel', channelBonus: 5, channelDamage: 1, value: 1 },
    { special: 'channel', channelBonus: 8, channelDamage: 3, value: 2 },
    { special: 'channel', channelBonus: 13, channelDamage: 5, value: 3 },
    { special: 'sniper', sniperBonus: 2, value: 2 },
    { special: 'sniper', sniperBonus: 4, value: 3 },
    { special: 'sniper', sniperBonus: 8, value: 4 },
    { special: 'splash', splashDamage: 2, value: 4 },
    { special: 'free_action', value: 5 },
];

const ARMOR_EFFECTS = [
    { special: 'burning_aura', burnAuraDamage: 2, value: 2 },
    { special: 'burning_aura', burnAuraDamage: 5, value: 4 },
    { special: 'counter_deflect', counterDeflect: 50, value: 2 },
    { special: 'counter_deflect', counterDeflect: 70, value: 3 },
    { special: 'counter_deflect', counterDeflect: 90, value: 4 },
    { special: 'dodge_bonus', dodgeBonus: 10, value: 2 },
    { special: 'dodge_bonus', dodgeBonus: 20, value: 3 },
    { special: 'dodge_bonus', dodgeBonus: 30, value: 4 },
    { special: 'heal_on_kill', healOnKill: 5, value: 3 },
    { special: 'heal_on_kill', healOnKill: 8, value: 4 },
    { special: 'high_def_mp_penalty', defBonus: 5, mpPenalty: 1, value: 3 },
    { special: 'last_stand', lastStandBonus: 4, value: 3 },
    { special: 'last_stand', lastStandBonus: 6, value: 4 },
    { special: 'momentum', momentumBonus: 1, value: 2 },
    { special: 'momentum', momentumBonus: 2, value: 3 },
    { special: 'momentum', momentumBonus: 3, value: 4 },
    { special: 'ranged_defense', rangedDefenseBonus: 2, value: 2 },
    { special: 'ranged_defense', rangedDefenseBonus: 4, value: 3 },
    { special: 'ranged_immune', value: 5 },
    { special: 'thorns', thornsPercent: 50, value: 3 },
    { special: 'thorns', thornsPercent: 100, value: 4 },
    { special: 'wall_of_steel', wallBonus: 2, value: 2 },
    { special: 'wall_of_steel', wallBonus: 4, value: 3 },
    { special: 'wall_of_steel', wallBonus: 6, value: 4 },
];

const PASSIVE_EFFECTS = [
    { special: 'aether_bonus', aetherBonus: 10, value: 2 },
    { special: 'aether_bonus', aetherBonus: 20, value: 3 },
    { special: 'aether_regen', aetherRegen: 1, value: 2 },
    { special: 'aether_regen', aetherRegen: 2, value: 3 },
    { special: 'aether_regen', aetherRegen: 3, value: 4 },
    { special: 'aether_discount', aetherDiscount: 1, value: 2 },
    { special: 'aether_discount', aetherDiscount: 2, value: 3 },
    { special: 'aether_discount', aetherDiscount: 3, value: 4 },
    { special: 'aether_signet', aetherSignetDamage: 3, aetherSignetCost: 3, value: 2 },
    { special: 'aether_signet', aetherSignetDamage: 5, aetherSignetCost: 5, value: 3 },
    { special: 'blink_ring', blinkRange: 4, blinkBonus: 2, value: 4 },
    { special: 'breach_jewel', breachBonus: 4, value: 2 },
    { special: 'breach_jewel', breachBonus: 6, value: 3 },
    { special: 'chaos_attune', chaosAttuneMight: 2, chaosAttuneDef: 2, value: 2 },
    { special: 'chaos_attune', chaosAttuneMight: 4, chaosAttuneDef: 3, value: 3 },
    { special: 'chaos_circlet', value: 3 },
    { special: 'chaos_defense', chaosDefenseBonus: 2, value: 1 },
    { special: 'chaos_defense', chaosDefenseBonus: 4, value: 2 },
    { special: 'disengage', value: 3 },
    { special: 'displacement_immune', value: 2 },
    { special: 'heal', healPerTurn: 1, value: 2 },
    { special: 'heal', healPerTurn: 2, value: 3 },
    { special: 'heal', healPerTurn: 3, value: 4 },
    { special: 'hp_bonus', hpBonus: 10, value: 2 },
    { special: 'hp_bonus', hpBonus: 20, value: 3 },
    { special: 'mp_bonus', mpBonus: 2, value: 3 },
    { special: 'mp_bonus', mpBonus: 4, value: 4 },
    { special: 'opportunist', value: 3 },
    { special: 'ranger_defense', rangerBonus: 1, value: 2 },
    { special: 'ranger_defense', rangerBonus: 2, value: 3 },
    { special: 'ranger_defense', rangerBonus: 4, value: 4 },
    { special: 'reveal_maw', value: 2 },
    { special: 'revive', reviveHp: 1, reviveAether: 1, value: 4 },
    { special: 'revive', reviveHp: 2, reviveAether: 2, value: 5 },
    { special: 'soul_harvest', soulHarvestXP: 2, value: 2 },
    { special: 'soul_harvest', soulHarvestXP: 4, value: 3 },
    { special: 'strider', value: 3 },
    { special: 'threat_shroud', value: 3 },
    { special: 'vigor_bonus', vigorBonus: 3, value: 2 },
    { special: 'vigor_bonus', vigorBonus: 6, value: 3 },
    { special: 'vigor_bonus', vigorBonus: 12, value: 4 },
    { special: 'vision_bonus', visionBonus: 2, value: 2 },
    { special: 'vision_bonus', visionBonus: 4, value: 3 },
    { special: 'wraith_immune', value: 3 },
];

const ARMOR_OR_PASSIVE = [...ARMOR_EFFECTS, ...PASSIVE_EFFECTS];

function _pickVerbing(naming) {
    return Rando.bool(0.5) ? Rando.choice(VERBING_GENERAL) : Rando.choice(naming.v);
}

function _pickArchetype(naming) {
    return Rando.bool(0.5) ? Rando.choice(ARCHETYPES_GENERAL) : Rando.choice(naming.a);
}

function _rollName(itemWords, naming) {
    const pattern = Rando.int(0, 5);
    const mode = Rando.choice(MODES);
    const item = Rando.choice(itemWords);
    switch (pattern) {
        case 0: return `${mode} ${item}`;
        case 1: return `${_pickVerbing(naming)} ${item}`;
        case 2: return `${_pickArchetype(naming)}'s ${item}`;
        case 3: return `${mode}${Rando.choice(VERBERS)}`;
        case 4: return `${mode}${Rando.choice(VERBS)} ${item}`;
        case 5: return Rando.bool(0.5)
            ? `${item} of the ${mode}`
            : `${item} of the ${_pickArchetype(naming)}`;
    }
}

export function rollMagicItem(category) {
    if (!category) category = Rando.choice(['melee', 'ranged', 'armor', 'artifact']);

    const id = `magic_${Object.keys(ALL_EQUIPMENT).length}`;
    let item;

    switch (category) {
        case 'melee': {
            const { value, ...effect } = Rando.choice(MELEE_EFFECTS);
            const name = _rollName(MELEE_ITEMS, EFFECT_NAMING[effect.special]);
            let damage = Rando.int(2, 6);
            // d6: 1-3 normal, 4-5 fast (0 MP), 6 heavy (all MP, 2x dmg)
            const variant = Rando.int(1, 6);
            const heavy = variant === 6;
            const fast = variant === 4 || variant === 5;
            if (heavy) damage *= 2;
            const price = (damage + 1) * 60 * value;
            item = { id, name, type: 'melee', slot: EQUIP_SLOT.WEAPON, damage, range: 0, price, magical: true, ...effect };
            if (heavy) item.mpCost = 'all';
            else if (fast) item.mpCost = 0;
            break;
        }
        case 'ranged': {
            const { value, ...effect } = Rando.choice(RANGED_EFFECTS);
            const name = _rollName(RANGED_ITEMS, EFFECT_NAMING[effect.special]);
            let damage = Rando.int(2, 6);
            const range = Rando.int(3, 5);
            // d6: 1-4 normal (2 MP), 5 fast (1 MP), 6 heavy (all MP, 2x dmg, 2x AE)
            const variant = Rando.int(1, 6);
            const heavy = variant === 6;
            const fast = variant === 5;
            if (heavy) damage *= 2;
            const price = (damage + range + 1) * 30 * value;
            item = { id, name, type: 'ranged', slot: EQUIP_SLOT.WEAPON, damage, range, price, magical: true, ...effect };
            if (heavy) { item.mpCost = 'all'; item.aetherCost = 2; }
            else if (fast) item.mpCost = 1;
            else item.mpCost = 2;
            break;
        }
        case 'armor': {
            const { value, ...effect } = Rando.choice(ARMOR_OR_PASSIVE);
            const name = _rollName(ARMOR_ITEMS, EFFECT_NAMING[effect.special]);
            const defense = Rando.int(2, 6);
            const price = (defense + 1) * 60 * value;
            item = { id, name, slot: EQUIP_SLOT.ARMOR, defense, price, magical: true, ...effect };
            break;
        }
        case 'artifact': {
            const { value, ...effect } = Rando.choice(PASSIVE_EFFECTS);
            const name = _rollName(ARTIFACT_ITEMS, EFFECT_NAMING[effect.special]);
            const price = (Rando.int(0, 100) + Rando.int(0, 100)) * value;
            item = { id, name, slot: EQUIP_SLOT.ARTIFACT, price, magical: true, ...effect };
            break;
        }
    }

    ALL_EQUIPMENT[id] = item;
    return item;
}

// ---- Skills ----
export const SKILL_TARGET = {
    SELF: 'self',
    MELEE: 'melee',       // must be adjacent
    MELEE_EXECUTE: 'melee_execute', // adjacent + enemy below 50% HP
    RANGED: 'ranged',     // pick enemy within range
    RANGED_AOE: 'ranged_aoe', // pick any visible hex within range (damages area)
    AOE_SELF: 'aoe_self', // centered on self
    TELEPORT: 'teleport',  // pick any visible hex in range
    TELEPORT_REVEALED: 'teleport_revealed', // pick any revealed hex in range
    WATER_SKIP: 'water_skip', // land->water, water->water, or water->land
    MOUNTAIN_SKIP: 'mountain_skip' // land->mountain, mountain->mountain, or mountain->land
};

export const SKILL_USAGE = {
    PRISTINE: 'pristine',       // no enemies within 2, non-shattered hex
    NON_COMBAT: 'non_combat',   // no enemies within 2
    ANYTIME: 'anytime'          // no restrictions
};

export const SKILLS = {
    // ---- Combat skills (anytime) ----
    restore: {
        id: 'restore', name: 'Restore', cost: 0, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.NON_COMBAT,
        desc: 'Restore shattered terrain and attempt to seal breaches. Gain 1 AE.', panelInvoke: true, minLevel: 0
    },
    void_strike: {
        id: 'void_strike', name: 'Void Strike', cost: 1, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        weaponClass: 'melee', scales: ['effectStrength'], tiers: [[5], [6], [8], [9], [10]],
        desc: 'Melee: weapon + Might + Warding. No counter-attack.', minLevel: 1
    },
    sweep: {
        id: 'sweep', name: 'Sweep', cost: 3, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        weaponClass: 'melee', scales: ['hitCount'], tiers: [[3], [3], [4], [4], [5]],
        desc: 'Melee: hit the target, then more adjacent enemies. No counter.', minLevel: 2
    },
    stun_blow: {
        id: 'stun_blow', name: 'Stun', cost: 3, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        weaponClass: 'melee', scales: ['effectStrength'], tiers: [[50], [60], [70], [85], [100]],
        desc: 'Melee strike with a bonus stun chance. No counter.', minLevel: 2
    },
    phase_step: {
        id: 'phase_step', name: 'Phase Step', cost: 1, mpCost: 0, target: SKILL_TARGET.TELEPORT, usage: SKILL_USAGE.ANYTIME,
        scales: ['range'], tiers: [[2], [3], [4], [5], [6]], desc: 'Teleport to a visible hex nearby.', minLevel: 2
    },
    water_skip: {
        id: 'water_skip', name: 'Water Skip', cost: 3, mpCost: 1, target: SKILL_TARGET.WATER_SKIP, usage: SKILL_USAGE.ANYTIME,
        scales: ['range'], tiers: [[4], [4], [5], [5], [6]], desc: 'Skip to a nearby water hex. From water, may skip to water or land.', minLevel: 2
    },
    mountain_skip: {
        id: 'mountain_skip', name: 'Mountain Skip', cost: 3, mpCost: 1, target: SKILL_TARGET.MOUNTAIN_SKIP, usage: SKILL_USAGE.ANYTIME,
        scales: ['range'], tiers: [[4], [4], [5], [5], [6]], desc: 'Skip to a nearby mountain hex. From mountain, may skip to mountain or land.', minLevel: 2
    },
    sprint: {
        id: 'sprint', name: 'Sprint', cost: 2, mpCost: 0, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.ANYTIME,
        scales: ['effectStrength'], tiers: [[1], [2], [4], [6], [8]], desc: 'Gain bonus MP this turn. Once per turn.', minLevel: 2
    },
    cosmic_bolt: {
        id: 'cosmic_bolt', name: 'Cosmic Bolt', cost: 3, target: SKILL_TARGET.RANGED, usage: SKILL_USAGE.ANYTIME,
        scales: ['baseDamage', 'range'], tiers: [[8, 4], [10, 4], [12, 5], [14, 5], [16, 6]], desc: 'Ranged bolt; damage scales with Warding.', minLevel: 2
    },
    shockwave: {
        id: 'shockwave', name: 'Shockwave', cost: 2, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        scales: ['baseDamage', 'range'], tiers: [[4, 2], [6, 2], [8, 2], [10, 3], [12, 3]], desc: 'AoE around you; scales with Might and pushes each enemy back a hex.', minLevel: 2
    },
    siphon_strike: {
        id: 'siphon_strike', name: 'Siphon Strike', cost: 2, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        weaponClass: 'melee', scales: ['effectStrength'], tiers: [[5], [6], [8], [9], [10]],
        desc: 'Melee: weapon + Might. Heal HP equal to damage dealt. No counter.', minLevel: 2
    },
    piercing_shot: {
        id: 'piercing_shot', name: 'Penetrating Shot', cost: 2, target: SKILL_TARGET.RANGED, usage: SKILL_USAGE.ANYTIME,
        weaponClass: 'ranged', range: 4, scales: ['baseDamage'], tiers: [[6], [8], [10], [12], [14]], desc: 'Ranged shot that ignores defense; scales with Reflex.', minLevel: 2
    },
    warp_shield: {
        id: 'warp_shield', name: 'Warp Shield', cost: 5, mpCost: 1, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.ANYTIME,
        duration: 1, scales: ['effectStrength'], tiers: [[5], [6], [8], [9], [10]],
        desc: 'Chance to block all enemy damage for one turn.', minLevel: 4
    },
    reflect: {
        id: 'reflect', name: 'Reflect', cost: 3, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.ANYTIME,
        duration: 1, takePercent: 10, reflectPercent: 90, scales: ['effectStrength'], tiers: [[4], [5], [7], [8], [9]],
        desc: 'Next enemy turn (melee only): a chance to take 10% (min 1) and reflect 90% (min 1); otherwise you eat full damage.',
        minLevel: 4
    },
    channel: {
        id: 'channel', name: 'Channel Aether', cost: 0, mpCost: 0, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.ANYTIME,
        scales: ['effectStrength'], tiers: [[4], [4], [3], [3], [2]],
        desc: 'Burn HP for AE, up to filling AE or half current HP. Min 1 AE — blood from a stone.',
        scrollOnly: true, panelInvoke: true,
        minLevel: 3
    },
    breach_pulse: {
        id: 'breach_pulse', name: 'Breach Pulse', cost: 3, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        scales: ['baseDamage', 'range'], tiers: [[5, 2], [7, 2], [9, 2], [11, 3], [13, 3]], desc: 'AoE around you; scales with Warding.', minLevel: 4
    },
    chain_lightning: {
        id: 'chain_lightning', name: 'Chain Lightning', cost: 3, target: SKILL_TARGET.RANGED, usage: SKILL_USAGE.ANYTIME,
        range: 3, scales: ['baseDamage', 'hitCount', 'effectStrength'], tiers: [[6, 2, 2], [8, 2, 2], [10, 3, 2], [12, 3, 3], [14, 4, 3]],
        desc: 'Ranged bolt; chains to nearby enemies for full damage. Scales with Warding.', minLevel: 4
    },
    immolate: {
        id: 'immolate', name: 'Immolate', cost: 1, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        weaponClass: 'melee', scales: ['effectStrength'], tiers: [[6], [8], [10], [12], [14]], desc: 'Melee strike; the target burns next turn. No counter.', minLevel: 4
    },
    mending_light: {
        id: 'mending_light', name: 'Mending Light', cost: 2, mpCost: 1, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.ANYTIME,
        scales: ['effectStrength'], tiers: [[10], [14], [18], [22], [26]], desc: 'Heal yourself; scales with Vigor. Costs 1 MP.', minLevel: 2
    },
    gravity_well: {
        id: 'gravity_well', name: 'Gravity Well', cost: 3, mpCost: 1, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        scales: ['range'], tiers: [[5], [5], [6], [6], [7]], desc: 'Pull nearby enemies one hex closer.', minLevel: 6
    },
    sundering_blow: {
        id: 'sundering_blow', name: 'Shredding Blow', cost: 2, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        weaponClass: 'melee', scales: ['effectStrength'], tiers: [[3], [4], [5], [6], [7]], desc: 'Melee strike that permanently shreds enemy defense. No counter.', minLevel: 6
    },
    meteor: {
        id: 'meteor', name: 'Meteor', cost: 4, target: SKILL_TARGET.RANGED_AOE, usage: SKILL_USAGE.ANYTIME,
        scales: ['baseDamage', 'range', 'effectStrength'], tiers: [[8, 4, 1], [10, 4, 1], [12, 5, 1], [14, 5, 2], [16, 6, 2]], desc: 'Strike a target hex and all enemies in its blast; scales with Warding.', minLevel: 6
    },
    dimensional_rend: {
        id: 'dimensional_rend', name: 'Dimensional Rend', cost: 0, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        weaponClass: 'melee', scales: ['effectStrength'], tiers: [[5], [8], [10], [12], [15]],
        desc: 'Melee: weapon + Vigor, drawn from your own HP. No counter.', minLevel: 8
    },
    execute: {
        id: 'execute', name: 'Execute', cost: 3, target: SKILL_TARGET.MELEE_EXECUTE, usage: SKILL_USAGE.ANYTIME,
        weaponClass: 'melee', scales: ['effectStrength'], tiers: [[20], [28], [35], [43], [50]],
        desc: 'Melee: weapon + Might. Only targets enemies below 50% HP.', minLevel: 8
    },
    ricochet: {
        id: 'ricochet', name: 'Ricochet', cost: 3, target: SKILL_TARGET.RANGED, usage: SKILL_USAGE.ANYTIME,
        weaponClass: 'ranged', range: 4, baseDamage: 5,
        scales: ['effectStrength', 'hitCount'], tiers: [[3, 2], [3, 3], [4, 3], [4, 4], [5, 5]],
        desc: 'Ranged shot that bounces to nearby enemies; scales with Reflex.', minLevel: 8
    },
    starfall: {
        id: 'starfall', name: 'Starfall', cost: 5, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        scales: ['baseDamage', 'range'], tiers: [[15, 3], [18, 3], [21, 3], [24, 4], [28, 4]], desc: 'Wide AoE around you; scales heavily with Warding.', minLevel: 10
    },
    void_salvo: {
        id: 'void_salvo', name: 'Void Salvo', cost: 4, target: SKILL_TARGET.RANGED, usage: SKILL_USAGE.ANYTIME,
        weaponClass: 'ranged', range: 3, scales: ['baseDamage', 'hitCount'], tiers: [[5, 3], [6, 3], [7, 4], [8, 4], [10, 5]], desc: 'Fire a volley at one target; each shot scales with Reflex.', minLevel: 10
    },
    recall: {
        id: 'recall', name: 'Recall', cost: 5, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.ANYTIME,
        desc: 'Teleport to nearest haven.', panelInvoke: true, minLevel: 10
    },
    // ---- Non-combat skills ----
    aether_tap: {
        id: 'aether_tap', name: 'Aether Tap', cost: 0, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.PRISTINE,
        scales: ['range', 'effectStrength'], tiers: [[1, 2], [2, 3], [3, 4], [4, 4], [5, 5]],
        desc: 'Draw Aether from clean land, water, and mountains in range — more clean hexes, more AE.', panelInvoke: true, minLevel: 2
    },
    farsight: {
        id: 'farsight', name: 'Farsight', cost: 2, mpCost: 0, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.NON_COMBAT,
        scales: ['range'], tiers: [[12], [14], [16], [18], [20]], desc: 'Reveal all hexes around you.', panelInvoke: true, minLevel: 2
    },
    prospect: {
        id: 'prospect', name: 'Prospect', cost: 1, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        scales: ['range'], tiers: [[8], [9], [10], [11], [12]], desc: 'Reveal nearby gold hexes. 20% chance to discover a gold deposit.', panelInvoke: true, minLevel: 4
    },
    salvage: {
        id: 'salvage', name: 'Salvage', cost: 0, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.PRISTINE,
        scales: ['range'], tiers: [[1], [1], [2], [2], [3]], desc: 'Restore nearby shattered hexes and reveal gold.', panelInvoke: true, minLevel: 4
    },
    skill_seek: {
        id: 'skill_seek', name: 'Skill Seek', cost: 3, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        scales: ['effectStrength'], tiers: [[5], [9], [13], [16], [20]],
        desc: 'Meditate: a chance to learn a new skill.', panelInvoke: true, minLevel: 6
    },
    spirit_walk: {
        id: 'spirit_walk', name: 'Spirit Walk', cost: 3, target: SKILL_TARGET.TELEPORT_REVEALED, usage: SKILL_USAGE.NON_COMBAT,
        scales: ['range'], tiers: [[6], [8], [10], [12], [14]], desc: 'Teleport to any revealed hex nearby.', panelInvoke: true, minLevel: 6
    },
    ground_weeps: {
        id: 'ground_weeps', name: 'Ground Weeps', cost: 4, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.NON_COMBAT,
        desc: 'Show enemy threat heatmap over entire map. Press Space/click to dismiss.', panelInvoke: true, minLevel: 8
    },
    sanctuary: {
        id: 'sanctuary', name: 'Sanctuary', cost: 0, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        scales: ['effectStrength'], tiers: [[4], [4], [3], [3], [2]],
        desc: 'Conjure a fleeting village and rest at once: heal a fraction of HP/AE. Must be non-POI terrain.', panelInvoke: true, minLevel: 8
    },
    // ---- Special combat skills ----
    loot: {
        id: 'loot', name: 'Loot', cost: 0, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        scales: ['effectStrength'], tiers: [[8], [14], [19], [25], [30]],
        desc: "Take gold from an adjacent enemy instead of dealing damage.", minLevel: 2
    },
    havens_light: {
        id: 'havens_light', name: "Haven's Light", cost: 3, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        scales: ['baseDamage', 'range'], tiers: [[20, 3], [24, 3], [28, 3], [32, 4], [36, 4]], desc: "Powerful AoE around you. Only usable at a haven or village.", minLevel: 6
    },
    // ---- Peaceful skills ----
    aether_blast: {
        id: 'aether_blast', name: 'Aether Blast', cost: 2, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        aetherPerHit: 3, scales: ['baseDamage', 'range'], tiers: [[3, 2], [4, 2], [5, 2], [6, 3], [7, 3]],
        desc: 'AoE around you; gain AE per enemy hit.', minLevel: 4
    },
    lifedrain_blast: {
        id: 'lifedrain_blast', name: 'Lifedrain Blast', cost: 2, mpCost: 2, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        hpPerHit: 2, scales: ['baseDamage', 'range'], tiers: [[3, 2], [4, 2], [5, 2], [6, 3], [7, 3]],
        desc: 'AoE around you; heal HP per enemy hit.', minLevel: 4
    },
    bountiful_harvest: {
        id: 'bountiful_harvest', name: 'Bountiful Harvest', cost: 4, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        scales: ['range'], tiers: [[2], [2], [3], [3], [4]], desc: 'Sprout crops (1-3g each) on nearby healthy hexes.', panelInvoke: true, minLevel: 4
    },
    // ---- Shop-only skills (not in random skill pools) ----
    commune: {
        id: 'commune', name: 'Commune', cost: 2, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        shopPrice: 2000, shopOnly: true, scales: ['range'], tiers: [[38], [66], [94], [122], [150]],
        desc: 'Reveal POI locations within range.', minLevel: 4
    },
    respec: {
        id: 'respec', name: 'Renew', cost: 3, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        scrollOnly: true, panelInvoke: true,
        desc: 'Refund all spent stat points and reallocate them. Requires clean hex, no enemies.', minLevel: 4
    },
    retrain: {
        id: 'retrain', name: 'Retrain', cost: 3, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        scrollOnly: true, panelInvoke: true,
        desc: 'Open the Train panel to reallocate your skill points. Requires clean hex, no enemies.', minLevel: 4
    },
    garrison: {
        id: 'garrison', name: 'Commission Garrison', cost: 0, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        shopPrice: 1000, goldCost: 1000, shopOnly: true,
        desc: 'Spend 1000g to commission a garrison on this hex. A haven or village must be in sight.', minLevel: 0
    },
    // Picked up only from the scroll the Maw leaves behind. Filtered out of all random/learn pools.
    return: {
        id: 'return', name: 'RETURN', cost: 4, mpCost: 0, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        scrollOnly: true, panelInvoke: true,
        desc: 'End your journey and tally your final score. Requires a peaceful, unshattered hex.', minLevel: 0
    }
};

// Levels at which skill choices are offered
export const SKILL_UNLOCK_LEVELS = [2, 4, 6, 8, 10];

// A tiered skill carries `scales` (the axis field names) and `tiers` (one tuple
// per rank, 1..SKILL_MAX_RANK). Rank R reads tiers[R-1], whose values are zipped
// onto the named axes. "Just do it" skills carry neither and never scale.
export const SKILL_MAX_RANK = 5;

// Resolve a skill def to its concrete effect at `rank`. Untiered skills return
// unchanged (same object, identity preserved). Tiered skills overlay this rank's
// tuple onto the named axes, leaving all unscaled fields (cost, range fallbacks,
// aetherPerHit, …) to pass through from the base def.
export function effectiveSkill(skill, rank) {
    if (!skill || !skill.tiers) return skill;
    const tuple = skill.tiers[rank - 1];
    const scaled = {};
    skill.scales.forEach((axis, i) => { scaled[axis] = tuple[i]; });
    return { ...skill, ...scaled };
}
