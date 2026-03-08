// Waowisha — The Unraveling
// A weird fantasy/sci-fi hex-grid tactics game

import {
    HEX_SIZE, MAP_RADIUS, TERRAIN, TERRAIN_COLORS, TERRAIN_MOVEMENT, TERRAIN_DEFENSE,
    HEALING_TERRAIN,
    UNIT_TYPE, UNIT_STATS, ENEMY_SPAWN_WEIGHTS,
    VOID_SPREAD_CHANCE, VOID_DAMAGE_PER_TURN,
    PLAYER_COLOR, ENEMY_COLOR, VOID_GLOW,
    HIGHLIGHT_MOVE, HIGHLIGHT_ATTACK, HIGHLIGHT_SELECTED
} from './config.js';
import { hexToPixel, pixelToHex, hexKey, parseHexKey, hexNeighbors, hexDistance, drawHexPath, bfsHexes } from './hex.js';
import { generateTerrain, populateTerrain, findStartingLocation } from './terrain.js';
import { Rando } from './rando.js';

// ---- State ----

const state = {
    hexes: null,
    units: [],
    selectedUnit: null,
    reachableKeys: null,   // Set of hexKey strings the selected unit can move to
    attackableKeys: null,  // Set of hexKey strings with enemies in reach
    turn: 1,
    phase: 'player',       // 'player' | 'enemy' | 'void'
    gameOver: false,
    riftsRemaining: 0,
    riftsInitial: 0,
    voidHexes: new Set(),
    camera: { x: 0, y: 0 },
    animating: false
};

// ---- DOM refs ----

const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const turnNumEl = document.getElementById('turn-num');
const phaseInfoEl = document.getElementById('phase-info');
const endTurnBtn = document.getElementById('end-turn-btn');
const unitInfoEl = document.getElementById('unit-info');
const unitNameEl = document.getElementById('unit-name');
const unitDescEl = document.getElementById('unit-desc');
const unitStatsEl = document.getElementById('unit-stats-grid');
const logEl = document.getElementById('log');
const riftCountEl = document.getElementById('rift-count');
const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayBtn = document.getElementById('overlay-btn');

// ---- Logging ----

function log(msg, cls = 'info') {
    const div = document.createElement('div');
    div.className = 'log-entry ' + cls;
    div.textContent = msg;
    logEl.prepend(div);
    // Keep log manageable
    while (logEl.children.length > 80) logEl.removeChild(logEl.lastChild);
}

// ---- Units ----

let nextUnitId = 1;

function createUnit(type, q, r) {
    const stats = UNIT_STATS[type];
    const unit = {
        id: nextUnitId++,
        type,
        faction: stats.faction,
        name: stats.name,
        attack: stats.attack,
        defense: stats.defense,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        speed: stats.speed,
        symbol: stats.symbol,
        q, r,
        moved: false
    };
    state.units.push(unit);
    return unit;
}

function unitAt(q, r, faction) {
    return state.units.find(u => u.q === q && u.r === r && (!faction || u.faction === faction));
}

function removeUnit(unit) {
    state.units = state.units.filter(u => u.id !== unit.id);
}

function playerUnits() {
    return state.units.filter(u => u.faction === 'player');
}

function enemyUnits() {
    return state.units.filter(u => u.faction === 'enemy');
}

// ---- Map Setup ----

function initMap() {
    state.hexes = generateTerrain(MAP_RADIUS);
    const accessibleKeys = populateTerrain(state.hexes, MAP_RADIUS, 10, 4);

    // Clear area around Seal Spire: 2-hex radius becomes plains (1/3 with forest)
    for (const [key, hex] of state.hexes) {
        if (hexDistance(hex.q, hex.r, 0, 0) <= 2) {
            hex.terrain = Math.random() < 1/3 ? TERRAIN.FOREST : TERRAIN.PLAINS;
            hex.elevation = Math.min(hex.elevation, 0.4);
            hex.dangerPoint = null;
        }
    }

    // Convert danger points into Void Rifts
    let riftCount = 0;
    for (const [key, hex] of state.hexes) {
        if (hex.dangerPoint) {
            hex.isRift = true;
            hex.dangerPoint = null;
            riftCount++;
        }
    }
    state.riftsRemaining = riftCount;
    state.riftsInitial = riftCount;
    updateRiftCount();

    // Place player units at fixed positions around the Seal Spire
    // Phase Monk in the tower, others adjacent
    createUnit(UNIT_TYPE.PHASE_MONK,    0,  0);
    createUnit(UNIT_TYPE.HEXBLADE,      1,  0);
    createUnit(UNIT_TYPE.GLITCH_MAGE,   0,  1);
    createUnit(UNIT_TYPE.SPORE_MARINE, -1,  1);

    // Spawn initial enemies near rifts
    for (const [key, hex] of state.hexes) {
        if (hex.isRift) {
            spawnEnemyNear(hex.q, hex.r);
        }
    }

    // Center camera on Seal Spire
    const startPx = hexToPixel(0, 0);
    state.camera.x = startPx.x;
    state.camera.y = startPx.y;
}

function spawnEnemyNear(q, r) {
    const neighbors = hexNeighbors(q, r);
    Rando.shuffle(neighbors);
    for (const n of neighbors) {
        const hex = state.hexes.get(hexKey(n.q, n.r));
        if (hex && hex.terrain !== TERRAIN.WATER && hex.terrain !== TERRAIN.MOUNTAIN && !unitAt(n.q, n.r)) {
            const type = Rando.weighted(ENEMY_SPAWN_WEIGHTS);
            createUnit(type, n.q, n.r);
            return true;
        }
    }
    return false;
}

// ---- Movement Cost ----

// Void hexes cost 2x the original terrain's movement cost
function movementCostFor(hex) {
    if (hex.terrain === TERRAIN.VOID) {
        const base = TERRAIN_MOVEMENT[hex.originalTerrain] ?? 1;
        return base === Infinity ? 2 : base * 2;
    }
    return TERRAIN_MOVEMENT[hex.terrain] ?? Infinity;
}

// BFS wrapper using void-aware movement costs
function reachableHexes(startHex, speed) {
    const costs = bfsHexes(startHex, state.hexes, movementCostFor, speed);
    costs.delete(hexKey(startHex.q, startHex.r));
    return costs;
}

// ---- Selection & Movement ----

function selectUnit(unit) {
    state.selectedUnit = unit;
    state.reachableKeys = new Set();
    state.attackableKeys = new Set();

    if (unit && !unit.moved && unit.faction === 'player') {
        // Get reachable hexes using BFS
        const costs = reachableHexes({ q: unit.q, r: unit.r }, unit.speed);

        for (const [key] of costs) {
            const { q, r } = parseHexKey(key);
            const occupant = unitAt(q, r);
            if (occupant && occupant.faction === 'enemy') {
                state.attackableKeys.add(key);
            } else if (!occupant) {
                state.reachableKeys.add(key);
            }
        }

        // Always allow 1-step to any adjacent hex (even mountains/water)
        for (const n of hexNeighbors(unit.q, unit.r)) {
            const key = hexKey(n.q, n.r);
            if (!state.hexes.has(key)) continue;
            const occupant = unitAt(n.q, n.r);
            if (occupant && occupant.faction === 'enemy') {
                state.attackableKeys.add(key);
            } else if (!occupant) {
                state.reachableKeys.add(key);
            }
        }
    }

    showUnitInfo(unit);
    render();
}

function deselectUnit() {
    state.selectedUnit = null;
    state.reachableKeys = null;
    state.attackableKeys = null;
    unitInfoEl.classList.add('hidden');
    render();
}

function moveUnit(unit, q, r) {
    unit.q = q;
    unit.r = r;
    unit.moved = true;
    log(`${unit.name} moves.`, 'info');
}

function attackUnit(attacker, defender) {
    const terrainDef = TERRAIN_DEFENSE[state.hexes.get(hexKey(defender.q, defender.r))?.terrain] || 0;
    const damage = Math.max(1, attacker.attack - defender.defense - terrainDef);
    defender.hp -= damage;

    log(`${attacker.name} strikes ${defender.name} for ${damage} damage!`, 'combat');

    if (defender.hp <= 0) {
        log(`${defender.name} is destroyed!`, 'death');
        const dq = defender.q, dr = defender.r;
        removeUnit(defender);
        // Attacker moves onto the hex (Glitch Mage stays put)
        if (attacker.type !== UNIT_TYPE.GLITCH_MAGE) {
            attacker.q = dq;
            attacker.r = dr;
        }

        // Check if this was a rift hex — seal it (only if attacker moved onto it)
        if (attacker.type !== UNIT_TYPE.GLITCH_MAGE) {
            const hex = state.hexes.get(hexKey(dq, dr));
            if (hex && hex.isRift) {
                sealRift(hex);
            }
        }
    }

    attacker.moved = true;
}

function sealRift(hex) {
    hex.isRift = false;
    state.riftsRemaining--;
    log(`A Void Rift has been sealed!`, 'seal');
    updateRiftCount();

    if (state.riftsRemaining <= 0) {
        endGame(true);
    }
}

// ---- Enemy AI ----

function enemyTurn() {
    state.phase = 'enemy';
    phaseInfoEl.textContent = 'Enemy Phase';
    phaseInfoEl.classList.add('enemy-phase');
    endTurnBtn.disabled = true;

    const enemies = enemyUnits();
    const players = playerUnits();

    if (players.length === 0) return;

    for (const enemy of enemies) {
        // Find nearest player unit
        let nearest = null;
        let nearestDist = Infinity;
        for (const pu of players) {
            const d = hexDistance(enemy.q, enemy.r, pu.q, pu.r);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = pu;
            }
        }

        if (!nearest) continue;

        // If adjacent, attack
        if (nearestDist <= 1) {
            const terrainDef = TERRAIN_DEFENSE[state.hexes.get(hexKey(nearest.q, nearest.r))?.terrain] || 0;
            const damage = Math.max(1, enemy.attack - nearest.defense - terrainDef);
            nearest.hp -= damage;
            log(`${enemy.name} attacks ${nearest.name} for ${damage}!`, 'combat');

            if (nearest.hp <= 0) {
                log(`${nearest.name} has fallen!`, 'death');
                removeUnit(nearest);
            }
            continue;
        }

        // Move toward nearest player
        const reachable = reachableHexes({ q: enemy.q, r: enemy.r }, enemy.speed);

        // Also allow 1-step to any adjacent hex
        for (const n of hexNeighbors(enemy.q, enemy.r)) {
            const k = hexKey(n.q, n.r);
            if (state.hexes.has(k)) reachable.set(k, 1);
        }

        let bestKey = null;
        let bestDist = Infinity;
        for (const [key] of reachable) {
            const { q, r } = parseHexKey(key);
            if (unitAt(q, r)) continue;
            const d = hexDistance(q, r, nearest.q, nearest.r);
            if (d < bestDist) {
                bestDist = d;
                bestKey = key;
            }
        }

        if (bestKey) {
            const { q, r } = parseHexKey(bestKey);
            enemy.q = q;
            enemy.r = r;
        }
    }

    // Check player loss
    if (playerUnits().length === 0) {
        endGame(false);
        return;
    }

    render();
}

// ---- Void / Unraveling Phase ----

function voidPhase() {
    state.phase = 'void';

    // Spread void from existing void hexes (terrain-dependent spread rate)
    const newVoid = [];
    for (const key of state.voidHexes) {
        const hex = state.hexes.get(key);
        if (!hex) continue;
        for (const n of hexNeighbors(hex.q, hex.r)) {
            const nKey = hexKey(n.q, n.r);
            if (state.voidHexes.has(nKey)) continue;
            const nHex = state.hexes.get(nKey);
            if (!nHex) continue;
            if (nHex.terrain === TERRAIN.WATER) continue;
            const chance = VOID_SPREAD_CHANCE[nHex.terrain] || 0.33;
            if (Math.random() < chance) {
                newVoid.push(nKey);
            }
        }
    }

    for (const key of newVoid) {
        const hex = state.hexes.get(key);
        if (hex) {
            hex.originalTerrain = hex.terrain;
            hex.terrain = TERRAIN.VOID;
            state.voidHexes.add(key);
        }
    }

    if (newVoid.length > 0) {
        log(`The Unraveling spreads... (${newVoid.length} hexes consumed)`, 'void');
    }

    // Rifts spawn enemies
    for (const [key, hex] of state.hexes) {
        if (!hex.isRift) continue;

        // Make rift hex void if not already
        if (!state.voidHexes.has(key)) {
            hex.originalTerrain = hex.terrain;
            hex.terrain = TERRAIN.VOID;
            state.voidHexes.add(key);
        }

        // Spawn chance scales from 10% (no rifts sealed) to 30% (most rifts sealed)
        const sealed = state.riftsInitial - state.riftsRemaining;
        const ratio = state.riftsInitial > 1 ? sealed / (state.riftsInitial - 1) : 0;
        const spawnChance = 0.10 + ratio * 0.20;
        if (Math.random() < spawnChance) {
            if (spawnEnemyNear(hex.q, hex.r)) {
                log(`A Void Rift disgorges a creature!`, 'void');
            }
        }
    }

    // Damage units on void hexes
    for (const unit of [...state.units]) {
        const key = hexKey(unit.q, unit.r);
        const onVoid = state.voidHexes.has(key);
        // Player units take damage on void (except Glitch Mage); enemies take damage OFF void
        const takeDamage = unit.faction === 'player'
            ? (onVoid && unit.type !== UNIT_TYPE.GLITCH_MAGE)
            : !onVoid;
        if (takeDamage) {
            unit.hp -= VOID_DAMAGE_PER_TURN;
            const reason = unit.faction === 'player' ? 'void damage' : 'reality damage';
            log(`${unit.name} takes ${VOID_DAMAGE_PER_TURN} ${reason}!`, 'void');
            if (unit.hp <= 0) {
                log(`${unit.name} is consumed by the Void!`, 'death');
                removeUnit(unit);
            }
        }
    }

    // Check center hex consumed
    const centerKey = hexKey(0, 0);
    if (state.voidHexes.has(centerKey)) {
        log(`The heart of the world has been consumed!`, 'death');
        endGame(false);
        return;
    }

    if (playerUnits().length === 0) {
        endGame(false);
    }
}

// ---- Turn Flow ----

function startPlayerTurn() {
    state.turn++;
    turnNumEl.textContent = state.turn;
    state.phase = 'player';
    phaseInfoEl.textContent = 'Your Move';
    phaseInfoEl.classList.remove('enemy-phase');
    endTurnBtn.disabled = false;

    // 10% chance to spawn a random player unit on the tower (if unoccupied)
    if (Math.random() < 0.10 && !unitAt(0, 0)) {
        const playerTypes = [UNIT_TYPE.HEXBLADE, UNIT_TYPE.GLITCH_MAGE, UNIT_TYPE.SPORE_MARINE, UNIT_TYPE.PHASE_MONK];
        const type = playerTypes[Math.floor(Math.random() * playerTypes.length)];
        createUnit(type, 0, 0);
        log(`A ${UNIT_STATS[type].name} materializes at the Seal Spire!`, 'info');
    }

    // Heal and reset player units
    for (const u of state.units) {
        if (u.faction === 'player' && u.hp < u.maxHp) {
            const hex = state.hexes.get(hexKey(u.q, u.r));
            let heal = 0;

            // 1. Passive regen: +1 on any non-Void terrain
            if (hex && hex.terrain !== TERRAIN.VOID) {
                heal += 1;
            }

            // 2. Healing terrain bonus: +1 on forest/gold
            if (hex && HEALING_TERRAIN.has(hex.terrain)) {
                heal += 1;
            }

            // 3. Rest bonus: +1 if didn't move last turn
            if (!u.moved) {
                heal += 1;
            }

            // 4. Seal Spire proximity: +1 if within 2 hexes of center tower
            if (hexDistance(u.q, u.r, 0, 0) <= 2) {
                heal += 1;
            }

            if (heal > 0) {
                const before = u.hp;
                u.hp = Math.min(u.maxHp, u.hp + heal);
                if (u.hp > before) {
                    log(`${u.name} heals ${u.hp - before} HP.`, 'info');
                }
            }
        }
        u.moved = false;
    }

    // 4. Spore Marine aura: heal self and adjacent player units +1
    for (const u of state.units) {
        if (u.type !== UNIT_TYPE.SPORE_MARINE || u.faction !== 'player') continue;
        // Self-heal
        if (u.hp < u.maxHp) {
            u.hp = Math.min(u.maxHp, u.hp + 1);
            log(`${u.name}'s spores regenerate 1 HP.`, 'info');
        }
        // Aura for adjacent allies
        for (const n of hexNeighbors(u.q, u.r)) {
            const ally = unitAt(n.q, n.r, 'player');
            if (ally && ally.hp < ally.maxHp && ally.id !== u.id) {
                ally.hp = Math.min(ally.maxHp, ally.hp + 1);
                log(`${u.name}'s spores heal ${ally.name} for 1 HP.`, 'info');
            }
        }
    }

    log(`Turn ${state.turn} begins.`, 'info');
    deselectUnit();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function endPlayerTurn() {
    if (state.phase !== 'player' || state.gameOver) return;
    // Immediately mark as non-player phase to block re-entry
    state.phase = 'processing';
    deselectUnit();
    endTurnBtn.disabled = true;

    try {
        // Enemy phase
        enemyTurn();
        render();

        if (state.gameOver) return;

        await delay(400);

        // Void phase
        voidPhase();
        render();

        if (state.gameOver) return;

        await delay(400);

        // Next player turn
        startPlayerTurn();
        render();
    } catch (e) {
        console.error('Turn processing error:', e);
        log(`ERROR: ${e.message} — recovering`, 'death');
        // Recover: run startPlayerTurn so healing and moved-reset still happen
        startPlayerTurn();
        render();
    }
}

function endGame(won) {
    state.gameOver = true;
    endTurnBtn.disabled = true;
    render();

    setTimeout(() => {
        if (won) {
            showOverlay(
                'REALITY HOLDS',
                `All Void Rifts sealed in ${state.turn} turns. The membrane between dimensions is restored — for now. The Warband of the Last Coherence has saved what remains of the world.`,
                'Again'
            );
        } else {
            showOverlay(
                'UNRAVELED',
                `The world dissolves into nothing. Reality folds in on itself like wet paper. Somewhere, in the spaces between spaces, something that was once a dimension sighs and is still.`,
                'Try Again'
            );
        }
    }, 600);
}

// ---- UI ----

const UNIT_SPECIALS = {
    [UNIT_TYPE.HEXBLADE]:      'Advances onto enemy hex after a kill',
    [UNIT_TYPE.GLITCH_MAGE]:   'Immune to void damage. Does not advance on kill',
    [UNIT_TYPE.SPORE_MARINE]:  'Heals self and adjacent allies +1 HP per turn',
    [UNIT_TYPE.PHASE_MONK]:    'Fastest unit — can cross voided terrain quickly',
    [UNIT_TYPE.VOID_THRALL]:   'Takes damage outside the void',
    [UNIT_TYPE.REALITY_EATER]: 'Takes damage outside the void. High attack',
    [UNIT_TYPE.HOLLOW_KNIGHT]: 'Takes damage outside the void. Tough and slow',
};

const unitSpecialEl = document.getElementById('unit-special');

function showUnitInfo(unit) {
    if (!unit) {
        unitInfoEl.classList.add('hidden');
        return;
    }
    unitInfoEl.classList.remove('hidden');
    const stats = UNIT_STATS[unit.type];
    unitNameEl.textContent = `${unit.symbol} ${unit.name}`;
    unitNameEl.style.color = unit.faction === 'player' ? PLAYER_COLOR : ENEMY_COLOR;
    unitDescEl.textContent = stats.desc;
    unitSpecialEl.textContent = UNIT_SPECIALS[unit.type] || '';

    const hpRatio = unit.hp / unit.maxHp;
    const hpClass = hpRatio <= 0.3 ? 'hp-low' : hpRatio >= 1 ? 'hp-full' : '';

    unitStatsEl.innerHTML = `<span class="stat-label">HP</span> <span class="stat-value ${hpClass}">${unit.hp}/${unit.maxHp}</span> <span class="stat-label">ATK</span> <span class="stat-value">${unit.attack}</span> <span class="stat-label">DEF</span> <span class="stat-value">${unit.defense}</span> <span class="stat-label">SPD</span> <span class="stat-value">${unit.speed}</span>`;
}

function updateRiftCount() {
    riftCountEl.textContent = `Rifts remaining: ${state.riftsRemaining}`;
}

function showOverlay(title, text, btnText) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayBtn.textContent = btnText;
    overlayEl.classList.remove('hidden');
}

// ---- Rendering ----

function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}

function worldToScreen(wx, wy) {
    return {
        x: wx - state.camera.x + canvas.width / 2,
        y: wy - state.camera.y + canvas.height / 2
    };
}

function screenToWorld(sx, sy) {
    return {
        x: sx + state.camera.x - canvas.width / 2,
        y: sy + state.camera.y - canvas.height / 2
    };
}

function render() {
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#08080e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!state.hexes) return;

    // Draw hexes
    for (const [key, hex] of state.hexes) {
        const { x: wx, y: wy } = hexToPixel(hex.q, hex.r);
        const { x: sx, y: sy } = worldToScreen(wx, wy);

        // Skip off-screen hexes
        if (sx < -HEX_SIZE * 2 || sx > canvas.width + HEX_SIZE * 2 ||
            sy < -HEX_SIZE * 2 || sy > canvas.height + HEX_SIZE * 2) continue;

        // Base terrain color
        let color = TERRAIN_COLORS[hex.terrain] || '#333';


        // Draw hex
        drawHexPath(ctx, sx, sy, HEX_SIZE);
        ctx.fillStyle = color;
        ctx.fill();

        // Void shimmer
        if (hex.terrain === TERRAIN.VOID) {
            drawHexPath(ctx, sx, sy, HEX_SIZE);
            const shimmer = 0.15 + 0.1 * Math.sin(Date.now() / 500 + hex.q * 3 + hex.r * 7);
            ctx.fillStyle = `rgba(120, 40, 180, ${shimmer})`;
            ctx.fill();
        }

        // Rift marker
        if (hex.isRift) {
            drawHexPath(ctx, sx, sy, HEX_SIZE);
            const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 300 + hex.q + hex.r);
            ctx.fillStyle = `rgba(180, 40, 220, ${pulse})`;
            ctx.fill();
            ctx.strokeStyle = '#c050ff';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Rift symbol
            ctx.fillStyle = '#e080ff';
            ctx.font = `bold ${HEX_SIZE * 0.8}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⟁', sx, sy);
        }

        // Hex border
        drawHexPath(ctx, sx, sy, HEX_SIZE);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    // Draw center tower (Seal Spire)
    {
        const centerHex = state.hexes.get(hexKey(0, 0));
        if (centerHex) {
            const { x: wx, y: wy } = hexToPixel(0, 0);
            const { x: sx, y: sy } = worldToScreen(wx, wy);
            const s = HEX_SIZE;

            // Glowing base ring
            const basePulse = 0.4 + 0.2 * Math.sin(Date.now() / 800);
            ctx.beginPath();
            ctx.arc(sx, sy, s * 0.7, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${basePulse})`;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Tower body (narrow trapezoid)
            const tw = s * 0.12;  // top half-width
            const bw = s * 0.25;  // bottom half-width
            const th = s * 0.9;   // tower height
            ctx.beginPath();
            ctx.moveTo(sx - bw, sy + th * 0.35);
            ctx.lineTo(sx - tw, sy - th * 0.5);
            ctx.lineTo(sx + tw, sy - th * 0.5);
            ctx.lineTo(sx + bw, sy + th * 0.35);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Tower cap (triangle)
            ctx.beginPath();
            ctx.moveTo(sx, sy - th * 0.85);
            ctx.lineTo(sx - tw * 1.4, sy - th * 0.5);
            ctx.lineTo(sx + tw * 1.4, sy - th * 0.5);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.stroke();

            // Beacon glow at top
            const glow = 0.5 + 0.3 * Math.sin(Date.now() / 400);
            const grad = ctx.createRadialGradient(sx, sy - th * 0.85, 0, sx, sy - th * 0.85, s * 0.4);
            grad.addColorStop(0, `rgba(255, 255, 255, ${glow})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.beginPath();
            ctx.arc(sx, sy - th * 0.85, s * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }
    }

    // Draw highlights
    if (state.reachableKeys) {
        for (const key of state.reachableKeys) {
            const { q, r } = parseHexKey(key);
            const { x: wx, y: wy } = hexToPixel(q, r);
            const { x: sx, y: sy } = worldToScreen(wx, wy);
            drawHexPath(ctx, sx, sy, HEX_SIZE);
            ctx.fillStyle = HIGHLIGHT_MOVE;
            ctx.fill();
        }
    }
    if (state.attackableKeys) {
        for (const key of state.attackableKeys) {
            const { q, r } = parseHexKey(key);
            const { x: wx, y: wy } = hexToPixel(q, r);
            const { x: sx, y: sy } = worldToScreen(wx, wy);
            drawHexPath(ctx, sx, sy, HEX_SIZE);
            ctx.fillStyle = HIGHLIGHT_ATTACK;
            ctx.fill();
        }
    }

    // Selected hex highlight
    if (state.selectedUnit) {
        const su = state.selectedUnit;
        const { x: wx, y: wy } = hexToPixel(su.q, su.r);
        const { x: sx, y: sy } = worldToScreen(wx, wy);
        drawHexPath(ctx, sx, sy, HEX_SIZE);
        ctx.fillStyle = HIGHLIGHT_SELECTED;
        ctx.fill();
        ctx.strokeStyle = '#60c0ff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Draw units
    for (const unit of state.units) {
        const { x: wx, y: wy } = hexToPixel(unit.q, unit.r);
        const { x: sx, y: sy } = worldToScreen(wx, wy);

        if (sx < -HEX_SIZE * 2 || sx > canvas.width + HEX_SIZE * 2 ||
            sy < -HEX_SIZE * 2 || sy > canvas.height + HEX_SIZE * 2) continue;

        const isPlayer = unit.faction === 'player';
        const baseColor = isPlayer ? PLAYER_COLOR : ENEMY_COLOR;
        const radius = HEX_SIZE * 0.55;

        // Unit circle
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isPlayer ? 'rgba(20, 60, 120, 0.9)' : 'rgba(100, 20, 20, 0.9)';
        ctx.fill();
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = unit.moved ? 1 : 2;
        if (unit.moved) ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Symbol
        ctx.fillStyle = unit.moved ? '#808090' : baseColor;
        ctx.font = `bold ${HEX_SIZE * 0.7}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.symbol, sx, sy);

        // HP bar
        const barW = radius * 1.6;
        const barH = 3;
        const barX = sx - barW / 2;
        const barY = sy + radius + 3;
        const hpRatio = unit.hp / unit.maxHp;
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = hpRatio > 0.5 ? '#40c060' : hpRatio > 0.25 ? '#c0a020' : '#ff3030';
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }
}

// ---- Input ----

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };
let hasDragged = false;

canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    isDragging = true;
    hasDragged = false;
    dragStart = { x: e.clientX, y: e.clientY };
    cameraStart = { ...state.camera };
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true;
    state.camera.x = cameraStart.x - dx;
    state.camera.y = cameraStart.y - dy;
    render();
});

window.addEventListener('mouseup', (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    const wasDragging = isDragging;
    isDragging = false;
    if (!wasDragging || hasDragged) return;

    // Only left-click triggers game actions
    if (e.button !== 0) return;
    if (state.phase !== 'player' || state.gameOver) return;

    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return;
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    const { q, r } = pixelToHex(wx, wy);
    const key = hexKey(q, r);

    handleClick(q, r, key);
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function handleClick(q, r, key) {
    const clickedUnit = unitAt(q, r);

    if (state.selectedUnit) {
        // Clicking on an attackable hex
        if (state.attackableKeys && state.attackableKeys.has(key)) {
            const target = unitAt(q, r, 'enemy');
            if (target) {
                attackUnit(state.selectedUnit, target);
                deselectUnit();
                render();

                if (playerUnits().length === 0) endGame(false);
                return;
            }
        }

        // Clicking on a reachable hex
        if (state.reachableKeys && state.reachableKeys.has(key)) {
            moveUnit(state.selectedUnit, q, r);

            // Check if moved onto rift hex
            const hex = state.hexes.get(key);
            if (hex && hex.isRift && !unitAt(q, r, 'enemy')) {
                sealRift(hex);
            }

            deselectUnit();
            render();
            return;
        }

        // Clicking on the already-selected unit — deselect
        if (clickedUnit && clickedUnit.id === state.selectedUnit.id) {
            deselectUnit();
            return;
        }

        // Clicking on own unmoved unit — switch selection
        if (clickedUnit && clickedUnit.faction === 'player' && !clickedUnit.moved) {
            selectUnit(clickedUnit);
            return;
        }

        // Clicking on any unit — show info but deselect movement
        if (clickedUnit) {
            deselectUnit();
            showUnitInfo(clickedUnit);
            unitInfoEl.classList.remove('hidden');
            return;
        }

        // Click elsewhere — deselect
        deselectUnit();
        return;
    }

    // Nothing selected
    if (clickedUnit) {
        if (clickedUnit.faction === 'player' && !clickedUnit.moved) {
            selectUnit(clickedUnit);
        } else {
            showUnitInfo(clickedUnit);
            unitInfoEl.classList.remove('hidden');
        }
    }
}

endTurnBtn.addEventListener('click', endPlayerTurn);

// Prevent spacebar from also activating the focused button
endTurnBtn.addEventListener('keydown', (e) => {
    if (e.key === ' ') e.preventDefault();
});

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') deselectUnit();
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        endPlayerTurn();
    }
});

// ---- Intro & Start ----

function startGame() {
    state.units = [];
    state.voidHexes = new Set();
    state.turn = 1;
    state.gameOver = false;
    state.phase = 'player';
    state.selectedUnit = null;
    state.reachableKeys = null;
    state.attackableKeys = null;
    nextUnitId = 1;
    turnNumEl.textContent = '1';
    phaseInfoEl.textContent = 'Your Move';
    phaseInfoEl.classList.remove('enemy-phase');
    endTurnBtn.disabled = false;
    logEl.innerHTML = '';

    initMap();
    log('The Membrane ruptures. Reality bleeds.', 'void');
    log('Seal all Void Rifts to save the world.', 'info');
    render();
}

overlayBtn.addEventListener('click', () => {
    overlayEl.classList.add('hidden');
    startGame();
});

// Show intro
showOverlay(
    'VOID SEAL',
    `The Membrane between dimensions has ruptured. Through the tears pour the Hollowed — beings of anti-reality that unmake everything they touch. Ancient sorcerers and rogue technologists have formed an uneasy alliance: the Warband of the Last Coherence. Seal the Void Rifts before the world unravels.`,
    'Begin'
);

// Animate void shimmer
function animLoop() {
    if (state.voidHexes.size > 0 || state.hexes) {
        render();
    }
    requestAnimationFrame(animLoop);
}

window.addEventListener('resize', render);
resizeCanvas();
requestAnimationFrame(animLoop);
