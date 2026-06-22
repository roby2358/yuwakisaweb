// mechanics.js — The rules engine: health, status effects, skills, and attacks.
//
// Everything here mutates plain unit objects (see index.js for the unit shape). Behavior
// that varies by kind is routed through ONE dispatch table keyed on the discriminator —
// EFFECTS by skill template, ATTACK_EFFECTS by enemy damageType, TARGET_PREDICATE by
// template — so adding a variant is a single edit, never a scavenger hunt.


// ---- Status effects (one uniform representation, one tick) ----
// A status is { type, magnitude, turns, source }. addStatus refreshes same-type rather
// than stacking, keeping the player's mental model clean (a new ward replaces the old).

function addStatus(unit, status) {
    unit.statuses = unit.statuses.filter(s => s.type !== status.type);
    unit.statuses.push(status);
}

function hasStatus(unit, type) {
    return unit.statuses.some(s => s.type === type);
}

function removeStatusType(unit, type) {
    unit.statuses = unit.statuses.filter(s => s.type !== type);
}

// Per-turn tick: regen heals, poison damages, durations decay, expired effects drop.
// Poison bypasses armor and wards (it is already inside you — cleanse is the answer).
function tickStatuses(unit) {
    for (const s of unit.statuses) {
        if (s.type === 'regen' && unit.alive) unit.hp = Math.min(unit.maxHp, unit.hp + s.magnitude);
        if (s.type === 'poison' && unit.alive) damageHp(unit, s.magnitude);
        s.turns -= 1;
    }
    unit.statuses = unit.statuses.filter(s => s.turns > 0 && !(s.type === 'ward' && s.magnitude <= 0));
}

// ---- Damage ----
// Lower a unit's hp directly, downing it at 0. Used by poison and as the tail of applyDamage.
function damageHp(unit, amount) {
    unit.hp -= amount;
    if (unit.hp > 0) return;
    unit.hp = 0;
    unit.alive = false;
    unit.downedTurns = 0;
}

// Direct combat damage: armor reduces it (min 1), then wards absorb, then hp drops.
function applyDamage(unit, amount) {
    let dmg = Math.max(1, amount - unit.armor);
    for (const s of unit.statuses) {
        if (s.type !== 'ward' || dmg <= 0) continue;
        const absorbed = Math.min(s.magnitude, dmg);
        s.magnitude -= absorbed;
        dmg -= absorbed;
    }
    unit.statuses = unit.statuses.filter(s => !(s.type === 'ward' && s.magnitude <= 0));
    if (dmg > 0) damageHp(unit, dmg);
}

// A unit's current offense, after buffs and weaken debuffs.
function effectiveDamage(unit) {
    let d = unit.damage;
    for (const s of unit.statuses) {
        if (s.type === 'buff') d += s.magnitude;
        if (s.type === 'weaken') d -= s.magnitude;
    }
    return Math.max(1, d);
}

// ---- Skill effects (dispatch by template) ----
const EFFECTS = {
    heal:    (u, sk) => { u.hp = Math.min(u.maxHp, u.hp + sk.magnitude); },
    regen:   (u, sk) => addStatus(u, { type: 'regen', magnitude: sk.magnitude, turns: sk.duration, source: 'skill' }),
    ward:    (u, sk) => addStatus(u, { type: 'ward', magnitude: sk.magnitude, turns: sk.duration, source: 'skill' }),
    cleanse: (u) => removeStatusType(u, 'poison'),
    dispel:  (u) => removeStatusType(u, 'weaken'),
    buff:    (u, sk) => addStatus(u, { type: 'buff', magnitude: sk.magnitude, turns: sk.duration, source: 'skill' }),
    revive:  (u, sk) => { u.alive = true; u.hp = sk.magnitude; u.downedTurns = 0; },
};

// Which allies a skill may target, by template. Range is checked separately.
const TARGET_PREDICATE = {
    heal:    u => u.alive,
    regen:   u => u.alive,
    ward:    u => u.alive,
    buff:    u => u.alive,
    cleanse: u => u.alive && hasStatus(u, 'poison'),
    dispel:  u => u.alive && hasStatus(u, 'weaken'),
    revive:  u => !u.alive && !u.gone,
};

// Cast a skill whose chosen target is `center`. aoeRadius > 0 spreads the effect to all
// living allies within radius of the center; otherwise it hits the center alone.
function applySkill(skill, center, allies) {
    const targets = skill.aoeRadius > 0
        ? allies.filter(u => u.alive && new Hex(center.q, center.r).distance(u) <= skill.aoeRadius)
        : [center];
    const effect = EFFECTS[skill.template];
    for (const t of targets) effect(t, skill);
}

// Living allies a skill may legally target from the healer's position, given its range.
function validSkillTargets(skill, allies, healer) {
    const predicate = TARGET_PREDICATE[skill.template];
    const origin = new Hex(healer.q, healer.r);
    return allies.filter(u => predicate(u) && origin.distance(u) <= skill.range);
}

// ---- Enemy attacks (dispatch by damageType) ----
// melee/burst/magic all deal direct damage (they differ only in amount and the class's
// attackRange); dot applies poison; debuff applies weaken. The damage value is already
// tier-scaled on the enemy.
const ATTACK_EFFECTS = {
    melee:  (target, dmg) => applyDamage(target, dmg),
    burst:  (target, dmg) => applyDamage(target, dmg),
    magic:  (target, dmg) => applyDamage(target, dmg),
    dot:    (target, dmg) => addStatus(target, { type: 'poison', magnitude: dmg, turns: 3, source: 'enemy' }),
    debuff: (target, dmg) => addStatus(target, { type: 'weaken', magnitude: dmg, turns: 3, source: 'enemy' }),
};

function enemyAttack(enemy, target) {
    ATTACK_EFFECTS[enemy.damageType](target, enemy.damage);
}

// A free "attack of opportunity": when a unit breaks out of a hostile's zone of control, that
// hostile gets one unanswered strike on it. Dispatched by the striker's kind — an enemy uses its
// damageType attack, a party member its melee damage. The healer has no offense and is absent
// from the table, so it walls enemies (ZOC) but never lands a disengagement strike.
const OPPORTUNITY_STRIKE = {
    enemy: (attacker, victim) => enemyAttack(attacker, victim),
    party: (attacker, victim) => applyDamage(victim, effectiveDamage(attacker)),
};

function opportunityStrike(attacker, victim) {
    const strike = OPPORTUNITY_STRIKE[attacker.kind];
    if (strike) strike(attacker, victim);
}
