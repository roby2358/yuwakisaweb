// index.js — Healer. The player is the medic of an AI-driven party (see DYNAMICS.md).
//
// This file owns mutable game state, the animated phased turn loop, rendering, and input.
// The rules engine lives in mechanics.js, the movement primitive in ai.js, and all content
// (party/enemy classes, skills) in content.js. Comments cite the UI control layers
// (L1.x …) the input model implements; see UI_CONTROLS.md.

// No ES modules — every script is a plain <script> include so index.html runs from a
// double-click (file://). The globals below come from the earlier-loaded scripts, in
// load order: config.js, rando.js, colortheory.js, hex.js, content.js, mechanics.js,
// ai.js. Keep that order in index.html when adding files.

// ---- Game state ----
let hexes = null;
let healer = null;
let party = [];
let enemies = [];
let homeHex = null;
let treasureHex = null;
let objectiveHex = null;          // where the party is currently headed (treasure → home)
let treasureCollected = false;
let turn = 1;
let reputation = 0;
let nextId = 1;

let partyScheme = null;           // ColorTheory palettes for counter colors
let enemyScheme = null;
let enemyColorIdx = 0;

// ---- Input-layer state (see UI_CONTROLS.md) ----
let phase = 'player';             // L1.1 'player' | 'party' | 'enemy'; map input is live only on 'player'
let resolving = false;            // true while the animated party/enemy phases run
let selection = null;             // L1.2 { reachable: Map<key,cost> } for healer movement, or null
let targeting = null;             // L4 { skill, validKeys: Set<key> } while aiming a skill, or null
let activeSkill = null;           // the skill whose targeting is active
let overlay = null;               // L5 'intro' | 'victory' | 'defeat' | null
let endMessage = '';              // subtitle for the victory/defeat overlay
let hoveredHex = null;
let combatFlash = null;           // transient { q, r } marking a hit, for the enemy phase

let spellSide = 'left';           // which screen edge the spell panel docks to: 'left' | 'right'

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

// ---- Terrain passability (single source of truth) ----
function moveCost(hex) {
    return MOVEMENT_COST[hex.terrain] ?? Infinity;
}

function isPassable(hex) {
    return moveCost(hex) !== Infinity;
}

function passableHexes() {
    const out = [];
    for (const [, hex] of hexes) {
        if (hex.isEdge) continue;
        if (!isPassable(hex)) continue;
        out.push(hex);
    }
    return out;
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
    const grid = new Map();
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
            grid.set(Hex.key(q, r), { q, r, col, row, elevation, isEdge, terrain: null });
        }
    }
    return grid;
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
    const forestCount = Math.round(n * 0.10);
    const goldCount = Math.max(3, Math.round(n * 0.01));
    let idx = 0;
    for (let i = 0; i < forestCount && idx < plains.length; i++, idx++)
        plains[idx].terrain = TERRAIN.FOREST;
    for (let i = 0; i < goldCount && idx < plains.length; i++, idx++)
        plains[idx].terrain = TERRAIN.GOLD;

    const hills = inner.filter(h => h.terrain === TERRAIN.HILLS);
    Rando.shuffle(hills);
    const quarryCount = Math.max(2, Math.round(n * 0.02));
    for (let i = 0; i < quarryCount && i < hills.length; i++)
        hills[i].terrain = TERRAIN.QUARRY;
}

// Home on the left, treasure on the right — a real journey out and back (DYNAMICS:
// "Home Bases Give the Map Emotional Weight").
function placeLandmarks() {
    const passable = passableHexes();
    passable.sort((a, b) => a.col - b.col);
    const slice = Math.max(5, Math.floor(passable.length * 0.03));
    const home = Rando.choice(passable.slice(0, slice));
    const treasure = Rando.choice(passable.slice(-slice));
    homeHex = { q: home.q, r: home.r };
    treasureHex = { q: treasure.q, r: treasure.r };
}

function hasPath(from, to) {
    if (!from || !to) return false;
    const costs = bfsHexes(from, hexes, moveCost, Infinity);
    return costs.has(Hex.key(to.q, to.r));
}

// ---- Unit factories ----
function makeHealer(q, r) {
    const cooldowns = {};
    for (const s of SKILLS) cooldowns[s.id] = 0;
    return {
        id: nextId++, kind: 'healer', cls: 'healer', name: 'Healer', label: 'H', color: PLAYER_COLOR,
        q, r, hp: HEALER_MAX_HP, maxHp: HEALER_MAX_HP, armor: 0, damage: 0, attackRange: 0,
        statuses: [], alive: true, gone: false,
        mp: PLAYER_MP, aether: HEALER_MAX_AETHER, maxAether: HEALER_MAX_AETHER,
        aetherRegen: AETHER_REGEN, cooldowns
    };
}

function makePartyMember(def, q, r, color) {
    return {
        id: nextId++, kind: 'party', cls: def.cls, name: def.name, role: def.role, label: def.label,
        color, q, r, hp: def.maxHp, maxHp: def.maxHp, armor: def.armor, damage: def.damage,
        attackRange: def.attackRange, statuses: [], alive: true, downedTurns: 0, gone: false
    };
}

function rollSpeed() {
    const roll = Rando.int(1, 6);
    return roll <= 3 ? 2 : roll <= 5 ? 3 : 4;   // most slow, some fast, rare very fast
}

function makeEnemy(def, tier, q, r) {
    const color = ColorTheory.rgbToHex(...enemyScheme[enemyColorIdx++ % enemyScheme.length]);
    return {
        id: nextId++, kind: 'enemy', cls: def.cls, name: def.name, label: def.label, color,
        q, r, hp: Math.round(def.baseHp * tier), maxHp: Math.round(def.baseHp * tier),
        damage: Math.round(def.baseDamage * tier), armor: 0, attackRange: def.attackRange,
        damageType: def.damageType, speed: rollSpeed(), tier,
        statuses: [], alive: true, targetId: null
    };
}

function pickEnemyClass() {
    return Rando.weighted(ENEMY_CLASSES.map(c => ({ item: c, weight: c.weight })));
}

// Tougher tiers appear as reputation rises (DYNAMICS: "Escalation tied to progress").
function rollTier() {
    const t = currentTier();
    if (t >= 3) return Rando.bool(0.5) ? 2 : 1;
    if (t >= 2) return Rando.bool(0.3) ? 2 : 1;
    return 1;
}

// ---- Setup ----
function setupUnits() {
    partyScheme = ColorTheory.randomScheme(() => Math.random());
    enemyScheme = ColorTheory.randomScheme(() => Math.random());
    enemyColorIdx = 0;

    healer = makeHealer(homeHex.q, homeHex.r);
    party = [];

    const origin = new Hex(healer.q, healer.r);
    const taken = new Set([Hex.key(healer.q, healer.r), Hex.key(treasureHex.q, treasureHex.r)]);
    const spots = passableHexes().sort((a, b) => origin.distance(a) - origin.distance(b));

    let si = 0;
    PARTY_CLASSES.forEach((def, i) => {
        while (si < spots.length && taken.has(Hex.key(spots[si].q, spots[si].r))) si++;
        const spot = spots[si] ?? spots[0];
        taken.add(Hex.key(spot.q, spot.r));
        si++;
        const color = ColorTheory.rgbToHex(...partyScheme[i % partyScheme.length]);
        party.push(makePartyMember(def, spot.q, spot.r, color));
    });
}

function spawnEnemies() {
    enemies = [];
    const count = Rando.int(ENEMY_MIN, ENEMY_MAX);
    const occupied = boardKeySet();
    const home = new Hex(homeHex.q, homeHex.r);
    const candidates = passableHexes().filter(h =>
        !occupied.has(Hex.key(h.q, h.r)) && home.distance(h) > 8);
    Rando.shuffle(candidates);
    for (let i = 0; i < count && i < candidates.length; i++) {
        const h = candidates[i];
        enemies.push(makeEnemy(pickEnemyClass(), 1, h.q, h.r));
    }
}

// Low-probability per-turn pressure that converges on the party's destination.
function spawnReinforcement() {
    const occupied = boardKeySet();
    const obj = new Hex(objectiveHex.q, objectiveHex.r);
    const candidates = passableHexes().filter(h => {
        const d = obj.distance(h);
        return !occupied.has(Hex.key(h.q, h.r)) && d >= 3 && d <= 7;
    });
    if (candidates.length === 0) return;
    const h = Rando.choice(candidates);
    enemies.push(makeEnemy(pickEnemyClass(), rollTier(), h.q, h.r));
}

function initGame() {
    let attempts = 0;
    do {
        hexes = generateRectGrid();
        assignTerrain();
        placeLandmarks();
        attempts++;
    } while (!hasPath(homeHex, treasureHex) && attempts < 20);

    setupUnits();
    spawnEnemies();

    turn = 1;
    reputation = 0;
    treasureCollected = false;
    objectiveHex = treasureHex;
    phase = 'player';
    resolving = false;
    selection = null;
    targeting = null;
    activeSkill = null;
    overlay = null;
    hoveredHex = null;
    combatFlash = null;

    healer.mp = PLAYER_MP;
    healer.aether = HEALER_MAX_AETHER;

    centerOn(healer);
    showOverlay('intro');
    refreshSkillBar();
    resize();
}

function centerOn(hex) {
    const p = new Hex(hex.q, hex.r).toPixel();
    panX = canvas.width / 2 - p.x;
    panY = canvas.height / 2 - p.y;
}

// ---- Unit queries ----
function boardUnits() {
    return [healer, ...party.filter(p => !p.gone), ...enemies];
}

function boardKeySet() {
    const s = new Set();
    for (const u of boardUnits()) s.add(Hex.key(u.q, u.r));
    return s;
}

function occupancyExcluding(unit) {
    const s = new Set();
    for (const u of boardUnits()) {
        if (u === unit) continue;
        s.add(Hex.key(u.q, u.r));
    }
    return s;
}

function unitAt(q, r) {
    return boardUnits().find(u => u.q === q && u.r === r) ?? null;
}

// Friendly units the healer can target: itself plus party members still on the board
// (downed bodies included, so Raise can reach them).
function allies() {
    return [healer, ...party.filter(p => !p.gone)];
}

function nearest(from, list) {
    const origin = new Hex(from.q, from.r);
    let best = null;
    let bestDist = Infinity;
    for (const u of list) {
        const d = origin.distance(u);
        if (d < bestDist) { bestDist = d; best = u; }
    }
    return best;
}

// ---- Reputation / skill tiers ----
function currentTier() {
    if (reputation >= TIER3_REP) return 3;
    if (reputation >= TIER2_REP) return 2;
    return 1;
}

function skillUsable(skill) {
    if (healer.cooldowns[skill.id] > 0) return false;
    if (healer.aether < skill.aetherCost) return false;
    return validSkillTargets(skill, allies(), healer).length > 0;
}

// ---- Skill bar (DOM) ----
function refreshSkillBar() {
    const bar = document.getElementById('skill-bar');
    bar.innerHTML = '';
    bar.classList.toggle('side-right', spellSide === 'right');
    bar.classList.toggle('side-left', spellSide !== 'right');
    if (overlay || phase !== 'player' || !healer) return;

    bar.appendChild(buildSpellHeader());

    const tier = currentTier();
    for (const skill of SKILLS) {
        if (skill.tier > tier) continue;
        const cd = healer.cooldowns[skill.id];
        const sub = cd > 0 ? `CD ${cd}` : `${skill.aetherCost}A`;
        const btn = document.createElement('button');
        btn.innerHTML = `<span class="name">${skill.name}<span class="cost">${sub}</span></span>` +
            `<span class="desc">${skill.description}</span>`;
        btn.disabled = !skillUsable(skill);
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
    if (!skillUsable(skill)) return;
    if (activeSkill && activeSkill.id === skill.id) { cancelTargeting(); render(); return; }
    deselect();
    activeSkill = skill;
    const targets = validSkillTargets(skill, allies(), healer);
    targeting = { skill, validKeys: new Set(targets.map(u => Hex.key(u.q, u.r))) };
    refreshSkillBar();
    render();
}

function castAt(hex) {
    const key = Hex.key(hex.q, hex.r);
    if (!targeting || !targeting.validKeys.has(key)) { cancelTargeting(); render(); return; }
    const skill = targeting.skill;
    const targetUnit = unitAt(hex.q, hex.r);
    applySkill(skill, targetUnit, allies());
    healer.aether -= skill.aetherCost;
    healer.cooldowns[skill.id] = skill.cooldown;
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
    selection = { reachable: computeReachable() };
}

function deselect() {
    selection = null;
}

// Cost-limited flood fill bounded by remaining MP; every other unit is a wall.
function computeReachable() {
    if (healer.mp <= 0) return new Map();
    const blocked = occupancyExcluding(healer);
    const costs = bfsHexes(healer, hexes, hex => {
        if (blocked.has(Hex.key(hex.q, hex.r))) return Infinity;
        return moveCost(hex);
    }, healer.mp);
    costs.delete(Hex.key(healer.q, healer.r));
    return costs;
}

function moveHealer(q, r) {
    const cost = selection?.reachable.get(Hex.key(q, r));
    if (cost === undefined) return;
    healer.q = q;
    healer.r = r;
    healer.mp -= cost;
    if (healer.mp > 0) selectHealer();
    else deselect();
    render();
}

// ---- Turn loop (animated, phased) ----
function primaryAction() {
    if (overlay || resolving || phase !== 'player') return;
    endTurn();
}

async function endTurn() {
    if (resolving || overlay || phase !== 'player') return;
    resolving = true;
    deselect();
    cancelTargeting();

    phase = 'party';
    await runPartyPhase();

    if (!overlay) {
        phase = 'enemy';
        await runEnemyPhase();
    }
    if (!overlay) {
        resolutionTick();
    }
    if (!overlay) {
        if (Rando.bool(REINFORCE_CHANCE)) spawnReinforcement();
        turn++;
        startPlayerTurn();
    }
    resolving = false;
}

function startPlayerTurn() {
    phase = 'player';
    healer.mp = PLAYER_MP;
    healer.aether = Math.min(healer.maxAether, healer.aether + healer.aetherRegen);
    for (const id of Object.keys(healer.cooldowns)) {
        if (healer.cooldowns[id] > 0) healer.cooldowns[id] -= 1;
    }
    selection = null;
    targeting = null;
    activeSkill = null;
    refreshSkillBar();
    render();
}

// AI context: closures over live terrain + a mutable occupancy set passed in.
function aiCtx(live) {
    return {
        terrainPassable: (q, r) => { const h = hexes.get(Hex.key(q, r)); return !!h && isPassable(h); },
        moveCost: (q, r) => { const h = hexes.get(Hex.key(q, r)); return h ? moveCost(h) : Infinity; },
        occupied: key => live.has(key)
    };
}

// Relocate a unit to dest, keeping the live occupancy set in sync so the next mover
// sees the new position. Shared by both AI phases.
function moveUnit(unit, dest, live) {
    live.delete(Hex.key(unit.q, unit.r));
    unit.q = dest.q;
    unit.r = dest.r;
    live.add(Hex.key(unit.q, unit.r));
}

// The leader heads for the objective but won't outrun the healer (the leash); followers
// gather to the leader (or the healer if the leader is down).
function partyGoal(member) {
    if (member.role === 'leader') {
        if (new Hex(member.q, member.r).distance(healer) > LEADER_LEASH) return { q: healer.q, r: healer.r };
        return objectiveHex;
    }
    const leader = party.find(p => p.role === 'leader' && p.alive && !p.gone);
    const anchor = leader ?? healer;
    return { q: anchor.q, r: anchor.r };
}

async function runPartyPhase() {
    const order = [...party].sort((a, b) => (a.role === 'leader' ? 0 : 1) - (b.role === 'leader' ? 0 : 1));
    const live = boardKeySet();

    for (const member of order) {
        if (member.gone || !member.alive) continue;
        const dest = walkToward(member, partyGoal(member), PARTY_MP, aiCtx(live));
        moveUnit(member, dest, live);

        const here = new Hex(member.q, member.r);
        const foe = nearest(member, enemies.filter(e => here.distance(e) <= member.attackRange));
        if (foe) {
            applyDamage(foe, effectiveDamage(member));
            if (!foe.alive) removeEnemy(foe, live);
        }

        handleObjective(member);
        render();
        await sleep(110);
        if (overlay) return;
    }
}

function removeEnemy(enemy, live) {
    enemies = enemies.filter(e => e !== enemy);
    live.delete(Hex.key(enemy.q, enemy.r));
    reputation += REP_PER_KILL;
}

function handleObjective(member) {
    if (!treasureCollected && member.q === treasureHex.q && member.r === treasureHex.r) {
        treasureCollected = true;
        reputation += REP_TREASURE;
        objectiveHex = homeHex;
        return;
    }
    if (treasureCollected && member.q === homeHex.q && member.r === homeHex.r) {
        victory();
    }
}

// Each enemy commits to a target party member (telegraphed); only re-picks when its
// target is no longer a valid, living hero. Falls to the healer when the party is down.
function enemyTarget(enemy) {
    const living = party.filter(p => p.alive && !p.gone);
    let target = living.find(p => p.id === enemy.targetId);
    if (!target) {
        target = nearest(enemy, living);
        enemy.targetId = target ? target.id : null;
    }
    return target ?? healer;
}

async function runEnemyPhase() {
    const live = boardKeySet();

    for (const enemy of [...enemies]) {
        if (!enemy.alive) continue;
        const target = enemyTarget(enemy);
        const dest = walkToward(enemy, target, enemy.speed, aiCtx(live));
        moveUnit(enemy, dest, live);

        const inReach = new Hex(enemy.q, enemy.r).distance(target) <= enemy.attackRange;
        if (inReach) {
            enemyAttack(enemy, target);
            combatFlash = { q: target.q, r: target.r };
        }
        render();
        await sleep(110);
        combatFlash = null;

        if (!healer.alive) { defeat('The healer has fallen.'); return; }
    }
}

// Resolution tick: status effects, downed heroes aging toward permanent death, defeat check.
function resolutionTick() {
    for (const u of allies()) tickStatuses(u);
    for (const e of enemies) tickStatuses(e);

    if (!healer.alive) { defeat('The healer has fallen.'); return; }

    for (const member of party) {
        if (member.gone || member.alive) continue;
        member.downedTurns += 1;
        if (member.downedTurns > REVIVE_WINDOW) member.gone = true;
    }

    if (party.every(p => p.gone)) defeat('The party has perished.');
}

function victory() {
    reputation += REP_RETURN;
    endMessage = `Returned home with the treasure. Reputation ${reputation} in ${turn} turns.`;
    showOverlay('victory');
    render();
}

function defeat(reason) {
    endMessage = `${reason} Final reputation ${reputation}.`;
    showOverlay('defeat');
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
function render() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawTerrain();
    drawLandmarks();
    drawSelection();
    drawTargeting();

    for (const enemy of enemies) drawUnit(enemy);
    for (const member of party) { if (!member.gone) drawUnit(member); }
    if (healer) drawUnit(healer);

    drawCombatFlash();
    drawEndOverlay();
    updateHUD();
}

function onScreen(x, y) {
    return x >= -HEX_SIZE * 2 && x <= canvas.width + HEX_SIZE * 2 &&
        y >= -HEX_SIZE * 2 && y <= canvas.height + HEX_SIZE * 2;
}

function drawTerrain() {
    for (const [, hex] of hexes) {
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

function drawLandmarks() {
    if (!treasureCollected) drawLandmark(treasureHex, TARGET_COLOR, '★');
    drawLandmark(homeHex, HOME_COLOR, '⌂');
    if (objectiveHex) {
        const { x, y } = hexToScreen(objectiveHex.q, objectiveHex.r);
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

    if (unit === healer && selection) {
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
    if (!healer) return;
    document.getElementById('turn-info').textContent = 'Turn ' + turn;
    document.getElementById('hp-info').textContent = `HP: ${healer.hp}/${healer.maxHp}`;
    document.getElementById('aether-info').textContent = `Aether: ${healer.aether}/${healer.maxAether}`;
    document.getElementById('rep-info').textContent = `Rep: ${reputation}`;
    const living = party.filter(p => p.alive).length;
    document.getElementById('party-info').textContent = `Party: ${living}/${party.length}`;

    const hoverEl = document.getElementById('hover-info');
    const h = hoveredHex && hexes.get(Hex.key(hoveredHex.q, hoveredHex.r));
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
    if (resolving || phase !== 'player') return;             // L1.1 input is live only on the player's turn

    const hex = screenToHex(e.clientX, e.clientY);
    if (!hexes.has(Hex.key(hex.q, hex.r))) return;

    // L4 modal targeting takes priority: a valid hex casts, anything else cancels.
    if (targeting) { castAt(hex); return; }

    // L1.2 healer select → move (pure lookup against the cached reachable set).
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
    const next = hexes.has(Hex.key(hex.q, hex.r)) ? { q: hex.q, r: hex.r } : null;
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
document.getElementById('begin-btn').addEventListener('click', dismissOverlay);

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
