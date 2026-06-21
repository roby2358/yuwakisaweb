// content.js — Game content as data tables.
//
// Per DYNAMICS.md "template, don't snowflake": every party class, enemy class, and skill
// is a parameter set, not a code path. Behavior lives in mechanics.js (dispatch by
// template / damageType); this file is pure data the rules engine and renderer read.

// ---- Party classes ----
// One leader (Warden) the others follow; followers vary by role. `attackRange` lets the
// Archer strike from afar — a mechanical exception, not a stat delta. Counter colors are
// NOT defined here: they come from a per-game ColorTheory scheme assigned at spawn
// (see index.js), so the class is read from the `label`, the palette from ColorTheory.
const PARTY_CLASSES = [
    { cls: 'warden', name: 'Warden', role: 'leader',   label: 'W', maxHp: 26, armor: 3, damage: 5, attackRange: 1 },
    { cls: 'blade',  name: 'Blade',  role: 'follower', label: 'B', maxHp: 16, armor: 0, damage: 8, attackRange: 1 },
    { cls: 'archer', name: 'Archer', role: 'follower', label: 'A', maxHp: 14, armor: 0, damage: 6, attackRange: 3 },
    { cls: 'hunter', name: 'Hunter', role: 'follower', label: 'H', maxHp: 18, armor: 1, damage: 6, attackRange: 1 },
];

// ---- Enemy classes ----
// `damageType` selects the attack effect (mechanics.ATTACK_EFFECTS): melee/burst/magic
// deal direct damage (differing only in amount and `attackRange`), dot applies poison,
// debuff applies weaken. `weight` drives the spawn mix. Counter colors come from a
// per-game ColorTheory scheme assigned at spawn, not from this table.
const ENEMY_CLASSES = [
    { cls: 'grunt',  name: 'Grunt',  label: 'g', baseHp: 10, baseDamage: 4, damageType: 'melee',  attackRange: 1, weight: 5 },
    { cls: 'brute',  name: 'Brute',  label: 'B', baseHp: 22, baseDamage: 9, damageType: 'burst',  attackRange: 1, weight: 2 },
    { cls: 'rotter', name: 'Rotter', label: 'r', baseHp: 12, baseDamage: 3, damageType: 'dot',    attackRange: 1, weight: 2 },
    { cls: 'hexer',  name: 'Hexer',  label: 'h', baseHp: 10, baseDamage: 3, damageType: 'debuff', attackRange: 1, weight: 2 },
    { cls: 'caster', name: 'Caster', label: 'c', baseHp: 9,  baseDamage: 5, damageType: 'magic',  attackRange: 3, weight: 2 },
];

// ---- Skills ----
// `template` selects the effect (mechanics.EFFECTS). `aoeRadius > 0` makes any skill a
// group skill (applies its effect to allies within radius of the target). `tier` gates
// the skill behind reputation. Order here is the skill-bar order.
const SKILLS = [
    { id: 'mend',    name: 'Mend',    template: 'heal',    tier: 1, aetherCost: 2, range: 4, aoeRadius: 0, magnitude: 8,  duration: 0, cooldown: 0 },
    { id: 'aegis',   name: 'Aegis',   template: 'ward',    tier: 1, aetherCost: 3, range: 4, aoeRadius: 0, magnitude: 10, duration: 3, cooldown: 0 },
    { id: 'purify',  name: 'Purify',  template: 'cleanse', tier: 1, aetherCost: 2, range: 4, aoeRadius: 0, magnitude: 0,  duration: 0, cooldown: 0 },
    { id: 'renewal', name: 'Renewal', template: 'regen',   tier: 2, aetherCost: 3, range: 4, aoeRadius: 0, magnitude: 4,  duration: 4, cooldown: 0 },
    { id: 'hymn',    name: 'Hymn',    template: 'heal',    tier: 2, aetherCost: 5, range: 3, aoeRadius: 2, magnitude: 6,  duration: 0, cooldown: 1 },
    { id: 'dispel',  name: 'Dispel',  template: 'dispel',  tier: 2, aetherCost: 2, range: 4, aoeRadius: 0, magnitude: 0,  duration: 0, cooldown: 0 },
    { id: 'bless',   name: 'Bless',   template: 'buff',    tier: 3, aetherCost: 3, range: 4, aoeRadius: 0, magnitude: 4,  duration: 3, cooldown: 1 },
    { id: 'raise',   name: 'Raise',   template: 'revive',  tier: 3, aetherCost: 6, range: 2, aoeRadius: 0, magnitude: 10, duration: 0, cooldown: 3 },
];

// Status-dot colors for the renderer.
const STATUS_COLORS = {
    regen:  '#4caf50',
    ward:   '#4a90d9',
    poison: '#9b59b6',
    weaken: '#e67e22',
    buff:   '#f1c40f',
};
