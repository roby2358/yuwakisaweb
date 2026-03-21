// config.js — Game constants and data definitions

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
export const MAP_COLS = 60;
export const MAP_ROWS = 40;
export const BASE_VISION = 6;
export const MAX_ENEMIES = 60;

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
    CAMP: 'camp',
    RUIN: 'ruin',
    BREACH: 'breach',
    MAW: 'maw'
};

export const POI_SYMBOLS = {
    [POI.HAVEN]: '\u{1F3F0}', // 🏰 castle
    [POI.CAMP]: '\u26FA',    // ⛺ tent
    [POI.RUIN]: '\u26EB',    // ⛫ castle ruins
    [POI.BREACH]: '\u058D',  // ֍ swirl
    [POI.MAW]: '\u2738'      // ✸ pulsing star
};

export const POI_COLORS = {
    [POI.HAVEN]: '#4fc3f7',
    [POI.CAMP]: '#ffb74d',
    [POI.RUIN]: '#b0bec5',
    [POI.BREACH]: '#e040fb',
    [POI.MAW]: '#ff1744'
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
        range: 4, chaosSpawned: false
    },
    [ENEMY_TYPE.PHASE_WRAITH]: {
        name: 'Phase Wraith', label: 'W', hp: 20, attack: 7, defense: 2,
        speed: 1, detectRange: 4, xp: 25, gold: 3, behavior: 'teleport',
        teleportRange: 3, teleportChance: 0.3, chaosSpawned: true
    },
    [ENEMY_TYPE.BREACH_GUARDIAN]: {
        name: 'Breach Guardian', label: 'G', hp: 50, attack: 10, rangedAttack: 8, defense: 5,
        speed: 1, detectRange: 3, xp: 80, gold: 10, behavior: 'guard',
        range: 3, guardRadius: 2, chaosSpawned: true
    },
    [ENEMY_TYPE.UNRAVELER]: {
        name: 'The Unraveler', label: '\u{1F480}', hp: 100, attack: 12, rangedAttack: 6, defense: 6,
        speed: 1, detectRange: 6, xp: 200, gold: 0, behavior: 'boss',
        range: 4, spawnInterval: 3, chaosSpawned: true
    }
};

// ---- Equipment ----
export const EQUIP_SLOT = { WEAPON: 'weapon', ARMOR: 'armor', ARTIFACT: 'artifact' };

export const WEAPONS = [
    { id: 'rusty_blade', name: 'Rusty Blade', type: 'melee', damage: 1, range: 0, special: null, price: 0, tier: 0, magical: true },
    { id: 'void_cleaver', name: 'Void Cleaver', type: 'melee', damage: 7, range: 0, special: 'chaos_bonus', price: 40, tier: 1, magical: true },
    { id: 'starforged_sword', name: 'Starforged Sword', type: 'melee', damage: 10, range: 0, special: null, price: 100, tier: 2, magical: true },
    { id: 'dimensional_edge', name: 'Dimensional Edge', type: 'melee', damage: 12, range: 0, special: 'cleave', price: 150, tier: 3, magical: true },
    { id: 'flux_bow', name: 'Flux Bow', type: 'ranged', damage: 5, range: 2, special: null, price: 35, tier: 1, magical: true },
    { id: 'phase_rifle', name: 'Phase Rifle', type: 'ranged', damage: 8, range: 5, special: 'ignore_defense', price: 120, tier: 3, magical: true },
    { id: 'aether_lance', name: 'Aether Lance', type: 'ranged', damage: 6, range: 3, special: 'free_ranged', price: 60, tier: 2, magical: true },
    // Non-magical melee
    { id: 'iron_sword', name: 'Iron Sword', type: 'melee', damage: 2, range: 0, special: null, price: 12, tier: 1, magical: false },
    { id: 'spear', name: 'Spear', type: 'melee', damage: 2, range: 0, special: null, price: 12, tier: 1, magical: false },
    { id: 'battle_axe', name: 'Battle Axe', type: 'melee', damage: 3, range: 0, special: null, price: 25, tier: 2, magical: false },
    { id: 'warhammer', name: 'Warhammer', type: 'melee', damage: 4, range: 0, special: null, price: 45, tier: 3, magical: false },
    { id: 'blade_spear', name: 'Blade Spear', type: 'melee', damage: 4, range: 0, special: null, price: 45, tier: 3, magical: false },
    { id: 'greatsword', name: 'Greatsword', type: 'melee', damage: 5, range: 0, special: null, price: 70, tier: 4, magical: false },
    // Non-magical bows
    { id: 'short_bow', name: 'Short Bow', type: 'ranged', damage: 1, range: 2, special: null, price: 5, tier: 0, magical: false },
    { id: 'hunting_bow', name: 'Hunting Bow', type: 'ranged', damage: 2, range: 2, special: null, price: 12, tier: 1, magical: false },
    { id: 'crossbow', name: 'Crossbow', type: 'ranged', damage: 3, range: 3, special: null, price: 25, tier: 2, magical: false },
    { id: 'war_bow', name: 'War Bow', type: 'ranged', damage: 4, range: 3, special: null, price: 45, tier: 3, magical: false },
    { id: 'great_bow', name: 'Great Bow', type: 'ranged', damage: 5, range: 4, special: null, price: 70, tier: 4, magical: false }
];

export const ARMORS = [
    { id: 'worn_leather', name: 'Worn Leather', defense: 1, special: null, price: 0, tier: 0, magical: true },
    { id: 'warded_mail', name: 'Warded Mail', defense: 4, special: 'hp_bonus', hpBonus: 10, price: 50, tier: 1, magical: true },
    { id: 'chaosweave_cloak', name: 'Chaosweave Cloak', defense: 3, special: 'vision_bonus', visionBonus: 2, price: 45, tier: 1, magical: true },
    { id: 'starplate', name: 'Starplate', defense: 6, special: 'mp_penalty', mpPenalty: 1, price: 120, tier: 2, magical: true },
    { id: 'voidhide', name: 'Voidhide', defense: 5, special: 'wraith_immune', price: 100, tier: 3, magical: true },
    // Non-magical armor
    { id: 'leather_armor', name: 'Leather Armor', defense: 2, special: null, price: 15, tier: 1, magical: false },
    { id: 'chain_mail', name: 'Chain Mail', defense: 3, special: null, price: 30, tier: 2, magical: false },
    { id: 'scale_armor', name: 'Scale Armor', defense: 4, special: null, price: 50, tier: 3, magical: false },
    { id: 'plate_armor', name: 'Plate Armor', defense: 5, special: null, price: 75, tier: 4, magical: false }
];

export const ARTIFACTS = [
    { id: 'seers_lens', name: "Seer's Lens", special: 'vision_bonus', visionBonus: 2, price: 40, tier: 1, magical: true },
    { id: 'aether_crystal', name: 'Aether Crystal', special: 'aether_bonus', aetherBonus: 4, price: 50, tier: 1, magical: true },
    { id: 'vitality_stone', name: 'Vitality Stone', special: 'regen', regenAmount: 3, price: 80, tier: 3, magical: true },
    { id: 'phase_anchor', name: 'Phase Anchor', special: 'displacement_immune', price: 35, tier: 1, magical: true },
    { id: 'maw_compass', name: 'Maw Compass', special: 'reveal_maw', price: 30, tier: 1, magical: true }
];

// All equipment in one lookup
export const ALL_EQUIPMENT = {};
for (const w of WEAPONS) ALL_EQUIPMENT[w.id] = { ...w, slot: EQUIP_SLOT.WEAPON };
for (const a of ARMORS) ALL_EQUIPMENT[a.id] = { ...a, slot: EQUIP_SLOT.ARMOR };
for (const a of ARTIFACTS) ALL_EQUIPMENT[a.id] = { ...a, slot: EQUIP_SLOT.ARTIFACT };

// Filtered pools
export const MAGICAL_ITEMS = [...WEAPONS.filter(w => w.magical), ...ARMORS.filter(a => a.magical), ...ARTIFACTS];
export const NON_MAGICAL_ITEMS = [...WEAPONS.filter(w => !w.magical), ...ARMORS.filter(a => !a.magical)];

// ---- Skills ----
export const SKILL_TARGET = {
    SELF: 'self',
    MELEE: 'melee',       // must be adjacent
    RANGED: 'ranged',     // pick hex within range
    AOE_SELF: 'aoe_self', // centered on self
    TELEPORT: 'teleport'  // pick any visible hex in range
};

export const SKILLS = {
    restore: {
        id: 'restore', name: 'Restore', cost: 0, target: SKILL_TARGET.AOE_SELF,
        desc: 'Restore shattered terrain. Gain 1 AE. Ends turn. Range: 1 + Lv/3.', minLevel: 0
    },
    void_strike: {
        id: 'void_strike', name: 'Void Strike', cost: 1, target: SKILL_TARGET.MELEE,
        desc: 'Melee attack: weapon + Might + Warding. No counter-attack.', minLevel: 1
    },
    phase_step: {
        id: 'phase_step', name: 'Phase Step', cost: 2, target: SKILL_TARGET.TELEPORT,
        range: 3, desc: 'Teleport to visible hex within 3. Free action.', minLevel: 2, freeAction: true
    },
    cosmic_bolt: {
        id: 'cosmic_bolt', name: 'Cosmic Bolt', cost: 2, target: SKILL_TARGET.RANGED,
        range: 4, baseDamage: 8, desc: 'Ranged: 8 + Warding damage.', minLevel: 2
    },
    warp_shield: {
        id: 'warp_shield', name: 'Warp Shield', cost: 2, target: SKILL_TARGET.SELF,
        duration: 3, desc: 'Absorb next hit. Lasts 3 turns.', minLevel: 4
    },
    breach_pulse: {
        id: 'breach_pulse', name: 'Breach Pulse', cost: 3, target: SKILL_TARGET.AOE_SELF,
        range: 2, baseDamage: 5, desc: 'AoE: 5 + Warding to enemies within 2.', minLevel: 4
    },
    mending_light: {
        id: 'mending_light', name: 'Mending Light', cost: 2, target: SKILL_TARGET.SELF,
        baseHeal: 10, desc: 'Heal 10 + Vigor*3 HP.', minLevel: 6
    },
    gravity_well: {
        id: 'gravity_well', name: 'Gravity Well', cost: 3, target: SKILL_TARGET.AOE_SELF,
        range: 3, desc: 'Pull enemies within 3 one hex closer.', minLevel: 6
    },
    dimensional_rend: {
        id: 'dimensional_rend', name: 'Dimensional Rend', cost: 4, target: SKILL_TARGET.MELEE,
        desc: 'Melee: weapon damage * 3. Must be adjacent.', minLevel: 8
    },
    starfall: {
        id: 'starfall', name: 'Starfall', cost: 5, target: SKILL_TARGET.AOE_SELF,
        range: 3, baseDamage: 15, desc: 'AoE: 15 + Warding*2 to enemies within 3.', minLevel: 10
    }
};

// Levels at which skill choices are offered
export const SKILL_UNLOCK_LEVELS = [2, 4, 6, 8, 10];
