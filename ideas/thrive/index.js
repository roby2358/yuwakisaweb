// index.js — THRIVE (Slice 1)
// Plain <script> globals from config.js, rando.js, hex.js. See SPEC.md / DYNAMICS.md.
// Module-level mutable state + a single immediate-mode render(), in the hex-baseline style.

// ---- World state ----
let hexes = null;
let hub = null;            // { q, r } — Last Ditch
let nodes = [];            // salvage nodes: { q, r, richness }
let enemies = [];          // fauna: { q, r, kind, hp }
let loot = [];             // dropped caches: { q, r, credits, goods }
let prices = {};           // good -> current market price
let day = 1;
let fieldRests = 0;        // field rests since the last day-end; every Nth ends the day

// ---- Player & meta state (see DYNAMICS.md §11) ----
let player = null;
let resbed = { secured: false, charges: 0 };

// ---- Input-layer state (UI_CONTROLS.md): overlay → targeting → selection ----
let phase = 'player';
let selection = null;      // { reachable: Map<key,cost>, attackable: Set<key>, workable: Set<key> }
let overlay = null;        // 'intro' | 'hub' | 'win' | 'dead' | 'stranded' | null
let hubTab = 'menu';
let hoveredHex = null;
let lastMsg = '';
let flashes = [];          // transient combat markers: { q, r, color }
let turnInterrupted = false; // set when the player goes down, to end the enemy phase

// ---- View state ----
let panX = 0, panY = 0;
let panning = false, panStartX = 0, panStartY = 0, panOrigX = 0, panOrigY = 0;

// ---- Canvas ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlayEl = document.getElementById('overlay-panel');

const ENEMY_COLORS = { grazer: '#b9a86a', lurker: '#9c5b8a' };

function resize() {
    canvas.width = Math.max(100, window.innerWidth - HUD_WIDTH);
    canvas.height = window.innerHeight;
    render();
}
window.addEventListener('resize', resize);

// ---- Small helpers ----
const clampNotor = n => Math.max(0, Math.min(TUNE.notorietyMax, n));
const newSkill = () => ({ level: 0, xp: 0 });
const money = n => `${n} c`;
const keyOf = (q, r) => Hex.key(q, r);

function hexToScreen(q, r) {
    const p = new Hex(q, r).toPixel();
    return { x: p.x + panX, y: p.y + panY };
}
function screenToHex(sx, sy) {
    return Hex.fromPixel(sx - panX, sy - panY);
}
function moveCost(hex) { return MOVEMENT_COST[hex.terrain] ?? Infinity; }
function isPassable(hex) { return moveCost(hex) !== Infinity; }

function passableHexes() {
    const out = [];
    for (const [, hex] of hexes) {
        if (hex.isEdge || !isPassable(hex)) continue;
        out.push(hex);
    }
    return out;
}

// ---- Derived player stats (skills + gear) ----
const maxHp = () => TUNE.hpMax + player.skills.toughness.level * 15;
const maxStamina = () => TUNE.staminaMax + player.skills.endurance.level * 2;
const lvl = name => player.skills[name].level;
const weaponDmg = () => WEAPONS[player.weapon].dmg;
const armorReduce = () => ARMORS[player.armor].reduce;
const sellPrice = good => Math.round(prices[good] * (1 + lvl('barter') * 0.1));
const healCost = () => Math.max(0, Math.ceil((maxHp() - player.hp) * 0.5 * (1 - lvl('firstaid') * 0.1)));
// A night's rest mends a fraction of your wounds: (firstaid + 1) × 5% of HP lost.
const restHeal = () => (maxHp() - player.hp) * (lvl('firstaid') + 1) * 0.05;
const xpThreshold = level => 15 + level * 15;

// In town you're safe, so every service spends from your whole purse — carried first,
// then the Locker — so you never have to withdraw just to buy something. (The ticket is
// the exception: it must come from banked credits; see the Gate.)
const totalFunds = () => player.creditsCarried + player.creditsBanked;
function spendTown(amount) {
    const fromCarried = Math.min(player.creditsCarried, amount);
    player.creditsCarried -= fromCarried;
    player.creditsBanked -= amount - fromCarried;
}

function gainXp(name, amount) {
    const sk = player.skills[name];
    sk.xp += amount;
    while (sk.xp >= xpThreshold(sk.level)) {
        sk.xp -= xpThreshold(sk.level);
        sk.level++;
        log(`${name[0].toUpperCase() + name.slice(1)} skill is now ${sk.level}.`);
    }
}

function log(msg) { lastMsg = msg; updateStatus(); }

// ---- Heightmap (diamond-square) ----
function diamondSquare(size, roughness) {
    const grid = new Float64Array(size * size);
    const get = (x, y) => grid[y * size + x];
    const set = (x, y, v) => { grid[y * size + x] = v; };
    set(0, 0, Math.random()); set(size - 1, 0, Math.random());
    set(0, size - 1, Math.random()); set(size - 1, size - 1, Math.random());
    let step = size - 1, scale = roughness;
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
        step = half; scale *= roughness;
    }
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < grid.length; i++) { min = Math.min(min, grid[i]); max = Math.max(max, grid[i]); }
    for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / (max - min) * 100;
    return grid;
}

// ---- Map generation ----
function generateRectGrid() {
    const map = new Map();
    const hm = diamondSquare(129, 0.55);
    for (let row = 0; row < MAP_ROWS; row++) {
        const qOffset = -Math.floor(row / 2);
        for (let col = 0; col < MAP_COLS; col++) {
            const q = col + qOffset, r = row;
            const gx = Math.round(col / (MAP_COLS - 1) * 128);
            const gy = Math.round(row / (MAP_ROWS - 1) * 128);
            const elevation = hm[gy * 129 + gx];
            const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;
            map.set(keyOf(q, r), { q, r, col, row, elevation, isEdge, terrain: null });
        }
    }
    return map;
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
        if (pct < 0.18) inner[i].terrain = TERRAIN.WATER;
        else if (pct < 0.80) inner[i].terrain = TERRAIN.PLAINS;
        else if (pct < 0.93) inner[i].terrain = TERRAIN.HILLS;
        else inner[i].terrain = TERRAIN.MOUNTAIN;
    }
    const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS);
    Rando.shuffle(plains);
    const forestCount = Math.round(n * 0.10);
    for (let i = 0; i < forestCount && i < plains.length; i++) plains[i].terrain = TERRAIN.FOREST;
}

function distFromHub(hex) {
    return new Hex(hex.q, hex.r).distance(new Hex(hub.q, hub.r));
}

function placeHub() {
    // Town sits at the center of the map: the passable hex nearest the grid's middle.
    const midCol = (MAP_COLS - 1) / 2, midRow = (MAP_ROWS - 1) / 2;
    const distToCenter = h => Math.abs(h.col - midCol) + Math.abs(h.row - midRow);
    const passable = passableHexes().sort((a, b) => distToCenter(a) - distToCenter(b));
    hub = { q: passable[0].q, r: passable[0].r };
}

function placeNodesAndFauna() {
    const open = passableHexes().filter(h => !(h.q === hub.q && h.r === hub.r));
    Rando.shuffle(open);

    nodes = [];
    const nodeCount = 16;
    for (let i = 0; i < nodeCount && i < open.length; i++) {
        const h = open[i];
        nodes.push({ q: h.q, r: h.r, richness: rollRichness(h) });
    }

    enemies = [];
    const cap = faunaCap();
    let i = nodeCount;
    while (enemies.length < cap && i < open.length) {
        const h = open[i++];
        if (distFromHub(h) < 3) continue;           // give the player breathing room at home
        enemies.push(makeEnemy(h, rollKind()));
    }
}

function rollKind() {
    const lurkerChance = 0.3 + player.notoriety / 200;
    return Rando.bool(lurkerChance) ? 'lurker' : 'grazer';
}
function makeEnemy(hex, kind) {
    return { q: hex.q, r: hex.r, kind, hp: FAUNA[kind].hp };
}
function faunaCap() {
    return 5 + Math.floor((player ? player.notoriety : 0) / 20);
}

// Salvage richness scales with distance from town, plus ±2 jitter, clamped 1–5.
function rollRichness(hex) {
    const d = distFromHub(hex);
    return Math.max(1, Math.min(5, 1 + Math.floor(d / 5) + Rando.int(-2, 2)));
}

// Drop a fresh salvage field on a random open hex (not town, not an existing node).
function spawnFreshNode() {
    const taken = new Set(nodes.map(n => keyOf(n.q, n.r)));
    const open = passableHexes().filter(h =>
        !(h.q === hub.q && h.r === hub.r) && !taken.has(keyOf(h.q, h.r)));
    if (!open.length) return null;
    const h = Rando.choice(open);
    const node = { q: h.q, r: h.r, richness: rollRichness(h) };
    nodes.push(node);
    return node;
}

function hubReachesNodes() {
    const costs = bfsHexes(hub, hexes, moveCost, Infinity);
    return nodes.filter(n => costs.has(keyOf(n.q, n.r))).length;
}

function newPlayer() {
    player = {
        q: hub.q, r: hub.r,
        hp: 0, stamina: 0, rations: TUNE.startRations,
        creditsCarried: TUNE.startCredits, creditsBanked: 0,
        notoriety: 0, medkits: 0,
        weapon: 'knife', armor: 'none',
        inventory: { scrap: 0, hide: 0, meat: 0 },
        skills: {
            scavenge: newSkill(), hunt: newSkill(), barter: newSkill(),
            toughness: newSkill(), firstaid: newSkill(), foraging: newSkill(), endurance: newSkill(),
        },
    };
    player.hp = maxHp();
    player.stamina = maxStamina();
    resbed = { secured: false, charges: 0 };
}

function refreshPrices() {
    for (const g in GOODS) {
        const base = GOODS[g].baseValue;
        const cur = prices[g] ?? base;
        prices[g] = Math.round(Math.max(base * 0.5, Math.min(base * 1.6, cur + Rando.float(-0.25, 0.25) * base)));
    }
}

function initGame() {
    let attempts = 0;
    do {
        hexes = generateRectGrid();
        assignTerrain();
        placeHub();
        newPlayer();             // needed before placeNodesAndFauna (faunaCap reads player)
        placeNodesAndFauna();
        attempts++;
    } while (hubReachesNodes() < 6 && attempts < 20);

    prices = {};
    refreshPrices();
    day = 1;
    fieldRests = 0;
    phase = 'player';
    selection = null;
    hoveredHex = null;
    flashes = [];
    lastMsg = 'Stranded on Cinder. Earn your ticket off this rock.';
    showIntro();
    resize();            // size the canvas to the window first…
    centerOn(player);    // …then center on the player with real dimensions
    render();
}

function centerOn(p) {
    const px = new Hex(p.q, p.r).toPixel();
    panX = canvas.width / 2 - px.x;
    panY = canvas.height / 2 - px.y;
}

// ---- Selection (compute legal sets up front; click is a pure lookup) ----
function selectPlayer() {
    selection = { reachable: computeReachable(), attackable: computeAttackable(), workable: computeWorkable() };
}
function deselect() { selection = null; }

function computeReachable() {
    const enemyKeys = new Set(enemies.map(e => keyOf(e.q, e.r)));
    const costs = bfsHexes(player, hexes, hex => {
        if (enemyKeys.has(keyOf(hex.q, hex.r))) return Infinity;
        return moveCost(hex);
    }, player.stamina);
    costs.delete(keyOf(player.q, player.r));
    // Exhaustion fallback: adjacent passable hexes are always steppable (cost may exceed
    // stamina; the shortfall is paid in HP), so the player is never fully stuck.
    for (const nb of new Hex(player.q, player.r).neighbors()) {
        const key = nb.key(), hex = hexes.get(key);
        if (!hex || !isPassable(hex) || enemyKeys.has(key)) continue;
        if (!costs.has(key)) costs.set(key, moveCost(hex));
    }
    return costs;
}
function computeAttackable() {
    const set = new Set();
    for (const nb of new Hex(player.q, player.r).neighbors())
        if (enemies.some(e => e.q === nb.q && e.r === nb.r)) set.add(nb.key());
    return set;
}
function computeWorkable() {
    const set = new Set();
    const here = nodeAt(player.q, player.r);
    if (here && here.richness > 0) set.add(keyOf(player.q, player.r));
    return set;
}

const nodeAt = (q, r) => nodes.find(n => n.q === q && n.r === r) || null;
const enemyAt = (q, r) => enemies.find(e => e.q === q && e.r === r) || null;
const atHub = () => player.q === hub.q && player.r === hub.r;

// ---- Actions ----
function movePlayer(q, r) {
    const cost = selection.reachable.get(keyOf(q, r));
    if (cost === undefined) return;
    const shortfall = Math.max(0, cost - player.stamina);
    player.stamina = Math.max(0, player.stamina - cost);
    player.q = q; player.r = r;
    if (shortfall > 0) {
        player.hp -= shortfall * TUNE.exhaustHpPerPoint;
        log('Exhausted — that step cost blood.');
        flash(q, r, '#c5524a');
        if (player.hp <= 0) { handleDeath(); return; }
    }
    pickupLoot();
    if (atHub()) { openHub(); return; }
    const onNode = nodeAt(player.q, player.r);
    if (onNode && onNode.richness > 0) log(`Salvage field underfoot (richness ${onNode.richness}) — press G to gather.`);
    selectPlayer();
    render();
}

function workNode(node) {
    if (node.richness <= 0) { log('This salvage is picked clean.'); return; }
    if (player.stamina < TUNE.workStamina) { log('Too exhausted to dig — rest (R) or head home.'); return; }
    player.stamina -= TUNE.workStamina;
    // Finding salvage is a richness/10 roll; a fruitless dig leaves the bed untouched.
    if (!Rando.bool(node.richness / 10)) {
        log('Dug, but turned up nothing this time.');
        selectPlayer();
        render();
        return;
    }
    const qty = Math.max(1, Math.round(node.richness * (1 + lvl('scavenge') * 0.15) * Rando.float(0.6, 1.2)));
    player.inventory.scrap += qty;
    gainXp('scavenge', qty);
    player.notoriety = clampNotor(player.notoriety + TUNE.grudgeScavenge);
    // Only a successful dig can thin the bed — same richness/10 odds again.
    if (Rando.bool(node.richness / 10)) {
        node.richness -= 1;
        if (node.richness <= 0) {
            nodes = nodes.filter(n => n !== node);   // picked clean — field collapses
            const fresh = spawnFreshNode();          // a new bed surfaces elsewhere
            log(`Salvaged ${qty} scrap — the field is now spent${fresh ? '; word spreads of fresh salvage elsewhere.' : '.'}`);
        } else {
            log(`Salvaged ${qty} scrap — the bed thins to richness ${node.richness}.`);
        }
    } else {
        log(`Salvaged ${qty} scrap.`);
    }
    selectPlayer();
    render();
}

function attackEnemy(enemy) {
    if (player.stamina < TUNE.attackStamina) { log('Too exhausted to strike.'); return; }
    player.stamina -= TUNE.attackStamina;
    const fa = FAUNA[enemy.kind];
    const dmg = Math.max(1, weaponDmg() + lvl('hunt') * 2 - fa.toughness);
    enemy.hp -= dmg;
    flash(enemy.q, enemy.r, '#ffffff');
    if (enemy.hp <= 0) { killEnemy(enemy); selectPlayer(); render(); return; }
    const back = Math.max(1, fa.dmg - armorReduce());
    player.hp -= back;
    flash(player.q, player.r, '#c5524a');
    log(`Struck the ${fa.label} for ${dmg}; it bit back for ${back}.`);
    if (player.hp <= 0) { handleDeath(); return; }
    selectPlayer();
    render();
}

function killEnemy(enemy) {
    const fa = FAUNA[enemy.kind];
    for (const g in fa.drops) player.inventory[g] += fa.drops[g];
    gainXp('hunt', fa.xp);
    player.notoriety = clampNotor(player.notoriety + TUNE.grudgeKill);
    enemies = enemies.filter(e => e !== enemy);
    const dropStr = Object.entries(fa.drops).map(([g, q]) => `${q} ${GOODS[g].label.toLowerCase()}`).join(', ');
    log(`Killed the ${fa.label}. Took ${dropStr}. The wastes will remember.`);
}

function useMedkit() {
    if (player.medkits <= 0) { log('No medkits.'); return; }
    if (player.hp >= maxHp()) { log('Already at full health.'); return; }
    player.medkits--;
    player.hp = Math.min(maxHp(), player.hp + TUNE.medkitHeal);
    log('Used a medkit.');
    render();
}

function gather() {
    if (overlay || phase !== 'player') return;
    const here = nodeAt(player.q, player.r);
    if (!here) { log('No salvage field here — stand on one to gather.'); return; }
    if (!selection) selectPlayer();
    workNode(here);
}

function fieldRest() {
    if (atHub() || overlay) return;
    if (player.rations > 0) {
        player.rations--;
        player.stamina = Math.min(maxStamina(), player.stamina + TUNE.fieldRestStaminaGain);
        fieldRests++;
        const nightfall = fieldRests >= TUNE.fieldRestsPerDay;
        if (Rando.bool(lvl('foraging') * 0.2)) {
            player.rations = Math.min(TUNE.rationsMax, player.rations + 1);
            log('You rest and forage up a ration.');
        } else {
            const left = TUNE.fieldRestsPerDay - fieldRests;
            log(nightfall ? 'You bed down rough — night falls.'
                          : `You rest. Stamina returns — but the wastes stir (${left} more before nightfall).`);
        }
        deselect();
        if (nightfall) { campNight(); return; }   // rolls the day, refills stamina — but no upkeep, no comforts
        ecologyPhase();
        return;
    }
    player.hp -= TUNE.starveHp;
    log('No rations — hunger gnaws. You lose health.');
    if (player.hp <= 0) { handleDeath(); return; }
    deselect();
    ecologyPhase();
}

function pickupLoot() {
    const idx = loot.findIndex(l => l.q === player.q && l.r === player.r);
    if (idx === -1) return;
    const l = loot[idx];
    player.creditsCarried += l.credits;
    for (const g in l.goods) player.inventory[g] += l.goods[g];
    loot.splice(idx, 1);
    log(`Recovered a dropped cache (${l.credits} c).`);
}

// ---- Turn / day / ecology ----
function primaryAction() {
    if (overlay) return;
    if (atHub()) openHub();
    else endTurn();
}
function endTurn() {
    if (overlay) return;
    deselect();
    ecologyPhase();
}

function ecologyPhase() {
    phase = 'enemy';
    turnInterrupted = false;
    moveEnemies();
    if (!turnInterrupted) maybeSpawn();
    phase = 'player';
    render();
}

function maybeSpawn() {
    if (enemies.length >= faunaCap()) return;
    if (!Rando.bool(0.10 + player.notoriety / 300)) return;
    const open = passableHexes().filter(h =>
        distFromHub(h) > 4 &&
        !enemyAt(h.q, h.r) && !(h.q === player.q && h.r === player.r));
    if (open.length) enemies.push(makeEnemy(Rando.choice(open), rollKind()));
}

function disposition(enemy) {
    const k = FAUNA[enemy.kind];
    if (player.notoriety >= k.hostile) return 'hostile';
    if (player.notoriety >= k.wary) return 'wary';
    return 'benign';
}

function validNeighbors(enemy, occupied) {
    return new Hex(enemy.q, enemy.r).neighbors().filter(nb => {
        const key = nb.key(), hex = hexes.get(key);
        return hex && isPassable(hex) && !occupied.has(key) &&
            !(nb.q === hub.q && nb.r === hub.r) && !(nb.q === player.q && nb.r === player.r);
    });
}

function moveEnemies() {
    for (const enemy of enemies) {
        const dist = new Hex(enemy.q, enemy.r).distance(new Hex(player.q, player.r));
        const mood = disposition(enemy);
        const fa = FAUNA[enemy.kind];
        const occupied = new Set(enemies.filter(e => e !== enemy).map(e => keyOf(e.q, e.r)));

        if (mood === 'hostile' && dist <= fa.aggro) {
            if (dist === 1) { enemyAttack(enemy); if (turnInterrupted) return; continue; }
            const path = findPath(enemy, player,
                (q, r) => {
                    const hex = hexes.get(keyOf(q, r));
                    if (!hex || !isPassable(hex)) return false;
                    if (q === hub.q && r === hub.r) return false;
                    if (occupied.has(keyOf(q, r))) return false;
                    return true;
                },
                (q, r) => moveCost(hexes.get(keyOf(q, r))), 60);
            if (path && path.length >= 2 && !(path[1].q === player.q && path[1].r === player.r)) {
                enemy.q = path[1].q; enemy.r = path[1].r;
            }
        } else if (mood === 'wary' && dist <= fa.aggro + 1) {
            const opts = validNeighbors(enemy, occupied);
            if (opts.length) {
                opts.sort((a, b) => new Hex(b.q, b.r).distance(new Hex(player.q, player.r)) -
                    new Hex(a.q, a.r).distance(new Hex(player.q, player.r)));
                enemy.q = opts[0].q; enemy.r = opts[0].r;
            }
        } else {
            if (Rando.bool(0.5)) {
                const opts = validNeighbors(enemy, occupied);
                if (opts.length) { const d = Rando.choice(opts); enemy.q = d.q; enemy.r = d.r; }
            }
        }
    }
}

function enemyAttack(enemy) {
    const fa = FAUNA[enemy.kind];
    const dmg = Math.max(1, fa.dmg - armorReduce());
    player.hp -= dmg;
    flash(player.q, player.r, '#c5524a');
    log(`A ${fa.label} mauls you for ${dmg}.`);
    if (player.hp <= 0) handleDeath();
}

function handleDeath() {
    const cache = { q: player.q, r: player.r, credits: player.creditsCarried, goods: { ...player.inventory } };
    const hadAnything = cache.credits > 0 || Object.values(cache.goods).some(v => v > 0);
    player.creditsCarried = 0;
    player.inventory = { scrap: 0, hide: 0, meat: 0 };
    turnInterrupted = true;

    if (resbed.secured && resbed.charges > 0) {
        resbed.charges--;
        if (hadAnything) loot.push(cache);
        player.q = hub.q; player.r = hub.r;
        player.hp = maxHp();
        player.stamina = maxStamina();
        deselect();
        flash(hub.q, hub.r, '#daa520');
        log('You wake in the Resbed. Whatever you carried is out there now.');
        render();
    } else {
        endGame('dead');
    }
}

// Shared day rollover: a night's sleep refills stamina; the world turns over.
function advanceDay() {
    player.stamina = maxStamina();
    day++;
    fieldRests = 0;
    refreshPrices();
    replenishFauna();
}

// Town lodging: pay upkeep for the comforts of a roof — wound care and lying low.
function endDay() {
    if (totalFunds() < TUNE.upkeep) { endGame('stranded'); return; }
    spendTown(TUNE.upkeep);
    player.hp = Math.min(maxHp(), player.hp + restHeal());
    player.notoriety = clampNotor(player.notoriety - TUNE.notorietyDecay);
    advanceDay();
    log(`Day ${day} dawns. Upkeep took ${TUNE.upkeep} c.`);
    if (overlay === 'hub') { hubTab = 'menu'; renderHubPanel(); }
    render();
}

// Sleeping rough in the wastes: no lodging fee, and wounds still mend overnight,
// but the grudges against you don't ease — that only happens back in town.
function campNight() {
    player.hp = Math.min(maxHp(), player.hp + restHeal());
    advanceDay();
    log(`Day ${day} dawns cold. You slept rough — no roof, but the wounds knit a little.`);
    render();
}

function replenishFauna() {
    const open = passableHexes().filter(h => distFromHub(h) > 3 && !enemyAt(h.q, h.r));
    Rando.shuffle(open);
    let i = 0;
    while (enemies.length < faunaCap() && i < open.length) enemies.push(makeEnemy(open[i++], rollKind()));
}

function endGame(kind) {
    overlay = kind;
    deselect();
    showResult(kind);
    render();
}

// ---- Flash animation ----
function flash(q, r, color) {
    flashes.push({ q, r, color });
    setTimeout(() => { flashes = flashes.filter(f => !(f.q === q && f.r === r && f.color === color)); render(); }, 170);
}

// ====================================================================
// Rendering
// ====================================================================
function render() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!hexes) return;

    // Terrain
    for (const [, hex] of hexes) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (offscreen(x, y)) continue;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
        ctx.fill();
        ctx.strokeStyle = '#00000044'; ctx.lineWidth = 1; ctx.stroke();
    }

    // Selection highlights: reachable (yellow), exhaustion-reach (orange), attack (red), work (cyan)
    if (selection) {
        for (const [key, cost] of selection.reachable) {
            const { q, r } = Hex.fromKey(key), p = hexToScreen(q, r);
            if (offscreen(p.x, p.y)) continue;
            drawHexPath(ctx, p.x, p.y, HEX_SIZE);
            ctx.fillStyle = cost > player.stamina ? 'rgba(255,150,0,0.30)' : 'rgba(255,255,0,0.28)';
            ctx.fill();
        }
        tintSet(selection.attackable, 'rgba(220,60,60,0.40)');
        tintSet(selection.workable, 'rgba(80,200,220,0.40)');
    }

    // Flashes (under counters)
    for (const f of flashes) {
        const p = hexToScreen(f.q, f.r);
        if (offscreen(p.x, p.y)) continue;
        drawHexPath(ctx, p.x, p.y, HEX_SIZE);
        ctx.fillStyle = f.color; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
    }

    // Hub
    if (hub) {
        const { x, y } = hexToScreen(hub.q, hub.r);
        if (!offscreen(x, y)) {
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = '#4a463a'; ctx.fill();
            ctx.strokeStyle = HUB_COLOR; ctx.lineWidth = 2; ctx.stroke();
            glyph('⌂', x, y, HUB_COLOR, 18);   // house
        }
    }

    // Salvage nodes
    for (const n of nodes) {
        const { x, y } = hexToScreen(n.q, n.r);
        if (offscreen(x, y)) continue;
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#cfa84a'; ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
        glyph(String(n.richness), x, y, '#000', 11);
    }

    // Loot caches
    for (const l of loot) {
        const { x, y } = hexToScreen(l.q, l.r);
        if (offscreen(x, y)) continue;
        glyph('❖', x, y, '#e8d27a', 16);
    }

    // Enemies
    for (const e of enemies) {
        const { x, y } = hexToScreen(e.q, e.r);
        if (offscreen(x, y)) continue;
        const ring = { benign: '#6fbf73', wary: '#d9b34a', hostile: '#c5524a' }[disposition(e)];
        drawCounter(x, y, ENEMY_COLORS[e.kind], FAUNA[e.kind].glyph, ring);
    }

    // Player
    if (player) {
        const { x, y } = hexToScreen(player.q, player.r);
        drawCounter(x, y, PLAYER_COLOR, 'P', selection ? '#fff' : null);
    }

    updateHUD();
    updateStatus();
}

const offscreen = (x, y) =>
    x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 || y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2;

function tintSet(set, style) {
    for (const key of set) {
        const { q, r } = Hex.fromKey(key), p = hexToScreen(q, r);
        if (offscreen(p.x, p.y)) continue;
        drawHexPath(ctx, p.x, p.y, HEX_SIZE);
        ctx.fillStyle = style; ctx.fill();
    }
}

function glyph(text, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function contrastText(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.4 ? '#000' : '#fff';
}

function drawCounter(cx, cy, color, label, ring) {
    const s = COUNTER_SIZE, x = cx - s / 2, y = cy - s / 2, r = 4;
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x + r + i, y + s + 1 + i);
        ctx.arcTo(x + s + 1 + i, y + s + 1 + i, x + s + 1 + i, y + s - r + 1 + i, r);
        ctx.lineTo(x + s + 1 + i, y + r + i);
        ctx.stroke();
    }
    roundRect(x, y, s, s, r);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = ring || '#000'; ctx.lineWidth = ring ? 2 : 1; ctx.stroke();
    glyph(label, cx, cy, contrastText(color), Math.floor(s * 0.55));
}

// ---- HUD + status ----
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setBar(id, frac) { const el = document.getElementById(id); if (el) el.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`; }

function updateHUD() {
    if (!player) return;
    setText('hud-day', `Day ${day}`);
    setText('hud-hp', `${Math.max(0, Math.round(player.hp))} / ${maxHp()}`);
    setBar('hud-hp-bar', player.hp / maxHp());
    setText('hud-sta', `${Math.round(player.stamina)} / ${maxStamina()}`);
    setBar('hud-sta-bar', player.stamina / maxStamina());
    setText('hud-rations', String(player.rations));
    setText('hud-carry', money(player.creditsCarried));
    setText('hud-bank', money(player.creditsBanked));
    for (const g in GOODS) setText(`hud-inv-${g}`, String(player.inventory[g] ?? 0));
    setText('hud-notor', String(player.notoriety));
    setText('hud-resbed', resbed.secured ? `${resbed.charges} charge${resbed.charges === 1 ? '' : 's'}` : 'none');
    setText('hud-ticket-amt', `${player.creditsBanked} / ${TUNE.ticketPrice}`);
    setBar('hud-ticket-bar', player.creditsBanked / TUNE.ticketPrice);
}

function entityDesc(q, r) {
    if (player && q === player.q && r === player.r) {
        const on = nodeAt(q, r);
        return on && on.richness > 0 ? `You — press G to salvage (richness ${on.richness}).` : 'You.';
    }
    if (hub && q === hub.q && r === hub.r) return 'Last Ditch — your shelter. Stand here for services.';
    const e = enemyAt(q, r);
    if (e) return `${FAUNA[e.kind].label} — ${disposition(e)} (HP ${e.hp}).`;
    const n = nodeAt(q, r);
    if (n) return n.richness > 0 ? `Salvage field — richness ${n.richness}.` : 'Salvage field — picked clean.';
    if (loot.some(l => l.q === q && l.r === r)) return 'A dropped cache.';
    return '';
}

function updateStatus() {
    const h = hoveredHex && hexes && hexes.get(keyOf(hoveredHex.q, hoveredHex.r));
    if (h) {
        const cost = moveCost(h);
        const costStr = cost === Infinity ? 'impassable' : `move ${cost}`;
        setText('status-terrain', `${TERRAIN_NAMES[h.terrain] ?? '?'} (${costStr})`);
        setText('status-detail', entityDesc(hoveredHex.q, hoveredHex.r) || lastMsg);
    } else {
        setText('status-terrain', '');
        setText('status-detail', lastMsg);
    }
}

// ====================================================================
// Overlays: intro / result / hub services (DOM)
// ====================================================================
function showOverlayHtml(html) { overlayEl.innerHTML = html; overlayEl.classList.remove('hidden'); }
function hideOverlayDom() { overlayEl.classList.add('hidden'); }

function showIntro() {
    overlay = 'intro';
    showOverlayHtml(`
        <h1>THRIVE</h1>
        <p>You wash up in <b>Last Ditch</b>, a shantyport on the wasteland Cinder, with the scum
        of the galaxy and no way home but the <b>Gate</b> — ${TUNE.ticketPrice} credits for a
        one-way ticket to the stars.</p>
        <p class="dim">Scavenge and hunt the wastes, sell at the Market, bank your earnings, and
        outrun the grudges your taking and killing earn you. <b>First, secure a Resbed</b> — until
        you do, death is final.</p>
        <div class="overlay-actions"><button data-act="begin">Step outside</button></div>`);
}

function showResult(kind) {
    const titles = { win: 'OFF-WORLD', dead: 'DEAD ON CINDER', stranded: 'STRANDED' };
    const blurbs = {
        win: `You bought passage and boarded the Gate. Cinder keeps the rest of them.`,
        dead: `Something out there put you down for good — no charge left to bring you back.`,
        stranded: `Broke, with upkeep due. On Cinder, the penniless don't see another dawn.`,
    };
    showOverlayHtml(`
        <h1>${titles[kind]}</h1>
        <p>${blurbs[kind]}</p>
        <p class="dim">Reached day ${day} · banked ${player.creditsBanked} c.</p>
        <div class="overlay-actions"><button data-act="newgame">New game</button></div>`);
}

function openHub() {
    overlay = 'hub'; hubTab = 'menu'; deselect();
    renderHubPanel(); render();
}
function closeHub() { overlay = null; hideOverlayDom(); render(); }

function renderHubPanel() {
    const tabs = ['Locker', 'Market', 'Infirmary', 'Resbed', 'Gate'];
    const tabBtns = tabs.map(t =>
        `<button data-act="tab" data-arg="${t.toLowerCase()}" class="${hubTab === t.toLowerCase() ? 'active' : ''}">${t}</button>`).join('');
    showOverlayHtml(`
        <h1>LAST DITCH</h1>
        <p class="dim">Carried ${money(player.creditsCarried)} · Banked ${money(player.creditsBanked)}
            · Notoriety ${player.notoriety}</p>
        <div class="svc-buttons">${tabBtns}</div>
        <div id="hub-body">${hubBody()}</div>
        <div class="overlay-actions">
            <button data-act="rest">Rest (end day · -${TUNE.upkeep}c)</button>
            <button data-act="leave">Head out</button>
        </div>`);
}

function shopRow(label, btnLabel, act, arg, enabled) {
    const dis = enabled ? '' : 'disabled';
    const a = arg !== undefined ? `data-arg="${arg}"` : '';
    return `<div class="shop-row"><span>${label}</span><button data-act="${act}" ${a} ${dis}>${btnLabel}</button></div>`;
}

function hubBody() {
    switch (hubTab) {
        case 'locker':
            return `<p class="shop-note">Only banked credits count toward the ticket, and they're
                safe if you die in the wastes. Carried credits are lost on death — bank before a
                risky run. (In town, purchases spend from either.)</p>
                ${shopRow(`Carried: ${money(player.creditsCarried)}`, 'Deposit all', 'depositAll', undefined, player.creditsCarried > 0)}
                ${shopRow(`Banked: ${money(player.creditsBanked)}`, 'Withdraw 50', 'withdraw', undefined, player.creditsBanked > 0)}`;
        case 'market': {
            let rows = '<h2>Sell</h2>';
            let any = false;
            for (const g in player.inventory) {
                const qty = player.inventory[g];
                if (qty <= 0) continue;
                any = true;
                rows += shopRow(`${GOODS[g].label} ×${qty} @ ${sellPrice(g)}c`, `Sell (${qty * sellPrice(g)}c)`, 'sell', g, true);
            }
            if (!any) rows += '<p class="shop-note">Nothing to sell.</p>';
            rows += '<h2>Buy</h2>';
            rows += shopRow(`Ration`, `Buy (${TUNE.foodCost}c)`, 'buyRation', undefined, totalFunds() >= TUNE.foodCost && player.rations < TUNE.rationsMax);
            rows += shopRow(`Medkit (+${TUNE.medkitHeal} HP)`, `Buy (${TUNE.medkitCost}c)`, 'buyMedkit', undefined, totalFunds() >= TUNE.medkitCost);
            if (player.weapon !== 'machete')
                rows += shopRow(`${WEAPONS.machete.label} (dmg ${WEAPONS.machete.dmg})`, `Buy (${WEAPONS.machete.cost}c)`, 'buyWeapon', 'machete', totalFunds() >= WEAPONS.machete.cost);
            if (player.armor !== 'vest')
                rows += shopRow(`${ARMORS.vest.label} (-${ARMORS.vest.reduce} dmg)`, `Buy (${ARMORS.vest.cost}c)`, 'buyArmor', 'vest', totalFunds() >= ARMORS.vest.cost);
            rows += '<h2>Amends</h2>';
            rows += shopRow(`Bleed 5 Notoriety`, `Pay (${5 * TUNE.amendsCostPerPoint}c)`, 'amends', undefined, totalFunds() >= 5 * TUNE.amendsCostPerPoint && player.notoriety > 0);
            return rows;
        }
        case 'infirmary': {
            const missing = maxHp() - player.hp;
            const cost = healCost();
            let rows = shopRow(`Heal ${Math.round(missing)} HP`, `Heal (${cost}c)`, 'heal', undefined, missing > 0 && totalFunds() >= cost);
            rows += '<h2>Train</h2>';
            for (const s of ['toughness', 'endurance', 'foraging', 'firstaid']) {
                const cost = 30 + lvl(s) * 25;
                rows += shopRow(`${s} (lv ${lvl(s)})`, `Train (${cost}c)`, 'train', s, totalFunds() >= cost);
            }
            return rows;
        }
        case 'resbed':
            if (!resbed.secured)
                return `<p class="shop-note">Until the Resbed is secured, death is permanent. Securing it
                    re-embodies you here on death — minus everything you carried and one charge.</p>
                    ${shopRow('Resbed (incl. first charge)', `Secure (${TUNE.resbedSecureCost}c)`, 'secure', undefined, totalFunds() >= TUNE.resbedSecureCost)}`;
            return `<p class="shop-note">Charges: ${resbed.charges} / ${TUNE.resbedMaxCharges}. Each death burns one.</p>
                ${shopRow('Recharge', `Recharge (${TUNE.resbedRechargeCost}c)`, 'recharge', undefined, resbed.charges < TUNE.resbedMaxCharges && totalFunds() >= TUNE.resbedRechargeCost)}`;
        case 'gate':
            return `<p class="shop-note">A one-way ticket off Cinder. Paid from your banked fund.</p>
                ${shopRow(`Ticket: ${player.creditsBanked} / ${TUNE.ticketPrice} c`, 'Buy ticket', 'ticket', undefined, player.creditsBanked >= TUNE.ticketPrice)}`;
        default:
            return `<p>Pick a service above, then <b>Rest</b> to end the day or <b>head out</b> into the wastes.</p>`;
    }
}

// ---- Overlay action dispatch (delegation) ----
function handleAction(act, arg) {
    switch (act) {
        case 'begin': overlay = null; hideOverlayDom(); render(); return;
        case 'newgame': hideOverlayDom(); overlay = null; loot = []; initGame(); return;
        case 'tab': hubTab = arg; renderHubPanel(); return;
        case 'leave': closeHub(); return;
        case 'rest': endDay(); return;
        case 'depositAll': player.creditsBanked += player.creditsCarried; player.creditsCarried = 0; break;
        case 'withdraw': { const a = Math.min(50, player.creditsBanked); player.creditsBanked -= a; player.creditsCarried += a; break; }
        case 'sell': {
            const qty = player.inventory[arg];
            player.creditsCarried += qty * sellPrice(arg);
            gainXp('barter', qty);
            player.inventory[arg] = 0;
            break;
        }
        case 'buyRation': spendTown(TUNE.foodCost); player.rations++; break;
        case 'buyMedkit': spendTown(TUNE.medkitCost); player.medkits++; break;
        case 'buyWeapon': spendTown(WEAPONS[arg].cost); player.weapon = arg; break;
        case 'buyArmor': spendTown(ARMORS[arg].cost); player.armor = arg; break;
        case 'amends': spendTown(5 * TUNE.amendsCostPerPoint); player.notoriety = clampNotor(player.notoriety - 5); break;
        case 'heal': spendTown(healCost()); player.hp = maxHp(); break;
        case 'train': { spendTown(30 + lvl(arg) * 25); player.skills[arg].level++; player.hp = Math.min(player.hp, maxHp()); break; }
        case 'secure': spendTown(TUNE.resbedSecureCost); resbed.secured = true; resbed.charges = 1; break;
        case 'recharge': spendTown(TUNE.resbedRechargeCost); resbed.charges++; break;
        case 'ticket': endGame('win'); return;
        default: return;
    }
    renderHubPanel();
    updateHUD();
}

overlayEl.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.act) handleAction(btn.dataset.act, btn.dataset.arg);
});

// ====================================================================
// Input (canvas + keys), dispatch order mirrors UI_CONTROLS.md
// ====================================================================
canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
        panning = true; panStartX = e.clientX; panStartY = e.clientY; panOrigX = panX; panOrigY = panY;
        e.preventDefault(); return;
    }
    if (e.button !== 0) return;
    if (overlay) return;                 // DOM overlays capture their own clicks
    if (phase !== 'player') return;

    const hex = screenToHex(e.clientX, e.clientY);
    const key = keyOf(hex.q, hex.r);

    if (!selection) {
        if (hex.q === player.q && hex.r === player.r) selectPlayer();
    } else if (selection.attackable.has(key)) {
        attackEnemy(enemyAt(hex.q, hex.r)); return;
    } else if (hex.q === player.q && hex.r === player.r) {
        const here = nodeAt(player.q, player.r);
        if (here && here.richness > 0) { workNode(here); return; }
        deselect();
    } else if (selection.reachable.has(key)) {
        movePlayer(hex.q, hex.r); return;
    } else {
        deselect();
    }
    render();
});

canvas.addEventListener('mousemove', e => {
    if (panning) { panX = panOrigX + (e.clientX - panStartX); panY = panOrigY + (e.clientY - panStartY); render(); return; }
    const hex = screenToHex(e.clientX, e.clientY);
    const next = hexes && hexes.has(keyOf(hex.q, hex.r)) ? { q: hex.q, r: hex.r } : null;
    if (next?.q !== hoveredHex?.q || next?.r !== hoveredHex?.r) { hoveredHex = next; updateStatus(); }
});

canvas.addEventListener('mouseup', e => { if (e.button === 2) panning = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('end-turn').addEventListener('click', primaryAction);
document.getElementById('new-game').addEventListener('click', () => { overlay = null; loot = []; initGame(); });

window.addEventListener('keydown', e => {
    if (overlay === 'intro' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); overlay = null; hideOverlayDom(); render(); return; }
    if (overlay === 'hub' && e.key === 'Escape') { closeHub(); return; }
    if (overlay) return;
    if (e.key === 'Escape') { deselect(); render(); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); primaryAction(); return; }
    if (e.key === 'g' || e.key === 'G') { gather(); return; }
    if (e.key === 'r' || e.key === 'R') { fieldRest(); return; }
    if (e.key === 'h' || e.key === 'H') { useMedkit(); return; }
});

// ---- Start ----
initGame();
