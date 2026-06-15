// MIT License
//
// Copyright (c) 2026 Rob Young
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// index.js — Warrior: Tactical Hex RPG

import {
    HEX_SIZE, MAP_COLS, MAP_ROWS, TERRAIN, TERRAIN_NAMES, MOVEMENT_COST,
    STAT_POINTS_PER_LEVEL, STARTING_STATS,
    MAX_STUN_CHANCE, STUN_DIVISOR_PRIMARY, STUN_DIVISOR_OTHER,
    xpForLevel,
    POI, POI_SYMBOLS, POI_COLORS, POI_DEFENSE_BONUS,
    ENEMY_TYPE,
    EQUIP_SLOT, WEAPONS, ARMORS, ARTIFACTS, ALL_EQUIPMENT, NON_MAGICAL_ITEMS, CROP_ICONS,
    rollMagicItem, resetEquipment,
    isChaosTerrain, SELL_PRICE_RATIO,
    SKILL_TARGET, SKILL_USAGE, SKILLS, SKILL_UNLOCK_LEVELS,
    SHATTERED_VERSION, UNSHATTERED_VERSION, DISTRESSED_VERSION, UNDISTRESSED_VERSION,
    weaponIsRanged
} from './config.js';
import { hexToPixel, pixelToHex, hexKey, parseHexKey, hexNeighbors, hexDistance, hexesInRange, bfsHexes, drawHexPath } from './hex.js';
import { Rando } from './rando.js';
import { Player } from './player.js';
import { GameWorld } from './world.js';
import { EnemyManager, NUM_CREATURE_TIERS, spawnTierWeights } from './enemies.js';
import { Victory } from './victory.js';
import { Sound } from './sound.js';
import { SpriteSheet } from './sprite_sheet.js';
import {
    MoveAction, RangedAction, MoveAndAttackAction, SkillAction,
    weaponMpCost, skillCostLabel, effectiveAetherCost
} from './actions.js';
import {
    runEnemyPhase as runEnemyPhaseImpl,
    computeMawDistances, mawProximityBonus, mawDistancePeak, pickSpawnPack
} from './enemy_ai.js';

// ---- Sprite sheets ----
const SPRITE_COLS = 5;
const SPRITE_ROWS = 20;
const mainSheet = new SpriteSheet('sprites.png', 48, 51);
// Guardian sheet: 5 cols × 2 rows, row 0 = breach guardians, row 1 = Unraveler
const GSPRITE_COLS = 5;
const guardianSheet = new SpriteSheet('sprites_guardians.png', 1024 / 5, 412 / 2);
let playerSprite = null;    // { col, row }
let enemySprites = {};      // { [enemyType]: { col, row } }

// HUD skill hotbar size (keys 1-N). Must match the .skill-slot count in index.html.
const SKILL_SLOTS = 5;

// Assign sprites: player gets row 0 or 1, enemies get shuffled from rows 2-20
function assignSprites() {
    playerSprite = { col: Rando.int(0, SPRITE_COLS - 1), row: Rando.int(0, 1) };
    const enemyRows = [];
    for (let r = 2; r < SPRITE_ROWS; r++) enemyRows.push(r);
    Rando.shuffle(enemyRows);
    const allTypes = [...Object.values(ENEMY_TYPE), ...Object.keys(em.creatureDefs)];
    enemySprites = {};
    for (let i = 0; i < allTypes.length; i++) {
        enemySprites[allTypes[i]] = { col: Rando.int(0, SPRITE_COLS - 1), row: enemyRows[i % enemyRows.length] };
    }
}

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
    [TERRAIN.RUINS]: '#c8c8c8',
    [TERRAIN.BREACH]: '#3a1040',
    [TERRAIN.MAW]: '#400810',
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
let victory = new Victory();
const sound = new Sound();
let endTurnResolve = null;  // promise resolver for game loop
let gameGeneration = 0;     // incremented on new game to stop old loops
let targeting = null;       // { skill, validHexes: Set } or null
let hoveredHex = null;
let threatOverlay = null;   // Map<string, number> or null — threat heatmap for Ground Weeps
let showingWorldMap = false;
let combatAlerted = false;  // set when player attacks; nearby enemies ignore forest stealth
let scrollOnlySkills = new Set();  // skill ids locked behind map scrolls this run (chosen at game start)

// A skill is unavailable from the normal learn pools (level-up, hut, skill_seek)
// if it's flagged scrollOnly in config OR dynamically locked behind a scroll this run.
function skillLockedToScroll(s) { return s.scrollOnly || scrollOnlySkills.has(s.id); }

// Turn timing metrics (session-only, rolling window of last 1000 turns).
const TURN_METRICS_CAP = 1000;
let turnStartTime = null;
const turnTimesAll = [];
const turnTimesNonPoi = [];

function recordTurnTime() {
    if (turnStartTime === null) return;
    const elapsed = performance.now() - turnStartTime;
    turnStartTime = null;
    turnTimesAll.push(elapsed);
    if (turnTimesAll.length > TURN_METRICS_CAP) turnTimesAll.shift();
    if (world && !world.poiAt(player.q, player.r)) {
        turnTimesNonPoi.push(elapsed);
        if (turnTimesNonPoi.length > TURN_METRICS_CAP) turnTimesNonPoi.shift();
    }
}

function turnTimeStats(arr) {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const pct = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    return {
        n: sorted.length,
        avg: sum / sorted.length,
        p10: pct(0.10), p25: pct(0.25), p50: pct(0.50),
        p75: pct(0.75), p90: pct(0.90),
    };
}

// Dependency bundle for action classes (actions.js). Live game state is exposed
// via getters so that loadGame()/initGame() reassignments of player/world/em/
// victory don't strand stale references inside the actions.
const actionCtx = {
    get player() { return player; },
    get world() { return world; },
    get em() { return em; },
    get victory() { return victory; },
    get sound() { return sound; },
    get reachable() { return reachable; },
    // combat callbacks
    dealDamageToEnemy: (...a) => dealDamageToEnemy(...a),
    rollPlayerStun: (...a) => rollPlayerStun(...a),
    dealDamageToPlayer: (...a) => dealDamageToPlayer(...a),
    killEnemy: (...a) => killEnemy(...a),
    gainXP: (...a) => gainXP(...a),
    enemyDefense: (...a) => enemyDefense(...a),
    enemyMeleeAttack: (...a) => enemyMeleeAttack(...a),
    // orchestration
    logCombat: (...a) => logCombat(...a),
    refreshVision: () => refreshVision(),
    checkHexEntry: () => checkHexEntry(),
    centerOn: (h) => centerOn(h),
    closeBreach: (p) => closeBreach(p),
    endGame: (won) => endGame(won),
    offerSettlementReward: (h) => offerSettlementReward(h),
    showDialog: (...a) => showDialog(...a),
    showOnceDialog: (...a) => showOnceDialog(...a),
    showSkillChoiceDialog: () => showSkillChoiceDialog(),
    showLevelUpDialog: () => showLevelUpDialog(),
    invokeSanctuary: () => invokeSanctuary(),
    // selection / movement
    deselectPlayer: () => deselectPlayer(),
    refreshSelectionAfterAction: () => refreshSelectionAfterAction(),
    playerMoveCost: (h) => playerMoveCost(h),
    playerTerrain: () => playerTerrain(),
    // module-state setters
    setCombatAlerted: (v) => { combatAlerted = v; },
    setThreatOverlay: (v) => { threatOverlay = v; },
};

// ---- Enemy AI context: see enemy_ai.js header for the contract ----
const enemyAiCtx = {
    get player() { return player; },
    get world() { return world; },
    get em() { return em; },
    get victory() { return victory; },
    get sound() { return sound; },
    // predicates
    combatAlerted: () => combatAlerted,
    isGameOver: () => gameOver,
    playerInForest: () => playerInForest(),
    playerTerrain: () => playerTerrain(),
    // combat math (still owned by index.js)
    enemyMeleeAttack: (e, d) => enemyMeleeAttack(e, d),
    enemyRangedAttack: (e, d) => enemyRangedAttack(e, d),
    enemyDefense: (e, d) => enemyDefense(e, d),
    enemyEffectiveMaxHp: (e) => enemyEffectiveMaxHp(e),
    enemyOnCorruptedTerrain: (e, d) => enemyOnCorruptedTerrain(e, d),
    // side-effects
    dealDamageToPlayer: (...a) => dealDamageToPlayer(...a),
    killEnemy: (...a) => killEnemy(...a),
    gainXP: (...a) => gainXP(...a),
    logCombat: (...a) => logCombat(...a),
    render: () => render(),
    animDelay: (ms) => animDelay(ms),
    onScreen: (q, r) => {
        const { x, y } = hexToScreen(q, r);
        return x >= -HEX_SIZE * 2 && x <= canvas.width + HEX_SIZE * 2 &&
               y >= -HEX_SIZE * 2 && y <= canvas.height + HEX_SIZE * 2;
    },
    // round bookkeeping
    tickGarrisons: () => tickGarrisons(),
    advanceTurn: () => advanceTurn(),
};

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

function drawStunOverlay(cx, cy) {
    ctx.fillStyle = 'rgba(180, 180, 180, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, COUNTER_SIZE / 4, 0, Math.PI * 2);
    ctx.fill();
}

const ATTACK_ICON_STROKE = 'rgba(200, 200, 200, 0.9)';

function drawCrosshair(cx, cy) {
    const r = HEX_SIZE * 0.35, arm = HEX_SIZE * 0.55;
    ctx.strokeStyle = ATTACK_ICON_STROKE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
    ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
    ctx.stroke();
}

function drawSword(cx, cy) {
    const h = HEX_SIZE * 0.95;
    const top = cy - h * 0.5;
    const shoulderY = top + HEX_SIZE * 0.16;
    const crossY = cy + h * 0.18;
    const gripBot = cy + h * 0.45;
    const bladeW = HEX_SIZE * 0.13;
    const gripW = HEX_SIZE * 0.11;
    const crossW = HEX_SIZE * 0.5;
    ctx.strokeStyle = ATTACK_ICON_STROKE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Blade: pointy tip + parallel sides to crossguard
    ctx.moveTo(cx, top);
    ctx.lineTo(cx - bladeW / 2, shoulderY);
    ctx.lineTo(cx - bladeW / 2, crossY);
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + bladeW / 2, shoulderY);
    ctx.lineTo(cx + bladeW / 2, crossY);
    // Crossguard
    ctx.moveTo(cx - crossW / 2, crossY);
    ctx.lineTo(cx + crossW / 2, crossY);
    // Grip: open at the crossguard, closed at the bottom
    ctx.moveTo(cx - gripW / 2, crossY);
    ctx.lineTo(cx - gripW / 2, gripBot);
    ctx.lineTo(cx + gripW / 2, gripBot);
    ctx.lineTo(cx + gripW / 2, crossY);
    ctx.stroke();
}

function drawStarBurst(cx, cy) {
    // 7-pointed star traced out-in-out-in around the perimeter (no crossing lines).
    const outer = HEX_SIZE * 0.45, inner = HEX_SIZE * 0.2, N = 7;
    ctx.strokeStyle = ATTACK_ICON_STROKE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < N * 2; i++) {
        const a = (i * Math.PI / N) - Math.PI / 2;
        const rad = i % 2 === 0 ? outer : inner;
        const x = cx + rad * Math.cos(a), y = cy + rad * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
}

// --- Damage "bang" impact stars ------------------------------------------
// One filled spiky star pops over a counter each time it takes damage, lasting
// the length of the hit sfx. Position, rotation, and point count are slightly
// randomized per hit; color is randomly red or yellow.
const HIT_FLASH_MS = 100;            // matches the hit sfx (sound.js NOTE_DUR)
const HIT_BANG_COLORS = ['#ff3b30', '#ffd60a'];
let hitFlashes = [];

function drawHitBang(cx, cy, color, rot, points) {
    const outer = HEX_SIZE * 0.5, inner = HEX_SIZE * 0.2, N = points;
    ctx.beginPath();
    for (let i = 0; i < N * 2; i++) {
        const a = rot + (i * Math.PI / N);
        const rad = i % 2 === 0 ? outer : inner;
        const x = cx + rad * Math.cos(a), y = cy + rad * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function spawnHitFlash(q, r) {
    hitFlashes.push({
        q, r,
        expiry: performance.now() + HIT_FLASH_MS,
        dx: Rando.float(-COUNTER_SIZE * 0.18, COUNTER_SIZE * 0.18),
        dy: Rando.float(-COUNTER_SIZE * 0.18, COUNTER_SIZE * 0.18),
        rot: Rando.float(0, Math.PI * 2),
        points: Rando.int(6, 8),
        color: Rando.choice(HIT_BANG_COLORS),
    });
    render();                        // show it now...
    setTimeout(render, HIT_FLASH_MS + 16);  // ...and clear it after it expires
}

function drawHitFlashes() {
    if (!hitFlashes.length) return;
    const now = performance.now();
    hitFlashes = hitFlashes.filter(f => f.expiry > now);
    for (const f of hitFlashes) {
        const { x, y } = hexToScreen(f.q, f.r);
        drawHitBang(x + f.dx, y + f.dy, f.color, f.rot, f.points);
    }
}

function attackIconForTargeting(t) {
    if (t.skill === '__ranged__') return drawCrosshair;
    if (t.skill === '__melee__') return drawSword;
    const skill = SKILLS[t.skill];
    if (!skill) return null;
    if (skill.target === SKILL_TARGET.MELEE) return drawSword;
    if (skill.target === SKILL_TARGET.RANGED) return drawCrosshair;
    if (skill.target === SKILL_TARGET.RANGED_AOE) return drawStarBurst;
    return null;
}

function drawIconOnHexes(iconFn, hexKeys) {
    for (const key of hexKeys) {
        const { q, r } = parseHexKey(key);
        const { x, y } = hexToScreen(q, r);
        iconFn(x, y);
    }
}

function drawAttackIcons() {
    if (targeting) {
        const iconFn = attackIconForTargeting(targeting);
        if (iconFn) drawIconOnHexes(iconFn, targeting.validHexes);
        return;
    }
    if (selected && attackable) {
        const wep = player.weapon();
        const iconFn = weaponIsRanged(wep) ? drawCrosshair : drawSword;
        drawIconOnHexes(iconFn, attackable);
    }
}

// stats: { atk, def, mov } — all required for player/enemy counters
// hpPct: 0..1 — draws HP bar when < 1; pass 1 to skip bar
// labelColor: explicit text color; pass null to auto-contrast
function drawCounter(cx, cy, color, label, hpPct, labelColor, stats, sprite, spriteTint) {
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
    // Sprite or label
    const sheet = sprite && (sprite.sheet || mainSheet);
    const spriteDrawn = sprite && sheet.isReady();
    if (spriteDrawn) {
        const ds = 16, dx = cx - ds / 2, dy = cy - ds / 2 - 2;
        sheet.draw(ctx, sprite.col, sprite.row, dx, dy, ds, ds, spriteTint);
    }
    if (!spriteDrawn) {
        ctx.fillStyle = textColor;
        ctx.font = 'bold ' + Math.floor(s * 0.55) + 'px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy - 2);
    }
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
    const hasCompass = !!player.equipped('reveal_maw');
    const unraveler = em && em.enemies.find(e => e.type === ENEMY_TYPE.UNRAVELER);
    // Compass reveals the Maw plus every chaos unit and its adjacent hexes
    world.updateVision(player.q, player.r, player.vision(), hasCompass);
    if (hasCompass && em) {
        for (const enemy of em.enemies) {
            if (!em.getDef(enemy.type)?.chaosSpawned) continue;
            for (const h of hexesInRange(enemy.q, enemy.r, 1)) {
                const key = hexKey(h.q, h.r);
                if (world.hexes.has(key)) { world.revealed.add(key); world.visible.add(key); }
            }
        }
    }
    // First-sight intro for the Unraveler
    if (unraveler && world.visible.has(hexKey(unraveler.q, unraveler.r))) {
        showOnceDialog('unravelerSighted', 'The Unraveler',
            '<p>A chaos-wrought figure stirs near the Maw. <b>The Unraveler</b> walks the world.</p><p>While it lives, the Maw cannot be sealed. Hunt it down — and beware: each time you fell it, it reforms within another chaos spawn until none remain.</p>',
            [{ label: 'Steady', cls: 'btn-primary' }]);
    }
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
    let eDef = opts.ignoreDefense ? 0 : enemyDefense(enemy, def);
    if (opts.pierceAmount) eDef = Math.max(0, eDef - opts.pierceAmount);
    const dealt = Math.max(1, rolled - eDef);
    enemy.hp -= dealt;
    victory.damageDealt += dealt;
    logCombat(`${source}: ${dealt} dmg to ${def.name}`, 'log-dmg');
    sound.hitEnemy();
    spawnHitFlash(enemy.q, enemy.r);
    const stunned = rollPlayerStun(enemy, rolled, opts.stunBucket, opts.stunBonus || 0);
    const killed = enemy.hp <= 0;
    if (killed) killEnemy(enemy);
    return { dealt, killed, stunned };
}

// One stun roll per enemy per player turn (enemy.stunRolledThisTurn gates this).
// bucket: 'primary' = melee/Might-coded (damage/40 + melee weapon stun affix),
//         'other'   = ranged/Reflex/Warding (damage/60, no weapon bonus).
// bonusPct: flat skill-driven addition to the chance (e.g. Stun skill = +50).
// Falsy bucket = no stun roll. Cap 90%. Dead enemies skip.
function rollPlayerStun(enemy, rolledDmg, bucket, bonusPct) {
    if (!bucket || !enemy || enemy.hp <= 0 || enemy.stunRolledThisTurn) return false;
    enemy.stunRolledThisTurn = true;
    const divisor = bucket === 'primary' ? STUN_DIVISOR_PRIMARY : STUN_DIVISOR_OTHER;
    let pct = rolledDmg / divisor * 100;
    if (bucket === 'primary') {
        const wep = player.weapon();
        if (wep && wep.special === 'stun') pct += wep.stunBonus;
    }
    pct += bonusPct;
    pct = Math.min(pct, MAX_STUN_CHANCE);
    if (Math.random() * 100 < pct) {
        enemy.stunnedNextTurn = true;
        logCombat('Stunned!', 'log-info');
        return true;
    }
    return false;
}

function dealDamageToPlayer(damage, source, isSkillDamage, opts = {}) {
    if (opts.isRanged && player.equipped('ranged_immune')) {
        logCombat('Ranged attack negated!', 'log-info');
        return { dealt: 0, avoided: true };
    }
    if (player.warpShieldTurns > 0) {
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
    let dealt = Math.max(1, rolled - def);
    let reflected = 0;
    if (player.reflectTurns > 0 && opts.attacker && !opts.isRanged) {
        const r = SKILLS.reflect;
        if (Rando.bool(r.successPercent / 100)) {
            reflected = Math.max(1, Math.round(dealt * r.reflectPercent / 100));
            dealt = Math.max(1, Math.round(dealt * r.takePercent / 100));
        } else {
            logCombat('Reflect fails!', 'log-info');
        }
    }
    player.hp -= dealt;
    victory.damageTaken += dealt;
    logCombat(`${source}: ${dealt} dmg to you`, 'log-dmg');
    sound.hitPlayer();
    spawnHitFlash(player.q, player.r);
    if (reflected > 0) {
        opts.attacker.hp -= reflected;
        logCombat(`Reflect: ${reflected} dmg to ${em.getDef(opts.attacker.type).name}`, 'log-dmg');
        sound.hitEnemy();
        if (opts.attacker.hp <= 0) killEnemy(opts.attacker);
    }

    if (opts.attacker && !opts.isRanged && opts.attacker.hp > 0) {
        const thornsItem = player.equipped('thorns');
        if (thornsItem) {
            const thornDmg = thornsItem.thornsDamage || Math.round(dealt * (thornsItem.thornsPercent || 50) / 100);
            opts.attacker.hp -= thornDmg;
            logCombat(`Thorns: ${thornDmg} dmg to ${em.getDef(opts.attacker.type).name}`, 'log-dmg');
            sound.hitEnemy();
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

function killEnemy(enemy, opts = {}) {
    const def = em.getDef(enemy.type);
    em.remove(enemy);
    // Unraveler hunt: first kill respawns it in place of a random chaos unit
    if (enemy.type === ENEMY_TYPE.UNRAVELER) {
        const chaosTargets = em.enemies.filter(e => em.getDef(e.type)?.chaosSpawned);
        if (chaosTargets.length > 0) {
            const target = Rando.choice(chaosTargets);
            const tq = target.q, tr = target.r;
            em.remove(target);
            const respawned = em.spawn(ENEMY_TYPE.UNRAVELER, tq, tr, tq, tr);
            if (respawned) {
                respawned.noSpawn = true;
                const maw = world.pois.find(p => p.type === POI.MAW);
                if (maw) maw.guardianId = respawned.id;
                logCombat('The Unraveler reforms within another chaos spawn!', 'log-dmg');
            }
            gainXP(def.xp);
            sound.killEnemy();
            showDialog('The Unraveler', '<p>The Unraveler has jumped to another host!</p>', [{ label: 'OK', cls: 'btn-primary' }]);
            return;
        }
        showDialog('The Unraveler Vanquished', '<p>The Unraveler is vanquished! Now close the Maw!</p>', [{ label: 'OK', cls: 'btn-primary' }]);
        sound.victory(2);
    }
    victory.enemiesDefeated++;
    if (enemy.type === ENEMY_TYPE.BREACH_GUARDIAN) {
        victory.guardiansDefeated++;
        sound.victory();
    } else if (enemy.type !== ENEMY_TYPE.UNRAVELER) {
        sound.killEnemy();
    }
    if (opts.byGarrison) victory.garrisonKills++;
    const goldGain = Rando.int(1, 5) + (def.gold || 0);
    player.gold += goldGain;
    victory.goldCollected += goldGain;
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
    const soulXP = player.sumEquipped('soul_harvest', 'soulHarvestXP');
    if (soulXP) {
        gainXP(soulXP);
        logCombat(`Soul Harvest: +${soulXP} XP`, 'log-xp');
    }
    // Opportunist: chance for bonus gold on kill
    if (player.equipped('opportunist') && Rando.bool(0.25)) {
        const bonusGold = Rando.int(3, 8);
        player.gold += bonusGold;
        victory.goldCollected += bonusGold;
        logCombat(`Opportunist: +${bonusGold}g`, 'log-gold');
    }

    // Settlement bounty: felling a monster or ruins-guardian near a haven/village rewards the player
    if (def.behavior === 'monster' || def.behavior === 'ruins-guardian') {
        offerSettlementReward([{ q: enemy.q, r: enemy.r }]);
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

// Roll loot for a POI search/seal: 1-3 unique non-magical + 1 magical item,
// plus gold in [goldMin, goldMax]. Mutates player + victory; returns dialog data.
function rollPoiLoot(goldMin, goldMax) {
    const goldFound = Rando.int(goldMin, goldMax);
    player.gold += goldFound;
    victory.goldCollected += goldFound;

    const items = [];
    const available = NON_MAGICAL_ITEMS.filter(i => !playerHasItem(i.id));
    Rando.shuffle(available);
    const nonMagicalCount = Math.min(Rando.int(1, 3), available.length);
    for (let i = 0; i < nonMagicalCount; i++) {
        player.inventory.push(available[i].id);
        items.push({ name: available[i].name, magical: false });
    }

    const magicalDrop = rollMagicItem();
    player.inventory.push(magicalDrop.id);
    items.push({ name: magicalDrop.name, magical: true });

    return { goldFound, items };
}

function formatLootHtml(intro, loot) {
    let body = `<p>${intro}</p><p style="color:#ffc107">Found ${loot.goldFound} gold!</p>`;
    for (const item of loot.items) {
        const color = item.magical ? '#e040fb' : '#ffc107';
        const suffix = item.magical ? '!' : '';
        body += `<p style="color:${color}">Found: ${item.name}${suffix}</p>`;
    }
    return body;
}

function refreshSelectionAfterAction() {
    if (player.mp > 0) computeReachable();
    else deselectPlayer();
}

function rangedAttack(targetQ, targetR) {
    new RangedAction(actionCtx, targetQ, targetR).execute();
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
// SKILL EXECUTION  (handlers live in actions.js)
// ================================================================

// UI-side guard: returns null if the skill is usable in the current context,
// or a short reason string ("Too close to enemies!", "Cannot use on shattered
// terrain!") to display in tooltips and disable buttons. Skill handlers
// themselves don't call this — they trust the caller has filtered.
function checkSkillUsage(skill) {
    if (skill.id === 'phase_step' && player.phaseStepUsedThisTurn) return 'Phase Step already used this turn!';
    const usage = skill.usage || SKILL_USAGE.ANYTIME;
    if (usage === SKILL_USAGE.ANYTIME) return null;
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
    if (isMeleeSkill(skill) && hexDistance(player.q, player.r, targetQ, targetR) > 1) {
        moveAdjacentForSkill(targetQ, targetR);
    }
    new SkillAction(actionCtx, skillId, targetQ, targetR).execute();
    targeting = null;
}

function isMeleeSkill(skill) {
    return skill && (skill.target === SKILL_TARGET.MELEE || skill.target === SKILL_TARGET.MELEE_EXECUTE);
}

function meleeSkillTargets(enemyFilter) {
    const result = new Set();
    const findEnemy = (q, r) => em.enemies.find(e => e.q === q && e.r === r);
    for (const n of hexNeighbors(player.q, player.r)) {
        const enemy = findEnemy(n.q, n.r);
        if (enemy && enemyFilter(enemy)) result.add(hexKey(n.q, n.r));
    }
    if (reachable) {
        for (const [key] of reachable) {
            const { q, r } = parseHexKey(key);
            for (const n of hexNeighbors(q, r)) {
                const enemy = findEnemy(n.q, n.r);
                if (enemy && enemyFilter(enemy)) result.add(hexKey(n.q, n.r));
            }
        }
    }
    return result;
}

function moveAdjacentForSkill(targetQ, targetR) {
    let bestHex = null, bestCost = Infinity;
    for (const n of hexNeighbors(targetQ, targetR)) {
        const cost = reachable ? reachable.get(hexKey(n.q, n.r)) : undefined;
        if (cost !== undefined && cost < bestCost) { bestCost = cost; bestHex = n; }
    }
    if (!bestHex || bestCost <= 0) return;
    player.q = bestHex.q;
    player.r = bestHex.r;
    player.mp -= bestCost;
    player.movedThisTurn = true;
    player.hexesMovedThisTurn += bestCost;
    refreshVision();
}

// A ranged-class skill fires through the held bow: its range becomes the
// weapon's effective (terrain/POI-modified) range when a ranged weapon is
// equipped, otherwise it falls back to the skill's own range.
function effectiveSkillRange(skill) {
    if (skill.weaponClass === 'ranged' && weaponIsRanged(player.weapon())) {
        const poi = world.poiAt(player.q, player.r);
        return player.weaponRange(playerTerrain(), poi ? poi.type : null);
    }
    return skill.range || 4;
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
            for (const k of meleeSkillTargets(() => true)) targets.add(k);
            break;
        }
        case SKILL_TARGET.MELEE_EXECUTE: {
            const isExec = enemy => enemy && enemy.hp <= enemyEffectiveMaxHp(enemy) / 2;
            for (const k of meleeSkillTargets(isExec)) targets.add(k);
            break;
        }
        case SKILL_TARGET.RANGED: {
            const range = effectiveSkillRange(skill);
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
        case SKILL_TARGET.WATER_SKIP: {
            const range = skill.range || 4;
            const playerHex = world.getHex(player.q, player.r);
            const playerOnWater = playerHex && playerHex.terrain === TERRAIN.WATER;
            const inRange = hexesInRange(player.q, player.r, range);
            for (const h of inRange) {
                const key = hexKey(h.q, h.r);
                if (h.q === player.q && h.r === player.r) continue;
                const hex = world.getHex(h.q, h.r);
                if (!hex || hex.isEdge) continue;
                const isWater = hex.terrain === TERRAIN.WATER;
                if (playerOnWater) {
                    if (!isWater && !world.isPassable(hex)) continue;
                } else {
                    if (!isWater) continue;
                }
                if (em.enemies.some(e => e.q === h.q && e.r === h.r)) continue;
                if (!world.visible.has(key)) continue;
                if (!world.hasLOS(player, h)) continue;
                targets.add(key);
            }
            break;
        }
        case SKILL_TARGET.MOUNTAIN_SKIP: {
            const range = skill.range || 4;
            const playerHex = world.getHex(player.q, player.r);
            const playerOnMountain = playerHex && playerHex.terrain === TERRAIN.MOUNTAIN;
            const inRange = hexesInRange(player.q, player.r, range);
            for (const h of inRange) {
                const key = hexKey(h.q, h.r);
                if (h.q === player.q && h.r === player.r) continue;
                const hex = world.getHex(h.q, h.r);
                if (!hex || hex.isEdge) continue;
                const isMountain = hex.terrain === TERRAIN.MOUNTAIN;
                if (playerOnMountain) {
                    if (!isMountain && !world.isPassable(hex)) continue;
                } else {
                    if (!isMountain) continue;
                }
                if (em.enemies.some(e => e.q === h.q && e.r === h.r)) continue;
                if (!world.visible.has(key)) continue;
                if (!world.hasLOS(player, h)) continue;
                targets.add(key);
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

function playerMoveCost(hex) {
    const baseCost = MOVEMENT_COST[hex.terrain] ?? Infinity;
    if (baseCost === Infinity) return Infinity;
    const poi = world.poiAt(hex.q, hex.r);
    if (poi && (poi.type === POI.HAVEN || poi.type === POI.VILLAGE)) return 1;
    if (player.equipped('strider') && baseCost > 1) return 1;
    return baseCost;
}

function computeReachable() {
    if (player.mp <= 0) { reachable = new Map(); attackable = new Set(); return; }
    const enemyKeys = new Set(em.enemies.map(e => hexKey(e.q, e.r)));
    reachable = bfsHexes(player, world.hexes, hex => {
        if (enemyKeys.has(hexKey(hex.q, hex.r))) return Infinity;
        return playerMoveCost(hex);
    }, player.mp);
    reachable.delete(hexKey(player.q, player.r));

    attackable = computeAttackable(enemyKeys);
}

function computeAttackable(enemyKeys) {
    const wep = player.weapon();
    if (weaponIsRanged(wep)) return computeRangedAttackable();
    return computeMeleeAttackable(enemyKeys);
}

function computeRangedAttackable() {
    const result = new Set();
    const wep = player.weapon();
    const cost = (!wep.magical || wep.special === 'free_ranged' || wep.special === 'channel') ? 0 : 1;
    if (player.aether < cost) return result;
    const playerPoi = world.poiAt(player.q, player.r);
    const range = player.weaponRange(playerTerrain(), playerPoi ? playerPoi.type : null);
    for (const h of hexesInRange(player.q, player.r, range)) {
        if (em.enemies.some(en => en.q === h.q && en.r === h.r && world.visible.has(hexKey(en.q, en.r))) && world.hasLOS(player, h)) {
            result.add(hexKey(h.q, h.r));
        }
    }
    return result;
}

function computeMeleeAttackable(enemyKeys) {
    const result = new Set();
    for (const n of hexNeighbors(player.q, player.r)) {
        const nk = hexKey(n.q, n.r);
        if (enemyKeys.has(nk)) result.add(nk);
    }
    for (const [key] of reachable) {
        const { q, r } = parseHexKey(key);
        for (const n of hexNeighbors(q, r)) {
            const nk = hexKey(n.q, n.r);
            if (enemyKeys.has(nk)) result.add(nk);
        }
    }
    const blinkItem = player.equipped('blink_ring');
    if (blinkItem) {
        const blinkRange = blinkItem.blinkRange || 4;
        for (const enemy of em.enemies) {
            const dist = hexDistance(player.q, player.r, enemy.q, enemy.r);
            if (dist <= blinkRange && dist > 1) {
                result.add(hexKey(enemy.q, enemy.r));
            }
        }
    }
    return result;
}

function checkEndTurn() {
    if (!gameOver && player.mp <= 0 && phase === 'player') endTurn();
}

function resolveEndTurn() {
    if (endTurnResolve) { const r = endTurnResolve; endTurnResolve = null; r(); }
}

function movePlayer(q, r) {
    const cost = reachable.get(hexKey(q, r));
    if (cost === undefined) return;
    new MoveAction(actionCtx, q, r, cost).execute();
}

function moveAndAttack(enemyQ, enemyR) {
    new MoveAndAttackAction(actionCtx, enemyQ, enemyR).execute();
}

function eatCrop() {
    const heal = Math.ceil(player.maxHP() / 10);
    const before = player.hp;
    player.hp = Math.min(player.maxHP(), player.hp + heal);
    const gained = player.hp - before;
    if (gained > 0) logCombat(`+${gained} HP (food)`, 'log-heal');
}

function checkHexEntry() {
    const hex = world.getHex(player.q, player.r);
    if (!hex) return;

    // Gold pickup
    if (hex.goldDeposit > 0) {
        const goldAmt = hex.goldDeposit;
        player.gold += goldAmt;
        victory.goldCollected += goldAmt;
        hex.goldDeposit = 0;
        logCombat(`+${goldAmt}g (${hex.crop ? 'harvest' : 'gold deposit'})`, 'log-gold');
        if (hex.crop) eatCrop();
        hex.crop = false;
    }

    const enteredPoi = world.poiAt(player.q, player.r);
    if (enteredPoi) openPoiDialog(enteredPoi);
}

function closeBreach(poi) {
    world.closeBreach(poi);
    // A sealed rift is no longer impassable chaos terrain — it settles into hills.
    const hex = world.getHex(poi.q, poi.r);
    if (hex) hex.terrain = TERRAIN.HILLS;
    victory.breachesSealed++;
    logCombat(`Breach sealed! (${world.breachesClosed} total)`, 'log-info');
    sound.victory(poi.type === POI.MAW ? 2 : 1);
    if (poi.type === POI.BREACH) showBreachLootDialog();
    if (poi.type === POI.MAW) sealMaw(poi);
    render();
}

// Sealing the Maw leaves a RETURN scroll within 3 hexes of the settling ground.
// The scroll is NOT revealed — the player seals from within 3 hexes, so it will
// usually be in sight, but must be sought out and stepped on to be claimed.
function sealMaw(maw) {
    world.placeScroll('return', maw.q, maw.r, h => hexDistance(h.q, h.r, maw.q, maw.r) <= 3);
    logCombat('The Maw is sealed. A scroll smolders in the quieted ground nearby.', 'log-info');
    showDialog('The Maw is Sealed',
        '<p>You have closed the Maw. The world breathes again.</p>' +
        '<p>Where the rift collapsed, a <b>\u{1F4DC} scroll</b> has settled into the ground nearby. Seek it out.</p>',
        [{ label: 'Continue', cls: 'btn-primary' }]);
}

function showBreachLootDialog() {
    const loot = rollPoiLoot(50, 100);
    const body = formatLootHtml('Closing the breach scatters its hoard...', loot);
    showDialog('Breach Sealed', body, [{ label: 'Continue', cls: 'btn-primary' }]);
}

// Dialog buttons set player.mp = 0 to make their action costly (turn ends
// via checkEndTurn); leaving MP alone keeps the action free.
function openPoiDialog(poi) {
    if (poi.type === POI.HAVEN) showHavenDialog(poi);
    else if (poi.type === POI.VILLAGE) showVillageDialog(poi);
    else if (poi.type === POI.HUT) showHutDialog(poi);
    else if (poi.type === POI.RUIN) tryRuinInteraction(poi);
    else if (poi.type === POI.SCROLL) pickUpScroll(poi);
}

// New hex-action types branch here.
function hexAction() {
    if (gameOver || phase !== 'player') return;
    const poi = world.poiAt(player.q, player.r);
    if (poi) { openPoiDialog(poi); return; }
    endTurn();
}

function endTurn() {
    if (gameOver) return;
    recordTurnTime();
    deselectPlayer();
    resolveEndTurn();
}

async function runEnemyPhase() {
    await runEnemyPhaseImpl(enemyAiCtx);
}

function advanceTurn() {
    turn++;
    player.mp = player.maxMP();
    if (player.isEngaged(em.enemies) && !player.equipped('disengage')) {
        player.mp = Math.max(1, Math.floor(player.mp / 2));
        logCombat('Engaged! Half MP.', 'log-info');
    }
    player.movedThisTurn = false;
    player.hexesMovedThisTurn = 0;
    player.phaseStepUsedThisTurn = false;
    for (const e of em.enemies) e.stunRolledThisTurn = false;
}

function startPlayerTurn() {
    combatAlerted = false;
    if (player.hp > 0 && player.hp / player.maxHP() < 0.10) victory.nearDeathMoments++;
    turnStartTime = performance.now();
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
        turn, victory: victory.toJSON(),
        player: player.toJSON(),
        world: world.toJSON(),
        enemies: em.toJSON(),
        equipment: ALL_EQUIPMENT,
        playerSprite, enemySprites,
        scrollOnlySkills: [...scrollOnlySkills]
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
    victory = Victory.fromJSON(data.victory);
    selected = false;
    reachable = null;
    attackable = null;
    targeting = null;
    threatOverlay = null;

    // Restore equipment registry
    resetEquipment();
    if (data.equipment) {
        for (const [id, item] of Object.entries(data.equipment)) {
            if (item && item.special === 'recoil') {
                item.special = 'channel';
                if (item.recoilBonus !== undefined) { item.channelBonus = item.recoilBonus; delete item.recoilBonus; }
                if (item.recoilDamage !== undefined) { item.channelDamage = item.recoilDamage; delete item.recoilDamage; }
            }
            ALL_EQUIPMENT[id] = item;
        }
    }

    world = GameWorld.fromJSON(data.world);
    player = Player.fromJSON(data.player);
    em = EnemyManager.fromJSON(data.enemies);
    scrollOnlySkills = new Set(data.scrollOnlySkills || []);

    // Restore or assign sprites (old saves won't have them)
    if (data.playerSprite && data.enemySprites) {
        playerSprite = data.playerSprite;
        enemySprites = data.enemySprites;
    } else {
        assignSprites();
    }

    computeMawDistances(world);
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
    victory = new Victory();
    selected = false;
    reachable = null;
    attackable = null;
    targeting = null;
    threatOverlay = null;
    scrollOnlySkills = new Set();

    resetEquipment();
    world = new GameWorld();
    world.generate();

    // Find starting settlement (farthest haven or village from the Maw by movement cost)
    const settlements = world.pois.filter(p => p.type === POI.HAVEN || p.type === POI.VILLAGE);
    const mawDists = world.mawDistanceMap();
    settlements.sort((a, b) => {
        const da = mawDists?.get(hexKey(a.q, a.r)) ?? -Infinity;
        const db = mawDists?.get(hexKey(b.q, b.r)) ?? -Infinity;
        return db - da;
    });
    const startHaven = settlements[0] || world.pois[0];

    // Drop the two map scrolls now that the start is known. Channel Aether sits
    // within 11 hexes of the start; Retrain hides in the half too far from the
    // Maw to earn a proximity bonus. Both must be reachable on foot from start.
    world.placeScroll('channel', startHaven.q, startHaven.r,
        h => hexDistance(h.q, h.r, startHaven.q, startHaven.r) <= 11);
    if (mawDists) {
        let mawMax = 1;
        for (const c of mawDists.values()) if (c > mawMax) mawMax = c;
        const farThreshold = mawMax * 0.5;
        const farPred = h => (mawDists.get(hexKey(h.q, h.r)) ?? 0) > farThreshold;
        world.placeScroll('respec', startHaven.q, startHaven.r, farPred);

        // Lock 10 random learnable skills behind scrolls hidden in the same far
        // half (too far from the Maw to earn a proximity bonus). A skill is only
        // marked scroll-only if its scroll actually found a home, so a placement
        // failure can never make a skill permanently unobtainable.
        const lockable = Object.values(SKILLS).filter(s =>
            !s.scrollOnly && !s.shopOnly && s.id !== 'restore');
        for (const s of Rando.shuffle([...lockable]).slice(0, 10)) {
            if (world.placeScroll(s.id, startHaven.q, startHaven.r, farPred))
                scrollOnlySkills.add(s.id);
        }
    }

    player = new Player(startHaven.q, startHaven.r);
    refreshVision();
    computeMawDistances(world);
    em = new EnemyManager();
    em.generateCreatureTypes();
    em.spawnInitial(world, player.q, player.r);
    em.spawnInitialCreatures(world, player.q, player.r,
        (q, r) => pickSpawnPack(q, r, player, em),
        world.visible);

    assignSprites();

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
    if (!em || !world || !player) return;

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
                if (poi.type === POI.RUIN) color = poi.ruinState === 'explored' ? '#000' : '#fff';
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
        const isMovement = skill && (skill.target === SKILL_TARGET.TELEPORT || skill.target === SKILL_TARGET.TELEPORT_REVEALED || skill.target === SKILL_TARGET.WATER_SKIP || skill.target === SKILL_TARGET.MOUNTAIN_SKIP);
        const color = isMovement ? 'rgba(100, 200, 255, 0.3)' : 'rgba(255, 60, 60, 0.35)';
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
        let sprite = enemySprites[enemy.type];
        let isGuardianSprite = false;
        if (enemy.type === ENEMY_TYPE.BREACH_GUARDIAN) {
            sprite = { sheet: guardianSheet, col: Math.floor(Math.random() * GSPRITE_COLS), row: 0 };
            isGuardianSprite = true;
        } else if (enemy.type === ENEMY_TYPE.UNRAVELER) {
            sprite = { sheet: guardianSheet, col: Math.floor(Math.random() * GSPRITE_COLS), row: 1 };
            isGuardianSprite = true;
        }
        const chaosLabelColor = (def.chaosSpawned && enemy.type !== ENEMY_TYPE.PHASE_WRAITH && !isGuardianSprite) ? '#d580ff' : null;
        const spriteTint = (def.chaosSpawned && !isGuardianSprite) ? '#d580ff' : null;
        drawCounter(x, y, color, def.label, enemy.hp / effMaxHp, chaosLabelColor, { atk: enemyMeleeAttack(enemy, def), def: enemyDefense(enemy, def), mov: def.speed || 1 }, sprite, spriteTint);
        if (enemy.stunnedNextTurn) drawStunOverlay(x, y);
    }

    // Player
    if (player) {
        const { x, y } = hexToScreen(player.q, player.r);
        const playerLabelColor = phase === 'player' ? '#000' : '#b8941a';
        const wep = player.weapon();
        const pAtk = (wep ? wep.damage : 0) + (weaponIsRanged(wep) ? player.stats.reflex : player.stats.might);
        const pDef = playerDefense();
        drawCounter(x, y, PLAYER_COLOR, 'C', player.hp / player.maxHP(), playerLabelColor, { atk: pAtk, def: pDef, mov: player.mp }, playerSprite);
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
        // Reflect indicator
        if (player.reflectTurns > 0) {
            ctx.strokeStyle = '#ffb74d'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, COUNTER_SIZE / 2 + 6, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // Damage bangs — over the counters that just took a hit
    drawHitFlashes();

    // Attack-target icon overlays — drawn after enemies/player so sprites don't cover them
    drawAttackIcons();

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
        if (poi.type === POI.RUIN) color = poi.ruinState === 'explored' ? '#000' : '#fff';
        ctx.fillStyle = color;
        ctx.fillText(symbol, mx, my);
    }

    // Draw enemies on visible hexes
    const enemySize = Math.max(2, miniSize * 0.5);
    for (const enemy of em.enemies) {
        if (!world.visible.has(hexKey(enemy.q, enemy.r))) continue;
        const { x: ex, y: ey } = mini(enemy.q, enemy.r);
        ctx.fillStyle = enemyColor(enemy.type);
        ctx.beginPath();
        ctx.arc(ex, ey, enemySize, 0, Math.PI * 2);
        ctx.fill();
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
        case ENEMY_TYPE.VOID_STALKER: return '#2a2a2a';
        case ENEMY_TYPE.BREACH_CRAWLER: return '#3a3a3a';
        case ENEMY_TYPE.FLUX_ARCHER: return '#333333';
        case ENEMY_TYPE.PHASE_WRAITH: return '#9b59b6';
        case ENEMY_TYPE.BREACH_GUARDIAN: return '#b890d8';
        case ENEMY_TYPE.UNRAVELER: return '#d580ff';
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
    const hasRanged = weaponIsRanged(wep);
    const rangedCost = hasRanged && wep.magical && wep.special !== 'free_ranged' && wep.special !== 'channel' ? 1 : 0;
    const canRanged = hasRanged && player.aether >= rangedCost && phase === 'player' && !gameOver;
    rangedSlot.classList.toggle('disabled', !canRanged);
    rangedSlot.classList.toggle('active', targeting && targeting.skill === '__ranged__');
    rangedSlot.style.display = hasRanged ? '' : 'none';

    // Skill slots 1-N
    for (let i = 0; i < SKILL_SLOTS; i++) {
        const slot = document.querySelector(`.skill-slot[data-slot="${i}"]`);
        const nameEl = slot.querySelector('.skill-name');
        const skillId = player.skills[i];
        if (skillId) {
            const skill = SKILLS[skillId];
            nameEl.textContent = skill.name;
            const canUse = player.aether >= effectiveAetherCost(player, skill) && phase === 'player' && !gameOver && !checkSkillUsage(skill);
            slot.classList.toggle('disabled', !canUse);
            slot.classList.toggle('used', false);
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
        <div>Attack: ${wep ? wep.damage : 0} + ${weaponIsRanged(wep) ? player.stats.reflex : player.stats.might}</div>
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

    // Turn timing metrics (rolling, last 1000 turns)
    const metrics = document.getElementById('char-metrics');
    const fmt = v => v == null ? '–' : Math.round(v) + 'ms';
    const row = (label, s) => s
        ? `<div style="margin-top:6px;color:#888;font-size:11px">${label} (n=${s.n})</div>
           <div style="font-size:11px">avg ${fmt(s.avg)} · p10 ${fmt(s.p10)} · p25 ${fmt(s.p25)} · p50 ${fmt(s.p50)} · p75 ${fmt(s.p75)} · p90 ${fmt(s.p90)}</div>`
        : `<div style="margin-top:6px;color:#888;font-size:11px">${label}</div><div style="font-size:11px;color:#555">no data</div>`;
    metrics.innerHTML = `<div class="derived-section" style="margin-top:10px"><div style="color:#888;font-size:11px;margin-bottom:2px">TURN TIMING</div>${row('All turns', turnTimeStats(turnTimesAll))}${row('Outside POI', turnTimeStats(turnTimesNonPoi))}</div>`;

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
            render();
        });
    });
}

function updateSkillsPanel() {
    const list = document.getElementById('skills-list');
    let html = '';
    // Show equipped slots
    html += '<div style="color:#888;margin-bottom:4px;font-size:11px">EQUIPPED (click to unequip)</div>';
    for (let i = 0; i < SKILL_SLOTS; i++) {
        const skillId = player.skills[i];
        if (skillId) {
            const skill = SKILLS[skillId];
            html += `<div class="skill-entry" style="cursor:pointer;border-left:2px solid #7c4dff;padding-left:6px" data-unequip="${i}">
                <div><span class="s-name">${skill.name}</span> <span class="s-cost">(${skillCostLabel(skill, player)})</span> <span style="color:#555">[${i + 1}]</span></div>
                <div class="s-desc">${skill.desc}</div>
            </div>`;
        } else {
            html += `<div class="skill-entry"><span style="color:#555">Slot ${i + 1}: Empty</span></div>`;
        }
    }
    // Show learned but not equipped
    const equipped = new Set(player.skills.filter(Boolean));
    const unequipped = [...player.learnedSkills].filter(id => !equipped.has(id)).sort((a, b) => SKILLS[a].name.localeCompare(SKILLS[b].name));
    const canInvokeFromPanel = phase === 'player' && !gameOver;
    if (unequipped.length > 0) {
        html += '<div style="color:#888;margin-top:8px;margin-bottom:4px;font-size:11px">LEARNED (click to equip)</div>';
        for (const skillId of unequipped) {
            const skill = SKILLS[skillId];
            const isUsable = canInvokeFromPanel
                && skill.panelInvoke
                && player.aether >= effectiveAetherCost(player, skill)
                && !checkSkillUsage(skill);
            const nameStyle = isUsable ? 'cursor:pointer;color:#b388ff;border:1px solid #7c4dff;border-radius:3px;padding:1px 6px;background:rgba(124,77,255,0.15)' : '';
            const dim = 'opacity:0.7';
            html += `<div class="skill-entry" style="cursor:pointer" data-equip="${skillId}">
                <div><span class="s-name" ${isUsable ? `data-use="${skillId}" style="${nameStyle}"` : `style="${dim}"`}>${skill.name}</span> <span class="s-cost" style="${dim}">(${skillCostLabel(skill, player)})</span></div>
                <div class="s-desc" style="${dim}">${skill.desc}</div>
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
                // No opening — swap into the last slot
                player.skills[SKILL_SLOTS - 1] = skillId;
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
    if (item.type === 'melee' || item.type === 'ranged') parts.push(`${weaponMpCost(item)} MP`);
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
            charge: item.chargeMultiplier
                ? `x${item.chargeMultiplier} dmg if moved`
                : `+${item.chargeBonus} if moved`,
            channel: `+${item.channelBonus} dmg, ${item.channelDamage} self-dmg`,
            reverberate: `Chain ${item.chainCount} +${item.chainBonus}/jump`,
            riposte: `+${item.riposteDamage || 1} counter-atk`,
            // Ranged weapon effects
            double_shot: 'Double shot',
            triple_shot: 'Triple shot',
            free_ranged: 'Free ranged',
            free_action: '0 MP attack',
            piercing: 'Pierce-through',
            sniper: `+${item.sniperBonus} at max range`,
            splash: `Splash ${item.splashDamage}`,
            stun: `+${item.stunBonus}% stun`,
            sweep: `Sweep ${item.sweepCount} adjacent to you`,
            // Armor effects
            burning_aura: `Burn adjacent ${item.burnAuraDamage}/turn`,
            counter_deflect: `-${item.counterDeflect}% counter-attack dmg`,
            dodge_bonus: `+${item.dodgeBonus}% dodge`,
            heal_on_kill: `+${item.healOnKill} HP/kill`,
            high_def_mp_penalty: `+${item.defBonus} def -${item.mpPenalty} MP`,
            last_stand: `+${item.lastStandBonus} def <50% HP`,
            momentum: `+${item.momentumBonus || 1} def/hex moved`,
            ranged_defense: `+${item.rangedDefenseBonus} def vs ranged`,
            ranged_immune: 'Ranged immune',
            thorns: `${item.thornsPercent || item.thornsDamage || '?'}% reflect`,
            wall_of_steel: `+${item.wallBonus} melee if stationary`,
            // Passive effects
            aether_bonus: `+${item.aetherBonus} max AE`,
            aether_discount: `-${item.aetherDiscount} AE skill cost`,
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
            reveal_maw: 'Reveals chaos',
            revive: `+${item.reviveHp} HP +${item.reviveAether} AE/turn`,
            soul_harvest: `+${item.soulHarvestXP} XP/kill`,
            strider: 'Rough terrain 1 MP',
            threat_shroud: '-2 enemy detect range',
            vigor_bonus: `+${item.vigorBonus} vigor`,
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

function showOnceDialog(key, title, bodyHtml, buttons) {
    if (player.seenDialogs.has(key)) return;
    player.seenDialogs.add(key);
    showDialog(title, bodyHtml, buttons);
}

const HAVEN_GRATITUDE_MESSAGES = [
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

const VILLAGE_GRATITUDE_MESSAGES = [
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

function offerSettlementReward(originHexes) {
    for (const poi of world.pois) {
        if (poi.type !== POI.HAVEN && poi.type !== POI.VILLAGE) continue;
        if (!originHexes.some(h => hexDistance(poi.q, poi.r, h.q, h.r) <= 3)) continue;
        const isHaven = poi.type === POI.HAVEN;
        const reward = isHaven ? Rando.int(5, 20) : Rando.int(1, 10);
        const name = isHaven ? 'Haven' : 'Village';
        const symbol = POI_SYMBOLS[poi.type];
        const msg = Rando.choice(isHaven ? HAVEN_GRATITUDE_MESSAGES : VILLAGE_GRATITUDE_MESSAGES);
        showDialog(`${symbol} ${name}`, `<p>${msg}</p><p style="color:#ffc107">Offering: ${reward} gold</p>`, [
            { label: 'Accept', cls: 'primary', action: () => { player.gold += reward; victory.goldCollected += reward; victory.settlementsRestored++; logCombat(`+${reward}g from ${name.toLowerCase()}`, 'log-gold'); }},
            { label: 'Decline' }
        ]);
        return true;
    }
    return false;
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

// CROP_ICONS lives in config.js (used by bountiful_harvest in actions.js)

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

// Heal half max HP/AE and burn remaining MP — shared by village Rest and Sanctuary.
function restHeal() {
    const healAmt = Math.floor(player.maxHP() * 0.5);
    player.hp = Math.min(player.maxHP(), player.hp + healAmt);
    const aeAmt = Math.floor(player.maxAether() * 0.5);
    player.aether = Math.min(player.maxAether(), player.aether + aeAmt);
    player.mp = 0;
    logCombat(`Rested: +${healAmt} HP, +${aeAmt} AE`, 'log-heal');
}

function showVillageDialog(poi) {
    trySpawnVillageCrop(poi);
    showDialog(POI_SYMBOLS[POI.VILLAGE] + ' Village', '<p>A brief respite from the wilds.</p>', [
        { label: 'Rest', cls: 'primary', action: () => { restHeal(); } },
        { label: 'Leave' }
    ]);
}

// Sanctuary skill: rest in place in one cast — heal half HP/AE, roll the usual
// crop chance, end turn (MP spent to 0). No dialog, no persistent POI.
function invokeSanctuary() {
    logCombat('Sanctuary! You rest in the wilds.', 'log-heal');
    trySpawnVillageCrop({ q: player.q, r: player.r });
    restHeal();
}

function showHutDialog(poi) {
    // 10% chance the Wise Man's skill refreshes to something the player hasn't learned
    if (Rando.bool(0.10)) {
        const unlearnedPool = Object.values(SKILLS).filter(s => s.id !== 'restore' && !s.shopOnly && !skillLockedToScroll(s) && !player.learnedSkills.has(s.id));
        if (unlearnedPool.length > 0) {
            poi.skill = Rando.choice(unlearnedPool).id;
        }
    }

    const skill = SKILLS[poi.skill];
    const skillName = skill ? skill.name : 'unknown art';

    if (player.learnedSkills.has(poi.skill)) {
        showDialog(POI_SYMBOLS[POI.HUT] + " Wise Man's Hut",
            `<p>An old sage peers at you.</p><p style="color:#a1887f">"I have nothing to teach you at this time."</p>`,
            [{ label: 'Leave', action: () => { player.mp = 0; } }]);
    } else {
        showDialog(POI_SYMBOLS[POI.HUT] + " Wise Man's Hut",
            `<p>The sage's eyes light up.</p><p style="color:#b388ff">"I can teach you <b>${skillName}</b>."</p><p class="s-cost">(${skillCostLabel(skill, player)})</p><p class="s-desc">${skill.desc}</p>`,
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
            { label: 'Decline', action: () => { player.mp = 0; } }]);
    }
}

// Stepping onto a scroll claims its skill and consumes the scroll.
function pickUpScroll(poi) {
    const skill = SKILLS[poi.skill];
    world.pois = world.pois.filter(p => p !== poi);
    const hex = world.getHex(poi.q, poi.r);
    if (hex) hex.poi = null;

    if (!player.learnedSkills.has(poi.skill)) {
        player.learnedSkills.add(poi.skill);
        const emptySlot = player.skills.indexOf(null);
        if (emptySlot >= 0) player.skills[emptySlot] = poi.skill;
    }
    logCombat(`You unfurl a scroll and learn ${skill.name}!`, 'log-info');
    updateSkillBar();
    updateSkillsPanel();

    const intro = poi.skill === 'return'
        ? 'You unfurl the scroll the sealed Maw left behind. The way home opens to you. Walk the land as long as you wish; invoke RETURN to tally your journey.'
        : 'You unfurl an ancient scroll. Its knowledge becomes yours.';
    showDialog('\u{1F4DC} ' + skill.name,
        `<p>${intro}</p>` +
        `<p class="s-cost">(${skillCostLabel(skill, player)})</p>` +
        `<p class="s-desc">${skill.desc}</p>` +
        `<p style="color:#aaa;font-size:12px">Added to your skills. If your hotbar was full, equip it from the Skills panel.</p>`,
        [{ label: 'Continue', cls: 'btn-primary' }]);
}

function showShopDialog(poi) {
    if (Rando.bool(0.03)) {
        const newItem = rollMagicItem();
        poi.shopItems.push(newItem);
        logCombat(`A new ${newItem.name} has appeared in the shop!`, 'log-info');
    }
    let bodyHtml = `<div style="margin-bottom:8px;color:#ffc107" data-gold-display>Your gold: ${player.gold}</div>`;
    const owned = new Set([...Object.values(player.equipment).filter(Boolean), ...player.inventory]);
    for (const item of poi.shopItems) {
        const equip = ALL_EQUIPMENT[item.id];
        if (!equip) continue;
        if (owned.has(item.id)) continue;
        const nameColor = equip.magical ? '#e040fb' : '#ccc';
        const shopPrice = item.price;
        bodyHtml += `<div class="shop-item">
            <div><span style="color:${nameColor}">${item.name}</span><br><span style="color:#aaa;font-size:11px">${itemStatLine(equip)}</span></div>
            <button data-id="${item.id}" data-price="${shopPrice}" ${player.gold < shopPrice ? 'disabled' : ''}>Buy ${shopPrice}g</button>
        </div>`;
    }

    // Shop-only skills, listed after items
    const skillsForSale = Object.values(SKILLS).filter(s => s.shopOnly && !player.learnedSkills.has(s.id));
    if (skillsForSale.length > 0) {
        bodyHtml += '<div style="margin-top:12px;border-top:1px solid #333;padding-top:8px"><strong>Skills:</strong></div>';
        for (const skill of skillsForSale) {
            bodyHtml += `<div class="shop-item">
                <div><span style="color:#ffd700">${skill.name}</span><br><span style="color:#aaa;font-size:11px">${skill.desc}</span></div>
                <button data-buy-skill="${skill.id}" data-price="${skill.shopPrice}" ${player.gold < skill.shopPrice ? 'disabled' : ''}>Buy ${skill.shopPrice}g</button>
            </div>`;
        }
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

    showDialog(POI_SYMBOLS[POI.HAVEN] + ' Shop', bodyHtml, [{ label: 'Done', action: () => { player.mp = 0; } }]);

    // Wire up buy/sell buttons
    const body = document.getElementById('dialog-body');
    body.querySelectorAll('button[data-buy-skill]').forEach(btn => {
        btn.addEventListener('click', () => {
            const skillId = btn.dataset.buySkill;
            const price = parseInt(btn.dataset.price);
            if (player.gold < price) return;
            player.gold -= price;
            player.learnedSkills.add(skillId);
            const emptySlot = player.skills.indexOf(null);
            if (emptySlot >= 0) player.skills[emptySlot] = skillId;
            logCombat(`Learned ${SKILLS[skillId].name}`, 'log-gold');
            refreshOpenPanels();
            showShopDialog(poi);
        });
    });
    body.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const price = parseInt(btn.dataset.price);
            if (player.gold >= price) {
                player.gold -= price;
                player.inventory.push(id);
                logCombat(`Bought ${ALL_EQUIPMENT[id].name}`, 'log-gold');
                refreshOpenPanels();
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
            refreshOpenPanels();
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
            refreshOpenPanels();
        });
    });
}

function ruinEnemiesNearby(poi) {
    return em.enemies.some(e => hexDistance(e.q, e.r, poi.q, poi.r) <= 2);
}

// Ruins are deliberately tougher than the surrounding field: same Maw-distance
// gradient as wildlife, biased up by RUIN_TIER_BIAS so the modal creature is
// a rung above what's wandering nearby. The Gaussian tail still allows surprise
// elite encounters even at far ruins.
const RUIN_TIER_BIAS = 2;

function spawnRuinCreatures(poi) {
    if (Object.keys(em.creatureDefs).length === 0) return 0;
    const occupied = buildOccupiedSet();
    const spots = hexesInRange(poi.q, poi.r, 2).filter(h => {
        const hex = world.getHex(h.q, h.r);
        return hex && world.isPassable(hex) && !occupied.has(hexKey(h.q, h.r))
            && !(h.q === player.q && h.r === player.r);
    });
    if (spots.length === 0) return 0;
    Rando.shuffle(spots);
    const peak = Math.min(NUM_CREATURE_TIERS - 1, mawDistancePeak(poi.q, poi.r) + RUIN_TIER_BIAS);
    const weights = spawnTierWeights(em.creatureDefs, peak);
    const targetMight = player.level * 10;
    let mightSum = 0, count = 0;
    for (let i = 0; i < spots.length && mightSum < targetMight; i++) {
        const type = Rando.weighted(weights);
        const e = em.spawn(type, spots[i].q, spots[i].r);
        if (e) {
            mightSum += em.getDef(type).attack;
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
    return spawned;
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
                const spawned = activateRuinSpawn(poi, 'Something stirs in the ruins...');
                if (spawned === 0) player.mp = 0;
            }},
            { label: 'Leave' }
        ]);
    } else if (poi.ruinState === 'spawned') {
        showRuinLootDialog(poi);
    } else {
        showDialog(ruinTitle, '<p>The ruins are quiet\u2026</p>', [
            { label: 'Search', cls: 'primary', action: () => {
                let spawned = 0;
                if (Rando.bool(0.10)) {
                    spawned = activateRuinSpawn(poi, 'New creatures have moved into the ruins!');
                } else {
                    logCombat('Nothing of interest here.', 'log-info');
                }
                if (spawned === 0) player.mp = 0;
            }},
            { label: 'Leave' }
        ]);
    }
}

function showRuinLootDialog(poi) {
    poi.ruinState = 'explored';
    victory.ruinsExplored++;
    const loot = rollPoiLoot(5, 20);
    const body = formatLootHtml('You explore the ruins...', loot);
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
    const available = Object.values(SKILLS).filter(s => !s.shopOnly &&
        !skillLockedToScroll(s) &&
        s.minLevel <= player.level &&
        !player.learnedSkills.has(s.id)
    );
    if (available.length === 0) return;
    Rando.shuffle(available);
    const offered = available.slice(0, 3);

    let body = '<p>Choose a skill to learn:</p><div style="max-height:260px;overflow-y:auto">';
    for (const skill of offered) {
        body += `<div class="skill-choice" data-skill="${skill.id}">
            <div><span class="sc-name">${skill.name}</span> <span class="sc-cost">(${skillCostLabel(skill, player)})</span></div>
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
    const rows = victory.breakdown().map(b =>
        `<div style="display:flex;justify-content:space-between;gap:16px"><span>${b.label}: ${b.value}</span><span style="color:#888">${b.points >= 0 ? '+' : ''}${b.points}</span></div>`
    ).join('');
    document.getElementById('endgame-body').innerHTML = `
        <div>Turns: ${turn}</div>
        <div>Level: ${player.level}</div>
        <div style="margin:8px 0;border-top:1px solid #444;padding-top:8px">${rows}</div>
        <div style="margin-top:8px;border-top:1px solid #444;padding-top:8px;font-size:18px;color:#ffc107">Final Score: ${victory.score()}</div>
    `;
    overlay.classList.remove('hidden');
}

// ================================================================
// COMBAT LOG
// ================================================================

let logPinned = false;
const LOG_FADE_MS = 4500;

function logCombat(msg, cls) {
    const log = document.getElementById('combat-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + (cls || '');
    entry.textContent = msg;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    if (!logPinned) armLogEntryFade(entry);
}

function armLogEntryFade(entry) {
    entry.fadeTimeout = setTimeout(() => { if (entry.parentNode) entry.remove(); }, LOG_FADE_MS);
}

function toggleLogPin() {
    logPinned = !logPinned;
    const log = document.getElementById('combat-log');
    log.classList.toggle('log-pinned', logPinned);
    document.getElementById('log-pin-btn').classList.toggle('active', logPinned);
    for (const entry of log.querySelectorAll('.log-entry')) {
        if (entry.fadeTimeout) { clearTimeout(entry.fadeTimeout); entry.fadeTimeout = null; }
        if (!logPinned) armLogEntryFade(entry);
    }
}

document.getElementById('log-pin-btn').addEventListener('click', toggleLogPin);

// ================================================================
// INPUT HANDLING
// ================================================================

canvas.addEventListener('mousedown', e => {
    sound.init();
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
                } else if (targeting.skill === '__melee__') {
                    moveAndAttack(hex.q, hex.r);
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
                const wep = player.weapon();
                if (weaponIsRanged(wep)) rangedAttack(hex.q, hex.r);
                else moveAndAttack(hex.q, hex.r);
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

document.getElementById('end-turn').addEventListener('click', hexAction);

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
        hexAction();
    } else if (e.key === 'Escape') {
        if (targeting) { targeting = null; render(); updateSkillBar(); }
        else { deselectPlayer(); closeAllPanels(); render(); }
    } else if (e.key === 'c' || e.key === 'C') {
        togglePanel('char-panel');
    } else if (e.key === 's' || e.key === 'S') {
        togglePanel('skills-panel');
    } else if (e.key === 'i' || e.key === 'I') {
        togglePanel('inv-panel');
    } else if (e.key >= '1' && e.key <= String(SKILL_SLOTS)) {
        activateSkillSlot(parseInt(e.key) - 1);
    } else if (e.key === 'r' || e.key === 'R') {
        if (phase !== 'player') return;
        activateRangedWeapon();
    } else if (e.key === 'a' || e.key === 'A') {
        if (phase !== 'player') return;
        activateMeleeAttack();
    }
});

const GARRISON_BUILD_CHANCE = 0.10;
const GARRISON_KILL_RANGE = 5;

function tickGarrisons() {
    // Build progress
    for (const poi of world.pois) {
        if (poi.type !== POI.GARRISON_BUILD) continue;
        if (Rando.bool(GARRISON_BUILD_CHANCE)) {
            poi.type = POI.GARRISON;
            const hex = world.getHex(poi.q, poi.r);
            if (hex) hex.poi = POI.GARRISON;
            victory.garrisonsCompleted++;
            if (world.visible.has(hexKey(poi.q, poi.r))) {
                logCombat('A garrison stands ready!', 'log-info');
            }
        }
    }
    // Defense fire
    for (const poi of world.pois) {
        if (poi.type !== POI.GARRISON) continue;
        const inRange = em.enemies
            .filter(e => {
                const def = em.getDef(e.type);
                return def && def.chaosSpawned && hexDistance(poi.q, poi.r, e.q, e.r) <= GARRISON_KILL_RANGE;
            })
            .sort((a, b) => hexDistance(poi.q, poi.r, a.q, a.r) - hexDistance(poi.q, poi.r, b.q, b.r));
        if (inRange.length === 0) continue;
        const nearestDist = hexDistance(poi.q, poi.r, inRange[0].q, inRange[0].r);
        const nearest = inRange.filter(e => hexDistance(poi.q, poi.r, e.q, e.r) === nearestDist);
        const target = Rando.choice(nearest);
        const def = em.getDef(target.type);
        killEnemy(target, { byGarrison: true });
        if (world.visible.has(hexKey(poi.q, poi.r)) || world.visible.has(hexKey(target.q, target.r))) {
            logCombat(`Garrison slays ${def.name}!`, 'log-dmg');
        }
    }
}

function activateMeleeAttack() {
    computeReachable();
    const enemyKeys = new Set(em.enemies.map(e => hexKey(e.q, e.r)));
    const validHexes = computeMeleeAttackable(enemyKeys);
    if (validHexes.size === 0) return;
    selected = false;
    attackable = null;
    targeting = { skill: '__melee__', validHexes };
    render();
    updateSkillBar();
}

function activateRangedWeapon() {
    const wep = player.weapon();
    if (!weaponIsRanged(wep)) { logCombat('No ranged weapon!', 'log-info'); return; }
    const cost = (!wep.magical || wep.special === 'free_ranged' || wep.special === 'channel') ? 0 : 1;
    if (player.aether < cost) { logCombat('Not enough Aether!', 'log-info'); return; }
    const playerPoi = world.poiAt(player.q, player.r);
    const range = player.weaponRange(playerTerrain(), playerPoi ? playerPoi.type : null);
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
    if (player.aether < effectiveAetherCost(player, skill)) { logCombat('Not enough Aether!', 'log-info'); return; }
    const usageBlock = checkSkillUsage(skill);
    if (usageBlock) { logCombat(usageBlock, 'log-info'); return; }
    if (skillId === 'return') {
        showDialog('Return',
            '<p>End your journey here? Your final score will be tallied.</p>',
            [{ label: 'Cancel', action: () => {} },
             { label: 'Return', cls: 'btn-primary', action: () => endGame(true) }]);
        return;
    }

    if (skill.target === SKILL_TARGET.SELF || skill.target === SKILL_TARGET.AOE_SELF) {
        executeSkill(skillId, player.q, player.r);
        render();
        updateSkillBar();
        updateSkillsPanel();
        checkEndTurn();
        return;
    }

    // Enter targeting mode. Melee skills need `reachable` populated so
    // getSkillTargets can find move-and-attack candidates and executeSkill
    // can move the player adjacent.
    if (isMeleeSkill(skill)) computeReachable();
    const validHexes = getSkillTargets(skillId);
    if (validHexes.size === 0) { logCombat('No valid targets!', 'log-info'); return; }
    targeting = { skill: skillId, validHexes };
    if (isMeleeSkill(skill)) selected = false; // hide selection box; keep reachable for the move step
    else deselectPlayer();
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
