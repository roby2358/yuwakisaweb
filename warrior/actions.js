// Player action classes — extracted from index.js so the core game logic
// (move / melee / ranged / skill / move-and-attack) can be exercised
// independently of the rendering and input layer.
//
// Each Action subclass takes a ctx in its constructor. The ctx must provide:
//   live state (live refs via getters):
//     player, world, em, victory, sound, reachable
//   combat callbacks (stay in index.js):
//     dealDamageToEnemy, dealDamageToPlayer, killEnemy, gainXP,
//     enemyDefense, enemyMeleeAttack
//   orchestration callbacks:
//     logCombat, refreshVision, checkHexEntry, centerOn,
//     closeBreach, endGame, offerSettlementReward,
//     showDialog, showOnceDialog, showSkillChoiceDialog, showLevelUpDialog
//   selection / movement helpers:
//     deselectPlayer, refreshSelectionAfterAction, playerMoveCost
//   module-level state setters:
//     setCombatAlerted, setThreatOverlay
//   misc:
//     playerTerrain   (function returning current hex terrain)

import {
    POI, ENEMY_TYPE, TERRAIN, STARTING_STATS, CROP_ICONS,
    SKILLS, effectiveSkill, UNSHATTERED_VERSION, UNDISTRESSED_VERSION, DISTRESSED_VERSION,
    isChaosTerrain, weaponIsRanged
} from './config.js';
import { hexKey, hexNeighbors, hexDistance, hexesInRange } from './hex.js';
import { Rando } from './rando.js';

// ================================================================
// Pure helpers — no ctx needed
// ================================================================

// MP cost tiers: 0 (free), 1 (natural melee), 2 (ranged), 'all' (zeroes MP).
// 'free_action' magical affix forces 0 regardless of weapon type.
export function weaponMpCost(wep) {
    if (!wep) return 1;
    if (wep.special === 'free_action') return 0;
    if (wep.mpCost !== undefined) return wep.mpCost;
    return weaponIsRanged(wep) ? 2 : 1;
}

export function skillMpCost(skill) {
    return skill.mpCost === undefined ? 'all' : skill.mpCost;
}

// True when the held weapon's type matches a weapon-flow skill's class, so the
// skill flows through it (affixes, range, MP floor). Neutral skills (no
// weaponClass) and type mismatches never match — those act as-is.
export function skillWeaponMatches(player, skill) {
    const cls = skill.weaponClass;
    if (!cls) return false;
    const wep = player.weapon();
    if (!wep) return false;
    return cls === 'ranged' ? weaponIsRanged(wep) : !weaponIsRanged(wep);
}

// Weapon-flow skills pay max(skill MP, weapon MP) when a matching weapon is
// held; neutral skills and mismatches pay the skill's own MP. 'all' stays 'all'.
export function effectiveSkillMpCost(player, skill) {
    const base = skillMpCost(skill);
    if (base === 'all' || !skillWeaponMatches(player, skill)) return base;
    return Math.max(base, weaponMpCost(player.weapon()));
}

function mpLabel(cost) {
    return cost === 'all' ? 'All MP' : `${cost} MP`;
}

export function skillMpLabel(skill) {
    return mpLabel(skillMpCost(skill));
}

export function effectiveAetherCost(player, skill) {
    const cost = skill.cost - player.sumEquipped('aether_discount', 'aetherDiscount');
    return Math.max(0, cost);
}

export function skillCostLabel(skill, player) {
    return `${effectiveAetherCost(player, skill)} AE, ${mpLabel(effectiveSkillMpCost(player, skill))}`;
}

// Weapon damage a weapon-flow skill adds: the held weapon's damage only when
// its type matches the skill's class; otherwise the skill acts unarmed (1).
function matchedWeaponDamage(player, skill) {
    return skillWeaponMatches(player, skill) ? player.weapon().damage : 1;
}

// Push target one hex away from source along the closest hex direction.
function knockbackHex(fromQ, fromR, targetQ, targetR) {
    const dq = targetQ - fromQ, dr = targetR - fromR;
    const dirs = [
        { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
        { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];
    let best = dirs[0], bestDot = -Infinity;
    for (const d of dirs) {
        const dot = d.q * dq + d.r * dr;
        if (dot > bestDot) { bestDot = dot; best = d; }
    }
    return { q: targetQ + best.q, r: targetR + best.r };
}

// ================================================================
// Action base — ctx is injected; shared combat helpers live here.
// ================================================================

export class Action {
    constructor(ctx) { this.ctx = ctx; }

    execute() { throw new Error('Action.execute() must be implemented'); }

    spendMP(cost) {
        const player = this.ctx.player;
        if (cost === 'all') player.mp = 0;
        else player.mp = Math.max(0, player.mp - cost);
    }

    spendWeaponMP() {
        this.spendMP(weaponMpCost(this.ctx.player.weapon()));
    }

    // Adjusted base damage from equipment passives (Breach Jewel, Aether Signet,
    // Chaos Attune). Mutates player.aether for Aether Signet.
    applyEquipmentBonusDamage(baseDmg) {
        const { player, world, logCombat, playerTerrain } = this.ctx;
        let dmg = baseDmg;
        const breachBonus = player.sumEquipped('breach_jewel', 'breachBonus');
        if (breachBonus) {
            const near = world.pois.some(p => (p.type === POI.BREACH || p.type === POI.MAW) && hexDistance(player.q, player.r, p.q, p.r) <= 3);
            if (near) { dmg += breachBonus; logCombat(`Breach Jewel: +${breachBonus} might!`, 'log-info'); }
        }
        const signet = player.equipped('aether_signet');
        if (signet && player.aether >= player.maxAether()) {
            dmg += signet.aetherSignetDamage;
            player.aether -= signet.aetherSignetCost;
            logCombat(`Aether Signet: +${signet.aetherSignetDamage} dmg!`, 'log-info');
        }
        if (isChaosTerrain(playerTerrain())) dmg += player.sumEquipped('chaos_attune', 'chaosAttuneMight');
        return dmg;
    }

    // Runs before the damage calc. Shred mutates enemy.defReduction in place
    // so the current hit benefits; pierce is returned as a per-hit modifier
    // the caller merges into the dealDamageToEnemy opts.
    applyPreHitEffects(wep, enemy) {
        if (!wep) return {};
        if (wep.special === 'defense_shred') {
            enemy.defReduction = (enemy.defReduction || 0) + wep.shredAmount;
            this.ctx.logCombat(`Shreds ${wep.shredAmount} defense!`, 'log-info');
        }
        if (wep.special === 'armor_pierce') return { pierceAmount: wep.pierceAmount };
        return {};
    }

    // Apply weapon on-hit effects after a strike. Lifesteal/siphon/channel fire
    // regardless of kill; burn/knockback only mark the enemy if it's still alive.
    applyOnHitEffects(wep, enemy) {
        if (!wep) return;
        const { player, em, world, logCombat, endGame } = this.ctx;

        if (wep.special === 'lifesteal') {
            const heal = wep.lifestealAmount;
            player.hp = Math.min(player.maxHP(), player.hp + heal);
            logCombat(`+${heal} HP (lifesteal)`, 'log-heal');
        }
        if (wep.special === 'aether_siphon') {
            player.aether = Math.min(player.maxAether(), player.aether + wep.siphonAmount);
            logCombat(`+${wep.siphonAmount} AE (siphon)`, 'log-info');
        }
        if (wep.special === 'channel') {
            player.hp -= wep.channelDamage;
            logCombat(`Channel: ${wep.channelDamage} dmg to you`, 'log-dmg');
            if (player.hp <= 0) { player.hp = 0; endGame(false); }
        }

        if (enemy.hp <= 0) return;

        if (wep.special === 'burn') {
            enemy.burnDamage = (enemy.burnDamage || 0) + wep.burnDamage;
            logCombat(`${em.getDef(enemy.type).name} is burning!`, 'log-dmg');
        }
        if (wep.special === 'knockback') {
            const dest = knockbackHex(player.q, player.r, enemy.q, enemy.r);
            const hex = world.getHex(dest.q, dest.r);
            const occupied = em.enemies.some(e => e.q === dest.q && e.r === dest.r);
            if (hex && world.isPassable(hex) && !occupied && !(dest.q === player.q && dest.r === player.r)) {
                enemy.q = dest.q;
                enemy.r = dest.r;
                logCombat(`Knocked back!`, 'log-info');
            }
        }
    }

    // Nearest enemy within bounceRange of (q,r) that isn't in hitSet, else null.
    nearestUnhit(q, r, bounceRange, hitSet) {
        const { em } = this.ctx;
        let closest = null, closestDist = Infinity;
        for (const enemy of em.enemies) {
            if (hitSet.has(enemy)) continue;
            const d = hexDistance(q, r, enemy.q, enemy.r);
            if (d <= bounceRange && d < closestDist) { closestDist = d; closest = enemy; }
        }
        return closest;
    }

    // --- Multi-target affix traversal (shared by damage strikes and Loot) ---

    // Ordered enemies a bounce affix reaches: hop from `primary` to the nearest
    // not-yet-seen enemy within `bounceRange`, up to `bounceCount` hops.
    chainTargets(primary, bounceCount, bounceRange) {
        const seen = new Set([primary]);
        const targets = [];
        let q = primary.q, r = primary.r;
        for (let i = 0; i < bounceCount; i++) {
            const next = this.nearestUnhit(q, r, bounceRange, seen);
            if (!next) break;
            seen.add(next);
            targets.push(next);
            q = next.q; r = next.r;
        }
        return targets;
    }

    // Enemies on hexes adjacent to (q, r), excluding `exclude`.
    adjacentEnemies(q, r, exclude) {
        const { em } = this.ctx;
        const result = [];
        for (const n of hexNeighbors(q, r)) {
            const adj = em.enemies.find(e => e.q === n.q && e.r === n.r && e !== exclude);
            if (adj) result.push(adj);
        }
        return result;
    }

    // The extra enemies a melee multi-target affix reaches from `primary`.
    // One targeting dispatch shared by WeaponStrike (damage) and Loot (theft).
    meleeAffixTargets(weapon, primary) {
        if (weapon.special === 'chain' || weapon.special === 'reverberate') return this.chainTargets(primary, weapon.chainCount, 2);
        if (weapon.special === 'cleave') return this.adjacentEnemies(primary.q, primary.r, primary);
        if (weapon.special === 'sweep') return this.adjacentEnemies(this.ctx.player.q, this.ctx.player.r, primary).slice(0, weapon.sweepCount);
        return [];
    }

    // Bounce damage hex-to-hex with raw (no bellCurve) damage minus flat
    // defense. Per-jump bonus stacks each hop. Used by Chain Lightning, where
    // the skill's primary roll already happened. Weapon chain/reverberate now
    // route through WeaponStrike/RangedStrike and don't use this helper.
    chainBounceRaw(skillName, dmg, startQ, startR, bounceCount, bounceRange, hitSet, perJumpBonus, stunBucket) {
        const { em, sound, logCombat, killEnemy, enemyDefense, rollPlayerStun } = this.ctx;
        let curQ = startQ, curR = startR;
        for (let i = 0; i < bounceCount; i++) {
            dmg += perJumpBonus;
            const closest = this.nearestUnhit(curQ, curR, bounceRange, hitSet);
            if (!closest) break;
            hitSet.add(closest);
            const closestDef = em.getDef(closest.type);
            const eDef = enemyDefense(closest, closestDef);
            const actualDmg = Math.max(1, dmg - eDef);
            closest.hp -= actualDmg;
            logCombat(`${skillName} chain: ${actualDmg} dmg to ${closestDef.name}`, 'log-dmg');
            sound.hitEnemy();
            rollPlayerStun(closest, dmg, stunBucket, 0);
            if (closest.hp <= 0) killEnemy(closest);
            curQ = closest.q; curR = closest.r;
        }
    }

    pushEnemyAway(enemy, fromQ, fromR) {
        const { player, world, em } = this.ctx;
        const dest = knockbackHex(fromQ, fromR, enemy.q, enemy.r);
        const hex = world.getHex(dest.q, dest.r);
        const occupied = em.enemies.some(e => e !== enemy && e.q === dest.q && e.r === dest.r);
        if (hex && world.isPassable(hex) && !occupied && !(dest.q === player.q && dest.r === player.r)) {
            enemy.q = dest.q;
            enemy.r = dest.r;
        }
    }

}

// Base for weapon-driven strikes. Two-phase: Phase 1 collects all targets
// (primary + affix-driven secondaries) into entries. Phase 2 applies each
// entry uniformly — pre-hit, N damage hits, post-hit — so post-hit effects
// (burn, lifesteal, knockback, shred) fire on every target the strike
// touches, not just the primary. Subclasses define affix-specific target
// collection. Options: { hitCount, suppressWeaponMulti, bypassDefense }.
class Strike {
    constructor(action, baseDmg, sourceName, stunBucket, options) {
        this.action = action;
        this.ctx = action.ctx;
        this.baseDmg = baseDmg;
        this.sourceName = sourceName;
        this.stunBucket = stunBucket;
        this.options = options || {};
        this.hitTargets = new Set();
    }

    apply(enemy) {
        this.primary = enemy;
        this.wep = this.ctx.player.weapon();
        // Affixes apply only when the weapon's type matches this strike's class.
        this.matched = this.weaponMatches();
        this.totalDealt = 0;
        this.setupDamage();
        for (const entry of this.collectTargets()) this.applyEntry(entry);
        return this.primaryResult;
    }

    // Override per subclass: whether the held weapon's type matches this
    // strike's class (melee/ranged). Base = false (neutral, no weapon flow).
    weaponMatches() { return false; }

    setupDamage() {
        this.dmg = this.action.applyEquipmentBonusDamage(this.baseDmg);
    }

    collectTargets() {
        const entries = [this.primaryEntry()];
        if (this.matched && !this.options.suppressWeaponMulti) this.appendWeaponAffixes(entries);
        if (this.options.skillChain) this.appendSkillChain(entries);
        if (this.options.skillSweep) this.appendSweep(entries, this.options.skillSweep);
        return entries;
    }

    primaryEntry() {
        return {
            target: this.primary,
            hitCount: this.options.hitCount ?? (this.matched ? this.weaponPrimaryHitCount() : 1),
            label: this.sourceName,
            dmg: this.dmg
        };
    }

    secondaryEntry(target, label) {
        return { target, hitCount: 1, label, dmg: this.dmg };
    }

    appendSkillChain(entries) {
        const sc = this.options.skillChain;
        this.appendChain(entries, sc.label, sc.bounceCount, sc.bounceRange, sc.perJumpBonus || 0);
    }

    // Sweep: strike up to `count` enemies ringing the player. Primary target is
    // excluded by the neighbor lookup, so primary + count = count+1 total. Shared
    // by the weapon `sweep` affix and the Sweep skill.
    appendSweep(entries, count) {
        const { player } = this.ctx;
        let remaining = count;
        for (const adj of this.neighborEnemiesOf(player.q, player.r)) {
            if (remaining <= 0) break;
            entries.push(this.secondaryEntry(adj, 'Sweep'));
            remaining--;
        }
    }

    // Override per subclass: returns primary-hit count from weapon affix.
    weaponPrimaryHitCount() { return 1; }

    // Override per subclass: push affix-driven secondaries onto entries.
    appendWeaponAffixes(entries) {}

    // Override per subclass: whether this strike bypasses enemy defense.
    ignoreDefense() { return false; }

    applyEntry(entry) {
        if (this.hitTargets.has(entry.target)) return;
        this.hitTargets.add(entry.target);
        if (this.options.skillShred) {
            entry.target.defReduction = (entry.target.defReduction || 0) + this.options.skillShred;
            this.ctx.logCombat(`Sundered ${this.options.skillShred} defense!`, 'log-info');
        }
        const opts = this.buildOpts(entry.target);
        const result = this.deliverDamage(entry, opts);
        this.action.applyOnHitEffects(this.matched ? this.wep : null, entry.target);
        if (this.options.skillBurn && entry.target.hp > 0) {
            entry.target.burnDamage = (entry.target.burnDamage || 0) + this.options.skillBurn;
            this.ctx.logCombat(`${this.ctx.em.getDef(entry.target.type).name} is burning!`, 'log-dmg');
        }
        if (entry.target === this.primary) this.primaryResult = result;
    }

    buildOpts(target) {
        const opts = { stunBucket: this.stunBucket, ...this.action.applyPreHitEffects(this.matched ? this.wep : null, target) };
        if (this.ignoreDefense()) opts.ignoreDefense = true;
        if (this.options.skillStun) opts.stunBonus = this.options.skillStun;
        return opts;
    }

    deliverDamage(entry, opts) {
        const { dealDamageToEnemy } = this.ctx;
        const numbered = entry.hitCount > 1;
        let result = null;
        for (let i = 1; i <= entry.hitCount; i++) {
            if (entry.target.hp <= 0) break;
            const label = numbered ? `${entry.label} ${i}` : entry.label;
            result = dealDamageToEnemy(entry.target, entry.dmg, label, opts);
            this.totalDealt += result.dealt;
        }
        return result;
    }

    // Public: apply a single ad-hoc secondary hit on a target. Reuses the same
    // pre/post effect chain so callers can extend a strike beyond its affixes.
    hitSecondary(target, label) {
        this.applyEntry(this.secondaryEntry(target, label));
    }

    // Helper: enemies adjacent to a hex, excluding the primary target. Used by
    // cleave / splash (around the target) and sweep (around the player).
    neighborEnemiesOf(q, r) {
        return this.action.adjacentEnemies(q, r, this.primary);
    }

    neighborEnemies() { return this.neighborEnemiesOf(this.primary.q, this.primary.r); }

    // Helper: trace and append a chain bounce sequence. Each bounce becomes
    // its own entry with optional per-jump damage bonus (reverberate).
    appendChain(entries, label, bounceCount, bounceRange, perJumpBonus) {
        let dmg = this.dmg;
        for (const target of this.action.chainTargets(this.primary, bounceCount, bounceRange)) {
            dmg += perJumpBonus;
            entries.push({ target, hitCount: 1, label: `${label} bounce`, dmg });
        }
    }
}

// Per-affix label for the secondary entries a melee multi-target affix spawns.
const MELEE_AFFIX_LABEL = { chain: 'Chain bounce', reverberate: 'Reverberate bounce', cleave: 'Cleave', sweep: 'Sweep' };

// Melee weapon strike: chain/reverberate, cleave/sweep, double/triple_strike.
export class WeaponStrike extends Strike {
    weaponMatches() { return !!(this.wep && !weaponIsRanged(this.wep)); }

    weaponPrimaryHitCount() {
        if (this.wep.special === 'double_strike') return 2;
        if (this.wep.special === 'triple_strike') return 3;
        return 1;
    }

    appendWeaponAffixes(entries) {
        const label = MELEE_AFFIX_LABEL[this.wep.special];
        const perJump = this.wep.special === 'reverberate' ? this.wep.chainBonus : 0;
        let dmg = this.dmg;
        for (const target of this.action.meleeAffixTargets(this.wep, this.primary)) {
            dmg += perJump;
            entries.push({ target, hitCount: 1, label, dmg });
        }
    }
}

// Ranged weapon strike: chain/reverberate, splash, piercing line, double/
// triple_shot, sniper at max range, ignore_defense (skill or affix). Sniper
// adds to primary damage during setup so it rides on every entry's dmg.
export class RangedStrike extends Strike {
    weaponMatches() { return !!(this.wep && weaponIsRanged(this.wep)); }

    setupDamage() {
        const { player, logCombat } = this.ctx;
        this.dist = hexDistance(player.q, player.r, this.primary.q, this.primary.r);
        let dmg = this.action.applyEquipmentBonusDamage(this.baseDmg);
        if (this.matched && this.wep.special === 'sniper' && this.dist >= this.wep.range) {
            dmg += this.wep.sniperBonus;
            logCombat(`Sniper: +${this.wep.sniperBonus} at max range`, 'log-info');
        }
        this.dmg = dmg;
    }

    ignoreDefense() {
        return Boolean(this.options.bypassDefense) || (this.matched && this.wep.special === 'ignore_defense');
    }

    weaponPrimaryHitCount() {
        if (this.wep.special === 'double_shot') return 2;
        if (this.wep.special === 'triple_shot') return 3;
        return 1;
    }

    appendWeaponAffixes(entries) {
        if (this.wep.special === 'chain') {
            this.appendChain(entries, 'Chain', this.wep.chainCount, 2, 0);
        } else if (this.wep.special === 'reverberate') {
            this.appendChain(entries, 'Reverberate', this.wep.chainCount, 2, this.wep.chainBonus);
        } else if (this.wep.special === 'splash') {
            for (const adj of this.neighborEnemies()) entries.push(this.secondaryEntry(adj, 'Splash'));
        } else if (this.wep.special === 'piercing') {
            this.appendPiercingLine(entries);
        }
    }

    // Piercing affix: walk past primary in the same direction, hex by hex,
    // until we hit one more enemy or run out of range / hit a mountain.
    appendPiercingLine(entries) {
        const { em, world, player } = this.ctx;
        const kb = knockbackHex(player.q, player.r, this.primary.q, this.primary.r);
        const dq = kb.q - this.primary.q, dr = kb.r - this.primary.r;
        for (let i = 1; i <= this.wep.range - this.dist; i++) {
            const pq = this.primary.q + dq * i, pr = this.primary.r + dr * i;
            const target = em.enemies.find(e => e.q === pq && e.r === pr);
            if (target) {
                entries.push(this.secondaryEntry(target, 'Pierce'));
                return;
            }
            const hex = world.getHex(pq, pr);
            if (!hex || hex.terrain === TERRAIN.MOUNTAIN) return;
        }
    }
}

// ================================================================
// MoveAction — walk to a hex (cost pre-resolved by caller)
// ================================================================

export class MoveAction extends Action {
    constructor(ctx, q, r, cost) {
        super(ctx);
        this.q = q;
        this.r = r;
        this.cost = cost;
    }

    execute() {
        const { player, victory, sound, refreshVision, checkHexEntry, deselectPlayer } = this.ctx;
        victory.distanceTraveled += hexDistance(player.q, player.r, this.q, this.r);
        player.q = this.q;
        player.r = this.r;
        player.mp -= this.cost;
        player.movedThisTurn = true;
        sound.tick();
        player.hexesMovedThisTurn += this.cost;
        refreshVision();
        checkHexEntry();
        deselectPlayer();
    }
}

// ================================================================
// MeleeAction — strike an adjacent enemy. Includes weapon MP spend.
// Returns { killed }.
// ================================================================

export class MeleeAction extends Action {
    constructor(ctx, enemy) {
        super(ctx);
        this.enemy = enemy;
    }

    execute() {
        const ctx = this.ctx;
        const { player, em, dealDamageToPlayer, enemyMeleeAttack } = ctx;
        ctx.setCombatAlerted(true);
        const enemy = this.enemy;

        const baseDmg = player.meleeDamage(em.getDef(enemy.type).chaosSpawned);
        const { killed } = new WeaponStrike(this, baseDmg, 'Melee', 'primary').apply(enemy);

        if (!killed && !enemy.stunnedNextTurn) {
            const wep = player.weapon();
            const def = em.getDef(enemy.type);
            let counterDmg = enemyMeleeAttack(enemy, def);
            if (wep && wep.special === 'riposte') counterDmg = Math.floor(counterDmg / 2);
            const deflect = player.equipped('counter_deflect');
            if (deflect) counterDmg = Math.floor(counterDmg * (100 - deflect.counterDeflect) / 100);
            dealDamageToPlayer(counterDmg, `${def.name} counters`, false, { attacker: enemy });
        }

        this.spendWeaponMP();
        return { killed };
    }
}

// ================================================================
// RangedAction — fire weapon at distant enemy. Includes weapon MP spend
// and the per-shot aether tax for magical ranged weapons.
// ================================================================

export class RangedAction extends Action {
    constructor(ctx, targetQ, targetR) {
        super(ctx);
        this.targetQ = targetQ;
        this.targetR = targetR;
    }

    execute() {
        const ctx = this.ctx;
        const { player, em, refreshSelectionAfterAction } = ctx;
        ctx.setCombatAlerted(true);

        const enemy = em.enemies.find(e => e.q === this.targetQ && e.r === this.targetR);
        if (!enemy) return;
        const dist = hexDistance(player.q, player.r, this.targetQ, this.targetR);
        const baseDmg = player.rangedDamage(dist, em.getDef(enemy.type).chaosSpawned);

        new RangedStrike(this, baseDmg, 'Ranged', 'other').apply(enemy);

        // Magical ranged costs 1 aether by default; heavy variant doubles it.
        // free_ranged and channel bypass entirely.
        const wep = player.weapon();
        if (wep && wep.magical && wep.special !== 'free_ranged' && wep.special !== 'channel') {
            player.aether = Math.max(0, player.aether - (wep.aetherCost || 1));
        }
        this.spendWeaponMP();
        refreshSelectionAfterAction();
    }
}

// ================================================================
// MoveAndAttackAction — composite: walk into range and strike.
// Handles the Blink Ring magical-teleport variant up front, otherwise
// finds the cheapest adjacent hex via the caller-supplied `reachable` map.
// ================================================================

export class MoveAndAttackAction extends Action {
    constructor(ctx, enemyQ, enemyR) {
        super(ctx);
        this.enemyQ = enemyQ;
        this.enemyR = enemyR;
    }

    execute() {
        const ctx = this.ctx;
        const { player, world, em, logCombat, refreshVision, checkHexEntry, refreshSelectionAfterAction, playerMoveCost, reachable } = ctx;
        const enemy = em.enemies.find(e => e.q === this.enemyQ && e.r === this.enemyR);
        if (!enemy) return;

        // Blink Ring branch: teleport adjacent and swing with bonus might.
        const blink = player.equipped('blink_ring');
        if (blink) {
            const dist = hexDistance(player.q, player.r, this.enemyQ, this.enemyR);
            if (dist > 1 && dist <= blink.blinkRange) {
                const adj = hexNeighbors(this.enemyQ, this.enemyR).filter(n => {
                    const h = world.getHex(n.q, n.r);
                    if (!h || !world.isPassable(h)) return false;
                    if (em.enemies.some(e => e.q === n.q && e.r === n.r)) return false;
                    return true;
                });
                if (adj.length > 0) {
                    const dest = Rando.choice(adj);
                    player.q = dest.q;
                    player.r = dest.r;
                    player.movedThisTurn = true;
                    refreshVision();
                    logCombat(`Blink Ring: teleported!`, 'log-info');
                    const origMight = player.stats.might;
                    player.stats.might += blink.blinkBonus;
                    const { killed } = new MeleeAction(ctx, enemy).execute();
                    player.stats.might = origMight;
                    if (killed) {
                        const hex = world.getHex(this.enemyQ, this.enemyR);
                        if (hex && world.isPassable(hex)) {
                            player.q = this.enemyQ; player.r = this.enemyR;
                            refreshVision();
                            checkHexEntry();
                        }
                    }
                    refreshSelectionAfterAction();
                    return;
                }
            }
        }

        // Find cheapest adjacent hex via reachability
        let bestHex = null, bestCost = Infinity;
        if (hexDistance(player.q, player.r, this.enemyQ, this.enemyR) === 1) {
            bestHex = { q: player.q, r: player.r };
            bestCost = 0;
        } else {
            for (const n of hexNeighbors(this.enemyQ, this.enemyR)) {
                const cost = reachable ? reachable.get(hexKey(n.q, n.r)) : undefined;
                if (cost !== undefined && cost < bestCost) { bestCost = cost; bestHex = n; }
            }
        }
        if (!bestHex) return;

        if (bestCost > 0) {
            player.q = bestHex.q;
            player.r = bestHex.r;
            player.mp -= bestCost;
            player.movedThisTurn = true;
            player.hexesMovedThisTurn += bestCost;
            refreshVision();
        }

        const { killed } = new MeleeAction(ctx, enemy).execute();
        if (killed) {
            const hex = world.getHex(this.enemyQ, this.enemyR);
            if (hex && world.isPassable(hex)) {
                const moveCost = playerMoveCost(hex);
                if (player.mp >= moveCost) {
                    player.q = this.enemyQ;
                    player.r = this.enemyR;
                    player.mp -= moveCost;
                    refreshVision();
                    checkHexEntry();
                }
            }
        }

        refreshSelectionAfterAction();
    }
}

// ================================================================
// SkillAction — dispatches to per-skill handler functions.
// Skill-specific helpers (abort, AoE, restoration) live here as methods.
// Handler signature: (action) => false | undefined; return false to skip
// the MP spend (early-exit aborts, or persistent overlays like Ground Weeps).
// ================================================================

export class SkillAction extends Action {
    constructor(ctx, skillId, targetQ, targetR) {
        super(ctx);
        this.skillId = skillId;
        // Resolve to this skill's current tier so every handler reads scaled
        // values (damage, range, counts) through action.skill transparently.
        this.skill = effectiveSkill(SKILLS[skillId], ctx.player.rankOf(skillId));
        this.targetQ = targetQ;
        this.targetR = targetR;
    }

    execute() {
        const ctx = this.ctx;
        const { player, logCombat } = ctx;
        if (!this.skill) return;
        const cost = effectiveAetherCost(player, this.skill);
        if (player.aether < cost) { logCombat('Not enough Aether!', 'log-info'); return; }

        const handler = SKILL_HANDLERS[this.skillId];
        if (!handler) return;

        this.aetherSpent = cost;
        player.aether -= cost;
        ctx.setCombatAlerted(true);

        const result = handler(this);
        if (result !== false) this.spendMP(effectiveSkillMpCost(player, this.skill));
    }

    abortSkill(message) {
        if (message) this.ctx.logCombat(message, 'log-info');
        return false;
    }

    abortSkillWithRefund(message) {
        if (message) this.ctx.logCombat(message, 'log-info');
        this.ctx.player.aether += this.aetherSpent || 0;
        return false;
    }

    applyAoeDamage(skillName, dmg, range, stunBucket) {
        const { player, em, dealDamageToEnemy } = this.ctx;
        for (const h of hexesInRange(player.q, player.r, range)) {
            const enemy = em.enemyAt(h.q, h.r);
            if (enemy) dealDamageToEnemy(enemy, dmg, skillName, { stunBucket });
        }
    }

    applyAoeDamageAt(skillName, dmg, centerQ, centerR, range, stunBucket) {
        const { em, dealDamageToEnemy } = this.ctx;
        for (const h of hexesInRange(centerQ, centerR, range)) {
            const enemy = em.enemyAt(h.q, h.r);
            if (enemy) dealDamageToEnemy(enemy, dmg, skillName, { stunBucket });
        }
    }

    // Restore shattered hexes; decrement nearby shatteredCount; revert distressed
    // hexes whose count dropped to 0; distress restored hexes still near shatters.
    // Shared by Restore and Salvage.
    restoreShatteredHexes(hexes) {
        const { world } = this.ctx;
        for (const hex of hexes) {
            hex.terrain = UNSHATTERED_VERSION[hex.terrain];
        }
        for (const hex of hexes) {
            for (const coord of hexesInRange(hex.q, hex.r, 3)) {
                const h = world.getHex(coord.q, coord.r);
                if (h) h.shatteredCount = Math.max(0, h.shatteredCount - 1);
            }
        }
        const checked = new Set();
        for (const hex of hexes) {
            for (const coord of hexesInRange(hex.q, hex.r, 3)) {
                const key = hexKey(coord.q, coord.r);
                if (checked.has(key)) continue;
                checked.add(key);
                const h = world.getHex(coord.q, coord.r);
                if (!h) continue;
                if (h.shatteredCount === 0 && UNDISTRESSED_VERSION[h.terrain] !== undefined) {
                    h.terrain = UNDISTRESSED_VERSION[h.terrain];
                }
            }
            if (hex.shatteredCount > 0 && DISTRESSED_VERSION[hex.terrain] !== undefined) {
                hex.terrain = DISTRESSED_VERSION[hex.terrain];
            }
        }
    }
}

// ================================================================
// Skill handlers — one function per skill. Receive the SkillAction
// instance; access game state via action.ctx and the skill via action.skill.
// ================================================================

// ---- Combat skills (anytime) ----

function executeRestore(action) {
    const { player, world, em, victory, logCombat, gainXP, closeBreach, offerSettlementReward, showDialog, showOnceDialog } = action.ctx;
    const skill = action.skill;
    const range = 1 + Math.floor(player.level / 3);
    const shatteredHexes = hexesInRange(player.q, player.r, range)
        .map(h => world.getHex(h.q, h.r))
        .filter(h => h && UNSHATTERED_VERSION[h.terrain] !== undefined);
    const unravelerAlive = em.enemies.find(e => e.type === ENEMY_TYPE.UNRAVELER);
    const openBreach = world.pois.find(p => p.type === POI.BREACH && !p.closed);
    const breachInRange = world.pois.find(p =>
        (p.type === POI.BREACH || (p.type === POI.MAW && !unravelerAlive && !openBreach)) &&
        p.guardianDefeated && !p.closed &&
        hexDistance(player.q, player.r, p.q, p.r) <= range
    );
    const mawInRange = world.pois.find(p =>
        p.type === POI.MAW && !p.closed &&
        hexDistance(player.q, player.r, p.q, p.r) <= range
    );
    if (mawInRange && unravelerAlive) {
        showOnceDialog('mawBlockedByUnraveler', 'The Maw Resists',
            '<p>The Maw seethes with chaos and refuses to close. The Unraveler must be defeated first before the Maw can be sealed.</p>',
            [{ label: 'OK', cls: 'btn-primary' }]);
    } else if (mawInRange && openBreach) {
        for (const p of world.pois) {
            if (p.type === POI.BREACH && !p.closed) world.revealed.add(hexKey(p.q, p.r));
        }
        showOnceDialog('mawBlockedByBreaches', 'The Maw Hungers',
            '<p>Open breaches still feed the Maw. Seal every breach before the Maw can be closed.</p><p>The remaining breaches reveal themselves on your map.</p>',
            [{ label: 'OK', cls: 'btn-primary' }]);
    }
    if (shatteredHexes.length === 0 && !breachInRange) {
        return action.abortSkill('No shattered terrain in range!');
    }
    action.restoreShatteredHexes(shatteredHexes);
    player.aether = Math.min(player.maxAether(), player.aether + 1);
    let goldFound = 0;
    for (let i = 0; i < shatteredHexes.length; i++) {
        if (Rando.bool(0.16)) goldFound++;
    }
    if (goldFound > 0) { player.gold += goldFound; victory.goldCollected += goldFound; }
    victory.hexesRestored += shatteredHexes.length;
    if (shatteredHexes.length > 0) {
        gainXP(shatteredHexes.length * 3);
        let msg = `Restored ${shatteredHexes.length} hex${shatteredHexes.length > 1 ? 'es' : ''}! +1 AE`;
        if (goldFound > 0) msg += `, +${goldFound}g`;
        logCombat(msg, 'log-heal');
        offerSettlementReward(shatteredHexes);
    }
    if (breachInRange) {
        const chance = breachInRange.type === POI.MAW ? 0.20 : 0.40;
        if (Rando.bool(chance)) {
            closeBreach(breachInRange);
        } else {
            showDialog('Restore', 'Restore did not close the breach.', [{ label: 'OK', cls: 'btn-primary' }]);
        }
    }
}

function executeVoidStrike(action) {
    const { player, em } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const base = matchedWeaponDamage(player, action.skill) + player.stats.might + player.stats.warding;
    const dmg = Math.round(base * action.skill.effectStrength / 5);
    new WeaponStrike(action, dmg, 'Void Strike', 'primary').apply(enemy);
}

function executePhaseStep(action) {
    const { player, refreshVision, checkHexEntry, logCombat } = action.ctx;
    player.q = action.targetQ;
    player.r = action.targetR;
    player.phaseStepUsedThisTurn = true;
    refreshVision();
    logCombat('Phase Step!', 'log-info');
    checkHexEntry();
}

function executeWaterSkip(action) {
    const { player, refreshVision, checkHexEntry, logCombat } = action.ctx;
    player.q = action.targetQ;
    player.r = action.targetR;
    refreshVision();
    logCombat('Water Skip!', 'log-info');
    checkHexEntry();
}

function executeMountainSkip(action) {
    const { player, refreshVision, checkHexEntry, logCombat } = action.ctx;
    player.q = action.targetQ;
    player.r = action.targetR;
    refreshVision();
    logCombat('Mountain Skip!', 'log-info');
    checkHexEntry();
}

function executeCosmicBolt(action) {
    const { player, em, dealDamageToEnemy } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    dealDamageToEnemy(enemy, action.skill.baseDamage + player.stats.warding, 'Cosmic Bolt', { stunBucket: 'other' });
}

function executeShockwave(action) {
    const { player, em, logCombat, dealDamageToEnemy } = action.ctx;
    const skill = action.skill;
    const dmg = skill.baseDamage + player.stats.might;
    const survivors = [];
    for (const h of hexesInRange(player.q, player.r, skill.range)) {
        const enemy = em.enemyAt(h.q, h.r);
        if (!enemy) continue;
        dealDamageToEnemy(enemy, dmg, 'Shockwave', { stunBucket: 'primary' });
        if (enemy.hp > 0) survivors.push(enemy);
    }
    for (const enemy of survivors) action.pushEnemyAway(enemy, player.q, player.r);
    logCombat('Shockwave!', 'log-info');
}

function executeSiphonStrike(action) {
    const { player, em, logCombat } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const base = matchedWeaponDamage(player, action.skill) + player.stats.might;
    const dmg = Math.round(base * action.skill.effectStrength / 10);
    const strike = new WeaponStrike(action, dmg, 'Siphon Strike', 'primary');
    strike.apply(enemy);
    if (strike.totalDealt > 0) {
        player.hp = Math.min(player.maxHP(), player.hp + strike.totalDealt);
        logCombat(`+${strike.totalDealt} HP (siphon)`, 'log-heal');
    }
}

function executePiercingShot(action) {
    const { player, em } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const dmg = action.skill.baseDamage + player.stats.reflex;
    new RangedStrike(action, dmg, 'Penetrating Shot', 'other', { bypassDefense: true }).apply(enemy);
}

function executeWarpShield(action) {
    const { player, logCombat } = action.ctx;
    player.warpShieldTurns = action.skill.duration;
    logCombat('Warp Shield active!', 'log-info');
}

function executeReflect(action) {
    const { player, logCombat } = action.ctx;
    player.reflectTurns = action.skill.duration;
    logCombat('Reflect stance!', 'log-info');
}

function executeChannel(action) {
    const { player, logCombat } = action.ctx;
    const aeDeficit = player.maxAether() - player.aether;
    if (aeDeficit <= 0) {
        logCombat('Channel Aether: already at max AE.', 'log-info');
        return;
    }
    const ratio = action.skill.effectStrength;
    const hpLost = Math.min(aeDeficit * ratio, Math.floor(player.hp / 2));
    const aeGain = Math.max(1, Math.floor(hpLost / ratio));
    player.hp -= hpLost;
    player.aether = Math.min(player.maxAether(), player.aether + aeGain);
    logCombat(`Channel Aether: -${hpLost} HP, +${aeGain} AE`, 'log-info');
}

function executeBreachPulse(action) {
    const { player } = action.ctx;
    action.applyAoeDamage('Breach Pulse', action.skill.baseDamage + player.stats.warding, action.skill.range, 'other');
}

function executeChainLightning(action) {
    const { player, em, dealDamageToEnemy } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const skill = action.skill;
    const dmg = skill.baseDamage + player.stats.warding;
    dealDamageToEnemy(enemy, dmg, 'Chain Lightning', { stunBucket: 'other' });
    action.chainBounceRaw('Chain Lightning', dmg, action.targetQ, action.targetR, skill.hitCount, skill.effectStrength, new Set([enemy]), 0, 'other');
}

// Melee weapon skill: weapon + Might to the targeted enemy, carrying one
// strike option (burn/shred/sweep/stun). Skills never provoke counters.
function mightWeaponSkill(action, label, options) {
    const { player, em } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const dmg = matchedWeaponDamage(player, action.skill) + player.stats.might;
    new WeaponStrike(action, dmg, label, 'primary', options).apply(enemy);
}

function executeImmolate(action) {
    mightWeaponSkill(action, 'Immolate', { skillBurn: action.skill.effectStrength });
}

function executeSweep(action) {
    mightWeaponSkill(action, 'Sweep', { skillSweep: action.skill.hitCount });
}

function executeStunBlow(action) {
    mightWeaponSkill(action, 'Stun', { skillStun: action.skill.effectStrength });
}

function executeMendingLight(action) {
    const { player, logCombat } = action.ctx;
    const heal = action.skill.effectStrength + player.stats.vigor * 3;
    player.hp = Math.min(player.maxHP(), player.hp + heal);
    logCombat(`Healed ${heal} HP`, 'log-heal');
}

function executeGravityWell(action) {
    const { player, world, em, logCombat } = action.ctx;
    for (const h of hexesInRange(player.q, player.r, action.skill.range)) {
        const enemy = em.enemyAt(h.q, h.r);
        if (!enemy) continue;
        let closest = null, closestDist = Infinity;
        for (const n of hexNeighbors(enemy.q, enemy.r)) {
            const d = hexDistance(n.q, n.r, player.q, player.r);
            const hex = world.getHex(n.q, n.r);
            if (!hex || !world.isPassable(hex)) continue;
            if (em.enemies.some(e2 => e2 !== enemy && e2.q === n.q && e2.r === n.r)) continue;
            if (n.q === player.q && n.r === player.r) continue;
            if (d < closestDist) { closestDist = d; closest = n; }
        }
        if (closest) { enemy.q = closest.q; enemy.r = closest.r; }
    }
    logCombat('Gravity Well!', 'log-info');
}

function executeSunderingBlow(action) {
    mightWeaponSkill(action, 'Shredding Blow', { skillShred: action.skill.effectStrength });
}

function executeMeteor(action) {
    const { player, logCombat } = action.ctx;
    const dmg = action.skill.baseDamage + player.stats.warding;
    action.applyAoeDamageAt('Meteor', dmg, action.targetQ, action.targetR, action.skill.effectStrength, 'other');
    logCombat('Meteor!', 'log-info');
}

function executeDimensionalRend(action) {
    const { player, em, logCombat } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const hpCost = action.skill.hpCost;
    const tooLow = player.hp <= hpCost;
    player.hp -= hpCost;
    logCombat(`Dimensional Rend tears at you: -${hpCost} HP`, 'log-dmg');
    if (tooLow) {
        logCombat('Health too low — the rift fizzles.', 'log-info');
        return;
    }
    const dmg = Math.round(matchedWeaponDamage(player, action.skill) * action.skill.effectStrength / 10);
    new WeaponStrike(action, dmg, 'Dimensional Rend', 'other').apply(enemy);
}

function executeExecute(action) {
    const { player, em } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const base = matchedWeaponDamage(player, action.skill) + player.stats.might;
    const dmg = Math.round(base * action.skill.effectStrength / 10);
    new WeaponStrike(action, dmg, 'Execute', 'primary').apply(enemy);
}

function executeRicochet(action) {
    const { player, em } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const skill = action.skill;
    const dmg = skill.baseDamage + player.stats.reflex;
    new RangedStrike(action, dmg, 'Ricochet', 'other', {
        suppressWeaponMulti: true,
        skillChain: { label: 'Ricochet', bounceCount: skill.hitCount, bounceRange: skill.effectStrength }
    }).apply(enemy);
}

function executeStarfall(action) {
    const { player } = action.ctx;
    action.applyAoeDamage('Starfall', action.skill.baseDamage + player.stats.warding * 2, action.skill.range, 'other');
}

function executeVoidSalvo(action) {
    const { player, em } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const dmg = action.skill.baseDamage + player.stats.reflex;
    new RangedStrike(action, dmg, 'Salvo', 'other', { hitCount: action.skill.hitCount, suppressWeaponMulti: true }).apply(enemy);
}

function executeRecall(action) {
    const { player, world, refreshVision, centerOn, logCombat } = action.ctx;
    const havens = world.havens();
    if (havens.length === 0) return action.abortSkillWithRefund('No havens exist!');
    let nearest = havens[0], nearestDist = Infinity;
    for (const h of havens) {
        const d = hexDistance(player.q, player.r, h.q, h.r);
        if (d < nearestDist) { nearestDist = d; nearest = h; }
    }
    player.q = nearest.q;
    player.r = nearest.r;
    refreshVision();
    centerOn({ q: player.q, r: player.r });
    logCombat(`Recall! Teleported to haven.`, 'log-info');
}

// ---- Non-combat skills ----

function executeAetherTap(action) {
    const { player, world, logCombat } = action.ctx;
    let cleanCount = 0;
    for (const h of hexesInRange(player.q, player.r, action.skill.range)) {
        const hex = world.getHex(h.q, h.r);
        if (!hex) continue;
        const isWaterOrMountain = hex.terrain === TERRAIN.WATER || hex.terrain === TERRAIN.MOUNTAIN;
        if (!isWaterOrMountain) {
            if (!world.isPassable(hex)) continue;
            if (UNSHATTERED_VERSION[hex.terrain] !== undefined) continue;
            if (UNDISTRESSED_VERSION[hex.terrain] !== undefined) continue;
        }
        cleanCount++;
    }
    const aeGain = 1 + Math.floor(cleanCount / 3);
    player.aether = Math.min(player.maxAether(), player.aether + aeGain);
    logCombat(`Aether Tap: +${aeGain} AE (${cleanCount} clean hexes)`, 'log-info');
}

function executeFarsight(action) {
    const { player, world, logCombat } = action.ctx;
    const farRange = action.skill.range || 12;
    for (const h of hexesInRange(player.q, player.r, farRange)) {
        const key = hexKey(h.q, h.r);
        if (world.hexes.has(key)) {
            world.revealed.add(key);
            world.visible.add(key);
        }
    }
    logCombat('Farsight! Vision expanded.', 'log-info');
}

function executeProspect(action) {
    const { player, world, logCombat } = action.ctx;
    let revealed = 0;
    for (const h of hexesInRange(player.q, player.r, action.skill.range)) {
        const hex = world.getHex(h.q, h.r);
        if (hex && hex.goldDeposit > 0) {
            const key = hexKey(h.q, h.r);
            if (!world.revealed.has(key)) revealed++;
            world.revealed.add(key);
        }
    }
    if (Rando.bool(0.2)) {
        const candidates = hexesInRange(player.q, player.r, 4)
            .map(h => world.getHex(h.q, h.r))
            .filter(h => h && world.isPassable(h) && h.goldDeposit === 0);
        if (candidates.length > 0) {
            const target = Rando.choice(candidates);
            target.goldDeposit = 10;
            world.revealed.add(hexKey(target.q, target.r));
            logCombat('Struck gold nearby!', 'log-gold');
        }
    }
    if (revealed > 0) logCombat(`Prospect: revealed ${revealed} gold deposit${revealed > 1 ? 's' : ''}`, 'log-gold');
    else logCombat('Prospect: sensed the earth.', 'log-info');
}

function executeCommune(action) {
    const { player, world, logCombat } = action.ctx;
    const range = action.skill.range;
    let poiCount = 0;
    for (const poi of world.pois) {
        if (hexDistance(player.q, player.r, poi.q, poi.r) > range) continue;
        const key = hexKey(poi.q, poi.r);
        if (!world.revealed.has(key)) poiCount++;
        world.revealed.add(key);
    }
    if (poiCount > 0) logCombat(`Commune: revealed ${poiCount} location${poiCount > 1 ? 's' : ''}!`, 'log-info');
    else logCombat('Commune: the world has no more secrets.', 'log-info');
}

function executeSalvage(action) {
    const { player, world, logCombat } = action.ctx;
    const salvageHexes = hexesInRange(player.q, player.r, action.skill.range)
        .map(h => world.getHex(h.q, h.r))
        .filter(h => h && UNSHATTERED_VERSION[h.terrain] !== undefined);
    if (salvageHexes.length === 0) {
        return action.abortSkill('No shattered terrain nearby to salvage!');
    }
    action.restoreShatteredHexes(salvageHexes);
    let totalGold = 0;
    for (const hex of salvageHexes) {
        const gold = Rando.int(1, 10);
        hex.goldDeposit = (hex.goldDeposit || 0) + gold;
        totalGold += gold;
    }
    logCombat(`Salvage: restored ${salvageHexes.length} hex${salvageHexes.length > 1 ? 'es' : ''}, ${totalGold}g in deposits!`, 'log-gold');
}

function executeSkillSeek(action) {
    const { player, logCombat, showSkillChoiceDialog } = action.ctx;
    const chance = action.skill.effectStrength / 100;
    if (Rando.bool(chance)) {
        logCombat('Insight! A new skill reveals itself!', 'log-info');
        player.pendingSkillChoice = true;
        setTimeout(() => showSkillChoiceDialog(), 300);
    } else {
        logCombat('The patterns elude you...', 'log-info');
    }
}

function executeSpiritWalk(action) {
    const { player, refreshVision, checkHexEntry, logCombat } = action.ctx;
    player.q = action.targetQ;
    player.r = action.targetR;
    refreshVision();
    logCombat('Spirit Walk!', 'log-info');
    checkHexEntry();
}

// Threat overlay persists until dismissed; turn stays alive (no MP spent),
// and the skill can be re-used after dismiss.
function executeGroundWeeps(action) {
    const { world, em, logCombat, enemyMeleeAttack, setThreatOverlay, player } = action.ctx;
    const overlay = new Map();
    for (const [key, hex] of world.hexes) {
        if (hex.isEdge) continue;
        let threat = 0;
        for (const enemy of em.enemies) {
            const d = hexDistance(hex.q, hex.r, enemy.q, enemy.r);
            if (d <= 3) {
                const def = em.getDef(enemy.type);
                threat += enemyMeleeAttack(enemy, def) * (4 - d) / 3;
            }
        }
        if (threat > 0) overlay.set(key, threat);
    }
    setThreatOverlay(overlay);
    logCombat('The ground weeps... threats revealed.', 'log-info');
    return false;
}

function executeRespec(action) {
    const { player, logCombat, showLevelUpDialog } = action.ctx;
    const stats = ['might', 'reflex', 'warding', 'vigor'];
    let refund = 0;
    for (const s of stats) {
        refund += player.stats[s] - STARTING_STATS[s];
        player.stats[s] = STARTING_STATS[s];
    }
    player.statPoints += refund;
    player.hp = Math.min(player.hp, player.maxHP());
    player.aether = Math.min(player.aether, player.maxAether());
    logCombat(`Retrain: ${refund} stat points refunded.`, 'log-info');
    setTimeout(() => showLevelUpDialog(), 100);
}

function executeSanctuary(action) {
    const { player, world } = action.ctx;
    if (world.poiAt(player.q, player.r)) {
        return action.abortSkillWithRefund('Cannot sanctify — already a point of interest!');
    }
    // Conjure the village, rest, and end turn — all in one cast (handled in index.js
    // so it can pop the dialog and reuse the village rest flow).
    action.ctx.invokeSanctuary();
}

// ---- Special combat skills ----

function executeLoot(action) {
    const { player, em, victory, logCombat } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    // Chain/cleave/sweep weapon affixes extend the grab to nearby enemies,
    // each robbed for up to its own might (same roll as the primary target).
    const targets = [enemy, ...action.meleeAffixTargets(player.weapon(), enemy)];
    const mult = action.skill.effectStrength / 10;
    let total = 0;
    for (const target of targets) {
        const goldStolen = Rando.int(0, Math.floor(em.getDef(target.type).attack * mult));
        player.gold += goldStolen;
        victory.goldCollected += goldStolen;
        total += goldStolen;
    }
    const suffix = targets.length > 1 ? ` from ${targets.length} enemies` : '';
    logCombat(`Looted ${total}g${suffix}!`, 'log-gold');
}

function executeHavensLight(action) {
    const { player, world, em, logCombat, dealDamageToEnemy } = action.ctx;
    const skill = action.skill;
    const poi = world.poiAt(player.q, player.r);
    if (!poi || (poi.type !== POI.HAVEN && poi.type !== POI.VILLAGE)) {
        return action.abortSkillWithRefund('Must be at a haven or village!');
    }
    const dmg = skill.baseDamage + player.stats.warding;
    let hitCount = 0;
    for (const h of hexesInRange(player.q, player.r, skill.range)) {
        const enemy = em.enemyAt(h.q, h.r);
        if (!enemy) continue;
        dealDamageToEnemy(enemy, dmg, "Haven's Light", { stunBucket: 'other' });
        hitCount++;
    }
    logCombat(`Haven's Light: hit ${hitCount} enemies!`, 'log-info');
}

// ---- Peaceful skills ----

function executeAetherBlast(action) {
    const { player, em, logCombat } = action.ctx;
    const skill = action.skill;
    let hits = 0;
    for (const h of hexesInRange(player.q, player.r, skill.range)) {
        if (em.enemyAt(h.q, h.r)) hits++;
    }
    action.applyAoeDamage('Aether Blast', skill.baseDamage + Math.floor(player.stats.warding / 2), skill.range, 'other');
    if (hits > 0) {
        const gained = hits * skill.aetherPerHit;
        player.aether = Math.min(player.maxAether(), player.aether + gained);
        logCombat(`+${gained} AE (${hits} hit)`, 'log-info');
    }
}

function executeLifedrainBlast(action) {
    const { player, em, logCombat } = action.ctx;
    const skill = action.skill;
    let hits = 0;
    for (const h of hexesInRange(player.q, player.r, skill.range)) {
        if (em.enemyAt(h.q, h.r)) hits++;
    }
    action.applyAoeDamage('Lifedrain Blast', skill.baseDamage + player.stats.vigor, skill.range, 'primary');
    if (hits > 0) {
        const healed = hits * skill.hpPerHit;
        player.hp = Math.min(player.maxHP(), player.hp + healed);
        logCombat(`+${healed} HP (${hits} hit)`, 'log-heal');
    }
}

function executeGarrison(action) {
    const { player, world, logCombat } = action.ctx;
    const skill = action.skill;
    if (player.gold < skill.goldCost) {
        return action.abortSkillWithRefund(`Need ${skill.goldCost}g to commission a garrison.`);
    }
    if (world.poiAt(player.q, player.r)) {
        return action.abortSkillWithRefund('Cannot build on an existing point of interest.');
    }
    const hex = world.getHex(player.q, player.r);
    if (!hex || !world.isPassable(hex)) {
        return action.abortSkillWithRefund('Cannot build here.');
    }
    const hasNearbySettlement = world.pois.some(p =>
        (p.type === POI.HAVEN || p.type === POI.VILLAGE) && world.visible.has(hexKey(p.q, p.r))
    );
    if (!hasNearbySettlement) {
        return action.abortSkillWithRefund('A haven or village must be in sight to commission a garrison.');
    }
    player.gold -= skill.goldCost;
    const poi = { q: player.q, r: player.r, type: POI.GARRISON_BUILD, id: world.pois.length };
    world.pois.push(poi);
    hex.poi = POI.GARRISON_BUILD;
    logCombat('Garrison commissioned. Construction underway.', 'log-info');
}

function executeBountifulHarvest(action) {
    const { player, world, logCombat } = action.ctx;
    let crops = 0;
    for (const h of hexesInRange(player.q, player.r, action.skill.range)) {
        const hex = world.getHex(h.q, h.r);
        if (!hex || !world.isPassable(hex) || hex.goldDeposit > 0) continue;
        if (UNSHATTERED_VERSION[hex.terrain] !== undefined) continue;
        if (UNDISTRESSED_VERSION[hex.terrain] !== undefined) continue;
        hex.goldDeposit = Rando.int(1, 3);
        hex.crop = Rando.choice(CROP_ICONS);
        crops++;
    }
    if (crops > 0) logCombat(`Bountiful Harvest: ${crops} crop${crops > 1 ? 's' : ''} sprouted!`, 'log-gold');
    else logCombat('No suitable ground for crops.', 'log-info');
}

const SKILL_HANDLERS = {
    restore: executeRestore,
    void_strike: executeVoidStrike,
    phase_step: executePhaseStep,
    water_skip: executeWaterSkip,
    mountain_skip: executeMountainSkip,
    cosmic_bolt: executeCosmicBolt,
    shockwave: executeShockwave,
    siphon_strike: executeSiphonStrike,
    piercing_shot: executePiercingShot,
    warp_shield: executeWarpShield,
    reflect: executeReflect,
    channel: executeChannel,
    breach_pulse: executeBreachPulse,
    chain_lightning: executeChainLightning,
    immolate: executeImmolate,
    sweep: executeSweep,
    stun_blow: executeStunBlow,
    mending_light: executeMendingLight,
    gravity_well: executeGravityWell,
    sundering_blow: executeSunderingBlow,
    meteor: executeMeteor,
    dimensional_rend: executeDimensionalRend,
    execute: executeExecute,
    ricochet: executeRicochet,
    starfall: executeStarfall,
    void_salvo: executeVoidSalvo,
    recall: executeRecall,
    aether_tap: executeAetherTap,
    farsight: executeFarsight,
    prospect: executeProspect,
    commune: executeCommune,
    salvage: executeSalvage,
    skill_seek: executeSkillSeek,
    spirit_walk: executeSpiritWalk,
    ground_weeps: executeGroundWeeps,
    respec: executeRespec,
    sanctuary: executeSanctuary,
    loot: executeLoot,
    havens_light: executeHavensLight,
    aether_blast: executeAetherBlast,
    lifedrain_blast: executeLifedrainBlast,
    bountiful_harvest: executeBountifulHarvest,
    garrison: executeGarrison,
};
