// index.js — Warrior: Tactical Hex RPG

import {
    HEX_SIZE, TERRAIN, TERRAIN_NAMES, MOVEMENT_COST, PLAYER_MP, MAP_COLS, MAP_ROWS,
    BASE_VISION, MAX_ENEMIES, STARTING_STATS, STAT_POINTS_PER_LEVEL, MAX_DODGE,
    maxHP, maxAether, xpForLevel,
    POI, POI_SYMBOLS, POI_COLORS,
    ENEMY_TYPE, ENEMY_DEFS,
    EQUIP_SLOT, WEAPONS, ARMORS, ARTIFACTS, ALL_EQUIPMENT,
    SKILL_TARGET, SKILLS, SKILL_UNLOCK_LEVELS,
    TERRAIN_DEFENSE_BONUS, TERRAIN_RANGE_BONUS,
    SHATTERED_VERSION, UNSHATTERED_VERSION
} from './config.js';
import { hexToPixel, pixelToHex, hexKey, parseHexKey, hexNeighbors, hexDistance, hexesInRange, bfsHexes, drawHexPath, findPath } from './hex.js';
import { Rando } from './rando.js';
import { ColorTheory } from './colortheory.js';

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
    [TERRAIN.SHATTERED_PLAINS]: '#6b2222',
    [TERRAIN.SHATTERED_HILLS]: '#7a2828',
    [TERRAIN.SHATTERED_FOREST]: '#3a1212',
    [TERRAIN.SHATTERED_GOLD]: '#8b2222',
    [TERRAIN.SHATTERED_QUARRY]: '#5a2525',
};
const PLAYER_COLOR = '#daa520';

// ---- Game state ----
let hexes = null;           // Map<string, hex>
let player = null;          // { q, r, stats, hp, aether, xp, level, gold, equipment, skills, inventory, statPoints, ... }
let enemies = [];           // [{ q, r, type, hp, maxHp, homeQ, homeR, ... }]
let pois = [];              // [{ q, r, type, closed, looted, shopItems, guardianId, ... }]
let selected = false;
let reachable = null;       // Map<string, cost>
let attackable = null;      // Set<string> — enemy hexes within melee reach
let turn = 1;
let mp = PLAYER_MP;
let phase = 'player';       // 'player' | 'enemy' | 'animating' | 'dialog'
let gameOver = false;
let gameWon = false;
let breachesClosed = 0;
let enemiesDefeated = 0;
let revealed = new Set();   // hexKeys that have been seen
let visible = new Set();    // hexKeys currently in vision
let targeting = null;       // { skill, validHexes: Set } or null
let warpShieldTurns = 0;    // turns remaining on Warp Shield
let usedSkillsThisTurn = new Set();
let hoveredHex = null;
let enemyNextId = 0;
let creatureDefs = {};  // generated each game: { creature_0: { name, label, ... }, ... }

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

function getDef(type) { return ENEMY_DEFS[type] || creatureDefs[type]; }

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

function drawCounter(cx, cy, color, label, hpPct, labelColor, atk, def, mov) {
    const s = COUNTER_SIZE;
    const x = cx - s / 2, y = cy - s / 2;
    const r = 4;
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
    ctx.fillStyle = labelColor || contrastText(color);
    ctx.font = 'bold ' + Math.floor(s * 0.55) + 'px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy - 2);
    // Stats: atk-def bottom-left, movement bottom-right
    if (atk !== undefined) {
        const statColor = labelColor || contrastText(color);
        ctx.font = Math.floor(s * 0.28) + 'px monospace';
        ctx.fillStyle = statColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(atk + '-' + def, x + 1, y + s - 1);
        if (mov !== undefined) {
            ctx.textAlign = 'right';
            ctx.fillText(mov, x + s - 1, y + s - 1);
        }
    }
    // HP bar under counter
    if (hpPct !== undefined && hpPct < 1) {
        const bw = s, bh = 3, bx = cx - bw / 2, by = cy + s / 2 + 3;
        ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, bh);
        const g = Math.round(hpPct * 255);
        const rd = Math.round((1 - hpPct) * 255);
        ctx.fillStyle = `rgb(${rd},${g},0)`;
        ctx.fillRect(bx, by, bw * hpPct, bh);
    }
}

// ================================================================
// MAP GENERATION
// ================================================================

function diamondSquare(size, roughness) {
    const grid = new Float64Array(size * size);
    const get = (x, y) => grid[y * size + x];
    const set = (x, y, v) => { grid[y * size + x] = v; };
    set(0, 0, Math.random()); set(size - 1, 0, Math.random());
    set(0, size - 1, Math.random()); set(size - 1, size - 1, Math.random());
    let step = size - 1, scale = roughness;
    while (step > 1) {
        const half = step / 2;
        for (let y = half; y < size - 1; y += step)
            for (let x = half; x < size - 1; x += step)
                set(x, y, (get(x - half, y - half) + get(x + half, y - half) +
                    get(x - half, y + half) + get(x + half, y + half)) / 4 +
                    (Math.random() - 0.5) * scale);
        for (let y = 0; y < size; y += half)
            for (let x = (y + half) % step; x < size; x += step) {
                let sum = 0, cnt = 0;
                if (x >= half) { sum += get(x - half, y); cnt++; }
                if (x + half < size) { sum += get(x + half, y); cnt++; }
                if (y >= half) { sum += get(x, y - half); cnt++; }
                if (y + half < size) { sum += get(x, y + half); cnt++; }
                set(x, y, sum / cnt + (Math.random() - 0.5) * scale);
            }
        step = half; scale *= roughness;
    }
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < grid.length; i++) { min = Math.min(min, grid[i]); max = Math.max(max, grid[i]); }
    for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / (max - min) * 100;
    return grid;
}

function generateRectGrid() {
    const map = new Map();
    const hm = diamondSquare(129, 0.55);
    for (let row = 0; row < MAP_ROWS; row++) {
        const qOffset = -Math.floor(row / 2);
        for (let col = 0; col < MAP_COLS; col++) {
            const q = col + qOffset, r = row;
            const gx = Math.round(col / (MAP_COLS - 1) * 128);
            const gy = Math.round(row / (MAP_ROWS - 1) * 128);
            const elevation = hm[gy * 129 + gx];
            const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;
            map.set(hexKey(q, r), {
                q, r, col, row, elevation, isEdge,
                terrain: null, poi: null, goldLooted: false
            });
        }
    }
    return map;
}

function assignTerrain() {
    const inner = [];
    for (const [, hex] of hexes) {
        if (hex.isEdge) { hex.terrain = TERRAIN.WATER; continue; }
        inner.push(hex);
    }
    inner.sort((a, b) => a.elevation - b.elevation);
    const n = inner.length;
    for (let i = 0; i < n; i++) {
        const pct = i / n;
        if (pct < 0.25) inner[i].terrain = TERRAIN.WATER;
        else if (pct < 0.85) inner[i].terrain = TERRAIN.PLAINS;
        else if (pct < 0.95) inner[i].terrain = TERRAIN.HILLS;
        else inner[i].terrain = TERRAIN.MOUNTAIN;
    }
    const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS);
    Rando.shuffle(plains);
    let idx = 0;
    const forestCount = Math.round(n * 0.10);
    const goldCount = Math.max(3, Math.round(n * 0.01));
    for (let i = 0; i < forestCount && idx < plains.length; i++, idx++) plains[idx].terrain = TERRAIN.FOREST;
    for (let i = 0; i < goldCount && idx < plains.length; i++, idx++) plains[idx].terrain = TERRAIN.GOLD;
    const hills = inner.filter(h => h.terrain === TERRAIN.HILLS);
    Rando.shuffle(hills);
    const quarryCount = Math.max(2, Math.round(n * 0.02));
    for (let i = 0; i < quarryCount && i < hills.length; i++) hills[i].terrain = TERRAIN.QUARRY;
}

function isPassable(hex) {
    return hex && !hex.isEdge && hex.terrain !== TERRAIN.WATER && hex.terrain !== TERRAIN.MOUNTAIN;
}

function passableHexes() {
    const result = [];
    for (const [, hex] of hexes) if (isPassable(hex)) result.push(hex);
    return result;
}

// ================================================================
// POINTS OF INTEREST
// ================================================================

function placePOIs() {
    pois = [];
    const candidates = passableHexes();
    const used = new Set();
    const MIN_DIST = 6;

    function place(type, count, preferRight) {
        let pool = candidates.filter(h => !used.has(hexKey(h.q, h.r)));
        if (preferRight) pool.sort((a, b) => b.col - a.col);
        else Rando.shuffle(pool);

        let placed = 0;
        for (const hex of pool) {
            if (placed >= count) break;
            const key = hexKey(hex.q, hex.r);
            // Minimum distance check
            let tooClose = false;
            for (const poi of pois) {
                if (hexDistance(hex.q, hex.r, poi.q, poi.r) < MIN_DIST) { tooClose = true; break; }
            }
            if (tooClose) continue;
            used.add(key);
            hex.poi = type;
            const poi = { q: hex.q, r: hex.r, type, id: pois.length };
            if (type === POI.HAVEN) poi.shopItems = generateShopItems();
            if (type === POI.RUIN) { poi.looted = false; poi.loot = generateRuinLoot(); poi.ruinEnemies = Rando.int(1, 3); }
            if (type === POI.BREACH) { poi.closed = false; poi.guardianId = null; }
            if (type === POI.MAW) { poi.closed = false; poi.guardianId = null; }
            pois.push(poi);
            placed++;
        }
        return placed;
    }

    place(POI.HAVEN, Rando.int(2, 3), false);
    place(POI.CAMP, Rando.int(4, 6), false);
    place(POI.RUIN, Rando.int(3, 5), false);
    place(POI.BREACH, Rando.int(3, 4), false);
    place(POI.MAW, 1, true);
}

function generateShopItems() {
    const pool = [...WEAPONS.filter(w => w.tier > 0), ...ARMORS.filter(a => a.tier > 0), ...ARTIFACTS.filter(a => a.id !== 'maw_compass')];
    Rando.shuffle(pool);
    return pool.slice(0, Rando.int(3, 5));
}

function generateRuinLoot() {
    const pool = [...WEAPONS.filter(w => w.tier >= 1 && w.tier <= 2), ...ARMORS.filter(a => a.tier >= 1), ...ARTIFACTS.filter(a => a.tier >= 1 && a.id !== 'maw_compass')];
    return Rando.choice(pool);
}

// ================================================================
// PLAYER
// ================================================================

function createPlayer(startHex) {
    const stats = { ...STARTING_STATS };
    return {
        q: startHex.q, r: startHex.r,
        stats,
        hp: maxHP(stats.vigor), aether: maxAether(stats.warding),
        xp: 0, level: 1, gold: 0,
        equipment: {
            [EQUIP_SLOT.WEAPON]: 'rusty_blade',
            [EQUIP_SLOT.ARMOR]: 'worn_leather',
            [EQUIP_SLOT.ARTIFACT]: null
        },
        skills: ['void_strike', 'restore', null, null],
        inventory: [],  // item ids
        statPoints: 0,
        pendingSkillChoice: false
    };
}

function getWeapon() { return ALL_EQUIPMENT[player.equipment[EQUIP_SLOT.WEAPON]]; }
function getArmor() { return ALL_EQUIPMENT[player.equipment[EQUIP_SLOT.ARMOR]]; }
function getArtifact() { return player.equipment[EQUIP_SLOT.ARTIFACT] ? ALL_EQUIPMENT[player.equipment[EQUIP_SLOT.ARTIFACT]] : null; }

function playerDefense() {
    const armor = getArmor();
    let def = armor ? armor.defense : 0;
    const hex = hexes.get(hexKey(player.q, player.r));
    if (hex) def += TERRAIN_DEFENSE_BONUS[hex.terrain] || 0;
    return def;
}

function playerMaxHP() {
    let hp = maxHP(player.stats.vigor);
    const armor = getArmor();
    if (armor && armor.special === 'hp_bonus') hp += armor.hpBonus;
    return hp;
}

function playerMaxAether() {
    let ae = maxAether(player.stats.warding);
    const art = getArtifact();
    if (art && art.special === 'aether_bonus') ae += art.aetherBonus;
    return ae;
}

function playerVision() {
    let v = BASE_VISION;
    const armor = getArmor();
    if (armor && armor.special === 'vision_bonus') v += armor.visionBonus;
    const art = getArtifact();
    if (art && art.special === 'vision_bonus') v += art.visionBonus;
    return v;
}

function playerMP() {
    let m = PLAYER_MP;
    const armor = getArmor();
    if (armor && armor.special === 'mp_penalty') m -= armor.mpPenalty;
    return Math.max(1, m);
}

function playerMeleeDamage(enemy) {
    const wep = getWeapon();
    let dmg = (wep ? wep.damage : 1) + player.stats.might;
    if (wep && wep.special === 'chaos_bonus' && getDef(enemy.type).chaosSpawned) dmg += 2;
    return dmg;
}

function playerRangedDamage() {
    const wep = getWeapon();
    return (wep ? wep.damage : 1) + player.stats.reflex;
}

function playerDodge() { return Math.min(player.stats.reflex, MAX_DODGE); }

function playerWeaponRange() {
    const wep = getWeapon();
    if (!wep || wep.type !== 'ranged') return 0;
    let range = wep.range;
    const hex = hexes.get(hexKey(player.q, player.r));
    if (hex) range += TERRAIN_RANGE_BONUS[hex.terrain] || 0;
    return range;
}

function isEngaged() {
    return enemies.some(e => hexDistance(player.q, player.r, e.q, e.r) === 1);
}

// ================================================================
// ENEMIES
// ================================================================

function spawnEnemy(type, q, r, homeQ, homeR) {
    if (enemies.length >= MAX_ENEMIES) return null;
    const def = getDef(type);
    const e = {
        id: enemyNextId++, type, q, r, hp: def.hp, maxHp: def.hp,
        homeQ: homeQ ?? q, homeR: homeR ?? r, turnsSinceSpawn: 0
    };
    enemies.push(e);
    return e;
}

function spawnInitialEnemies() {
    const passable = passableHexes();
    const occupied = new Set([hexKey(player.q, player.r)]);
    for (const poi of pois) occupied.add(hexKey(poi.q, poi.r));

    // Void Stalkers: 2d4
    const vsCount = Rando.int(1, 4) + Rando.int(1, 4);
    const faCount = Rando.int(1, 3);
    const pool = passable.filter(h => !occupied.has(hexKey(h.q, h.r)));
    Rando.shuffle(pool);
    let pi = 0;
    for (let i = 0; i < vsCount && pi < pool.length; i++, pi++) {
        const h = pool[pi];
        spawnEnemy(ENEMY_TYPE.VOID_STALKER, h.q, h.r);
        occupied.add(hexKey(h.q, h.r));
    }
    for (let i = 0; i < faCount && pi < pool.length; i++, pi++) {
        const h = pool[pi];
        spawnEnemy(ENEMY_TYPE.FLUX_ARCHER, h.q, h.r);
        occupied.add(hexKey(h.q, h.r));
    }

    // Breach guardians and crawlers
    for (const poi of pois) {
        if (poi.type !== POI.BREACH && poi.type !== POI.MAW) continue;
        const neighbors = hexNeighbors(poi.q, poi.r).filter(n => {
            const hex = hexes.get(hexKey(n.q, n.r));
            return hex && isPassable(hex) && !occupied.has(hexKey(n.q, n.r));
        });
        Rando.shuffle(neighbors);

        const guardType = poi.type === POI.MAW ? ENEMY_TYPE.UNRAVELER : ENEMY_TYPE.BREACH_GUARDIAN;
        if (neighbors.length > 0) {
            const gn = neighbors.shift();
            const g = spawnEnemy(guardType, gn.q, gn.r, poi.q, poi.r);
            if (g) { poi.guardianId = g.id; occupied.add(hexKey(gn.q, gn.r)); }
        }
        // 1-2 crawlers near breaches
        if (poi.type === POI.BREACH) {
            const crawlerCount = Rando.int(1, 2);
            for (let i = 0; i < crawlerCount && neighbors.length > 0; i++) {
                const cn = neighbors.shift();
                spawnEnemy(ENEMY_TYPE.BREACH_CRAWLER, cn.q, cn.r, poi.q, poi.r);
                occupied.add(hexKey(cn.q, cn.r));
            }
        }
    }
}

// ================================================================
// WILDLIFE CREATURES
// ================================================================

function generateCreatureName() {
    const predators = ['tiger', 'lion', 'cheetah', 'wolf', 'bear', 'hawk', 'shark', 'viper', 'panther', 'cobra', 'eagle', 'falcon'];
    const prefixes = ['Ash', 'Vel', 'Dra', 'Gor', 'Mur', 'Thr', 'Zan', 'Kri', 'Vor', 'Eld', 'Grim', 'Sar', 'Fen', 'Bal', 'Rix', 'Nar', 'Osi', 'Bry', 'Cal', 'Dul'];
    const suffixes = ['ax', 'or', 'ith', 'old', 'un', 'ek', 'ang', 'us', 'ar', 'on', 'ine', 'oth', 'usk', 'el', 'arn', 'ox'];
    const pred = Rando.choice(predators);
    const prefix = Rando.choice(prefixes);
    const suffix = Rando.choice(suffixes);
    return prefix + pred + suffix;
}

function generateCreatureTypes() {
    creatureDefs = {};
    const usedNames = new Set();
    const palette = ColorTheory.randomScheme(() => Math.random());
    for (let i = 0; i < 12; i++) {
        let name;
        do { name = generateCreatureName(); } while (usedNames.has(name));
        usedNames.add(name);
        const attack = 3 + Math.floor(i * 9 / 11); // 3 to 12 spread across 12 types
        const hp = attack * 4 + Rando.int(-3, 3);
        const defense = Math.floor(attack / 4);
        const xp = attack * 2;
        const gold = Math.max(1, Math.floor(attack / 3));
        const detectRange = Math.min(7, 4 + Math.floor(attack / 4));
        const aggroRange = Rando.int(3, detectRange);
        // Pick a color from the palette, cycling through and varying lightness
        const baseColor = palette[i % palette.length];
        const [h, s, l] = ColorTheory.rgbToHsl(baseColor[0], baseColor[1], baseColor[2]);
        const varied = ColorTheory.hslToRgb(h, Math.min(1, s + 0.1), Math.max(0.3, Math.min(0.7, l + Rando.float(-0.15, 0.15))));
        const color = ColorTheory.rgbToHex(varied[0], varied[1], varied[2]);
        creatureDefs[`creature_${i}`] = {
            name, label: name[0], hp, attack, defense,
            speed: 1, detectRange, aggroRange, xp, gold,
            behavior: 'wildlife', chaosSpawned: false, color
        };
    }
}

function spawnInitialCreatures() {
    const occupied = new Set([hexKey(player.q, player.r)]);
    for (const e of enemies) occupied.add(hexKey(e.q, e.r));
    for (const poi of pois) occupied.add(hexKey(poi.q, poi.r));
    const pool = passableHexes().filter(h => {
        const k = hexKey(h.q, h.r);
        return !occupied.has(k) && !visible.has(k) && UNSHATTERED_VERSION[h.terrain] === undefined;
    });
    Rando.shuffle(pool);
    const types = Object.keys(creatureDefs);
    const count = Math.min(20, pool.length);
    for (let i = 0; i < count; i++) {
        const type = Rando.choice(types);
        spawnEnemy(type, pool[i].q, pool[i].r);
    }
}

// ================================================================
// FOG OF WAR
// ================================================================

function updateVision() {
    visible = new Set();
    const radius = playerVision();
    const inRange = hexesInRange(player.q, player.r, radius);
    for (const h of inRange) {
        const key = hexKey(h.q, h.r);
        if (hexes.has(key)) { visible.add(key); revealed.add(key); }
    }
    // Maw compass reveals the maw
    const art = getArtifact();
    if (art && art.special === 'reveal_maw') {
        for (const poi of pois) {
            if (poi.type === POI.MAW) {
                const key = hexKey(poi.q, poi.r);
                revealed.add(key);
            }
        }
    }
}

// ================================================================
// COMBAT
// ================================================================

function rollDamage(strength) {
    return Rando.bellCurve(strength);
}

function dealDamageToEnemy(enemy, damage, source) {
    const def = getDef(enemy.type);
    const rolled = rollDamage(damage);
    const actualDmg = Math.max(1, rolled - def.defense);
    enemy.hp -= actualDmg;
    logCombat(`${source}: ${actualDmg} dmg to ${def.name}`, 'log-dmg');
    if (enemy.hp <= 0) {
        killEnemy(enemy);
        return true;
    }
    return false;
}

function dealDamageToPlayer(damage, source, isSkillDamage) {
    // Warp Shield check
    if (warpShieldTurns > 0) {
        warpShieldTurns = 0;
        logCombat('Warp Shield absorbed the hit!', 'log-info');
        return;
    }
    // Dodge check
    if (Math.random() * 100 < playerDodge()) {
        logCombat('Dodged!', 'log-info');
        return;
    }
    const rolled = rollDamage(damage);
    let def = playerDefense();
    if (isSkillDamage) {
        def += Math.round(player.stats.warding / 100 * rolled);
    }
    const actualDmg = Math.max(1, rolled - def);
    player.hp -= actualDmg;
    logCombat(`${source}: ${actualDmg} dmg to you`, 'log-dmg');
    if (player.hp <= 0) {
        player.hp = 0;
        endGame(false);
    }
}

function killEnemy(enemy) {
    const def = getDef(enemy.type);
    const idx = enemies.indexOf(enemy);
    if (idx >= 0) enemies.splice(idx, 1);
    enemiesDefeated++;
    const goldGain = Rando.int(1, 5) + (def.gold || 0);
    player.gold += goldGain;
    logCombat(`${def.name} defeated!`, 'log-info');
    logCombat(`+${goldGain}g`, 'log-gold');
    gainXP(def.xp);

    // Breach guardian drop
    if (enemy.type === ENEMY_TYPE.BREACH_GUARDIAN) {
        const drops = [
            WEAPONS.find(w => w.id === 'dimensional_edge'),
            WEAPONS.find(w => w.id === 'phase_rifle'),
            ARMORS.find(a => a.id === 'voidhide'),
            ARTIFACTS.find(a => a.id === 'vitality_stone')
        ].filter(d => d && !player.inventory.includes(d.id) && player.equipment[d.slot || guessSlot(d)] !== d.id);
        if (drops.length > 0) {
            const drop = Rando.choice(drops);
            player.inventory.push(drop.id);
            logCombat(`Found: ${drop.name}!`, 'log-gold');
        }
    }

    // Check if breach can be closed
    for (const poi of pois) {
        if ((poi.type === POI.BREACH || poi.type === POI.MAW) && poi.guardianId === enemy.id) {
            poi.guardianDefeated = true;
            logCombat(`The guardian falls! Step on the breach to seal it.`, 'log-info');
        }
    }
}

function guessSlot(item) {
    if (item.damage !== undefined) return EQUIP_SLOT.WEAPON;
    if (item.defense !== undefined) return EQUIP_SLOT.ARMOR;
    return EQUIP_SLOT.ARTIFACT;
}

function meleeAttack(enemy) {
    const dmg = playerMeleeDamage(enemy);
    const wep = getWeapon();
    const killed = dealDamageToEnemy(enemy, dmg, 'Melee');

    // Cleave: hit adjacent enemies too
    if (wep && wep.special === 'cleave') {
        const adj = hexNeighbors(enemy.q, enemy.r);
        for (const n of adj) {
            const adjEnemy = enemies.find(e => e.q === n.q && e.r === n.r);
            if (adjEnemy) dealDamageToEnemy(adjEnemy, dmg, 'Cleave');
        }
    }

    if (!killed) {
        // Counter-attack
        const def = getDef(enemy.type);
        dealDamageToPlayer(def.attack, `${def.name} counters`, false);
    }
    return killed;
}

function rangedAttack(targetQ, targetR) {
    const enemy = enemies.find(e => e.q === targetQ && e.r === targetR);
    if (!enemy) return;
    const wep = getWeapon();
    let dmg = playerRangedDamage();
    if (wep && wep.special === 'ignore_defense') {
        // Deal full damage, ignoring defense
        const actualDmg = Math.max(1, dmg);
        enemy.hp -= actualDmg;
        logCombat(`Ranged: ${actualDmg} dmg to ${getDef(enemy.type).name}`, 'log-dmg');
        if (enemy.hp <= 0) killEnemy(enemy);
    } else {
        dealDamageToEnemy(enemy, dmg, 'Ranged');
    }
    // Ranged attack costs 1 aether (unless free)
    if (!wep || wep.special !== 'free_ranged') {
        player.aether = Math.max(0, player.aether - 1);
    }
    mp = 0; // ends movement
}

function gainXP(amount) {
    player.xp += amount;
    logCombat(`+${amount} XP`, 'log-xp');
    const needed = xpForLevel(player.level + 1);
    if (player.xp >= needed && player.level < 10) {
        player.level++;
        player.xp -= needed;
        player.hp = playerMaxHP();
        player.aether = playerMaxAether();
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

function executeSkill(skillId, targetQ, targetR) {
    const skill = SKILLS[skillId];
    if (!skill) return;
    if (player.aether < skill.cost) { logCombat('Not enough Aether!', 'log-info'); return; }
    if (usedSkillsThisTurn.has(skillId)) { logCombat('Already used this turn!', 'log-info'); return; }

    player.aether -= skill.cost;
    usedSkillsThisTurn.add(skillId);

    switch (skillId) {
        case 'restore': {
            const range = 1 + Math.floor(player.level / 3);
            const inRange = hexesInRange(player.q, player.r, range);
            const shatteredHexes = [];
            for (const h of inRange) {
                const hex = hexes.get(hexKey(h.q, h.r));
                if (hex && UNSHATTERED_VERSION[hex.terrain] !== undefined) shatteredHexes.push(hex);
            }
            if (shatteredHexes.length === 0) {
                logCombat('No shattered terrain in range!', 'log-info');
                usedSkillsThisTurn.delete(skillId);
                break;
            }
            const totalCost = shatteredHexes.length * 2;
            if (player.aether < totalCost) {
                logCombat(`Need ${totalCost} AE for ${shatteredHexes.length} hexes!`, 'log-info');
                usedSkillsThisTurn.delete(skillId);
                break;
            }
            player.aether -= totalCost;
            for (const hex of shatteredHexes) hex.terrain = UNSHATTERED_VERSION[hex.terrain];
            gainXP(shatteredHexes.length * 3);
            logCombat(`Restored ${shatteredHexes.length} hexes!`, 'log-heal');
            if (!skill.freeAction) mp = 0;
            break;
        }
        case 'void_strike': {
            const enemy = enemies.find(e => e.q === targetQ && e.r === targetR);
            if (!enemy) break;
            const wep = getWeapon();
            const dmg = (wep ? wep.damage : 1) + player.stats.might + player.stats.warding;
            dealDamageToEnemy(enemy, dmg, 'Void Strike');
            if (!skill.freeAction) mp = 0;
            break;
        }
        case 'phase_step': {
            player.q = targetQ;
            player.r = targetR;
            updateVision();
            logCombat('Phase Step!', 'log-info');
            checkHexEntry();
            break;
        }
        case 'cosmic_bolt': {
            const enemy = enemies.find(e => e.q === targetQ && e.r === targetR);
            if (!enemy) break;
            const dmg = skill.baseDamage + player.stats.warding;
            dealDamageToEnemy(enemy, dmg, 'Cosmic Bolt');
            if (!skill.freeAction) mp = 0;
            break;
        }
        case 'warp_shield': {
            warpShieldTurns = skill.duration;
            logCombat('Warp Shield active!', 'log-info');
            if (!skill.freeAction) mp = 0;
            break;
        }
        case 'breach_pulse': {
            const dmg = skill.baseDamage + player.stats.warding;
            const inRange = hexesInRange(player.q, player.r, skill.range);
            for (const h of inRange) {
                const enemy = enemies.find(e => e.q === h.q && e.r === h.r);
                if (enemy) dealDamageToEnemy(enemy, dmg, 'Breach Pulse');
            }
            if (!skill.freeAction) mp = 0;
            break;
        }
        case 'mending_light': {
            const heal = skill.baseHeal + player.stats.vigor * 3;
            player.hp = Math.min(playerMaxHP(), player.hp + heal);
            logCombat(`Healed ${heal} HP`, 'log-heal');
            if (!skill.freeAction) mp = 0;
            break;
        }
        case 'gravity_well': {
            const inRange = hexesInRange(player.q, player.r, skill.range);
            for (const h of inRange) {
                const enemy = enemies.find(e => e.q === h.q && e.r === h.r);
                if (!enemy) continue;
                // Pull 1 hex closer
                const neighbors = hexNeighbors(enemy.q, enemy.r);
                let closest = null, closestDist = Infinity;
                for (const n of neighbors) {
                    const d = hexDistance(n.q, n.r, player.q, player.r);
                    const hex = hexes.get(hexKey(n.q, n.r));
                    if (!hex || !isPassable(hex)) continue;
                    if (enemies.some(e2 => e2 !== enemy && e2.q === n.q && e2.r === n.r)) continue;
                    if (n.q === player.q && n.r === player.r) continue;
                    if (d < closestDist) { closestDist = d; closest = n; }
                }
                if (closest) { enemy.q = closest.q; enemy.r = closest.r; }
            }
            logCombat('Gravity Well!', 'log-info');
            if (!skill.freeAction) mp = 0;
            break;
        }
        case 'dimensional_rend': {
            const enemy = enemies.find(e => e.q === targetQ && e.r === targetR);
            if (!enemy) break;
            const wep = getWeapon();
            const dmg = (wep ? wep.damage : 1) * 3;
            dealDamageToEnemy(enemy, dmg, 'Dimensional Rend');
            if (!skill.freeAction) mp = 0;
            break;
        }
        case 'starfall': {
            const dmg = skill.baseDamage + player.stats.warding * 2;
            const inRange = hexesInRange(player.q, player.r, skill.range);
            for (const h of inRange) {
                const enemy = enemies.find(e => e.q === h.q && e.r === h.r);
                if (enemy) dealDamageToEnemy(enemy, dmg, 'Starfall');
            }
            if (!skill.freeAction) mp = 0;
            break;
        }
    }
    targeting = null;
}

function getSkillTargets(skillId) {
    const skill = SKILLS[skillId];
    if (!skill) return new Set();
    const targets = new Set();

    switch (skill.target) {
        case SKILL_TARGET.SELF:
            targets.add(hexKey(player.q, player.r));
            break;
        case SKILL_TARGET.MELEE: {
            const adj = hexNeighbors(player.q, player.r);
            for (const n of adj) {
                if (enemies.some(e => e.q === n.q && e.r === n.r)) targets.add(hexKey(n.q, n.r));
            }
            break;
        }
        case SKILL_TARGET.RANGED: {
            const range = skill.range || 4;
            const inRange = hexesInRange(player.q, player.r, range);
            for (const h of inRange) {
                if (h.q === player.q && h.r === player.r) continue;
                if (enemies.some(e => e.q === h.q && e.r === h.r) && hasLOS(player, h)) {
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
                const hex = hexes.get(key);
                if (!hex || !isPassable(hex)) continue;
                if (enemies.some(e => e.q === h.q && e.r === h.r)) continue;
                if (visible.has(key)) targets.add(key);
            }
            break;
        }
        case SKILL_TARGET.AOE_SELF:
            targets.add(hexKey(player.q, player.r));
            break;
    }
    return targets;
}

function hasLOS(from, to) {
    // Simple LOS: check hexes along the line for mountains
    const dist = hexDistance(from.q, from.r, to.q, to.r);
    if (dist <= 1) return true;
    for (let i = 1; i < dist; i++) {
        const t = i / dist;
        const midQ = from.q + (to.q - from.q) * t;
        const midR = from.r + (to.r - from.r) * t;
        // Round to nearest hex
        const s = -midQ - midR;
        let rq = Math.round(midQ), rr = Math.round(midR), rs = Math.round(s);
        const qd = Math.abs(rq - midQ), rd = Math.abs(rr - midR), sd = Math.abs(rs - s);
        if (qd > rd && qd > sd) rq = -rr - rs;
        else if (rd > sd) rr = -rq - rs;
        const hex = hexes.get(hexKey(rq, rr));
        if (hex && hex.terrain === TERRAIN.MOUNTAIN) return false;
    }
    return true;
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
    if (mp <= 0) { reachable = new Map(); attackable = new Set(); return; }
    const enemyKeys = new Set(enemies.map(e => hexKey(e.q, e.r)));
    reachable = bfsHexes(player, hexes, hex => {
        if (enemyKeys.has(hexKey(hex.q, hex.r))) return Infinity;
        return MOVEMENT_COST[hex.terrain] ?? Infinity;
    }, mp);
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
}

function checkEndTurn() {
    if (!gameOver && mp <= 0 && phase === 'player') endTurn();
}

function movePlayer(q, r) {
    const key = hexKey(q, r);
    const cost = reachable.get(key);
    if (cost === undefined) return;

    player.q = q;
    player.r = r;
    mp -= cost;
    updateVision();
    checkHexEntry();
    deselectPlayer();
}

function moveAndAttack(enemyQ, enemyR) {
    const enemy = enemies.find(e => e.q === enemyQ && e.r === enemyR);
    if (!enemy) return;

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
        mp -= bestCost;
        updateVision();
    }

    // Attack
    const killed = meleeAttack(enemy);
    if (killed) {
        // Move onto the killed enemy's hex
        const hex = hexes.get(hexKey(enemyQ, enemyR));
        if (hex && isPassable(hex)) {
            const moveCost = MOVEMENT_COST[hex.terrain] ?? 1;
            if (mp >= moveCost) {
                player.q = enemyQ;
                player.r = enemyR;
                mp -= moveCost;
                updateVision();
                checkHexEntry();
            }
        }
    }

    deselectPlayer();
}

function checkHexEntry() {
    const key = hexKey(player.q, player.r);
    const hex = hexes.get(key);
    if (!hex) return;

    // Gold pickup
    if ((hex.terrain === TERRAIN.GOLD || hex.terrain === TERRAIN.SHATTERED_GOLD) && !hex.goldLooted) {
        hex.goldLooted = true;
        const goldAmt = hex.terrain === TERRAIN.SHATTERED_GOLD ? 20 : 10;
        player.gold += goldAmt;
        logCombat(`+${goldAmt}g (gold deposit)`, 'log-gold');
    }

    // POI interaction
    const poi = pois.find(p => p.q === player.q && p.r === player.r);
    if (!poi) return;

    if (poi.type === POI.HAVEN) {
        showHavenDialog(poi);
    } else if (poi.type === POI.CAMP) {
        showCampDialog(poi);
    } else if (poi.type === POI.RUIN && !poi.looted) {
        showRuinDialog(poi);
    } else if (poi.type === POI.BREACH && poi.guardianDefeated && !poi.closed) {
        closeBreach(poi);
    } else if (poi.type === POI.MAW && breachesClosed < 2) {
        logCombat('The Maw resists you. Seal at least 2 breaches first.', 'log-info');
    } else if (poi.type === POI.MAW && poi.guardianDefeated && !poi.closed) {
        endGame(true);
    }
}

function closeBreach(poi) {
    poi.closed = true;
    breachesClosed++;
    logCombat(`Breach sealed! (${breachesClosed} total)`, 'log-info');
    render();
}

function endTurn() {
    if (gameOver) return;
    deselectPlayer();
    phase = 'enemy';
    runEnemyPhase();
}

async function runEnemyPhase() {
    // Vitality Stone regen
    const art = getArtifact();
    if (art && art.special === 'regen') {
        const heal = art.regenAmount;
        player.hp = Math.min(playerMaxHP(), player.hp + heal);
    }
    // Warp Shield countdown
    if (warpShieldTurns > 0) warpShieldTurns--;

    const occupied = new Set([hexKey(player.q, player.r)]);
    for (const e of enemies) occupied.add(hexKey(e.q, e.r));

    for (const enemy of [...enemies]) {
        if (gameOver) break;
        const def = getDef(enemy.type);
        const dist = hexDistance(enemy.q, enemy.r, player.q, player.r);
        const isVisible = visible.has(hexKey(enemy.q, enemy.r));
        const aggro = def.aggroRange || def.detectRange || 0;
        enemy.turnsSinceSpawn++;

        // Wildlife: passive unless aggroed
        if (def.behavior === 'wildlife') {
            if (dist <= aggro) {
                // Aggroed: chase and attack
                moveWildlifeToward(enemy, player.q, player.r, occupied);
                if (isVisible || visible.has(hexKey(enemy.q, enemy.r))) {
                    await animDelay(80);
                    render();
                }
                const newDist = hexDistance(enemy.q, enemy.r, player.q, player.r);
                if (newDist === 1) {
                    dealDamageToPlayer(def.attack, def.name, false);
                    await animDelay(150);
                    render();
                }
            } else if (Rando.bool(0.3)) {
                wanderWildlife(enemy, occupied);
            }
            continue;
        }

        // Phase Wraith teleport
        if (def.behavior === 'teleport' && Math.random() < (def.teleportChance || 0.3)) {
            const targets = hexesInRange(player.q, player.r, def.teleportRange);
            const valid = targets.filter(t => {
                const k = hexKey(t.q, t.r);
                const h = hexes.get(k);
                return h && isPassable(h) && !occupied.has(k) && !(t.q === player.q && t.r === player.r);
            });
            if (valid.length > 0) {
                occupied.delete(hexKey(enemy.q, enemy.r));
                const dest = Rando.choice(valid);
                enemy.q = dest.q; enemy.r = dest.r;
                occupied.add(hexKey(enemy.q, enemy.r));
                if (isVisible || visible.has(hexKey(enemy.q, enemy.r))) {
                    await animDelay(100);
                    render();
                }
            }
        }

        // Movement (chaos enemies: aggro = detectRange)
        let moved = false;
        const speed = def.speed || 1;
        for (let step = 0; step < speed; step++) {
            if (def.behavior === 'guard') {
                if (hexDistance(enemy.q, enemy.r, enemy.homeQ, enemy.homeR) > (def.guardRadius || 2)) {
                    moveEnemyToward(enemy, enemy.homeQ, enemy.homeR, occupied);
                    moved = true;
                } else if (dist <= aggro) {
                    const next = getNextStepToward(enemy, player.q, player.r, occupied);
                    if (next && hexDistance(next.q, next.r, enemy.homeQ, enemy.homeR) <= (def.guardRadius || 2)) {
                        occupied.delete(hexKey(enemy.q, enemy.r));
                        enemy.q = next.q; enemy.r = next.r;
                        occupied.add(hexKey(enemy.q, enemy.r));
                        moved = true;
                    }
                }
            } else if (def.behavior === 'kite') {
                if (dist <= aggro) {
                    if (dist < 2) {
                        moveEnemyAway(enemy, player.q, player.r, occupied);
                    } else if (dist > 3) {
                        moveEnemyToward(enemy, player.q, player.r, occupied);
                    }
                    moved = true;
                } else if (Rando.bool(0.5)) {
                    wanderEnemy(enemy, occupied);
                    moved = true;
                }
            } else if (def.behavior === 'boss') {
                if (dist <= aggro) {
                    moveEnemyToward(enemy, player.q, player.r, occupied);
                    moved = true;
                }
            } else {
                // chase or default
                if (dist <= aggro) {
                    moveEnemyToward(enemy, player.q, player.r, occupied);
                    moved = true;
                } else if (Rando.bool(0.5)) {
                    wanderEnemy(enemy, occupied);
                    moved = true;
                }
            }
        }
        if (moved && (isVisible || visible.has(hexKey(enemy.q, enemy.r)))) {
            await animDelay(80);
            render();
        }

        // Attack
        const newDist = hexDistance(enemy.q, enemy.r, player.q, player.r);
        if (newDist === 1 && (!def.range || def.behavior !== 'kite')) {
            dealDamageToPlayer(def.attack, def.name, false);
            await animDelay(150);
            render();
        }
        if (def.rangedAttack && def.range && newDist <= def.range && newDist > 1 && hasLOS(enemy, player)) {
            dealDamageToPlayer(def.rangedAttack, `${def.name} (ranged)`, false);
            await animDelay(150);
            render();
        } else if (!def.rangedAttack && def.range && newDist <= def.range && newDist > 1 && hasLOS(enemy, player)) {
            if (newDist > 1) {
                dealDamageToPlayer(def.attack, `${def.name} (ranged)`, false);
                await animDelay(150);
                render();
            }
        }

        // Boss spawning
        if (def.behavior === 'boss' && enemy.turnsSinceSpawn > 0 && enemy.turnsSinceSpawn % (def.spawnInterval || 3) === 0) {
            const adj = hexNeighbors(enemy.q, enemy.r).filter(n => {
                const k = hexKey(n.q, n.r);
                const h = hexes.get(k);
                return h && isPassable(h) && !occupied.has(k);
            });
            if (adj.length > 0) {
                const spot = Rando.choice(adj);
                const spawned = spawnEnemy(ENEMY_TYPE.VOID_STALKER, spot.q, spot.r);
                if (spawned) {
                    occupied.add(hexKey(spot.q, spot.r));
                    logCombat('The Unraveler spawns a Void Stalker!', 'log-info');
                }
            }
        }

        // Terrain shattering (2% chance, chaos units only)
        if (def.chaosSpawned && Rando.bool(0.02)) {
            const eHex = hexes.get(hexKey(enemy.q, enemy.r));
            if (eHex && SHATTERED_VERSION[eHex.terrain] !== undefined) {
                eHex.terrain = SHATTERED_VERSION[eHex.terrain];
            }
        }
    }

    if (gameOver) return;

    // Spawn phase
    for (const poi of pois) {
        if (poi.type === POI.BREACH && !poi.closed && Math.random() < 0.15) {
            const adj = hexNeighbors(poi.q, poi.r).filter(n => {
                const k = hexKey(n.q, n.r);
                const h = hexes.get(k);
                return h && isPassable(h) && !occupied.has(k);
            });
            if (adj.length > 0 && enemies.length < MAX_ENEMIES) {
                const spot = Rando.choice(adj);
                const type = Rando.bool(0.6) ? ENEMY_TYPE.VOID_STALKER : ENEMY_TYPE.PHASE_WRAITH;
                spawnEnemy(type, spot.q, spot.r, poi.q, poi.r);
                occupied.add(hexKey(spot.q, spot.r));
            }
        }
    }

    // Wildlife spawn (2% chance per turn)
    if (Rando.bool(0.02)) {
        const types = Object.keys(creatureDefs);
        if (types.length > 0) {
            const pool = passableHexes().filter(h => {
                const k = hexKey(h.q, h.r);
                return !occupied.has(k) && !visible.has(k) && UNSHATTERED_VERSION[h.terrain] === undefined;
            });
            if (pool.length > 0) {
                const spot = Rando.choice(pool);
                spawnEnemy(Rando.choice(types), spot.q, spot.r);
            }
        }
    }

    // Start new turn
    turn++;
    mp = playerMP();
    if (isEngaged()) {
        mp = Math.max(1, Math.floor(mp / 2));
        logCombat('Engaged! Half MP.', 'log-info');
    }
    usedSkillsThisTurn.clear();
    phase = 'player';
    render();
}

function moveEnemyToward(enemy, tq, tr, occupied) {
    const next = getNextStepToward(enemy, tq, tr, occupied);
    if (next) {
        occupied.delete(hexKey(enemy.q, enemy.r));
        enemy.q = next.q; enemy.r = next.r;
        occupied.add(hexKey(enemy.q, enemy.r));
    }
}

function moveEnemyAway(enemy, fromQ, fromR, occupied) {
    const neighbors = hexNeighbors(enemy.q, enemy.r);
    const valid = neighbors.filter(n => {
        const k = hexKey(n.q, n.r);
        const h = hexes.get(k);
        return h && isPassable(h) && !occupied.has(k) && !(n.q === player.q && n.r === player.r);
    });
    if (valid.length === 0) return;
    valid.sort((a, b) => hexDistance(b.q, b.r, fromQ, fromR) - hexDistance(a.q, a.r, fromQ, fromR));
    occupied.delete(hexKey(enemy.q, enemy.r));
    enemy.q = valid[0].q; enemy.r = valid[0].r;
    occupied.add(hexKey(enemy.q, enemy.r));
}

function getNextStepToward(enemy, tq, tr, occupied) {
    // Use A* to find path, take first step
    const path = findPath(
        { q: enemy.q, r: enemy.r },
        { q: tq, r: tr },
        (q, r) => {
            const k = hexKey(q, r);
            const h = hexes.get(k);
            if (!h || !isPassable(h)) return false;
            if (occupied.has(k) && !(q === tq && r === tr)) return false;
            if (q === player.q && r === player.r) return false;
            return true;
        },
        (q, r) => MOVEMENT_COST[hexes.get(hexKey(q, r))?.terrain] ?? Infinity,
        1000
    );
    if (path && path.length >= 2) {
        const next = path[1];
        const k = hexKey(next.q, next.r);
        if (!occupied.has(k) && !(next.q === player.q && next.r === player.r)) return next;
    }
    return null;
}

function wanderEnemy(enemy, occupied) {
    const neighbors = hexNeighbors(enemy.q, enemy.r);
    const valid = neighbors.filter(n => {
        const k = hexKey(n.q, n.r);
        const h = hexes.get(k);
        return h && isPassable(h) && !occupied.has(k) && !(n.q === player.q && n.r === player.r);
    });
    if (valid.length > 0) {
        occupied.delete(hexKey(enemy.q, enemy.r));
        const dest = Rando.choice(valid);
        enemy.q = dest.q; enemy.r = dest.r;
        occupied.add(hexKey(enemy.q, enemy.r));
    }
}

function moveWildlifeToward(enemy, tq, tr, occupied) {
    const neighbors = hexNeighbors(enemy.q, enemy.r);
    const valid = neighbors.filter(n => {
        const k = hexKey(n.q, n.r);
        const h = hexes.get(k);
        if (!h || !isPassable(h) || occupied.has(k)) return false;
        if (n.q === player.q && n.r === player.r) return false;
        if (UNSHATTERED_VERSION[h.terrain] !== undefined) return false;
        return true;
    });
    if (valid.length === 0) return;
    valid.sort((a, b) => hexDistance(a.q, a.r, tq, tr) - hexDistance(b.q, b.r, tq, tr));
    occupied.delete(hexKey(enemy.q, enemy.r));
    enemy.q = valid[0].q; enemy.r = valid[0].r;
    occupied.add(hexKey(enemy.q, enemy.r));
}

function wanderWildlife(enemy, occupied) {
    const neighbors = hexNeighbors(enemy.q, enemy.r);
    const valid = neighbors.filter(n => {
        const k = hexKey(n.q, n.r);
        const h = hexes.get(k);
        if (!h || !isPassable(h) || occupied.has(k)) return false;
        if (n.q === player.q && n.r === player.r) return false;
        // Wildlife avoids shattered terrain
        if (UNSHATTERED_VERSION[h.terrain] !== undefined) return false;
        return true;
    });
    if (valid.length > 0) {
        occupied.delete(hexKey(enemy.q, enemy.r));
        const dest = Rando.choice(valid);
        enemy.q = dest.q; enemy.r = dest.r;
        occupied.add(hexKey(enemy.q, enemy.r));
    }
}

function animDelay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ================================================================
// GAME INIT
// ================================================================

function initGame() {
    gameOver = false;
    gameWon = false;
    turn = 1;
    breachesClosed = 0;
    enemiesDefeated = 0;
    enemies = [];
    pois = [];
    selected = false;
    reachable = null;
    attackable = null;
    targeting = null;
    warpShieldTurns = 0;
    usedSkillsThisTurn.clear();
    revealed = new Set();
    visible = new Set();
    enemyNextId = 0;

    let attempts = 0;
    do {
        hexes = generateRectGrid();
        assignTerrain();
        placePOIs();
        attempts++;
    } while (attempts < 20 && !validateMap());

    // Find starting haven (leftmost)
    const havens = pois.filter(p => p.type === POI.HAVEN);
    havens.sort((a, b) => {
        const ha = hexes.get(hexKey(a.q, a.r));
        const hb = hexes.get(hexKey(b.q, b.r));
        return (ha?.col || 0) - (hb?.col || 0);
    });
    const startHaven = havens[0] || pois[0];

    player = createPlayer(startHaven);
    mp = playerMP();
    updateVision();
    generateCreatureTypes();
    spawnInitialEnemies();
    spawnInitialCreatures();
    centerOn(player);

    // Close panels and overlays
    closeAllPanels();
    document.getElementById('dialog-overlay').classList.add('hidden');
    document.getElementById('endgame-overlay').classList.add('hidden');
    phase = 'player';

    resize();
    updateSkillBar();
}

function validateMap() {
    const havens = pois.filter(p => p.type === POI.HAVEN);
    const maw = pois.find(p => p.type === POI.MAW);
    if (havens.length === 0 || !maw) return false;
    return hasPath(havens[0], maw);
}

function hasPath(from, to) {
    const costs = bfsHexes(from, hexes, hex => {
        const c = MOVEMENT_COST[hex.terrain];
        return c === undefined ? Infinity : c;
    }, Infinity);
    return costs.has(hexKey(to.q, to.r));
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
    for (const [key, hex] of hexes) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 ||
            y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;

        const isRevealed = revealed.has(key);
        const isVisible = visible.has(key);

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

        // Gold indicator
        if ((hex.terrain === TERRAIN.GOLD || hex.terrain === TERRAIN.SHATTERED_GOLD) && !hex.goldLooted) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold ' + Math.floor(HEX_SIZE * 1.2) + 'px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('$', x, y);
        }

        // POI symbols
        if (hex.poi) {
            const poi = pois.find(p => p.q === hex.q && p.r === hex.r);
            if (poi) {
                // Once revealed, POIs always show on the map
                const showPoi = isVisible || isRevealed;
                if (showPoi) {
                    const symbol = POI_SYMBOLS[poi.type] || '?';
                    let color = POI_COLORS[poi.type] || '#fff';
                    if (poi.type === POI.BREACH && poi.closed) color = '#555';
                    if (poi.type === POI.RUIN && poi.looted) color = '#555';
                    ctx.fillStyle = color;
                    ctx.font = 'bold ' + Math.floor(HEX_SIZE * 1.2) + 'px monospace';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(symbol, x, y);
                }
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

    // Targeting highlights
    if (targeting) {
        const skill = SKILLS[targeting.skill];
        const color = skill && skill.target === SKILL_TARGET.TELEPORT
            ? 'rgba(100, 200, 255, 0.3)' : 'rgba(100, 100, 255, 0.35)';
        for (const key of targeting.validHexes) {
            const { q, r } = parseHexKey(key);
            const { x, y } = hexToScreen(q, r);
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = color;
            ctx.fill();
        }
    }

    // Enemies (only visible ones)
    for (const enemy of enemies) {
        const ek = hexKey(enemy.q, enemy.r);
        if (!visible.has(ek)) continue;
        const { x, y } = hexToScreen(enemy.q, enemy.r);
        const def = getDef(enemy.type);
        const color = enemyColor(enemy.type);
        drawCounter(x, y, color, def.label, enemy.hp / enemy.maxHp, undefined, def.attack, def.defense, def.speed || 1);
    }

    // Player
    if (player) {
        const { x, y } = hexToScreen(player.q, player.r);
        const playerLabelColor = phase === 'player' ? '#000' : '#b8941a';
        const wep = getWeapon();
        const pAtk = (wep ? wep.damage : 0) + (wep && wep.type === 'ranged' ? player.stats.reflex : player.stats.might);
        const pDef = playerDefense();
        drawCounter(x, y, PLAYER_COLOR, 'C', player.hp / playerMaxHP(), playerLabelColor, pAtk, pDef, mp);
        if (selected) {
            const s = COUNTER_SIZE + 4;
            roundRect(ctx, x - s / 2, y - s / 2, s, s, 6);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        }
        // Warp Shield indicator
        if (warpShieldTurns > 0) {
            ctx.strokeStyle = '#7c4dff'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, COUNTER_SIZE / 2 + 6, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    updateHUD();
}

function enemyColor(type) {
    const def = getDef(type);
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

function updateHUD() {
    document.getElementById('turn-info').textContent = 'Turn ' + turn;
    const mhp = playerMaxHP();
    document.getElementById('hp-text').textContent = player.hp + '/' + mhp;
    document.getElementById('hp-fill').style.width = (player.hp / mhp * 100) + '%';
    // HP bar color
    const hpPct = player.hp / mhp;
    const hpFill = document.getElementById('hp-fill');
    if (hpPct > 0.5) hpFill.style.background = '#4caf50';
    else if (hpPct > 0.25) hpFill.style.background = '#ff9800';
    else hpFill.style.background = '#f44336';

    const mae = playerMaxAether();
    document.getElementById('ae-text').textContent = player.aether + '/' + mae;
    document.getElementById('ae-fill').style.width = (player.aether / mae * 100) + '%';
    document.getElementById('mp-info').textContent = 'MP: ' + mp + '/' + playerMP();
    document.getElementById('level-info').textContent = 'Lv ' + player.level;
    const xpNeeded = player.level < 10 ? xpForLevel(player.level + 1) : null;
    document.getElementById('xp-text').textContent = player.xp + '/' + (xpNeeded ?? '---');
    document.getElementById('xp-fill').style.width = (xpNeeded ? (player.xp / xpNeeded * 100) : 100) + '%';
    document.getElementById('gold-info').textContent = player.gold + 'g';

    // Context bar
    if (hoveredHex) {
        const hex = hexes.get(hexKey(hoveredHex.q, hoveredHex.r));
        if (hex && revealed.has(hexKey(hex.q, hex.r))) {
            document.getElementById('ctx-terrain').textContent = TERRAIN_NAMES[hex.terrain] || 'Unknown';
            const enemy = enemies.find(e => e.q === hoveredHex.q && e.r === hoveredHex.r && visible.has(hexKey(e.q, e.r)));
            if (enemy) {
                const def = getDef(enemy.type);
                document.getElementById('ctx-entity').textContent = `${def.name} (HP ${enemy.hp}/${enemy.maxHp})`;
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
    for (let i = 0; i < 4; i++) {
        const slot = document.querySelector(`.skill-slot[data-slot="${i}"]`);
        const nameEl = slot.querySelector('.skill-name');
        const skillId = player.skills[i];
        if (skillId) {
            const skill = SKILLS[skillId];
            nameEl.textContent = skill.name;
            const canUse = player.aether >= skill.cost && !usedSkillsThisTurn.has(skillId) && phase === 'player' && !gameOver;
            slot.classList.toggle('disabled', !canUse);
            slot.classList.toggle('used', usedSkillsThisTurn.has(skillId));
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
    const wep = getWeapon();
    derived.innerHTML = `<div class="derived-section">
        <div>Attack: ${wep ? wep.damage : 0} + ${wep?.type === 'ranged' ? player.stats.reflex : player.stats.might}</div>
        <div>Defense: ${playerDefense()}</div>
        <div>Dodge: ${playerDodge()}%</div>
        <div>Vision: ${playerVision()}</div>
        <div>MP: ${playerMP()}</div>
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
            player.hp = Math.min(player.hp, playerMaxHP());
            player.aether = Math.min(player.aether, playerMaxAether());
            updateCharPanel();
            updateHUD();
            updateSkillBar();
        });
    });
}

function updateSkillsPanel() {
    const list = document.getElementById('skills-list');
    let html = '';
    for (let i = 0; i < 4; i++) {
        const skillId = player.skills[i];
        if (skillId) {
            const skill = SKILLS[skillId];
            html += `<div class="skill-entry">
                <div><span class="s-name">${skill.name}</span> <span class="s-cost">(${skill.cost} AE)</span></div>
                <div class="s-desc">${skill.desc}</div>
            </div>`;
        } else {
            html += `<div class="skill-entry"><span style="color:#555">Slot ${i + 1}: Empty</span></div>`;
        }
    }
    list.innerHTML = html;
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
        html += `<div class="inv-item equipped">
            <div><span style="color:#ffc107">${item.name}</span> <span style="color:#888">(${slot}, equipped)</span><br>
            <span style="color:#aaa;font-size:11px">${itemStatLine(item)}</span></div>
            <button data-action="unequip" data-id="${id}" data-slot="${slot}">Unequip</button>
        </div>`;
    }

    // Inventory items
    for (const id of player.inventory) {
        const item = ALL_EQUIPMENT[id];
        if (!item) continue;
        const slot = item.slot;
        html += `<div class="inv-item">
            <div><span>${item.name}</span> <span style="color:#888">(${slot})</span><br>
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
                if (current) player.inventory.push(current);
                player.equipment[slot] = id;
                player.inventory = player.inventory.filter(i => i !== id);
            } else if (action === 'unequip') {
                // Can't unequip weapon to nothing
                player.equipment[slot] = null;
                player.inventory.push(id);
            }
            player.hp = Math.min(player.hp, playerMaxHP());
            player.aether = Math.min(player.aether, playerMaxAether());
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
            chaos_bonus: '+2 vs chaos', cleave: 'Cleave', ignore_defense: 'Ignore def',
            free_ranged: 'Free ranged', hp_bonus: `+${item.hpBonus} HP`,
            vision_bonus: `+${item.visionBonus} vision`, mp_penalty: `-${item.mpPenalty} MP`,
            wraith_immune: 'Wraith immune', aether_bonus: `+${item.aetherBonus} AE`,
            regen: `+${item.regenAmount} HP/turn`, displacement_immune: 'No displacement',
            reveal_maw: 'Reveals Maw'
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
    phase = 'dialog';
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
            phase = 'player';
            if (action) action();
            render();
            updateHUD();
        });
        btnContainer.appendChild(btn);
    }
    overlay.classList.remove('hidden');
}

function showHavenDialog(poi) {
    showDialog(POI_SYMBOLS[POI.HAVEN] + ' Haven', '<p>A place of safety amid the chaos.</p>', [
        {
            label: 'Rest', cls: 'primary', action: () => {
                player.hp = playerMaxHP();
                player.aether = playerMaxAether();
                logCombat('Fully rested.', 'log-heal');
            }
        },
        { label: 'Shop', action: () => showShopDialog(poi) },
        { label: 'Leave' }
    ]);
}

function showCampDialog(poi) {
    showDialog(POI_SYMBOLS[POI.CAMP] + ' Camp', '<p>A brief respite from the wilds.</p>', [
        {
            label: 'Rest', cls: 'primary', action: () => {
                const healAmt = Math.floor(playerMaxHP() * 0.5);
                player.hp = Math.min(playerMaxHP(), player.hp + healAmt);
                const aeAmt = Math.floor(playerMaxAether() * 0.5);
                player.aether = Math.min(playerMaxAether(), player.aether + aeAmt);
                logCombat(`Rested: +${healAmt} HP, +${aeAmt} AE`, 'log-heal');
            }
        },
        { label: 'Leave' }
    ]);
}

function showShopDialog(poi) {
    let bodyHtml = `<div style="margin-bottom:8px;color:#ffc107">Your gold: ${player.gold}</div>`;
    const owned = new Set([...Object.values(player.equipment).filter(Boolean), ...player.inventory]);
    for (const item of poi.shopItems) {
        const equip = ALL_EQUIPMENT[item.id];
        if (!equip) continue;
        if (owned.has(item.id)) continue;
        bodyHtml += `<div class="shop-item">
            <div><span>${item.name}</span><br><span style="color:#aaa;font-size:11px">${itemStatLine(equip)}</span></div>
            <button data-id="${item.id}" data-price="${item.price}" ${player.gold < item.price ? 'disabled' : ''}>Buy ${item.price}g</button>
        </div>`;
    }

    // Sell section
    if (player.inventory.length > 0) {
        bodyHtml += '<div style="margin-top:12px;border-top:1px solid #333;padding-top:8px"><strong>Sell:</strong></div>';
        for (const id of player.inventory) {
            const item = ALL_EQUIPMENT[id];
            if (!item) continue;
            const sellPrice = Math.floor(item.price * 0.4);
            bodyHtml += `<div class="shop-item">
                <div>${item.name}</div>
                <button data-sell="${id}" data-price="${sellPrice}">Sell ${sellPrice}g</button>
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
    body.querySelectorAll('button[data-sell]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.sell;
            const price = parseInt(btn.dataset.price);
            player.inventory = player.inventory.filter(i => i !== id);
            player.gold += price;
            logCombat(`Sold ${ALL_EQUIPMENT[id].name} for ${price}g`, 'log-gold');
            showShopDialog(poi);
        });
    });
}

function showRuinDialog(poi) {
    poi.looted = true;
    const goldFound = Rando.int(5, 20);
    player.gold += goldFound;

    let body = `<p>You explore the ruins...</p><p style="color:#ffc107">Found ${goldFound} gold!</p>`;
    if (poi.loot) {
        player.inventory.push(poi.loot.id);
        body += `<p style="color:#ffc107">Found: ${poi.loot.name}!</p>`;
    }

    // Spawn ruin enemies nearby
    const occupied = new Set(enemies.map(e => hexKey(e.q, e.r)));
    occupied.add(hexKey(player.q, player.r));
    const adj = hexNeighbors(poi.q, poi.r).filter(n => {
        const h = hexes.get(hexKey(n.q, n.r));
        return h && isPassable(h) && !occupied.has(hexKey(n.q, n.r));
    });
    Rando.shuffle(adj);
    const spawnCount = Math.min(poi.ruinEnemies || 1, adj.length);
    for (let i = 0; i < spawnCount; i++) {
        const type = Rando.bool(0.5) ? ENEMY_TYPE.VOID_STALKER : ENEMY_TYPE.FLUX_ARCHER;
        spawnEnemy(type, adj[i].q, adj[i].r);
    }
    if (spawnCount > 0) body += `<p style="color:#ef5350">Enemies emerge from the shadows!</p>`;

    showDialog(POI_SYMBOLS[POI.RUIN] + ' Ruins', body, [{ label: 'Continue' }]);
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
            player.hp = Math.min(player.hp, playerMaxHP());
            player.aether = Math.min(player.aether, playerMaxAether());
            updateHUD();
        });
    });
}

function showSkillChoiceDialog() {
    player.pendingSkillChoice = false;
    // Pick 2 skills the player doesn't have, appropriate for current level
    const available = Object.values(SKILLS).filter(s =>
        s.minLevel <= player.level &&
        !player.skills.includes(s.id)
    );
    if (available.length === 0) return;
    Rando.shuffle(available);
    const choices = available.slice(0, 2);

    let body = '<p>Choose a new skill:</p>';
    for (const skill of choices) {
        body += `<div class="skill-choice" data-skill="${skill.id}">
            <div><span class="sc-name">${skill.name}</span> <span class="sc-cost">(${skill.cost} AE)</span></div>
            <div class="sc-desc">${skill.desc}</div>
        </div>`;
    }

    showDialog('New Skill!', body, []);

    // Wire up choices
    document.getElementById('dialog-body').querySelectorAll('.skill-choice').forEach(el => {
        el.addEventListener('click', () => {
            const skillId = el.dataset.skill;
            // Find first empty slot
            const emptySlot = player.skills.indexOf(null);
            if (emptySlot >= 0) {
                player.skills[emptySlot] = skillId;
            }
            document.getElementById('dialog-overlay').classList.add('hidden');
            phase = 'player';
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
    phase = 'dialog';
    const overlay = document.getElementById('endgame-overlay');
    document.getElementById('endgame-title').textContent = won ? 'VICTORY!' : 'DEFEAT';
    document.getElementById('endgame-title').style.color = won ? '#ffc107' : '#f44336';
    document.getElementById('endgame-body').innerHTML = `
        <div>Turns: ${turn}</div>
        <div>Level: ${player.level}</div>
        <div>Enemies defeated: ${enemiesDefeated}</div>
        <div>Breaches sealed: ${breachesClosed}</div>
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

    if (e.button === 0 && !gameOver && phase === 'player') {
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
    if (phase === 'player' && !gameOver) endTurn();
});

document.getElementById('new-game').addEventListener('click', () => {
    if (confirm('Start a new game?')) initGame();
});

document.getElementById('endgame-newgame').addEventListener('click', initGame);

document.getElementById('btn-char').addEventListener('click', () => togglePanel('char-panel'));
document.getElementById('btn-skills').addEventListener('click', () => togglePanel('skills-panel'));
document.getElementById('btn-inv').addEventListener('click', () => togglePanel('inv-panel'));

// Close buttons on panels
document.querySelectorAll('.panel-close').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.closest('.side-panel').classList.add('hidden');
    });
});

// Skill bar clicks
document.querySelectorAll('.skill-slot').forEach(slot => {
    slot.addEventListener('click', () => activateSkillSlot(parseInt(slot.dataset.slot)));
});

window.addEventListener('keydown', e => {
    if (phase === 'dialog') return;
    if (gameOver) return;

    if (e.key === ' ' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (phase === 'player') endTurn();
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
    const wep = getWeapon();
    if (!wep || wep.type !== 'ranged') { logCombat('No ranged weapon!', 'log-info'); return; }
    const cost = wep.special === 'free_ranged' ? 0 : 1;
    if (player.aether < cost) { logCombat('Not enough Aether!', 'log-info'); return; }
    const range = playerWeaponRange();
    const validHexes = new Set();
    for (const h of hexesInRange(player.q, player.r, range)) {
        if (enemies.some(en => en.q === h.q && en.r === h.r && visible.has(hexKey(en.q, en.r))) && hasLOS(player, h)) {
            validHexes.add(hexKey(h.q, h.r));
        }
    }
    if (validHexes.size === 0) { logCombat('No targets in range!', 'log-info'); return; }
    targeting = { skill: '__ranged__', validHexes };
    deselectPlayer();
    render();
    updateSkillBar();
}

function activateSkillSlot(slotIdx) {
    if (phase !== 'player' || gameOver) return;
    const skillId = player.skills[slotIdx];
    if (!skillId) return;
    const skill = SKILLS[skillId];
    if (player.aether < skill.cost) { logCombat('Not enough Aether!', 'log-info'); return; }
    if (usedSkillsThisTurn.has(skillId)) { logCombat('Already used this turn!', 'log-info'); return; }

    if (skill.target === SKILL_TARGET.SELF || skill.target === SKILL_TARGET.AOE_SELF) {
        executeSkill(skillId, player.q, player.r);
        render();
        updateSkillBar();
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

// ---- Start ----
initGame();
