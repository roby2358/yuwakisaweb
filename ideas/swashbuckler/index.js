// index.js — Solar Corsair
// A sci-fi swashbuckler. Loot derelict hulks, dodge Imperial freighters,
// outrun the Dreadnought, and escape through the wormhole.

import {
    HEX_SIZE, TERRAIN, MOVEMENT_COST, PLAYER_MP, MAP_COLS, MAP_ROWS,
    START_HP, LOOT_GOAL, REPAIR_COST, FREIGHTER_COUNT_DICE
} from './config.js';
import { hexToPixel, pixelToHex, hexKey, hexNeighbors, hexDistance, bfsHexes, drawHexPath } from './hex.js';
import { Rando } from './rando.js';
import { ColorTheory } from './colortheory.js';

// ---- Display constants ----
const COUNTER_SIZE = 28;
const PLAYER_COLOR = '#ffd166';
const WORMHOLE_COLOR = '#b266ff';
const DREAD_COLOR = '#ff2a55';

// Terrain palette is regenerated each game from a ColorTheory scheme
let terrainColors = {};

// ---- Game state ----
let hexes = null;
let player = null;
let wormhole = null;
let freighters = [];
let dreadnoughts = [];
let derelicts = new Set();   // hexKey -> not yet looted
let stations = new Set();    // hexKey
let selected = false;
let reachable = null;
let turn = 1;
let mp = PLAYER_MP;
let hp = START_HP;
let doubloons = 0;
let loot = 0;
let gameWon = false;
let gameLost = false;
let message = '';

// ---- View state ----
let panX = 0, panY = 0;
let panning = false;
let panStartX = 0, panStartY = 0;
let panOrigX = 0, panOrigY = 0;

// ---- Canvas ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; render(); };
window.addEventListener('resize', resize);

// ---- Coordinate helpers ----
const hexToScreen = (q, r) => {
    const p = hexToPixel(q, r);
    return { x: p.x + panX, y: p.y + panY };
};
const screenToHex = (sx, sy) => pixelToHex(sx - panX, sy - panY);

// ---- Color scheme generation ----
function buildPalette() {
    // Pick a random color scheme to flavor the sector. Star fields, nebulae,
    // and asteroid clouds change hue every run.
    const scheme = ColorTheory.randomScheme(Math.random);
    const sorted = ColorTheory.sortPaletteByLuminance(scheme.slice());
    const hex = (rgb) => ColorTheory.rgbToHex(rgb[0], rgb[1], rgb[2]);

    // Pick three slots from the sorted scheme for nebula / open / asteroids
    const nebulaRGB = sorted[Math.min(1, sorted.length - 1)];
    const openRGB = sorted[Math.floor(sorted.length / 2)];
    const asteroidRGB = sorted[sorted.length - 1];

    terrainColors = {
        [TERRAIN.WATER]: '#05060f',     // void rift — near-black
        [TERRAIN.PLAINS]: hex(openRGB), // open space (tinted by sector)
        [TERRAIN.HILLS]: hex(asteroidRGB), // asteroid field
        [TERRAIN.MOUNTAIN]: '#fff6c2',  // star — bright
        [TERRAIN.FOREST]: hex(nebulaRGB), // nebula (cover)
        [TERRAIN.GOLD]: '#d4a017',      // derelict (always gold)
        [TERRAIN.QUARRY]: '#7ad6ff',    // trade station (always cyan)
    };
}

// ---- Heightmap (diamond-square) ----
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
    const out = new Map();
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

            out.set(hexKey(q, r), {
                q, r, col, row, elevation, isEdge,
                terrain: null
            });
        }
    }
    return out;
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
        if (pct < 0.18) inner[i].terrain = TERRAIN.WATER;        // void rifts
        else if (pct < 0.85) inner[i].terrain = TERRAIN.PLAINS;  // open space
        else if (pct < 0.95) inner[i].terrain = TERRAIN.HILLS;   // asteroid fields
        else inner[i].terrain = TERRAIN.MOUNTAIN;                // stars
    }

    // Scatter nebulae through open space
    const open = inner.filter(h => h.terrain === TERRAIN.PLAINS);
    Rando.shuffle(open);
    const nebulaCount = Math.round(n * 0.14);
    let idx = 0;
    for (let i = 0; i < nebulaCount && idx < open.length; i++, idx++)
        open[idx].terrain = TERRAIN.FOREST;

    // Derelict hulks: a handful, scattered through open space
    derelicts = new Set();
    const derelictCount = Math.max(LOOT_GOAL + 3, 6);
    for (let i = 0; i < derelictCount && idx < open.length; i++, idx++) {
        open[idx].terrain = TERRAIN.GOLD;
        derelicts.add(hexKey(open[idx].q, open[idx].r));
    }

    // Trade stations: rarer, in asteroid fields (the lawless edge of empire)
    stations = new Set();
    const fields = inner.filter(h => h.terrain === TERRAIN.HILLS);
    Rando.shuffle(fields);
    const stationCount = Math.max(2, Math.round(n * 0.012));
    for (let i = 0; i < stationCount && i < fields.length; i++) {
        fields[i].terrain = TERRAIN.QUARRY;
        stations.add(hexKey(fields[i].q, fields[i].r));
    }
}

function placePlayerAndWormhole() {
    const passable = [];
    for (const [, hex] of hexes) {
        if (hex.isEdge) continue;
        if (hex.terrain === TERRAIN.WATER || hex.terrain === TERRAIN.MOUNTAIN) continue;
        passable.push(hex);
    }
    passable.sort((a, b) => a.col - b.col);

    const leftSlice = passable.slice(0, Math.max(5, Math.floor(passable.length * 0.04)));
    const ph = Rando.choice(leftSlice);
    player = { q: ph.q, r: ph.r };

    const rightSlice = passable.slice(-Math.max(5, Math.floor(passable.length * 0.04)));
    const wh = Rando.choice(rightSlice);
    wormhole = { q: wh.q, r: wh.r };
    // Make sure the wormhole hex isn't itself a derelict/station (would be weird)
    const wkey = hexKey(wormhole.q, wormhole.r);
    derelicts.delete(wkey);
    stations.delete(wkey);
    const wHex = hexes.get(wkey);
    if (wHex.terrain === TERRAIN.GOLD || wHex.terrain === TERRAIN.QUARRY) wHex.terrain = TERRAIN.PLAINS;
}

function initGame() {
    let attempts = 0;
    do {
        buildPalette();
        hexes = generateRectGrid();
        assignTerrain();
        placePlayerAndWormhole();
        attempts++;
    } while (!hasPath(player, wormhole) && attempts < 20);

    spawnEnemies();
    turn = 1;
    mp = PLAYER_MP;
    hp = START_HP;
    doubloons = 0;
    loot = 0;
    selected = false;
    reachable = null;
    gameWon = false;
    gameLost = false;
    message = 'Hoist the colors. Loot ' + LOOT_GOAL + ' derelicts and reach the wormhole.';
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
    const count = Rando.int(1, FREIGHTER_COUNT_DICE[1]) + Rando.int(1, FREIGHTER_COUNT_DICE[1]);
    freighters = [];
    const occupied = new Set([hexKey(player.q, player.r), hexKey(wormhole.q, wormhole.r)]);
    const candidates = [];
    for (const [key, hex] of hexes) {
        if (hex.isEdge) continue;
        if (hex.terrain === TERRAIN.WATER || hex.terrain === TERRAIN.MOUNTAIN) continue;
        if (occupied.has(key)) continue;
        // keep freighters a few hexes away from the player at start
        if (hexDistance(player.q, player.r, hex.q, hex.r) < 4) continue;
        candidates.push(hex);
    }
    Rando.shuffle(candidates);
    for (let i = 0; i < count && i < candidates.length; i++) {
        const h = candidates[i];
        freighters.push({ q: h.q, r: h.r });
        occupied.add(hexKey(h.q, h.r));
    }

    // Place 3 Dreadnoughts far from the player, deep in open space.
    dreadnoughts = [];
    const dreadCandidates = [];
    for (const [key, hex] of hexes) {
        if (hex.isEdge) continue;
        if (hex.terrain !== TERRAIN.PLAINS) continue;
        if (occupied.has(key)) continue;
        if (hexDistance(player.q, player.r, hex.q, hex.r) < 12) continue;
        dreadCandidates.push(hex);
    }
    Rando.shuffle(dreadCandidates);
    for (let i = 0; i < 3 && i < dreadCandidates.length; i++) {
        const d = dreadCandidates[i];
        dreadnoughts.push({ q: d.q, r: d.r });
        occupied.add(hexKey(d.q, d.r));
    }
}

function centerOn(hex) {
    const p = hexToPixel(hex.q, hex.r);
    panX = canvas.width / 2 - p.x;
    panY = canvas.height / 2 - p.y;
}

// ---- Game logic ----
function selectPlayer() { selected = true; computeReachable(); }
function deselectPlayer() { selected = false; reachable = null; }

function enemyKeySet() {
    const s = new Set();
    for (const f of freighters) s.add(hexKey(f.q, f.r));
    for (const d of dreadnoughts) s.add(hexKey(d.q, d.r));
    return s;
}

function computeReachable() {
    if (mp <= 0) { reachable = new Map(); return; }
    // Freighters and the Dreadnought DO block pathing — but we still allow the
    // player to "step onto" an enemy from an adjacent hex by treating it as a
    // 1-cost destination (boarding action). Pathing through enemies is not
    // permitted.
    const enemies = enemyKeySet();
    reachable = bfsHexes(player, hexes, hex => {
        if (enemies.has(hexKey(hex.q, hex.r))) return Infinity;
        return MOVEMENT_COST[hex.terrain] ?? Infinity;
    }, mp);
    reachable.delete(hexKey(player.q, player.r));

    // Add adjacent enemy hexes as boardable targets (cost 1 if not already cheaper)
    for (const n of hexNeighbors(player.q, player.r)) {
        const k = hexKey(n.q, n.r);
        if (enemies.has(k) && mp >= 1 && !reachable.has(k)) reachable.set(k, 1);
    }
}

function isFreighterAt(q, r) { return freighters.findIndex(f => f.q === q && f.r === r); }
function dreadIdxAt(q, r) { return dreadnoughts.findIndex(d => d.q === q && d.r === r); }

function movePlayer(q, r) {
    const key = hexKey(q, r);
    const cost = reachable.get(key);
    if (cost === undefined) return;

    // Boarding action?
    const fIdx = isFreighterAt(q, r);
    if (fIdx >= 0) {
        hp -= 1;
        mp -= cost;
        if (Math.random() < 0.86) {
            freighters.splice(fIdx, 1);
            const haul = Rando.int(3, 7) + Rando.int(3, 7);
            doubloons += haul;
            message = 'Boarded an Imperial freighter! Hull -1, +' + haul + ' doubloons.';
        } else {
            message = 'Boarding repelled! Hull -1, the freighter limps clear.';
        }
        if (hp <= 0) { defeat('Your hull buckles under cutlass and plasma fire.'); return; }
        afterAction(); return;
    }
    const dIdx = dreadIdxAt(q, r);
    if (dIdx >= 0) {
        hp -= 1;
        mp -= cost;
        if (Math.random() < 0.33) {
            dreadnoughts.splice(dIdx, 1);
            doubloons += 20;
            const left = dreadnoughts.length;
            message = 'Bridge taken! +10 doubloons.' + (left ? ' (' + left + ' Dreadnought' + (left === 1 ? '' : 's') + ' still hunt' + (left === 1 ? 's' : '') + ' you.)' : '');
        } else {
            message = 'The Dreadnought\'s marines throw you back. Hull -1.';
        }
        if (hp <= 0) { defeat('You take a Dreadnought broadside and the void takes you.'); return; }
        afterAction(); return;
    }

    // Normal move
    player.q = q;
    player.r = r;
    mp -= cost;

    // Step on a derelict?
    if (derelicts.has(key)) {
        derelicts.delete(key);
        loot += 1;
        const haul = Rando.int(3, 5) + Rando.int(3, 5);
        doubloons += haul;
        message = 'Looted a derelict hulk! +' + haul + ' doubloons. (' + loot + '/' + LOOT_GOAL + ')';
    }
    // Trade station auto-repair
    else if (stations.has(key) && hp < START_HP && doubloons >= REPAIR_COST) {
        doubloons -= REPAIR_COST;
        hp += 1;
        message = 'Trade station hands patch your hull. -' + REPAIR_COST + ' doubloons, +1 hull.';
    }
    // Wormhole — only escapes if we've looted enough
    else if (q === wormhole.q && r === wormhole.r) {
        if (loot >= LOOT_GOAL) { victory(); return; }
        message = 'The wormhole crackles, but its gate refuses you. You need ' + (LOOT_GOAL - loot) + ' more derelict' + (LOOT_GOAL - loot === 1 ? '' : 's') + '.';
    }

    afterAction();
}

function afterAction() {
    if (mp > 0) { computeReachable(); render(); }
    else { endTurn(); }
}

function victory() { gameWon = true; deselectPlayer(); render(); }
function defeat(why) { gameLost = true; message = why; deselectPlayer(); render(); }

function endTurn() {
    if (gameWon || gameLost) return;
    deselectPlayer();
    // Standing on a trade station? Each end-turn counts as a docking tick.
    const here = hexKey(player.q, player.r);
    if (stations.has(here) && hp < START_HP && doubloons >= REPAIR_COST) {
        doubloons -= REPAIR_COST;
        hp += 1;
        message = 'Trade station hands patch your hull. -' + REPAIR_COST + ' doubloons, +1 hull.';
    }
    moveFreighters();
    if (gameLost) { render(); return; }
    moveDreadnoughts();
    if (gameLost) { render(); return; }
    turn++;
    mp = PLAYER_MP;
    render();
}

function passableForEnemy(hex) {
    if (!hex) return false;
    return hex.terrain !== TERRAIN.WATER && hex.terrain !== TERRAIN.MOUNTAIN;
}

function moveFreighters() {
    const occupied = new Set();
    for (const f of freighters) occupied.add(hexKey(f.q, f.r));
    for (const d of dreadnoughts) occupied.add(hexKey(d.q, d.r));

    for (const f of freighters) {
        const opts = hexNeighbors(f.q, f.r).filter(n => {
            const h = hexes.get(hexKey(n.q, n.r));
            if (!passableForEnemy(h)) return false;
            const k = hexKey(n.q, n.r);
            if (occupied.has(k)) return false;
            return true;
        });
        // Freighters may step onto the player's hex — that's an attack
        const playerKey = hexKey(player.q, player.r);
        const playerNeighbor = hexNeighbors(f.q, f.r).find(n => hexKey(n.q, n.r) === playerKey);
        if (playerNeighbor && Math.random() < 0.6) {
            hp -= 1;
            message = 'A freighter broadsides you! Hull -1.';
            if (hp <= 0) { defeat('Outgunned. Your ship breaks apart.'); return; }
            continue;
        }
        if (opts.length > 0) {
            occupied.delete(hexKey(f.q, f.r));
            const dest = Rando.choice(opts);
            f.q = dest.q; f.r = dest.r;
            occupied.add(hexKey(f.q, f.r));
        }
    }
}

function playerInNebula() {
    const h = hexes.get(hexKey(player.q, player.r));
    return h && h.terrain === TERRAIN.FOREST;
}

function moveDreadnoughts() {
    if (dreadnoughts.length === 0) return;

    const hidden = playerInNebula();
    // Shared occupancy so dreadnoughts don't pile onto the same hex.
    const occupied = new Set();
    for (const d of dreadnoughts) occupied.add(hexKey(d.q, d.r));
    for (const f of freighters) occupied.add(hexKey(f.q, f.r));

    // Distance field from the player (used when not hidden).
    const distances = hidden ? null : bfsHexes(player, hexes, h => {
        if (h.terrain === TERRAIN.WATER || h.terrain === TERRAIN.MOUNTAIN) return Infinity;
        return 1;
    }, 200);

    for (const d of dreadnoughts) {
        const here = hexKey(d.q, d.r);
        let destKey = null;

        if (hidden) {
            const opts = hexNeighbors(d.q, d.r).filter(n => {
                const h = hexes.get(hexKey(n.q, n.r));
                if (!passableForEnemy(h)) return false;
                return !occupied.has(hexKey(n.q, n.r));
            });
            if (opts.length > 0) {
                const pick = Rando.choice(opts);
                destKey = hexKey(pick.q, pick.r);
            }
        } else {
            let bestDist = distances.get(here) ?? Infinity;
            for (const n of hexNeighbors(d.q, d.r)) {
                const k = hexKey(n.q, n.r);
                const h = hexes.get(k);
                if (!passableForEnemy(h)) continue;
                if (occupied.has(k) && k !== hexKey(player.q, player.r)) continue;
                const dist = distances.get(k);
                if (dist === undefined) continue;
                if (dist < bestDist) { bestDist = dist; destKey = k; }
            }
        }

        if (destKey) {
            occupied.delete(here);
            const [q, r] = destKey.split(',').map(Number);
            d.q = q; d.r = r;
            occupied.add(destKey);
            if (d.q === player.q && d.r === player.r) {
                defeat('A Dreadnought\'s shadow falls over you. You are atomized.');
                return;
            }
        }
    }
}

// ---- Rendering ----
function render() {
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Starfield specks for flavor (hashed by hex)
    for (const [, hex] of hexes) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 ||
            y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = terrainColors[hex.terrain] || '#222';
        ctx.fill();
        ctx.strokeStyle = '#00000055';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Star sprite — small radial highlight
        if (hex.terrain === TERRAIN.MOUNTAIN) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        // Derelict marker
        if (hex.terrain === TERRAIN.GOLD && derelicts.has(hexKey(hex.q, hex.r))) {
            ctx.fillStyle = '#000';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', x, y + 1);
        }
        // Trade station marker
        if (hex.terrain === TERRAIN.QUARRY) {
            ctx.fillStyle = '#003344';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('T', x, y + 1);
        }
    }

    // Wormhole
    if (wormhole && !gameWon) {
        const { x, y } = hexToScreen(wormhole.q, wormhole.r);
        const open = loot >= LOOT_GOAL;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.strokeStyle = open ? WORMHOLE_COLOR : '#553377';
        ctx.lineWidth = open ? 3 : 2;
        ctx.stroke();
        ctx.fillStyle = open ? WORMHOLE_COLOR : '#996bbf';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u25C9', x, y);
    }

    // Reachable highlights
    if (reachable) {
        for (const [key] of reachable) {
            const [q, r] = key.split(',').map(Number);
            const { x, y } = hexToScreen(q, r);
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = 'rgba(255, 230, 120, 0.28)';
            ctx.fill();
        }
    }

    // Freighters
    for (const f of freighters) {
        const { x, y } = hexToScreen(f.q, f.r);
        drawCounter(x, y, '#cc3344', 'F');
    }

    // Dreadnoughts
    for (const d of dreadnoughts) {
        const { x, y } = hexToScreen(d.q, d.r);
        ctx.beginPath();
        ctx.arc(x, y, COUNTER_SIZE * 0.95, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 42, 85, 0.18)';
        ctx.fill();
        drawCounter(x, y, DREAD_COLOR, 'D');
    }

    // Player
    if (player) {
        const { x, y } = hexToScreen(player.q, player.r);
        if (playerInNebula()) {
            // hint that you're hidden
            ctx.beginPath();
            ctx.arc(x, y, COUNTER_SIZE * 0.85, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(180, 220, 255, 0.55)';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        drawCounter(x, y, PLAYER_COLOR, 'P');
        if (selected) {
            const s = COUNTER_SIZE + 4;
            roundRect(ctx, x - s / 2, y - s / 2, s, s, 6);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    // End-of-game overlays
    if (gameWon || gameLost) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = gameWon ? '#ffd166' : '#ff6677';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gameWon ? 'ESCAPED!' : 'CAPTAIN DOWN', canvas.width / 2, canvas.height / 2 - 30);
        ctx.fillStyle = '#eee';
        ctx.font = '18px monospace';
        if (gameWon) {
            ctx.fillText('Wormhole transit in ' + turn + ' turns — ' + doubloons + ' doubloons in the hold', canvas.width / 2, canvas.height / 2 + 16);
        } else {
            ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 16);
        }
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

    ctx.strokeStyle = '#000a';
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
    ctx.font = 'bold ' + Math.floor(s * 0.55) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
}

function updateHUD() {
    document.getElementById('turn-info').textContent = 'Turn ' + turn;
    document.getElementById('hp-info').textContent = 'Hull: ' + hp + '/' + START_HP;
    document.getElementById('dub-info').textContent = 'Doubloons: ' + doubloons;
    document.getElementById('loot-info').textContent = 'Loot: ' + loot + '/' + LOOT_GOAL;
    document.getElementById('mp-info').textContent = 'MP: ' + mp + '/' + PLAYER_MP;
    document.getElementById('msg-info').textContent = message;
}

// ---- Input handling ----
const onMouseDown = (e) => {
    if (e.button === 2) {
        panning = true;
        panStartX = e.clientX; panStartY = e.clientY;
        panOrigX = panX; panOrigY = panY;
        e.preventDefault();
        return;
    }
    if (e.button === 0 && !gameWon && !gameLost) {
        const hex = screenToHex(e.clientX, e.clientY);
        const key = hexKey(hex.q, hex.r);
        if (selected) {
            if (hex.q === player.q && hex.r === player.r) deselectPlayer();
            else if (reachable && reachable.has(key)) movePlayer(hex.q, hex.r);
            else deselectPlayer();
        } else if (hex.q === player.q && hex.r === player.r) {
            selectPlayer();
        }
        render();
    }
};
const onMouseMove = (e) => {
    if (panning) {
        panX = panOrigX + (e.clientX - panStartX);
        panY = panOrigY + (e.clientY - panStartY);
        render();
    }
};
const onMouseUp = (e) => { if (e.button === 2) panning = false; };

canvas.addEventListener('mousedown', onMouseDown);
canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mouseup', onMouseUp);
canvas.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('end-turn').addEventListener('click', endTurn);
window.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); endTurn(); }
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
