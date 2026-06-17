// index.js — Signal City
//
// Solo hex-and-counters superhero game. Triage Crises across a 6-District
// city while a hidden Mastermind's Doom Clock ticks toward zero.

import {
    HEX_SIZE, MAP_RADIUS, DISTRICT, MOVE_COST,
    CRISIS, CRISIS_GLYPH, CRISIS_WEIGHTS,
    POWERS, HERO_NAMES, LIEUTENANT_NAMES,
    HERO_COUNT, HERO_MP, HERO_HP, LIEUTENANT_HP,
    DOOM_MAX, DOOM_PROMOTE_EVERY, FALLEN_LIMIT,
    SPAWN_PER_TURN_MIN, SPAWN_PER_TURN_MAX,
    MASTERMIND_TIER_NAMES
} from './config.js';
import { hexToPixel, pixelToHex, hexKey, hexNeighbors, hexDistance, drawHexPath, bfsHexes } from './hex.js';
import { Rando } from './rando.js';
import { ColorTheory } from './colortheory.js';
import { generateMap } from './terrain.js';

// ============================================================
// State
// ============================================================

const state = {
    hexes: null,
    districts: null,
    heroes: [],
    lieutenants: [],
    mastermind: null,
    doom: 0,
    turn: 1,
    fallen: 0,
    selected: null,           // selected hero or null
    reachable: null,          // Map<hexKey, cost> for selected hero
    palette: null,            // city color palette (5 RGB triples)
    heroColors: [],           // hex strings, one per hero
    crisisFlashes: [],        // {hex, frames} for resolved-this-turn animation
    knownClearDistricts: new Set(),  // district IDs ruled out
    gameOver: null,           // null | 'win' | 'lose:doom' | 'lose:fallen' | 'lose:ko'
    nextCrisisId: 1
};

const view = { panX: 0, panY: 0, panning: false, panStartX: 0, panStartY: 0, panOrigX: 0, panOrigY: 0 };

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ============================================================
// Setup
// ============================================================

function rollHeroes() {
    const powerPool = [...POWERS];
    Rando.shuffle(powerPool);
    const namePool = [...HERO_NAMES];
    Rando.shuffle(namePool);

    const heroes = [];
    const districtIds = state.districts.map(d => d.id);
    for (let i = 0; i < HERO_COUNT; i++) {
        const power = powerPool[i];
        const name = namePool[i];
        const homeDistrictId = Rando.choice(districtIds);
        const homeHex = pickSpawnHex(homeDistrictId);
        heroes.push({
            id: i,
            name,
            power,
            homeDistrictId,
            q: homeHex.q,
            r: homeHex.r,
            hp: HERO_HP,
            mp: HERO_MP,
            poweredOut: false,
            oneShotUsed: false
        });
    }
    return heroes;
}

function pickSpawnHex(districtId) {
    const candidates = [];
    for (const hex of state.hexes.values()) {
        if (hex.districtId !== districtId) continue;
        if (hex.isEdge) continue;
        candidates.push(hex);
    }
    if (candidates.length === 0) {
        // Fallback: any inner hex
        for (const hex of state.hexes.values()) if (!hex.isEdge) candidates.push(hex);
    }
    return Rando.choice(candidates);
}

function rollLieutenants() {
    const districtIds = state.districts.map(d => d.id);
    Rando.shuffle(districtIds);
    return LIEUTENANT_NAMES.map((name, i) => {
        const hidesId = districtIds[i % districtIds.length];
        const spawn = pickSpawnHex(hidesId);
        return {
            id: i,
            name,
            q: spawn.q,
            r: spawn.r,
            hp: LIEUTENANT_HP,
            alive: true,
            hidesDistrictId: hidesId
        };
    });
}

function rollMastermind() {
    // Mastermind hides under one of the 3 lieutenant-protected districts
    const protectedIds = state.lieutenants.map(l => l.hidesDistrictId);
    const districtId = Rando.choice(protectedIds);
    const district = state.districts.find(d => d.id === districtId);
    const hex = Rando.choice(district.hexes.filter(h => !h.isEdge));
    return {
        q: hex.q,
        r: hex.r,
        districtId,
        revealed: false,
        tier: 0
    };
}

function rollPalette() {
    const palette = ColorTheory.randomScheme(() => Math.random());
    state.palette = palette;
    // Hero counters use a complementary scheme so they pop against terrain
    const compRadial = { a: Math.random(), r: 0.4 };
    const heroPalette = ColorTheory.SchemeGenerators.complementary(compRadial, () => Math.random());
    state.heroColors = state.heroes.map((_, i) => {
        const [r, g, b] = heroPalette[i % heroPalette.length];
        return ColorTheory.rgbToHex(r, g, b);
    });
}

function newGame() {
    const map = generateMap();
    state.hexes = map.hexes;
    state.districts = map.districts;
    state.doom = 0;
    state.turn = 1;
    state.fallen = 0;
    state.selected = null;
    state.reachable = null;
    state.crisisFlashes = [];
    state.knownClearDistricts = new Set();
    state.gameOver = null;
    state.nextCrisisId = 1;
    state.heroes = rollHeroes();
    state.lieutenants = rollLieutenants();
    state.mastermind = rollMastermind();
    rollPalette();
    seedInitialCrises();
    centerOn({ q: 0, r: 0 });
    resize();
    showIntro();
}

// ============================================================
// Crisis spawning
// ============================================================

function freeHexes() {
    const occupied = new Set();
    for (const h of state.heroes) occupied.add(hexKey(h.q, h.r));
    for (const l of state.lieutenants) if (l.alive) occupied.add(hexKey(l.q, l.r));

    const free = [];
    for (const hex of state.hexes.values()) {
        if (hex.isEdge) continue;
        if (hex.ruined) continue;
        if (hex.crisis) continue;
        if (occupied.has(hexKey(hex.q, hex.r))) continue;
        free.push(hex);
    }
    return free;
}

function spawnCrisis(hex) {
    const weighted = CRISIS_WEIGHTS[hex.district];
    const category = Rando.weighted(weighted);
    const difficulty = Rando.int(1, 3);
    hex.crisis = { id: state.nextCrisisId++, category, difficulty };
}

function seedInitialCrises() {
    const free = freeHexes();
    Rando.shuffle(free);
    for (let i = 0; i < 5 && i < free.length; i++) spawnCrisis(free[i]);
}

function signalPhase() {
    const count = Rando.int(SPAWN_PER_TURN_MIN, SPAWN_PER_TURN_MAX);
    const free = freeHexes();
    Rando.shuffle(free);
    for (let i = 0; i < count && i < free.length; i++) spawnCrisis(free[i]);
}

// ============================================================
// Movement & resolution
// ============================================================

function isFlyer(hero) { return hero.power.rule === 'flyer'; }

function isPassableForHero(hero, hex) {
    if (!hex) return false;
    if (hex.isEdge) return false;
    if (hex.ruined) return hero.power.rule === 'ignoreDowntownCost'; // Intangibility
    return true;
}

function moveCostForHero(hero, hex) {
    if (!isPassableForHero(hero, hex)) return Infinity;
    if (hex.district === DISTRICT.SKYWAY) return isFlyer(hero) ? 0 : Infinity;
    if (hex.district === DISTRICT.DOWNTOWN) {
        if (isFlyer(hero) || hero.power.rule === 'ignoreDowntownCost') return 1;
    }
    return MOVE_COST[hex.district];
}

function computeReachable(hero) {
    if (hero.mp <= 0) return new Map();
    // Block other heroes' hexes (but allow lieutenant hexes for shrink)
    const blocked = new Set();
    for (const h of state.heroes) {
        if (h.id !== hero.id) blocked.add(hexKey(h.q, h.r));
    }
    const result = bfsHexes(
        { q: hero.q, r: hero.r },
        state.hexes,
        hex => {
            const key = hexKey(hex.q, hex.r);
            if (blocked.has(key)) return Infinity;
            // Lieutenants: shrink moves through free; others must "attack" — not via BFS
            const lt = lieutenantAt(hex.q, hex.r);
            if (lt) {
                if (hero.power.rule === 'lieutenantHexFree') return 0;
                return Infinity;
            }
            return moveCostForHero(hero, hex);
        },
        hero.mp
    );
    result.delete(hexKey(hero.q, hero.r));
    return result;
}

function lieutenantAt(q, r) {
    return state.lieutenants.find(l => l.alive && l.q === q && l.r === r) || null;
}

function heroAt(q, r) {
    return state.heroes.find(h => h.q === q && h.r === r) || null;
}

// ---- Resolving crises ----

function autoResolveOnEntry(hero, hex) {
    // Resolver-template powers fire on entry if matched.
    if (hero.poweredOut) return false;
    const p = hero.power;
    if (p.template !== 'resolver') return false;
    const c = hex.crisis;
    if (!c) return false;
    if (p.matches !== c.category) return false;
    if (p.district && hex.district !== p.district) return false;
    hex.crisis = null;
    flashCrisis(hex);
    if (p.sideEffect === 'doom+1') tickDoom(1, hex);
    return true;
}

function tryReachResolve(hero) {
    // Stretch (reach=2): after move, resolve any crisis within reach.
    if (hero.poweredOut) return;
    if (hero.power.rule !== 'reachRadius') return;
    const radius = hero.power.value;
    for (const hex of state.hexes.values()) {
        if (!hex.crisis) continue;
        if (hexDistance(hero.q, hero.r, hex.q, hex.r) > radius) continue;
        // Stretch resolves one nearby crisis per move (free)
        hex.crisis = null;
        flashCrisis(hex);
        return;
    }
}

function manualResolveAt(hex) {
    // Stepping ON a crisis hex resolves it for free (movement cost was paid).
    if (!hex.crisis) return;
    hex.crisis = null;
    flashCrisis(hex);
}

function flashCrisis(hex) {
    state.crisisFlashes.push({ q: hex.q, r: hex.r, frames: 18 });
}

// ---- Lieutenant combat ----

function attackLieutenant(hero, lt) {
    // Shrink: free entry. Others: costs 1 MP.
    const cost = hero.power.rule === 'lieutenantHexFree' ? 0 : 1;
    if (hero.mp < cost) return false;
    hero.mp -= cost;
    lt.hp -= 1;
    if (lt.hp <= 0) {
        lt.alive = false;
        // Killing a Lieutenant rules out their hidden district
        if (lt.hidesDistrictId !== state.mastermind.districtId) {
            state.knownClearDistricts.add(lt.hidesDistrictId);
        } else {
            // Bonus: also rules out (we just confirmed it). Reveal it!
            state.mastermind.revealed = true;
        }
        // If only one lieutenant-protected district remains, reveal mastermind
        const remaining = state.lieutenants
            .filter(l => l.alive)
            .map(l => l.hidesDistrictId);
        const candidates = new Set(remaining);
        if (candidates.size === 1) state.mastermind.revealed = true;
    }
    return true;
}

// ============================================================
// Doom & turn flow
// ============================================================

function tickDoom(amount, sourceHex) {
    state.doom = Math.min(DOOM_MAX, state.doom + amount);
    promoteMastermind();
    if (state.doom >= DOOM_MAX) state.gameOver = 'lose:doom';
    if (sourceHex) {
        // Possible district fall: 1-in-difficulty crises that tick fully cause a hex ruin
        if (Rando.bool(0.3)) ruinHex(sourceHex);
    }
}

function promoteMastermind() {
    const newTier = Math.min(MASTERMIND_TIER_NAMES.length - 1,
        Math.floor(state.doom / DOOM_PROMOTE_EVERY));
    state.mastermind.tier = newTier;
}

function ruinHex(hex) {
    if (hex.ruined) return;
    hex.ruined = true;
    hex.crisis = null;
    // KO any hero standing here (couldn't get out in time)
    const h = heroAt(hex.q, hex.r);
    if (h) koHero(h);
    // Falling enough hexes in a district = District falls
    const district = state.districts[hex.districtId];
    const ruinedCount = district.hexes.filter(x => x.ruined).length;
    if (!district.fallen && ruinedCount >= Math.ceil(district.hexes.length / 2)) {
        district.fallen = true;
        state.fallen += 1;
        // Heroes whose home is this district lose their power
        for (const hero of state.heroes) {
            if (hero.homeDistrictId === district.id) hero.poweredOut = true;
        }
        if (state.fallen >= FALLEN_LIMIT) state.gameOver = 'lose:fallen';
    }
}

function koHero(hero) {
    hero.hp = 0;
    // Move them off the board
    hero.q = -999;
    hero.r = -999;
    hero.mp = 0;
    if (state.heroes.every(h => h.hp <= 0)) state.gameOver = 'lose:ko';
}

function endTurn() {
    if (state.gameOver) return;

    // 1. Resolve unresolved Crises -> Doom ticks (with adjacent-hero relief)
    const adjacentReliefByCrisis = new Map();
    for (const hex of state.hexes.values()) {
        if (!hex.crisis) continue;
        let relief = 0;
        for (const h of state.heroes) {
            if (h.hp <= 0) continue;
            if (hexDistance(h.q, h.r, hex.q, hex.r) === 1) relief += 1;
        }
        adjacentReliefByCrisis.set(hex, relief);
    }
    for (const [hex, relief] of adjacentReliefByCrisis) {
        const tick = Math.max(0, hex.crisis.difficulty - relief);
        if (tick > 0) tickDoom(tick, hex);
        if (state.gameOver) break;
    }
    if (state.gameOver) { render(); return; }

    // 2. Lieutenant patrol — random walk toward nearest crisis
    moveLieutenants();

    // 3. Signal phase — spawn new crises
    signalPhase();

    // 4. Mastermind win check (player must satisfy on player turn — checked in render)
    state.turn += 1;
    for (const h of state.heroes) {
        if (h.hp > 0) h.mp = HERO_MP;
    }
    state.selected = null;
    state.reachable = null;
    render();
}

function moveLieutenants() {
    for (const lt of state.lieutenants) {
        if (!lt.alive) continue;
        // Find nearest crisis
        let target = null, bestDist = Infinity;
        for (const hex of state.hexes.values()) {
            if (!hex.crisis) continue;
            const d = hexDistance(lt.q, lt.r, hex.q, hex.r);
            if (d < bestDist) { bestDist = d; target = hex; }
        }
        if (!target) continue;
        // Step one hex toward target — pick neighbor that minimizes distance
        const opts = hexNeighbors(lt.q, lt.r)
            .map(n => ({ n, hex: state.hexes.get(hexKey(n.q, n.r)) }))
            .filter(o => o.hex && !o.hex.isEdge && !o.hex.ruined && !heroAt(o.n.q, o.n.r) && !lieutenantAt(o.n.q, o.n.r));
        if (opts.length === 0) continue;
        opts.sort((a, b) =>
            hexDistance(a.n.q, a.n.r, target.q, target.r) -
            hexDistance(b.n.q, b.n.r, target.q, target.r));
        const dest = opts[0].n;
        lt.q = dest.q;
        lt.r = dest.r;
    }
}

function checkMastermindWin() {
    if (!state.mastermind.revealed) return;
    const adjacent = state.heroes.filter(h =>
        h.hp > 0 && hexDistance(h.q, h.r, state.mastermind.q, state.mastermind.r) <= 1).length;
    const required = state.mastermind.tier + 1;
    if (adjacent >= required) state.gameOver = 'win';
}

// ============================================================
// Input
// ============================================================

function selectHero(hero) {
    state.selected = hero;
    state.reachable = computeReachable(hero);
    render();
}

function deselect() {
    state.selected = null;
    state.reachable = null;
    render();
}

function tryAttackOrMove(hero, q, r) {
    const hex = state.hexes.get(hexKey(q, r));
    if (!hex) return;

    // Lieutenant attack: must be reachable (BFS treats LT hex as 0 cost only for shrink),
    // or adjacent (1 MP) for everyone else.
    const lt = lieutenantAt(q, r);
    if (lt) {
        const isAdjacent = hexDistance(hero.q, hero.r, q, r) === 1;
        if (!isAdjacent && hero.power.rule !== 'lieutenantHexFree') return;
        const ok = attackLieutenant(hero, lt);
        if (!ok) return;
        if (lt.alive === false && hero.power.rule === 'lieutenantHexFree') {
            hero.q = q; hero.r = r;
        }
        state.reachable = computeReachable(hero);
        render();
        return;
    }

    // Movement
    const cost = state.reachable ? state.reachable.get(hexKey(q, r)) : undefined;
    if (cost === undefined) return;

    hero.q = q;
    hero.r = r;
    hero.mp -= cost;

    // Telepathy peek
    if (hero.power.rule === 'mindPeek' && !hero.poweredOut) {
        if (state.mastermind.districtId === hex.districtId) {
            state.mastermind.revealed = true;
        } else {
            state.knownClearDistricts.add(hex.districtId);
        }
    }

    // Resolution effects
    autoResolveOnEntry(hero, hex);
    manualResolveAt(hex);
    tryReachResolve(hero);
    checkMastermindWin();
    if (state.gameOver) { render(); return; }

    state.reachable = computeReachable(hero);
    render();
}

canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
        view.panning = true;
        view.panStartX = e.clientX;
        view.panStartY = e.clientY;
        view.panOrigX = view.panX;
        view.panOrigY = view.panY;
        e.preventDefault();
        return;
    }
    if (e.button !== 0 || state.gameOver) return;

    const hex = screenToHex(e.clientX, e.clientY);
    const clickedHero = heroAt(hex.q, hex.r);

    if (state.selected) {
        if (clickedHero && clickedHero.id === state.selected.id) {
            deselect();
            return;
        }
        if (clickedHero && clickedHero.hp > 0) {
            selectHero(clickedHero);
            return;
        }
        tryAttackOrMove(state.selected, hex.q, hex.r);
        return;
    }
    if (clickedHero && clickedHero.hp > 0) selectHero(clickedHero);
});

canvas.addEventListener('mousemove', e => {
    if (view.panning) {
        view.panX = view.panOrigX + (e.clientX - view.panStartX);
        view.panY = view.panOrigY + (e.clientY - view.panStartY);
        render();
    }
});

canvas.addEventListener('mouseup', e => { if (e.button === 2) view.panning = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('end-turn').addEventListener('click', endTurn);
window.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); endTurn(); }
    if (e.key === 'Escape') deselect();
});
document.getElementById('new-game').addEventListener('click', newGame);
document.getElementById('begin-btn').addEventListener('click', hideIntro);

window.addEventListener('resize', resize);

// ============================================================
// View / coordinates
// ============================================================

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
}

function hexToScreen(q, r) {
    const p = hexToPixel(q, r);
    return { x: p.x + view.panX, y: p.y + view.panY };
}

function screenToHex(sx, sy) {
    return pixelToHex(sx - view.panX, sy - view.panY);
}

function centerOn(hex) {
    const p = hexToPixel(hex.q, hex.r);
    view.panX = canvas.width / 2 - p.x;
    view.panY = canvas.height / 2 - p.y;
}

// ============================================================
// Rendering
// ============================================================

const DOOM_GRADIENT = ColorTheory.gradient([
    [0.2, 0.5, 0.8],
    [0.9, 0.7, 0.2],
    [0.9, 0.1, 0.05]
]);

function districtColor(districtType, fallen) {
    // Assign each district type a slot in the city palette by fixed ordering.
    const order = ['underground', 'harbor', 'industrial', 'downtown', 'park', 'skyway'];
    const slot = order.indexOf(districtType) % state.palette.length;
    const [r, g, b] = state.palette[slot];
    if (fallen) return ColorTheory.rgbToHex(r * 0.4, g * 0.4, b * 0.4);
    return ColorTheory.rgbToHex(r, g, b);
}

function render() {
    if (!state.hexes) return;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawHexes();
    drawCrises();
    drawLieutenants();
    drawMastermindMarker();
    drawHeroes();
    drawSelectionUI();
    drawCrisisFlashes();

    updateHUD();
    drawDoomBar();

    if (state.gameOver) drawGameOver();
}

function drawHexes() {
    for (const hex of state.hexes.values()) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2) continue;
        if (y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;

        drawHexPath(ctx, x, y, HEX_SIZE);
        if (hex.isEdge) {
            ctx.fillStyle = '#0a0a12';
        } else if (hex.ruined) {
            ctx.fillStyle = '#1a1015';
        } else {
            ctx.fillStyle = districtColor(hex.district, state.districts[hex.districtId].fallen);
        }
        ctx.fill();
        ctx.strokeStyle = '#00000066';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Cleared-district X marker
        if (state.knownClearDistricts.has(hex.districtId) && !hex.isEdge && !hex.ruined && !hex.crisis) {
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4);
            ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4);
            ctx.stroke();
        }
    }
}

function drawCrises() {
    for (const hex of state.hexes.values()) {
        if (!hex.crisis) continue;
        const { x, y } = hexToScreen(hex.q, hex.r);
        const c = hex.crisis;

        // Threat halo by difficulty
        ctx.beginPath();
        ctx.arc(x, y, HEX_SIZE * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 50, 30, ${0.08 * c.difficulty})`;
        ctx.fill();

        // Glyph + difficulty pip
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(CRISIS_GLYPH[c.category], x, y - 4);
        ctx.font = 'bold 11px monospace';
        ctx.fillText('\u25CF'.repeat(c.difficulty), x, y + 11);
    }
}

function drawLieutenants() {
    for (const lt of state.lieutenants) {
        if (!lt.alive) continue;
        const { x, y } = hexToScreen(lt.q, lt.r);
        drawCounter(x, y, '#1a1a1a', '#ff6688', lt.name[0]);
        // HP pips
        ctx.fillStyle = '#ff6688';
        for (let i = 0; i < lt.hp; i++) {
            ctx.fillRect(x - 9 + i * 6, y + 14, 4, 2);
        }
    }
}

function drawMastermindMarker() {
    if (!state.mastermind.revealed) return;
    const { x, y } = hexToScreen(state.mastermind.q, state.mastermind.r);
    ctx.strokeStyle = '#ff00aa';
    ctx.lineWidth = 3;
    drawHexPath(ctx, x, y, HEX_SIZE - 2);
    ctx.stroke();
    ctx.fillStyle = '#ff00aa';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2620', x, y);
}

function drawHeroes() {
    for (const hero of state.heroes) {
        if (hero.hp <= 0) continue;
        const { x, y } = hexToScreen(hero.q, hero.r);
        const color = state.heroColors[hero.id];
        const label = hero.name[0];
        drawCounter(x, y, color, '#fff', label);
        // MP pips
        ctx.fillStyle = '#fff';
        for (let i = 0; i < hero.mp; i++) {
            ctx.fillRect(x - 9 + i * 6, y - 18, 4, 3);
        }
        if (hero.poweredOut) {
            ctx.strokeStyle = '#666';
            ctx.beginPath();
            ctx.moveTo(x - 12, y + 12);
            ctx.lineTo(x + 12, y - 12);
            ctx.stroke();
        }
    }
}

function drawSelectionUI() {
    if (!state.selected || !state.reachable) return;
    for (const [key] of state.reachable) {
        const [q, r] = key.split(',').map(Number);
        const { x, y } = hexToScreen(q, r);
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = 'rgba(255, 230, 80, 0.25)';
        ctx.fill();
    }
    // Outline selected hero
    const h = state.selected;
    const { x, y } = hexToScreen(h.q, h.r);
    drawHexPath(ctx, x, y, HEX_SIZE);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawCrisisFlashes() {
    const remaining = [];
    for (const f of state.crisisFlashes) {
        const { x, y } = hexToScreen(f.q, f.r);
        const a = f.frames / 18;
        ctx.beginPath();
        ctx.arc(x, y, HEX_SIZE * (1.2 - a), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 200, ${a})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        f.frames -= 1;
        if (f.frames > 0) remaining.push(f);
    }
    state.crisisFlashes = remaining;
    if (remaining.length > 0) requestAnimationFrame(render);
}

function drawCounter(cx, cy, fillColor, labelColor, label) {
    const s = 28;
    const r = 5;
    const x = cx - s / 2, y = cy - s / 2;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, x + 2, y + 2, s, s, r);
    ctx.fill();

    // Body
    roundRect(ctx, x, y, s, s, r);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = labelColor;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
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

function drawDoomBar() {
    const w = 240, h = 18, x = canvas.width - w - 20, y = 20;
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, h);
    for (let i = 0; i < DOOM_MAX; i++) {
        const t = i / (DOOM_MAX - 1);
        const filled = i < state.doom;
        const c = DOOM_GRADIENT(t);
        ctx.fillStyle = filled
            ? ColorTheory.rgbToHex(c.r, c.g, c.b)
            : '#333';
        const cellW = w / DOOM_MAX;
        ctx.fillRect(x + i * cellW + 1, y + 1, cellW - 2, h - 2);
    }
    ctx.strokeStyle = '#666';
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`DOOM ${state.doom}/${DOOM_MAX}`, x + w, y - 4);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = canvas.width / 2, cy = canvas.height / 2;
    if (state.gameOver === 'win') {
        ctx.fillStyle = '#ffeb88';
        ctx.fillText('THE CITY HOLDS', cx, cy - 30);
        ctx.font = '18px monospace';
        ctx.fillText(`Mastermind defeated on turn ${state.turn}`, cx, cy + 20);
    } else {
        ctx.fillStyle = '#ff6688';
        ctx.fillText('THE CITY FALLS', cx, cy - 30);
        ctx.font = '18px monospace';
        const reason = {
            'lose:doom':    'Doom Clock reached zero',
            'lose:fallen':  `${FALLEN_LIMIT} Districts fell`,
            'lose:ko':      'All heroes are down'
        }[state.gameOver];
        ctx.fillText(reason, cx, cy + 20);
    }
}

// ============================================================
// HUD
// ============================================================

function updateHUD() {
    document.getElementById('turn-info').textContent = `Turn ${state.turn}`;
    const mm = state.mastermind;
    document.getElementById('mastermind-info').textContent =
        mm.revealed
            ? `Mastermind: REVEALED \u2014 ${MASTERMIND_TIER_NAMES[mm.tier]} (need ${mm.tier + 1} adj)`
            : `Mastermind: hidden \u2014 ${MASTERMIND_TIER_NAMES[mm.tier]}`;
    document.getElementById('fallen-info').textContent = `Fallen ${state.fallen}/${FALLEN_LIMIT}`;

    const roster = document.getElementById('roster');
    roster.innerHTML = '';
    for (const hero of state.heroes) {
        const row = document.createElement('div');
        row.className = 'hero-row' + (hero.hp <= 0 ? ' ko' : '') + (state.selected === hero ? ' sel' : '');
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.background = state.heroColors[hero.id];
        const label = document.createElement('span');
        const home = state.districts[hero.homeDistrictId];
        const powerName = hero.poweredOut ? `${hero.power.name} (LOST)` : hero.power.name;
        label.textContent = `${hero.name} \u2014 ${powerName} \u2014 ${home.name} \u2014 MP ${hero.mp}/${HERO_MP}`;
        row.appendChild(swatch);
        row.appendChild(label);
        row.addEventListener('click', () => {
            if (hero.hp > 0) selectHero(hero);
        });
        roster.appendChild(row);
    }

    const sel = document.getElementById('selected-info');
    if (state.selected) {
        sel.textContent = `${state.selected.name}: ${state.selected.power.blurb}`;
    } else {
        sel.textContent = 'Click a hero to select.';
    }
}

function showIntro() {
    document.getElementById('intro-panel').classList.remove('hidden');
}

function hideIntro() {
    document.getElementById('intro-panel').classList.add('hidden');
}

// ============================================================
// Boot
// ============================================================

newGame();
