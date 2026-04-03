// config.js — Game constants and data definitions
import { Rando } from './rando.js';
import { ORIG_WEAPONS, ORIG_ARMORS, ORIG_ARTIFACTS } from './origitems.js';

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
    DISTRESSED_QUARRY: 16
};

export function isChaosTerrain(t) { return t >= TERRAIN.SHATTERED_PLAINS && t <= TERRAIN.DISTRESSED_QUARRY; }

export const RANGER_TERRAIN = [
    TERRAIN.FOREST, TERRAIN.HILLS, TERRAIN.QUARRY,
    TERRAIN.SHATTERED_FOREST, TERRAIN.DISTRESSED_FOREST,
    TERRAIN.SHATTERED_HILLS, TERRAIN.DISTRESSED_HILLS,
    TERRAIN.SHATTERED_QUARRY, TERRAIN.DISTRESSED_QUARRY
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
    [TERRAIN.DISTRESSED_QUARRY]: 'Distressed Quarry'
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
    [TERRAIN.DISTRESSED_QUARRY]: 2
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
    [TERRAIN.DISTRESSED_HILLS]: 1
};

export const PLAYER_MP = 4;
export const MAP_COLS = 100;
export const MAP_ROWS = 100;
export const BASE_VISION = 6;


// ---- Player defaults ----
export const STARTING_STATS = { might: 3, reflex: 3, warding: 2, vigor: 3 };
export const STAT_POINTS_PER_LEVEL = 3;
export const MAX_DODGE = 30;

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
    HUT: 'hut'
};

export const POI_DEFENSE_BONUS = {
    [POI.HAVEN]: 3,
    [POI.VILLAGE]: 2
};

export const POI_SYMBOLS = {
    [POI.HAVEN]: '\u{1F3F0}', // 🏰 castle
    [POI.VILLAGE]: '\u{1F3E1}', // 🏡 house with garden
    [POI.RUIN]: '\u26EB',    // ⛫ castle ruins
    [POI.BREACH]: '\u058D',  // ֍ swirl
    [POI.MAW]: '\u2738',     // ✸ pulsing star
    [POI.HUT]: '\u2302'      // ⌂ house
};

export const POI_COLORS = {
    [POI.HAVEN]: '#4fc3f7',
    [POI.VILLAGE]: '#ffb74d',
    [POI.RUIN]: '#b0bec5',
    [POI.BREACH]: '#e040fb',
    [POI.MAW]: '#ff1744',
    [POI.HUT]: '#b0bec5'
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
        range: 6, spawnInterval: 3, chaosSpawned: true
    }
};

// ---- Equipment ----
export const EQUIP_SLOT = { WEAPON: 'weapon', ARMOR: 'armor', ARTIFACT: 'artifact' };

// Non-magical weapons
export const WEAPONS = [
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

// Non-magical armor
export const ARMORS = [
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
    // Legacy magical items so old saved games still work
    for (const w of ORIG_WEAPONS) if (w.magical) ALL_EQUIPMENT[w.id] = { ...w, slot: EQUIP_SLOT.WEAPON };
    for (const a of ORIG_ARMORS) if (a.magical) ALL_EQUIPMENT[a.id] = { ...a, slot: EQUIP_SLOT.ARMOR };
    for (const a of ORIG_ARTIFACTS) ALL_EQUIPMENT[a.id] = { ...a, slot: EQUIP_SLOT.ARTIFACT };
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
const MELEE_ITEMS = [
    'Axe', 'Blade', 'Cleaver', 'Edge', 'Mace', 'Pick', 'Spear', 'Spike',
    'Sword', 'Thorn', 'Glaive', 'Hatchet', 'Flail', 'Scythe', 'Fist',
    'Ripper', 'Shard', 'Vane'
];
const RANGED_ITEMS = [
    'Bolt', 'Bow', 'Cannon', 'Caster', 'Lance', 'Launcher', 'Longbow',
    'Repeater', 'Rifle', 'Rod', 'Sling', 'Arbalest', 'Javelin', 'Handcannon',
    'Wand', 'Accelerator', 'Emitter', 'Coilgun'
];
const ARMOR_ITEMS = [
    'Aegis', 'Cloak', 'Cuirass', 'Hide', 'Mail', 'Plate', 'Robe', 'Shield',
    'Tunic', 'Vest', 'Weave', 'Mantle', 'Carapace', 'Hauberk', 'Wrap', 'Cowl'
];
const ARTIFACT_ITEMS = [
    'Amulet', 'Anchor', 'Boots', 'Bracers', 'Circlet', 'Compass', 'Crown',
    'Crystal', 'Gloves', 'Hood', 'Jewel', 'Lens', 'Ring', 'Shroud', 'Sigil',
    'Signet', 'Stone', 'Talisman', 'Torc', 'Veil', 'Ward', 'Wraps', 'Lantern',
    'Transponder', 'Injector', 'Capacitor'
];

// Effect-specific naming: verbings and archetypes per special type
const EFFECT_NAMING = {
    armor_pierce:      { v: ['Rending', 'Sundering', 'Piercing'],   a: ['Slayer', 'Warden', 'Operator'] },
    aether_siphon:     { v: ['Thirsting', 'Weeping', 'Withering'],  a: ['Witch', 'Technomancer', 'Seer'] },
    burn:              { v: ['Blazing', 'Searing', 'Burning'],      a: ['Zealot', 'Witch', 'Xenarch'] },
    chain:             { v: ['Shrieking', 'Flickering', 'Blazing'],  a: ['Technomancer', 'Operator', 'Starpilot'] },
    chaos_bonus:       { v: ['Warding', 'Sundering', 'Searing'],    a: ['Sentinel', 'Warden', 'Zealot'] },
    counter_mastery:   { v: ['Warding', 'Piercing', 'Rending'],     a: ['Warden', 'Sentinel', 'Slayer'] },
    defense_shred:     { v: ['Sundering', 'Rending', 'Withering'],  a: ['Surgeon', 'Operator', 'Slayer'] },
    double_strike:     { v: ['Flickering', 'Blazing', 'Rending'],   a: ['Replicant', 'Slayer', 'Pilot'] },
    triple_strike:     { v: ['Flickering', 'Shrieking', 'Blazing'], a: ['Replicant', 'Slayer', 'Zealot'] },
    ignore_defense:    { v: ['Piercing', 'Sundering', 'Rending'],   a: ['Xenarch', 'Surgeon', 'Technomancer'] },
    knockback:         { v: ['Sundering', 'Shrieking', 'Blazing'],  a: ['Warden', 'Sentinel', 'Slayer'] },
    lifesteal:         { v: ['Thirsting', 'Weeping', 'Withering'],  a: ['Wraith', 'Witch', 'Surgeon'] },
    momentum:          { v: ['Blazing', 'Searing', 'Rending'],      a: ['Wanderer', 'Wayfarer', 'Pilot'] },
    recoil:            { v: ['Shrieking', 'Blazing', 'Searing'],    a: ['Zealot', 'Slayer', 'Xenarch'] },
    reverberate:       { v: ['Shrieking', 'Sundering', 'Blazing'],  a: ['Technomancer', 'Xenarch', 'Operator'] },
    riposte:           { v: ['Warding', 'Piercing', 'Flickering'],  a: ['Warden', 'Sentinel', 'Slayer'] },
    double_shot:       { v: ['Flickering', 'Blazing', 'Shrieking'], a: ['Replicant', 'Ranger', 'Starpilot'] },
    triple_shot:       { v: ['Flickering', 'Shrieking', 'Blazing'], a: ['Replicant', 'Starpilot', 'Zealot'] },
    free_ranged:       { v: ['Flickering', 'Warding', 'Weeping'],   a: ['Navigator', 'Seer', 'Wanderer'] },
    piercing:          { v: ['Piercing', 'Rending', 'Sundering'],   a: ['Ranger', 'Scout', 'Slayer'] },
    sniper:            { v: ['Piercing', 'Warding', 'Searing'],     a: ['Ranger', 'Scout', 'Starpilot'] },
    splash:            { v: ['Blazing', 'Shrieking', 'Searing'],    a: ['Operator', 'Technomancer', 'Xenarch'] },
    burning_aura:      { v: ['Blazing', 'Searing', 'Burning'],      a: ['Zealot', 'Witch', 'Xenarch'] },
    dodge_bonus:       { v: ['Flickering', 'Weeping', 'Warding'],   a: ['Scout', 'Wanderer', 'Wraith'] },
    heal_on_kill:      { v: ['Thirsting', 'Rending', 'Withering'],  a: ['Slayer', 'Wraith', 'Surgeon'] },
    high_def_mp_penalty: { v: ['Warding', 'Sundering', 'Blazing'],  a: ['Sentinel', 'Warden', 'Xenarch'] },
    last_stand:        { v: ['Warding', 'Blazing', 'Shrieking'],    a: ['Sentinel', 'Zealot', 'Warden'] },
    momentum_defense:  { v: ['Flickering', 'Blazing', 'Warding'],   a: ['Wanderer', 'Wayfarer', 'Pilot'] },
    ranged_defense:    { v: ['Warding', 'Flickering', 'Blazing'],   a: ['Sentinel', 'Warden', 'Technomancer'] },
    ranged_immune:     { v: ['Warding', 'Flickering', 'Blazing'],   a: ['Sentinel', 'Warden', 'Technomancer'] },
    thorns:            { v: ['Piercing', 'Rending', 'Shrieking'],   a: ['Sentinel', 'Warden', 'Xenarch'] },
    wall_of_steel:     { v: ['Warding', 'Sundering', 'Blazing'],    a: ['Sentinel', 'Warden', 'Slayer'] },
    aether_bonus:      { v: ['Warding', 'Flickering', 'Weeping'],   a: ['Seer', 'Technomancer', 'Witch'] },
    aether_regen:      { v: ['Weeping', 'Flickering', 'Warding'],   a: ['Seer', 'Witch', 'Navigator'] },
    aether_signet:     { v: ['Blazing', 'Searing', 'Thirsting'],    a: ['Technomancer', 'Xenarch', 'Zealot'] },
    blink_ring:        { v: ['Flickering', 'Blazing', 'Weeping'],   a: ['Navigator', 'Pilot', 'Wraith'] },
    breach_jewel:      { v: ['Blazing', 'Warding', 'Searing'],      a: ['Sentinel', 'Warden', 'Zealot'] },
    chaos_attune:      { v: ['Withering', 'Weeping', 'Warding'],    a: ['Witch', 'Xenarch', 'Wanderer'] },
    chaos_circlet:     { v: ['Withering', 'Weeping', 'Flickering'], a: ['Witch', 'Xenarch', 'Wanderer'] },
    chaos_defense:     { v: ['Warding', 'Withering', 'Blazing'],    a: ['Sentinel', 'Warden', 'Zealot'] },
    disengage:         { v: ['Flickering', 'Weeping', 'Warding'],   a: ['Scout', 'Wanderer', 'Ranger'] },
    displacement_immune: { v: ['Warding', 'Sundering', 'Blazing'],  a: ['Sentinel', 'Warden', 'Navigator'] },
    heal:              { v: ['Weeping', 'Warding', 'Flickering'],   a: ['Surgeon', 'Seer', 'Wanderer'] },
    hp_bonus:          { v: ['Warding', 'Blazing', 'Sundering'],    a: ['Warden', 'Sentinel', 'Zealot'] },
    mp_bonus:          { v: ['Flickering', 'Blazing', 'Warding'],   a: ['Wanderer', 'Wayfarer', 'Scout'] },
    opportunist:       { v: ['Flickering', 'Thirsting', 'Rending'], a: ['Scout', 'Ranger', 'Operator'] },
    ranger_defense:    { v: ['Warding', 'Flickering', 'Weeping'],   a: ['Ranger', 'Scout', 'Wanderer'] },
    reveal_maw:        { v: ['Piercing', 'Flickering', 'Warding'],  a: ['Seer', 'Navigator', 'Scout'] },
    revive:            { v: ['Weeping', 'Warding', 'Flickering'],   a: ['Surgeon', 'Seer', 'Wanderer'] },
    soul_harvest:      { v: ['Thirsting', 'Withering', 'Weeping'],  a: ['Wraith', 'Witch', 'Slayer'] },
    strider:           { v: ['Flickering', 'Blazing', 'Warding'],   a: ['Wanderer', 'Wayfarer', 'Ranger'] },
    threat_shroud:     { v: ['Weeping', 'Flickering', 'Withering'], a: ['Scout', 'Wraith', 'Wanderer'] },
    vision_bonus:      { v: ['Piercing', 'Flickering', 'Warding'],  a: ['Seer', 'Scout', 'Navigator'] },
    wraith_immune:     { v: ['Warding', 'Blazing', 'Searing'],      a: ['Sentinel', 'Warden', 'Technomancer'] },
};

// Effect pools — pure stat data, naming handled by EFFECT_NAMING
const MELEE_EFFECTS = [
    { special: 'armor_pierce', pierceAmount: 2 },
    { special: 'armor_pierce', pierceAmount: 4 },
    { special: 'aether_siphon', siphonAmount: 1 },
    { special: 'aether_siphon', siphonAmount: 2 },
    { special: 'burn', burnDamage: 2 },
    { special: 'burn', burnDamage: 3 },
    { special: 'burn', burnDamage: 5 },
    { special: 'chain', chainCount: 2 },
    { special: 'chain', chainCount: 3 },
    { special: 'chain', chainCount: 5 },
    { special: 'chaos_bonus', chaosBonus: 2 },
    { special: 'chaos_bonus', chaosBonus: 4 },
    { special: 'chaos_bonus', chaosBonus: 6 },
    { special: 'counter_mastery' },
    { special: 'defense_shred', shredAmount: 1 },
    { special: 'defense_shred', shredAmount: 2 },
    { special: 'double_strike' },
    { special: 'triple_strike' },
    { special: 'ignore_defense' },
    { special: 'knockback' },
    { special: 'lifesteal', lifestealAmount: 1 },
    { special: 'lifesteal', lifestealAmount: 2 },
    { special: 'lifesteal', lifestealAmount: 3 },
    { special: 'momentum', momentumBonus: 2 },
    { special: 'momentum', momentumBonus: 3 },
    { special: 'momentum', momentumBonus: 4 },
    { special: 'recoil', recoilBonus: 3, recoilDamage: 1 },
    { special: 'recoil', recoilBonus: 5, recoilDamage: 3 },
    { special: 'recoil', recoilBonus: 8, recoilDamage: 5 },
    { special: 'reverberate', chainCount: 3, chainBonus: 2 },
    { special: 'riposte', riposteDamage: 1 },
    { special: 'riposte', riposteDamage: 2 },
    { special: 'riposte', riposteDamage: 3 },
];

const RANGED_EFFECTS = [
    { special: 'armor_pierce', pierceAmount: 2 },
    { special: 'armor_pierce', pierceAmount: 4 },
    { special: 'aether_siphon', siphonAmount: 1 },
    { special: 'aether_siphon', siphonAmount: 2 },
    { special: 'burn', burnDamage: 2 },
    { special: 'burn', burnDamage: 3 },
    { special: 'burn', burnDamage: 5 },
    { special: 'chain', chainCount: 2 },
    { special: 'chain', chainCount: 3 },
    { special: 'chain', chainCount: 5 },
    { special: 'chaos_bonus', chaosBonus: 2 },
    { special: 'chaos_bonus', chaosBonus: 4 },
    { special: 'chaos_bonus', chaosBonus: 6 },
    { special: 'defense_shred', shredAmount: 1 },
    { special: 'defense_shred', shredAmount: 2 },
    { special: 'double_shot' },
    { special: 'triple_shot' },
    { special: 'free_ranged' },
    { special: 'ignore_defense' },
    { special: 'knockback' },
    { special: 'lifesteal', lifestealAmount: 1 },
    { special: 'lifesteal', lifestealAmount: 2 },
    { special: 'lifesteal', lifestealAmount: 3 },
    { special: 'piercing' },
    { special: 'recoil', recoilBonus: 5, recoilDamage: 1 },
    { special: 'recoil', recoilBonus: 8, recoilDamage: 3 },
    { special: 'recoil', recoilBonus: 13, recoilDamage: 5 },
    { special: 'sniper', sniperBonus: 2 },
    { special: 'sniper', sniperBonus: 4 },
    { special: 'sniper', sniperBonus: 8 },
    { special: 'splash', splashDamage: 2 },
];

const ARMOR_EFFECTS = [
    { special: 'burning_aura', burnAuraDamage: 2 },
    { special: 'burning_aura', burnAuraDamage: 5 },
    { special: 'dodge_bonus', dodgeBonus: 10 },
    { special: 'dodge_bonus', dodgeBonus: 20 },
    { special: 'dodge_bonus', dodgeBonus: 30 },
    { special: 'heal_on_kill', healOnKill: 5 },
    { special: 'heal_on_kill', healOnKill: 8 },
    { special: 'high_def_mp_penalty', defBonus: 5, mpPenalty: 1 },
    { special: 'last_stand', lastStandBonus: 4 },
    { special: 'last_stand', lastStandBonus: 6 },
    { special: 'momentum_defense', momentumDefense: 1 },
    { special: 'momentum_defense', momentumDefense: 2 },
    { special: 'momentum_defense', momentumDefense: 3 },
    { special: 'ranged_defense', rangedDefenseBonus: 2 },
    { special: 'ranged_defense', rangedDefenseBonus: 4 },
    { special: 'ranged_immune' },
    { special: 'thorns', thornsPercent: 50 },
    { special: 'thorns', thornsPercent: 100 },
    { special: 'wall_of_steel', wallBonus: 2 },
    { special: 'wall_of_steel', wallBonus: 4 },
    { special: 'wall_of_steel', wallBonus: 6 },
];

const PASSIVE_EFFECTS = [
    { special: 'aether_bonus', aetherBonus: 10 },
    { special: 'aether_bonus', aetherBonus: 20 },
    { special: 'aether_regen', aetherRegen: 1 },
    { special: 'aether_regen', aetherRegen: 2 },
    { special: 'aether_regen', aetherRegen: 3 },
    { special: 'aether_signet', aetherSignetDamage: 3, aetherSignetCost: 3 },
    { special: 'aether_signet', aetherSignetDamage: 5, aetherSignetCost: 5 },
    { special: 'blink_ring', blinkRange: 4, blinkBonus: 2 },
    { special: 'breach_jewel', breachBonus: 4 },
    { special: 'breach_jewel', breachBonus: 6 },
    { special: 'chaos_attune', chaosAttuneMight: 2, chaosAttuneDef: 2 },
    { special: 'chaos_attune', chaosAttuneMight: 4, chaosAttuneDef: 3 },
    { special: 'chaos_circlet' },
    { special: 'chaos_defense', chaosDefenseBonus: 2 },
    { special: 'chaos_defense', chaosDefenseBonus: 4 },
    { special: 'disengage' },
    { special: 'displacement_immune' },
    { special: 'heal', healPerTurn: 1 },
    { special: 'heal', healPerTurn: 2 },
    { special: 'heal', healPerTurn: 3 },
    { special: 'hp_bonus', hpBonus: 10 },
    { special: 'hp_bonus', hpBonus: 20 },
    { special: 'mp_bonus', mpBonus: 2 },
    { special: 'mp_bonus', mpBonus: 4 },
    { special: 'opportunist' },
    { special: 'ranger_defense', rangerBonus: 1 },
    { special: 'ranger_defense', rangerBonus: 2 },
    { special: 'ranger_defense', rangerBonus: 4 },
    { special: 'reveal_maw' },
    { special: 'revive', reviveHp: 1, reviveAether: 1 },
    { special: 'revive', reviveHp: 2, reviveAether: 2 },
    { special: 'soul_harvest', soulHarvestXP: 2 },
    { special: 'soul_harvest', soulHarvestXP: 4 },
    { special: 'strider' },
    { special: 'threat_shroud' },
    { special: 'vision_bonus', visionBonus: 2 },
    { special: 'vision_bonus', visionBonus: 4 },
    { special: 'wraith_immune' },
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
            const effect = Rando.choice(MELEE_EFFECTS);
            const name = _rollName(MELEE_ITEMS, EFFECT_NAMING[effect.special]);
            const damage = Rando.int(2, 6);
            const price = damage * 12 + 10;
            item = { id, name, type: 'melee', slot: EQUIP_SLOT.WEAPON, damage, range: 0, price, magical: true, ...effect };
            break;
        }
        case 'ranged': {
            const effect = Rando.choice(RANGED_EFFECTS);
            const name = _rollName(RANGED_ITEMS, EFFECT_NAMING[effect.special]);
            const damage = Rando.int(2, 6);
            const range = Rando.int(3, 5);
            const price = (damage + range) * 8 + 10;
            item = { id, name, type: 'ranged', slot: EQUIP_SLOT.WEAPON, damage, range, price, magical: true, ...effect };
            break;
        }
        case 'armor': {
            const effect = Rando.choice(ARMOR_OR_PASSIVE);
            const name = _rollName(ARMOR_ITEMS, EFFECT_NAMING[effect.special]);
            const defense = Rando.int(2, 6);
            const price = defense * 15 + 10;
            item = { id, name, slot: EQUIP_SLOT.ARMOR, defense, price, magical: true, ...effect };
            break;
        }
        case 'artifact': {
            const effect = Rando.choice(PASSIVE_EFFECTS);
            const name = _rollName(ARTIFACT_ITEMS, EFFECT_NAMING[effect.special]);
            const price = 40 + Rando.int(0, 40);
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
    TELEPORT_REVEALED: 'teleport_revealed' // pick any revealed hex in range
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
        desc: 'Restore shattered terrain and attempt to seal breaches. Gain 1 AE. Ends turn. Range: 1 + Lv/3.', minLevel: 0
    },
    void_strike: {
        id: 'void_strike', name: 'Void Strike', cost: 1, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        desc: 'Melee attack: weapon + Might + Warding. No counter-attack.', minLevel: 1
    },
    phase_step: {
        id: 'phase_step', name: 'Phase Step', cost: 2, target: SKILL_TARGET.TELEPORT, usage: SKILL_USAGE.ANYTIME,
        range: 3, desc: 'Teleport to visible hex within 3. Free action.', minLevel: 2, freeAction: true
    },
    cosmic_bolt: {
        id: 'cosmic_bolt', name: 'Cosmic Bolt', cost: 3, target: SKILL_TARGET.RANGED, usage: SKILL_USAGE.ANYTIME,
        range: 4, baseDamage: 8, desc: 'Ranged: 8 + Warding damage.', minLevel: 2
    },
    shockwave: {
        id: 'shockwave', name: 'Shockwave', cost: 2, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        range: 2, baseDamage: 4, desc: 'AoE: 4 + Might to enemies within 2. Pushes each 1 hex away.', minLevel: 2
    },
    siphon_strike: {
        id: 'siphon_strike', name: 'Siphon Strike', cost: 2, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        desc: 'Melee: weapon + Might. Heal HP equal to damage dealt. No counter.', minLevel: 2
    },
    piercing_shot: {
        id: 'piercing_shot', name: 'Piercing Shot', cost: 2, target: SKILL_TARGET.RANGED, usage: SKILL_USAGE.ANYTIME,
        range: 4, baseDamage: 6, desc: 'Ranged: 6 + Reflex. Ignores defense.', minLevel: 2
    },
    warp_shield: {
        id: 'warp_shield', name: 'Warp Shield', cost: 2, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.ANYTIME,
        duration: 3, desc: 'Absorb next hit. Lasts 3 turns.', minLevel: 4
    },
    breach_pulse: {
        id: 'breach_pulse', name: 'Breach Pulse', cost: 3, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        range: 2, baseDamage: 5, desc: 'AoE: 5 + Warding to enemies within 2.', minLevel: 4
    },
    chain_lightning: {
        id: 'chain_lightning', name: 'Chain Lightning', cost: 3, target: SKILL_TARGET.RANGED, usage: SKILL_USAGE.ANYTIME,
        range: 3, baseDamage: 6, chainDamage: 4, chainCount: 2, chainRange: 2,
        desc: 'Ranged: 6 + Warding. Chains to 2 nearby enemies for 4 flat dmg.', minLevel: 4
    },
    immolate: {
        id: 'immolate', name: 'Immolate', cost: 1, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        burnDamage: 4, desc: 'Melee: weapon + Might. Target burns for 4 next turn. No counter.', minLevel: 4
    },
    mending_light: {
        id: 'mending_light', name: 'Mending Light', cost: 2, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.ANYTIME,
        baseHeal: 10, desc: 'Heal 10 + Vigor*3 HP.', minLevel: 6
    },
    gravity_well: {
        id: 'gravity_well', name: 'Gravity Well', cost: 3, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        range: 3, desc: 'Pull enemies within 3 one hex closer.', minLevel: 6
    },
    sundering_blow: {
        id: 'sundering_blow', name: 'Sundering Blow', cost: 2, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        shredAmount: 3, desc: 'Melee: weapon + Might. Permanently shred 3 enemy def. No counter.', minLevel: 6
    },
    meteor: {
        id: 'meteor', name: 'Meteor', cost: 4, target: SKILL_TARGET.RANGED_AOE, usage: SKILL_USAGE.ANYTIME,
        range: 4, aoeRange: 1, baseDamage: 8, desc: 'Target hex: 8 + Warding to all enemies within 1.', minLevel: 6
    },
    dimensional_rend: {
        id: 'dimensional_rend', name: 'Dimensional Rend', cost: 4, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        desc: 'Melee: weapon damage * 3. Must be adjacent.', minLevel: 8
    },
    execute: {
        id: 'execute', name: 'Execute', cost: 3, target: SKILL_TARGET.MELEE_EXECUTE, usage: SKILL_USAGE.ANYTIME,
        desc: 'Melee: weapon*2 + Might*2. Only targets enemies below 50% HP.', minLevel: 8
    },
    ricochet: {
        id: 'ricochet', name: 'Ricochet', cost: 3, target: SKILL_TARGET.RANGED, usage: SKILL_USAGE.ANYTIME,
        range: 4, baseDamage: 5, bounceCount: 2, bounceRange: 2,
        desc: 'Ranged: 5 + Reflex. Bounces to 2 more enemies within 2.', minLevel: 8
    },
    starfall: {
        id: 'starfall', name: 'Starfall', cost: 5, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        range: 3, baseDamage: 15, desc: 'AoE: 15 + Warding*2 to enemies within 3.', minLevel: 10
    },
    void_salvo: {
        id: 'void_salvo', name: 'Void Salvo', cost: 4, target: SKILL_TARGET.RANGED, usage: SKILL_USAGE.ANYTIME,
        range: 3, baseDamage: 5, shotCount: 3, desc: 'Fire 3 shots: each deals 5 + Reflex.', minLevel: 10
    },
    recall: {
        id: 'recall', name: 'Recall', cost: 5, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.ANYTIME,
        desc: 'Teleport to nearest haven. Ends turn.', minLevel: 10
    },
    // ---- Non-combat skills ----
    aether_tap: {
        id: 'aether_tap', name: 'Aether Tap', cost: 0, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.PRISTINE,
        range: 2, desc: 'Draw Aether from healthy land. +1 AE per 6 clean hexes within 2. Ends turn.', minLevel: 2
    },
    farsight: {
        id: 'farsight', name: 'Farsight', cost: 2, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.NON_COMBAT,
        range: 12, desc: 'Reveal all hexes within 12. Free action.', minLevel: 2, freeAction: true
    },
    prospect: {
        id: 'prospect', name: 'Prospect', cost: 1, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        revealRange: 8, desc: 'Reveal gold hexes within 8. 20% chance to discover a gold deposit.', minLevel: 4
    },
    commune: {
        id: 'commune', name: 'Commune', cost: 2, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        desc: 'Reveal all POI locations on the map. Ends turn.', minLevel: 4
    },
    salvage: {
        id: 'salvage', name: 'Salvage', cost: 0, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.PRISTINE,
        range: 1, desc: 'Restore adjacent shattered hexes and reveals gold. Ends turn.', minLevel: 4
    },
    skill_seek: {
        id: 'skill_seek', name: 'Skill Seek', cost: 3, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        desc: 'Meditate: 5% per level chance to learn a new skill.', minLevel: 6
    },
    spirit_walk: {
        id: 'spirit_walk', name: 'Spirit Walk', cost: 3, target: SKILL_TARGET.TELEPORT_REVEALED, usage: SKILL_USAGE.NON_COMBAT,
        range: 6, desc: 'Teleport to any revealed hex within 6. Ends turn.', minLevel: 6
    },
    ground_weeps: {
        id: 'ground_weeps', name: 'Ground Weeps', cost: 4, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.NON_COMBAT,
        desc: 'Show enemy threat heatmap over entire map. Press Space/click to dismiss.', minLevel: 8
    },
    sanctuary: {
        id: 'sanctuary', name: 'Sanctuary', cost: 3, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        desc: 'Current hex becomes a temporary village (one rest). Must be non-POI terrain.', minLevel: 8
    },
    // ---- Special combat skills ----
    loot: {
        id: 'loot', name: 'Loot', cost: 0, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        desc: 'Take 1-5 gold from adjacent enemy instead of dealing damage.', minLevel: 2
    },
    havens_light: {
        id: 'havens_light', name: "Haven's Light", cost: 3, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        range: 1, baseDamage: 20, desc: "AoE: strength 20 attack to all adjacent. Only usable at haven or village.", minLevel: 6
    },
    // ---- Peaceful skills ----
    bountiful_harvest: {
        id: 'bountiful_harvest', name: 'Bountiful Harvest', cost: 4, target: SKILL_TARGET.SELF, usage: SKILL_USAGE.PRISTINE,
        range: 2, desc: 'Sprout crops (1-3g each) on all healthy hexes within 2. Ends turn.', minLevel: 4
    }
};

// Levels at which skill choices are offered
export const SKILL_UNLOCK_LEVELS = [2, 4, 6, 8, 10];
