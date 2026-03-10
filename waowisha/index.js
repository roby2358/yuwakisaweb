// index.js — Hex & Counters game

import { HEX_SIZE, TERRAIN, MOVEMENT_COST, PLAYER_MP, MAP_COLS, MAP_ROWS } from './config.js';
import { hexToPixel, pixelToHex, hexKey, hexNeighbors, bfsHexes, drawHexPath } from './hex.js';
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
};
const PLAYER_COLOR = '#daa520';
const TARGET_COLOR = '#ff6600';
let enemyColors = [];

// ---- Game state ----
let hexes = null;
let player = null;
let target = null;
let enemies = [];
let selected = false;
let reachable = null;
let turn = 1;
let mp = PLAYER_MP;
let gameWon = false;

// ---- View state ----
let panX = 0, panY = 0;
let panning = false;
let panStartX = 0, panStartY = 0;
let panOrigX = 0, panOrigY = 0;

// ---- Canvas ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
}
window.addEventListener('resize', resize);

// ---- Coordinate helpers ----
function hexToScreen(q, r) {
    const p = hexToPixel(q, r);
    return { x: p.x + panX, y: p.y + panY };
}

function screenToHex(sx, sy) {
    return pixelToHex(sx - panX, sy - panY);
}

// ---- Heightmap generation (diamond-square) ----
function diamondSquare(size, roughness) {
    const grid = new Float64Array(size * size);
    const get = (x, y) => grid[y * size + x];
    const set = (x, y, v) => { grid[y * size + x] = v; };

    set(0, 0, Math.random());
    set(size - 1, 0, Math.random());
    set(0, size - 1, Math.random());
    set(size - 1, size - 1, Math.random());

    let step = size - 1;
    let scale = roughness;
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
        step = half;
        scale *= roughness;
    }

    let min = Infinity, max = -Infinity;
    for (let i = 0; i < grid.length; i++) { min = Math.min(min, grid[i]); max = Math.max(max, grid[i]); }
    for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / (max - min) * 100;
    return grid;
}

// ---- Map generation ----
function generateRectGrid() {
    const hexes = new Map();
    const hm = diamondSquare(129, 0.55);

    for (let row = 0; row < MAP_ROWS; row++) {
        const qOffset = -Math.floor(row / 2);
        for (let col = 0; col < MAP_COLS; col++) {
            const q = col + qOffset;
            const r = row;
            const gx = Math.round(col / (MAP_COLS - 1) * 128);
            const gy = Math.round(row / (MAP_ROWS - 1) * 128);
            const elevation = hm[gy * 129 + gx];
            const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;

            hexes.set(hexKey(q, r), {
                q, r, col, row, elevation, isEdge,
                terrain: null, resource: null,
                units: [], controlled: false
            });
        }
    }
    return hexes;
}

function assignTerrain() {
    const inner = [];
    for (const [, hex] of hexes) {
        if (hex.isEdge) { hex.terrain = TERRAIN.WATER; continue; }
        inner.push(hex);
    }
    inner.sort((a, b) => a.elevation - b.elevation);
    const n = inner.length;

    // Base terrain by elevation percentile
    for (let i = 0; i < n; i++) {
        const pct = i / n;
        if (pct < 0.25) inner[i].terrain = TERRAIN.WATER;
        else if (pct < 0.85) inner[i].terrain = TERRAIN.PLAINS;
        else if (pct < 0.95) inner[i].terrain = TERRAIN.HILLS;
        else inner[i].terrain = TERRAIN.MOUNTAIN;
    }

    // Scatter forests among plains (~10% of total)
    const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS);
    Rando.shuffle(plains);
    const forestCount = Math.round(n * 0.10);
    const goldCount = Math.max(3, Math.round(n * 0.01));
    let idx = 0;
    for (let i = 0; i < forestCount && idx < plains.length; i++, idx++)
        plains[idx].terrain = TERRAIN.FOREST;
    for (let i = 0; i < goldCount && idx < plains.length; i++, idx++)
        plains[idx].terrain = TERRAIN.GOLD;

    // Scatter quarries among hills (~2% of total)
    const hills = inner.filter(h => h.terrain === TERRAIN.HILLS);
    Rando.shuffle(hills);
    const quarryCount = Math.max(2, Math.round(n * 0.02));
    for (let i = 0; i < quarryCount && i < hills.length; i++)
        hills[i].terrain = TERRAIN.QUARRY;
}

function placePlayerAndTarget() {
    const passable = [];
    for (const [, hex] of hexes) {
        if (hex.isEdge) continue;
        if (hex.terrain === TERRAIN.WATER || hex.terrain === TERRAIN.MOUNTAIN) continue;
        passable.push(hex);
    }
    // Sort by column position for true left/right
    passable.sort((a, b) => a.col - b.col);

    const leftSlice = passable.slice(0, Math.max(5, Math.floor(passable.length * 0.03)));
    const ph = Rando.choice(leftSlice);
    player = { q: ph.q, r: ph.r };

    const rightSlice = passable.slice(-Math.max(5, Math.floor(passable.length * 0.03)));
    const th = Rando.choice(rightSlice);
    target = { q: th.q, r: th.r };
}

function initGame() {
    let attempts = 0;
    do {
        hexes = generateRectGrid();
        assignTerrain();
        placePlayerAndTarget();
        attempts++;
    } while (!hasPath(player, target) && attempts < 20);

    spawnEnemies();
    turn = 1;
    mp = PLAYER_MP;
    selected = false;
    reachable = null;
    gameWon = false;
    centerOn(player);
    resize();
}

function hasPath(from, to) {
    if (!from || !to) return false;
    const costs = bfsHexes(from, hexes, hex => {
        const c = MOVEMENT_COST[hex.terrain];
        return c === undefined ? Infinity : c;
    }, Infinity);
    return costs.has(hexKey(to.q, to.r));
}

function spawnEnemies() {
    const count = Rando.int(1, 6) + Rando.int(1, 6);
    enemies = [];
    const occupied = new Set([hexKey(player.q, player.r), hexKey(target.q, target.r)]);
    const candidates = [];
    for (const [key, hex] of hexes) {
        if (hex.isEdge) continue;
        if (hex.terrain === TERRAIN.WATER || hex.terrain === TERRAIN.MOUNTAIN) continue;
        if (occupied.has(key)) continue;
        candidates.push(hex);
    }
    Rando.shuffle(candidates);
    for (let i = 0; i < count && i < candidates.length; i++) {
        const h = candidates[i];
        enemies.push({ q: h.q, r: h.r });
        occupied.add(hexKey(h.q, h.r));
    }

    // Generate unique colors for each enemy using ColorTheory
    enemyColors = [];
    const scheme = ColorTheory.randomScheme(() => Math.random());
    for (let i = 0; i < enemies.length; i++) {
        const [r, g, b] = scheme[i % scheme.length];
        enemyColors.push(ColorTheory.rgbToHex(r, g, b));
    }
}

function centerOn(hex) {
    const p = hexToPixel(hex.q, hex.r);
    panX = canvas.width / 2 - p.x;
    panY = canvas.height / 2 - p.y;
}

// ---- Game logic ----
function selectPlayer() {
    selected = true;
    computeReachable();
}

function deselectPlayer() {
    selected = false;
    reachable = null;
}

function computeReachable() {
    if (mp <= 0) { reachable = new Map(); return; }
    const enemyKeys = new Set(enemies.map(e => hexKey(e.q, e.r)));
    reachable = bfsHexes(player, hexes, hex => {
        if (enemyKeys.has(hexKey(hex.q, hex.r))) return Infinity;
        return MOVEMENT_COST[hex.terrain] ?? Infinity;
    }, mp);
    reachable.delete(hexKey(player.q, player.r));
}

function movePlayer(q, r) {
    const key = hexKey(q, r);
    const cost = reachable.get(key);
    if (cost === undefined) return;

    player.q = q;
    player.r = r;
    mp -= cost;

    if (q === target.q && r === target.r) {
        gameWon = true;
        deselectPlayer();
        render();
        return;
    }

    if (mp > 0) {
        computeReachable();
    } else {
        deselectPlayer();
    }
    render();
}

function endTurn() {
    if (gameWon) return;
    deselectPlayer();
    moveEnemies();
    turn++;
    mp = PLAYER_MP;
    render();
}

function moveEnemies() {
    const occupied = new Set([hexKey(player.q, player.r)]);
    for (const e of enemies) occupied.add(hexKey(e.q, e.r));

    for (const enemy of enemies) {
        const neighbors = hexNeighbors(enemy.q, enemy.r);
        const valid = neighbors.filter(n => {
            const key = hexKey(n.q, n.r);
            const hex = hexes.get(key);
            if (!hex) return false;
            if (hex.terrain === TERRAIN.WATER || hex.terrain === TERRAIN.MOUNTAIN) return false;
            if (occupied.has(key)) return false;
            return true;
        });
        if (valid.length > 0) {
            occupied.delete(hexKey(enemy.q, enemy.r));
            const dest = Rando.choice(valid);
            enemy.q = dest.q;
            enemy.r = dest.r;
            occupied.add(hexKey(enemy.q, enemy.r));
        }
    }
}

// ---- Rendering ----
function render() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Terrain
    for (const [, hex] of hexes) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 ||
            y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
        ctx.fill();
        ctx.strokeStyle = '#00000044';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Target marker
    if (target && !gameWon) {
        const { x, y } = hexToScreen(target.q, target.r);
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.strokeStyle = TARGET_COLOR;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = TARGET_COLOR;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u2605', x, y);
    }

    // Reachable highlights
    if (reachable) {
        for (const [key] of reachable) {
            const [q, r] = key.split(',').map(Number);
            const { x, y } = hexToScreen(q, r);
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fill();
        }
    }

    // Enemies
    for (let i = 0; i < enemies.length; i++) {
        const { x, y } = hexToScreen(enemies[i].q, enemies[i].r);
        drawCounter(x, y, enemyColors[i] || '#cc3333', 'E');
    }

    // Player
    if (player) {
        const { x, y } = hexToScreen(player.q, player.r);
        drawCounter(x, y, PLAYER_COLOR, 'P');
        if (selected) {
            const s = COUNTER_SIZE + 4;
            roundRect(ctx, x - s / 2, y - s / 2, s, s, 6);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    // Victory overlay
    if (gameWon) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('VICTORY!', canvas.width / 2, canvas.height / 2 - 30);
        ctx.font = '20px monospace';
        ctx.fillText('Reached target in ' + turn + ' turns', canvas.width / 2, canvas.height / 2 + 20);
    }

    updateHUD();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function contrastText(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.4 ? '#000' : '#fff';
}

function drawCounter(cx, cy, color, label) {
    const labelColor = contrastText(color);
    const s = COUNTER_SIZE;
    const x = cx - s / 2, y = cy - s / 2;
    const r = 4;

    // Depth shadow: 2 gray L-shaped lines on bottom-right
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x + r + i, y + s + 1 + i);
        ctx.arcTo(x + s + 1 + i, y + s + 1 + i, x + s + 1 + i, y + s - r + 1 + i, r);
        ctx.lineTo(x + s + 1 + i, y + r + i);
        ctx.stroke();
    }

    // Body
    roundRect(ctx, x, y, s, s, r);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label — pick white or black text for contrast
    ctx.fillStyle = labelColor;
    ctx.font = 'bold ' + Math.floor(s * 0.55) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
}

function updateHUD() {
    document.getElementById('turn-info').textContent = 'Turn ' + turn;
    document.getElementById('mp-info').textContent = 'MP: ' + mp + '/' + PLAYER_MP;
}

// ---- Input handling ----
canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
        panning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panOrigX = panX;
        panOrigY = panY;
        e.preventDefault();
        return;
    }

    if (e.button === 0 && !gameWon) {
        const hex = screenToHex(e.clientX, e.clientY);
        const key = hexKey(hex.q, hex.r);

        if (selected) {
            if (hex.q === player.q && hex.r === player.r) {
                deselectPlayer();
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
    }
});

canvas.addEventListener('mousemove', e => {
    if (panning) {
        panX = panOrigX + (e.clientX - panStartX);
        panY = panOrigY + (e.clientY - panStartY);
        render();
    }
});

canvas.addEventListener('mouseup', e => {
    if (e.button === 2) panning = false;
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('end-turn').addEventListener('click', endTurn);
window.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); endTurn(); }
});
document.getElementById('new-game').addEventListener('click', initGame);

// ---- Start ----
initGame();
