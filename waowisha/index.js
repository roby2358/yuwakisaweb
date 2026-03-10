// index.js — Waowisha rendering, input, and UI

import { HEX_SIZE, TERRAIN_INFO, UNIT_TYPES, ENEMY_TYPES, STRUCTURE_TYPES,
    PRODUCTION_RECIPES, RECIPES, ALL_R0, ALL_P1, SLOT_COLORS } from './config.js';
import { hexToPixel, pixelToHex, hexKey, parseHexKey, hexDistance, drawHexPath } from './hex.js';
import { createGame, selectUnit, deselectUnit, moveUnit, recruitUnit,
    startBuild, assignRecipe, endTurn, canAfford, computeReachable,
    deployCharge, pickUpCharge, computeVisibility } from './game.js';

// ---- Constants ----
const COUNTER_SIZE = 26;

// ---- State ----
let state = null;

// ---- View ----
let panX = 0, panY = 0;
let panning = false, panStartX = 0, panStartY = 0, panOrigX = 0, panOrigY = 0;

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
function screenToHex(sx, sy) { return pixelToHex(sx - panX, sy - panY); }

function centerOn(q, r) {
    const p = hexToPixel(q, r);
    panX = canvas.width / 2 - p.x;
    panY = canvas.height / 2 - p.y;
}

// ---- Drawing helpers ----
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
    ctx.arcTo(x+w, y, x+w, y+r, r); ctx.lineTo(x+w, y+h-r);
    ctx.arcTo(x+w, y+h, x+w-r, y+h, r); ctx.lineTo(x+r, y+h);
    ctx.arcTo(x, y+h, x, y+h-r, r); ctx.lineTo(x, y+r);
    ctx.arcTo(x, y, x+r, y, r); ctx.closePath();
}

function contrastText(hexColor) {
    const r = parseInt(hexColor.slice(1,3),16)/255;
    const g = parseInt(hexColor.slice(3,5),16)/255;
    const b = parseInt(hexColor.slice(5,7),16)/255;
    return (0.2126*r + 0.7152*g + 0.0722*b) > 0.4 ? '#000' : '#fff';
}

function drawCounter(cx, cy, color, label, isSelected) {
    const s = COUNTER_SIZE, x = cx-s/2, y = cy-s/2, r = 4;
    // Shadow
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x+r+i, y+s+1+i);
        ctx.arcTo(x+s+1+i, y+s+1+i, x+s+1+i, y+s-r+1+i, r);
        ctx.lineTo(x+s+1+i, y+r+i);
        ctx.stroke();
    }
    // Body
    roundRect(ctx, x, y, s, s, r);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    // Label
    ctx.fillStyle = contrastText(color);
    ctx.font = `bold ${Math.floor(s*0.55)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy+1);
    // Selection ring
    if (isSelected) {
        const ss = s + 4;
        roundRect(ctx, cx-ss/2, cy-ss/2, ss, ss, 6);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
}

function drawStructure(cx, cy, sDef, buildProgress) {
    const s = HEX_SIZE * 1.4;
    if (sDef.category === 'defense') {
        // Circle for defense
        ctx.beginPath();
        ctx.arc(cx, cy, s/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = buildProgress > 0 ? '#554' : '#aa8';
        ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    } else {
        // Square for production
        roundRect(ctx, cx - s/2, cy - s/2, s, s, 3);
        ctx.fillStyle = buildProgress > 0 ? '#445' : '#88a';
        ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = sDef.name.charAt(0);
    ctx.fillText(label, cx, cy);

    if (buildProgress > 0) {
        ctx.fillStyle = '#ee8';
        ctx.font = '9px monospace';
        ctx.fillText(buildProgress + 't', cx, cy + s/2 - 4);
    }
}

// ---- Rendering ----
function render() {
    if (!state) return;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Terrain
    for (const hex of state.map.values()) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (x < -50 || x > canvas.width+50 || y < -50 || y > canvas.height+50) continue;

        drawHexPath(ctx, x, y, HEX_SIZE);
        const info = TERRAIN_INFO[hex.terrain];
        ctx.fillStyle = info ? info.color : '#555';
        ctx.fill();
        ctx.strokeStyle = '#00000044'; ctx.lineWidth = 1; ctx.stroke();

        // Fog overlay
        if (!state.visible.has(hexKey(hex.q, hex.r))) {
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fill();
        }

        // Resource capacity indicator (small dot)
        if (info && info.resource && state.visible.has(hexKey(hex.q, hex.r))) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.arc(x, y + HEX_SIZE * 0.55, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Settlement marker
    if (state.settlement) {
        const { q, r } = parseHexKey(state.settlement);
        const { x, y } = hexToScreen(q, r);
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.strokeStyle = '#daa520'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#daa520';
        ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('LOOM', x, y + HEX_SIZE * 0.55);
    }

    // Reachable highlights
    for (const [key] of state.reachable) {
        const { q, r } = parseHexKey(key);
        const { x, y } = hexToScreen(q, r);
        drawHexPath(ctx, x, y, HEX_SIZE);
        // Color reachable hexes with enemies red
        const hasEnemy = state.enemies.some(e => hexKey(e.q, e.r) === key);
        ctx.fillStyle = hasEnemy ? 'rgba(255,80,80,0.35)' : 'rgba(255,255,0,0.25)';
        ctx.fill();
    }

    // Structures
    for (const s of state.structures) {
        const { x, y } = hexToScreen(s.q, s.r);
        const sDef = STRUCTURE_TYPES[s.type];
        drawStructure(x, y, sDef, s.buildProgress);
    }

    // Enemies (only visible)
    for (const enemy of state.enemies) {
        if (!state.visible.has(hexKey(enemy.q, enemy.r))) continue;
        const { x, y } = hexToScreen(enemy.q, enemy.r);
        const eDef = ENEMY_TYPES[enemy.type];
        const label = enemy.type === 'broodMother' ? 'B' : eDef.symbol.toUpperCase();
        drawCounter(x, y, eDef.color, label, false);
    }

    // Player units
    for (const unit of state.units) {
        const { x, y } = hexToScreen(unit.q, unit.r);
        const def = UNIT_TYPES[unit.type];
        const isSel = state.selectedUnit === unit.id;
        drawCounter(x, y, def.color, def.symbol, isSel);
        // Moved indicator
        if (unit.mp <= 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            roundRect(ctx, x-COUNTER_SIZE/2, y-COUNTER_SIZE/2, COUNTER_SIZE, COUNTER_SIZE, 4);
            ctx.fill();
        }
        // Carrying indicator
        if (unit.carrying) {
            ctx.fillStyle = '#f80';
            ctx.beginPath();
            ctx.arc(x + COUNTER_SIZE/2 - 3, y - COUNTER_SIZE/2 + 3, 4, 0, Math.PI*2);
            ctx.fill();
        }
    }

    // Victory / Game Over overlay
    if (state.victory || state.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = state.victory ? '#6a4' : '#a33';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(state.victory ? 'MANDATE FULFILLED' : 'THE LOOM HAS FALLEN', canvas.width/2, canvas.height/2-30);
        ctx.fillStyle = '#ddd';
        ctx.font = '20px monospace';
        ctx.fillText(`Turn ${state.turn}`, canvas.width/2, canvas.height/2+20);
    }

    updateHUD();
    updateLog();
}

// ---- HUD ----
function updateHUD() {
    document.getElementById('turn-info').textContent = `Turn ${state.turn}`;

    // Stockpile
    const stockEl = document.getElementById('stockpile');
    let stockHTML = '';
    const slots = [...ALL_R0, ...ALL_P1, 'P2a','P2b','P2c','P2d','P3a','P3b','P3c','P3d'];
    for (const slot of slots) {
        const amt = state.stockpile[slot] || 0;
        if (slot in state.stockpile) {
            const name = state.names[slot] || slot;
            const color = SLOT_COLORS[slot] || '#888';
            stockHTML += `<span class="stock-item"><span class="stock-dot" style="color:${color}">\u2B22</span><span class="stock-label">${name}:</span> <span class="stock-value">${amt}</span></span>`;
        }
    }
    stockEl.innerHTML = stockHTML || '<span class="stock-label">No resources</span>';

    // Mandate
    const mandEl = document.getElementById('mandate');
    let mandHTML = '<b>The Mandate:</b><br>';
    for (const goal of state.mandate) {
        const name = state.names[goal.product] || goal.product;
        if (!goal.revealed) {
            mandHTML += '<div class="goal goal-hidden">???</div>';
        } else if (goal.produced >= goal.quantity) {
            mandHTML += `<div class="goal goal-done">${name}: ${goal.produced}/${goal.quantity}</div>`;
        } else {
            mandHTML += `<div class="goal goal-active">${name}: ${goal.produced}/${goal.quantity}</div>`;
        }
    }
    mandEl.innerHTML = mandHTML;
}

function updateLog() {
    const logEl = document.getElementById('log');
    const entries = state.log.slice(-12);
    logEl.innerHTML = entries.map(e => `<div class="log-entry">${e}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
}

// ---- Panel (context menu for actions) ----
function showPanel(title, content) {
    const panel = document.getElementById('panel');
    document.getElementById('panel-title').textContent = title;
    document.getElementById('panel-content').innerHTML = content;
    panel.classList.remove('hidden');
}

function hidePanel() {
    document.getElementById('panel').classList.add('hidden');
}

function showUnitPanel(unit) {
    const def = UNIT_TYPES[unit.type];
    let html = `<div style="margin-bottom:6px">${def.name} | STR:${def.strength} MP:${def.mp}</div>`;

    // Build options (available even after moving — move then build on same turn)
    if (def.build) {
        const k = hexKey(unit.q, unit.r);
        const hasStruct = state.structures.some(s => hexKey(s.q, s.r) === k);
        if (!hasStruct && k !== state.settlement) {
            html += '<div style="margin:4px 0;color:#aaa">Build:</div>';
            for (const [type, sDef] of Object.entries(STRUCTURE_TYPES)) {
                const affordable = canAfford(state, sDef.cost);
                const costStr = Object.entries(sDef.cost).map(([r,a]) => `${a} ${state.names[r]||r}`).join(', ');
                html += `<button data-build="${type}" ${affordable?'':'disabled'}>${sDef.name} (${costStr})</button>`;
            }
        }
    }

    // Recruit options (if on settlement)
    if (hexKey(unit.q, unit.r) === state.settlement) {
        html += '<div style="margin:4px 0;color:#aaa">Recruit:</div>';
        for (const [type, uDef] of Object.entries(UNIT_TYPES)) {
            if (!uDef.cost) continue;
            const affordable = canAfford(state, uDef.cost);
            const costStr = Object.entries(uDef.cost).map(([r,a]) => `${a} ${state.names[r]||r}`).join(', ');
            html += `<button data-recruit="${type}" ${affordable?'':'disabled'}>${uDef.name} (${costStr})</button>`;
        }
    }

    // Drift Charge
    if (unit.carrying === 'P3d') {
        html += `<button data-action="deploy-charge">Deploy Drift Charge (range 3)</button>`;
    } else if (!unit.carrying && (state.stockpile.P3d || 0) > 0) {
        html += `<button data-action="pickup-charge">Pick Up Drift Charge</button>`;
    }

    showPanel(def.name, html);
}

function showStructurePanel(struct) {
    const sDef = STRUCTURE_TYPES[struct.type];
    if (struct.buildProgress > 0) {
        showPanel(sDef.name, `<div>Under construction: ${struct.buildProgress} turns remaining</div>`);
        return;
    }
    if (sDef.category !== 'production') {
        showPanel(sDef.name, `<div>Range: ${sDef.range} | Power: ${sDef.power}</div>`);
        return;
    }

    const recipes = PRODUCTION_RECIPES[sDef.tier] || [];
    let html = `<div style="margin-bottom:4px">Current: ${struct.recipe ? (state.names[struct.recipe]||struct.recipe) : 'None'}</div>`;
    html += '<div style="margin:4px 0;color:#aaa">Recipes:</div>';
    for (const recipe of recipes) {
        const r = RECIPES[recipe];
        const inputStr = Object.entries(r.inputs).map(([s,a]) => `${a} ${state.names[s]||s}`).join(' + ');
        const active = struct.recipe === recipe;
        html += `<button data-recipe="${recipe}" data-struct="${struct.id}" ${active?'style="border-color:#ee8"':''}>${state.names[recipe]||recipe} (${inputStr})</button>`;
    }
    showPanel(sDef.name, html);
}

// ---- Input ----
canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
        panning = true;
        panStartX = e.clientX; panStartY = e.clientY;
        panOrigX = panX; panOrigY = panY;
        e.preventDefault();
        return;
    }

    if (e.button === 0 && state && !state.gameOver && !state.victory) {
        const hex = screenToHex(e.clientX, e.clientY);
        const key = hexKey(hex.q, hex.r);
        handleClick(hex.q, hex.r, key);
    }
});

canvas.addEventListener('mousemove', e => {
    if (panning) {
        panX = panOrigX + (e.clientX - panStartX);
        panY = panOrigY + (e.clientY - panStartY);
        render();
    }
});

canvas.addEventListener('mouseup', e => { if (e.button === 2) panning = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function handleClick(q, r, key) {
    // Deploy charge mode
    if (state.buildMode === 'deploy-charge' && state.selectedUnit) {
        const unit = state.units.find(u => u.id === state.selectedUnit);
        if (unit && hexDistance(unit.q, unit.r, q, r) <= 3) {
            deployCharge(state, unit.id, q, r);
            state.buildMode = null;
            hidePanel();
            state.visible = computeVisibility(state);
            render();
            return;
        }
        state.buildMode = null;
        state.log.push('Cancelled.');
        render();
        return;
    }

    const clickedUnit = state.units.find(u => hexKey(u.q, u.r) === key);
    const clickedStruct = state.structures.find(s => hexKey(s.q, s.r) === key);

    if (state.selectedUnit) {
        const sel = state.units.find(u => u.id === state.selectedUnit);
        if (sel && hexKey(sel.q, sel.r) === key) {
            // Clicked selected unit again — deselect
            deselectUnit(state);
            hidePanel();
            render();
            return;
        }
        if (clickedUnit) {
            // Clicked another unit — select it instead
            deselectUnit(state);
            selectUnit(state, clickedUnit.id);
            showUnitPanel(clickedUnit);
            render();
            return;
        }
        if (state.reachable.has(key)) {
            const result = moveUnit(state, state.selectedUnit, q, r);
            hidePanel();
            state.visible = computeVisibility(state);
            render();
            return;
        }
        // Clicked elsewhere — deselect
        deselectUnit(state);
        hidePanel();
    }

    if (clickedUnit) {
        selectUnit(state, clickedUnit.id);
        showUnitPanel(clickedUnit);
    } else if (clickedStruct) {
        showStructurePanel(clickedStruct);
    } else {
        hidePanel();
    }
    render();
}

// Panel button handlers
document.getElementById('panel-content').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.dataset.build) {
        const unit = state.units.find(u => u.id === state.selectedUnit);
        if (unit) {
            startBuild(state, unit.id, btn.dataset.build);
            hidePanel();
            state.visible = computeVisibility(state);
            render();
        }
    }
    if (btn.dataset.recruit) {
        recruitUnit(state, btn.dataset.recruit);
        hidePanel();
        state.visible = computeVisibility(state);
        render();
    }
    if (btn.dataset.recipe) {
        assignRecipe(state, parseInt(btn.dataset.struct), btn.dataset.recipe);
        // Refresh panel
        const struct = state.structures.find(s => s.id === parseInt(btn.dataset.struct));
        if (struct) showStructurePanel(struct);
        render();
    }
    if (btn.dataset.action === 'pickup-charge') {
        const unit = state.units.find(u => u.id === state.selectedUnit);
        if (unit) {
            pickUpCharge(state, unit.id);
            showUnitPanel(unit);
            render();
        }
    }
    if (btn.dataset.action === 'deploy-charge') {
        state.log.push('Click a hex within range 3 to deploy Drift Charge.');
        state.buildMode = 'deploy-charge';
        render();
    }
});

// End Turn
document.getElementById('end-turn').addEventListener('click', () => {
    if (!state || state.gameOver || state.victory) return;
    endTurn(state);
    hidePanel();
    render();
});

window.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!state || state.gameOver || state.victory) return;
        endTurn(state);
        hidePanel();
        render();
    }
    if (e.key === 'Escape') {
        deselectUnit(state);
        hidePanel();
        render();
    }
});

// ---- Intro ----
function showIntro() {
    document.getElementById('intro').classList.remove('hidden');
}

function hideIntro() {
    document.getElementById('intro').classList.add('hidden');
}

document.getElementById('intro-begin').addEventListener('click', () => {
    hideIntro();
    initGame();
});

// ---- Init ----
function initGame() {
    const seed = Date.now();
    state = createGame(seed);
    const { q, r } = parseHexKey(state.settlement);
    hidePanel();
    resize();
    centerOn(q, r);
    render();
}

// New Game shows intro again
document.getElementById('new-game').addEventListener('click', () => {
    showIntro();
});

// Initial canvas sizing
resize();
showIntro();
