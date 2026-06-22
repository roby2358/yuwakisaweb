// index.js — Healer. The UI layer: canvas rendering, input, and the animated turn playback.
//
// All game state and rules live in GameState / GameEngine; this file owns only the view
// (pan, hover), the input-modal stack (selection/targeting/overlay), and the canvas. It holds
// one engine, calls its methods in response to input, and reconstructs the animated turn by
// replaying the frames resolveTurn() returns. Comments cite the UI control layers (L1.x …);
// see UI_CONTROLS.md.
//
// No ES modules — every script is a plain <script> include so index.html runs from a
// double-click (file://). Load order (see index.html): config, rando, colortheory, hex,
// content, mechanics, gamestate, ai/movement, ai/partyai, ai/enemyai, gameengine, index.

const engine = new GameEngine();

// ---- Input-layer state (see UI_CONTROLS.md) ----
let resolving = false;            // true while the animated turn plays back; map input is dead then
let selection = null;             // L1.2 { reachable: Map<key,cost> } for healer movement, or null
let targeting = null;             // L4 { skill, validKeys: Set<key> } while aiming a skill, or null
let activeSkill = null;           // the skill whose targeting is active
let overlay = null;               // L5 'intro' | 'victory' | 'defeat' | null
let endMessage = '';              // subtitle for the victory/defeat overlay
let hoveredHex = null;
let combatFlash = null;           // transient { q, r } marking a hit, set per playback frame
let showDanger = false;           // nav-bar toggle: paint the enemy danger heat map
let spellSide = 'left';           // which screen edge the spell panel docks to: 'left' | 'right'

// During turn playback, render() draws this captured frame instead of the live state, so the
// already-resolved turn animates step by step. Null on the player's turn → render live.
let renderView = null;

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

const sleep = ms => new Promise(res => setTimeout(res, ms));

// ---- Coordinate helpers ----
function hexToScreen(q, r) {
    const p = new Hex(q, r).toPixel();
    return { x: p.x + panX, y: p.y + panY };
}

function screenToHex(sx, sy) {
    return Hex.fromPixel(sx - panX, sy - panY);
}

// ---- New game ----
function initGame() {
    engine.newGame();
    resolving = false;
    selection = null;
    targeting = null;
    activeSkill = null;
    overlay = null;
    hoveredHex = null;
    combatFlash = null;
    renderView = null;
    centerOn(engine.state.healer);
    showOverlay('intro');
    refreshSkillBar();
    resize();
}

function centerOn(hex) {
    const p = new Hex(hex.q, hex.r).toPixel();
    panX = canvas.width / 2 - p.x;
    panY = canvas.height / 2 - p.y;
}

// ---- Skill bar (DOM) ----
function refreshSkillBar() {
    const bar = document.getElementById('skill-bar');
    bar.innerHTML = '';
    bar.classList.toggle('side-right', spellSide === 'right');
    bar.classList.toggle('side-left', spellSide !== 'right');
    if (overlay || resolving || !engine.state.healer) return;

    bar.appendChild(buildSpellHeader());

    const tier = engine.state.currentTier();
    const healer = engine.state.healer;
    for (const skill of SKILLS) {
        if (skill.tier > tier) continue;
        const cd = healer.cooldowns[skill.id];
        const sub = cd > 0 ? `CD ${cd}` : `${skill.aetherCost}A`;
        const btn = document.createElement('button');
        btn.innerHTML = `<span class="name">${skill.name}<span class="cost">${sub}</span></span>` +
            `<span class="desc">${skill.description}</span>`;
        btn.disabled = !engine.skillUsable(skill);
        if (activeSkill && activeSkill.id === skill.id) btn.classList.add('active');
        btn.addEventListener('click', () => onSkillButton(skill));
        bar.appendChild(btn);
    }
}

// Header with the dock toggle: ← docks the panel left, → docks it right.
function buildSpellHeader() {
    const header = document.createElement('div');
    header.className = 'spell-header';
    header.appendChild(flipButton('←', 'left'));
    header.appendChild(flipButton('→', 'right'));
    return header;
}

function flipButton(glyph, side) {
    const btn = document.createElement('button');
    btn.className = 'flip';
    btn.textContent = glyph;
    btn.disabled = spellSide === side;
    btn.addEventListener('click', () => setSpellSide(side));
    return btn;
}

function setSpellSide(side) {
    spellSide = side;
    refreshSkillBar();
}

function onSkillButton(skill) {
    if (!engine.skillUsable(skill)) return;
    if (activeSkill && activeSkill.id === skill.id) { cancelTargeting(); render(); return; }
    deselect();
    activeSkill = skill;
    const targets = engine.validSkillTargets(skill);
    targeting = { skill, validKeys: new Set(targets.map(u => Hex.key(u.q, u.r))) };
    refreshSkillBar();
    render();
}

function castAt(hex) {
    const key = Hex.key(hex.q, hex.r);
    if (!targeting || !targeting.validKeys.has(key)) { cancelTargeting(); render(); return; }
    engine.castSkill(targeting.skill, hex);
    cancelTargeting();
    render();
}

function cancelTargeting() {
    targeting = null;
    activeSkill = null;
    refreshSkillBar();
}

// ---- L1.2 Healer selection & movement ----
function selectHealer() {
    cancelTargeting();
    selection = { reachable: engine.computeReachable() };
}

function deselect() {
    selection = null;
}

function moveHealer(q, r) {
    const res = engine.moveHealer(q, r);
    if (!res.moved) return;
    if (engine.state.outcome) { showEndOverlay(); return; }
    if (engine.state.healer.mp > 0) selectHealer();
    else deselect();
    render();
}

// ---- Turn loop (animated playback of resolveTurn's frames) ----
function primaryAction() {
    if (overlay || resolving) return;
    endTurn();
}

async function endTurn() {
    if (resolving || overlay) return;
    resolving = true;
    deselect();
    cancelTargeting();
    refreshSkillBar();

    const frames = engine.resolveTurn();
    for (const f of frames) {
        renderView = f.snapshot;
        combatFlash = f.flash;
        render();
        await sleep(110);
    }
    renderView = null;
    combatFlash = null;

    resolving = false;
    if (engine.state.outcome) { showEndOverlay(); return; }
    refreshSkillBar();
    render();
}

function showEndOverlay() {
    endMessage = engine.state.outcomeMessage;
    showOverlay(engine.state.outcome);
    render();
}

// ---- L5 Overlays ----
function showOverlay(name) {
    overlay = name;
    syncOverlayDom();
}

function dismissOverlay() {
    overlay = null;
    syncOverlayDom();
    refreshSkillBar();
    render();
}

function syncOverlayDom() {
    document.getElementById('intro-panel').classList.toggle('hidden', overlay !== 'intro');
    refreshSkillBar();
}

// ---- Rendering ----
// Draw from the playback frame during a resolving turn, otherwise from a live snapshot. Either
// way `view` is a plain { units, treasureCollected, objectiveHex } picture; selection/targeting
// overlays come from UI state and only show on the player's turn (cleared before playback).
function render() {
    const view = renderView ?? engine.snapshot();

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawTerrain();
    drawDanger();
    drawLandmarks(view);
    drawSelection();
    drawTargeting();

    for (const unit of view.units) drawUnit(unit);

    drawCombatFlash();
    drawEndOverlay();
    updateHUD();
}

function onScreen(x, y) {
    return x >= -HEX_SIZE * 2 && x <= canvas.width + HEX_SIZE * 2 &&
        y >= -HEX_SIZE * 2 && y <= canvas.height + HEX_SIZE * 2;
}

function drawTerrain() {
    for (const [, hex] of engine.state.hexes) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (!onScreen(x, y)) continue;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
        ctx.fill();
        ctx.strokeStyle = '#00000044';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// Danger heat overlay (nav-bar toggle). Rebuilt fresh each paint, then normalized to the
// current hottest hex so the gradient stays readable whatever the absolute strengths are:
// deeper red = more accumulated threat.
function drawDanger() {
    if (!showDanger) return;
    const danger = engine.buildDangerMap();
    let max = 0;
    for (const v of danger.values()) if (v > max) max = v;
    if (max === 0) return;
    for (const [key, strength] of danger) {
        const { q, r } = Hex.fromKey(key);
        const { x, y } = hexToScreen(q, r);
        if (!onScreen(x, y)) continue;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = `rgba(220, 40, 40, ${0.12 + 0.45 * (strength / max)})`;
        ctx.fill();
    }
}

function drawLandmarks(view) {
    if (!view.treasureCollected) drawLandmark(engine.state.treasureHex, TARGET_COLOR, '★');
    drawLandmark(engine.state.homeHex, HOME_COLOR, '⌂');
    if (view.objectiveHex) {
        const { x, y } = hexToScreen(view.objectiveHex.q, view.objectiveHex.r);
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.strokeStyle = '#ffffffaa';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function drawLandmark(hex, color, glyph) {
    const { x, y } = hexToScreen(hex.q, hex.r);
    if (!onScreen(x, y)) return;
    ctx.fillStyle = color;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x, y);
}

function drawSelection() {
    if (!selection) return;
    for (const key of selection.reachable.keys()) {
        const { q, r } = Hex.fromKey(key);
        const { x, y } = hexToScreen(q, r);
        if (!onScreen(x, y)) continue;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.25)';
        ctx.fill();
    }
}

function drawTargeting() {
    if (!targeting) return;
    for (const key of targeting.validKeys) {
        const { q, r } = Hex.fromKey(key);
        const { x, y } = hexToScreen(q, r);
        if (!onScreen(x, y)) continue;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.strokeStyle = '#6fdf6f';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

function drawCombatFlash() {
    if (!combatFlash) return;
    const { x, y } = hexToScreen(combatFlash.q, combatFlash.r);
    drawHexPath(ctx, x, y, HEX_SIZE);
    ctx.strokeStyle = '#ff5555';
    ctx.lineWidth = 4;
    ctx.stroke();
}

function drawUnit(unit) {
    const { x, y } = hexToScreen(unit.q, unit.r);
    if (!onScreen(x, y)) return;

    const downed = unit.kind === 'party' && !unit.alive;
    if (downed) {
        drawCounter(x, y, '#555', 'x');
        ctx.fillStyle = '#ffb3b3';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(REVIVE_WINDOW + 1 - unit.downedTurns), x + COUNTER_SIZE / 2, y - COUNTER_SIZE / 2);
        return;
    }

    drawCounter(x, y, unit.color, unit.label);
    drawHpBar(x, y, unit.hp / unit.maxHp);
    drawStatusDots(x, y, unit);

    if (unit.kind === 'healer' && selection) {
        const s = COUNTER_SIZE + 4;
        roundRect(ctx, x - s / 2, y - s / 2, s, s, 6);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function drawHpBar(cx, cy, frac) {
    const w = COUNTER_SIZE;
    const x = cx - w / 2;
    const y = cy + COUNTER_SIZE / 2 + 3;
    const f = Math.max(0, Math.min(1, frac));
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = f > 0.5 ? '#4caf50' : f > 0.25 ? '#d4a017' : '#cc3333';
    ctx.fillRect(x, y, w * f, 3);
}

function drawStatusDots(cx, cy, unit) {
    const types = [...new Set(unit.statuses.map(s => s.type))];
    if (types.length === 0) return;
    const r = 3;
    const startX = cx - (types.length - 1) * (r + 2);
    const y = cy - COUNTER_SIZE / 2 - 5;
    types.forEach((type, i) => {
        ctx.beginPath();
        ctx.arc(startX + i * (r * 2 + 2), y, r, 0, Math.PI * 2);
        ctx.fillStyle = STATUS_COLORS[type] || '#ccc';
        ctx.fill();
    });
}

function drawEndOverlay() {
    if (overlay !== 'victory' && overlay !== 'defeat') return;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(overlay === 'victory' ? 'VICTORY' : 'DEFEAT', canvas.width / 2, canvas.height / 2 - 30);
    ctx.font = '18px monospace';
    ctx.fillText(endMessage, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('Press New Game to play again', canvas.width / 2, canvas.height / 2 + 48);
}

function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
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

    ctx.strokeStyle = '#888';
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
    const st = engine.state;
    if (!st.healer) return;
    document.getElementById('turn-info').textContent = 'Turn ' + st.turn;
    document.getElementById('hp-info').textContent = `HP: ${st.healer.hp}/${st.healer.maxHp}`;
    document.getElementById('aether-info').textContent = `Aether: ${st.healer.aether}/${st.healer.maxAether}`;
    document.getElementById('rep-info').textContent = `Rep: ${st.reputation}`;
    const living = st.party.filter(p => p.alive).length;
    document.getElementById('party-info').textContent = `Party: ${living}/${st.party.length}`;

    const hoverEl = document.getElementById('hover-info');
    const h = hoveredHex && st.hexAt(hoveredHex.q, hoveredHex.r);
    hoverEl.textContent = h ? `${TERRAIN_NAMES[h.terrain] ?? '?'} (${hoveredHex.q},${hoveredHex.r})` : '';
}

// ---- Input handling ----
canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
        if (targeting) { cancelTargeting(); render(); return; }
        panning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panOrigX = panX;
        panOrigY = panY;
        e.preventDefault();
        return;
    }
    if (e.button !== 0) return;

    if (overlay === 'intro') { dismissOverlay(); return; }   // L5 intro consumes the click
    if (overlay) return;                                     // victory/defeat: use New Game
    if (resolving) return;                                   // L1.1 input is dead during playback

    const hex = screenToHex(e.clientX, e.clientY);
    if (!engine.state.hexAt(hex.q, hex.r)) return;

    // L4 modal targeting takes priority: a valid hex casts, anything else cancels.
    if (targeting) { castAt(hex); return; }

    // L1.2 healer select → move (pure lookup against the cached reachable set).
    const healer = engine.state.healer;
    if (!selection) {
        if (hex.q === healer.q && hex.r === healer.r) selectHealer();
    } else if (hex.q === healer.q && hex.r === healer.r) {
        deselect();
    } else if (selection.reachable.has(Hex.key(hex.q, hex.r))) {
        moveHealer(hex.q, hex.r);
        return;
    } else {
        deselect();
    }
    render();
});

canvas.addEventListener('mousemove', e => {
    if (panning) {
        panX = panOrigX + (e.clientX - panStartX);
        panY = panOrigY + (e.clientY - panStartY);
        render();
        return;
    }
    const hex = screenToHex(e.clientX, e.clientY);
    const next = engine.state.hexAt(hex.q, hex.r) ? { q: hex.q, r: hex.r } : null;
    if (next?.q !== hoveredHex?.q || next?.r !== hoveredHex?.r) {
        hoveredHex = next;
        updateHUD();
    }
});

canvas.addEventListener('mouseup', e => {
    if (e.button === 2) panning = false;
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('end-turn').addEventListener('click', primaryAction);
document.getElementById('new-game').addEventListener('click', initGame);
document.getElementById('toggle-danger').addEventListener('click', toggleDanger);
document.getElementById('begin-btn').addEventListener('click', dismissOverlay);

function toggleDanger() {
    showDanger = !showDanger;
    document.getElementById('toggle-danger').classList.toggle('active', showDanger);
    render();
}

window.addEventListener('keydown', e => {
    if (overlay === 'intro' && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        dismissOverlay();
        return;
    }
    if (overlay) return;
    if (e.key === 'Escape') {
        if (targeting) cancelTargeting();
        else deselect();
        render();
        return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        primaryAction();
    }
});

// ---- Start ----
initGame();
