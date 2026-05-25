// enemy_ai.js — Per-behavior enemy AI classes and round orchestration.
//
// One AI subclass per enemy behavior bucket; aiFor(behavior) picks the AI.
// Adding a new class of enemy means writing a new AI subclass and adding
// one entry to BEHAVIOR_AI — no changes to runEnemyPhase needed.
//
// The ctx passed to runEnemyPhase must supply (mirrors actions.js pattern):
//   state (live getters):    player, world, em, victory
//   predicates (functions):  combatAlerted, isGameOver, playerInForest, playerTerrain
//   combat math (functions): enemyMeleeAttack, enemyRangedAttack, enemyDefense,
//                            enemyEffectiveMaxHp, enemyOnCorruptedTerrain
//   side-effects (callbacks): dealDamageToPlayer, killEnemy, gainXP,
//                             logCombat, render, animDelay, tickGarrisons,
//                             advanceTurn

import { Rando } from './rando.js';
import { hexKey, hexNeighbors, hexDistance, hexesInRange, bfsHexes } from './hex.js';
import {
    ENEMY_TYPE, POI, MOVEMENT_COST,
    SHATTERED_VERSION, DISTRESSED_VERSION, UNDISTRESSED_VERSION,
    isChaosTerrain
} from './config.js';
import { NUM_CREATURE_TIERS, spawnTierWeights } from './enemies.js';

// ================================================================
// Maw distance field — owned here because spawn weighting and chaos
// scaling both key off it. Index.js reads via the exports below.
// ================================================================

let mawDistances = null;
let mawMaxDist = 1;

export function computeMawDistances(world) {
    const maw = world.pois.find(p => p.type === POI.MAW);
    if (!maw) { mawDistances = new Map(); mawMaxDist = 1; return; }
    const mawHex = world.getHex(maw.q, maw.r);
    mawDistances = bfsHexes(mawHex, world.hexes, hex => {
        const c = MOVEMENT_COST[hex.terrain];
        return c === undefined ? Infinity : c;
    }, Infinity);
    mawMaxDist = 1;
    for (const cost of mawDistances.values()) {
        if (cost > mawMaxDist) mawMaxDist = cost;
    }
}

// Peak creature tier at a hex: ramps linearly from NUM_CREATURE_TIERS-1 at the Maw
// to 0 at the far edge. Hexes disconnected from the Maw default to peak 0 (easiest).
export function mawDistancePeak(q, r) {
    if (!mawDistances || mawMaxDist <= 0) return 0;
    const dist = mawDistances.get(hexKey(q, r));
    if (dist === undefined) return 0;
    const t = Math.min(1, dist / mawMaxDist);
    return (NUM_CREATURE_TIERS - 1) * (1 - t);
}

export function mawProximityBonus(q, r) {
    if (!mawDistances) return { attack: 0, defense: 0, hp: 0 };
    const dist = mawDistances.get(hexKey(q, r));
    if (dist === undefined) return { attack: 0, defense: 0, hp: 0 };
    const threshold = mawMaxDist * 0.5;
    if (dist > threshold) return { attack: 0, defense: 0, hp: 0 };
    const t = 1 - dist / threshold;
    return {
        attack: Math.round(20 * t),
        defense: Math.round(10 * t),
        hp: Math.round(20 * t)
    };
}

// Spawn picker: closer to the Maw → tougher creatures, packs scale to player attack.
// Pack size: bellCurve(playerAttack) / creature.attack — strong creatures spawn alone,
// weak ones swarm.
export function pickSpawnPack(q, r, player, em) {
    const peak = mawDistancePeak(q, r);
    const type = Rando.weighted(spawnTierWeights(em.creatureDefs, peak));
    const def = em.getDef(type);
    const playerAttack = player.meleeDamage(false);
    const roll = Rando.bellCurve(playerAttack);
    const packSize = Math.max(1, Math.ceil(roll / def.attack));
    return { type, packSize };
}

// ================================================================
// EnemyAI base — shared helpers for all per-enemy turn handlers.
// Subclasses override takeTurn(enemy, def, occupied, ctx).
// ================================================================

export class EnemyAI {
    async takeTurn(enemy, def, occupied, ctx) {
        throw new Error('EnemyAI.takeTurn() not implemented');
    }

    enemyIsVisible(enemy, prevKey, ctx) {
        const world = ctx.world;
        return world.visible.has(prevKey) || world.visible.has(hexKey(enemy.q, enemy.r));
    }

    async animateMove(enemy, prevKey, ctx) {
        if (!this.enemyIsVisible(enemy, prevKey, ctx)) return;
        await ctx.animDelay(80);
        ctx.render();
    }

    // Forest stealth: drop aggro range by 2 unless the player has already
    // alerted combat (and is within 5 hexes).
    forestModifiedAggro(enemy, aggro, ctx) {
        if (!ctx.playerInForest()) return aggro;
        const dist = hexDistance(enemy.q, enemy.r, ctx.player.q, ctx.player.r);
        if (ctx.combatAlerted() && dist <= 5) return aggro;
        return Math.max(1, aggro - 2);
    }

    baseAggro(def, ctx) {
        let aggro = def.aggroRange || def.detectRange || 0;
        if (ctx.player.equipped('threat_shroud')) aggro = Math.max(1, aggro - 2);
        return aggro;
    }

    // Standard "see player → chase and melee" used by wildlife/monster/guardian.
    // Returns true if the enemy spent its turn aggro-chasing.
    async tryAggroChase(enemy, def, aggro, occupied, ctx) {
        const { player, em, world } = ctx;
        const dist = hexDistance(enemy.q, enemy.r, player.q, player.r);
        if (dist > aggro) return false;
        const prevKey = hexKey(enemy.q, enemy.r);
        em.moveWildlifeToward(enemy, player.q, player.r, occupied, player.q, player.r, world);
        if (this.enemyIsVisible(enemy, prevKey, ctx)) { await ctx.animDelay(80); ctx.render(); }
        if (hexDistance(enemy.q, enemy.r, player.q, player.r) === 1) {
            ctx.dealDamageToPlayer(ctx.enemyMeleeAttack(enemy, def), def.name, false, { attacker: enemy });
            await ctx.animDelay(150); ctx.render();
        }
        return true;
    }

    nearestPoiOfType(q, r, types, ctx) {
        const set = new Set(types);
        let best = null;
        for (const poi of ctx.world.pois) {
            if (!set.has(poi.type)) continue;
            const d = hexDistance(q, r, poi.q, poi.r);
            if (!best || d < best.dist) best = { poi, dist: d };
        }
        return best;
    }

    nearestSettlement(q, r, ctx) {
        return this.nearestPoiOfType(q, r, [POI.HAVEN, POI.VILLAGE], ctx);
    }
}

// ================================================================
// WildlifeAI — see player, run at player; otherwise wander.
// ================================================================

export class WildlifeAI extends EnemyAI {
    async takeTurn(enemy, def, occupied, ctx) {
        const aggro = this.forestModifiedAggro(enemy, this.baseAggro(def, ctx), ctx);
        if (await this.tryAggroChase(enemy, def, aggro, occupied, ctx)) return;
        if (Rando.bool(0.3)) {
            const { em, player, world } = ctx;
            em.wanderWildlife(enemy, occupied, player.q, player.r, world);
        }
    }
}

// ================================================================
// MonsterAI — wildlife with a settlement-hunting drive.
// Lurks near a settlement (≤2), hunts within aggro*2, else wanders.
// ================================================================

export class MonsterAI extends EnemyAI {
    async takeTurn(enemy, def, occupied, ctx) {
        const aggro = this.forestModifiedAggro(enemy, this.baseAggro(def, ctx), ctx);
        if (await this.tryAggroChase(enemy, def, aggro, occupied, ctx)) return;

        const { player, em, world } = ctx;
        const prevKey = hexKey(enemy.q, enemy.r);
        const settle = this.nearestSettlement(enemy.q, enemy.r, ctx);

        if (settle && settle.dist <= 2) {
            em.wanderWildlife(enemy, occupied, player.q, player.r, world);
            await this.animateMove(enemy, prevKey, ctx);
            return;
        }
        if (settle && settle.dist <= aggro * 2) {
            em.moveWildlifeToward(enemy, settle.poi.q, settle.poi.r, occupied, player.q, player.r, world);
            await this.animateMove(enemy, prevKey, ctx);
            return;
        }
        em.wanderWildlife(enemy, occupied, player.q, player.r, world);
        await this.animateMove(enemy, prevKey, ctx);
    }
}

// ================================================================
// RuinsGuardianAI — patrols within 2 of a ruin, returns from further out.
// ================================================================

export class RuinsGuardianAI extends EnemyAI {
    async takeTurn(enemy, def, occupied, ctx) {
        const aggro = this.forestModifiedAggro(enemy, this.baseAggro(def, ctx), ctx);
        if (await this.tryAggroChase(enemy, def, aggro, occupied, ctx)) return;

        const { player, em, world } = ctx;
        const prevKey = hexKey(enemy.q, enemy.r);
        const ruin = this.nearestPoiOfType(enemy.q, enemy.r, [POI.RUIN], ctx);

        if (ruin && ruin.dist <= 2) {
            if (Rando.bool(0.3)) {
                this.patrolAroundPoi(enemy, occupied, ruin.poi, ctx);
                await this.animateMove(enemy, prevKey, ctx);
            }
            return;
        }
        if (ruin && ruin.dist <= aggro * 2) {
            em.moveWildlifeToward(enemy, ruin.poi.q, ruin.poi.r, occupied, player.q, player.r, world);
            await this.animateMove(enemy, prevKey, ctx);
            return;
        }
        if (Rando.bool(0.5)) {
            em.wanderWildlife(enemy, occupied, player.q, player.r, world);
            await this.animateMove(enemy, prevKey, ctx);
        }
    }

    patrolAroundPoi(enemy, occupied, poi, ctx) {
        const { em, player, world } = ctx;
        const valid = em.validAdjacentMoves(enemy, occupied, true, player.q, player.r, world)
            .filter(n => !(n.q === poi.q && n.r === poi.r));
        if (valid.length > 0) em.moveEnemyToNearest(enemy, [Rando.choice(valid)], occupied);
    }
}

// ================================================================
// ChaosAI — corrupt-spawn behavior. Heals on corrupted terrain, can
// teleport (wraiths), swarms toward settlements when allied, multi-step
// movement, ranged attacks, boss spawning, terrain shatter.
//
// Internal def.behavior keys ('chase', 'kite', 'guard', 'boss', 'teleport')
// dispatch through moveEnemyStep and enemyAttacks. They share enough that
// keeping them in one class beats four trivial subclasses.
// ================================================================

export class ChaosAI extends EnemyAI {
    async takeTurn(enemy, def, occupied, ctx) {
        const { player, world } = ctx;

        // Heal on corrupted terrain
        const effMax = ctx.enemyEffectiveMaxHp(enemy);
        if (ctx.enemyOnCorruptedTerrain(enemy, def) && enemy.hp < effMax) {
            enemy.hp = Math.min(effMax, enemy.hp + 1);
        }

        const dist = hexDistance(enemy.q, enemy.r, player.q, player.r);
        let aggro = this.baseAggro(def, ctx);

        // Forest stealth: wraiths lose track entirely, others lose 2 aggro.
        const inForest = ctx.playerInForest();
        if (inForest && !(ctx.combatAlerted() && dist <= 5)) {
            if (def.behavior === 'teleport') aggro = 0;
            else aggro = Math.max(1, aggro - 2);
        }
        const prevKey = hexKey(enemy.q, enemy.r);

        // Phase Wraith teleport (blocked by wraith_immune)
        if (def.behavior === 'teleport' && dist <= aggro && !player.equipped('wraith_immune')
            && Math.random() < (def.teleportChance || 0.3)) {
            await this.tryTeleport(enemy, def, occupied, prevKey, ctx);
        }

        const swarming = this.trySwarmMarch(enemy, def, occupied, ctx);

        // Ranged-capable chasers (Void Stalker): 50% prefer ranged, skip closing in
        const prefersRanged = def.rangedAttack && def.behavior === 'chase' && Rando.bool(0.5);

        let moved = swarming;
        const speed = def.speed || 1;
        for (let step = 0; step < speed && !swarming; step++) {
            if (this.moveEnemyStep(enemy, def, dist, aggro, prefersRanged, occupied, ctx)) moved = true;
        }
        if (moved && this.enemyIsVisible(enemy, prevKey, ctx)) { await ctx.animDelay(80); ctx.render(); }

        const newDist = hexDistance(enemy.q, enemy.r, player.q, player.r);
        const attacked = this.enemyAttacks(enemy, def, prefersRanged, newDist, ctx);
        if (attacked) { await ctx.animDelay(150); ctx.render(); }

        this.tryBossSpawn(enemy, def, occupied, ctx);
        this.tryTerrainShatter(enemy, def, ctx);
    }

    async tryTeleport(enemy, def, occupied, prevKey, ctx) {
        const { player, world } = ctx;
        const valid = hexesInRange(player.q, player.r, def.teleportRange).filter(t => {
            const k = hexKey(t.q, t.r);
            const h = world.getHex(t.q, t.r);
            if (!h || !world.isPassable(h) || occupied.has(k)) return false;
            if (t.q === player.q && t.r === player.r) return false;
            const poi = world.poiAt(t.q, t.r);
            if (poi && (poi.type === POI.HAVEN || poi.type === POI.VILLAGE)) return false;
            return true;
        });
        if (valid.length === 0) return;
        occupied.delete(hexKey(enemy.q, enemy.r));
        const dest = Rando.choice(valid);
        enemy.q = dest.q; enemy.r = dest.r;
        occupied.add(hexKey(enemy.q, enemy.r));
        if (this.enemyIsVisible(enemy, prevKey, ctx)) { await ctx.animDelay(100); ctx.render(); }
    }

    moveEnemyStep(enemy, def, dist, aggro, prefersRanged, occupied, ctx) {
        const { player, em, world } = ctx;
        if (def.behavior === 'guard') {
            if (hexDistance(enemy.q, enemy.r, enemy.homeQ, enemy.homeR) > (def.guardRadius || 2)) {
                em.moveEnemyToward(enemy, enemy.homeQ, enemy.homeR, occupied, world);
                return true;
            }
            if (dist <= aggro) {
                const next = em.getNextStepToward(enemy, player.q, player.r, occupied, world);
                if (next && hexDistance(next.q, next.r, enemy.homeQ, enemy.homeR) <= (def.guardRadius || 2)) {
                    occupied.delete(hexKey(enemy.q, enemy.r));
                    enemy.q = next.q; enemy.r = next.r;
                    occupied.add(hexKey(enemy.q, enemy.r));
                    return true;
                }
            }
            return false;
        }
        if (def.behavior === 'kite') {
            if (dist <= aggro) {
                if (dist < 2) em.moveEnemyAway(enemy, player.q, player.r, occupied, player.q, player.r, world);
                else if (dist > 3) em.moveEnemyToward(enemy, player.q, player.r, occupied, world);
                return true;
            }
            if (Rando.bool(0.5)) { em.wanderEnemy(enemy, occupied, player.q, player.r, world); return true; }
            return false;
        }
        if (def.behavior === 'boss') {
            if (dist <= aggro) { em.moveEnemyToward(enemy, player.q, player.r, occupied, world); return true; }
            return false;
        }
        // chase or default
        if (dist <= aggro && !prefersRanged) {
            em.moveEnemyToward(enemy, player.q, player.r, occupied, world);
            return true;
        }
        if (!prefersRanged && Rando.bool(0.5)) {
            em.wanderEnemy(enemy, occupied, player.q, player.r, world);
            return true;
        }
        return false;
    }

    enemyCanRangedAttack(enemy, def, newDist, ctx) {
        return def.rangedAttack && def.range && newDist <= def.range
            && ctx.world.hasLOS(enemy, ctx.player);
    }

    doEnemyMelee(enemy, def, ctx) {
        const { player, em, dealDamageToPlayer, logCombat, killEnemy } = ctx;
        dealDamageToPlayer(ctx.enemyMeleeAttack(enemy, def), def.name, false, { attacker: enemy });
        // Counter Mastery: player counter-attacks after being hit in melee
        if (player.equipped('counter_mastery') && enemy.hp > 0) {
            const pWep = player.weapon();
            const counterDmg = (pWep ? pWep.damage : 1) + player.stats.might;
            const rolled = Rando.bellCurve(counterDmg);
            const eDef = ctx.enemyDefense(enemy, def);
            const actualDmg = Math.max(1, rolled - eDef);
            enemy.hp -= actualDmg;
            logCombat(`Counter Mastery: ${actualDmg} dmg!`, 'log-dmg');
            ctx.sound.hitEnemy();
            if (enemy.hp <= 0) killEnemy(enemy);
        }
    }

    doEnemyRanged(enemy, def, ctx) {
        ctx.dealDamageToPlayer(ctx.enemyRangedAttack(enemy, def), `${def.name} (ranged)`, false, { attacker: enemy, isRanged: true });
    }

    enemyAttacks(enemy, def, prefersRanged, newDist, ctx) {
        if (def.behavior === 'kite') {
            if (Rando.bool(0.5) && newDist > 1 && this.enemyCanRangedAttack(enemy, def, newDist, ctx)) {
                this.doEnemyRanged(enemy, def, ctx);
                return true;
            }
            return false;
        }
        if (newDist === 1) {
            this.doEnemyMelee(enemy, def, ctx);
            return true;
        }
        if (this.enemyCanRangedAttack(enemy, def, newDist, ctx)) {
            if (def.behavior === 'guard' || def.behavior === 'boss' || prefersRanged) {
                this.doEnemyRanged(enemy, def, ctx);
                return true;
            }
        }
        return false;
    }

    tryBossSpawn(enemy, def, occupied, ctx) {
        if (def.behavior !== 'boss') return;
        if (enemy.noSpawn) return;
        if (enemy.turnsSinceSpawn === 0) return;
        if (!Rando.bool(def.spawnChance ?? 0.16)) return;
        const { em, world, logCombat } = ctx;
        const adj = hexNeighbors(enemy.q, enemy.r).filter(n => {
            const k = hexKey(n.q, n.r);
            const h = world.getHex(n.q, n.r);
            return h && world.isPassable(h) && !occupied.has(k);
        });
        if (adj.length === 0) return;
        const spot = Rando.choice(adj);
        const wraithCount = em.enemies.filter(e => e.type === ENEMY_TYPE.PHASE_WRAITH).length;
        const bossPool = wraithCount >= 10
            ? [ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.FLUX_ARCHER, ENEMY_TYPE.FLUX_ARCHER, ENEMY_TYPE.BREACH_CRAWLER]
            : [ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.FLUX_ARCHER, ENEMY_TYPE.FLUX_ARCHER, ENEMY_TYPE.BREACH_CRAWLER, ENEMY_TYPE.PHASE_WRAITH];
        const spawnType = Rando.choice(bossPool);
        const spawned = em.spawn(spawnType, spot.q, spot.r);
        if (spawned) {
            occupied.add(hexKey(spot.q, spot.r));
            logCombat(`The Unraveler spawns a ${em.getDef(spawnType).name}!`, 'log-info');
        }
    }

    tryTerrainShatter(enemy, def, ctx) {
        if (!def.chaosSpawned || !Rando.bool(0.02)) return;
        const { world } = ctx;
        const eHex = world.getHex(enemy.q, enemy.r);
        if (!eHex) return;
        const undistressed = UNDISTRESSED_VERSION[eHex.terrain];
        if (undistressed !== undefined) eHex.terrain = undistressed;
        if (SHATTERED_VERSION[eHex.terrain] === undefined) return;
        const poi = world.poiAt(enemy.q, enemy.r);
        if (poi && (poi.type === POI.HAVEN || poi.type === POI.VILLAGE)) return;
        eHex.terrain = SHATTERED_VERSION[eHex.terrain];
        for (const coord of hexesInRange(eHex.q, eHex.r, 3)) {
            const h = world.getHex(coord.q, coord.r);
            if (!h) continue;
            const hPoi = world.poiAt(coord.q, coord.r);
            if (hPoi && (hPoi.type === POI.HAVEN || hPoi.type === POI.VILLAGE)) continue;
            h.shatteredCount++;
            if (DISTRESSED_VERSION[h.terrain] !== undefined) {
                h.terrain = DISTRESSED_VERSION[h.terrain];
            }
        }
    }

    pickSwarmTarget(enemy, ctx) {
        const settlements = ctx.world.pois
            .filter(p => p.type === POI.HAVEN || p.type === POI.VILLAGE)
            .map(p => ({ poi: p, dist: hexDistance(enemy.q, enemy.r, p.q, p.r) }))
            .sort((a, b) => a.dist - b.dist);
        if (settlements.length === 0) return null;
        const weights = [20, 10, 5, 5];
        const weighted = settlements.slice(0, weights.length)
            .map((s, i) => ({ item: s.poi, weight: weights[i] }));
        return Rando.weighted(weighted);
    }

    greedyMoveToward(enemy, tq, tr, occupied, ctx) {
        const { em, player, world } = ctx;
        const valid = em.validAdjacentMoves(enemy, occupied, false, player.q, player.r, world);
        valid.sort((a, b) => hexDistance(a.q, a.r, tq, tr) - hexDistance(b.q, b.r, tq, tr));
        em.moveEnemyToNearest(enemy, valid, occupied);
    }

    trySwarmMarch(enemy, def, occupied, ctx) {
        if (def.behavior === 'boss' || def.behavior === 'guard') return false;
        // Clear target if arrived
        if (enemy.swarmTargetQ != null && hexDistance(enemy.q, enemy.r, enemy.swarmTargetQ, enemy.swarmTargetR) <= 3) {
            enemy.swarmTargetQ = null;
            enemy.swarmTargetR = null;
        }
        // Already marching toward a target
        if (enemy.swarmTargetQ != null) {
            this.greedyMoveToward(enemy, enemy.swarmTargetQ, enemy.swarmTargetR, occupied, ctx);
            return true;
        }
        // Swarm trigger: 5+ chaos allies within 3
        const { em } = ctx;
        const nearbyAllies = em.enemies.filter(e =>
            e !== enemy &&
            hexDistance(e.q, e.r, enemy.q, enemy.r) <= 3 &&
            em.getDef(e.type)?.chaosSpawned
        ).length;
        if (nearbyAllies < 5) return false;
        const target = this.pickSwarmTarget(enemy, ctx);
        if (!target) return false;
        enemy.swarmTargetQ = target.q;
        enemy.swarmTargetR = target.r;
        this.greedyMoveToward(enemy, target.q, target.r, occupied, ctx);
        return true;
    }
}

// ================================================================
// Registry. Add a new AI here when introducing a new enemy class.
// `chaos` is the catch-all (chase/kite/guard/boss/teleport).
// ================================================================

const wildlifeAI = new WildlifeAI();
const monsterAI = new MonsterAI();
const ruinsGuardianAI = new RuinsGuardianAI();
const chaosAI = new ChaosAI();

const BEHAVIOR_AI = {
    wildlife: wildlifeAI,
    monster: monsterAI,
    'ruins-guardian': ruinsGuardianAI,
};

export function aiFor(behavior) {
    return BEHAVIOR_AI[behavior] || chaosAI;
}

// ================================================================
// Round orchestrator. Player regen → burn ticks → per-enemy AI →
// guardian respawn → chaos breach spawn → wildlife spawn → garrisons
// → turn advance. Behavior preserved 1:1 from the index.js original.
// ================================================================

function buildOccupiedSet(player, em) {
    const occupied = new Set(em.enemies.map(e => hexKey(e.q, e.r)));
    occupied.add(hexKey(player.q, player.r));
    return occupied;
}

function regenPlayerAtPhaseStart(ctx) {
    const { player, logCombat } = ctx;
    player.hp = Math.min(player.maxHP(), player.hp + 1);

    const healItem = player.equipped('heal') || player.equipped('regen') || player.equipped('armor_regen');
    if (healItem) {
        const amt = healItem.healPerTurn || healItem.regenAmount || 1;
        player.hp = Math.min(player.maxHP(), player.hp + amt);
    }
    const reviveItem = player.equipped('revive');
    if (reviveItem) {
        player.hp = Math.min(player.maxHP(), player.hp + reviveItem.reviveHp);
        player.aether = Math.min(player.maxAether(), player.aether + reviveItem.reviveAether);
    }
    const regenCombo = player.equipped('regen_combo');
    if (regenCombo) {
        player.hp = Math.min(player.maxHP(), player.hp + regenCombo.regenAmount);
        player.aether = Math.min(player.maxAether(), player.aether + 1);
    }
    const aeRegenItem = player.equipped('aether_regen') || player.equipped('aether_regen_small') || player.equipped('aether_regen_large');
    if (aeRegenItem) {
        const aeAmt = aeRegenItem.aetherRegen || (aeRegenItem.special === 'aether_regen_large' ? 3 : 1);
        player.aether = Math.min(player.maxAether(), player.aether + aeAmt);
    }
    const chaosCirclet = player.equipped('chaos_circlet');
    if (chaosCirclet && isChaosTerrain(ctx.playerTerrain())) {
        player.aether = Math.min(player.maxAether(), player.aether + 1);
        logCombat('Chaos Circlet: +1 AE', 'log-info');
    }
}

function tickBurns(ctx) {
    const { em, killEnemy, logCombat } = ctx;
    for (const enemy of [...em.enemies]) {
        if (!enemy.burnDamage || enemy.burnDamage <= 0) continue;
        const bDef = em.getDef(enemy.type);
        enemy.hp -= enemy.burnDamage;
        logCombat(`Burn: ${enemy.burnDamage} dmg to ${bDef.name}`, 'log-dmg');
        enemy.burnDamage = 0;
        if (enemy.hp <= 0) killEnemy(enemy);
    }
}

function respawnGuardians(occupied, ctx) {
    const { world, em } = ctx;
    for (const poi of world.pois) {
        if (poi.type !== POI.BREACH && poi.type !== POI.MAW) continue;
        if (poi.closed) continue;
        // Skip Maw while the Unraveler is alive AND nearby — guardians only pour
        // forth if the Unraveler has been displaced (>11 hex).
        if (poi.type === POI.MAW) {
            const unraveler = em.enemies.find(e => e.type === ENEMY_TYPE.UNRAVELER);
            if (unraveler && hexDistance(unraveler.q, unraveler.r, poi.q, poi.r) <= 11) continue;
        }
        const hasGuardian = em.enemies.some(e =>
            e.type === ENEMY_TYPE.BREACH_GUARDIAN && hexDistance(poi.q, poi.r, e.q, e.r) <= 3
        );
        if (hasGuardian) continue;
        if (Math.random() >= 0.3) continue;
        if (occupied.has(hexKey(poi.q, poi.r))) continue;
        const g = em.spawn(ENEMY_TYPE.BREACH_GUARDIAN, poi.q, poi.r, poi.q, poi.r);
        if (!g) continue;
        poi.guardianId = g.id;
        poi.guardianDefeated = false;
        occupied.add(hexKey(poi.q, poi.r));
    }
}

function spawnChaosAtBreaches(occupied, ctx) {
    const { world, em } = ctx;
    if (em.chaosMight() >= 500) return;
    const wraiths = em.enemies.filter(e => e.type === ENEMY_TYPE.PHASE_WRAITH).length;
    const chaosPool = wraiths >= 10
        ? [ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.FLUX_ARCHER, ENEMY_TYPE.FLUX_ARCHER, ENEMY_TYPE.BREACH_CRAWLER]
        : [ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.FLUX_ARCHER, ENEMY_TYPE.FLUX_ARCHER, ENEMY_TYPE.BREACH_CRAWLER, ENEMY_TYPE.PHASE_WRAITH];
    for (const poi of world.pois) {
        if (poi.type !== POI.BREACH || poi.closed) continue;
        if (Math.random() >= 0.075) continue;
        const adj = hexNeighbors(poi.q, poi.r).filter(n => {
            const k = hexKey(n.q, n.r);
            const h = world.getHex(n.q, n.r);
            return h && world.isPassable(h) && !occupied.has(k);
        });
        if (adj.length === 0) continue;
        const spot = Rando.choice(adj);
        const type = Rando.choice(chaosPool);
        em.spawn(type, spot.q, spot.r, poi.q, poi.r);
        occupied.add(hexKey(spot.q, spot.r));
    }
}

export async function runEnemyPhase(ctx) {
    regenPlayerAtPhaseStart(ctx);
    tickBurns(ctx);

    const occupied = buildOccupiedSet(ctx.player, ctx.em);

    for (const enemy of [...ctx.em.enemies]) {
        if (ctx.isGameOver()) break;
        const def = ctx.em.getDef(enemy.type);
        if (!def) continue;
        if (enemy.stunnedNextTurn) {
            enemy.stunnedNextTurn = false;
            enemy.turnsSinceSpawn++;
            continue;
        }
        enemy.turnsSinceSpawn++;
        await aiFor(def.behavior).takeTurn(enemy, def, occupied, ctx);
    }

    if (ctx.isGameOver()) return;

    if (ctx.player.warpShieldTurns > 0) ctx.player.warpShieldTurns--;
    if (ctx.player.reflectTurns > 0) ctx.player.reflectTurns--;

    respawnGuardians(occupied, ctx);
    spawnChaosAtBreaches(occupied, ctx);

    // Wildlife population maintenance
    ctx.em.spawnWildlife(ctx.world, ctx.player.q, ctx.player.r,
        (q, r) => pickSpawnPack(q, r, ctx.player, ctx.em));

    ctx.tickGarrisons();
    ctx.advanceTurn();
}
