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
    SKILLS, UNSHATTERED_VERSION, UNDISTRESSED_VERSION, DISTRESSED_VERSION,
    isChaosTerrain
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
    return wep.type === 'ranged' ? 2 : 1;
}

export function skillMpCost(skill) {
    return skill.mpCost === undefined ? 'all' : skill.mpCost;
}

export function skillMpLabel(skill) {
    const c = skillMpCost(skill);
    return c === 'all' ? 'All MP' : `${c} MP`;
}

export function effectiveAetherCost(player, skill) {
    const disc = player.equipped('aether_discount');
    const cost = skill.cost - (disc ? disc.aetherDiscount : 0);
    return Math.max(0, cost);
}

export function skillCostLabel(skill, player) {
    return `${effectiveAetherCost(player, skill)} AE, ${skillMpLabel(skill)}`;
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
        const breach = player.equipped('breach_jewel');
        if (breach) {
            const near = world.pois.some(p => (p.type === POI.BREACH || p.type === POI.MAW) && hexDistance(player.q, player.r, p.q, p.r) <= 3);
            if (near) { dmg += breach.breachBonus; logCombat(`Breach Jewel: +${breach.breachBonus} might!`, 'log-info'); }
        }
        const signet = player.equipped('aether_signet');
        if (signet && player.aether >= player.maxAether()) {
            dmg += signet.aetherSignetDamage;
            player.aether -= signet.aetherSignetCost;
            logCombat(`Aether Signet: +${signet.aetherSignetDamage} dmg!`, 'log-info');
        }
        const attune = player.equipped('chaos_attune');
        if (attune && isChaosTerrain(playerTerrain())) dmg += attune.chaosAttuneMight;
        return dmg;
    }

    // Apply weapon on-hit effects after a strike. Lifesteal/siphon/channel fire
    // regardless of kill; shred/burn only mark the enemy if it's still alive.
    applyOnHitEffects(wep, enemy) {
        if (!wep) return;
        const { player, em, logCombat, endGame } = this.ctx;

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

        if (wep.special === 'defense_shred') {
            enemy.defReduction = (enemy.defReduction || 0) + wep.shredAmount;
            logCombat(`Shreds ${wep.shredAmount} defense!`, 'log-info');
        }
        if (wep.special === 'burn') {
            enemy.burnDamage = (enemy.burnDamage || 0) + wep.burnDamage;
            logCombat(`${em.getDef(enemy.type).name} is burning!`, 'log-dmg');
        }
    }

    // Bounce damage from start hex to nearby enemies. useBellCurve picks the
    // damage path: dealDamageToEnemy (rolled + defense) vs raw (skill chains).
    chainBounce(skillName, dmg, startQ, startR, bounceCount, bounceRange, hitSet, useBellCurve, perJumpBonus) {
        const { em, world, sound, logCombat, dealDamageToEnemy, killEnemy, enemyDefense } = this.ctx;
        let curQ = startQ, curR = startR;
        for (let i = 0; i < bounceCount; i++) {
            dmg += (perJumpBonus || 0);
            let closest = null, closestDist = Infinity;
            for (const enemy of em.enemies) {
                if (hitSet.has(enemy)) continue;
                const d = hexDistance(curQ, curR, enemy.q, enemy.r);
                if (d <= bounceRange && d < closestDist) { closestDist = d; closest = enemy; }
            }
            if (!closest) break;
            hitSet.add(closest);
            if (useBellCurve) {
                dealDamageToEnemy(closest, dmg, `${skillName} bounce`);
            } else {
                const closestDef = em.getDef(closest.type);
                const eDef = enemyDefense(closest, closestDef);
                const actualDmg = Math.max(1, dmg - eDef);
                closest.hp -= actualDmg;
                logCombat(`${skillName} chain: ${actualDmg} dmg to ${closestDef.name}`, 'log-dmg');
                sound.hitEnemy();
                if (closest.hp <= 0) killEnemy(closest);
            }
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
        const { player, em, sound, logCombat, dealDamageToEnemy, dealDamageToPlayer, killEnemy, enemyMeleeAttack } = ctx;
        ctx.setCombatAlerted(true);
        const enemy = this.enemy;

        let dmg = this.applyEquipmentBonusDamage(player.meleeDamage(em.getDef(enemy.type).chaosSpawned));
        const wep = player.weapon();
        const opts = {};
        if (wep && wep.special === 'armor_pierce') opts.pierceAmount = wep.pierceAmount;
        const { killed } = dealDamageToEnemy(enemy, dmg, 'Melee', opts);

        this.applyOnHitEffects(wep, enemy);

        if (!killed && wep && wep.special === 'double_strike') {
            dealDamageToEnemy(enemy, dmg, 'Double Strike', opts);
        }
        if (!killed && wep && wep.special === 'triple_strike') {
            dealDamageToEnemy(enemy, dmg, 'Triple Strike', opts);
            if (enemy.hp > 0) dealDamageToEnemy(enemy, dmg, 'Triple Strike', opts);
        }

        if (wep && wep.special === 'chain') {
            this.chainBounce('Chain', dmg, enemy.q, enemy.r, wep.chainCount || 1, 2, new Set([enemy]), false);
        }
        if (wep && wep.special === 'reverberate') {
            this.chainBounce('Reverberate', dmg, enemy.q, enemy.r, wep.chainCount || 1, 2, new Set([enemy]), false, wep.chainBonus || 0);
        }

        if (wep && wep.special === 'cleave') {
            for (const n of hexNeighbors(enemy.q, enemy.r)) {
                const adjEnemy = em.enemies.find(e => e.q === n.q && e.r === n.r);
                if (adjEnemy) dealDamageToEnemy(adjEnemy, dmg, 'Cleave');
            }
        }

        if (!killed) {
            const def = em.getDef(enemy.type);
            let counterDmg = enemyMeleeAttack(enemy, def);
            if (wep && wep.special === 'riposte') counterDmg = Math.floor(counterDmg / 2);
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
        const { player, world, em, sound, logCombat, dealDamageToEnemy, killEnemy } = ctx;
        ctx.setCombatAlerted(true);

        const enemy = em.enemies.find(e => e.q === this.targetQ && e.r === this.targetR);
        if (!enemy) return;
        const wep = player.weapon();
        const dist = hexDistance(player.q, player.r, this.targetQ, this.targetR);
        const eDef = em.getDef(enemy.type);
        let dmg = this.applyEquipmentBonusDamage(player.rangedDamage(dist, eDef.chaosSpawned));

        if (wep && wep.special === 'sniper' && dist >= wep.range) {
            dmg += wep.sniperBonus;
            logCombat(`Sniper: +${wep.sniperBonus} at max range`, 'log-info');
        }

        const rangedOpts = {};
        if (wep && wep.special === 'armor_pierce') rangedOpts.pierceAmount = wep.pierceAmount;
        if (wep && wep.special === 'ignore_defense') {
            const actualDmg = Math.max(1, dmg);
            enemy.hp -= actualDmg;
            logCombat(`Ranged: ${actualDmg} dmg to ${em.getDef(enemy.type).name}`, 'log-dmg');
            sound.hitEnemy();
            if (enemy.hp <= 0) killEnemy(enemy);
        } else if (wep && wep.special === 'double_shot') {
            dealDamageToEnemy(enemy, dmg, 'Shot 1', rangedOpts);
            if (enemy.hp > 0) dealDamageToEnemy(enemy, dmg, 'Shot 2', rangedOpts);
        } else if (wep && wep.special === 'triple_shot') {
            dealDamageToEnemy(enemy, dmg, 'Shot 1', rangedOpts);
            if (enemy.hp > 0) dealDamageToEnemy(enemy, dmg, 'Shot 2', rangedOpts);
            if (enemy.hp > 0) dealDamageToEnemy(enemy, dmg, 'Shot 3', rangedOpts);
        } else {
            dealDamageToEnemy(enemy, dmg, 'Ranged', rangedOpts);
        }

        this.applyOnHitEffects(wep, enemy);

        if (wep && wep.special === 'chain') {
            this.chainBounce('Chain', dmg, this.targetQ, this.targetR, wep.chainCount || 1, 2, new Set([enemy]), false);
        }
        if (wep && wep.special === 'reverberate') {
            this.chainBounce('Reverberate', dmg, this.targetQ, this.targetR, wep.chainCount || 1, 2, new Set([enemy]), false, wep.chainBonus || 0);
        }

        if (wep && wep.special === 'splash') {
            const sDmg = Math.max(1, dmg);
            for (const n of hexNeighbors(this.targetQ, this.targetR)) {
                const splashTarget = em.enemies.find(e => e.q === n.q && e.r === n.r && e !== enemy);
                if (!splashTarget) continue;
                splashTarget.hp -= sDmg;
                logCombat(`Splash: ${sDmg} dmg to ${em.getDef(splashTarget.type).name}`, 'log-dmg');
                sound.hitEnemy();
                if (splashTarget.hp <= 0) killEnemy(splashTarget);
            }
        }

        if (wep && wep.special === 'piercing') {
            const kb = knockbackHex(player.q, player.r, this.targetQ, this.targetR);
            const dq = kb.q - this.targetQ, dr = kb.r - this.targetR;
            for (let i = 1; i <= wep.range - dist; i++) {
                const pq = this.targetQ + dq * i, pr = this.targetR + dr * i;
                const pierceTarget = em.enemies.find(e => e.q === pq && e.r === pr);
                if (pierceTarget) {
                    dealDamageToEnemy(pierceTarget, dmg, 'Pierce');
                    break;
                }
                const hex = world.getHex(pq, pr);
                if (!hex || hex.terrain === TERRAIN.MOUNTAIN) break;
            }
        }

        if (wep && wep.special === 'knockback' && enemy.hp > 0) {
            const dest = knockbackHex(player.q, player.r, this.targetQ, this.targetR);
            const hex = world.getHex(dest.q, dest.r);
            const occupied = em.enemies.some(e => e.q === dest.q && e.r === dest.r);
            if (hex && world.isPassable(hex) && !occupied && !(dest.q === player.q && dest.r === player.r)) {
                enemy.q = dest.q;
                enemy.r = dest.r;
                logCombat(`Knocked back!`, 'log-info');
            }
        }

        // Magical ranged costs 1 aether by default; heavy variant doubles it.
        // free_ranged and channel bypass entirely.
        if (wep && wep.magical && wep.special !== 'free_ranged' && wep.special !== 'channel') {
            player.aether = Math.max(0, player.aether - (wep.aetherCost || 1));
        }
        this.spendWeaponMP();
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
            if (dist > 1 && dist <= (blink.blinkRange || 4)) {
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
        this.skill = SKILLS[skillId];
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
        if (result !== false) this.spendMP(skillMpCost(this.skill));
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

    applyAoeDamage(skillName, dmg, range) {
        const { player, em, dealDamageToEnemy } = this.ctx;
        for (const h of hexesInRange(player.q, player.r, range)) {
            const enemy = em.enemyAt(h.q, h.r);
            if (enemy) dealDamageToEnemy(enemy, dmg, skillName);
        }
    }

    applyAoeDamageAt(skillName, dmg, centerQ, centerR, range) {
        const { em, dealDamageToEnemy } = this.ctx;
        for (const h of hexesInRange(centerQ, centerR, range)) {
            const enemy = em.enemyAt(h.q, h.r);
            if (enemy) dealDamageToEnemy(enemy, dmg, skillName);
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
    const { player, world, em, victory, logCombat, gainXP, closeBreach, grantReturnSkill, offerSettlementReward, showDialog, showOnceDialog } = action.ctx;
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
            if (breachInRange.type === POI.MAW) grantReturnSkill();
        } else {
            showDialog('Restore', 'Restore did not close the breach.', [{ label: 'OK', cls: 'btn-primary' }]);
        }
    }
}

function executeVoidStrike(action) {
    const { player, em, dealDamageToEnemy } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const wep = player.weapon();
    const dmg = (wep ? wep.damage : 1) + player.stats.might + player.stats.warding;
    dealDamageToEnemy(enemy, dmg, 'Void Strike');
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
    dealDamageToEnemy(enemy, action.skill.baseDamage + player.stats.warding, 'Cosmic Bolt');
}

function executeShockwave(action) {
    const { player, em, logCombat, dealDamageToEnemy } = action.ctx;
    const skill = action.skill;
    const dmg = skill.baseDamage + player.stats.might;
    const survivors = [];
    for (const h of hexesInRange(player.q, player.r, skill.range)) {
        const enemy = em.enemyAt(h.q, h.r);
        if (!enemy) continue;
        dealDamageToEnemy(enemy, dmg, 'Shockwave');
        if (enemy.hp > 0) survivors.push(enemy);
    }
    for (const enemy of survivors) action.pushEnemyAway(enemy, player.q, player.r);
    logCombat('Shockwave!', 'log-info');
}

function executeSiphonStrike(action) {
    const { player, em, sound, logCombat, killEnemy, enemyDefense } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const wep = player.weapon();
    const dmg = (wep ? wep.damage : 1) + player.stats.might;
    const rolled = Rando.bellCurve(dmg);
    const eDef = enemyDefense(enemy, em.getDef(enemy.type));
    const actualDmg = Math.max(1, rolled - eDef);
    enemy.hp -= actualDmg;
    logCombat(`Siphon Strike: ${actualDmg} dmg to ${em.getDef(enemy.type).name}`, 'log-dmg');
    sound.hitEnemy();
    player.hp = Math.min(player.maxHP(), player.hp + actualDmg);
    logCombat(`+${actualDmg} HP (siphon)`, 'log-heal');
    if (enemy.hp <= 0) killEnemy(enemy);
}

function executePiercingShot(action) {
    const { player, em, sound, logCombat, killEnemy } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const dmg = action.skill.baseDamage + player.stats.reflex;
    const actualDmg = Math.max(1, dmg);
    enemy.hp -= actualDmg;
    logCombat(`Piercing Shot: ${actualDmg} dmg to ${em.getDef(enemy.type).name}`, 'log-dmg');
    sound.hitEnemy();
    if (enemy.hp <= 0) killEnemy(enemy);
}

function executeWarpShield(action) {
    const { player, logCombat } = action.ctx;
    player.warpShieldTurns = action.skill.duration;
    logCombat('Warp Shield active!', 'log-info');
}

function executeBreachPulse(action) {
    const { player } = action.ctx;
    action.applyAoeDamage('Breach Pulse', action.skill.baseDamage + player.stats.warding, action.skill.range);
}

function executeChainLightning(action) {
    const { player, em, dealDamageToEnemy } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const skill = action.skill;
    const dmg = skill.baseDamage + player.stats.warding;
    dealDamageToEnemy(enemy, dmg, 'Chain Lightning');
    action.chainBounce('Chain Lightning', dmg, action.targetQ, action.targetR, skill.chainCount, skill.chainRange, new Set([enemy]), false);
}

function executeImmolate(action) {
    const { player, em, logCombat, dealDamageToEnemy } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const wep = player.weapon();
    const dmg = (wep ? wep.damage : 1) + player.stats.might;
    dealDamageToEnemy(enemy, dmg, 'Immolate');
    if (enemy.hp > 0) {
        enemy.burnDamage = (enemy.burnDamage || 0) + action.skill.burnDamage;
        logCombat(`${em.getDef(enemy.type).name} is burning!`, 'log-dmg');
    }
}

function executeMendingLight(action) {
    const { player, logCombat } = action.ctx;
    const heal = action.skill.baseHeal + player.stats.vigor * 3;
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
    const { player, em, logCombat, dealDamageToEnemy } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const wep = player.weapon();
    const dmg = (wep ? wep.damage : 1) + player.stats.might;
    dealDamageToEnemy(enemy, dmg, 'Sundering Blow');
    if (enemy.hp > 0) {
        enemy.defReduction = (enemy.defReduction || 0) + action.skill.shredAmount;
        logCombat(`Sundered ${action.skill.shredAmount} defense!`, 'log-info');
    }
}

function executeMeteor(action) {
    const { player, logCombat } = action.ctx;
    const dmg = action.skill.baseDamage + player.stats.warding;
    action.applyAoeDamageAt('Meteor', dmg, action.targetQ, action.targetR, action.skill.aoeRange);
    logCombat('Meteor!', 'log-info');
}

function executeDimensionalRend(action) {
    const { player, em, dealDamageToEnemy } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const wep = player.weapon();
    dealDamageToEnemy(enemy, (wep ? wep.damage : 1) * 3, 'Dimensional Rend');
}

function executeExecute(action) {
    const { player, em, dealDamageToEnemy } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const wep = player.weapon();
    const dmg = (wep ? wep.damage : 1) * 2 + player.stats.might * 2;
    dealDamageToEnemy(enemy, dmg, 'Execute');
}

function executeRicochet(action) {
    const { player, em, dealDamageToEnemy } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const dmg = action.skill.baseDamage + player.stats.reflex;
    dealDamageToEnemy(enemy, dmg, 'Ricochet');
    action.chainBounce('Ricochet', dmg, action.targetQ, action.targetR, action.skill.bounceCount, action.skill.bounceRange, new Set([enemy]), true);
}

function executeStarfall(action) {
    const { player } = action.ctx;
    action.applyAoeDamage('Starfall', action.skill.baseDamage + player.stats.warding * 2, action.skill.range);
}

function executeVoidSalvo(action) {
    const { player, em, dealDamageToEnemy } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const dmg = action.skill.baseDamage + player.stats.reflex;
    for (let i = 0; i < action.skill.shotCount; i++) {
        if (enemy.hp <= 0) break;
        dealDamageToEnemy(enemy, dmg, `Salvo ${i + 1}`);
    }
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
        if (!hex || !world.isPassable(hex)) continue;
        if (UNSHATTERED_VERSION[hex.terrain] !== undefined) continue;
        if (UNDISTRESSED_VERSION[hex.terrain] !== undefined) continue;
        cleanCount++;
    }
    const aeGain = 1 + Math.floor(cleanCount / 6);
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
    for (const h of hexesInRange(player.q, player.r, action.skill.revealRange)) {
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
    const { world, logCombat } = action.ctx;
    let poiCount = 0;
    for (const poi of world.pois) {
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
    const chance = player.level * 0.05;
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
    logCombat(`Reflect: ${refund} stat points refunded.`, 'log-info');
    setTimeout(() => showLevelUpDialog(), 100);
}

function executeSanctuary(action) {
    const { player, world, logCombat } = action.ctx;
    const existingPoi = world.poiAt(player.q, player.r);
    if (existingPoi) {
        return action.abortSkillWithRefund('Cannot sanctify — already a point of interest!');
    }
    const pHex = world.getHex(player.q, player.r);
    const tempVillage = { q: player.q, r: player.r, type: POI.VILLAGE, id: world.pois.length, temporary: true };
    world.pois.push(tempVillage);
    pHex.poi = POI.VILLAGE;
    logCombat('Sanctuary! A temporary village appears.', 'log-heal');
}

// ---- Special combat skills ----

function executeLoot(action) {
    const { player, em, victory, logCombat } = action.ctx;
    const enemy = em.enemyAt(action.targetQ, action.targetR);
    if (!enemy) return;
    const def = em.getDef(enemy.type);
    const might = def ? def.attack : 0;
    const goldStolen = Rando.int(0, might);
    player.gold += goldStolen;
    victory.goldCollected += goldStolen;
    logCombat(`Looted ${goldStolen}g!`, 'log-gold');
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
        dealDamageToEnemy(enemy, dmg, "Haven's Light");
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
    action.applyAoeDamage('Aether Blast', skill.baseDamage + Math.floor(player.stats.warding / 2), skill.range);
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
    action.applyAoeDamage('Lifedrain Blast', skill.baseDamage + player.stats.vigor, skill.range);
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
    breach_pulse: executeBreachPulse,
    chain_lightning: executeChainLightning,
    immolate: executeImmolate,
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
