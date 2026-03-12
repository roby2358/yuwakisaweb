// game.js — Waowisha game state and logic

import { HEX_SIZE, TERRAIN, TERRAIN_INFO, UNIT_TYPES, ENEMY_TYPES, SPOILS,
    RECIPES, STRUCTURE_TYPES, PRODUCTION_RECIPES, CRT, CRT_COLUMNS, RANGED_CRT,
    SUPPLY_CRATE, VISIBILITY_RANGE, SURGE_INTERVAL, WINDFALL_CHANCE,
    BASE_SPAWN_CHANCE, GATHER_RANGE, HARVESTER_RANGE,
    DRIFT_CHARGE_RANGE, DRIFT_CHARGE_RADIUS, ALL_R0, ALL_P1, MAP_SIZE,
    UPGRADE_PATH
} from './config.js';
import { hexKey, parseHexKey, hexNeighbors, hexDistance, hexesInRange, bfsHexes, findPath } from './hex.js';
import { Rando } from './rando.js';
import { generateGameNames } from './names.js';

let nextId = 1;
function newId() { return nextId++; }

// ---- Stockpile Helpers ----

function afford(stockpile, cost) {
    for (const [res, amt] of Object.entries(cost)) {
        if ((stockpile[res] || 0) < amt) return false;
    }
    return true;
}

function spend(stockpile, cost) {
    for (const [res, amt] of Object.entries(cost)) {
        stockpile[res] -= amt;
    }
}

function refund(stockpile, cost) {
    for (const [res, amt] of Object.entries(cost)) {
        stockpile[res] = (stockpile[res] || 0) + amt;
    }
}

function addStock(stockpile, res, amount) {
    stockpile[res] = (stockpile[res] || 0) + amount;
}

function scaleInputs(inputs, multiplier) {
    const scaled = {};
    for (const [res, amt] of Object.entries(inputs)) {
        scaled[res] = amt * multiplier;
    }
    return scaled;
}

// ---- Death Tracking ----

function markEnemyDead(state, enemy) {
    enemy.dead = true;
    if (!state.bangs) state.bangs = [];
    state.bangs.push({ q: enemy.q, r: enemy.r, color: 'enemy' });
}

function markEnemyDeadAt(state, enemy, q, r) {
    enemy.dead = true;
    if (!state.bangs) state.bangs = [];
    state.bangs.push({ q, r, color: 'enemy' });
}

function markUnitDead(state, unit) {
    unit.dead = true;
    if (!state.bangs) state.bangs = [];
    state.bangs.push({ q: unit.q, r: unit.r, color: 'unit' });
}

function markUnitDeadAt(state, unit, q, r) {
    unit.dead = true;
    if (!state.bangs) state.bangs = [];
    state.bangs.push({ q, r, color: 'unit' });
}

export function sweepDead(state) {
    state.enemies = state.enemies.filter(e => !e.dead);
    state.units = state.units.filter(u => !u.dead);
    // Clear deferred movement positions
    for (const enemy of state.enemies) {
        delete enemy.preQ;
        delete enemy.preR;
    }
    state.bangs = [];
}

// ---- Placement Helper ----

function placeNearSettlement(state, type) {
    const { q, r } = parseHexKey(state.settlement);
    const occupied = new Set(state.units.map(u => hexKey(u.q, u.r)));
    for (const n of hexNeighbors(q, r)) {
        const k = hexKey(n.q, n.r);
        if (occupied.has(k)) continue;
        const hex = state.map.get(k);
        if (!hex || TERRAIN_INFO[hex.terrain].moveCost === Infinity) continue;
        const unit = {
            id: newId(), type, q: n.q, r: n.r,
            mp: UNIT_TYPES[type].mp, carrying: null
        };
        state.units.push(unit);
        return unit;
    }
    return null;
}

// ---- Map Generation ----

function diamondSquare(size, roughness, rng) {
    const grid = new Float64Array(size * size);
    const get = (x, y) => grid[y * size + x];
    const set = (x, y, v) => { grid[y * size + x] = v; };

    set(0, 0, rng()); set(size-1, 0, rng());
    set(0, size-1, rng()); set(size-1, size-1, rng());

    let step = size - 1, scale = roughness;
    while (step > 1) {
        const half = step / 2;
        for (let y = half; y < size-1; y += step)
            for (let x = half; x < size-1; x += step)
                set(x, y, (get(x-half,y-half)+get(x+half,y-half)+get(x-half,y+half)+get(x+half,y+half))/4 + (rng()-0.5)*scale);
        for (let y = 0; y < size; y += half)
            for (let x = (y+half)%step; x < size; x += step) {
                let sum=0,cnt=0;
                if(x>=half){sum+=get(x-half,y);cnt++;}
                if(x+half<size){sum+=get(x+half,y);cnt++;}
                if(y>=half){sum+=get(x,y-half);cnt++;}
                if(y+half<size){sum+=get(x,y+half);cnt++;}
                set(x,y,sum/cnt+(rng()-0.5)*scale);
            }
        step = half; scale *= roughness;
    }
    let min=Infinity,max=-Infinity;
    for(let i=0;i<grid.length;i++){min=Math.min(min,grid[i]);max=Math.max(max,grid[i]);}
    for(let i=0;i<grid.length;i++) grid[i]=(grid[i]-min)/(max-min)*100;
    return grid;
}

function generateMap(rng) {
    const hexes = new Map();
    const hm = diamondSquare(129, 0.55, rng);
    const cols = MAP_SIZE, rows = MAP_SIZE;

    for (let row = 0; row < rows; row++) {
        const qOffset = -Math.floor(row / 2);
        for (let col = 0; col < cols; col++) {
            const q = col + qOffset, r = row;
            const gx = Math.round(col/(cols-1)*128);
            const gy = Math.round(row/(rows-1)*128);
            const elevation = hm[gy * 129 + gx];
            const isEdge = row===0||row===rows-1||col===0||col===cols-1;

            hexes.set(hexKey(q, r), {
                q, r, col, row, elevation, isEdge,
                terrain: null
            });
        }
    }

    // Assign base terrain by elevation
    const inner = [];
    for (const hex of hexes.values()) {
        if (hex.isEdge) { hex.terrain = TERRAIN.DEEP; continue; }
        inner.push(hex);
    }
    inner.sort((a, b) => a.elevation - b.elevation);
    const n = inner.length;
    for (let i = 0; i < n; i++) {
        const pct = i / n;
        if (pct < 0.15) inner[i].terrain = TERRAIN.DEEP;
        else if (pct > 0.95) inner[i].terrain = TERRAIN.CRAG;
        else inner[i].terrain = TERRAIN.PALE;
    }

    // Place resource clusters
    placeResourceClusters(hexes, rng, TERRAIN.VEIN, 7, 5, 8);
    placeResourceClusters(hexes, rng, TERRAIN.GROVE, 8, 5, 8);
    placeResourceClusters(hexes, rng, TERRAIN.MIRE, 6, 4, 7);
    placeResourceClusters(hexes, rng, TERRAIN.SCARP, 7, 4, 7);

    return hexes;
}

function placeResourceClusters(hexes, rng, terrainType, numClusters, minSize, maxSize) {
    const pale = [];
    for (const hex of hexes.values()) {
        if (hex.terrain === TERRAIN.PALE) pale.push(hex);
    }
    Rando.shuffle(pale, rng);

    let placed = 0;
    for (let i = 0; i < pale.length && placed < numClusters; i++) {
        const seed = pale[i];
        if (seed.terrain !== TERRAIN.PALE) continue;
        const size = Rando.int(minSize, maxSize, rng);
        const cluster = growCluster(hexes, seed, size, rng);
        if (cluster.length >= minSize) {
            for (const h of cluster) h.terrain = terrainType;
            placed++;
        }
    }
}

function growCluster(hexes, start, targetSize, rng) {
    const cluster = [start];
    const used = new Set([hexKey(start.q, start.r)]);
    const frontier = [];
    for (const n of hexNeighbors(start.q, start.r)) {
        const k = hexKey(n.q, n.r);
        const h = hexes.get(k);
        if (h && h.terrain === TERRAIN.PALE && !used.has(k)) {
            frontier.push(h);
            used.add(k);
        }
    }
    while (cluster.length < targetSize && frontier.length > 0) {
        const idx = Rando.int(0, frontier.length - 1, rng);
        const hex = frontier.splice(idx, 1)[0];
        cluster.push(hex);
        for (const n of hexNeighbors(hex.q, hex.r)) {
            const k = hexKey(n.q, n.r);
            const h = hexes.get(k);
            if (h && h.terrain === TERRAIN.PALE && !used.has(k)) {
                frontier.push(h);
                used.add(k);
            }
        }
    }
    return cluster;
}

// ---- Settlement Placement ----

function findSettlement(hexes) {
    let best = null, bestScore = -Infinity;
    const midCol = MAP_SIZE / 2, midRow = MAP_SIZE / 2;
    for (const hex of hexes.values()) {
        if (hex.terrain !== TERRAIN.PALE) continue;
        const dist = Math.abs(hex.col - midCol) + Math.abs(hex.row - midRow);
        let passNeighbors = 0;
        for (const n of hexNeighbors(hex.q, hex.r)) {
            const h = hexes.get(hexKey(n.q, n.r));
            if (h && TERRAIN_INFO[h.terrain].moveCost < Infinity) passNeighbors++;
        }
        const score = -dist + passNeighbors * 3;
        if (score > bestScore) { bestScore = score; best = hex; }
    }
    return best ? hexKey(best.q, best.r) : null;
}

// ---- Starter Veins ----

function placeStarterVeins(hexes, sq, sr, rng) {
    const terrains = [TERRAIN.VEIN, TERRAIN.GROVE, TERRAIN.MIRE, TERRAIN.SCARP];
    const ring = hexesInRange(sq, sr, 5).filter(h => hexDistance(sq, sr, h.q, h.r) === 5);
    Rando.shuffle(ring, rng);

    for (const terrain of terrains) {
        const spot = ring.find(h => {
            const hex = hexes.get(hexKey(h.q, h.r));
            return hex && hex.terrain === TERRAIN.PALE;
        });
        if (!spot) continue;
        const seed = hexes.get(hexKey(spot.q, spot.r));
        const cluster = growCluster(hexes, seed, Rando.int(3, 5, rng), rng);
        for (const h of cluster) h.terrain = terrain;
        // Remove used spots from ring
        const used = new Set(cluster.map(h => hexKey(h.q, h.r)));
        for (let i = ring.length - 1; i >= 0; i--) {
            if (used.has(hexKey(ring[i].q, ring[i].r))) ring.splice(i, 1);
        }
    }
}

// ---- Mandate Generation ----

function generateMandate(rng) {
    const goals = [];
    const t2 = ['P2a', 'P2b', 'P2c', 'P2d'];
    const t3 = ['P3a', 'P3b', 'P3c', 'P3d'];
    Rando.shuffle(t2, rng);
    Rando.shuffle(t3, rng);

    for (let i = 0; i < 3; i++) {
        goals.push({ product: t2[i], quantity: Rando.int(2, 4, rng), produced: 0, revealed: i < 2 });
    }
    for (let i = 0; i < 3; i++) {
        goals.push({ product: t3[i], quantity: Rando.int(1, 3, rng), produced: 0, revealed: false });
    }
    return goals;
}

// ---- Visibility ----

function unitOnTower(state, unit) {
    return state.structures.find(s =>
        STRUCTURE_TYPES[s.type].category === 'defense' && s.buildProgress <= 0
        && s.q === unit.q && s.r === unit.r
    );
}

export function computeGathered(state) {
    const gathered = new Set();
    for (const unit of state.units) {
        if (!UNIT_TYPES[unit.type].gather) continue;
        for (const h of hexesInRange(unit.q, unit.r, GATHER_RANGE)) {
            const k = hexKey(h.q, h.r);
            const hex = state.map.get(k);
            if (!hex) continue;
            const info = TERRAIN_INFO[hex.terrain];
            if (info && info.resource) gathered.add(k);
        }
    }
    for (const s of state.structures) {
        if (s.buildProgress > 0 || s.type !== 'harvesterPlant') continue;
        for (const h of hexesInRange(s.q, s.r, HARVESTER_RANGE)) {
            const k = hexKey(h.q, h.r);
            const hex = state.map.get(k);
            if (!hex) continue;
            const info = TERRAIN_INFO[hex.terrain];
            if (info && info.resource) gathered.add(k);
        }
    }
    return gathered;
}

export function computeVisibility(state) {
    const visible = new Set();
    for (const unit of state.units) {
        let range = VISIBILITY_RANGE + (UNIT_TYPES[unit.type].reveal || 0);
        if (unitOnTower(state, unit)) range += 3;
        for (const h of hexesInRange(unit.q, unit.r, range)) {
            visible.add(hexKey(h.q, h.r));
        }
    }
    for (const s of state.structures) {
        for (const h of hexesInRange(s.q, s.r, VISIBILITY_RANGE)) {
            visible.add(hexKey(h.q, h.r));
        }
    }
    if (state.settlement) {
        const { q, r } = parseHexKey(state.settlement);
        for (const h of hexesInRange(q, r, VISIBILITY_RANGE)) {
            visible.add(hexKey(h.q, h.r));
        }
    }
    return visible;
}

// ---- Reachable Hexes ----

export function computeReachable(state, unitId) {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.mp <= 0) return new Map();

    const def = UNIT_TYPES[unit.type];
    const mp = unit.mp;
    const enemyKeys = new Set(state.enemies.map(e => hexKey(e.q, e.r)));
    const friendlyKeys = new Set(state.units.filter(u => u.id !== unitId).map(u => hexKey(u.q, u.r)));

    const costs = bfsHexes(
        { q: unit.q, r: unit.r },
        state.map,
        hex => {
            const k = hexKey(hex.q, hex.r);
            if (friendlyKeys.has(k)) return Infinity;
            return TERRAIN_INFO[hex.terrain].moveCost;
        },
        mp
    );
    costs.delete(hexKey(unit.q, unit.r));
    for (const k of friendlyKeys) costs.delete(k);

    // Minimum 1-hex move: add adjacent passable unoccupied hexes not already in costs
    for (const n of hexNeighbors(unit.q, unit.r)) {
        const k = hexKey(n.q, n.r);
        if (friendlyKeys.has(k)) continue;
        const hex = state.map.get(k);
        if (!hex) continue;
        if (TERRAIN_INFO[hex.terrain].moveCost === Infinity) continue;
        if (!costs.has(k)) {
            costs.set(k, TERRAIN_INFO[hex.terrain].moveCost);
        }
    }

    // Sentinel-track (melee): can only attack adjacent enemies with >= half MP
    if (def.melee) {
        const halfMp = Math.ceil(def.mp / 2);
        for (const k of enemyKeys) {
            if (!costs.has(k)) continue;
            const { q, r } = parseHexKey(k);
            if (hexDistance(unit.q, unit.r, q, r) !== 1 || unit.mp < halfMp) {
                costs.delete(k);
            }
        }
    }

    // Ranged units: add visible enemy hexes within range as attack targets
    if (def.range) {
        for (const enemy of state.enemies) {
            const k = hexKey(enemy.q, enemy.r);
            if (!state.visible.has(k)) continue;
            if (hexDistance(unit.q, unit.r, enemy.q, enemy.r) <= def.range) {
                if (!costs.has(k)) costs.set(k, 0);
            }
        }
    }

    return costs;
}

// ---- Combat ----

function crtColumn(attackerStr, defenderStr) {
    const ratio = attackerStr / defenderStr;
    if (ratio < 0.75) return '1:2';
    if (ratio < 1.5) return '1:1';
    if (ratio < 2.5) return '2:1';
    if (ratio < 3.5) return '3:1';
    return '4:1';
}

function resolveCRT(attackerStr, defenderStr, rng) {
    const col = crtColumn(attackerStr, defenderStr);
    return CRT[col][Rando.int(0, 5, rng)];
}

function resolveRangedCRT(attackerPower, defenderStr, rng) {
    const col = crtColumn(attackerPower, defenderStr);
    return RANGED_CRT[col][Rando.int(0, 5, rng)];
}

function grantSpoils(state, enemyType) {
    const spoil = SPOILS[enemyType];
    if (!spoil) return;
    for (const [key, count] of Object.entries(spoil)) {
        const pool = key === 'R0' ? ALL_R0 : key === 'P1' ? ALL_P1 : null;
        if (!pool) continue;
        for (let i = 0; i < count; i++) {
            addStock(state.stockpile, Rando.choice(pool, state.rng), 1);
        }
    }
}

// ---- Create Game ----

export function createGame(seed) {
    nextId = 1;
    const rng = Rando.seeded(seed);
    const names = generateGameNames(seed);
    const map = generateMap(rng);
    const settlement = findSettlement(map);
    const { q: sq, r: sr } = parseHexKey(settlement);
    placeStarterVeins(map, sq, sr, rng);

    const stockpile = {};
    for (const [res, amt] of Object.entries(SUPPLY_CRATE)) {
        stockpile[res] = amt;
    }

    const recipeRates = {};
    for (const [key, recipe] of Object.entries(RECIPES)) {
        if (recipe.tier === 1) recipeRates[key] = Rando.int(7, 12, rng);
        else if (recipe.tier === 2) recipeRates[key] = Rando.int(3, 6, rng);
        else recipeRates[key] = Rando.int(2, 3, rng);
    }

    const harvesterCost = {};
    harvesterCost[Rando.choice(ALL_R0, rng)] = Rando.int(7, 10, rng);
    harvesterCost[Rando.choice(ALL_P1, rng)] = Rando.int(2, 3, rng);

    const warden = {
        id: newId(), type: 'warden', q: sq, r: sr,
        mp: UNIT_TYPES.warden.mp, carrying: null
    };

    const state = {
        seed, rng, names, turn: 1, map,
        units: [warden],
        enemies: [],
        structures: [],
        stockpile,
        recipeRates,
        harvesterCost,
        mandate: generateMandate(rng),
        settlement,
        visible: new Set(),
        gameOver: false, victory: false,
        log: [],
        selectedUnit: null,
        reachable: new Map(),
        buildMode: null,
        calmNextTurn: false,
    };

    state.visible = computeVisibility(state);
    return state;
}

// ---- Player Actions ----

export function selectUnit(state, unitId) {
    state.selectedUnit = unitId;
    state.buildMode = null;
    state.reachable = computeReachable(state, unitId);
}

export function deselectUnit(state) {
    state.selectedUnit = null;
    state.reachable = new Map();
    state.buildMode = null;
}

export function moveUnit(state, unitId, tq, tr) {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit) return null;

    const targetKey = hexKey(tq, tr);
    const unitDef = UNIT_TYPES[unit.type];

    // Check if enemy on target hex — initiate combat
    const enemyIdx = state.enemies.findIndex(e => hexKey(e.q, e.r) === targetKey);
    if (enemyIdx >= 0) {
        const enemy = state.enemies[enemyIdx];

        // Ranged attack: use ranged CRT, don't advance
        if (unitDef.range) {
            const result = resolveRangedCRT(unitDef.power, enemy.strength, state.rng);
            state.log.push(`${unitDef.name} fires at ${state.names[enemy.type] || enemy.type}: ${result}`);
            if (result === 'DE') {
                grantSpoils(state, enemy.type);
                state.enemies.splice(enemyIdx, 1);
                // AoE splash: also kill weak enemies on adjacent hexes
                if (unitDef.targeting === 'aoe') {
                    const splashHexes = new Set();
                    for (const n of hexNeighbors(tq, tr)) {
                        splashHexes.add(hexKey(n.q, n.r));
                    }
                    const splash = state.enemies.filter(e =>
                        splashHexes.has(hexKey(e.q, e.r)) && unitDef.power >= e.strength
                    );
                    for (const e of splash) grantSpoils(state, e.type);
                    state.enemies = state.enemies.filter(e => !splash.includes(e));
                    if (splash.length > 0) state.log.push(`Splash destroyed ${splash.length} more`);
                }
            }
            unit.mp = 0;
            deselectUnit(state);
            return result;
        }

        // Melee attack: get adjacent friendly support
        let totalStr = unitDef.strength;
        for (const other of state.units) {
            if (other.id === unit.id) continue;
            if (hexDistance(other.q, other.r, tq, tr) !== 1) continue;
            let str = UNIT_TYPES[other.type].strength;
            if (unitOnTower(state, other)) str += 2;
            totalStr += str;
        }

        const result = resolveCRT(totalStr, enemy.strength, state.rng);
        state.log.push(`Attack ${state.names[enemy.type] || enemy.type}: ${result}`);

        if (result === 'DE' || result === 'EX') {
            grantSpoils(state, enemy.type);
            state.enemies.splice(enemyIdx, 1);
        }
        if (result === 'AE' || result === 'EX') {
            state.units = state.units.filter(u => u.id !== unitId);
            deselectUnit(state);
            return result;
        }
        // Attacker survives — move to hex and spend all remaining MP
        unit.q = tq; unit.r = tr;
        unit.mp = 0;
        deselectUnit(state);
        return result;
    }

    // Normal move — subtract cost
    const cost = state.reachable.get(targetKey);
    unit.q = tq; unit.r = tr;
    unit.mp = Math.max(0, unit.mp - cost);
    deselectUnit(state);
    return 'move';
}

export function recruitUnit(state, unitType) {
    const def = UNIT_TYPES[unitType];
    if (!def || !def.cost) return false;
    if (!afford(state.stockpile, def.cost)) return false;

    spend(state.stockpile, def.cost);

    const placed = placeNearSettlement(state, unitType);
    if (!placed) {
        refund(state.stockpile, def.cost);
        return false;
    }

    state.log.push(`Recruited ${def.name}`);
    return true;
}

export function canBuildHere(state, q, r, structureType) {
    if (hexKey(q, r) === state.settlement) return false;
    if (structureType === 'spike') {
        return !state.structures.some(s => s.q === q && s.r === r);
    }
    const { q: sq, r: sr } = parseHexKey(state.settlement);
    if (hexDistance(q, r, sq, sr) < 3) return false;
    for (const s of state.structures) {
        if (hexDistance(q, r, s.q, s.r) < 3) return false;
    }
    return true;
}

export function startBuild(state, unitId, structureType) {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit) return false;
    const unitDef = UNIT_TYPES[unit.type];
    if (!unitDef.build) return false;

    const sDef = STRUCTURE_TYPES[structureType];
    if (!sDef) return false;
    if (!afford(state.stockpile, sDef.cost)) return false;
    if (!canBuildHere(state, unit.q, unit.r, structureType)) return false;

    spend(state.stockpile, sDef.cost);

    state.structures.push({
        id: newId(), type: structureType, q: unit.q, r: unit.r,
        recipe: null,
        buildProgress: Math.ceil(sDef.buildTime / unitDef.build),
        builderId: unit.id
    });

    unit.mp = 0;
    state.log.push(`Building ${sDef.name}`);
    deselectUnit(state);
    return true;
}

export function demolish(state, unitId) {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit) return false;
    const unitDef = UNIT_TYPES[unit.type];
    if (!unitDef.build) return false;

    const idx = state.structures.findIndex(s => s.q === unit.q && s.r === unit.r);
    if (idx === -1) return false;

    const s = state.structures[idx];
    const sDef = STRUCTURE_TYPES[s.type];
    state.structures.splice(idx, 1);
    unit.mp = 0;
    state.log.push(`Demolished ${sDef.name}`);
    deselectUnit(state);
    return true;
}

export function assignRecipe(state, structureId, recipe) {
    const s = state.structures.find(st => st.id === structureId);
    if (!s || s.buildProgress > 0) return false;
    const sDef = STRUCTURE_TYPES[s.type];
    if (sDef.category !== 'production') return false;
    const validRecipes = PRODUCTION_RECIPES[sDef.tier];
    if (!validRecipes || !validRecipes.includes(recipe)) return false;
    s.recipe = recipe;
    return true;
}

export function deployCharge(state, unitId, tq, tr) {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.carrying !== 'P3d') return false;
    if (hexDistance(unit.q, unit.r, tq, tr) > DRIFT_CHARGE_RANGE) return false;
    if (!state.visible.has(hexKey(tq, tr))) return false;

    const blastZone = new Set(hexesInRange(tq, tr, DRIFT_CHARGE_RADIUS).map(h => hexKey(h.q, h.r)));
    const killed = state.enemies.filter(e => blastZone.has(hexKey(e.q, e.r)));
    for (const e of killed) grantSpoils(state, e.type);
    state.enemies = state.enemies.filter(e => !blastZone.has(hexKey(e.q, e.r)));

    unit.carrying = null;
    state.log.push(`Drift Charge: destroyed ${killed.length} enemies`);
    return true;
}

export function pickUpCharge(state, unitId) {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.carrying) return false;
    if ((state.stockpile.P3d || 0) < 1) return false;
    state.stockpile.P3d--;
    unit.carrying = 'P3d';
    return true;
}

export function upgradeGatherer(state, unitId) {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.type !== 'gatherer') return false;
    const hex = state.map.get(hexKey(unit.q, unit.r));
    if (!hex || hex.terrain !== TERRAIN.PALE) return false;
    if (!afford(state.stockpile, state.harvesterCost)) return false;
    if (!canBuildHere(state, unit.q, unit.r)) return false;

    spend(state.stockpile, state.harvesterCost);

    state.structures.push({
        id: newId(), type: 'harvesterPlant', q: unit.q, r: unit.r,
        recipe: null, buildProgress: 0, builderId: null
    });

    state.units = state.units.filter(u => u.id !== unitId);
    deselectUnit(state);
    state.log.push('Gatherer upgraded to Harvester Plant!');
    return true;
}

export function upgradeUnit(state, unitId) {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit) return false;
    const path = UPGRADE_PATH[unit.type];
    if (!path) return false;

    const nextDef = UNIT_TYPES[path.next];
    if (nextDef.unique && state.units.some(u => UNIT_TYPES[u.type].unique)) return false;
    if (!afford(state.stockpile, path.cost)) return false;

    spend(state.stockpile, path.cost);
    const oldName = UNIT_TYPES[unit.type].name;
    unit.type = path.next;
    unit.mp = 0;
    state.log.push(`${oldName} upgraded to ${nextDef.name}!`);
    return true;
}

export function canAfford(state, cost) {
    return afford(state.stockpile, cost);
}

// ---- End Turn ----

export function endTurn(state) {
    if (state.gameOver || state.victory) return;

    state.bangs = [];
    productionPhase(state);
    defensePhase(state);
    driftPhase(state);

    // If there are deaths, pause here — index.js will call finishTurn after displaying bangs
    if (state.bangs.length > 0) {
        state.pendingFinish = true;
        return;
    }

    finishTurn(state);
}

export function finishTurn(state) {
    state.pendingFinish = false;
    sweepDead(state);

    if (!state.calmNextTurn) {
        spawnPhase(state);
    } else {
        state.calmNextTurn = false;
        state.log.push('The Drift is calm this turn.');
    }

    if (Rando.bool(WINDFALL_CHANCE, state.rng)) {
        resolveWindfall(state);
    }

    checkMandate(state);

    state.turn++;
    for (const unit of state.units) {
        if (unit.dead) continue;
        unit.mp = UNIT_TYPES[unit.type].mp;
    }
    state.visible = computeVisibility(state);
    deselectUnit(state);
}

// ---- Gathering ----

function gatherResources(state) {
    for (const k of computeGathered(state)) {
        const hex = state.map.get(k);
        addStock(state.stockpile, TERRAIN_INFO[hex.terrain].resource, 1);
    }
}

// ---- Production ----

function advanceBuilding(s, state) {
    const builder = state.units.find(u => u.id === s.builderId);
    if (!builder || hexKey(builder.q, builder.r) !== hexKey(s.q, s.r)) return;
    s.buildProgress = Math.max(0, s.buildProgress - 1);
    if (s.buildProgress === 0) {
        state.log.push(`${STRUCTURE_TYPES[s.type].name} complete!`);
        s.builderId = null;
    }
}

export function recipeInputs(state, recipeKey) {
    const recipe = RECIPES[recipeKey];
    if (!recipe) return null;
    return scaleInputs(recipe.inputs, state.recipeRates[recipeKey]);
}

function runProduction(state) {
    for (const s of state.structures) {
        if (s.buildProgress > 0) continue;
        const sDef = STRUCTURE_TYPES[s.type];
        if (sDef.category !== 'production') continue;
        if (!s.recipe) continue;
        const scaled = recipeInputs(state, s.recipe);
        if (!scaled) continue;
        if (!afford(state.stockpile, scaled)) continue;

        spend(state.stockpile, scaled);
        addStock(state.stockpile, s.recipe, 1);

        for (const goal of state.mandate) {
            if (goal.product === s.recipe && goal.produced < goal.quantity) {
                goal.produced++;
                break;
            }
        }
    }
}

function productionPhase(state) {
    gatherResources(state);

    for (const s of state.structures) {
        if (s.buildProgress > 0) advanceBuilding(s, state);
    }

    runProduction(state);
}

// ---- Defense ----

function resolveRangedAttack(state, q, r, name, range, power, targeting) {
    const inRange = state.enemies.filter(e =>
        !e.dead
        && hexDistance(q, r, e.q, e.r) <= range
        && state.visible.has(hexKey(e.q, e.r))
    );
    if (inRange.length === 0) return;

    if (targeting === 'aoe') {
        // Pick the strongest enemy in range as the center of the blast
        const sorted = [...inRange].sort((a, b) => b.strength - a.strength
            || hexDistance(q, r, a.q, a.r) - hexDistance(q, r, b.q, b.r));
        const center = sorted[0];
        // Hit the center hex and all adjacent hexes
        const blastHexes = new Set();
        blastHexes.add(hexKey(center.q, center.r));
        for (const n of hexNeighbors(center.q, center.r)) {
            blastHexes.add(hexKey(n.q, n.r));
        }
        const hit = inRange.filter(e => blastHexes.has(hexKey(e.q, e.r)) && power >= e.strength);
        for (const e of hit) { grantSpoils(state, e.type); markEnemyDead(state, e); }
        if (hit.length > 0) state.log.push(`${name} bombards area, destroyed ${hit.length} enemies`);
    } else if (targeting === 'all') {
        const killed = inRange.filter(e => power >= e.strength);
        for (const e of killed) { grantSpoils(state, e.type); markEnemyDead(state, e); }
        if (killed.length > 0) state.log.push(`${name} destroyed ${killed.length} enemies`);
    } else {
        const sortDir = targeting === 'weakest' ? 1 : -1;
        inRange.sort((a, b) =>
            sortDir * (a.strength - b.strength)
            || hexDistance(q, r, a.q, a.r) - hexDistance(q, r, b.q, b.r)
        );
        const target = inRange[0];
        if (power >= target.strength) {
            grantSpoils(state, target.type);
            markEnemyDead(state, target);
            state.log.push(`${name} destroyed a ${state.names[target.type] || target.type}`);
        }
    }
}

function defensePhase(state) {
    // Defense structures
    for (const s of state.structures) {
        if (s.buildProgress > 0) continue;
        const sDef = STRUCTURE_TYPES[s.type];
        if (sDef.category !== 'defense') continue;
        resolveRangedAttack(state, s.q, s.r, sDef.name, sDef.range, sDef.power, sDef.targeting);
    }

    // Ranged units
    for (const unit of state.units) {
        const def = UNIT_TYPES[unit.type];
        if (!def.range) continue;
        resolveRangedAttack(state, unit.q, unit.r, def.name, def.range, def.power, def.targeting);
    }
}

// ---- Drift Phase (Enemy Turn) ----

function spawnBroodlings(state) {
    const newE0s = [];
    for (const e of state.enemies) {
        if (e.dead) continue;
        if (e.type !== 'broodMother') continue;
        const valid = hexNeighbors(e.q, e.r).filter(n => {
            const h = state.map.get(hexKey(n.q, n.r));
            return h && TERRAIN_INFO[h.terrain].moveCost < Infinity;
        });
        if (valid.length === 0) continue;
        const spot = Rando.choice(valid, state.rng);
        newE0s.push({
            id: newId(), type: 'E0', q: spot.q, r: spot.r,
            speed: 1, strength: ENEMY_TYPES.E0.strength
        });
    }
    state.enemies.push(...newE0s);
}

function resolveEnemyUnitCombat(state) {
    for (const enemy of [...state.enemies]) {
        if (enemy.dead) continue;
        const ek = hexKey(enemy.q, enemy.r);
        const unit = state.units.find(u => !u.dead && hexKey(u.q, u.r) === ek);
        if (!unit) continue;

        // Enemy's source hex (where it attacked from)
        const srcQ = enemy.prevQ !== undefined ? enemy.prevQ : enemy.q;
        const srcR = enemy.prevR !== undefined ? enemy.prevR : enemy.r;

        const unitDef = UNIT_TYPES[unit.type];
        if (enemy.strength > unitDef.strength) {
            state.log.push(`${state.names[enemy.type] || enemy.type} destroyed your ${unitDef.name}!`);
            markUnitDead(state, unit); // yellow bang on unit's hex (target)
        } else if (enemy.strength === unitDef.strength) {
            state.log.push(`Exchange: ${unitDef.name} and ${state.names[enemy.type] || enemy.type} both destroyed`);
            markUnitDead(state, unit); // yellow bang on unit's hex
            grantSpoils(state, enemy.type);
            markEnemyDeadAt(state, enemy, srcQ, srcR); // red bang on source
        } else {
            grantSpoils(state, enemy.type);
            markEnemyDeadAt(state, enemy, srcQ, srcR); // red bang on source
        }
    }
}

function resolveEnemyStructureCombat(state) {
    for (const enemy of [...state.enemies]) {
        if (enemy.dead) continue;
        const ek = hexKey(enemy.q, enemy.r);
        const struct = state.structures.find(s => hexKey(s.q, s.r) === ek && s.buildProgress === 0);
        if (!struct) continue;
        const sDef = STRUCTURE_TYPES[struct.type];
        if (enemy.strength > sDef.power) {
            state.log.push(`${state.names[enemy.type] || enemy.type} destroyed ${sDef.name}!`);
            state.structures = state.structures.filter(s => s !== struct);
        } else {
            const bangQ = enemy.prevQ !== undefined ? enemy.prevQ : enemy.q;
            const bangR = enemy.prevR !== undefined ? enemy.prevR : enemy.r;
            grantSpoils(state, enemy.type);
            markEnemyDeadAt(state, enemy, bangQ, bangR);
        }
    }
}

function checkSettlement(state) {
    for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        if (hexKey(enemy.q, enemy.r) !== state.settlement) continue;
        const defender = state.units.find(u => !u.dead && hexKey(u.q, u.r) === state.settlement);
        if (!defender) {
            state.gameOver = true;
            state.log.push('The Drift has reached The Loom. Game Over.');
            return;
        }
    }
}

function driftPhase(state) {
    spawnBroodlings(state);
    // Save pre-move positions for all enemies (for deferred visual movement)
    for (const enemy of state.enemies) {
        enemy.preQ = enemy.q;
        enemy.preR = enemy.r;
    }
    for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        moveEnemy(state, enemy);
    }
    resolveEnemyUnitCombat(state);
    resolveEnemyStructureCombat(state);
    checkSettlement(state);
}

// ---- Enemy Movement ----

function moveEnemy(state, enemy) {
    const eDef = ENEMY_TYPES[enemy.type];
    const steps = enemy.speed || eDef.speed;

    for (let s = 0; s < steps; s++) {
        let target = null;

        if (eDef.behavior === 'random') {
            const valid = hexNeighbors(enemy.q, enemy.r).filter(n => {
                const h = state.map.get(hexKey(n.q, n.r));
                return h && TERRAIN_INFO[h.terrain].moveCost < Infinity;
            });
            if (valid.length > 0) target = Rando.choice(valid, state.rng);
        } else if (eDef.behavior === 'seekUnit') {
            const targets = [
                ...state.units.map(u => ({q:u.q,r:u.r})),
                ...state.structures.map(s => ({q:s.q,r:s.r}))
            ];
            target = seekNearest(state, enemy, targets);
        } else if (eDef.behavior === 'seekSettlement') {
            const { q, r } = parseHexKey(state.settlement);
            target = seekTarget(state, enemy, q, r);
        } else if (eDef.behavior === 'seekResource') {
            target = seekNearestResource(state, enemy);
        }

        if (target) {
            enemy.prevQ = enemy.q;
            enemy.prevR = enemy.r;
            enemy.q = target.q;
            enemy.r = target.r;
        }
    }
}

function seekTarget(state, enemy, tq, tr) {
    const path = findPath(
        { q: enemy.q, r: enemy.r },
        { q: tq, r: tr },
        (q, r) => {
            const h = state.map.get(hexKey(q, r));
            return h && TERRAIN_INFO[h.terrain].moveCost < Infinity;
        },
        () => 1,
        Infinity
    );
    if (path && path.length > 1) return path[1];
    return null;
}

function seekNearest(state, enemy, targets) {
    if (targets.length === 0) return null;
    let nearest = null, nearestDist = Infinity;
    for (const t of targets) {
        const d = hexDistance(enemy.q, enemy.r, t.q, t.r);
        if (d < nearestDist) { nearestDist = d; nearest = t; }
    }
    if (!nearest) return null;
    return seekTarget(state, enemy, nearest.q, nearest.r);
}

function seekNearestResource(state, enemy) {
    let nearest = null, nearestDist = Infinity;
    for (const hex of state.map.values()) {
        if (!TERRAIN_INFO[hex.terrain].resource) continue;
        const d = hexDistance(enemy.q, enemy.r, hex.q, hex.r);
        if (d < nearestDist) { nearestDist = d; nearest = hex; }
    }
    if (!nearest) return null;
    return seekTarget(state, enemy, nearest.q, nearest.r);
}

// ---- Spawn Phase ----

function spawnPhase(state) {
    if (Rando.bool(BASE_SPAWN_CHANCE, state.rng)) {
        spawnEnemyOnEdge(state, 'E0');
    }

    if (state.turn % SURGE_INTERVAL === 0) {
        const surgeStrength = Math.floor(Math.pow(state.turn / SURGE_INTERVAL, 2));
        state.log.push(`Surge! ${surgeStrength} enemies incoming.`);

        for (let i = 0; i < surgeStrength; i++) {
            const roll = state.rng();
            if (roll < 0.60) spawnEnemyOnEdge(state, 'E0');
            else if (roll < 0.85) spawnEnemyOnEdge(state, 'E2');
            else if (roll < 0.95) spawnEnemyOnEdge(state, 'E1');
            else spawnEnemyOnEdge(state, 'broodMother');
        }
    }
}

function spawnEnemyOnEdge(state, type) {
    let edgeHexes = [];
    for (const hex of state.map.values()) {
        if (hex.isEdge && TERRAIN_INFO[hex.terrain].moveCost < Infinity) {
            edgeHexes.push(hex);
        }
    }
    // Fallback: hexes adjacent to edge
    if (edgeHexes.length === 0) {
        for (const hex of state.map.values()) {
            if (!hex.isEdge) continue;
            for (const n of hexNeighbors(hex.q, hex.r)) {
                const h = state.map.get(hexKey(n.q, n.r));
                if (h && TERRAIN_INFO[h.terrain].moveCost < Infinity) {
                    edgeHexes.push(h);
                }
            }
        }
    }
    if (edgeHexes.length === 0) return;

    const spot = Rando.choice(edgeHexes, state.rng);
    const eDef = ENEMY_TYPES[type];
    const speed = Array.isArray(eDef.speed) ? Rando.int(eDef.speed[0], eDef.speed[1], state.rng) : eDef.speed;

    state.enemies.push({
        id: newId(), type, q: spot.q, r: spot.r,
        speed, strength: eDef.strength
    });
}

// ---- Windfalls ----

function resolveWindfall(state) {
    const roll = Rando.int(1, 6, state.rng);
    switch (roll) {
        case 1: {
            const veins = [];
            for (const hex of state.map.values()) {
                if (hex.terrain === TERRAIN.VEIN) veins.push(hex);
            }
            if (veins.length === 0) break;
            const v = Rando.choice(veins, state.rng);
            for (const n of hexNeighbors(v.q, v.r)) {
                const h = state.map.get(hexKey(n.q, n.r));
                if (h && h.terrain === TERRAIN.PALE) {
                    h.terrain = TERRAIN.VEIN;
                    state.log.push('Windfall: Rich Vein discovered!');
                    return;
                }
            }
            break;
        }
        case 2:
            state.log.push('Windfall: A Sentinel wanders to The Loom!');
            placeNearSettlement(state, 'sentinel');
            break;
        case 3: {
            const res = Rando.choice(ALL_R0, state.rng);
            addStock(state.stockpile, res, 3);
            state.log.push(`Windfall: Cache of 3 ${state.names[res]}!`);
            break;
        }
        case 4:
            state.calmNextTurn = true;
            state.log.push('Windfall: A calm settles over the land.');
            break;
        case 5:
            state.log.push('Windfall: Resonance! Production doubled this turn.');
            runProduction(state);
            break;
        case 6:
            state.log.push('Windfall: Bountiful harvest!');
            gatherResources(state);
            break;
    }
}

// ---- Mandate ----

function checkMandate(state) {
    let allComplete = true;
    let revealNext = false;
    for (const goal of state.mandate) {
        if (goal.revealed && goal.produced >= goal.quantity) {
            if (revealNext) continue;
            const next = state.mandate.find(g => !g.revealed);
            if (next) { next.revealed = true; revealNext = true; }
        }
        if (goal.produced < goal.quantity) allComplete = false;
    }
    if (allComplete) {
        state.victory = true;
        state.log.push(`The Mandate is fulfilled in ${state.turn} turns!`);
    }
}

// ---- Cheat Functions ----

export function cheatSpawnEnemies(state, q, r) {
    const hexes = [{ q, r }, ...hexNeighbors(q, r)];
    const types = ['E0', 'E1', 'E2', 'broodMother', 'E0', 'E1', 'E2'];
    for (let i = 0; i < 7; i++) {
        const h = hexes[i];
        if (!state.map.has(hexKey(h.q, h.r))) continue;
        const type = types[i];
        const eDef = ENEMY_TYPES[type];
        const speed = Array.isArray(eDef.speed) ? eDef.speed[1] : eDef.speed;
        state.enemies.push({
            id: newId(), type, q: h.q, r: h.r,
            speed, strength: eDef.strength
        });
    }
    state.log.push('CHEAT: Spawned enemies');
}

export function cheatMaterials(state) {
    const slots = ['R0a','R0b','R0c','R0d','P1a','P1b','P1c','P1d','P2a','P2b','P2c','P2d','P3a','P3b','P3c','P3d'];
    for (const s of slots) {
        state.stockpile[s] = (state.stockpile[s] || 0) + 100;
    }
    state.log.push('CHEAT: +100 all resources');
}

export function cheatSpawnUnits(state, q, r) {
    const hexes = [{ q, r }, ...hexNeighbors(q, r)];
    const types = ['sentinel', 'longbow', 'seeker', 'catapult', 'mason', 'gatherer', 'sentinel'];
    let placed = 0;
    for (let i = 0; i < 7; i++) {
        const h = hexes[i];
        if (!state.map.has(hexKey(h.q, h.r))) continue;
        if (state.units.some(u => u.q === h.q && u.r === h.r)) continue;
        const type = types[i];
        state.units.push({
            id: newId(), type, q: h.q, r: h.r,
            mp: UNIT_TYPES[type].mp, carrying: null
        });
        placed++;
    }
    state.log.push(`CHEAT: Spawned ${placed} units`);
}

export function cheatElevate(state, unitId) {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit) return false;
    const path = UPGRADE_PATH[unit.type];
    if (!path) return false;
    unit.type = path.next;
    unit.mp = UNIT_TYPES[path.next].mp;
    state.log.push(`CHEAT: Elevated to ${UNIT_TYPES[path.next].name}`);
    return true;
}
