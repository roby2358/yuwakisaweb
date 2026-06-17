// index.js — Embergrade
// Solo wildfire-fighting tactics game.

import {
    HEX_SIZE, TERRAIN, MOVEMENT_COST, FLAMMABILITY,
    PLAYER_MP, FIREFIGHTER_COUNT, VILLAGE_COUNT,
    DIG_COST, DOUSE_COST, SURVIVE_TURNS, INITIAL_FIRES,
    MAP_COLS, MAP_ROWS
} from './config.js';
import { hexToPixel, pixelToHex, hexKey, hexNeighbors, bfsHexes, drawHexPath } from './hex.js';
import { Rando } from './rando.js';
import { ColorTheory } from './colortheory.js';

// ---- Display constants ----
const COUNTER_SIZE = 26;
const FIRE_COLORS = ['#ffd24a', '#ff8a1f', '#e23a14', '#8a1408']; // by intensity (low→high)
const ASH_COLOR = '#2a2222';
const FIREBREAK_COLOR = '#5a4332';
const VILLAGE_RING = '#ffe9b0';
const FIREFIGHTER_COLOR = '#1ea7e8';
const SELECT_COLOR = '#ffffff';

// Fresh per-game terrain palette (filled by initGame)
let TERRAIN_COLORS = {};

// ---- Game state ----
let hexes = null;
let firefighters = [];   // [{q,r,id}]
let villages = [];       // [{q,r,alive}]
let fires = new Map();   // hexKey -> { intensity: 1..3, fuel: int }
let selectedId = null;
let actionMode = 'move'; // 'move' | 'dig' | 'douse'
let reachable = null;
let turn = 1;
let mp = PLAYER_MP;
let gameOver = null;     // null | 'win' | 'lose'
let losingHex = null;

// ---- View ----
let panX = 0, panY = 0;
let panning = false;
let panStartX = 0, panStartY = 0;
let panOrigX = 0, panOrigY = 0;

// ---- Canvas ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
};
window.addEventListener('resize', resize);

// ---- Coord helpers ----
const hexToScreen = (q, r) => {
    const p = hexToPixel(q, r);
    return { x: p.x + panX, y: p.y + panY };
};
const screenToHex = (sx, sy) => pixelToHex(sx - panX, sy - panY);

// ---- Heightmap ----
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

// ---- Map gen ----
function generateRectGrid() {
    const map = new Map();
    const hm = diamondSquare(65, 0.55);
    const cx = (MAP_COLS - 1) / 2;
    const cy = (MAP_ROWS - 1) / 2;
    const maxD = Math.min(cx, cy);

    for (let row = 0; row < MAP_ROWS; row++) {
        const qOffset = -Math.floor(row / 2);
        for (let col = 0; col < MAP_COLS; col++) {
            const q = col + qOffset;
            const r = row;
            const gx = Math.round(col / (MAP_COLS - 1) * 64);
            const gy = Math.round(row / (MAP_ROWS - 1) * 64);
            // Island falloff: squash elevation toward 0 near edges to make a coast
            const dx = (col - cx) / maxD;
            const dy = (row - cy) / maxD;
            const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
            const falloff = Math.max(0, 1 - d * d * 1.15);
            const elevation = hm[gy * 65 + gx] * falloff;
            map.set(hexKey(q, r), { q, r, col, row, elevation, terrain: null });
        }
    }
    return map;
}

function assignTerrain() {
    const inner = [];
    for (const [, hex] of hexes) inner.push(hex);
    inner.sort((a, b) => a.elevation - b.elevation);
    const n = inner.length;

    for (let i = 0; i < n; i++) {
        const pct = i / n;
        if (pct < 0.30) inner[i].terrain = TERRAIN.WATER;
        else if (pct < 0.78) inner[i].terrain = TERRAIN.PLAINS;
        else if (pct < 0.93) inner[i].terrain = TERRAIN.HILLS;
        else inner[i].terrain = TERRAIN.MOUNTAIN;
    }

    // Sprinkle forests on plains (lots — they're the fuel)
    const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS);
    Rando.shuffle(plains);
    const forestCount = Math.round(plains.length * 0.45);
    for (let i = 0; i < forestCount; i++) plains[i].terrain = TERRAIN.FOREST;
}

function landHexes() {
    const out = [];
    for (const [, h] of hexes) {
        if (h.terrain === TERRAIN.WATER || h.terrain === TERRAIN.MOUNTAIN) continue;
        out.push(h);
    }
    return out;
}

function placeVillagesAndCrew() {
    villages = [];
    firefighters = [];

    const land = landHexes();
    Rando.shuffle(land);

    // Villages: spaced apart, on plains preferred
    const placed = [];
    const minDist = 5;
    for (const h of land) {
        if (placed.length >= VILLAGE_COUNT) break;
        if (h.terrain === TERRAIN.FOREST) continue; // prefer open ground
        if (placed.some(p => Math.hypot(p.col - h.col, p.row - h.row) < minDist)) continue;
        h.terrain = TERRAIN.VILLAGE;
        villages.push({ q: h.q, r: h.r, alive: true });
        placed.push(h);
    }

    // Firefighters: cluster near map center
    const cx = (MAP_COLS - 1) / 2, cy = (MAP_ROWS - 1) / 2;
    const central = land
        .filter(h => h.terrain !== TERRAIN.VILLAGE)
        .sort((a, b) => Math.hypot(a.col - cx, a.row - cy) - Math.hypot(b.col - cx, b.row - cy));
    const used = new Set();
    let id = 0;
    for (const h of central) {
        if (firefighters.length >= FIREFIGHTER_COUNT) break;
        const k = hexKey(h.q, h.r);
        if (used.has(k)) continue;
        used.add(k);
        firefighters.push({ q: h.q, r: h.r, id: id++ });
    }
}

function igniteInitial() {
    fires = new Map();
    // Pick burnable hexes near the edge of the landmass
    const burnable = landHexes().filter(h => FLAMMABILITY[h.terrain] > 0 && h.terrain !== TERRAIN.VILLAGE);
    burnable.sort((a, b) => {
        const ad = Math.min(a.col, MAP_COLS - 1 - a.col, a.row, MAP_ROWS - 1 - a.row);
        const bd = Math.min(b.col, MAP_COLS - 1 - b.col, b.row, MAP_ROWS - 1 - b.row);
        return ad - bd;
    });
    const edgeBurnable = burnable.slice(0, Math.max(20, Math.floor(burnable.length * 0.25)));
    Rando.shuffle(edgeBurnable);
    for (let i = 0; i < INITIAL_FIRES && i < edgeBurnable.length; i++) {
        const h = edgeBurnable[i];
        fires.set(hexKey(h.q, h.r), { intensity: 2, fuel: fuelFor(h.terrain) });
    }
}

function fuelFor(terrain) {
    if (terrain === TERRAIN.FOREST) return 4;
    if (terrain === TERRAIN.PLAINS) return 2;
    if (terrain === TERRAIN.VILLAGE) return 3;
    if (terrain === TERRAIN.HILLS) return 2;
    return 1;
}

// ---- Color theme (per game) ----
function pickPalette() {
    const scheme = ColorTheory.randomScheme(() => Math.random());
    const sorted = ColorTheory.sortPaletteByLuminance(scheme);
    const toHex = ([r, g, b]) => ColorTheory.rgbToHex(r, g, b);
    // Map by luminance role: darkest → water, then plains, forest, hills, mountain
    TERRAIN_COLORS = {
        [TERRAIN.WATER]: toHex(sorted[0]),
        [TERRAIN.FOREST]: toHex(sorted[1]),
        [TERRAIN.PLAINS]: toHex(sorted[2]),
        [TERRAIN.HILLS]: toHex(sorted[3]),
        [TERRAIN.MOUNTAIN]: toHex(sorted[4]),
        [TERRAIN.FIREBREAK]: FIREBREAK_COLOR,
        [TERRAIN.ASH]: ASH_COLOR,
        [TERRAIN.VILLAGE]: toHex(sorted[2]) // village base = plains tint, drawn with ring
    };
}

// ---- Game lifecycle ----
function initGame() {
    pickPalette();
    let attempts = 0;
    while (attempts++ < 20) {
        hexes = generateRectGrid();
        assignTerrain();
        if (landHexes().length > 80) break;
    }
    placeVillagesAndCrew();
    igniteInitial();
    turn = 1;
    mp = PLAYER_MP;
    selectedId = null;
    reachable = null;
    actionMode = 'move';
    gameOver = null;
    losingHex = null;
    centerOnFirefighters();
    updateModeButtons();
    resize();
}

function centerOnFirefighters() {
    if (firefighters.length === 0) return;
    let sx = 0, sy = 0;
    for (const f of firefighters) {
        const p = hexToPixel(f.q, f.r);
        sx += p.x; sy += p.y;
    }
    sx /= firefighters.length; sy /= firefighters.length;
    panX = canvas.width / 2 - sx;
    panY = canvas.height / 2 - sy;
}

// ---- Selection / actions ----
const selectedFighter = () => selectedId === null ? null : firefighters.find(f => f.id === selectedId);

function selectFighter(id) {
    selectedId = id;
    computeReachable();
}

function deselect() {
    selectedId = null;
    reachable = null;
}

function computeReachable() {
    const f = selectedFighter();
    if (!f || mp <= 0 || actionMode !== 'move') { reachable = null; return; }
    const occupied = new Set(firefighters.filter(o => o.id !== f.id).map(o => hexKey(o.q, o.r)));
    reachable = bfsHexes(f, hexes, hex => {
        if (occupied.has(hexKey(hex.q, hex.r))) return Infinity;
        if (fires.has(hexKey(hex.q, hex.r))) return Infinity; // can't walk into flames
        return MOVEMENT_COST[hex.terrain] ?? Infinity;
    }, mp);
    reachable.delete(hexKey(f.q, f.r));
}

function tryMove(q, r) {
    const f = selectedFighter();
    if (!f || !reachable) return;
    const k = hexKey(q, r);
    const cost = reachable.get(k);
    if (cost === undefined) return;
    f.q = q; f.r = r;
    mp -= cost;
    computeReachable();
}

function tryDig() {
    const f = selectedFighter();
    if (!f) return;
    if (mp < DIG_COST) return;
    const hex = hexes.get(hexKey(f.q, f.r));
    if (!hex) return;
    if (hex.terrain === TERRAIN.VILLAGE) return; // don't bulldoze villages
    if (hex.terrain === TERRAIN.WATER || hex.terrain === TERRAIN.MOUNTAIN) return;
    hex.terrain = TERRAIN.FIREBREAK;
    mp -= DIG_COST;
    setMode('move');
}

function tryDouse() {
    const f = selectedFighter();
    if (!f) return;
    if (mp < DOUSE_COST) return;
    const targets = [{ q: f.q, r: f.r }, ...hexNeighbors(f.q, f.r)];
    let any = false;
    for (const t of targets) {
        const k = hexKey(t.q, t.r);
        if (fires.has(k)) { fires.delete(k); any = true; }
    }
    if (!any) return;
    mp -= DOUSE_COST;
    setMode('move');
}

function setMode(mode) {
    actionMode = mode;
    updateModeButtons();
    computeReachable();
    render();
}

function updateModeButtons() {
    for (const m of ['move', 'dig', 'douse']) {
        const btn = document.getElementById('mode-' + m);
        if (btn) btn.classList.toggle('active', actionMode === m);
    }
}

// ---- Turn / fire spread ----
function endTurn() {
    if (gameOver) return;
    deselect();
    spreadFire();
    if (gameOver) { render(); return; }
    turn++;
    if (turn > SURVIVE_TURNS) gameOver = 'win';
    mp = PLAYER_MP;
    render();
}

function spreadFire() {
    // 1) compute new ignitions (snapshot first)
    const newFires = [];
    for (const [key, fire] of fires) {
        const [q, r] = key.split(',').map(Number);
        for (const n of hexNeighbors(q, r)) {
            const nk = hexKey(n.q, n.r);
            if (fires.has(nk)) continue;
            const nh = hexes.get(nk);
            if (!nh) continue;
            const flam = FLAMMABILITY[nh.terrain] || 0;
            if (flam <= 0) continue;
            // Higher intensity fires spread more aggressively
            const chance = flam * (0.4 + 0.25 * fire.intensity);
            if (Math.random() < chance) {
                newFires.push({ key: nk, terrain: nh.terrain });
            }
        }
    }

    // 2) apply ignitions (deduped)
    const seen = new Set();
    for (const f of newFires) {
        if (seen.has(f.key)) continue;
        seen.add(f.key);
        if (fires.has(f.key)) continue;
        fires.set(f.key, { intensity: 1, fuel: fuelFor(f.terrain) });
    }

    // 3) burn down existing fires; ramp intensity early, exhaust fuel late
    const extinguished = [];
    for (const [key, fire] of fires) {
        fire.fuel -= 1;
        if (fire.intensity < 3 && Math.random() < 0.55) fire.intensity++;
        if (fire.fuel <= 0) extinguished.push(key);
    }
    for (const key of extinguished) {
        fires.delete(key);
        const hex = hexes.get(key);
        if (!hex) continue;
        if (hex.terrain === TERRAIN.VILLAGE) {
            // village destroyed during burn-down — same lose condition
            losingHex = { q: hex.q, r: hex.r };
            const v = villages.find(v => v.q === hex.q && v.r === hex.r);
            if (v) v.alive = false;
            hex.terrain = TERRAIN.ASH;
            gameOver = 'lose';
            return;
        }
        hex.terrain = TERRAIN.ASH;
    }

    // 4) immediate village loss check (if a village just caught fire it counts as lost)
    for (const v of villages) {
        if (!v.alive) continue;
        if (fires.has(hexKey(v.q, v.r))) {
            v.alive = false;
            losingHex = { q: v.q, r: v.r };
            gameOver = 'lose';
            return;
        }
    }
}

// ---- Rendering ----
function render() {
    ctx.fillStyle = '#0a0a0a';
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

        // Firebreak: draw cross-hatch
        if (hex.terrain === TERRAIN.FIREBREAK) {
            ctx.strokeStyle = '#2a1a10';
            ctx.lineWidth = 1.5;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(x - HEX_SIZE * 0.6, y + i * 6);
                ctx.lineTo(x + HEX_SIZE * 0.6, y + i * 6);
                ctx.stroke();
            }
        }

        // Mountain marker
        if (hex.terrain === TERRAIN.MOUNTAIN) {
            ctx.fillStyle = '#000000aa';
            ctx.beginPath();
            ctx.moveTo(x - 8, y + 6);
            ctx.lineTo(x, y - 8);
            ctx.lineTo(x + 8, y + 6);
            ctx.closePath();
            ctx.fill();
        }

        // Forest marker
        if (hex.terrain === TERRAIN.FOREST) {
            ctx.fillStyle = '#00000055';
            ctx.beginPath();
            ctx.arc(x - 5, y + 2, 3, 0, Math.PI * 2);
            ctx.arc(x + 5, y + 2, 3, 0, Math.PI * 2);
            ctx.arc(x, y - 5, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Fires
    for (const [key, fire] of fires) {
        const [q, r] = key.split(',').map(Number);
        const { x, y } = hexToScreen(q, r);
        const i = Math.min(FIRE_COLORS.length - 1, fire.intensity);
        // glow
        ctx.fillStyle = FIRE_COLORS[i] + 'cc';
        drawHexPath(ctx, x, y, HEX_SIZE * 0.85);
        ctx.fill();
        // inner flame
        ctx.fillStyle = FIRE_COLORS[Math.max(0, i - 2)];
        ctx.beginPath();
        ctx.arc(x, y, HEX_SIZE * 0.32, 0, Math.PI * 2);
        ctx.fill();
        // little flame tongue
        ctx.fillStyle = '#fff5b0';
        ctx.beginPath();
        ctx.arc(x - 2, y - 2, HEX_SIZE * 0.12, 0, Math.PI * 2);
        ctx.fill();
    }

    // Villages
    for (const v of villages) {
        const { x, y } = hexToScreen(v.q, v.r);
        ctx.strokeStyle = v.alive ? VILLAGE_RING : '#552020';
        ctx.lineWidth = 3;
        drawHexPath(ctx, x, y, HEX_SIZE * 0.85);
        ctx.stroke();
        ctx.fillStyle = v.alive ? '#fff' : '#552020';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(v.alive ? '\u2302' : 'x', x, y);
    }

    // Reachable highlights
    if (reachable) {
        for (const [key] of reachable) {
            const [q, r] = key.split(',').map(Number);
            const { x, y } = hexToScreen(q, r);
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = 'rgba(255, 240, 80, 0.28)';
            ctx.fill();
        }
    }

    // Action-mode preview at selected fighter
    const sel = selectedFighter();
    if (sel && (actionMode === 'dig' || actionMode === 'douse')) {
        if (actionMode === 'douse') {
            // highlight affected hexes
            const targets = [{ q: sel.q, r: sel.r }, ...hexNeighbors(sel.q, sel.r)];
            for (const t of targets) {
                const { x, y } = hexToScreen(t.q, t.r);
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = 'rgba(80, 180, 255, 0.30)';
                ctx.fill();
            }
        } else {
            const { x, y } = hexToScreen(sel.q, sel.r);
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = 'rgba(160, 100, 50, 0.45)';
            ctx.fill();
        }
    }

    // Firefighters
    for (const f of firefighters) {
        const { x, y } = hexToScreen(f.q, f.r);
        drawCounter(x, y, FIREFIGHTER_COLOR, 'F' + (f.id + 1));
        if (f.id === selectedId) {
            const s = COUNTER_SIZE + 6;
            roundRect(ctx, x - s / 2, y - s / 2, s, s, 6);
            ctx.strokeStyle = SELECT_COLOR;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    // Game over overlay
    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = gameOver === 'win' ? '#9fe87a' : '#ff7a4a';
        ctx.font = 'bold 52px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gameOver === 'win' ? 'THE FIRES CALM' : 'A VILLAGE IS LOST',
            canvas.width / 2, canvas.height / 2 - 30);
        ctx.fillStyle = '#eee';
        ctx.font = '18px monospace';
        const aliveCount = villages.filter(v => v.alive).length;
        ctx.fillText(
            gameOver === 'win'
                ? aliveCount + ' / ' + villages.length + ' villages survived'
                : 'Survived ' + (turn - 1) + ' / ' + SURVIVE_TURNS + ' days',
            canvas.width / 2, canvas.height / 2 + 14);
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

    // Shadow
    ctx.strokeStyle = '#000000aa';
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x + r + i, y + s + 1 + i);
        ctx.arcTo(x + s + 1 + i, y + s + 1 + i, x + s + 1 + i, y + s - r + 1 + i, r);
        ctx.lineTo(x + s + 1 + i, y + r + i);
        ctx.stroke();
    }

    roundRect(ctx, x, y, s, s, r);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = labelColor;
    ctx.font = 'bold ' + Math.floor(s * 0.46) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
}

function updateHUD() {
    document.getElementById('turn-info').textContent = 'Day ' + Math.min(turn, SURVIVE_TURNS) + ' / ' + SURVIVE_TURNS;
    document.getElementById('mp-info').textContent = 'MP: ' + mp;
    const alive = villages.filter(v => v.alive).length;
    document.getElementById('village-info').textContent = 'Villages: ' + alive + '/' + villages.length;
    document.getElementById('fire-info').textContent = 'Fires: ' + fires.size;
}

// ---- Input ----
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

    if (e.button !== 0 || gameOver) return;
    const hex = screenToHex(e.clientX, e.clientY);

    // Click on a firefighter selects (or deselects) it
    const clickedFighter = firefighters.find(f => f.q === hex.q && f.r === hex.r);
    if (clickedFighter) {
        if (selectedId === clickedFighter.id) {
            // Re-click selected fighter triggers current action mode
            if (actionMode === 'dig') tryDig();
            else if (actionMode === 'douse') tryDouse();
            else deselect();
        } else {
            selectFighter(clickedFighter.id);
        }
        render();
        return;
    }

    // Click reachable hex → move
    if (selectedId !== null && actionMode === 'move' && reachable && reachable.has(hexKey(hex.q, hex.r))) {
        tryMove(hex.q, hex.r);
        render();
        return;
    }

    // Click empty space → deselect
    deselect();
    render();
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
document.getElementById('mode-move').addEventListener('click', () => setMode('move'));
document.getElementById('mode-dig').addEventListener('click', () => setMode('dig'));
document.getElementById('mode-douse').addEventListener('click', () => setMode('douse'));

window.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); endTurn(); }
    else if (e.key === '1') setMode('move');
    else if (e.key === '2') setMode('dig');
    else if (e.key === '3') setMode('douse');
    else if (e.key === 'd' || e.key === 'D') { tryDig(); render(); }
    else if (e.key === 'f' || e.key === 'F') { tryDouse(); render(); }
});

document.getElementById('new-game').addEventListener('click', () => {
    initGame();
    document.getElementById('intro-panel').classList.remove('hidden');
});

const introPanel = document.getElementById('intro-panel');
document.getElementById('begin-btn').addEventListener('click', () => {
    introPanel.classList.add('hidden');
});

// ---- Start ----
initGame();
