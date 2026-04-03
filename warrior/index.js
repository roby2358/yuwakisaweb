// index.js — Warrior: Tactical Hex RPG

import {
    HEX_SIZE, MAP_COLS, MAP_ROWS, TERRAIN, TERRAIN_NAMES, MOVEMENT_COST,
    MAX_ENEMIES, STAT_POINTS_PER_LEVEL,
    xpForLevel,
    POI, POI_SYMBOLS, POI_COLORS, POI_DEFENSE_BONUS,
    ENEMY_TYPE,
    EQUIP_SLOT, WEAPONS, ARMORS, ARTIFACTS, ALL_EQUIPMENT, NON_MAGICAL_ITEMS,
    rollMagicItem, resetEquipment,
    isChaosTerrain, SELL_PRICE_RATIO,
    SKILL_TARGET, SKILL_USAGE, SKILLS, SKILL_UNLOCK_LEVELS,
    SHATTERED_VERSION, UNSHATTERED_VERSION, DISTRESSED_VERSION, UNDISTRESSED_VERSION
} from './config.js';
import { hexToPixel, pixelToHex, hexKey, parseHexKey, hexNeighbors, hexDistance, hexesInRange, bfsHexes, drawHexPath } from './hex.js';
import { Rando } from './rando.js';
import { Player } from './player.js';
import { GameWorld } from './world.js';
import { EnemyManager } from './enemies.js';

// ---- Display constants ----
const COUNTER_SIZE = 28;
const TERRAIN_COLORS = {
    [TERRAIN.WATER]: '#2a6faa',
    [TERRAIN.PLAINS]: '#7db344',
    [TERRAIN.HILLS]: '#c4a44a',
    [TERRAIN.MOUNTAIN]: '#7a7a7a',
    [TERRAIN.FOREST]: '#2d6e2d',
    [TERRAIN.GOLD]: '#d4a017',
    [TERRAIN.QUARRY]: '#9e8c6c',
    [TERRAIN.SHATTERED_PLAINS]: '#5a3020',
    [TERRAIN.SHATTERED_HILLS]: '#6e3e1e',
    [TERRAIN.SHATTERED_FOREST]: '#321a12',
    [TERRAIN.SHATTERED_GOLD]: '#7a4018',
    [TERRAIN.SHATTERED_QUARRY]: '#4e2c24',
    [TERRAIN.DISTRESSED_PLAINS]: '#8a9a6a',
    [TERRAIN.DISTRESSED_HILLS]: '#9a8a5a',
    [TERRAIN.DISTRESSED_FOREST]: '#5a7a3a',
    [TERRAIN.DISTRESSED_GOLD]: '#a89a5a',
    [TERRAIN.DISTRESSED_QUARRY]: '#7a7a6a',
};
const PLAYER_COLOR = '#daa520';

// ---- Game state ----
let world = null;           // GameWorld instance
let player = null;          // { q, r, stats, hp, aether, xp, level, gold, equipment, skills, inventory, statPoints, ... }
let em = null;              // EnemyManager instance
let selected = false;
let reachable = null;       // Map<string, cost>
let attackable = null;      // Set<string> — enemy hexes within melee reach
let turn = 1;
let phase = 'player';       // 'player' | 'enemy' | 'animating' | 'dialog'
function changePhase(p) { phase = p; }
let gameOver = false;
let gameWon = false;
let enemiesDefeated = 0;
let endTurnResolve = null;  // promise resolver for game loop
let gameGeneration = 0;     // incremented on new game to stop old loops
let targeting = null;       // { skill, validHexes: Set } or null
let hoveredHex = null;
let threatOverlay = null;   // Map<string, number> or null — threat heatmap for Ground Weeps
let showingWorldMap = false;
let combatAlerted = false;  // set when player attacks; nearby enemies ignore forest stealth
let poiInteracted = false;  // set after POI dialog shown; prevents re-show until next turn
let mawDistances = null;    // Map<hexKey, cost> — BFS distances from the Maw
let mawMaxDist = 1;         // max BFS distance to Maw (for scaling)

// ---- View state ----
let panX = 0, panY = 0;
let panning = false, panStartX = 0, panStartY = 0, panOrigX = 0, panOrigY = 0;

// ---- Canvas ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; render(); }
window.addEventListener('resize', resize);

// ---- Coordinate helpers ----
function hexToScreen(q, r) { const p = hexToPixel(q, r); return { x: p.x + panX, y: p.y + panY }; }
function screenToHex(sx, sy) { return pixelToHex(sx - panX, sy - panY); }

function playerTerrain() { return world.getHex(player.q, player.r)?.terrain; }
function playerInForest() { const t = playerTerrain(); return t === TERRAIN.FOREST || t === TERRAIN.DISTRESSED_FOREST; }
function playerPoiDefense() { const poi = world.poiAt(player.q, player.r); return poi ? (POI_DEFENSE_BONUS[poi.type] || 0) : 0; }
function playerDefense() { return player.defense(playerTerrain()) + playerPoiDefense(); }

// ---- Drawing helpers ----
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function contrastText(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.4 ? '#000' : '#fff';
}

// stats: { atk, def, mov } — all required for player/enemy counters
// hpPct: 0..1 — draws HP bar when < 1; pass 1 to skip bar
// labelColor: explicit text color; pass null to auto-contrast
function drawCounter(cx, cy, color, label, hpPct, labelColor, stats) {
    const s = COUNTER_SIZE;
    const x = cx - s / 2, y = cy - s / 2;
    const r = 4;
    const textColor = labelColor || contrastText(color);
    // Shadow
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x + r + i, y + s + 1 + i);
        ctx.arcTo(x + s + 1 + i, y + s + 1 + i, x + s + 1 + i, y + s - r + 1 + i, r);
        ctx.lineTo(x + s + 1 + i, y + r + i);
        ctx.stroke();
    }
    // Body
    roundRect(ctx, x, y, s, s, r);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    // Label
    ctx.fillStyle = textColor;
    ctx.font = 'bold ' + Math.floor(s * 0.55) + 'px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy - 2);
    // Stats: atk-def bottom-left, movement bottom-right
    if (stats) {
        ctx.font = Math.floor(s * 0.28) + 'px monospace';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(stats.atk + '-' + stats.def, x + 1, y + s - 1);
        ctx.textAlign = 'right';
        ctx.fillText(stats.mov, x + s - 1, y + s - 1);
    }
    // HP bar under counter
    if (hpPct < 1) {
        const bw = s, bh = 3, bx = cx - bw / 2, by = cy + s / 2 + 3;
        ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, bh);
        const g = Math.round(hpPct * 255);
        const rd = Math.round((1 - hpPct) * 255);
        ctx.fillStyle = `rgb(${rd},${g},0)`;
        ctx.fillRect(bx, by, bw * hpPct, bh);
    }
}


// ================================================================
// FOG OF WAR
// ================================================================

function refreshVision() {
    world.updateVision(player.q, player.r, player.vision(), !!player.equipped('reveal_maw'));
}

// ================================================================
// COMBAT
// ================================================================

function buildOccupiedSet() {
    const occupied = new Set(em.enemies.map(e => hexKey(e.q, e.r)));
    occupied.add(hexKey(player.q, player.r));
    return occupied;
}

function enemyOnCorruptedTerrain(enemy, def) {
    if (!def.chaosSpawned) return false;
    const hex = world.getHex(enemy.q, enemy.r);
    return hex && (UNSHATTERED_VERSION[hex.terrain] !== undefined || UNDISTRESSED_VERSION[hex.terrain] !== undefined);
}

function computeMawDistances() {
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

function mawProximityBonus(q, r) {
    if (!mawDistances) return { attack: 0, defense: 0, hp: 0 };
    const dist = mawDistances.get(hexKey(q, r));
    if (dist === undefined) return { attack: 0, defense: 0, hp: 0 };
    const threshold = mawMaxDist * 0.5;
    if (dist > threshold) return { attack: 0, defense: 0, hp: 0 };
    const t = 1 - dist / threshold; // 1 at Maw, 0 at threshold
    return {
        attack: Math.round(10 * t),
        defense: Math.round(5 * t),
        hp: Math.round(10 * t)
    };
}

function enemyEffectiveMaxHp(enemy) {
    const bonus = mawProximityBonus(enemy.q, enemy.r);
    return enemy.maxHp + bonus.hp;
}

function enemyDefense(enemy, def) {
    let d = def.defense + mawProximityBonus(enemy.q, enemy.r).defense;
    if (enemy.defReduction) d = Math.max(0, d - enemy.defReduction);
    if (enemyOnCorruptedTerrain(enemy, def)) d += 2;
    return d;
}

function enemyMeleeAttack(enemy, def) {
    let atk = def.attack + mawProximityBonus(enemy.q, enemy.r).attack;
    if (enemyOnCorruptedTerrain(enemy, def)) atk += 3;
    return atk;
}

function enemyRangedAttack(enemy, def) {
    let atk = (def.rangedAttack || def.attack) + mawProximityBonus(enemy.q, enemy.r).attack;
    if (enemyOnCorruptedTerrain(enemy, def)) atk += 3;
    return atk;
}

function dealDamageToEnemy(enemy, damage, source, opts = {}) {
    const def = em.getDef(enemy.type);
    const rolled = Rando.bellCurve(damage);
    let eDef = enemyDefense(enemy, def);
    if (opts.pierceAmount) eDef = Math.max(0, eDef - opts.pierceAmount);
    const dealt = Math.max(1, rolled - eDef);
    enemy.hp -= dealt;
    logCombat(`${source}: ${dealt} dmg to ${def.name}`, 'log-dmg');
    const killed = enemy.hp <= 0;
    if (killed) killEnemy(enemy);
    return { dealt, killed };
}

function dealDamageToPlayer(damage, source, isSkillDamage, opts = {}) {
    if (opts.isRanged && player.equipped('ranged_immune')) {
        logCombat('Ranged attack negated!', 'log-info');
        return { dealt: 0, avoided: true };
    }
    if (player.warpShieldTurns > 0) {
        player.warpShieldTurns = 0;
        logCombat('Warp Shield absorbed the hit!', 'log-info');
        return { dealt: 0, avoided: true };
    }
    if (Math.random() * 100 < player.dodge()) {
        logCombat('Dodged!', 'log-info');
        return { dealt: 0, avoided: true };
    }
    const rolled = Rando.bellCurve(damage);
    let def = playerDefense();
    if (isSkillDamage) def += Math.round(player.stats.warding / 100 * rolled);
    const dealt = Math.max(1, rolled - def);
    player.hp -= dealt;
    logCombat(`${source}: ${dealt} dmg to you`, 'log-dmg');

    if (opts.attacker && !opts.isRanged) {
        const thornsItem = player.equipped('thorns');
        if (thornsItem) {
            const thornDmg = thornsItem.thornsDamage || Math.round(dealt * (thornsItem.thornsPercent || 50) / 100);
            opts.attacker.hp -= thornDmg;
            logCombat(`Thorns: ${thornDmg} dmg to ${em.getDef(opts.attacker.type).name}`, 'log-dmg');
            if (opts.attacker.hp <= 0) killEnemy(opts.attacker);
        }
        const burnAura = player.equipped('burning_aura');
        if (burnAura) {
            for (const n of hexNeighbors(player.q, player.r)) {
                const adj = em.enemies.find(e => e.q === n.q && e.r === n.r);
                if (adj) {
                    adj.burnDamage = (adj.burnDamage || 0) + burnAura.burnAuraDamage;
                    logCombat(`Burning aura: ${em.getDef(adj.type).name} is burning!`, 'log-dmg');
                }
            }
        }
    }
    if (player.hp <= 0) { player.hp = 0; endGame(false); }
    return { dealt, avoided: false };
}

function killEnemy(enemy) {
    const def = em.getDef(enemy.type);
    em.remove(enemy);
    enemiesDefeated++;
    const goldGain = Rando.int(1, 5) + (def.gold || 0);
    player.gold += goldGain;
    logCombat(`${def.name} defeated!`, 'log-info');
    logCombat(`+${goldGain}g`, 'log-gold');
    if (def.chaosSpawned) {
        player.aether = Math.min(player.maxAether(), player.aether + 1);
        logCombat('+1 AE', 'log-info');
    }
    // Heal on kill
    const healKill = player.equipped('heal_on_kill');
    if (healKill) {
        player.hp = Math.min(player.maxHP(), player.hp + healKill.healOnKill);
        logCombat(`+${healKill.healOnKill} HP (heal on kill)`, 'log-heal');
    }
    gainXP(def.xp);
    // Soul Harvest: bonus XP on kill
    const soulH = player.equipped('soul_harvest');
    if (soulH) {
        gainXP(soulH.soulHarvestXP);
        logCombat(`Soul Harvest: +${soulH.soulHarvestXP} XP`, 'log-xp');
    }
    // Opportunist: chance for bonus gold on kill
    if (player.equipped('opportunist') && Rando.bool(0.25)) {
        const bonusGold = Rando.int(3, 8);
        player.gold += bonusGold;
        logCombat(`Opportunist: +${bonusGold}g`, 'log-gold');
    }

    // Crawler and Guardian drops: 0-3 non-magical + 10% magical
    if (enemy.type === ENEMY_TYPE.BREACH_CRAWLER || enemy.type === ENEMY_TYPE.BREACH_GUARDIAN) {
        const nmDrops = rollNonMagicalDrops(0, 3);
        for (const item of nmDrops) {
            player.inventory.push(item.id);
            logCombat(`Found: ${item.name}`, 'log-gold');
        }
        if (Rando.bool(0.1)) {
            const magicalDrop = rollMagicItem();
            player.inventory.push(magicalDrop.id);
            logCombat(`Found: ${magicalDrop.name}!`, 'log-gold');
        }
    }

    // Check if breach can be closed
    for (const poi of world.pois) {
        if ((poi.type === POI.BREACH || poi.type === POI.MAW) && poi.guardianId === enemy.id) {
            poi.guardianDefeated = true;
            logCombat(`The guardian falls! Use Restore near the breach to seal it.`, 'log-info');
        }
    }
}

function sellPrice(item) { return Math.max(1, Math.floor(item.price * SELL_PRICE_RATIO)); }

function guessSlot(item) {
    if (item.damage !== undefined) return EQUIP_SLOT.WEAPON;
    if (item.defense !== undefined) return EQUIP_SLOT.ARMOR;
    return EQUIP_SLOT.ARTIFACT;
}

function playerHasItem(id) {
    return player.inventory.includes(id) ||
        player.equipment.weapon === id ||
        player.equipment.armor === id ||
        player.equipment.artifact === id;
}

function rollNonMagicalDrops(min, max) {
    const count = Rando.int(min, max);
    const pool = [...NON_MAGICAL_ITEMS];
    Rando.shuffle(pool);
    return pool.slice(0, count);
}

function applyEquipmentBonusDamage(baseDmg) {
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

function meleeAttack(enemy) {
    combatAlerted = true;
    let dmg = applyEquipmentBonusDamage(player.meleeDamage(em.getDef(enemy.type).chaosSpawned));
    const wep = player.weapon();
    const opts = {};
    if (wep && wep.special === 'armor_pierce') opts.pierceAmount = wep.pierceAmount;
    const { killed } = dealDamageToEnemy(enemy, dmg, 'Melee', opts);

    if (!killed && wep && wep.special === 'defense_shred') {
        enemy.defReduction = (enemy.defReduction || 0) + 1;
        logCombat(`Nullblade shreds 1 defense!`, 'log-info');
    }

    // Lifesteal
    if (wep && wep.special === 'lifesteal') {
        const heal = wep.lifestealAmount;
        player.hp = Math.min(player.maxHP(), player.hp + heal);
        logCombat(`+${heal} HP (lifesteal)`, 'log-heal');
    }

    // Aether siphon
    if (wep && wep.special === 'aether_siphon') {
        player.aether = Math.min(player.maxAether(), player.aether + 1);
        logCombat('+1 AE (siphon)', 'log-info');
    }

    // Recoil: self-damage
    if (wep && wep.special === 'recoil') {
        player.hp -= wep.recoilDamage;
        logCombat(`Recoil: ${wep.recoilDamage} dmg to you`, 'log-dmg');
        if (player.hp <= 0) { player.hp = 0; endGame(false); }
    }

    // Double strike: hit same enemy again
    if (!killed && wep && wep.special === 'double_strike') {
        dealDamageToEnemy(enemy, dmg, 'Double Strike', opts);
    }

    // Burn: mark target for damage next turn (melee)
    if (wep && wep.special === 'burn' && enemy.hp > 0) {
        enemy.burnDamage = (enemy.burnDamage || 0) + wep.burnDamage;
        logCombat(`${em.getDef(enemy.type).name} is burning!`, 'log-dmg');
    }

    // Cleave: hit adjacent enemies too
    if (wep && wep.special === 'cleave') {
        const adj = hexNeighbors(enemy.q, enemy.r);
        for (const n of adj) {
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
    return { killed };
}

function knockbackHex(fromQ, fromR, targetQ, targetR) {
    // Push target 1 hex away from source
    const dq = targetQ - fromQ, dr = targetR - fromR;
    // Normalize to nearest hex direction
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

function rangedAttack(targetQ, targetR) {
    combatAlerted = true;
    const enemy = em.enemies.find(e => e.q === targetQ && e.r === targetR);
    if (!enemy) return;
    const wep = player.weapon();
    const dist = hexDistance(player.q, player.r, targetQ, targetR);
    const eDef = em.getDef(enemy.type);
    let dmg = applyEquipmentBonusDamage(player.rangedDamage(dist, eDef.chaosSpawned));

    // Fire primary shot
    const rangedOpts = {};
    if (wep && wep.special === 'armor_pierce') rangedOpts.pierceAmount = wep.pierceAmount;
    if (wep && wep.special === 'ignore_defense') {
        const actualDmg = Math.max(1, dmg);
        enemy.hp -= actualDmg;
        logCombat(`Ranged: ${actualDmg} dmg to ${em.getDef(enemy.type).name}`, 'log-dmg');
        if (enemy.hp <= 0) killEnemy(enemy);
    } else if (wep && wep.special === 'double_shot') {
        dealDamageToEnemy(enemy, dmg, 'Shot 1', rangedOpts);
        if (enemy.hp > 0) dealDamageToEnemy(enemy, dmg, 'Shot 2', rangedOpts);
    } else {
        dealDamageToEnemy(enemy, dmg, 'Ranged', rangedOpts);
    }

    // Burn: mark target for damage next turn
    if (wep && wep.special === 'burn' && enemy.hp > 0) {
        enemy.burnDamage = (enemy.burnDamage || 0) + wep.burnDamage;
        logCombat(`${em.getDef(enemy.type).name} is burning!`, 'log-dmg');
    }

    // Chain: damage bounces to nearby enemies
    if (wep && wep.special === 'chain') {
        const chainDmgBase = wep.chainDamage || Math.ceil(dmg / 2);
        chainBounce('Chain', chainDmgBase, targetQ, targetR, wep.chainCount || 1, 2, new Set([enemy]), false);
    }

    // Splash: flat damage to all adjacent enemies
    if (wep && wep.special === 'splash') {
        const adj = hexNeighbors(targetQ, targetR);
        for (const n of adj) {
            const splashTarget = em.enemies.find(e => e.q === n.q && e.r === n.r && e !== enemy);
            if (splashTarget) {
                const sDmg = Math.max(1, wep.splashDamage - enemyDefense(splashTarget, em.getDef(splashTarget.type)));
                splashTarget.hp -= sDmg;
                logCombat(`Splash: ${sDmg} dmg to ${em.getDef(splashTarget.type).name}`, 'log-dmg');
                if (splashTarget.hp <= 0) killEnemy(splashTarget);
            }
        }
    }

    // Piercing: continue through target to hit next enemy in line
    if (wep && wep.special === 'piercing') {
        const kb = knockbackHex(player.q, player.r, targetQ, targetR);
        const dq = kb.q - targetQ, dr = kb.r - targetR;
        for (let i = 1; i <= wep.range - dist; i++) {
            const pq = targetQ + dq * i, pr = targetR + dr * i;
            const pierceTarget = em.enemies.find(e => e.q === pq && e.r === pr);
            if (pierceTarget) {
                dealDamageToEnemy(pierceTarget, dmg, 'Pierce');
                break;
            }
            const hex = world.getHex(pq, pr);
            if (!hex || hex.terrain === TERRAIN.MOUNTAIN) break;
        }
    }

    // Knockback: push target 1 hex away
    if (wep && wep.special === 'knockback' && enemy.hp > 0) {
        const dest = knockbackHex(player.q, player.r, targetQ, targetR);
        const hex = world.getHex(dest.q, dest.r);
        const occupied = em.enemies.some(e => e.q === dest.q && e.r === dest.r);
        if (hex && world.isPassable(hex) && !occupied && !(dest.q === player.q && dest.r === player.r)) {
            enemy.q = dest.q;
            enemy.r = dest.r;
            logCombat(`Knocked back!`, 'log-info');
        }
    }

    // Ranged attack costs 1 aether (unless free or non-magical)
    if (wep && wep.magical && wep.special !== 'free_ranged') {
        player.aether = Math.max(0, player.aether - 1);
    }
    player.mp = 0; // ends movement
}

function gainXP(amount) {
    player.xp += amount;
    logCombat(`+${amount} XP`, 'log-xp');
    const needed = xpForLevel(player.level + 1);
    if (player.xp >= needed && player.level < 10) {
        player.level++;
        player.xp -= needed;
        player.hp = player.maxHP();
        player.aether = player.maxAether();
        player.statPoints += STAT_POINTS_PER_LEVEL;
        logCombat(`LEVEL UP! Now level ${player.level}`, 'log-info');
        // Check skill unlock
        if (SKILL_UNLOCK_LEVELS.includes(player.level)) {
            player.pendingSkillChoice = true;
        }
        // Show level-up dialog after a short delay
        setTimeout(() => showLevelUpDialog(), 300);
    }
}

// ================================================================
// SKILL EXECUTION
// ================================================================

function applyAoeDamage(skillName, dmg, range) {
    for (const h of hexesInRange(player.q, player.r, range)) {
        const enemy = em.enemyAt(h.q, h.r);
        if (enemy) dealDamageToEnemy(enemy, dmg, skillName);
    }
}

function applyAoeDamageAt(skillName, dmg, centerQ, centerR, range) {
    for (const h of hexesInRange(centerQ, centerR, range)) {
        const enemy = em.enemyAt(h.q, h.r);
        if (enemy) dealDamageToEnemy(enemy, dmg, skillName);
    }
}

function pushEnemyAway(enemy, fromQ, fromR) {
    const dest = knockbackHex(fromQ, fromR, enemy.q, enemy.r);
    const hex = world.getHex(dest.q, dest.r);
    const occupied = em.enemies.some(e => e !== enemy && e.q === dest.q && e.r === dest.r);
    if (hex && world.isPassable(hex) && !occupied && !(dest.q === player.q && dest.r === player.r)) {
        enemy.q = dest.q;
        enemy.r = dest.r;
    }
}

function chainBounce(skillName, dmg, startQ, startR, bounceCount, bounceRange, hitSet, useBellCurve) {
    let curQ = startQ, curR = startR;
    for (let i = 0; i < bounceCount; i++) {
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
            if (closest.hp <= 0) killEnemy(closest);
        }
        curQ = closest.q; curR = closest.r;
    }
}

function checkSkillUsage(skill) {
    const usage = skill.usage || SKILL_USAGE.ANYTIME;
    if (usage === SKILL_USAGE.ANYTIME) return null;
    // Non-combat and pristine both require no enemies within 2
    const nearbyEnemy = em.enemies.some(e => hexDistance(player.q, player.r, e.q, e.r) <= 2);
    if (nearbyEnemy) return 'Too close to enemies!';
    if (usage === SKILL_USAGE.PRISTINE) {
        const hex = world.getHex(player.q, player.r);
        if (hex && UNSHATTERED_VERSION[hex.terrain] !== undefined) return 'Cannot use on shattered terrain!';
    }
    return null;
}

function executeSkill(skillId, targetQ, targetR) {
    const skill = SKILLS[skillId];
    if (!skill) return;
    if (player.aether < skill.cost) { logCombat('Not enough Aether!', 'log-info'); return; }
    if (player.usedSkillsThisTurn.has(skillId)) { logCombat('Already used this turn!', 'log-info'); return; }

    player.aether -= skill.cost;
    player.usedSkillsThisTurn.add(skillId);
    combatAlerted = true;

    let usedMP = true; // most skills consume MP; free actions set this false

    switch (skillId) {
        case 'restore': {
            const range = 1 + Math.floor(player.level / 3);
            const shatteredHexes = hexesInRange(player.q, player.r, range)
                .map(h => world.getHex(h.q, h.r))
                .filter(h => h && UNSHATTERED_VERSION[h.terrain] !== undefined);
            // Check for breaches in range
            const breachInRange = world.pois.find(p =>
                (p.type === POI.BREACH || p.type === POI.MAW) &&
                p.guardianDefeated && !p.closed &&
                hexDistance(player.q, player.r, p.q, p.r) <= range
            );
            if (shatteredHexes.length === 0 && !breachInRange) {
                logCombat('No shattered terrain in range!', 'log-info');
                player.usedSkillsThisTurn.delete(skillId);
                usedMP = false;
                break;
            }
            // Restore shattered hexes to normal
            for (const hex of shatteredHexes) {
                hex.terrain = UNSHATTERED_VERSION[hex.terrain];
            }
            // Decrement shatteredCount within 3 of each restored hex
            for (const hex of shatteredHexes) {
                for (const coord of hexesInRange(hex.q, hex.r, 3)) {
                    const h = world.getHex(coord.q, coord.r);
                    if (h) h.shatteredCount = Math.max(0, h.shatteredCount - 1);
                }
            }
            // Revert distressed hexes that dropped to 0; distress restored hexes still near shatters
            const checked = new Set();
            for (const hex of shatteredHexes) {
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
                // The restored hex itself: if still near other shatters, distress it
                if (hex.shatteredCount > 0 && DISTRESSED_VERSION[hex.terrain] !== undefined) {
                    hex.terrain = DISTRESSED_VERSION[hex.terrain];
                }
            }
            // Gain 1 AE
            player.aether = Math.min(player.maxAether(), player.aether + 1);
            // 16% chance per hex to find gold
            let goldFound = 0;
            for (let i = 0; i < shatteredHexes.length; i++) {
                if (Rando.bool(0.16)) goldFound++;
            }
            if (goldFound > 0) player.gold += goldFound;
            player.mp = 0; // ends turn
            if (shatteredHexes.length > 0) {
                gainXP(shatteredHexes.length * 3);
                let msg = `Restored ${shatteredHexes.length} hex${shatteredHexes.length > 1 ? 'es' : ''}! +1 AE`;
                if (goldFound > 0) msg += `, +${goldFound}g`;
                logCombat(msg, 'log-heal');
            }
            // Settlement gratitude: reward if restore cleared hexes near a haven/village
            if (shatteredHexes.length > 0) {
                const restoredKeys = new Set(shatteredHexes.map(h => hexKey(h.q, h.r)));
                const allCleared = new Set();
                for (const hex of shatteredHexes) {
                    for (const coord of hexesInRange(hex.q, hex.r, 3)) {
                        allCleared.add(hexKey(coord.q, coord.r));
                    }
                }
                for (const poi of world.pois) {
                    if (poi.type !== POI.HAVEN && poi.type !== POI.VILLAGE) continue;
                    if (!allCleared.has(hexKey(poi.q, poi.r))) continue;
                    const isHaven = poi.type === POI.HAVEN;
                    const reward = isHaven ? Rando.int(5, 20) : Rando.int(1, 10);
                    const name = isHaven ? 'Haven' : 'Village';
                    const symbol = POI_SYMBOLS[poi.type];
                    const havenMessages = [
                        'The garrison salutes you. "The realm stands stronger for your service."',
                        'A captain approaches with a pouch of coin. "The crown recognizes your valor."',
                        'The haven\'s council offers a formal thanks and a modest stipend.',
                        '"We feared the corruption would reach our walls. You have our gratitude."',
                        'A herald announces your deed to the fortress. Soldiers raise their blades in honor.',
                        '"The mages sensed the restoration. The haven is in your debt, warrior."',
                        'The keep\'s steward presents you with a reward from the treasury.',
                        '"Few would brave the chaos as you have. Accept this with our thanks."',
                        'Word of your deed spreads quickly through the haven. A collection is taken.',
                        'The haven commander clasps your hand. "You\'ve bought us time. Use this well."',
                    ];
                    const villageMessages = [
                        'A farmer presses a few coins into your hand. "Bless you, stranger."',
                        'The village elder hobbles over with a small pouch. "It ain\'t much, but it\'s honest."',
                        'Children run out to greet you. Their parents follow with a modest gift.',
                        '"Our crops might grow again, thanks to you." A villager offers what they can spare.',
                        'An old woman waves you over. "Take this. You\'ve earned more than we can give."',
                        'The innkeeper sets out a meal and slides some coin across the table.',
                        '"We thought we\'d have to abandon our homes. Thank you." They pass the hat.',
                        'A shepherd offers a pouch of coin. "The flock can graze safely now."',
                        'Smoke rises from the village hearths again. A grateful elder finds you.',
                        '"Stranger, you\'ve given us hope." The village pools together a small reward.',
                    ];
                    const msg = Rando.choice(isHaven ? havenMessages : villageMessages);
                    showDialog(`${symbol} ${name}`, `<p>${msg}</p><p style="color:#ffc107">Offering: ${reward} gold</p>`, [
                        { label: 'Accept', cls: 'primary', action: () => { player.gold += reward; logCombat(`+${reward}g from ${name.toLowerCase()}`, 'log-gold'); }},
                        { label: 'Decline' }
                    ]);
                    break;
                }
            }
            // Attempt to seal a breach in range
            if (breachInRange) {
                const chance = breachInRange.type === POI.MAW ? 0.20 : 0.40;
                if (Rando.bool(chance)) {
                    closeBreach(breachInRange);
                    if (breachInRange.type === POI.MAW) endGame(true);
                } else {
                    showDialog('Restore', 'Restore did not close the breach.', [{ label: 'OK', cls: 'btn-primary' }]);
                }
            }
            break;
        }
        case 'void_strike': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            const wep = player.weapon();
            const dmg = (wep ? wep.damage : 1) + player.stats.might + player.stats.warding;
            dealDamageToEnemy(enemy, dmg, 'Void Strike');
            break;
        }
        case 'phase_step': {
            player.q = targetQ;
            player.r = targetR;
            refreshVision();
            logCombat('Phase Step!', 'log-info');
            checkHexEntry();
            usedMP = false; // free action
            break;
        }
        case 'cosmic_bolt': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            dealDamageToEnemy(enemy, skill.baseDamage + player.stats.warding, 'Cosmic Bolt');
            break;
        }
        case 'warp_shield': {
            player.warpShieldTurns = skill.duration;
            logCombat('Warp Shield active!', 'log-info');
            break;
        }
        case 'breach_pulse': {
            const dmg = skill.baseDamage + player.stats.warding;
            applyAoeDamage('Breach Pulse', dmg, skill.range);
            break;
        }
        case 'mending_light': {
            const heal = skill.baseHeal + player.stats.vigor * 3;
            player.hp = Math.min(player.maxHP(), player.hp + heal);
            logCombat(`Healed ${heal} HP`, 'log-heal');
            break;
        }
        case 'gravity_well': {
            for (const h of hexesInRange(player.q, player.r, skill.range)) {
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
            break;
        }
        case 'dimensional_rend': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            const wep = player.weapon();
            dealDamageToEnemy(enemy, (wep ? wep.damage : 1) * 3, 'Dimensional Rend');
            break;
        }
        case 'starfall': {
            applyAoeDamage('Starfall', skill.baseDamage + player.stats.warding * 2, skill.range);
            break;
        }
        case 'shockwave': {
            const dmg = skill.baseDamage + player.stats.might;
            const hits = [];
            for (const h of hexesInRange(player.q, player.r, skill.range)) {
                const enemy = em.enemyAt(h.q, h.r);
                if (enemy) {
                    dealDamageToEnemy(enemy, dmg, 'Shockwave');
                    if (enemy.hp > 0) hits.push(enemy);
                }
            }
            for (const enemy of hits) pushEnemyAway(enemy, player.q, player.r);
            logCombat('Shockwave!', 'log-info');
            break;
        }
        case 'siphon_strike': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            const wep = player.weapon();
            const dmg = (wep ? wep.damage : 1) + player.stats.might;
            const rolled = Rando.bellCurve(dmg);
            const eDef = enemyDefense(enemy, em.getDef(enemy.type));
            const actualDmg = Math.max(1, rolled - eDef);
            enemy.hp -= actualDmg;
            logCombat(`Siphon Strike: ${actualDmg} dmg to ${em.getDef(enemy.type).name}`, 'log-dmg');
            player.hp = Math.min(player.maxHP(), player.hp + actualDmg);
            logCombat(`+${actualDmg} HP (siphon)`, 'log-heal');
            if (enemy.hp <= 0) killEnemy(enemy);
            break;
        }
        case 'piercing_shot': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            const dmg = skill.baseDamage + player.stats.reflex;
            const actualDmg = Math.max(1, dmg);
            enemy.hp -= actualDmg;
            logCombat(`Piercing Shot: ${actualDmg} dmg to ${em.getDef(enemy.type).name}`, 'log-dmg');
            if (enemy.hp <= 0) killEnemy(enemy);
            break;
        }
        case 'chain_lightning': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            const dmg = skill.baseDamage + player.stats.warding;
            dealDamageToEnemy(enemy, dmg, 'Chain Lightning');
            const hitSet = new Set([enemy]);
            chainBounce('Chain Lightning', skill.chainDamage, targetQ, targetR, skill.chainCount, skill.chainRange, hitSet, false);
            break;
        }
        case 'immolate': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            const wep = player.weapon();
            const dmg = (wep ? wep.damage : 1) + player.stats.might;
            dealDamageToEnemy(enemy, dmg, 'Immolate');
            if (enemy.hp > 0) {
                enemy.burnDamage = (enemy.burnDamage || 0) + skill.burnDamage;
                logCombat(`${em.getDef(enemy.type).name} is burning!`, 'log-dmg');
            }
            break;
        }
        case 'sundering_blow': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            const wep = player.weapon();
            const dmg = (wep ? wep.damage : 1) + player.stats.might;
            dealDamageToEnemy(enemy, dmg, 'Sundering Blow');
            if (enemy.hp > 0) {
                enemy.defReduction = (enemy.defReduction || 0) + skill.shredAmount;
                logCombat(`Sundered ${skill.shredAmount} defense!`, 'log-info');
            }
            break;
        }
        case 'meteor': {
            const dmg = skill.baseDamage + player.stats.warding;
            applyAoeDamageAt('Meteor', dmg, targetQ, targetR, skill.aoeRange);
            logCombat('Meteor!', 'log-info');
            break;
        }
        case 'execute': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            const wep = player.weapon();
            const dmg = (wep ? wep.damage : 1) * 2 + player.stats.might * 2;
            dealDamageToEnemy(enemy, dmg, 'Execute');
            break;
        }
        case 'ricochet': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            const dmg = skill.baseDamage + player.stats.reflex;
            dealDamageToEnemy(enemy, dmg, 'Ricochet');
            const hitSet = new Set([enemy]);
            chainBounce('Ricochet', dmg, targetQ, targetR, skill.bounceCount, skill.bounceRange, hitSet, true);
            break;
        }
        case 'void_salvo': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            const dmg = skill.baseDamage + player.stats.reflex;
            for (let i = 0; i < skill.shotCount; i++) {
                if (enemy.hp <= 0) break;
                dealDamageToEnemy(enemy, dmg, `Salvo ${i + 1}`);
            }
            break;
        }
        // ---- Non-combat skills ----
        case 'aether_tap': {
            let cleanCount = 0;
            for (const h of hexesInRange(player.q, player.r, skill.range)) {
                const hex = world.getHex(h.q, h.r);
                if (!hex || !world.isPassable(hex)) continue;
                // Healthy = not shattered, not distressed
                if (UNSHATTERED_VERSION[hex.terrain] !== undefined) continue;
                if (UNDISTRESSED_VERSION[hex.terrain] !== undefined) continue;
                cleanCount++;
            }
            const aeGain = Math.floor(cleanCount / 6);
            if (aeGain <= 0) {
                logCombat('No healthy land nearby!', 'log-info');
                player.usedSkillsThisTurn.delete(skillId);
                usedMP = false;
                break;
            }
            player.aether = Math.min(player.maxAether(), player.aether + aeGain);
            logCombat(`Aether Tap: +${aeGain} AE (${cleanCount} clean hexes)`, 'log-info');
            player.mp = 0;
            break;
        }
        case 'farsight': {
            const farRange = skill.range || 12;
            for (const h of hexesInRange(player.q, player.r, farRange)) {
                const key = hexKey(h.q, h.r);
                if (world.hexes.has(key)) {
                    world.revealed.add(key);
                    world.visible.add(key);
                }
            }
            logCombat('Farsight! Vision expanded.', 'log-info');
            usedMP = false; // free action
            break;
        }
        case 'prospect': {
            // Reveal hexes with gold deposits within 8
            let revealed = 0;
            for (const h of hexesInRange(player.q, player.r, skill.revealRange)) {
                const hex = world.getHex(h.q, h.r);
                if (hex && hex.goldDeposit > 0) {
                    const key = hexKey(h.q, h.r);
                    if (!world.revealed.has(key)) revealed++;
                    world.revealed.add(key);
                }
            }
            // 20% chance to create a gold deposit on a random passable hex within 4
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
            break;
        }
        case 'commune': {
            let poiCount = 0;
            for (const poi of world.pois) {
                const key = hexKey(poi.q, poi.r);
                if (!world.revealed.has(key)) poiCount++;
                world.revealed.add(key);
            }
            if (poiCount > 0) logCombat(`Commune: revealed ${poiCount} location${poiCount > 1 ? 's' : ''}!`, 'log-info');
            else logCombat('Commune: the world has no more secrets.', 'log-info');
            break;
        }
        case 'salvage': {
            const salvageRange = skill.range;
            const salvageHexes = hexesInRange(player.q, player.r, salvageRange)
                .map(h => world.getHex(h.q, h.r))
                .filter(h => h && UNSHATTERED_VERSION[h.terrain] !== undefined);
            if (salvageHexes.length === 0) {
                logCombat('No shattered terrain nearby to salvage!', 'log-info');
                player.usedSkillsThisTurn.delete(skillId);
                usedMP = false;
                break;
            }
            // Restore shattered hexes (same as restore skill)
            for (const hex of salvageHexes) {
                hex.terrain = UNSHATTERED_VERSION[hex.terrain];
            }
            for (const hex of salvageHexes) {
                for (const coord of hexesInRange(hex.q, hex.r, 3)) {
                    const h = world.getHex(coord.q, coord.r);
                    if (h) h.shatteredCount = Math.max(0, h.shatteredCount - 1);
                }
            }
            const checkedSalv = new Set();
            for (const hex of salvageHexes) {
                for (const coord of hexesInRange(hex.q, hex.r, 3)) {
                    const key = hexKey(coord.q, coord.r);
                    if (checkedSalv.has(key)) continue;
                    checkedSalv.add(key);
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
            // Drop 1-10 gold deposit on each restored hex
            let totalGold = 0;
            for (const hex of salvageHexes) {
                const gold = Rando.int(1, 10);
                hex.goldDeposit = (hex.goldDeposit || 0) + gold;
                totalGold += gold;
            }
            logCombat(`Salvage: restored ${salvageHexes.length} hex${salvageHexes.length > 1 ? 'es' : ''}, ${totalGold}g in deposits!`, 'log-gold');
            player.mp = 0;
            break;
        }
        case 'skill_seek': {
            const chance = player.level * 0.05;
            if (Rando.bool(chance)) {
                logCombat('Insight! A new skill reveals itself!', 'log-info');
                // Trigger skill choice dialog
                player.pendingSkillChoice = true;
                setTimeout(() => showSkillChoiceDialog(), 300);
            } else {
                logCombat('The patterns elude you...', 'log-info');
            }
            break;
        }
        case 'spirit_walk': {
            player.q = targetQ;
            player.r = targetR;
            refreshVision();
            logCombat('Spirit Walk!', 'log-info');
            checkHexEntry();
            player.mp = 0;
            break;
        }
        case 'ground_weeps': {
            // Compute threat heatmap
            threatOverlay = new Map();
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
                if (threat > 0) threatOverlay.set(key, threat);
            }
            logCombat('The ground weeps... threats revealed.', 'log-info');
            // Don't end turn yet — overlay persists until dismissed
            player.usedSkillsThisTurn.delete(skillId);
            usedMP = false;
            break;
        }
        case 'sanctuary': {
            const pHex = world.getHex(player.q, player.r);
            const existingPoi = world.poiAt(player.q, player.r);
            if (existingPoi) {
                logCombat('Cannot sanctify — already a point of interest!', 'log-info');
                player.usedSkillsThisTurn.delete(skillId);
                player.aether += skill.cost; // refund
                usedMP = false;
                break;
            }
            // Create temporary village POI
            const tempVillage = { q: player.q, r: player.r, type: POI.VILLAGE, id: world.pois.length, temporary: true };
            world.pois.push(tempVillage);
            pHex.poi = POI.VILLAGE;
            logCombat('Sanctuary! A temporary village appears.', 'log-heal');
            break;
        }
        case 'bountiful_harvest': {
            let crops = 0;
            for (const h of hexesInRange(player.q, player.r, skill.range)) {
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
            break;
        }
        case 'recall': {
            const havens = world.havens();
            if (havens.length === 0) {
                logCombat('No havens exist!', 'log-info');
                player.usedSkillsThisTurn.delete(skillId);
                player.aether += skill.cost;
                usedMP = false;
                break;
            }
            let nearest = havens[0], nearestDist = Infinity;
            for (const h of havens) {
                const d = hexDistance(player.q, player.r, h.q, h.r);
                if (d < nearestDist) { nearestDist = d; nearest = h; }
            }
            player.q = nearest.q;
            player.r = nearest.r;
            refreshVision();
            logCombat(`Recall! Teleported to haven.`, 'log-info');
            player.mp = 0;
            break;
        }
        case 'loot': {
            const enemy = em.enemyAt(targetQ, targetR);
            if (!enemy) break;
            const goldStolen = Rando.int(1, 5);
            player.gold += goldStolen;
            logCombat(`Looted ${goldStolen}g!`, 'log-gold');
            break;
        }
        case 'havens_light': {
            const poi = world.poiAt(player.q, player.r);
            if (!poi || (poi.type !== POI.HAVEN && poi.type !== POI.VILLAGE)) {
                logCombat('Must be at a haven or village!', 'log-info');
                player.aether += skill.cost;
                player.usedSkillsThisTurn.delete(skillId);
                usedMP = false;
                break;
            }
            const dmg = skill.baseDamage;
            const adj = hexNeighbors(player.q, player.r);
            let hitCount = 0;
            for (const n of adj) {
                const enemy = em.enemyAt(n.q, n.r);
                if (enemy) {
                    dealDamageToEnemy(enemy, dmg, "Haven's Light");
                    hitCount++;
                }
            }
            logCombat(`Haven's Light: hit ${hitCount} enemies!`, 'log-info');
            break;
        }
    }
    if (usedMP && !skill.freeAction) player.mp = 0;
    targeting = null;
}

function getSkillTargets(skillId) {
    const skill = SKILLS[skillId];
    if (!skill) return new Set();
    // Haven's Light: only targetable at haven or village
    if (skillId === 'havens_light') {
        const poi = world.poiAt(player.q, player.r);
        if (!poi || (poi.type !== POI.HAVEN && poi.type !== POI.VILLAGE)) return new Set();
    }
    const targets = new Set();

    switch (skill.target) {
        case SKILL_TARGET.SELF:
            targets.add(hexKey(player.q, player.r));
            break;
        case SKILL_TARGET.MELEE: {
            const adj = hexNeighbors(player.q, player.r);
            for (const n of adj) {
                if (em.enemies.some(e => e.q === n.q && e.r === n.r)) targets.add(hexKey(n.q, n.r));
            }
            break;
        }
        case SKILL_TARGET.MELEE_EXECUTE: {
            const adj = hexNeighbors(player.q, player.r);
            for (const n of adj) {
                const enemy = em.enemies.find(e => e.q === n.q && e.r === n.r);
                if (enemy && enemy.hp <= enemyEffectiveMaxHp(enemy) / 2) targets.add(hexKey(n.q, n.r));
            }
            break;
        }
        case SKILL_TARGET.RANGED: {
            const range = skill.range || 4;
            const inRange = hexesInRange(player.q, player.r, range);
            for (const h of inRange) {
                if (h.q === player.q && h.r === player.r) continue;
                if (em.enemies.some(e => e.q === h.q && e.r === h.r) && world.hasLOS(player, h)) {
                    targets.add(hexKey(h.q, h.r));
                }
            }
            break;
        }
        case SKILL_TARGET.RANGED_AOE: {
            const range = skill.range || 4;
            const inRange = hexesInRange(player.q, player.r, range);
            for (const h of inRange) {
                if (h.q === player.q && h.r === player.r) continue;
                const hex = world.getHex(h.q, h.r);
                if (hex && world.visible.has(hexKey(h.q, h.r)) && world.hasLOS(player, h)) {
                    targets.add(hexKey(h.q, h.r));
                }
            }
            break;
        }
        case SKILL_TARGET.TELEPORT: {
            const range = skill.range || 3;
            const inRange = hexesInRange(player.q, player.r, range);
            for (const h of inRange) {
                const key = hexKey(h.q, h.r);
                if (h.q === player.q && h.r === player.r) continue;
                const hex = world.getHex(h.q, h.r);
                if (!hex || !world.isPassable(hex)) continue;
                if (em.enemies.some(e => e.q === h.q && e.r === h.r)) continue;
                if (world.visible.has(key)) targets.add(key);
            }
            break;
        }
        case SKILL_TARGET.TELEPORT_REVEALED: {
            const range = skill.range || 6;
            const inRange = hexesInRange(player.q, player.r, range);
            for (const h of inRange) {
                const key = hexKey(h.q, h.r);
                if (h.q === player.q && h.r === player.r) continue;
                const hex = world.getHex(h.q, h.r);
                if (!hex || !world.isPassable(hex)) continue;
                if (em.enemies.some(e => e.q === h.q && e.r === h.r)) continue;
                if (world.revealed.has(key)) targets.add(key);
            }
            break;
        }
        case SKILL_TARGET.AOE_SELF:
            targets.add(hexKey(player.q, player.r));
            break;
    }
    return targets;
}


// ================================================================
// MOVEMENT & TURN LOGIC
// ================================================================

function selectPlayer() {
    if (phase !== 'player' || gameOver) return;
    selected = true;
    computeReachable();
}

function deselectPlayer() {
    selected = false;
    reachable = null;
    attackable = null;
}

function computeReachable() {
    if (player.mp <= 0) { reachable = new Map(); attackable = new Set(); return; }
    const enemyKeys = new Set(em.enemies.map(e => hexKey(e.q, e.r)));
    const hasStrider = !!player.equipped('strider');
    reachable = bfsHexes(player, world.hexes, hex => {
        if (enemyKeys.has(hexKey(hex.q, hex.r))) return Infinity;
        const baseCost = MOVEMENT_COST[hex.terrain] ?? Infinity;
        return (hasStrider && baseCost > 1 && baseCost !== Infinity) ? 1 : baseCost;
    }, player.mp);
    reachable.delete(hexKey(player.q, player.r));

    // Attackable: enemy hexes adjacent to any reachable hex (or current position)
    attackable = new Set();
    // Can attack enemies adjacent to player's current position
    for (const n of hexNeighbors(player.q, player.r)) {
        const nk = hexKey(n.q, n.r);
        if (enemyKeys.has(nk)) attackable.add(nk);
    }
    // Can attack enemies adjacent to reachable hexes (need to move there first, cost permitting)
    for (const [key] of reachable) {
        const { q, r } = parseHexKey(key);
        for (const n of hexNeighbors(q, r)) {
            const nk = hexKey(n.q, n.r);
            if (enemyKeys.has(nk)) attackable.add(nk);
        }
    }
    // Blink Ring: can attack enemies within blink range
    const blinkItem = player.equipped('blink_ring');
    if (blinkItem) {
        const blinkRange = blinkItem.blinkRange || 4;
        for (const enemy of em.enemies) {
            const dist = hexDistance(player.q, player.r, enemy.q, enemy.r);
            if (dist <= blinkRange && dist > 1) {
                attackable.add(hexKey(enemy.q, enemy.r));
            }
        }
    }
}

function checkEndTurn() {
    if (!gameOver && player.mp <= 0 && phase === 'player') endTurn();
}

function resolveEndTurn() {
    if (endTurnResolve) { const r = endTurnResolve; endTurnResolve = null; r(); }
}

function movePlayer(q, r) {
    const key = hexKey(q, r);
    const cost = reachable.get(key);
    if (cost === undefined) return;

    player.q = q;
    player.r = r;
    player.mp -= cost;
    player.movedThisTurn = true;
    player.hexesMovedThisTurn += cost;
    refreshVision();
    checkHexEntry();
    deselectPlayer();
}

function moveAndAttack(enemyQ, enemyR) {
    const enemy = em.enemies.find(e => e.q === enemyQ && e.r === enemyR);
    if (!enemy) return;

    // Blink Ring: teleport to random adjacent hex if within blink range
    const blinkItemAtk = player.equipped('blink_ring');
    if (blinkItemAtk) {
        const dist = hexDistance(player.q, player.r, enemyQ, enemyR);
        if (dist > 1 && dist <= (blinkItemAtk.blinkRange || 4)) {
            const adjHexesBlink = hexNeighbors(enemyQ, enemyR).filter(n => {
                const h = world.getHex(n.q, n.r);
                if (!h || !world.isPassable(h)) return false;
                if (em.enemies.some(e => e.q === n.q && e.r === n.r)) return false;
                return true;
            });
            if (adjHexesBlink.length > 0) {
                const dest = Rando.choice(adjHexesBlink);
                player.q = dest.q;
                player.r = dest.r;
                player.movedThisTurn = true;
                refreshVision();
                logCombat(`Blink Ring: teleported!`, 'log-info');
                const origMight = player.stats.might;
                player.stats.might += blinkItemAtk.blinkBonus;
                const { killed } = meleeAttack(enemy);
                player.stats.might = origMight;
                if (killed) {
                    const hex = world.getHex(enemyQ, enemyR);
                    if (hex && world.isPassable(hex)) {
                        player.q = enemyQ; player.r = enemyR;
                        refreshVision();
                        checkHexEntry();
                    }
                }
                player.mp = 0;
                deselectPlayer();
                return;
            }
        }
    }

    // Find best adjacent hex to attack from
    const adjHexes = hexNeighbors(enemyQ, enemyR);
    let bestHex = null, bestCost = Infinity;

    // Check if already adjacent
    if (hexDistance(player.q, player.r, enemyQ, enemyR) === 1) {
        bestHex = { q: player.q, r: player.r };
        bestCost = 0;
    } else {
        for (const n of adjHexes) {
            const nk = hexKey(n.q, n.r);
            const cost = reachable ? reachable.get(nk) : undefined;
            if (cost !== undefined && cost < bestCost) { bestCost = cost; bestHex = n; }
        }
    }

    if (!bestHex) return;

    // Move to adjacent hex if not already there
    if (bestCost > 0) {
        player.q = bestHex.q;
        player.r = bestHex.r;
        player.mp -= bestCost;
        player.movedThisTurn = true;
        player.hexesMovedThisTurn += bestCost;
        refreshVision();
    }

    // Attack
    const { killed } = meleeAttack(enemy);
    if (killed) {
        const hex = world.getHex(enemyQ, enemyR);
        if (hex && world.isPassable(hex)) {
            let moveCost = MOVEMENT_COST[hex.terrain] ?? 1;
            if (player.equipped('strider') && moveCost > 1 && moveCost !== Infinity) moveCost = 1;
            if (player.mp >= moveCost) {
                player.q = enemyQ;
                player.r = enemyR;
                player.mp -= moveCost;
                refreshVision();
                checkHexEntry();
            }
        }
    }

    deselectPlayer();
}

function checkHexEntry() {
    const hex = world.getHex(player.q, player.r);
    if (!hex) return;

    // Gold pickup
    if (hex.goldDeposit > 0) {
        const multiplier = hex.terrain === TERRAIN.SHATTERED_GOLD ? 2 : 1;
        const goldAmt = hex.goldDeposit * multiplier;
        player.gold += goldAmt;
        hex.goldDeposit = 0;
        logCombat(`+${goldAmt}g (${hex.crop ? 'harvest' : 'gold deposit'})`, 'log-gold');
        hex.crop = false;
    }

    tryPoiInteract();
}

function closeBreach(poi) {
    world.closeBreach(poi);
    logCombat(`Breach sealed! (${world.breachesClosed} total)`, 'log-info');
    render();
}

function tryPoiInteract() {
    if (poiInteracted) return false;
    const poi = world.poiAt(player.q, player.r);
    if (!poi) return false;
    poiInteracted = true;
    if (poi.type === POI.HAVEN) { showHavenDialog(poi); return true; }
    if (poi.type === POI.VILLAGE) { showVillageDialog(poi); return true; }
    if (poi.type === POI.HUT) { showHutDialog(poi); return true; }
    if (poi.type === POI.RUIN) { tryRuinInteraction(poi); return true; }
    return false;
}

function interactOrEndTurn() {
    if (gameOver || phase !== 'player') return;
    if (tryPoiInteract()) return;
    endTurn();
}

function endTurn() {
    if (gameOver) return;
    deselectPlayer();
    resolveEndTurn();
}

// Returns true if either of the enemy's before/after positions is currently visible.
function enemyIsVisible(enemy, prevKey) {
    return world.visible.has(prevKey) || world.visible.has(hexKey(enemy.q, enemy.r));
}

function moveEnemyStep(enemy, def, dist, aggro, prefersRanged, occupied) {
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

function enemyCanRangedAttack(enemy, def, newDist) {
    return def.rangedAttack && def.range && newDist <= def.range && world.hasLOS(enemy, player);
}

function doEnemyMelee(enemy, def) {
    dealDamageToPlayer(enemyMeleeAttack(enemy, def), def.name, false, { attacker: enemy });
    // Counter mastery: player counter-attacks after being hit in melee
    if (player.equipped('counter_mastery') && enemy.hp > 0) {
        const pWep = player.weapon();
        const counterDmg = (pWep ? pWep.damage : 1) + player.stats.might;
        const rolled = Rando.bellCurve(counterDmg);
        const eDef = enemyDefense(enemy, def);
        const actualDmg = Math.max(1, rolled - eDef);
        enemy.hp -= actualDmg;
        logCombat(`Counter Mastery: ${actualDmg} dmg!`, 'log-dmg');
        if (enemy.hp <= 0) { killEnemy(enemy); }
    }
}

function doEnemyRanged(enemy, def) {
    dealDamageToPlayer(enemyRangedAttack(enemy, def), `${def.name} (ranged)`, false, { attacker: enemy, isRanged: true });
}

function enemyAttacks(enemy, def, prefersRanged, newDist) {
    if (def.behavior === 'kite') {
        if (Rando.bool(0.5) && newDist > 1 && enemyCanRangedAttack(enemy, def, newDist)) {
            doEnemyRanged(enemy, def);
            return true;
        }
        return false;
    }
    if (newDist === 1) {
        doEnemyMelee(enemy, def);
        return true;
    }
    if (enemyCanRangedAttack(enemy, def, newDist)) {
        if (def.behavior === 'guard' || def.behavior === 'boss' || prefersRanged) {
            doEnemyRanged(enemy, def);
            return true;
        }
    }
    return false;
}

function tryBossSpawn(enemy, def, occupied) {
    if (def.behavior !== 'boss') return;
    if (enemy.turnsSinceSpawn === 0) return;
    if (enemy.turnsSinceSpawn % (def.spawnInterval || 3) !== 0) return;
    const adj = hexNeighbors(enemy.q, enemy.r).filter(n => {
        const k = hexKey(n.q, n.r);
        const h = world.getHex(n.q, n.r);
        return h && world.isPassable(h) && !occupied.has(k);
    });
    if (adj.length === 0) return;
    const spot = Rando.choice(adj);
    const spawnType = Rando.choice([ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.PHASE_WRAITH, ENEMY_TYPE.FLUX_ARCHER]);
    const spawned = em.spawn(spawnType, spot.q, spot.r);
    if (spawned) {
        occupied.add(hexKey(spot.q, spot.r));
        logCombat(`The Unraveler spawns a ${em.getDef(spawnType).name}!`, 'log-info');
    }
}

function tryTerrainShatter(enemy, def) {
    if (!def.chaosSpawned || !Rando.bool(0.02)) return;
    const eHex = world.getHex(enemy.q, enemy.r);
    if (!eHex) return;
    const undistressed = UNDISTRESSED_VERSION[eHex.terrain];
    if (undistressed !== undefined) eHex.terrain = undistressed;
    if (SHATTERED_VERSION[eHex.terrain] === undefined) return;
    const poi = world.poiAt(enemy.q, enemy.r);
    if (poi && (poi.type === POI.HAVEN || poi.type === POI.VILLAGE)) return;
    // Shatter the hex
    eHex.terrain = SHATTERED_VERSION[eHex.terrain];
    // Spread distress within radius 3
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

async function runWildlifeTurn(enemy, def, aggro, occupied) {
    const dist = hexDistance(enemy.q, enemy.r, player.q, player.r);
    if (playerInForest() && !(combatAlerted && dist <= 5)) aggro = Math.max(1, aggro - 2);
    const prevKey = hexKey(enemy.q, enemy.r);
    if (dist <= aggro) {
        em.moveWildlifeToward(enemy, player.q, player.r, occupied, player.q, player.r, world);
        if (enemyIsVisible(enemy, prevKey)) { await animDelay(80); render(); }
        if (hexDistance(enemy.q, enemy.r, player.q, player.r) === 1) {
            dealDamageToPlayer(enemyMeleeAttack(enemy, def), def.name, false, { attacker: enemy });
            await animDelay(150); render();
        }
    } else if (Rando.bool(0.3)) {
        em.wanderWildlife(enemy, occupied, player.q, player.r, world);
    }
}

function trySwarmMarch(enemy, def, occupied) {
    if (def.behavior === 'boss' || def.behavior === 'guard') return false;
    const nearSettlement = world.pois.some(p =>
        (p.type === POI.HAVEN || p.type === POI.VILLAGE) &&
        hexDistance(enemy.q, enemy.r, p.q, p.r) <= 5
    );
    if (nearSettlement) return false;
    const nearbyAllies = em.enemies.filter(e =>
        e !== enemy &&
        hexDistance(e.q, e.r, enemy.q, enemy.r) <= 3 &&
        em.getDef(e.type)?.chaosSpawned
    ).length;
    if (nearbyAllies < 5) return false;
    let closestPoi = null, closestDist = Infinity;
    for (const p of world.pois) {
        if (p.type !== POI.HAVEN && p.type !== POI.VILLAGE) continue;
        const d = hexDistance(enemy.q, enemy.r, p.q, p.r);
        if (d < closestDist) { closestDist = d; closestPoi = p; }
    }
    if (!closestPoi) return false;
    em.moveEnemyToward(enemy, closestPoi.q, closestPoi.r, occupied, world);
    return true;
}

async function runChaosTurn(enemy, def, occupied) {
    // Chaos monsters heal on corrupted terrain
    const effMax = enemyEffectiveMaxHp(enemy);
    if (enemyOnCorruptedTerrain(enemy, def) && enemy.hp < effMax) {
        enemy.hp = Math.min(effMax, enemy.hp + 1);
    }

    const dist = hexDistance(enemy.q, enemy.r, player.q, player.r);
    let aggro = def.aggroRange || def.detectRange || 0;
    if (player.equipped('threat_shroud')) aggro = Math.max(1, aggro - 2);
    // Forest stealth: reduce detection, wraiths lose track entirely
    const inForest = playerInForest();
    if (inForest && !(combatAlerted && dist <= 5)) {
        if (def.behavior === 'teleport') aggro = 0;
        else aggro = Math.max(1, aggro - 2);
    }
    const prevKey = hexKey(enemy.q, enemy.r);

    // Phase Wraith teleport (blocked by wraith_immune)
    if (def.behavior === 'teleport' && aggro > 0 && !player.equipped('wraith_immune') && Math.random() < (def.teleportChance || 0.3)) {
        const valid = hexesInRange(player.q, player.r, def.teleportRange).filter(t => {
            const k = hexKey(t.q, t.r);
            const h = world.getHex(t.q, t.r);
            if (!h || !world.isPassable(h) || occupied.has(k)) return false;
            if (t.q === player.q && t.r === player.r) return false;
            const poi = world.poiAt(t.q, t.r);
            if (poi && poi.type === POI.HAVEN) return false;
            return true;
        });
        if (valid.length > 0) {
            occupied.delete(hexKey(enemy.q, enemy.r));
            const dest = Rando.choice(valid);
            enemy.q = dest.q; enemy.r = dest.r;
            occupied.add(hexKey(enemy.q, enemy.r));
            if (enemyIsVisible(enemy, prevKey)) { await animDelay(100); render(); }
        }
    }

    const swarming = trySwarmMarch(enemy, def, occupied);

    // Ranged-capable chasers (Void Stalker): 50% prefer ranged, skip closing in
    const prefersRanged = def.rangedAttack && def.behavior === 'chase' && Rando.bool(0.5);

    let moved = swarming;
    const speed = def.speed || 1;
    for (let step = 0; step < speed && !swarming; step++) {
        if (moveEnemyStep(enemy, def, dist, aggro, prefersRanged, occupied)) moved = true;
    }
    if (moved && enemyIsVisible(enemy, prevKey)) { await animDelay(80); render(); }

    const newDist = hexDistance(enemy.q, enemy.r, player.q, player.r);
    const attacked = enemyAttacks(enemy, def, prefersRanged, newDist);
    if (attacked) { await animDelay(150); render(); }

    tryBossSpawn(enemy, def, occupied);
    tryTerrainShatter(enemy, def);
}

async function runEnemyPhase() {
    // Natural HP recovery
    player.hp = Math.min(player.maxHP(), player.hp + 1);
    // HP regen (any slot)
    const healItem = player.equipped('heal') || player.equipped('regen') || player.equipped('armor_regen');
    if (healItem) {
        const amt = healItem.healPerTurn || healItem.regenAmount || 1;
        player.hp = Math.min(player.maxHP(), player.hp + amt);
    }
    // Revive: HP + AE regen
    const reviveItem = player.equipped('revive');
    if (reviveItem) {
        player.hp = Math.min(player.maxHP(), player.hp + reviveItem.reviveHp);
        player.aether = Math.min(player.maxAether(), player.aether + reviveItem.reviveAether);
    }
    // Regen combo (legacy): HP + AE regen
    const regenCombo = player.equipped('regen_combo');
    if (regenCombo) {
        player.hp = Math.min(player.maxHP(), player.hp + regenCombo.regenAmount);
        player.aether = Math.min(player.maxAether(), player.aether + 1);
    }
    // Aether regen (any slot — covers aether_regen, aether_regen_small, aether_regen_large)
    const aeRegenItem = player.equipped('aether_regen') || player.equipped('aether_regen_small') || player.equipped('aether_regen_large');
    if (aeRegenItem) {
        const aeAmt = aeRegenItem.aetherRegen || (aeRegenItem.special === 'aether_regen_large' ? 3 : 1);
        player.aether = Math.min(player.maxAether(), player.aether + aeAmt);
    }
    // Chaos Circlet: +1 AE on corrupted/distressed terrain
    const chaosCirclet = player.equipped('chaos_circlet');
    if (chaosCirclet) {
        const pTerrain = playerTerrain();
        if (isChaosTerrain(pTerrain)) {
            player.aether = Math.min(player.maxAether(), player.aether + 1);
            logCombat('Chaos Circlet: +1 AE', 'log-info');
        }
    }
    if (player.warpShieldTurns > 0) player.warpShieldTurns--;

    // Burn tick: enemies with burn take damage
    for (const enemy of [...em.enemies]) {
        if (enemy.burnDamage && enemy.burnDamage > 0) {
            const bDef = em.getDef(enemy.type);
            enemy.hp -= enemy.burnDamage;
            logCombat(`Burn: ${enemy.burnDamage} dmg to ${bDef.name}`, 'log-dmg');
            enemy.burnDamage = 0;
            if (enemy.hp <= 0) killEnemy(enemy);
        }
    }

    const occupied = buildOccupiedSet();

    for (const enemy of [...em.enemies]) {
        if (gameOver) break;
        const def = em.getDef(enemy.type);
        if (!def) continue;
        let aggro = def.aggroRange || def.detectRange || 0;
        if (player.equipped('threat_shroud')) aggro = Math.max(1, aggro - 2);
        enemy.turnsSinceSpawn++;

        if (def.behavior === 'wildlife') {
            await runWildlifeTurn(enemy, def, aggro, occupied);
        } else {
            await runChaosTurn(enemy, def, occupied);
        }
    }

    if (gameOver) return;

    // Guardian respawn: breaches/maw spawn guardians if none nearby
    for (const poi of world.pois) {
        if ((poi.type === POI.BREACH || poi.type === POI.MAW) && !poi.closed) {
            // Unraveler never respawns
            if (poi.type === POI.MAW) continue;
            // Check for existing guardian within 3 hexes
            const hasGuardian = em.enemies.some(e =>
                e.type === ENEMY_TYPE.BREACH_GUARDIAN && hexDistance(poi.q, poi.r, e.q, e.r) <= 3
            );
            if (!hasGuardian && Math.random() < 0.3 && em.enemies.length < MAX_ENEMIES && !occupied.has(hexKey(poi.q, poi.r))) {
                const g = em.spawn(ENEMY_TYPE.BREACH_GUARDIAN, poi.q, poi.r, poi.q, poi.r);
                if (g) {
                    poi.guardianId = g.id;
                    poi.guardianDefeated = false;
                    occupied.add(hexKey(poi.q, poi.r));
                }
            }
        }
    }

    // Spawn phase
    for (const poi of world.pois) {
        if (poi.type === POI.BREACH && !poi.closed && Math.random() < 0.15) {
            const adj = hexNeighbors(poi.q, poi.r).filter(n => {
                const k = hexKey(n.q, n.r);
                const h = world.getHex(n.q, n.r);
                return h && world.isPassable(h) && !occupied.has(k);
            });
            if (adj.length > 0 && em.enemies.length < MAX_ENEMIES) {
                const spot = Rando.choice(adj);
                const type = Rando.choice([ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.VOID_STALKER, ENEMY_TYPE.PHASE_WRAITH, ENEMY_TYPE.FLUX_ARCHER]);
                em.spawn(type, spot.q, spot.r, poi.q, poi.r);
                occupied.add(hexKey(spot.q, spot.r));
            }
        }
    }

    // Wildlife population maintenance
    em.spawnWildlife(world, player.q, player.r);

    // Start new turn
    turn++;
    player.mp = player.maxMP();
    if (player.isEngaged(em.enemies) && !player.equipped('disengage')) {
        player.mp = Math.max(1, Math.floor(player.mp / 2));
        logCombat('Engaged! Half MP.', 'log-info');
    }
    player.usedSkillsThisTurn.clear();
    player.movedThisTurn = false;
    player.hexesMovedThisTurn = 0;
}

function startPlayerTurn() {
    combatAlerted = false;
    poiInteracted = false;
    render();
}

async function gameLoop() {
    const gen = ++gameGeneration;
    while (!gameOver && gameGeneration === gen) {
        changePhase('player');
        startPlayerTurn();

        await new Promise(r => { endTurnResolve = r; });

        if (gameOver || gameGeneration !== gen) break;

        saveGame();
        changePhase('enemy');
        await runEnemyPhase();
    }
    if (gameOver) deleteSave();
}

function animDelay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ================================================================
// SAVE / LOAD
// ================================================================

const SAVE_KEY = 'warrior_save';

function saveGame() {
    const data = {
        turn, enemiesDefeated,
        player: player.toJSON(),
        world: world.toJSON(),
        enemies: em.toJSON(),
        equipment: ALL_EQUIPMENT
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
}

function deleteSave() {
    localStorage.removeItem(SAVE_KEY);
}

function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    // Stop any existing game loop
    gameOver = true;
    resolveEndTurn();

    gameOver = false;
    gameWon = false;
    turn = data.turn;
    enemiesDefeated = data.enemiesDefeated;
    selected = false;
    reachable = null;
    attackable = null;
    targeting = null;
    threatOverlay = null;

    // Restore equipment registry
    resetEquipment();
    if (data.equipment) {
        for (const [id, item] of Object.entries(data.equipment)) {
            ALL_EQUIPMENT[id] = item;
        }
    }

    world = GameWorld.fromJSON(data.world);
    player = Player.fromJSON(data.player);
    em = EnemyManager.fromJSON(data.enemies);

    computeMawDistances();
    refreshVision();
    closeAllPanels();
    document.getElementById('dialog-overlay').classList.add('hidden');
    document.getElementById('endgame-overlay').classList.add('hidden');
    document.getElementById('intro-overlay').classList.add('hidden');
    changePhase('player');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    centerOn(player);
    updateSkillBar();
    gameLoop();
    return true;
}

// ================================================================
// GAME INIT
// ================================================================

function initGame() {
    // Stop any existing game loop
    gameOver = true;
    resolveEndTurn();

    gameOver = false;
    gameWon = false;
    turn = 1;
    enemiesDefeated = 0;
    selected = false;
    reachable = null;
    attackable = null;
    targeting = null;
    threatOverlay = null;

    resetEquipment();
    world = new GameWorld();
    world.generate();

    // Find starting haven (leftmost)
    const havens = world.havens();
    havens.sort((a, b) => {
        const ha = world.getHex(a.q, a.r);
        const hb = world.getHex(b.q, b.r);
        return (ha?.col || 0) - (hb?.col || 0);
    });
    const startHaven = havens[0] || world.pois[0];

    player = new Player(startHaven.q, startHaven.r);
    refreshVision();
    computeMawDistances();
    em = new EnemyManager();
    em.generateCreatureTypes();
    em.spawnInitial(world, player.q, player.r);
    em.spawnInitialCreatures(world, player.q, player.r, world.visible);
    // Close panels and overlays
    closeAllPanels();
    document.getElementById('dialog-overlay').classList.add('hidden');
    document.getElementById('endgame-overlay').classList.add('hidden');
    document.getElementById('intro-overlay').classList.add('hidden');
    deleteSave();
    changePhase('player');

    // Set canvas size before centering so centerOn has correct dimensions
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    centerOn(player);
    updateSkillBar();
    gameLoop();
}


function centerOn(hex) {
    const p = hexToPixel(hex.q, hex.r);
    panX = canvas.width / 2 - p.x;
    panY = canvas.height / 2 - p.y;
}

// ================================================================
// RENDERING
// ================================================================

function render() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Terrain
    for (const [key, hex] of world.hexes) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 ||
            y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;

        const isRevealed = world.revealed.has(key);
        const isVisible = world.visible.has(key);

        if (!isRevealed) {
            // Black fog
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = '#0a0a0a';
            ctx.fill();
            ctx.strokeStyle = '#00000044'; ctx.lineWidth = 1; ctx.stroke();
            continue;
        }

        // Draw terrain
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
        ctx.fill();
        ctx.strokeStyle = '#00000044'; ctx.lineWidth = 1; ctx.stroke();

        // Dim if not currently visible
        if (!isVisible) {
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fill();
        }

        // Gold / crop indicator
        if (hex.goldDeposit > 0) {
            ctx.fillStyle = hex.crop ? '#66bb6a' : '#ffd700';
            ctx.font = 'bold ' + Math.floor(HEX_SIZE * 1.2) + 'px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(hex.crop || '\u{1FA99}', x, y);
        }

        // POI symbols
        if (hex.poi) {
            const poi = world.poiAt(hex.q, hex.r);
            if (poi) {
                const symbol = POI_SYMBOLS[poi.type] || '?';
                let color = POI_COLORS[poi.type] || '#fff';
                if (poi.type === POI.BREACH && poi.closed) color = '#555';
                if (poi.type === POI.RUIN && poi.ruinState === 'explored') color = '#555';
                ctx.fillStyle = color;
                ctx.font = 'bold ' + Math.floor(HEX_SIZE * 1.2) + 'px monospace';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(symbol, x, y);
            }
        }
    }

    // Reachable highlights
    if (reachable && selected && !targeting) {
        for (const [key] of reachable) {
            const { q, r } = parseHexKey(key);
            const { x, y } = hexToScreen(q, r);
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = 'rgba(255, 255, 0, 0.25)';
            ctx.fill();
        }
        // Attackable highlights
        if (attackable) {
            for (const key of attackable) {
                const { q, r } = parseHexKey(key);
                const { x, y } = hexToScreen(q, r);
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = 'rgba(255, 60, 60, 0.35)';
                ctx.fill();
            }
        }
    }

    // Threat heatmap overlay (Ground Weeps)
    if (threatOverlay) {
        let maxThreat = 0;
        for (const t of threatOverlay.values()) if (t > maxThreat) maxThreat = t;
        if (maxThreat > 0) {
            for (const [key, threat] of threatOverlay) {
                const { q, r } = parseHexKey(key);
                const { x, y } = hexToScreen(q, r);
                const intensity = threat / maxThreat;
                // Blue (safe) → Yellow → Red (deadly)
                let red, green, blue;
                if (intensity < 0.5) {
                    const t = intensity * 2;
                    red = Math.round(255 * t); green = Math.round(255 * t); blue = Math.round(180 * (1 - t));
                } else {
                    const t = (intensity - 0.5) * 2;
                    red = 255; green = Math.round(255 * (1 - t)); blue = 0;
                }
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.45)`;
                ctx.fill();
            }
        }
        // Draw "Press Space to dismiss" label
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(canvas.width / 2 - 120, 50, 240, 30);
        ctx.fillStyle = '#fff';
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Threat Map — Space/click to dismiss', canvas.width / 2, 70);
        ctx.textAlign = 'left';
    }

    // Targeting highlights
    if (targeting) {
        const skill = SKILLS[targeting.skill];
        const isSpatial = skill && (skill.target === SKILL_TARGET.TELEPORT || skill.target === SKILL_TARGET.TELEPORT_REVEALED || skill.target === SKILL_TARGET.RANGED_AOE);
        const color = isSpatial ? 'rgba(100, 200, 255, 0.3)' : 'rgba(100, 100, 255, 0.35)';
        for (const key of targeting.validHexes) {
            const { q, r } = parseHexKey(key);
            const { x, y } = hexToScreen(q, r);
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = color;
            ctx.fill();
        }
    }

    // Enemies (only visible ones)
    for (const enemy of em.enemies) {
        const ek = hexKey(enemy.q, enemy.r);
        if (!world.visible.has(ek)) continue;
        const def = em.getDef(enemy.type);
        if (!def) { console.warn('Missing def for enemy type:', enemy.type); continue; }
        const { x, y } = hexToScreen(enemy.q, enemy.r);
        const color = enemyColor(enemy.type);
        const effMaxHp = enemyEffectiveMaxHp(enemy);
        drawCounter(x, y, color, def.label, enemy.hp / effMaxHp, null, { atk: enemyMeleeAttack(enemy, def), def: enemyDefense(enemy, def), mov: def.speed || 1 });
    }

    // Player
    if (player) {
        const { x, y } = hexToScreen(player.q, player.r);
        const playerLabelColor = phase === 'player' ? '#000' : '#b8941a';
        const wep = player.weapon();
        const pAtk = (wep ? wep.damage : 0) + (wep && wep.type === 'ranged' ? player.stats.reflex : player.stats.might);
        const pDef = playerDefense();
        drawCounter(x, y, PLAYER_COLOR, 'C', player.hp / player.maxHP(), playerLabelColor, { atk: pAtk, def: pDef, mov: player.mp });
        if (selected) {
            const s = COUNTER_SIZE + 4;
            roundRect(ctx, x - s / 2, y - s / 2, s, s, 6);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        }
        // Warp Shield indicator
        if (player.warpShieldTurns > 0) {
            ctx.strokeStyle = '#7c4dff'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, COUNTER_SIZE / 2 + 6, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    updateHUD();
    refreshOpenPanels();
}

function renderWorldMap() {
    const pad = 40;
    const padBottom = 80;
    const cw = canvas.width, ch = canvas.height;
    // Compute hex size to fit the full map on screen
    // hexToPixel: x = size * (sqrt3 * q + sqrt3/2 * r), y = size * (3/2 * r)
    // For a rect grid: col 0..MAP_COLS-1, row 0..MAP_ROWS-1
    // Max pixel extent at size=1: x ~ sqrt3 * MAP_COLS, y ~ 1.5 * MAP_ROWS
    const mapPixelW = Math.sqrt(3) * MAP_COLS;
    const mapPixelH = 1.5 * MAP_ROWS;
    const scale = Math.min((cw - pad * 2) / mapPixelW, (ch - pad - padBottom) / mapPixelH);
    const miniSize = scale; // hex size in minimap pixels
    const sqrt3 = Math.sqrt(3);

    // Find pixel bounds to center
    const miniRaw = (q, r) => ({
        x: miniSize * (sqrt3 * q + sqrt3 / 2 * r),
        y: miniSize * (1.5 * r)
    });
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [, hex] of world.hexes) {
        const { x, y } = miniRaw(hex.q, hex.r);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const offX = (cw - (maxX - minX)) / 2 - minX;
    const offY = (ch - padBottom + pad - (maxY - minY)) / 2 - minY;
    const mini = (q, r) => ({ x: miniRaw(q, r).x + offX, y: miniRaw(q, r).y + offY });

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, cw, ch);

    // Draw hexes
    for (const [key, hex] of world.hexes) {
        const { x: mx, y: my } = mini(hex.q, hex.r);

        const isRevealed = world.revealed.has(key);
        if (!isRevealed) {
            drawHexPath(ctx, mx, my, miniSize);
            ctx.fillStyle = '#0a0a0a';
            ctx.fill();
            continue;
        }

        drawHexPath(ctx, mx, my, miniSize);
        ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
        ctx.fill();

        if (!world.visible.has(key)) {
            drawHexPath(ctx, mx, my, miniSize);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fill();
        }
    }

    // Draw POIs on revealed hexes
    const poiFontSize = Math.max(6, Math.floor(miniSize * 1.4));
    ctx.font = 'bold ' + poiFontSize + 'px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const poi of world.pois) {
        if (!world.revealed.has(hexKey(poi.q, poi.r))) continue;
        const { x: mx, y: my } = mini(poi.q, poi.r);
        const symbol = POI_SYMBOLS[poi.type] || '?';
        let color = POI_COLORS[poi.type] || '#fff';
        if (poi.type === POI.BREACH && poi.closed) color = '#555';
        if (poi.type === POI.RUIN && poi.ruinState === 'explored') color = '#555';
        ctx.fillStyle = color;
        ctx.fillText(symbol, mx, my);
    }

    // Draw player
    const { x: px, y: py } = mini(player.q, player.r);
    const pr = Math.max(3, miniSize * 0.8);
    ctx.fillStyle = PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(cw / 2 - 100, ch - 36, 200, 28);
    ctx.fillStyle = '#aaa';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('World Map — M/Esc to close', cw / 2, ch - 18);
    ctx.textAlign = 'left';
}

function toggleWorldMap() {
    showingWorldMap = !showingWorldMap;
    if (showingWorldMap) {
        renderWorldMap();
    } else {
        render();
    }
}

function enemyColor(type) {
    const def = em.getDef(type);
    if (def && def.color) return def.color;
    switch (type) {
        case ENEMY_TYPE.VOID_STALKER: return '#cc3333';
        case ENEMY_TYPE.BREACH_CRAWLER: return '#8B4513';
        case ENEMY_TYPE.FLUX_ARCHER: return '#4a90d9';
        case ENEMY_TYPE.PHASE_WRAITH: return '#9b59b6';
        case ENEMY_TYPE.BREACH_GUARDIAN: return '#e040fb';
        case ENEMY_TYPE.UNRAVELER: return '#ff1744';
        default: return '#cc3333';
    }
}

// ================================================================
// HUD & PANELS
// ================================================================

function refreshOpenPanels() {
    if (!document.getElementById('char-panel').classList.contains('hidden')) updateCharPanel();
    if (!document.getElementById('skills-panel').classList.contains('hidden')) updateSkillsPanel();
    if (!document.getElementById('inv-panel').classList.contains('hidden')) updateInvPanel();
}

function updateHUD() {
    document.getElementById('turn-info').textContent = 'Turn ' + turn;
    const mhp = player.maxHP();
    document.getElementById('hp-text').textContent = player.hp + '/' + mhp;
    document.getElementById('hp-fill').style.width = (player.hp / mhp * 100) + '%';
    // HP bar color
    const hpPct = player.hp / mhp;
    const hpFill = document.getElementById('hp-fill');
    if (hpPct > 0.5) hpFill.style.background = '#4caf50';
    else if (hpPct > 0.25) hpFill.style.background = '#ff9800';
    else hpFill.style.background = '#f44336';

    const mae = player.maxAether();
    document.getElementById('ae-text').textContent = player.aether + '/' + mae;
    document.getElementById('ae-fill').style.width = (player.aether / mae * 100) + '%';
    document.getElementById('mp-info').textContent = 'MP: ' + player.mp + '/' + player.maxMP();
    document.getElementById('level-info').textContent = 'Lv ' + player.level;
    const xpNeeded = player.level < 10 ? xpForLevel(player.level + 1) : null;
    document.getElementById('xp-text').textContent = player.xp + '/' + (xpNeeded ?? '---');
    document.getElementById('xp-fill').style.width = (xpNeeded ? (player.xp / xpNeeded * 100) : 100) + '%';
    document.getElementById('gold-info').textContent = player.gold + 'g';

    // Context bar
    if (hoveredHex) {
        const hex = world.getHex(hoveredHex.q, hoveredHex.r);
        if (hex && world.revealed.has(hexKey(hex.q, hex.r))) {
            document.getElementById('ctx-terrain').textContent = TERRAIN_NAMES[hex.terrain] || 'Unknown';
            const enemy = em.enemies.find(e => e.q === hoveredHex.q && e.r === hoveredHex.r && world.visible.has(hexKey(e.q, e.r)));
            if (enemy) {
                const def = em.getDef(enemy.type);
                document.getElementById('ctx-entity').textContent = `${def.name} (HP ${enemy.hp}/${enemyEffectiveMaxHp(enemy)})`;
            } else {
                document.getElementById('ctx-entity').textContent = '';
            }
        } else {
            document.getElementById('ctx-terrain').textContent = 'Unknown';
            document.getElementById('ctx-entity').textContent = '';
        }
    }
}

function updateSkillBar() {
    // Ranged slot
    const rangedSlot = document.getElementById('ranged-slot');
    const wep = player.weapon();
    const hasRanged = wep && wep.type === 'ranged';
    const rangedCost = hasRanged && wep.magical && wep.special !== 'free_ranged' ? 1 : 0;
    const canRanged = hasRanged && player.aether >= rangedCost && phase === 'player' && !gameOver;
    rangedSlot.classList.toggle('disabled', !canRanged);
    rangedSlot.classList.toggle('active', targeting && targeting.skill === '__ranged__');
    rangedSlot.style.display = hasRanged ? '' : 'none';

    // Skill slots 1-4
    for (let i = 0; i < 4; i++) {
        const slot = document.querySelector(`.skill-slot[data-slot="${i}"]`);
        const nameEl = slot.querySelector('.skill-name');
        const skillId = player.skills[i];
        if (skillId) {
            const skill = SKILLS[skillId];
            nameEl.textContent = skill.name;
            const canUse = player.aether >= skill.cost && !player.usedSkillsThisTurn.has(skillId) && phase === 'player' && !gameOver && !checkSkillUsage(skill);
            slot.classList.toggle('disabled', !canUse);
            slot.classList.toggle('used', player.usedSkillsThisTurn.has(skillId));
            slot.classList.toggle('active', targeting && targeting.skill === skillId);
        } else {
            nameEl.textContent = '-';
            slot.classList.add('disabled');
            slot.classList.remove('used', 'active');
        }
    }
}

function updateCharPanel() {
    const panel = document.getElementById('char-stats');
    const stats = ['might', 'reflex', 'warding', 'vigor'];
    const labels = { might: 'Might', reflex: 'Reflex', warding: 'Warding', vigor: 'Vigor' };
    let html = '';
    if (player.statPoints > 0) html += `<div style="color:#ffc107;margin-bottom:8px">Points: ${player.statPoints}</div>`;
    for (const s of stats) {
        html += `<div class="stat-row"><span>${labels[s]}: ${player.stats[s]}</span>`;
        if (player.statPoints > 0) {
            html += `<button class="plus-btn" data-stat="${s}">+</button>`;
        }
        html += '</div>';
    }
    panel.innerHTML = html;

    // Derived
    const derived = document.getElementById('char-derived');
    const wep = player.weapon();
    derived.innerHTML = `<div class="derived-section">
        <div>Attack: ${wep ? wep.damage : 0} + ${wep?.type === 'ranged' ? player.stats.reflex : player.stats.might}</div>
        <div>Defense: ${playerDefense()}</div>
        <div>Dodge: ${player.dodge()}%</div>
        <div>Vision: ${player.vision()}</div>
        <div>MP: ${player.maxMP()}</div>
    </div>`;

    // Equipment
    const equip = document.getElementById('char-equipment');
    let ehtml = '<div class="equip-section">';
    for (const slot of [EQUIP_SLOT.WEAPON, EQUIP_SLOT.ARMOR, EQUIP_SLOT.ARTIFACT]) {
        const id = player.equipment[slot];
        const item = id ? ALL_EQUIPMENT[id] : null;
        ehtml += `<div class="equip-item"><span style="color:#888">${slot}:</span> <span class="item-name">${item ? item.name : '(empty)'}</span></div>`;
    }
    ehtml += '</div>';
    equip.innerHTML = ehtml;

    // Stat point buttons
    panel.querySelectorAll('.plus-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const stat = btn.dataset.stat;
            player.stats[stat]++;
            player.statPoints--;
            player.hp = Math.min(player.hp, player.maxHP());
            player.aether = Math.min(player.aether, player.maxAether());
            updateCharPanel();
            updateHUD();
            updateSkillBar();
        });
    });
}

function updateSkillsPanel() {
    const list = document.getElementById('skills-list');
    let html = '';
    // Show equipped slots
    html += '<div style="color:#888;margin-bottom:4px;font-size:11px">EQUIPPED (click to unequip)</div>';
    for (let i = 0; i < 4; i++) {
        const skillId = player.skills[i];
        if (skillId) {
            const skill = SKILLS[skillId];
            html += `<div class="skill-entry" style="cursor:pointer;border-left:2px solid #7c4dff;padding-left:6px" data-unequip="${i}">
                <div><span class="s-name">${skill.name}</span> <span class="s-cost">(${skill.cost} AE)</span> <span style="color:#555">[${i + 1}]</span></div>
                <div class="s-desc">${skill.desc}</div>
            </div>`;
        } else {
            html += `<div class="skill-entry"><span style="color:#555">Slot ${i + 1}: Empty</span></div>`;
        }
    }
    // Show learned but not equipped
    const equipped = new Set(player.skills.filter(Boolean));
    const unequipped = [...player.learnedSkills].filter(id => !equipped.has(id)).sort((a, b) => SKILLS[a].name.localeCompare(SKILLS[b].name));
    const nearbyEnemy = phase === 'player' && !gameOver && em.enemies.some(e => hexDistance(player.q, player.r, e.q, e.r) <= 2);
    const canInvokeFromPanel = phase === 'player' && !gameOver && !nearbyEnemy;
    if (unequipped.length > 0) {
        html += '<div style="color:#888;margin-top:8px;margin-bottom:4px;font-size:11px">LEARNED (click to equip)</div>';
        for (const skillId of unequipped) {
            const skill = SKILLS[skillId];
            const isUsable = canInvokeFromPanel
                && skill.usage !== SKILL_USAGE.ANYTIME
                && player.aether >= skill.cost
                && !player.usedSkillsThisTurn.has(skillId)
                && !checkSkillUsage(skill);
            const nameStyle = isUsable ? 'cursor:pointer;color:#7c4dff;border:1px solid #7c4dff;border-radius:3px;padding:1px 6px;background:rgba(124,77,255,0.15)' : '';
            html += `<div class="skill-entry" style="cursor:pointer;opacity:0.7" data-equip="${skillId}">
                <div><span class="s-name" ${isUsable ? `data-use="${skillId}" style="${nameStyle}"` : ''}>${skill.name}</span> <span class="s-cost">(${skill.cost} AE)</span></div>
                <div class="s-desc">${skill.desc}</div>
            </div>`;
        }
    }
    list.innerHTML = html;

    // Wire up equip/unequip
    list.querySelectorAll('[data-unequip]').forEach(el => {
        el.addEventListener('click', () => {
            const slot = parseInt(el.dataset.unequip);
            player.skills[slot] = null;
            updateSkillsPanel();
            updateSkillBar();
        });
    });
    list.querySelectorAll('[data-equip]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('[data-use]')) return; // don't equip when clicking Use
            const skillId = el.dataset.equip;
            const emptySlot = player.skills.indexOf(null);
            if (emptySlot >= 0) {
                player.skills[emptySlot] = skillId;
            } else {
                // Replace last slot
                player.skills[3] = skillId;
            }
            updateSkillsPanel();
            updateSkillBar();
        });
    });
    // Wire up direct invoke from panel
    list.querySelectorAll('[data-use]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            activateSkill(el.dataset.use);
        });
    });
}

function updateInvPanel() {
    document.getElementById('inv-gold').innerHTML = `<div style="color:#ffc107;margin-bottom:8px">Gold: ${player.gold}</div>`;
    const list = document.getElementById('inv-list');
    let html = '';

    // Show equipped items first
    for (const slot of [EQUIP_SLOT.WEAPON, EQUIP_SLOT.ARMOR, EQUIP_SLOT.ARTIFACT]) {
        const id = player.equipment[slot];
        if (!id) continue;
        const item = ALL_EQUIPMENT[id];
        if (!item) continue;
        const nameColor = '#ffc107';
        html += `<div class="inv-item equipped">
            <div><span style="color:${nameColor}">${item.name}</span> <span style="color:#888">(${slot})</span><br>
            <span style="color:#aaa;font-size:11px">${itemStatLine(item)}</span></div>
            <button data-action="unequip" data-id="${id}" data-slot="${slot}">Unequip</button>
        </div>`;
    }

    // Inventory items
    for (const id of player.inventory) {
        const item = ALL_EQUIPMENT[id];
        if (!item) continue;
        const slot = item.slot;
        const nameColor = (item.magical || id.startsWith('magic_')) ? '#e040fb' : '#ccc';
        html += `<div class="inv-item">
            <div><span style="color:${nameColor}">${item.name}</span> <span style="color:#888">(${slot})</span><br>
            <span style="color:#aaa;font-size:11px">${itemStatLine(item)}</span></div>
            <button data-action="equip" data-id="${id}" data-slot="${slot}">Equip</button>
        </div>`;
    }

    if (!html) html = '<div style="color:#555">No items</div>';
    list.innerHTML = html;

    list.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            const slot = btn.dataset.slot;
            if (action === 'equip') {
                // Move current equipped item to inventory
                const current = player.equipment[slot];
                if (current) player.inventory.unshift(current);
                player.equipment[slot] = id;
                const rmIdx = player.inventory.indexOf(id);
            if (rmIdx !== -1) player.inventory.splice(rmIdx, 1);
            } else if (action === 'unequip') {
                // Can't unequip weapon to nothing
                player.equipment[slot] = null;
                player.inventory.unshift(id);
            }
            player.hp = Math.min(player.hp, player.maxHP());
            player.aether = Math.min(player.aether, player.maxAether());
            updateInvPanel();
            updateCharPanel();
            updateHUD();
            updateSkillBar();
            render();
        });
    });
}

function itemStatLine(item) {
    const parts = [];
    if (item.damage !== undefined) parts.push(`Dmg ${item.damage}`);
    if (item.range) parts.push(`Range ${item.range}`);
    if (item.defense !== undefined) parts.push(`Def ${item.defense}`);
    if (item.special) {
        const specials = {
            // Weapon effects
            armor_pierce: `Pierce ${item.pierceAmount} def`,
            aether_siphon: `+${item.siphonAmount || 1} AE/hit`,
            burn: `Burn ${item.burnDamage}/turn`,
            chain: `Chain ${item.chainCount || item.chainDamage}`,
            chaos_bonus: `+${item.chaosBonus || 2} vs chaos`,
            counter_mastery: 'Counter-attack on enemy melee',
            defense_shred: `-${item.shredAmount || 1} def/hit`,
            double_strike: 'Double strike',
            triple_strike: 'Triple strike',
            ignore_defense: 'Ignore def',
            knockback: 'Knockback 1',
            lifesteal: `+${item.lifestealAmount} HP/hit`,
            momentum: `+${item.momentumBonus} if moved`,
            recoil: `+${item.recoilBonus} dmg, ${item.recoilDamage} self-dmg`,
            reverberate: `Chain ${item.chainCount} +${item.chainBonus}/jump`,
            riposte: `+${item.riposteDamage || 1} counter-atk`,
            // Ranged weapon effects
            double_shot: 'Double shot',
            triple_shot: 'Triple shot',
            free_ranged: 'Free ranged',
            piercing: 'Pierce-through',
            sniper: `+${item.sniperBonus} at max range`,
            splash: `Splash ${item.splashDamage}`,
            // Armor effects
            burning_aura: `Burn adjacent ${item.burnAuraDamage}/turn`,
            dodge_bonus: `+${item.dodgeBonus}% dodge`,
            heal_on_kill: `+${item.healOnKill} HP/kill`,
            high_def_mp_penalty: `+${item.defBonus} def -${item.mpPenalty} MP`,
            last_stand: `+${item.lastStandBonus} def <50% HP`,
            momentum_defense: `+${item.momentumDefense || 1} def/hex moved`,
            ranged_defense: `+${item.rangedDefenseBonus} def vs ranged`,
            ranged_immune: 'Ranged immune',
            thorns: `${item.thornsPercent || item.thornsDamage || '?'}% reflect`,
            wall_of_steel: `+${item.wallBonus} melee if stationary`,
            // Passive effects
            aether_bonus: `+${item.aetherBonus} max AE`,
            aether_regen: `+${item.aetherRegen || 1} AE/turn`,
            aether_signet: `+${item.aetherSignetDamage} dmg when AE full (costs ${item.aetherSignetCost} AE)`,
            blink_ring: `Blink ${item.blinkRange} hex melee +${item.blinkBonus}`,
            breach_jewel: `+${item.breachBonus} might near breach`,
            chaos_attune: `+${item.chaosAttuneMight} might +${item.chaosAttuneDef} def on corrupted`,
            chaos_circlet: '+1 AE/turn on corrupted',
            chaos_defense: `+${item.chaosDefenseBonus} def on shattered/distressed`,
            disengage: 'No engagement MP penalty',
            displacement_immune: 'No displacement',
            heal: `+${item.healPerTurn} HP/turn`,
            hp_bonus: `+${item.hpBonus} HP`,
            mp_bonus: `+${item.mpBonus} MP`,
            opportunist: '25% gold on kill',
            ranger_defense: `+${item.rangerBonus} def on forest/hills`,
            reveal_maw: 'Reveals Maw',
            revive: `+${item.reviveHp} HP +${item.reviveAether} AE/turn`,
            soul_harvest: `+${item.soulHarvestXP} XP/kill`,
            strider: 'Rough terrain 1 MP',
            threat_shroud: '-2 enemy detect range',
            vision_bonus: `+${item.visionBonus} vision`,
            wraith_immune: 'Wraith immune',
            // Legacy specials (origitems compatibility)
            mp_penalty: `-${item.mpPenalty} MP`,
            regen: `+${item.regenAmount} HP/turn`,
            armor_regen: `+${item.regenAmount} HP/turn`,
            armor_aether_bonus: `+${item.aetherBonus} max AE`,
            regen_combo: `+${item.regenAmount} HP +1 AE/turn`,
            wall_crown: `+${item.wallCrownBonus} melee if stationary`,
            aether_regen_small: '+1 AE/turn',
            aether_regen_large: '+3 AE/turn',
            cleave: 'Cleave'
        };
        parts.push(specials[item.special] || item.special);
    }
    return parts.join(' | ');
}

function closeAllPanels() {
    document.getElementById('char-panel').classList.add('hidden');
    document.getElementById('skills-panel').classList.add('hidden');
    document.getElementById('inv-panel').classList.add('hidden');
}

function togglePanel(id) {
    const panel = document.getElementById(id);
    const wasHidden = panel.classList.contains('hidden');
    closeAllPanels();
    if (wasHidden) {
        panel.classList.remove('hidden');
        if (id === 'char-panel') updateCharPanel();
        if (id === 'skills-panel') updateSkillsPanel();
        if (id === 'inv-panel') updateInvPanel();
    }
}

// ================================================================
// DIALOGS
// ================================================================

function showDialog(title, bodyHtml, buttons) {
    changePhase('dialog');
    const overlay = document.getElementById('dialog-overlay');
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-body').innerHTML = bodyHtml;
    const btnContainer = document.getElementById('dialog-buttons');
    btnContainer.innerHTML = '';
    for (const { label, cls, action } of buttons) {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (cls) btn.className = cls;
        btn.addEventListener('click', () => {
            overlay.classList.add('hidden');
            changePhase('player');
            if (action) action();
            render();
            updateHUD();
            checkEndTurn();
        });
        btnContainer.appendChild(btn);
    }
    overlay.classList.remove('hidden');
}

function showHavenDialog(poi) {
    showDialog(POI_SYMBOLS[POI.HAVEN] + ' Haven', '<p>A place of safety amid the chaos.</p>', [
        {
            label: 'Rest', cls: 'primary', action: () => {
                player.hp = player.maxHP();
                player.aether = player.maxAether();
                player.mp = 0;
                logCombat('Fully rested.', 'log-heal');
            }
        },
        { label: 'Shop', action: () => showShopDialog(poi) },
        { label: 'Leave' }
    ]);
}

const CROP_ICONS = ['\u{1F33D}', '\u{1F345}', '\u{1F346}', '\u{1F955}', '\u{1F952}', '\u{1F33F}', '\u{1FAD1}', '\u{1F33E}'];

function trySpawnVillageCrop(poi) {
    if (!Rando.bool(0.25)) return;
    const candidates = hexNeighbors(poi.q, poi.r).filter(n => {
        const h = world.getHex(n.q, n.r);
        return h && world.isPassable(h) && h.goldDeposit <= 0;
    });
    if (candidates.length === 0) return;
    const spot = Rando.choice(candidates);
    const hex = world.getHex(spot.q, spot.r);
    hex.goldDeposit = Rando.int(1, 3);
    hex.crop = Rando.choice(CROP_ICONS);
}

function showVillageDialog(poi) {
    trySpawnVillageCrop(poi);
    const isTemp = poi.temporary;
    showDialog(POI_SYMBOLS[POI.VILLAGE] + (isTemp ? ' Sanctuary' : ' Village'), '<p>A brief respite from the wilds.</p>', [
        {
            label: 'Rest', cls: 'primary', action: () => {
                const healAmt = Math.floor(player.maxHP() * 0.5);
                player.hp = Math.min(player.maxHP(), player.hp + healAmt);
                const aeAmt = Math.floor(player.maxAether() * 0.5);
                player.aether = Math.min(player.maxAether(), player.aether + aeAmt);
                player.mp = 0;
                logCombat(`Rested: +${healAmt} HP, +${aeAmt} AE`, 'log-heal');
                // Remove temporary sanctuary after use
                if (isTemp) {
                    world.pois = world.pois.filter(p => p !== poi);
                    const hex = world.getHex(poi.q, poi.r);
                    if (hex) hex.poi = null;
                    logCombat('The sanctuary fades.', 'log-info');
                }
            }
        },
        { label: 'Leave' }
    ]);
}

function showHutDialog(poi) {
    // 5% chance the Wise Man's skill refreshes to something the player hasn't learned
    if (Rando.bool(0.05)) {
        const unlearnedPool = Object.values(SKILLS).filter(s => s.id !== 'restore' && !player.learnedSkills.has(s.id));
        if (unlearnedPool.length > 0) {
            poi.skill = Rando.choice(unlearnedPool).id;
        }
    }

    const skill = SKILLS[poi.skill];
    const skillName = skill ? skill.name : 'unknown art';

    if (player.learnedSkills.has(poi.skill)) {
        showDialog(POI_SYMBOLS[POI.HUT] + " Wise Man's Hut",
            `<p>An old sage peers at you.</p><p style="color:#a1887f">"I have nothing to teach you."</p>`,
            [{ label: 'Leave' }]);
    } else {
        showDialog(POI_SYMBOLS[POI.HUT] + " Wise Man's Hut",
            `<p>The sage's eyes light up.</p><p style="color:#b388ff">"I can teach you <b>${skillName}</b>."</p><p class="s-desc">${skill.desc}</p>`,
            [{
                label: 'Learn', cls: 'primary', action: () => {
                    player.learnedSkills.add(poi.skill);
                    const emptySlot = player.skills.indexOf(null);
                    if (emptySlot >= 0) player.skills[emptySlot] = poi.skill;
                    player.mp = 0;
                    logCombat(`The Wise Man teaches ${skillName}!`, 'log-info');
                    updateSkillBar();
                    updateSkillsPanel();
                }
            },
            { label: 'Decline' }]);
    }
}

function showShopDialog(poi) {
    let bodyHtml = `<div style="margin-bottom:8px;color:#ffc107" data-gold-display>Your gold: ${player.gold}</div>`;
    const owned = new Set([...Object.values(player.equipment).filter(Boolean), ...player.inventory]);
    for (const item of poi.shopItems) {
        const equip = ALL_EQUIPMENT[item.id];
        if (!equip) continue;
        if (owned.has(item.id)) continue;
        const nameColor = equip.magical ? '#e040fb' : '#ccc';
        const shopPrice = equip.magical ? item.price * 2 : item.price;
        bodyHtml += `<div class="shop-item">
            <div><span style="color:${nameColor}">${item.name}</span><br><span style="color:#aaa;font-size:11px">${itemStatLine(equip)}</span></div>
            <button data-id="${item.id}" data-price="${shopPrice}" ${player.gold < shopPrice ? 'disabled' : ''}>Buy ${shopPrice}g</button>
        </div>`;
    }

    // Sell section
    if (player.inventory.length > 0) {
        const nonMagicInInventory = player.inventory.filter(id => { const it = ALL_EQUIPMENT[id]; return it && !it.magical; });
        const nonMagicTotal = nonMagicInInventory.reduce((sum, id) => sum + sellPrice(ALL_EQUIPMENT[id]), 0);
        bodyHtml += '<div style="margin-top:12px;border-top:1px solid #333;padding-top:8px"><strong>Sell:</strong></div>';
        if (nonMagicInInventory.length > 0) {
            bodyHtml += `<div class="shop-item">
                <div style="color:#aaa">All non-magic items</div>
                <button data-sell-all-nm data-price="${nonMagicTotal}">Sell all ${nonMagicTotal}g</button>
            </div>`;
        }
        for (let i = 0; i < player.inventory.length; i++) {
            const id = player.inventory[i];
            const item = ALL_EQUIPMENT[id];
            if (!item) continue;
            const sp = sellPrice(item);
            const sellColor = item.magical ? '#b388ff' : '#ccc';
            bodyHtml += `<div class="shop-item">
                <div style="color:${sellColor}">${item.name}</div>
                <button data-sell="${id}" data-sell-idx="${i}" data-price="${sp}">Sell ${sp}g</button>
            </div>`;
        }
    }

    showDialog(POI_SYMBOLS[POI.HAVEN] + ' Shop', bodyHtml, [{ label: 'Done' }]);

    // Wire up buy/sell buttons
    const body = document.getElementById('dialog-body');
    body.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const price = parseInt(btn.dataset.price);
            if (player.gold >= price) {
                player.gold -= price;
                player.inventory.push(id);
                logCombat(`Bought ${ALL_EQUIPMENT[id].name}`, 'log-gold');
                showShopDialog(poi); // refresh
            }
        });
    });
    const sellAllBtn = body.querySelector('button[data-sell-all-nm]');
    if (sellAllBtn) {
        sellAllBtn.addEventListener('click', () => {
            const total = parseInt(sellAllBtn.dataset.price);
            const sold = [];
            for (let i = player.inventory.length - 1; i >= 0; i--) {
                const it = ALL_EQUIPMENT[player.inventory[i]];
                if (it && !it.magical) {
                    sold.push(it.name);
                    player.inventory.splice(i, 1);
                }
            }
            player.gold += total;
            logCombat(`Sold ${sold.length} items for ${total}g`, 'log-gold');
            // Remove non-magic sell rows and the sell-all button itself
            body.querySelectorAll('button[data-sell]').forEach(b => {
                const it = ALL_EQUIPMENT[b.dataset.sell];
                if (it && !it.magical) b.closest('.shop-item').remove();
            });
            sellAllBtn.closest('.shop-item').remove();
            // Reindex remaining sell buttons
            body.querySelectorAll('button[data-sell-idx]').forEach((b, i) => { b.dataset.sellIdx = i; });
            const goldDisplay = body.querySelector('[data-gold-display]');
            if (goldDisplay) goldDisplay.textContent = `Your gold: ${player.gold}`;
            body.querySelectorAll('button[data-id]').forEach(b => {
                b.disabled = player.gold < parseInt(b.dataset.price);
            });
        });
    }
    body.querySelectorAll('button[data-sell]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.sell;
            const price = parseInt(btn.dataset.price);
            const rmIdx = parseInt(btn.dataset.sellIdx);
            player.inventory.splice(rmIdx, 1);
            player.gold += price;
            logCombat(`Sold ${ALL_EQUIPMENT[id].name} for ${price}g`, 'log-gold');
            // Remove just this row and update gold display
            btn.closest('.shop-item').remove();
            const goldDisplay = body.querySelector('[data-gold-display]');
            if (goldDisplay) goldDisplay.textContent = `Your gold: ${player.gold}`;
            // Shift down indices of remaining sell buttons after the removed one
            body.querySelectorAll('button[data-sell-idx]').forEach(b => {
                const idx = parseInt(b.dataset.sellIdx);
                if (idx > rmIdx) b.dataset.sellIdx = idx - 1;
            });
            // Re-enable buy buttons player can now afford
            body.querySelectorAll('button[data-id]').forEach(b => {
                b.disabled = player.gold < parseInt(b.dataset.price);
            });
        });
    });
}

function ruinEnemiesNearby(poi) {
    return em.enemies.some(e => hexDistance(e.q, e.r, poi.q, poi.r) <= 2);
}

function spawnRuinCreatures(poi) {
    const creatureTypes = Object.keys(em.creatureDefs);
    if (creatureTypes.length === 0) return 0;
    const occupied = buildOccupiedSet();
    const spots = hexesInRange(poi.q, poi.r, 2).filter(h => {
        const hex = world.getHex(h.q, h.r);
        return hex && world.isPassable(hex) && !occupied.has(hexKey(h.q, h.r))
            && !(h.q === player.q && h.r === player.r);
    });
    if (spots.length === 0) return 0;
    Rando.shuffle(spots);
    const targetMight = player.level * player.level * 5;
    let mightSum = 0, count = 0;
    for (let i = 0; i < spots.length && mightSum < targetMight; i++) {
        const type = Rando.choice(creatureTypes);
        const e = em.spawn(type, spots[i].q, spots[i].r, undefined, undefined, { ignoreCap: true });
        if (e) {
            const def = em.getDef(type);
            mightSum += def.attack;
            count++;
        }
    }
    return count;
}

function activateRuinSpawn(poi, message) {
    const spawned = spawnRuinCreatures(poi);
    if (spawned > 0) {
        poi.ruinState = 'spawned';
        logCombat(message, 'log-info');
    }
    render();
}

function tryRuinInteraction(poi) {
    if (ruinEnemiesNearby(poi)) {
        logCombat('Clear the area before exploring the ruins.', 'log-info');
        return;
    }

    const ruinTitle = POI_SYMBOLS[POI.RUIN] + ' Ruins';

    if (poi.ruinState === 'new') {
        showDialog(ruinTitle, '<p>Ancient ruins loom before you.</p>', [
            { label: 'Search', cls: 'primary', action: () => {
                activateRuinSpawn(poi, 'Something stirs in the ruins...');
            }},
            { label: 'Leave' }
        ]);
    } else if (poi.ruinState === 'spawned') {
        showRuinLootDialog(poi);
    } else {
        showDialog(ruinTitle, '<p>The ruins are quiet\u2026</p>', [
            { label: 'Search', cls: 'primary', action: () => {
                if (Rando.bool(0.05)) {
                    activateRuinSpawn(poi, 'New creatures have moved into the ruins!');
                } else {
                    logCombat('Nothing of interest here.', 'log-info');
                }
            }},
            { label: 'Leave' }
        ]);
    }
}

function showRuinLootDialog(poi) {
    poi.ruinState = 'explored';
    const goldFound = Rando.int(5, 20);
    player.gold += goldFound;

    let body = `<p>You explore the ruins...</p><p style="color:#ffc107">Found ${goldFound} gold!</p>`;

    // Non-magical items (1-3, skip items already owned)
    const available = NON_MAGICAL_ITEMS.filter(i => !playerHasItem(i.id));
    Rando.shuffle(available);
    const nonMagicalCount = Math.min(Rando.int(1, 3), available.length);
    for (let i = 0; i < nonMagicalCount; i++) {
        player.inventory.push(available[i].id);
        body += `<p style="color:#ffc107">Found: ${available[i].name}</p>`;
    }

    // Magical item — roll a fresh one
    const magicalDrop = rollMagicItem();
    player.inventory.push(magicalDrop.id);
    body += `<p style="color:#e040fb">Found: ${magicalDrop.name}!</p>`;

    showDialog(POI_SYMBOLS[POI.RUIN] + ' Ruins', body, [{ label: 'Continue', action: () => {
        player.mp = 0;
    }}]);
}

function showLevelUpDialog() {
    // Stat allocation
    let body = `<p style="color:#ffc107;font-size:16px">Level ${player.level}!</p>`;
    body += `<p>Assign ${player.statPoints} stat points:</p>`;
    const stats = ['might', 'reflex', 'warding', 'vigor'];
    const labels = { might: 'Might', reflex: 'Reflex', warding: 'Warding', vigor: 'Vigor' };
    for (const s of stats) {
        body += `<div class="alloc-row"><span>${labels[s]}: <span id="alloc-${s}">${player.stats[s]}</span></span>
            <button data-stat="${s}">+</button></div>`;
    }
    body += `<div id="alloc-remaining" style="margin-top:8px;color:#ffc107">Remaining: ${player.statPoints}</div>`;

    const buttons = [{ label: 'Done', cls: 'primary', action: () => {
        if (player.pendingSkillChoice) {
            setTimeout(() => showSkillChoiceDialog(), 100);
        }
    }}];

    showDialog('Level Up!', body, buttons);

    // Wire up allocation buttons
    const dialogBody = document.getElementById('dialog-body');
    dialogBody.querySelectorAll('button[data-stat]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (player.statPoints <= 0) return;
            const stat = btn.dataset.stat;
            player.stats[stat]++;
            player.statPoints--;
            document.getElementById(`alloc-${stat}`).textContent = player.stats[stat];
            document.getElementById('alloc-remaining').textContent = 'Remaining: ' + player.statPoints;
            player.hp = Math.min(player.hp, player.maxHP());
            player.aether = Math.min(player.aether, player.maxAether());
            updateHUD();
        });
    });
}

function showSkillChoiceDialog() {
    player.pendingSkillChoice = false;
    const available = Object.values(SKILLS).filter(s =>
        s.minLevel <= player.level &&
        !player.learnedSkills.has(s.id)
    );
    if (available.length === 0) return;
    Rando.shuffle(available);
    const offered = available.slice(0, 3);

    let body = '<p>Choose a skill to learn:</p><div style="max-height:260px;overflow-y:auto">';
    for (const skill of offered) {
        body += `<div class="skill-choice" data-skill="${skill.id}">
            <div><span class="sc-name">${skill.name}</span> <span class="sc-cost">(${skill.cost} AE)</span></div>
            <div class="sc-desc">${skill.desc}</div>
        </div>`;
    }
    body += '</div>';

    showDialog('New Skill!', body, []);

    // Wire up choices
    document.getElementById('dialog-body').querySelectorAll('.skill-choice').forEach(el => {
        el.addEventListener('click', () => {
            const skillId = el.dataset.skill;
            player.learnedSkills.add(skillId);
            // Auto-equip into first empty slot if available
            const emptySlot = player.skills.indexOf(null);
            if (emptySlot >= 0) player.skills[emptySlot] = skillId;
            document.getElementById('dialog-overlay').classList.add('hidden');
            changePhase('player');
            logCombat(`Learned ${SKILLS[skillId].name}!`, 'log-info');
            updateSkillBar();
            render();
            updateHUD();
        });
    });
}

// ================================================================
// GAME OVER
// ================================================================

function endGame(won) {
    gameOver = true;
    gameWon = won;
    resolveEndTurn();
    changePhase('dialog');
    const overlay = document.getElementById('endgame-overlay');
    document.getElementById('endgame-title').textContent = won ? 'VICTORY!' : 'DEFEAT';
    document.getElementById('endgame-title').style.color = won ? '#ffc107' : '#f44336';
    document.getElementById('endgame-body').innerHTML = `
        <div>Turns: ${turn}</div>
        <div>Level: ${player.level}</div>
        <div>Enemies defeated: ${enemiesDefeated}</div>
        <div>Breaches sealed: ${world.breachesClosed}</div>
    `;
    overlay.classList.remove('hidden');
}

// ================================================================
// COMBAT LOG
// ================================================================

function logCombat(msg, cls) {
    const log = document.getElementById('combat-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + (cls || '');
    entry.textContent = msg;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    // Remove after animation
    setTimeout(() => { if (entry.parentNode) entry.remove(); }, 4500);
}

// ================================================================
// INPUT HANDLING
// ================================================================

canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
        panning = true;
        panStartX = e.clientX; panStartY = e.clientY;
        panOrigX = panX; panOrigY = panY;
        e.preventDefault();
        return;
    }

    if (e.button === 0 && showingWorldMap) {
        showingWorldMap = false;
        render();
        return;
    }

    if (e.button === 0 && !gameOver && phase === 'player') {
        // Dismiss threat overlay on click
        if (threatOverlay) {
            threatOverlay = null;
            render();
            return;
        }

        const hex = screenToHex(e.clientX, e.clientY);
        const key = hexKey(hex.q, hex.r);

        // Targeting mode
        if (targeting) {
            if (targeting.validHexes.has(key)) {
                if (targeting.skill === '__ranged__') {
                    rangedAttack(hex.q, hex.r);
                    targeting = null;
                } else {
                    executeSkill(targeting.skill, hex.q, hex.r);
                }
            } else {
                targeting = null;
            }
            render();
            updateSkillBar();
            updateSkillsPanel();
            checkEndTurn();
            return;
        }

        if (selected) {
            if (hex.q === player.q && hex.r === player.r) {
                deselectPlayer();
            } else if (attackable && attackable.has(key)) {
                moveAndAttack(hex.q, hex.r);
            } else if (reachable && reachable.has(key)) {
                movePlayer(hex.q, hex.r);
            } else {
                deselectPlayer();
            }
        } else {
            if (hex.q === player.q && hex.r === player.r) {
                selectPlayer();
            }
        }
        render();
        updateSkillBar();
        checkEndTurn();
    }
});

canvas.addEventListener('mousemove', e => {
    if (panning) {
        panX = panOrigX + (e.clientX - panStartX);
        panY = panOrigY + (e.clientY - panStartY);
        render();
    }
    hoveredHex = screenToHex(e.clientX, e.clientY);
    updateHUD();
});

canvas.addEventListener('mouseup', e => { if (e.button === 2) panning = false; });
canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (targeting) { targeting = null; render(); updateSkillBar(); }
});

document.getElementById('end-turn').addEventListener('click', () => {
    if (phase === 'player' && !gameOver) interactOrEndTurn();
});

document.getElementById('new-game').addEventListener('click', () => {
    if (confirm('Start a new game?')) initGame();
});

document.getElementById('endgame-newgame').addEventListener('click', initGame);

document.getElementById('btn-char').addEventListener('click', () => togglePanel('char-panel'));
document.getElementById('btn-skills').addEventListener('click', () => togglePanel('skills-panel'));
document.getElementById('btn-inv').addEventListener('click', () => togglePanel('inv-panel'));
document.getElementById('btn-map').addEventListener('click', toggleWorldMap);

// Close buttons on panels
document.querySelectorAll('.panel-close').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.closest('.side-panel').classList.add('hidden');
    });
});

// Skill bar clicks
document.querySelectorAll('.skill-slot[data-slot]').forEach(slot => {
    slot.addEventListener('click', () => activateSkillSlot(parseInt(slot.dataset.slot)));
});
document.getElementById('ranged-slot').addEventListener('click', () => {
    if (phase === 'player') activateRangedWeapon();
});

window.addEventListener('keydown', e => {
    if (phase === 'dialog') return;
    if (gameOver) return;

    // Dismiss world map
    if (showingWorldMap && (e.key === 'm' || e.key === 'M' || e.key === 'Escape')) {
        e.preventDefault();
        showingWorldMap = false;
        render();
        return;
    }
    if (showingWorldMap) return;

    // Dismiss threat overlay
    if (threatOverlay && (e.key === ' ' || e.key === 'Escape')) {
        e.preventDefault();
        threatOverlay = null;
        render();
        return;
    }

    if (e.key === 'm' || e.key === 'M') {
        toggleWorldMap();
        return;
    }

    if (e.key === ' ' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (phase === 'player') interactOrEndTurn();
    } else if (e.key === 'Escape') {
        if (targeting) { targeting = null; render(); updateSkillBar(); }
        else { deselectPlayer(); closeAllPanels(); render(); }
    } else if (e.key === 'c' || e.key === 'C') {
        togglePanel('char-panel');
    } else if (e.key === 's' || e.key === 'S') {
        togglePanel('skills-panel');
    } else if (e.key === 'i' || e.key === 'I') {
        togglePanel('inv-panel');
    } else if (e.key === 'n' || e.key === 'N') {
        if (confirm('Start a new game?')) initGame();
    } else if (e.key >= '1' && e.key <= '4') {
        activateSkillSlot(parseInt(e.key) - 1);
    } else if (e.key === 'r' || e.key === 'R') {
        if (phase !== 'player') return;
        activateRangedWeapon();
    }
});

function activateRangedWeapon() {
    const wep = player.weapon();
    if (!wep || wep.type !== 'ranged') { logCombat('No ranged weapon!', 'log-info'); return; }
    const cost = (!wep.magical || wep.special === 'free_ranged') ? 0 : 1;
    if (player.aether < cost) { logCombat('Not enough Aether!', 'log-info'); return; }
    const range = player.weaponRange(playerTerrain());
    const validHexes = new Set();
    for (const h of hexesInRange(player.q, player.r, range)) {
        if (em.enemies.some(en => en.q === h.q && en.r === h.r && world.visible.has(hexKey(en.q, en.r))) && world.hasLOS(player, h)) {
            validHexes.add(hexKey(h.q, h.r));
        }
    }
    if (validHexes.size === 0) { logCombat('No targets in range!', 'log-info'); return; }
    targeting = { skill: '__ranged__', validHexes };
    deselectPlayer();
    render();
    updateSkillBar();
}

function activateSkill(skillId) {
    if (phase !== 'player' || gameOver) return;
    const skill = SKILLS[skillId];
    if (!skill) return;
    if (player.aether < skill.cost) { logCombat('Not enough Aether!', 'log-info'); return; }
    if (player.usedSkillsThisTurn.has(skillId)) { logCombat('Already used this turn!', 'log-info'); return; }
    const usageBlock = checkSkillUsage(skill);
    if (usageBlock) { logCombat(usageBlock, 'log-info'); return; }

    if (skill.target === SKILL_TARGET.SELF || skill.target === SKILL_TARGET.AOE_SELF) {
        executeSkill(skillId, player.q, player.r);
        render();
        updateSkillBar();
        updateSkillsPanel();
        checkEndTurn();
        return;
    }

    // Enter targeting mode
    const validHexes = getSkillTargets(skillId);
    if (validHexes.size === 0) { logCombat('No valid targets!', 'log-info'); return; }
    targeting = { skill: skillId, validHexes };
    deselectPlayer();
    render();
    updateSkillBar();
}

function activateSkillSlot(slotIdx) {
    const skillId = player.skills[slotIdx];
    if (!skillId) return;
    activateSkill(skillId);
}

// ---- Start ----
function showIntro() {
    const overlay = document.getElementById('intro-overlay');
    const continueBtn = document.getElementById('intro-continue');
    continueBtn.disabled = !hasSave();
    overlay.classList.remove('hidden');
}

document.getElementById('intro-new').addEventListener('click', () => {
    document.getElementById('intro-overlay').classList.add('hidden');
    initGame();
});
document.getElementById('intro-continue').addEventListener('click', () => {
    if (hasSave()) loadGame();
});

showIntro();
