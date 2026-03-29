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
    MAW: 'maw',
    HUT: 'hut'
};

export const POI_DEFENSE_BONUS = {
    [POI.HAVEN]: 3,
    [POI.CAMP]: 2
};

export const POI_SYMBOLS = {
    [POI.HAVEN]: '\u{1F3F0}', // 🏰 castle
    [POI.CAMP]: '\u26FA',    // ⛺ tent
    [POI.RUIN]: '\u26EB',    // ⛫ castle ruins
    [POI.BREACH]: '\u058D',  // ֍ swirl
    [POI.MAW]: '\u2738',     // ✸ pulsing star
    [POI.HUT]: '\u2302'      // ⌂ house
};

export const POI_COLORS = {
    [POI.HAVEN]: '#4fc3f7',
    [POI.CAMP]: '#ffb74d',
    [POI.RUIN]: '#b0bec5',
    [POI.BREACH]: '#e040fb',
    [POI.MAW]: '#ff1744',
    [POI.HUT]: '#d4a574'
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
        name: 'Phase Wraith', label: 'W', hp: 10, attack: 5, defense: 1,
        speed: 2, detectRange: 4, xp: 25, gold: 3, behavior: 'teleport',
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
    { id: 'duskfang', name: 'Duskfang', type: 'melee', damage: 4, range: 0, special: 'lifesteal', lifestealAmount: 2, price: 35, tier: 1, magical: true },
    { id: 'breaker_mace', name: 'Breaker Mace', type: 'melee', damage: 3, range: 0, special: 'armor_pierce', pierceAmount: 2, price: 30, tier: 1, magical: true },
    { id: 'wardens_blade', name: "Warden's Blade", type: 'melee', damage: 6, range: 0, special: 'riposte', price: 60, tier: 2, magical: true },
    { id: 'emberstrike', name: 'Emberstrike', type: 'melee', damage: 8, range: 0, special: 'momentum', momentumBonus: 4, price: 75, tier: 2, magical: true },
    { id: 'soulreaver', name: 'Soulreaver', type: 'melee', damage: 7, range: 0, special: 'aether_siphon', price: 70, tier: 2, magical: true },
    { id: 'nullblade', name: 'Nullblade', type: 'melee', damage: 9, range: 0, special: 'defense_shred', price: 110, tier: 3, magical: true },
    { id: 'worldsplitter', name: 'Worldsplitter', type: 'melee', damage: 14, range: 0, special: 'recoil', recoilDamage: 3, price: 130, tier: 3, magical: true },
    { id: 'flux_bow', name: 'Flux Bow', type: 'ranged', damage: 5, range: 3, special: 'armor_pierce', pierceAmount: 2, price: 35, tier: 1, magical: true },
    { id: 'phase_rifle', name: 'Phase Rifle', type: 'ranged', damage: 8, range: 5, special: 'ignore_defense', price: 120, tier: 3, magical: true },
    { id: 'aether_lance', name: 'Aether Lance', type: 'ranged', damage: 6, range: 3, special: 'free_ranged', price: 60, tier: 2, magical: true },
    { id: 'spark_caster', name: 'Spark Caster', type: 'ranged', damage: 3, range: 3, special: 'chain', chainDamage: 3, price: 30, tier: 1, magical: true },
    { id: 'gale_bow', name: 'Gale Bow', type: 'ranged', damage: 4, range: 3, special: 'knockback', price: 40, tier: 1, magical: true },
    { id: 'rift_cannon', name: 'Rift Cannon', type: 'ranged', damage: 6, range: 5, special: 'splash', splashDamage: 2, price: 55, tier: 2, magical: true },
    { id: 'voidpiercer', name: 'Voidpiercer', type: 'ranged', damage: 5, range: 4, special: 'piercing', price: 65, tier: 2, magical: true },
    { id: 'stasis_repeater', name: 'Stasis Repeater', type: 'ranged', damage: 4, range: 3, special: 'double_shot', price: 70, tier: 2, magical: true },
    { id: 'nova_launcher', name: 'Nova Launcher', type: 'ranged', damage: 7, range: 3, special: 'burn', burnDamage: 3, price: 100, tier: 3, magical: true },
    { id: 'astral_longbow', name: 'Astral Longbow', type: 'ranged', damage: 9, range: 5, special: 'sniper', sniperBonus: 4, price: 140, tier: 3, magical: true },
    // Mid-tier magical melee
    { id: 'flicker_blade', name: 'Flicker Blade', type: 'melee', damage: 2, range: 0, special: 'double_strike', price: 20, tier: 1, magical: true },
    { id: 'aether_spike', name: 'Aether Spike', type: 'melee', damage: 3, range: 0, special: 'aether_siphon', price: 25, tier: 1, magical: true },
    { id: 'blood_thorn', name: 'Blood Thorn', type: 'melee', damage: 3, range: 0, special: 'lifesteal', lifestealAmount: 1, price: 25, tier: 1, magical: true },
    { id: 'rending_pick', name: 'Rending Pick', type: 'melee', damage: 4, range: 0, special: 'armor_pierce', pierceAmount: 2, price: 30, tier: 1, magical: true },
    { id: 'broad_cleaver', name: 'Broad Cleaver', type: 'melee', damage: 4, range: 0, special: 'cleave', price: 30, tier: 1, magical: true },
    { id: 'ember_blade', name: 'Ember Blade', type: 'melee', damage: 5, range: 0, special: 'burn', burnDamage: 2, price: 40, tier: 1, magical: true },
    // Mid-tier magical ranged
    { id: 'arc_caster', name: 'Arc Caster', type: 'ranged', damage: 2, range: 3, special: 'chain', chainDamage: 3, price: 20, tier: 1, magical: true },
    { id: 'pulse_bow', name: 'Pulse Bow', type: 'ranged', damage: 3, range: 3, special: 'double_shot', price: 25, tier: 1, magical: true },
    { id: 'ley_bow', name: 'Ley Bow', type: 'ranged', damage: 3, range: 3, special: 'free_ranged', price: 25, tier: 1, magical: true },
    { id: 'blast_rod', name: 'Blast Rod', type: 'ranged', damage: 4, range: 3, special: 'splash', splashDamage: 2, price: 35, tier: 1, magical: true },
    { id: 'hawk_bow', name: 'Hawk Bow', type: 'ranged', damage: 4, range: 5, special: 'sniper', sniperBonus: 2, price: 40, tier: 2, magical: true },
    { id: 'piercing_bolt', name: 'Piercing Bolt', type: 'ranged', damage: 5, range: 3, special: 'armor_pierce', pierceAmount: 2, price: 45, tier: 2, magical: true },
    // Non-magical melee
    { id: 'iron_sword', name: 'Iron Sword', type: 'melee', damage: 2, range: 0, special: null, price: 12, tier: 1, magical: false },
    { id: 'spear', name: 'Spear', type: 'melee', damage: 2, range: 0, special: null, price: 12, tier: 1, magical: false },
    { id: 'battle_axe', name: 'Battle Axe', type: 'melee', damage: 3, range: 0, special: null, price: 25, tier: 2, magical: false },
    { id: 'warhammer', name: 'Warhammer', type: 'melee', damage: 4, range: 0, special: null, price: 45, tier: 3, magical: false },
    { id: 'blade_spear', name: 'Blade Spear', type: 'melee', damage: 4, range: 0, special: null, price: 45, tier: 3, magical: false },
    { id: 'greatsword', name: 'Greatsword', type: 'melee', damage: 5, range: 0, special: null, price: 70, tier: 4, magical: false },
    // Non-magical bows
    { id: 'stick_bow', name: 'Stick Bow', type: 'ranged', damage: 1, range: 2, special: null, price: 0, tier: 0, magical: false },
    { id: 'short_bow', name: 'Short Bow', type: 'ranged', damage: 1, range: 2, special: null, price: 5, tier: 1, magical: false },
    { id: 'hunting_bow', name: 'Hunting Bow', type: 'ranged', damage: 2, range: 2, special: null, price: 12, tier: 1, magical: false },
    { id: 'crossbow', name: 'Crossbow', type: 'ranged', damage: 3, range: 3, special: null, price: 25, tier: 2, magical: false },
    { id: 'war_bow', name: 'War Bow', type: 'ranged', damage: 4, range: 3, special: null, price: 45, tier: 3, magical: false },
    { id: 'great_bow', name: 'Great Bow', type: 'ranged', damage: 5, range: 4, special: null, price: 70, tier: 4, magical: false }
];

export const ARMORS = [
    { id: 'worn_leather', name: 'Worn Leather', defense: 1, special: null, price: 0, tier: 0, magical: true },
    { id: 'warded_mail', name: 'Warded Mail', defense: 4, special: 'hp_bonus', hpBonus: 10, price: 50, tier: 1, magical: true },
    { id: 'chaosweave_cloak', name: 'Chaosweave Cloak', defense: 3, special: 'vision_bonus', visionBonus: 2, price: 45, tier: 1, magical: true },
    { id: 'starplate', name: 'Starplate', defense: 8, special: 'mp_penalty', mpPenalty: 1, price: 120, tier: 2, magical: true },
    { id: 'voidhide', name: 'Voidhide', defense: 5, special: 'wraith_immune', price: 100, tier: 3, magical: true },
    { id: 'thornmail', name: 'Thornmail', defense: 2, special: 'thorns', thornsDamage: 2, price: 35, tier: 1, magical: true },
    { id: 'flickerweave', name: 'Flickerweave', defense: 2, special: 'dodge_bonus', dodgeBonus: 30, price: 40, tier: 1, magical: true },
    { id: 'bloodward_cuirass', name: 'Bloodward Cuirass', defense: 4, special: 'heal_on_kill', healOnKill: 5, price: 65, tier: 2, magical: true },
    { id: 'stormplate', name: 'Stormplate', defense: 3, special: 'aether_regen', price: 80, tier: 2, magical: true },
    { id: 'wraithskin', name: 'Wraithskin', defense: 3, special: 'ranged_immune', price: 75, tier: 2, magical: true },
    { id: 'burning_mail', name: 'Burning Mail', defense: 4, special: 'burning_aura', burnAuraDamage: 3, price: 75, tier: 2, magical: true },
    { id: 'aegis_of_the_breach', name: 'Aegis of the Breach', defense: 6, special: 'last_stand', lastStandBonus: 2, price: 130, tier: 3, magical: true },
    // Mid-tier magical armor
    { id: 'scout_cloak', name: "Scout's Cloak", defense: 1, special: 'vision_bonus', visionBonus: 1, price: 15, tier: 1, magical: true },
    { id: 'runecloth_robe', name: 'Runecloth Robe', defense: 2, special: 'aether_regen', price: 30, tier: 1, magical: true },
    { id: 'padded_mail', name: 'Padded Mail', defense: 2, special: 'hp_bonus', hpBonus: 5, price: 25, tier: 1, magical: true },
    { id: 'lifeweave_tunic', name: 'Lifeweave Tunic', defense: 3, special: 'armor_regen', regenAmount: 1, price: 40, tier: 1, magical: true },
    { id: 'aether_vest', name: 'Aether Vest', defense: 3, special: 'armor_aether_bonus', aetherBonus: 5, price: 45, tier: 2, magical: true },
    { id: 'wardens_plate', name: "Warden's Plate", defense: 5, special: 'regen_combo', regenAmount: 1, price: 70, tier: 2, magical: true },
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
    { id: 'maw_compass', name: 'Maw Compass', special: 'reveal_maw', price: 30, tier: 1, magical: true },
    // Movement & defense artifacts
    { id: 'strider_boots', name: 'Strider Boots', special: 'strider', price: 55, tier: 2, magical: true },
    { id: 'smoke_cloak', name: 'Smoke Cloak', special: 'disengage', price: 65, tier: 2, magical: true },
    { id: 'momentum_bracers', name: 'Momentum Bracers', special: 'momentum_defense', price: 60, tier: 2, magical: true },
    { id: 'threat_shroud', name: 'Threat Shroud', special: 'threat_shroud', price: 40, tier: 1, magical: true },
    { id: 'ranger_cloak', name: 'Ranger Cloak', special: 'ranger_defense', rangerBonus: 3, price: 40, tier: 1, magical: true },
    { id: 'chaos_ward', name: 'Chaos Ward', special: 'chaos_defense', chaosDefenseBonus: 3, price: 50, tier: 2, magical: true },
    // Combat & resource artifacts
    { id: 'wall_crown', name: 'Wall Crown', special: 'wall_crown', wallCrownBonus: 4, price: 65, tier: 2, magical: true },
    { id: 'breach_jewel', name: 'Breach Jewel', special: 'breach_jewel', breachBonus: 5, price: 55, tier: 2, magical: true },
    { id: 'soul_harvest_sigil', name: 'Soul Harvest Sigil', special: 'soul_harvest', soulHarvestXP: 2, price: 70, tier: 2, magical: true },
    { id: 'opportunist_gloves', name: 'Opportunist Gloves', special: 'opportunist', price: 35, tier: 1, magical: true },
    { id: 'aether_signet', name: 'Aether Signet', special: 'aether_signet', aetherSignetDamage: 3, aetherSignetCost: 3, price: 80, tier: 3, magical: true },
    { id: 'chaos_circlet', name: 'Chaos Circlet', special: 'chaos_circlet', price: 55, tier: 2, magical: true },
    { id: 'aether_right', name: 'Aether Right', special: 'aether_regen_small', price: 45, tier: 1, magical: true },
    { id: 'aether_amulet', name: 'Aether Amulet', special: 'aether_regen_large', price: 85, tier: 3, magical: true },
    { id: 'blink_ring', name: 'Blink Ring', special: 'blink_ring', blinkRange: 4, blinkBonus: 2, price: 95, tier: 3, magical: true },
    { id: 'counter_bracers', name: 'Counter Bracers', special: 'counter_mastery', price: 70, tier: 2, magical: true },
    // Mid-tier artifacts
    { id: 'lesser_vitality_stone', name: 'Lesser Vitality Stone', special: 'regen', regenAmount: 2, price: 50, tier: 2, magical: true },
    { id: 'ranger_hood', name: 'Ranger Hood', special: 'ranger_defense', rangerBonus: 1, price: 25, tier: 1, magical: true },
    { id: 'chaos_sigil', name: 'Chaos Sigil', special: 'chaos_attune', chaosAttuneMight: 1, chaosAttuneDef: 1, price: 35, tier: 1, magical: true },
    { id: 'sentinels_crown', name: "Sentinel's Crown", special: 'wall_crown', wallCrownBonus: 2, price: 40, tier: 1, magical: true },
    { id: 'wayfarer_boots', name: 'Wayfarer Boots', special: 'mp_bonus', mpBonus: 1, price: 30, tier: 1, magical: true },
    { id: 'windrunner_boots', name: 'Windrunner Boots', special: 'mp_bonus', mpBonus: 3, price: 80, tier: 3, magical: true },
    { id: 'arrow_ward', name: 'Arrow Ward', special: 'ranged_immune', price: 45, tier: 2, magical: true }
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
        id: 'cosmic_bolt', name: 'Cosmic Bolt', cost: 2, target: SKILL_TARGET.RANGED, usage: SKILL_USAGE.ANYTIME,
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
        range: 1, desc: 'Create gold deposits on adjacent shattered hexes. Ends turn.', minLevel: 4
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
        desc: 'Current hex becomes a temporary camp (one rest). Must be non-POI terrain.', minLevel: 8
    },
    // ---- Special combat skills ----
    loot: {
        id: 'loot', name: 'Loot', cost: 0, target: SKILL_TARGET.MELEE, usage: SKILL_USAGE.ANYTIME,
        desc: 'Take 1-5 gold from adjacent enemy instead of dealing damage.', minLevel: 2
    },
    havens_light: {
        id: 'havens_light', name: "Haven's Light", cost: 3, target: SKILL_TARGET.AOE_SELF, usage: SKILL_USAGE.ANYTIME,
        range: 1, baseDamage: 20, desc: "AoE: strength 20 attack to all adjacent. Only usable at haven or camp.", minLevel: 6
    }
};

// Levels at which skill choices are offered
export const SKILL_UNLOCK_LEVELS = [2, 4, 6, 8, 10];
