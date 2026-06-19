// index.js — PowerRange view + input. The model lives in game.js; this file renders it and
// translates clicks/keys into Game commands. Input dispatch follows the baseline layering
// (UI_CONTROLS.md): overlay → targeting (build placement) → selection → pan/hover.
// Classic script: loaded last; depends on config.js, hex.js, game.js, ai.js.

const PLAYER = FACTION.PLAYER;
const ENEMY = FACTION.ENEMY;

// ---- State ----
let game = new Game();
let selection = null;   // { unit, reachable:Map, fireable:Set, siegeable:Set }
let targeting = null;   // { archetype, validHexes:Set } — build placement
let overlay = 'intro';  // 'intro' | 'gameover' | null
let hoveredHex = null;

// ---- View ----
let panX = 0, panY = 0;
let panning = false;
let panStartX = 0, panStartY = 0, panOrigX = 0, panOrigY = 0;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
}
window.addEventListener('resize', resize);

function hexToScreen(q, r) {
    const p = new Hex(q, r).toPixel();
    return { x: p.x + panX, y: p.y + panY };
}
function screenToHex(sx, sy) {
    return Hex.fromPixel(sx - panX, sy - panY);
}
function centerOn(unit) {
    const p = new Hex(unit.q, unit.r).toPixel();
    panX = canvas.width / 2 - p.x;
    panY = canvas.height / 2 - p.y;
}

// ---- Selection ----
function selectUnit(unit) {
    targeting = null;
    selection = {
        unit,
        reachable: game.reachable(unit),
        fireable: game.fireTargets(unit),
        siegeable: game.siegeTargets(unit)
    };
}

function refreshSelection() {
    if (!selection) return;
    const u = selection.unit;
    if (!u.alive() || u.owner !== PLAYER || game.units.indexOf(u) < 0) { selection = null; return; }
    selection.reachable = game.reachable(u);
    selection.fireable = game.fireTargets(u);
    selection.siegeable = game.siegeTargets(u);
}

function deselect() { selection = null; }

// ---- Build placement (the targeting modal) ----
function enterBuild(archetypeKey) {
    if (game.factions[PLAYER].treasury < game.buildCost(PLAYER, archetypeKey)) return;
    selection = null;
    targeting = { archetype: archetypeKey, validHexes: game.buildHexes(PLAYER) };
}
function cancelTargeting() { targeting = null; }

// ---- Round resolution ----
function endPlayerTurn() {
    if (game.winner) return;
    game.endTurn(PLAYER);
    game.beginTurn(ENEMY);
    if (!game.winner) runEnemyTurn(game);
    game.endTurn(ENEMY);
    game.advanceFires();
    game.turn++;
    if (!game.winner) game.beginTurn(PLAYER);
    deselect();
    cancelTargeting();
    syncWinner();
    render();
}

function syncWinner() {
    if (game.winner) overlay = 'gameover';
}

function newGame() {
    game = new Game();
    selection = null;
    targeting = null;
    overlay = 'intro';
    centerOn(game.foundryOf(PLAYER));
    syncIntroDom();
    render();
}

// ---- Rendering ----
function onScreen(x, y) {
    return x >= -HEX_SIZE * 2 && x <= canvas.width + HEX_SIZE * 2 &&
        y >= -HEX_SIZE * 2 && y <= canvas.height + HEX_SIZE * 2;
}

function render() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const control = computeControl();   // Map<hexKey, faction> — every hex a side dominates+supplies
    drawTerrain(control);
    drawHighlights();
    drawControlOutlines(control);
    drawUnits();
    if (overlay === 'gameover') drawGameOver();
    updateHUD();
}

// Snapshot of who controls each hex right now (live as units move). controllerOf() returns null
// fast for the open map — only fire-contested hexes pay for the supply-path BFS — so this is cheap.
function computeControl() {
    const control = new Map();
    for (const [key, hex] of game.hexes) {
        const owner = game.controllerOf(hex);
        if (owner) control.set(key, owner);
    }
    return control;
}

function drawTerrain(control) {
    for (const [, hex] of game.hexes) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (!onScreen(x, y)) continue;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
        ctx.fill();
        ctx.strokeStyle = '#00000044';
        ctx.lineWidth = 1;
        ctx.stroke();
        decorateHex(hex, x, y, control);
    }
}

function decorateHex(hex, x, y, control) {
    const owner = control.get(Hex.key(hex.q, hex.r));
    if (owner) {
        // Tint marks the controlled area; the region perimeter is drawn later by drawControlOutlines.
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = CONTROL_TINT[owner];
        ctx.fill();
    }
    if (hex.terrain === TERRAIN.GOLD) glyph('$', x, y, '#5a3d00', 14);
    else if (hex.terrain === TERRAIN.QUARRY) glyph('⛏', x, y, '#3a3320', 13);
    if (hex.onFire > 0) {
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = 'rgba(255, 110, 0, 0.45)';
        ctx.fill();
        glyph('🔥', x, y, '#fff', 14);
    }
}

// Faction → control colors: a faint area tint and the region-perimeter line.
const CONTROL_TINT = { [PLAYER]: 'rgba(90, 150, 255, 0.16)', [ENEMY]: 'rgba(220, 70, 60, 0.16)' };
const CONTROL_LINE = { [PLAYER]: '#3a8dff', [ENEMY]: '#ff443a' };

// Edge e (corner e → corner e+1) of a pointy-top hex faces this NEIGHBOR_DIRS direction.
const EDGE_DIR = [0, 5, 4, 3, 2, 1];

// Trace each control region's perimeter only: for every controlled hex, stroke an edge solely
// when the hex across it has a different controller. Shared (interior) edges are skipped, so what
// remains is the outline of each blob — blue around the player's, red around the enemy's. A black
// underlay keeps the line legible over any terrain.
function drawControlOutlines(control) {
    ctx.lineCap = 'round';
    for (const [key, owner] of control) {
        const { q, r } = Hex.fromKey(key);
        const { x, y } = hexToScreen(q, r);
        if (!onScreen(x, y)) continue;
        const corners = hexCorners(x, y, HEX_SIZE);
        for (let e = 0; e < 6; e++) {
            const d = NEIGHBOR_DIRS[EDGE_DIR[e]];
            if (control.get(Hex.key(q + d.q, r + d.r)) === owner) continue;   // interior edge
            const a = corners[e], b = corners[(e + 1) % 6];
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4.5;
            ctx.stroke();
            ctx.strokeStyle = CONTROL_LINE[owner];
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }
    }
    ctx.lineCap = 'butt';
}

function glyph(text, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.font = `${size}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
}

function tintHexes(keys, color) {
    for (const key of keys) {
        const { q, r } = Hex.fromKey(key);
        const { x, y } = hexToScreen(q, r);
        if (!onScreen(x, y)) continue;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = color;
        ctx.fill();
    }
}

function drawHighlights() {
    if (targeting) {
        tintHexes(targeting.validHexes, 'rgba(80, 220, 120, 0.4)');
        return;
    }
    if (!selection) return;
    tintHexes(selection.reachable.keys(), 'rgba(255, 255, 0, 0.28)');
    tintHexes(selection.fireable, 'rgba(255, 40, 40, 0.34)');
    tintHexes(selection.siegeable, 'rgba(40, 220, 230, 0.40)');
}

function drawUnits() {
    for (const u of game.units) {
        const { x, y } = hexToScreen(u.q, u.r);
        if (!onScreen(x, y)) continue;
        drawUnit(u, x, y);
    }
    if (selection) {
        const { x, y } = hexToScreen(selection.unit.q, selection.unit.r);
        const s = COUNTER_SIZE + 6;
        roundRect(ctx, x - s / 2, y - s / 2, s, s, 6);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function drawUnit(u, cx, cy) {
    const color = FACTION_COLORS[u.owner];
    const big = u.isFoundry();
    const s = big ? COUNTER_SIZE + 6 : COUNTER_SIZE;

    drawCounter(cx, cy, color, u.label, s);

    const ink = contrastText(color);
    // Stats across the bottom of the counter: power range remaining-MP (skip the Foundry).
    if (!u.isFoundry()) {
        glyph(`${u.power} ${u.range} ${u.mpLeft}`, cx, cy + s * 0.30, ink, Math.round(s * 0.24));
    }
    // White dot at the base of the letter: this unit can still move this turn.
    if (u.owner === PLAYER && u.mpLeft > 0 && !u.disabled) {
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.07, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.75;
        ctx.stroke();
    }

    // Shield ring (cyan) drawn ON TOP of the counter. Strength is shown not by dimming but by
    // how much of the ring remains: a full shield is a closed circle; as it depletes the arc's
    // leading edge retreats counter-clockwise, opening a widening gap.
    if (u.shieldLeft > 0) {
        const frac = Math.max(0, Math.min(1, u.shieldLeft / u.shield));
        const start = -Math.PI / 2;                 // top of the counter
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.62, start, start + frac * Math.PI * 2);
        ctx.strokeStyle = 'rgba(90, 220, 235, 0.95)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';
    }

    // HP bar under the counter.
    const w = s, hpw = w * Math.max(0, u.hp / u.hpMax);
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - w / 2, cy + s / 2 + 2, w, 3);
    ctx.fillStyle = u.hp / u.hpMax > 0.4 ? '#5fbf4f' : '#cf5a3a';
    ctx.fillRect(cx - w / 2, cy + s / 2 + 2, hpw, 3);

    if (u.disabled) {
        ctx.strokeStyle = 'rgba(255,60,60,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - s / 2, cy - s / 2);
        ctx.lineTo(cx + s / 2, cy + s / 2);
        ctx.stroke();
    }
    if (u.capturingBy) {
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = FACTION_COLORS[u.capturingBy];
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
}

function contrastText(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#000' : '#fff';
}

function drawCounter(cx, cy, color, label, s) {
    const x = cx - s / 2, y = cy - s / 2, r = 4;
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
    glyph(label, cx, cy - s * 0.13, contrastText(color), Math.round(s * 0.44));
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const won = game.winner === PLAYER;
    ctx.fillStyle = won ? '#f0c14b' : '#c0392b';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(won ? 'VICTORY' : 'DEFEAT', canvas.width / 2, canvas.height / 2 - 24);
    ctx.fillStyle = '#eee';
    ctx.font = '18px monospace';
    ctx.fillText(`Turn ${game.turn} — New Game to play again`, canvas.width / 2, canvas.height / 2 + 24);
}

// ---- HUD ----
function updateHUD() {
    const fac = game.factions[PLAYER];
    document.getElementById('turn-info').textContent = 'Turn ' + game.turn;
    document.getElementById('treasury-info').textContent = 'cr ' + fac.treasury;
    const gold = countControlled(TERRAIN.GOLD, PLAYER);
    const quarry = countControlled(TERRAIN.QUARRY, PLAYER);
    const disc = Math.round(game.buildDiscount(PLAYER) * 100);
    document.getElementById('income-info').textContent =
        `+${fac.income}/t · $${gold} ⛏${quarry}` + (disc > 0 ? ` (−${disc}% build)` : '');
    document.getElementById('hover-info').textContent = hoverText();
    document.getElementById('unit-info').textContent = selection ? unitText(selection.unit) : '';
    document.getElementById('message').textContent = game.log.length ? game.log[game.log.length - 1] : '';
    updateBuildBar();
}

function countControlled(terrain, owner) {
    let n = 0;
    for (const [, h] of game.hexes) {
        if (h.terrain === terrain && game.controllerOf(h) === owner) n++;
    }
    return n;
}

function hoverText() {
    if (!hoveredHex) return '';
    const h = game.hex(hoveredHex.q, hoveredHex.r);
    if (!h) return '';
    const fire = h.onFire > 0 ? ' [burning]' : '';
    return `${TERRAIN_NAMES[h.terrain] ?? '?'} (${hoveredHex.q},${hoveredHex.r})${fire}`;
}

function unitText(u) {
    const dis = u.disabled ? ' · DISABLED' : '';
    const fired = u.hasFired ? ' · acted' : '';
    return `${u.name}  HP ${u.hp}/${u.hpMax}  Shield ${Math.round(u.shieldLeft)}/${u.shield} ${u.shieldType}` +
        `  PWR ${u.power} ${u.damage}  RNG ${u.range}  MP ${u.mpLeft}/${u.mp}${dis}${fired}`;
}

// One-line stat block for a build-menu entry: combat numbers, armor, damage type, upkeep.
function buildStats(a) {
    const shield = a.shield > 0 ? `${shortShield(a.shieldType)} ${a.shield}` : 'no shield';
    const ind = a.indirect ? ' · indirect' : '';
    return `P${a.power} R${a.range} M${a.mp} HP${a.hp} · ${shield} · ${a.damage.toLowerCase()} · up ${a.upkeep}${ind}`;
}

function shortShield(type) {
    if (type === SHIELD.PHYSICAL) return 'Phys';
    if (type === SHIELD.ENERGY) return 'Energy';
    if (type === SHIELD.PHASE) return 'Phase';
    return 'None';
}

// Two independent header controls for the build panel: one flips its dock side (left/right),
// one flips its visibility (collapse/expand). Each button's glyph + tooltip previews the NEXT
// click, so the controls are self-describing.
function wirePanelToggle() {
    const panel = document.getElementById('build-panel');
    bindPanelButton('build-side', () => panel.classList.toggle('left'),
        nowLeft => nowLeft ? ['→', 'Move build panel right'] : ['←', 'Move build panel left']);
    bindPanelButton('build-collapse', () => panel.classList.toggle('collapsed'),
        nowCollapsed => nowCollapsed ? ['+', 'Expand build panel'] : ['–', 'Collapse build panel']);
}

// Wire one toggle button: `act` flips the class and returns its new on/off state; `preview`
// maps that state to the [glyph, title] for the NEXT click. Sets the resting label too.
function bindPanelButton(id, act, preview) {
    const btn = document.getElementById(id);
    btn.addEventListener('click', () => {
        const [glyph, title] = preview(act());
        btn.innerHTML = glyph;
        btn.title = title;
    });
}

let buildButtons = null;
function buildBar() {
    const list = document.getElementById('build-list');
    list.innerHTML = '';
    buildButtons = BUILD_MENU.map(key => {
        const a = ARCHETYPES[key];
        const btn = document.createElement('button');
        btn.dataset.key = key;
        btn.innerHTML = `<span class="name">${a.label} ${a.name}</span>` +
            `<span class="cost"></span><span class="stats">${buildStats(a)}</span>`;
        btn.addEventListener('click', () => { enterBuild(key); render(); });
        list.appendChild(btn);
        return btn;
    });
    wirePanelToggle();
}

function updateBuildBar() {
    if (!buildButtons) return;
    const treasury = game.factions[PLAYER].treasury;
    for (const btn of buildButtons) {
        const key = btn.dataset.key;
        const cost = game.buildCost(PLAYER, key);
        btn.querySelector('.cost').textContent = 'cr ' + cost;
        btn.disabled = treasury < cost;
        btn.classList.toggle('active', targeting?.archetype === key);
    }
}

function syncIntroDom() {
    document.getElementById('intro-panel').classList.toggle('hidden', overlay !== 'intro');
}

// ---- Input ----
canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
        if (targeting) { cancelTargeting(); render(); return; }
        panning = true;
        panStartX = e.clientX; panStartY = e.clientY;
        panOrigX = panX; panOrigY = panY;
        e.preventDefault();
        return;
    }
    if (e.button !== 0) return;

    if (overlay === 'intro') { dismissIntro(); return; }
    if (overlay === 'gameover') return;

    const hex = screenToHex(e.clientX, e.clientY);
    const key = Hex.key(hex.q, hex.r);

    if (targeting) {
        if (targeting.validHexes.has(key)) game.build(PLAYER, targeting.archetype, hex.q, hex.r);
        cancelTargeting();
        render();
        return;
    }

    handleBoardClick(hex, key);
    render();
});

function handleBoardClick(hex, key) {
    const clicked = game.unitAt(hex.q, hex.r);
    if (!selection) {
        if (clicked && clicked.owner === PLAYER) selectUnit(clicked);
        return;
    }
    if (clicked === selection.unit) { deselect(); return; }
    if (selection.reachable.has(key)) { game.move(selection.unit, hex.q, hex.r); refreshSelection(); return; }
    if (selection.siegeable.has(key)) { game.siege(selection.unit, hex.q, hex.r); afterAction(); return; }
    if (selection.fireable.has(key)) { game.fire(selection.unit, hex.q, hex.r); afterAction(); return; }
    if (clicked && clicked.owner === PLAYER) { selectUnit(clicked); return; }
    deselect();
}

function afterAction() {
    refreshSelection();
    syncWinner();
}

canvas.addEventListener('mousemove', e => {
    if (panning) {
        panX = panOrigX + (e.clientX - panStartX);
        panY = panOrigY + (e.clientY - panStartY);
        render();
        return;
    }
    const hex = screenToHex(e.clientX, e.clientY);
    const next = game.hexes.has(Hex.key(hex.q, hex.r)) ? { q: hex.q, r: hex.r } : null;
    if (next?.q !== hoveredHex?.q || next?.r !== hoveredHex?.r) {
        hoveredHex = next;
        updateHUD();
    }
});

canvas.addEventListener('mouseup', e => { if (e.button === 2) panning = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('end-turn').addEventListener('click', () => endPlayerTurn());
document.getElementById('new-game').addEventListener('click', newGame);
document.getElementById('begin-btn').addEventListener('click', dismissIntro);

function dismissIntro() {
    overlay = null;
    syncIntroDom();
    render();
}

window.addEventListener('keydown', e => {
    if (overlay === 'intro' && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        dismissIntro();
        return;
    }
    if (overlay === 'gameover') return;
    if (e.key === 'Escape') {
        if (targeting) cancelTargeting();
        else deselect();
        render();
        return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        endPlayerTurn();
    }
});

// ---- Start ----
buildBar();
centerOn(game.foundryOf(PLAYER));
syncIntroDom();
resize();
