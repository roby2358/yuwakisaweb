// Weavers of Worlds: The Loom — Main game

import {
    HEX_SIZE, MAP_RADIUS, WORLDS_TO_WIN, FIRST_RIFT_TURN, RIFT_INTERVAL, MAX_RIFTS,
    TERRAIN, THREADS, THREAD_INFO, WEAVER_DEFS, RECIPES, PATTERN_TYPES,
} from './config.js';
import {
    hexToPixel, pixelToHex, hexKey, parseHexKey,
    hexNeighbors, hexDistance, hexesInRange, bfsHexes, drawHexPath,
} from './hex.js';
import { Rando } from './rando.js';
import { generateMap } from './terrain.js';

// ═══════════════════════════════════════
// Canvas & Camera
// ═══════════════════════════════════════
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W, H;
let camX = 0, camY = 0;
let panning = false, panStartX = 0, panStartY = 0, panOrigX = 0, panOrigY = 0;

function resize() {
    W = canvas.width = canvas.clientWidth;
    H = canvas.height = canvas.clientHeight;
    render();
}
window.addEventListener('resize', resize);

function hexToScreen(q, r) {
    const p = hexToPixel(q, r);
    return { x: p.x + W / 2 + camX, y: p.y + H / 2 + camY };
}
function screenToHex(sx, sy) {
    return pixelToHex(sx - W / 2 - camX, sy - H / 2 - camY);
}

// ═══════════════════════════════════════
// Game State
// ═══════════════════════════════════════
let S; // global state

function freshState() {
    return {
        hexes: null,
        weavers: [],
        threads: { light: 0, shadow: 0, star: 0, void: 0, dream: 0 },
        turn: 0,
        phase: 'start',    // dawn | move | weave | dusk | gameover
        selectedWeaver: -1,
        selectedRecipe: -1,
        reachable: null,
        worldsWoven: 0,
        rifts: [],
        worlds: [],
        log: [],
        gameOver: false,
        gameWon: false,
        discount: 0,
        resonanceHexes: new Set(),
        transmutePhase: null,  // null | 'from' | 'to'
        transmuteFrom: null,
        starSeeds: null, // pre-generated star positions for rendering
    };
}

// ═══════════════════════════════════════
// Initialization
// ═══════════════════════════════════════
function initGame() {
    S = freshState();
    S.hexes = generateMap();

    // Pre-generate star positions for starfield hexes
    S.starSeeds = new Map();
    for (const [key, hex] of S.hexes) {
        if (hex.terrain === 'starfield' || hex.terrain === 'nexus') {
            const stars = [];
            const count = Rando.int(1, 4);
            for (let i = 0; i < count; i++) {
                stars.push({
                    dx: Rando.float(-HEX_SIZE * 0.6, HEX_SIZE * 0.6),
                    dy: Rando.float(-HEX_SIZE * 0.5, HEX_SIZE * 0.5),
                    brightness: Rando.float(0.3, 0.8),
                });
            }
            S.starSeeds.set(key, stars);
        }
    }

    // Place weavers on hexes adjacent to nexus
    const neighbors = hexNeighbors(0, 0);
    S.weavers = WEAVER_DEFS.map((def, i) => ({
        ...def,
        id: i,
        q: neighbors[i].q,
        r: neighbors[i].r,
        currentMp: def.mp,
        abilityUsed: false,
    }));

    addLog('The Loom awaits. Weave ' + WORLDS_TO_WIN + ' Worlds.', 'turn');
    nextTurn();
}

// ═══════════════════════════════════════
// Logging
// ═══════════════════════════════════════
function addLog(msg, cls) {
    S.log.push({ msg, cls: cls || '' });
    if (S.log.length > 30) S.log.shift();
    updateLog();
}

function updateLog() {
    const el = document.getElementById('log');
    el.innerHTML = S.log.map(
        e => `<div class="log-entry log-${e.cls}">${e.msg}</div>`
    ).join('');
    el.scrollTop = el.scrollHeight;
}

// ═══════════════════════════════════════
// Turn Flow
// ═══════════════════════════════════════
function nextTurn() {
    S.turn++;
    S.selectedWeaver = -1;
    S.selectedRecipe = -1;
    S.reachable = null;
    S.transmutePhase = null;
    dawnPhase();
}

function dawnPhase() {
    S.phase = 'dawn';
    addLog('\u2500\u2500 Turn ' + S.turn + ' \u2500\u2500', 'turn');

    // Reset weavers
    for (const w of S.weavers) {
        w.currentMp = w.mp;
        w.abilityUsed = false;
    }

    // Gather threads
    const gathered = { light: 0, shadow: 0, star: 0, void: 0, dream: 0 };
    for (const w of S.weavers) {
        const hex = S.hexes.get(hexKey(w.q, w.r));
        if (!hex || hex.unraveled) continue;
        const terrain = TERRAIN[hex.terrain];
        if (terrain.thread) {
            if (terrain.thread === 'any') {
                const rarest = THREADS.reduce((a, b) => S.threads[a] <= S.threads[b] ? a : b);
                S.threads[rarest]++;
                gathered[rarest]++;
            } else {
                S.threads[terrain.thread]++;
                gathered[terrain.thread]++;
            }
        }
    }

    // Dreamer bonus
    const dreamer = S.weavers.find(w => w.type === 'dreamer');
    if (dreamer) {
        S.threads.dream++;
        gathered.dream++;
    }

    // Guardian cleanse
    const guardian = S.weavers.find(w => w.type === 'guardian');
    if (guardian) {
        for (const n of hexNeighbors(guardian.q, guardian.r)) {
            const hex = S.hexes.get(hexKey(n.q, n.r));
            if (hex && hex.unraveled && !hex.rift) {
                hex.unraveled = false;
                addLog('Guardian cleanses Unraveling', 'pattern');
                break;
            }
        }
    }

    // Resonance bonus
    if (S.resonanceHexes.size > 0) {
        let bonusTotal = 0;
        for (const key of S.resonanceHexes) {
            const hex = S.hexes.get(key);
            if (hex && !hex.unraveled) {
                const terrain = TERRAIN[hex.terrain];
                if (terrain.thread && terrain.thread !== 'any') {
                    S.threads[terrain.thread]++;
                    gathered[terrain.thread]++;
                    bonusTotal++;
                }
            }
        }
        if (bonusTotal > 0) addLog('Resonance yields +' + bonusTotal + ' threads!', 'weave');
        S.resonanceHexes.clear();
    }

    // Report
    const parts = THREADS.filter(t => gathered[t] > 0)
        .map(t => gathered[t] + ' ' + THREAD_INFO[t].name);
    if (parts.length > 0) addLog('Gathered: ' + parts.join(', '), 'gather');

    S.phase = 'move';
    updateAll();
}

function endMovePhase() {
    S.selectedWeaver = -1;
    S.reachable = null;
    S.transmutePhase = null;
    S.phase = 'weave';
    S.selectedRecipe = -1;
    addLog('Weaving phase begins.', '');
    updateAll();
}

function endWeavePhase() {
    S.selectedRecipe = -1;
    S.selectedWeaver = -1;
    S.phase = 'dusk';
    duskPhase();
}

function duskPhase() {
    // Spawn rifts
    if (S.turn >= FIRST_RIFT_TURN &&
        (S.turn === FIRST_RIFT_TURN || (S.turn - FIRST_RIFT_TURN) % RIFT_INTERVAL === 0)) {
        if (S.rifts.length < MAX_RIFTS) spawnRift();
    }

    // Spread unraveling
    for (const rift of S.rifts) {
        spreadUnraveling(rift);
    }

    // Check lose: nexus consumed
    const nexus = S.hexes.get(hexKey(0, 0));
    if (nexus && nexus.unraveled) {
        S.gameOver = true;
        S.phase = 'gameover';
        addLog('The Nexus is consumed. The Loom is lost.', 'danger');
        updateAll();
        return;
    }

    // Check win
    if (S.worldsWoven >= WORLDS_TO_WIN) {
        S.gameWon = true;
        S.gameOver = true;
        S.phase = 'gameover';
        addLog('The Tapestry is complete! Victory!', 'milestone');
        updateAll();
        return;
    }

    if (S.rifts.length > 0) addLog('The Unraveling stirs.', 'danger');
    nextTurn();
}

// ═══════════════════════════════════════
// Unraveling
// ═══════════════════════════════════════
function spawnRift() {
    const edgeCandidates = [];
    for (const [, hex] of S.hexes) {
        if (hexDistance(0, 0, hex.q, hex.r) === MAP_RADIUS && !hex.rift && !hex.world) {
            edgeCandidates.push(hex);
        }
    }
    if (edgeCandidates.length === 0) return;
    const hex = Rando.choice(edgeCandidates);
    hex.rift = true;
    hex.unraveled = true;
    S.rifts.push({ q: hex.q, r: hex.r });
    addLog('A Rift tears open!', 'danger');
}

function spreadUnraveling(rift) {
    // Find all connected unraveled hexes (BFS from rift)
    const frontier = new Set();
    const visited = new Set();
    const queue = [hexKey(rift.q, rift.r)];
    visited.add(queue[0]);

    while (queue.length > 0) {
        const key = queue.shift();
        const hex = S.hexes.get(key);
        if (!hex) continue;

        for (const n of hexNeighbors(hex.q, hex.r)) {
            const nk = hexKey(n.q, n.r);
            if (visited.has(nk)) continue;
            visited.add(nk);
            const nh = S.hexes.get(nk);
            if (!nh) continue;
            if (nh.unraveled) {
                queue.push(nk);
            } else if (!nh.world) {
                frontier.add(nk);
            }
        }
    }

    if (frontier.size === 0) return;

    // Oracle deflection
    const oracle = S.weavers.find(w => w.type === 'oracle' && !w.abilityUsed);
    const candidates = [...frontier];
    Rando.shuffle(candidates);

    for (const ck of candidates) {
        const ch = S.hexes.get(ck);
        if (oracle && !oracle.abilityUsed && hexDistance(oracle.q, oracle.r, ch.q, ch.r) <= 2) {
            oracle.abilityUsed = true;
            addLog('Oracle deflects the Unraveling!', 'pattern');
            continue;
        }
        ch.unraveled = true;
        return; // Only spread to 1 hex per rift per turn
    }
}

// ═══════════════════════════════════════
// Weaving
// ═══════════════════════════════════════
function canAffordRecipe(recipe) {
    let shortfall = 0;
    for (const [thread, amount] of Object.entries(recipe.cost)) {
        const deficit = amount - S.threads[thread];
        if (deficit > 0) shortfall += deficit;
    }
    return shortfall <= S.discount;
}

function weaveWorld(recipeIdx, weaverIdx) {
    const recipe = RECIPES[recipeIdx];
    const weaver = S.weavers[weaverIdx];
    const hex = S.hexes.get(hexKey(weaver.q, weaver.r));

    if (!hex || hex.unraveled || hex.world) return false;
    if (!canAffordRecipe(recipe)) return false;

    // Spend threads
    let discountLeft = S.discount;
    for (const [thread, amount] of Object.entries(recipe.cost)) {
        let pay = amount;
        if (discountLeft > 0 && pay > 0) { pay--; discountLeft--; }
        S.threads[thread] -= pay;
    }
    S.discount = 0;

    // Place world
    hex.world = { name: recipe.name, idx: recipeIdx };
    S.worldsWoven++;
    S.worlds.push({ name: recipe.name, q: weaver.q, r: weaver.r });
    addLog(weaver.name + ' weaves ' + recipe.name + '! (' + S.worldsWoven + '/' + WORLDS_TO_WIN + ')', 'weave');

    // Resonance: nearby hexes produce bonus next dawn
    let resonanceRange = 2;
    for (const rh of hexesInRange(weaver.q, weaver.r, resonanceRange)) {
        const rk = hexKey(rh.q, rh.r);
        if (S.hexes.has(rk)) S.resonanceHexes.add(rk);
    }

    // Harmony: if adjacent to another world, extra resonance
    for (const n of hexNeighbors(weaver.q, weaver.r)) {
        const nh = S.hexes.get(hexKey(n.q, n.r));
        if (nh && nh.world && !(n.q === weaver.q && n.r === weaver.r)) {
            addLog('Harmony! Adjacent Worlds resonate!', 'milestone');
            for (const rh of hexesInRange(n.q, n.r, resonanceRange)) {
                const rk = hexKey(rh.q, rh.r);
                if (S.hexes.has(rk)) S.resonanceHexes.add(rk);
            }
            break;
        }
    }

    // Milestones
    if (S.worldsWoven === 3) {
        addLog('Awakening! All Weavers surge with power!', 'milestone');
        for (const w of S.weavers) w.currentMp += 2;
    }
    if (S.worldsWoven === 5) {
        addLog('Convergence! The cosmos gifts threads!', 'milestone');
        for (let i = 0; i < 3; i++) S.threads[Rando.choice(THREADS)]++;
    }

    S.selectedRecipe = -1;
    updateAll();
    return true;
}

// ═══════════════════════════════════════
// Patterns
// ═══════════════════════════════════════
function activatePattern(weaver, hex) {
    const p = hex.pattern;
    if (!p) return;
    addLog(weaver.name + ' discovers ' + p.name + '!', 'pattern');

    switch (p.effect) {
        case 'cache':
            for (let i = 0; i < 2; i++) S.threads[Rando.choice(THREADS)]++;
            addLog('+2 random threads!', 'pattern');
            break;
        case 'discount':
            S.discount++;
            addLog('Next World costs 1 fewer thread!', 'pattern');
            break;
        case 'reveal':
            for (const [, h] of S.hexes) {
                if (h.pattern) h.pattern.revealed = true;
            }
            addLog('All Patterns revealed!', 'pattern');
            break;
        case 'resonance':
            for (const world of S.worlds) {
                for (const rh of hexesInRange(world.q, world.r, 2)) {
                    const rk = hexKey(rh.q, rh.r);
                    if (S.hexes.has(rk)) S.resonanceHexes.add(rk);
                }
            }
            addLog('All Worlds resonate again!', 'milestone');
            break;
        case 'rest':
            for (const w of S.weavers) w.currentMp += 2;
            addLog('All Weavers gain +2 MP!', 'pattern');
            break;
    }
    hex.pattern = null;
}

// ═══════════════════════════════════════
// Movement
// ═══════════════════════════════════════
function getMoveCost(hex, weaverType) {
    if (!hex) return Infinity;
    const t = TERRAIN[hex.terrain];
    if (!t) return Infinity;
    let cost = t.cost;
    if (hex.unraveled) cost += 1;
    if (weaverType === 'wanderer') cost = Math.max(1, cost - 1);
    return cost;
}

function computeReachable(weaver) {
    if (weaver.currentMp <= 0) { S.reachable = new Map(); return; }
    S.reachable = bfsHexes(
        { q: weaver.q, r: weaver.r },
        S.hexes,
        hex => getMoveCost(hex, weaver.type),
        weaver.currentMp
    );
    S.reachable.delete(hexKey(weaver.q, weaver.r));
}

function moveWeaver(weaver, toQ, toR) {
    const key = hexKey(toQ, toR);
    const cost = S.reachable.get(key);
    if (cost === undefined) return;

    weaver.q = toQ;
    weaver.r = toR;
    weaver.currentMp -= cost;

    // Seer auto-reveal patterns
    if (weaver.type === 'seer') {
        for (const rh of hexesInRange(toQ, toR, 3)) {
            const h = S.hexes.get(hexKey(rh.q, rh.r));
            if (h && h.pattern && !h.pattern.revealed) {
                h.pattern.revealed = true;
                addLog('Seer senses ' + h.pattern.name + ' nearby!', 'pattern');
            }
        }
    }

    // Discover pattern on landing
    const dest = S.hexes.get(hexKey(toQ, toR));
    if (dest && dest.pattern) {
        activatePattern(weaver, dest);
    }

    computeReachable(weaver);
    updateAll();
}

// ═══════════════════════════════════════
// Alchemist Transmute
// ═══════════════════════════════════════
function startTransmute() {
    S.transmutePhase = 'from';
    updateAll();
}

function transmuteSelect(threadType) {
    if (S.transmutePhase === 'from') {
        if (S.threads[threadType] <= 0) return;
        S.transmuteFrom = threadType;
        S.transmutePhase = 'to';
        updateAll();
        return;
    }
    if (S.transmutePhase !== 'to') return;
    if (threadType === S.transmuteFrom) return;

    S.threads[S.transmuteFrom]--;
    S.threads[threadType]++;
    const alch = S.weavers.find(w => w.type === 'alchemist');
    if (alch) alch.abilityUsed = true;
    addLog('Alchemist transmutes ' + THREAD_INFO[S.transmuteFrom].name +
           ' \u2192 ' + THREAD_INFO[threadType].name, 'pattern');
    S.transmutePhase = null;
    S.transmuteFrom = null;
    updateAll();
}

// ═══════════════════════════════════════
// Selection Helpers
// ═══════════════════════════════════════
function clearSelection() {
    S.selectedWeaver = -1;
    S.selectedRecipe = -1;
    S.reachable = null;
    S.transmutePhase = null;
}

function selectWeaver(idx) {
    S.selectedWeaver = idx;
    S.transmutePhase = null;
    if (S.phase === 'move') computeReachable(S.weavers[idx]);
}

function weaverAtHex(hex) {
    return S.weavers.findIndex(w => w.q === hex.q && w.r === hex.r);
}

// ═══════════════════════════════════════
// Input Handling
// ═══════════════════════════════════════
canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
        panning = true;
        panStartX = e.clientX; panStartY = e.clientY;
        panOrigX = camX; panOrigY = camY;
        e.preventDefault();
        return;
    }
    if (e.button !== 0 || S.gameOver) return;

    const hex = screenToHex(e.clientX, e.clientY);
    const hk = hexKey(hex.q, hex.r);

    if (S.phase === 'move') handleMoveClick(hex, hk);
    else if (S.phase === 'weave') handleWeaveClick(hex, hk);
});

canvas.addEventListener('mousemove', e => {
    if (panning) {
        camX = panOrigX + (e.clientX - panStartX);
        camY = panOrigY + (e.clientY - panStartY);
        render();
    }
});
canvas.addEventListener('mouseup', e => { if (e.button === 2) panning = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function handleMoveClick(hex, hk) {
    const clicked = weaverAtHex(hex);

    // No weaver selected yet — select one if clicked
    if (S.selectedWeaver < 0) {
        if (clicked >= 0) selectWeaver(clicked);
        updateAll();
        return;
    }

    // Clicked the already-selected weaver — deselect
    if (clicked === S.selectedWeaver) {
        clearSelection();
        updateAll();
        return;
    }

    // Clicked a reachable hex — move
    if (S.reachable && S.reachable.has(hk)) {
        moveWeaver(S.weavers[S.selectedWeaver], hex.q, hex.r);
        return;
    }

    // Clicked a different weaver — switch selection
    if (clicked >= 0) {
        selectWeaver(clicked);
        updateAll();
        return;
    }

    // Clicked empty space — deselect
    clearSelection();
    updateAll();
}

function handleWeaveClick(hex, _hk) {
    const clicked = weaverAtHex(hex);
    if (clicked >= 0) {
        S.selectedWeaver = clicked;
    } else {
        S.selectedWeaver = -1;
    }
    S.selectedRecipe = -1;
    updateAll();
}

// Keyboard
window.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (S.phase === 'move') endMovePhase();
        else if (S.phase === 'weave') endWeavePhase();
        else if (S.gameOver) initGame();
    }
    if (e.key === 'Escape') {
        clearSelection();
        updateAll();
    }
});

// ═══════════════════════════════════════
// Rendering
// ═══════════════════════════════════════
function render() {
    if (!S || !S.hexes) return;

    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, W, H);

    // Draw hexes
    for (const [key, hex] of S.hexes) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (x < -HEX_SIZE * 2 || x > W + HEX_SIZE * 2 ||
            y < -HEX_SIZE * 2 || y > H + HEX_SIZE * 2) continue;

        const terrain = TERRAIN[hex.terrain];

        // Fill
        drawHexPath(ctx, x, y, HEX_SIZE);
        if (hex.unraveled) {
            ctx.fillStyle = '#0a0008';
        } else {
            ctx.fillStyle = terrain.fill;
        }
        ctx.fill();

        // Outline
        ctx.strokeStyle = hex.unraveled ? '#3a0020' : terrain.outline;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Stars on starfield/nexus
        const stars = S.starSeeds.get(key);
        if (stars && !hex.unraveled) {
            for (const s of stars) {
                ctx.fillStyle = `rgba(200, 200, 240, ${s.brightness})`;
                ctx.fillRect(x + s.dx, y + s.dy, 1, 1);
            }
        }

        // Thread production indicator (small dot in upper-right)
        if (terrain.thread && !hex.unraveled && !hex.world) {
            const tType = terrain.thread === 'any' ? 'star' : terrain.thread;
            ctx.fillStyle = THREAD_INFO[tType].color;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(x + HEX_SIZE * 0.45, y - HEX_SIZE * 0.35, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        // Nexus marker
        if (hex.terrain === 'nexus' && !hex.unraveled) {
            ctx.fillStyle = '#6a68a8';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('\u25C8', x, y - 2);
        }
    }

    // Resonance glow
    for (const key of S.resonanceHexes) {
        const hex = S.hexes.get(key);
        if (!hex) continue;
        const { x, y } = hexToScreen(hex.q, hex.r);
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
        ctx.fill();
    }

    // Reachable highlights
    if (S.reachable && S.phase === 'move') {
        for (const [key] of S.reachable) {
            const { q, r } = parseHexKey(key);
            const { x, y } = hexToScreen(q, r);
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = 'rgba(255, 255, 100, 0.2)';
            ctx.fill();
        }
    }

    // Rift markers
    for (const rift of S.rifts) {
        const { x, y } = hexToScreen(rift.q, rift.r);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#8b0000';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.strokeStyle = '#ff2020';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-6, -6, 12, 12);
        ctx.restore();
    }

    // Pattern markers
    for (const [, hex] of S.hexes) {
        if (!hex.pattern) continue;
        const { x, y } = hexToScreen(hex.q, hex.r);
        const py = y - HEX_SIZE * 0.15;
        ctx.beginPath();
        ctx.arc(x, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = hex.pattern.revealed ? '#4ade80' : '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hex.pattern.revealed ? '!' : '?', x, py);
    }

    // World counters
    for (const world of S.worlds) {
        const { x, y } = hexToScreen(world.q, world.r);
        // Glow
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.fill();
        // Circle
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2a1a';
        ctx.fill();
        ctx.strokeStyle = '#d4a017';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Star
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u2605', x, y);
    }

    // Weaver counters
    drawWeavers();

    // Selection ring on selected weaver's hex
    if (S.selectedWeaver >= 0) {
        const w = S.weavers[S.selectedWeaver];
        const { x, y } = hexToScreen(w.q, w.r);
        drawHexPath(ctx, x, y, HEX_SIZE + 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Game over overlay on canvas
    if (S.gameOver) {
        ctx.fillStyle = 'rgba(4, 4, 12, 0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = S.gameWon ? '#FFD700' : '#cc3333';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(S.gameWon ? 'THE TAPESTRY IS COMPLETE' : 'THE LOOM IS LOST', W / 2, H / 2 - 20);
        ctx.fillStyle = '#8a8aaa';
        ctx.font = '14px monospace';
        ctx.fillText(S.gameWon
            ? S.worldsWoven + ' Worlds woven in ' + S.turn + ' turns'
            : 'The Unraveling consumed the Nexus on turn ' + S.turn,
            W / 2, H / 2 + 15);
        ctx.fillText('Press Space for a new game', W / 2, H / 2 + 40);
    }
}

function drawWeavers() {
    // Group by hex
    const groups = new Map();
    for (const w of S.weavers) {
        const k = hexKey(w.q, w.r);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(w);
    }

    for (const [key, weavers] of groups) {
        const { q, r } = parseHexKey(key);
        const { x: cx, y: cy } = hexToScreen(q, r);
        const spacing = 15;
        const ox = -(weavers.length - 1) * spacing / 2;
        const oy = HEX_SIZE * 0.25;

        for (let i = 0; i < weavers.length; i++) {
            const w = weavers[i];
            const wx = cx + ox + i * spacing;
            const wy = cy + oy;
            const sel = S.selectedWeaver === w.id;
            drawWeaverCounter(wx, wy, w, sel);
        }
    }
}

function drawWeaverCounter(cx, cy, weaver, selected) {
    const s = 16;
    const x = cx - s / 2, y = cy - s / 2;
    const r = 3;

    // Shadow
    roundRect(ctx, x + 1, y + 1, s, s, r);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // Body
    roundRect(ctx, x, y, s, s, r);
    ctx.fillStyle = weaver.color;
    ctx.fill();
    ctx.strokeStyle = selected ? '#fff' : '#000';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();

    // Letter
    ctx.fillStyle = weaver.textColor;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(weaver.name[0], cx, cy);

    // MP pip
    if (weaver.currentMp > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '6px monospace';
        ctx.fillText('' + weaver.currentMp, cx + s / 2 - 3, cy + s / 2 - 3);
    }
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

// ═══════════════════════════════════════
// UI Updates
// ═══════════════════════════════════════
function updateAll() {
    updateTurnInfo();
    updateThreads();
    updateWeavers();
    updateRecipes();
    updateActions();
    updateLog();
    render();
}

function updateTurnInfo() {
    const el = document.getElementById('turn-info');
    const phaseNames = {
        dawn: 'Dawn', move: 'Movement', weave: 'Weaving', dusk: 'Dusk', gameover: 'Game Over'
    };
    el.innerHTML = `Turn ${S.turn} &mdash; <span class="phase-label">${phaseNames[S.phase] || S.phase}</span>`;
}

function updateThreads() {
    const el = document.getElementById('threads');
    const clickable = S.transmutePhase !== null;
    el.innerHTML = THREADS.map(t => {
        const info = THREAD_INFO[t];
        let cls = 'thread-pill';
        if (clickable) {
            cls += ' clickable';
            if (S.transmutePhase === 'from' && S.threads[t] > 0) cls += ' highlight';
            if (S.transmutePhase === 'to' && t !== S.transmuteFrom) cls += ' highlight';
        }
        return `<div class="${cls}" data-thread="${t}">
            <span class="thread-dot" style="background:${info.color}"></span>
            <span class="thread-count">${S.threads[t]}</span>
        </div>`;
    }).join('');

    // Click handlers for transmute
    if (clickable) {
        el.querySelectorAll('.thread-pill.clickable').forEach(pill => {
            pill.addEventListener('click', () => transmuteSelect(pill.dataset.thread));
        });
    }
}

function updateWeavers() {
    const el = document.getElementById('weavers');
    el.innerHTML = S.weavers.map((w, i) => {
        let cls = 'weaver-row';
        if (S.selectedWeaver === i) cls += ' selected';
        const hex = S.hexes.get(hexKey(w.q, w.r));
        const terrain = hex ? TERRAIN[hex.terrain] : null;
        const terrainName = terrain ? terrain.name : '?';
        return `<div class="${cls}" data-idx="${i}">
            <div class="weaver-icon" style="background:${w.color};color:${w.textColor}">${w.name[0]}</div>
            <div>
                <span class="weaver-name">${w.name}</span>
                <span class="weaver-desc">${terrainName} \u00B7 ${w.desc}</span>
            </div>
            <span class="weaver-mp">${w.currentMp}/${w.mp}</span>
        </div>`;
    }).join('');

    el.querySelectorAll('.weaver-row').forEach(row => {
        row.addEventListener('click', () => {
            const idx = parseInt(row.dataset.idx);
            if (S.phase === 'move') {
                if (S.selectedWeaver === idx) clearSelection();
                else selectWeaver(idx);
            } else if (S.phase === 'weave') {
                S.selectedWeaver = idx;
                S.selectedRecipe = -1;
            }
            updateAll();
        });
    });
}

function updateRecipes() {
    const el = document.getElementById('recipes');
    const countEl = document.getElementById('world-count');
    countEl.textContent = '(' + S.worldsWoven + '/' + WORLDS_TO_WIN + ')';

    el.innerHTML = RECIPES.map((recipe, i) => {
        const affordable = canAffordRecipe(recipe);
        let cls = 'recipe-row';
        if (S.phase === 'weave' && affordable) cls += ' affordable';
        else if (S.phase === 'weave') cls += ' unaffordable';
        if (S.selectedRecipe === i) cls += ' selected';

        const costHtml = Object.entries(recipe.cost).map(([t, n]) => {
            const info = THREAD_INFO[t];
            return `<span class="recipe-cost-item" style="color:${info.color}">${n}${info.symbol}</span>`;
        }).join('');

        return `<div class="${cls}" data-idx="${i}">
            <span class="recipe-name">${recipe.name}</span>
            <span class="recipe-desc">${recipe.desc}</span>
            <div class="recipe-cost">${costHtml}</div>
        </div>`;
    }).join('');

    if (S.phase === 'weave') {
        el.querySelectorAll('.recipe-row.affordable').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.dataset.idx);
                if (S.selectedWeaver < 0) {
                    addLog('Select a Weaver first to place the World', '');
                    updateAll();
                    return;
                }
                if (!weaveWorld(idx, S.selectedWeaver)) {
                    addLog('Cannot weave here (occupied or unraveled)', 'danger');
                    updateAll();
                }
            });
        });
    }
}

function updateActions() {
    const el = document.getElementById('actions');
    let html = '';

    if (S.phase === 'move') {
        html += '<button class="btn primary" id="btn-end-move">End Movement</button>';

        // Alchemist transmute button
        const alch = S.weavers.find(w => w.type === 'alchemist');
        if (alch && !alch.abilityUsed) {
            if (S.transmutePhase === 'from') {
                html += '<button class="btn" id="btn-transmute" disabled>Select thread to lose...</button>';
            } else if (S.transmutePhase === 'to') {
                html += '<button class="btn" id="btn-transmute" disabled>Select thread to gain...</button>';
            } else {
                html += '<button class="btn" id="btn-transmute">Transmute (Alchemist)</button>';
            }
        }
    } else if (S.phase === 'weave') {
        html += '<button class="btn primary" id="btn-end-weave">End Weaving</button>';
        if (S.selectedWeaver < 0) {
            html += '<div style="font-size:9px;color:#5a5a7a;text-align:center;margin-top:4px">Select a Weaver, then click a recipe</div>';
        }
    } else if (S.gameOver) {
        html += '<button class="btn primary" id="btn-new-game">New Game</button>';
    }

    el.innerHTML = html;

    // Bind buttons
    const endMove = document.getElementById('btn-end-move');
    if (endMove) endMove.addEventListener('click', endMovePhase);

    const endWeave = document.getElementById('btn-end-weave');
    if (endWeave) endWeave.addEventListener('click', endWeavePhase);

    const transmute = document.getElementById('btn-transmute');
    if (transmute && !transmute.disabled) transmute.addEventListener('click', startTransmute);

    const newGame = document.getElementById('btn-new-game');
    if (newGame) newGame.addEventListener('click', initGame);
}

// ═══════════════════════════════════════
// Boot
// ═══════════════════════════════════════
resize();   // set W, H first (render guards against null S)
initGame(); // creates state and triggers first render
