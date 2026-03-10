// game.js — Waowisha game state and logic

import { HEX_SIZE, TERRAIN, TERRAIN_INFO, UNIT_TYPES, ENEMY_TYPES, SPOILS,
    RECIPES, STRUCTURE_TYPES, PRODUCTION_RECIPES, CRT, CRT_COLUMNS,
    SUPPLY_CRATE, VISIBILITY_RANGE, SURGE_INTERVAL, WINDFALL_CHANCE,
    BASE_SPAWN_CHANCE,
    DRIFT_CHARGE_RANGE, DRIFT_CHARGE_RADIUS, ALL_R0, ALL_P1, MAP_SIZE
} from './config.js';
import { hexKey, parseHexKey, hexNeighbors, hexDistance, hexesInRange, bfsHexes, findPath } from './hex.js';
import { Rando } from './rando.js';
import { generateGameNames } from './names.js';

let nextId = 1;
function newId() { return nextId++; }

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
        if (seed.terrain !== TERRAIN.PALE) continue; // may have been claimed by prior cluster
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
    // Find center-ish Pale hex
    let best = null, bestScore = -Infinity;
    const midCol = MAP_SIZE / 2, midRow = MAP_SIZE / 2;
    for (const hex of hexes.values()) {
        if (hex.terrain !== TERRAIN.PALE) continue;
        const dist = Math.abs(hex.col - midCol) + Math.abs(hex.row - midRow);
        // Count passable neighbors
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

// ---- Mandate Generation ----

function generateMandate(rng) {
    const goals = [];
    // 6 goals: first 3 are Tier 2, last 3 are Tier 3
    const t2 = ['P2a', 'P2b', 'P2c', 'P2d'];
    const t3 = ['P3a', 'P3b', 'P3c', 'P3d'];
    Rando.shuffle(t2, rng);
    Rando.shuffle(t3, rng);

    // 3 Tier 2 goals
    for (let i = 0; i < 3; i++) {
        goals.push({ product: t2[i], quantity: Rando.int(2, 4, rng), produced: 0, revealed: i < 2 });
    }
    // 3 Tier 3 goals
    for (let i = 0; i < 3; i++) {
        goals.push({ product: t3[i], quantity: Rando.int(1, 3, rng), produced: 0, revealed: false });
    }
    return goals;
}

// ---- Visibility ----

export function computeVisibility(state) {
    const visible = new Set();
    // Units provide visibility
    for (const unit of state.units) {
        const range = VISIBILITY_RANGE + (unit.type === 'seeker' ? UNIT_TYPES.seeker.reveal : 0);
        for (const h of hexesInRange(unit.q, unit.r, range)) {
            visible.add(hexKey(h.q, h.r));
        }
    }
    // Structures provide visibility
    for (const s of state.structures) {
        for (const h of hexesInRange(s.q, s.r, VISIBILITY_RANGE)) {
            visible.add(hexKey(h.q, h.r));
        }
    }
    // Settlement
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

    const unitDef = UNIT_TYPES[unit.type];
    const mp = unit.mp;

    const enemyKeys = new Set(state.enemies.map(e => hexKey(e.q, e.r)));
    const friendlyKeys = new Set(state.units.filter(u => u.id !== unitId).map(u => hexKey(u.q, u.r)));

    const costs = bfsHexes(
        { q: unit.q, r: unit.r },
        state.map,
        hex => {
            const k = hexKey(hex.q, hex.r);
            // Friendly-occupied hexes block movement (can't pass through)
            if (friendlyKeys.has(k)) return Infinity;
            // Enemy hexes are reachable (initiates combat) but block further pathing
            if (enemyKeys.has(k)) return TERRAIN_INFO[hex.terrain].moveCost;
            return TERRAIN_INFO[hex.terrain].moveCost;
        },
        mp
    );
    costs.delete(hexKey(unit.q, unit.r));

    // Remove friendly-occupied hexes from results (shouldn't be there, but safety)
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

    return costs;
}

// ---- Combat ----

function resolveCRT(attackerStr, defenderStr, rng) {
    const ratio = attackerStr / defenderStr;
    let col;
    if (ratio < 0.75) col = '1:2';
    else if (ratio < 1.5) col = '1:1';
    else if (ratio < 2.5) col = '2:1';
    else if (ratio < 3.5) col = '3:1';
    else col = '4:1';

    const roll = Rando.int(0, 5, rng);
    return CRT[col][roll];
}

function grantSpoils(state, enemyType, rng) {
    const spoil = SPOILS[enemyType];
    if (!spoil) return;
    if (spoil.R0) {
        for (let i = 0; i < spoil.R0; i++) {
            const res = Rando.choice(ALL_R0, rng);
            state.stockpile[res] = (state.stockpile[res] || 0) + 1;
        }
    }
    if (spoil.P1) {
        for (let i = 0; i < spoil.P1; i++) {
            const res = Rando.choice(ALL_P1, rng);
            state.stockpile[res] = (state.stockpile[res] || 0) + 1;
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

    // Starting stockpile from supply crate
    const stockpile = {};
    for (const [res, amt] of Object.entries(SUPPLY_CRATE)) {
        stockpile[res] = amt;
    }

    // Starting Warden
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
        mandate: generateMandate(rng),
        settlement,
        visible: new Set(),
        gameOver: false, victory: false,
        log: [],
        selectedUnit: null,
        reachable: new Map(),
        buildMode: null,  // structureType if in build mode
        calmNextTurn: false, // windfall: no spawns next turn
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

    // Check if enemy on target hex — initiate combat
    const enemyIdx = state.enemies.findIndex(e => hexKey(e.q, e.r) === targetKey);
    if (enemyIdx >= 0) {
        const enemy = state.enemies[enemyIdx];
        const unitDef = UNIT_TYPES[unit.type];

        // Get adjacent friendly units for multi-unit attack
        let totalStr = unitDef.strength;
        for (const other of state.units) {
            if (other.id === unit.id) continue;
            const dist = hexDistance(other.q, other.r, tq, tr);
            if (dist === 1) totalStr += UNIT_TYPES[other.type].strength;
        }

        const result = resolveCRT(totalStr, enemy.strength, state.rng);
        state.log.push(`Attack ${state.names[enemy.type] || enemy.type}: ${result}`);

        if (result === 'DE' || result === 'EX') {
            grantSpoils(state, enemy.type, state.rng);
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
    const cost = state.reachable.get(targetKey) || 0;
    unit.q = tq; unit.r = tr;
    unit.mp = Math.max(0, unit.mp - cost);
    deselectUnit(state);
    return 'move';
}

export function recruitUnit(state, unitType) {
    const def = UNIT_TYPES[unitType];
    if (!def || !def.cost) return false;

    // Check cost
    for (const [res, amt] of Object.entries(def.cost)) {
        if ((state.stockpile[res] || 0) < amt) return false;
    }

    // Pay cost
    for (const [res, amt] of Object.entries(def.cost)) {
        state.stockpile[res] -= amt;
    }

    // Place adjacent to settlement
    const { q, r } = parseHexKey(state.settlement);
    const neighbors = hexNeighbors(q, r);
    let placed = false;
    const occupied = new Set(state.units.map(u => hexKey(u.q, u.r)));
    for (const n of neighbors) {
        const k = hexKey(n.q, n.r);
        if (occupied.has(k)) continue;
        const hex = state.map.get(k);
        if (!hex || TERRAIN_INFO[hex.terrain].moveCost === Infinity) continue;
        state.units.push({
            id: newId(), type: unitType, q: n.q, r: n.r,
            mp: UNIT_TYPES[unitType].mp, carrying: null
        });
        placed = true;
        break;
    }

    if (!placed) {
        // Refund
        for (const [res, amt] of Object.entries(def.cost)) {
            state.stockpile[res] = (state.stockpile[res] || 0) + amt;
        }
        return false;
    }

    state.log.push(`Recruited ${def.name}`);
    return true;
}

export function startBuild(state, unitId, structureType) {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit) return false;
    const unitDef = UNIT_TYPES[unit.type];
    if (!unitDef.build) return false;

    const sDef = STRUCTURE_TYPES[structureType];
    if (!sDef) return false;

    // Check cost
    for (const [res, amt] of Object.entries(sDef.cost)) {
        if ((state.stockpile[res] || 0) < amt) return false;
    }

    // Check no structure already on this hex
    const k = hexKey(unit.q, unit.r);
    if (state.structures.some(s => hexKey(s.q, s.r) === k)) return false;
    if (k === state.settlement) return false;

    // Pay cost
    for (const [res, amt] of Object.entries(sDef.cost)) {
        state.stockpile[res] -= amt;
    }

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

    // Check visibility
    const targetKey = hexKey(tq, tr);
    if (!state.visible.has(targetKey)) return false;

    // Destroy all enemies in radius
    const blastZone = new Set(hexesInRange(tq, tr, DRIFT_CHARGE_RADIUS).map(h => hexKey(h.q, h.r)));
    const killed = state.enemies.filter(e => blastZone.has(hexKey(e.q, e.r)));
    for (const e of killed) grantSpoils(state, e.type, state.rng);
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

export function canAfford(state, cost) {
    for (const [res, amt] of Object.entries(cost)) {
        if ((state.stockpile[res] || 0) < amt) return false;
    }
    return true;
}

// ---- End Turn ----

export function endTurn(state) {
    if (state.gameOver || state.victory) return;

    // Reset unit moved flags at the start (they'll be set again next player phase)
    // But first: run automated phases

    // 1. Production Phase
    productionPhase(state);

    // 2. Defense Phase
    defensePhase(state);

    // 3. Drift Phase
    driftPhase(state);

    // 4. Spawn Phase
    if (!state.calmNextTurn) {
        spawnPhase(state);
    } else {
        state.calmNextTurn = false;
        state.log.push('The Drift is calm this turn.');
    }

    // 5. Windfall check
    if (Rando.bool(WINDFALL_CHANCE, state.rng)) {
        resolveWindfall(state);
    }

    // 6. Check mandate
    checkMandate(state);

    // 7. Advance turn
    state.turn++;
    for (const unit of state.units) unit.mp = UNIT_TYPES[unit.type].mp;
    state.visible = computeVisibility(state);
    deselectUnit(state);
}

const GATHER_RANGE = 2;

function gatherResources(state) {
    // Each resource hex can only be harvested once per turn
    const harvested = new Set();

    for (const unit of state.units) {
        const def = UNIT_TYPES[unit.type];
        if (!def.gather) continue;

        // Find harvestable hexes within range, sorted nearest first
        const candidates = [];
        for (const h of hexesInRange(unit.q, unit.r, GATHER_RANGE)) {
            const k = hexKey(h.q, h.r);
            if (harvested.has(k)) continue;
            const hex = state.map.get(k);
            if (!hex) continue;
            const info = TERRAIN_INFO[hex.terrain];
            if (!info || !info.resource) continue;
            candidates.push({ hex, key: k, dist: hexDistance(unit.q, unit.r, h.q, h.r) });
        }
        candidates.sort((a, b) => a.dist - b.dist);

        let remaining = def.gather;
        for (const c of candidates) {
            if (remaining <= 0) break;
            const res = TERRAIN_INFO[c.hex.terrain].resource;
            state.stockpile[res] = (state.stockpile[res] || 0) + 1;
            remaining--;
            harvested.add(c.key);
        }
    }
}

function productionPhase(state) {
    gatherResources(state);

    // Production buildings process recipes
    for (const s of state.structures) {
        if (s.buildProgress > 0) {
            // Check if builder is still on hex
            const builder = state.units.find(u => u.id === s.builderId);
            if (builder && hexKey(builder.q, builder.r) === hexKey(s.q, s.r)) {
                const builderDef = UNIT_TYPES[builder.type];
                s.buildProgress = Math.max(0, s.buildProgress - 1);
                if (s.buildProgress === 0) {
                    state.log.push(`${STRUCTURE_TYPES[s.type].name} complete!`);
                    s.builderId = null;
                }
            }
            continue;
        }

        const sDef = STRUCTURE_TYPES[s.type];
        if (sDef.category !== 'production') continue;
        if (!s.recipe) continue;

        const recipe = RECIPES[s.recipe];
        if (!recipe) continue;

        // Check inputs
        let canProduce = true;
        for (const [res, amt] of Object.entries(recipe.inputs)) {
            if ((state.stockpile[res] || 0) < amt) { canProduce = false; break; }
        }
        if (!canProduce) continue;

        // Consume inputs, produce output
        for (const [res, amt] of Object.entries(recipe.inputs)) {
            state.stockpile[res] -= amt;
        }
        state.stockpile[s.recipe] = (state.stockpile[s.recipe] || 0) + 1;

        // Check mandate progress
        for (const goal of state.mandate) {
            if (goal.product === s.recipe && goal.produced < goal.quantity) {
                goal.produced++;
                break;
            }
        }
    }
}

function defensePhase(state) {
    // Each tower fires once at a visible enemy in range
    for (const s of state.structures) {
        if (s.buildProgress > 0) continue;
        const sDef = STRUCTURE_TYPES[s.type];
        if (sDef.category !== 'defense') continue;

        const inRange = state.enemies.filter(e => {
            const dist = hexDistance(s.q, s.r, e.q, e.r);
            return dist <= sDef.range && state.visible.has(hexKey(e.q, e.r));
        });

        if (inRange.length === 0) continue;

        if (sDef.targeting === 'all') {
            // Ward Pylon: hit all
            const killed = [];
            for (const e of inRange) {
                if (sDef.power >= e.strength) killed.push(e);
            }
            for (const e of killed) {
                grantSpoils(state, e.type, state.rng);
            }
            state.enemies = state.enemies.filter(e => !killed.includes(e));
            if (killed.length > 0) state.log.push(`${sDef.name} destroyed ${killed.length} enemies`);
        } else {
            // Single target
            let target;
            if (sDef.targeting === 'weakest') {
                inRange.sort((a, b) => a.strength - b.strength || hexDistance(s.q, s.r, a.q, a.r) - hexDistance(s.q, s.r, b.q, b.r));
            } else {
                inRange.sort((a, b) => b.strength - a.strength || hexDistance(s.q, s.r, a.q, a.r) - hexDistance(s.q, s.r, b.q, b.r));
            }
            target = inRange[0];
            if (sDef.power >= target.strength) {
                grantSpoils(state, target.type, state.rng);
                state.enemies = state.enemies.filter(e => e !== target);
                state.log.push(`${sDef.name} destroyed a ${state.names[target.type] || target.type}`);
            }
        }
    }
}

function driftPhase(state) {
    // Brood Mothers spawn E0s
    const newE0s = [];
    for (const e of state.enemies) {
        if (e.type !== 'broodMother') continue;
        const neighbors = hexNeighbors(e.q, e.r);
        const valid = neighbors.filter(n => {
            const h = state.map.get(hexKey(n.q, n.r));
            return h && TERRAIN_INFO[h.terrain].moveCost < Infinity;
        });
        if (valid.length > 0) {
            const spot = Rando.choice(valid, state.rng);
            newE0s.push({
                id: newId(), type: 'E0', q: spot.q, r: spot.r,
                speed: 1, strength: ENEMY_TYPES.E0.strength
            });
        }
    }
    state.enemies.push(...newE0s);

    // Move all enemies
    for (const enemy of state.enemies) {
        moveEnemy(state, enemy);
    }

    // Check enemy-on-unit combat
    for (const enemy of [...state.enemies]) {
        const ek = hexKey(enemy.q, enemy.r);
        const unit = state.units.find(u => hexKey(u.q, u.r) === ek);
        if (!unit) continue;

        const unitDef = UNIT_TYPES[unit.type];
        if (enemy.strength > unitDef.strength) {
            state.log.push(`${state.names[enemy.type] || enemy.type} destroyed your ${unitDef.name}!`);
            state.units = state.units.filter(u => u.id !== unit.id);
        } else if (enemy.strength === unitDef.strength) {
            state.log.push(`Exchange: ${unitDef.name} and ${state.names[enemy.type] || enemy.type} both destroyed`);
            state.units = state.units.filter(u => u.id !== unit.id);
            grantSpoils(state, enemy.type, state.rng);
            state.enemies = state.enemies.filter(e => e !== enemy);
        } else {
            grantSpoils(state, enemy.type, state.rng);
            state.enemies = state.enemies.filter(e => e !== enemy);
        }
    }

    // Check enemy-on-structure combat
    for (const enemy of [...state.enemies]) {
        const ek = hexKey(enemy.q, enemy.r);
        const struct = state.structures.find(s => hexKey(s.q, s.r) === ek && s.buildProgress === 0);
        if (!struct) continue;
        const sDef = STRUCTURE_TYPES[struct.type];
        if (enemy.strength > sDef.power) {
            state.log.push(`${state.names[enemy.type] || enemy.type} destroyed ${sDef.name}!`);
            state.structures = state.structures.filter(s => s !== struct);
        } else {
            grantSpoils(state, enemy.type, state.rng);
            state.enemies = state.enemies.filter(e => e !== enemy);
        }
    }

    // Check if enemy reached settlement
    for (const enemy of state.enemies) {
        if (hexKey(enemy.q, enemy.r) === state.settlement) {
            const defender = state.units.find(u => hexKey(u.q, u.r) === state.settlement);
            if (!defender) {
                state.gameOver = true;
                state.log.push('The Drift has reached The Loom. Game Over.');
                return;
            }
        }
    }
}

function moveEnemy(state, enemy) {
    const eDef = ENEMY_TYPES[enemy.type];
    const steps = enemy.speed || eDef.speed;

    for (let s = 0; s < steps; s++) {
        let target = null;

        if (eDef.behavior === 'random') {
            // Random walk
            const neighbors = hexNeighbors(enemy.q, enemy.r);
            const valid = neighbors.filter(n => {
                const h = state.map.get(hexKey(n.q, n.r));
                return h && TERRAIN_INFO[h.terrain].moveCost < Infinity;
            });
            if (valid.length > 0) {
                target = Rando.choice(valid, state.rng);
            }
        } else if (eDef.behavior === 'seekUnit') {
            target = seekNearest(state, enemy, [...state.units.map(u => ({q:u.q,r:u.r})), ...state.structures.map(s => ({q:s.q,r:s.r}))]);
        } else if (eDef.behavior === 'seekSettlement') {
            const { q, r } = parseHexKey(state.settlement);
            target = seekTarget(state, enemy, q, r);
        } else if (eDef.behavior === 'seekResource') {
            target = seekNearestResource(state, enemy);
        }

        if (target) {
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

function spawnPhase(state) {
    // Base spawn
    if (Rando.bool(BASE_SPAWN_CHANCE, state.rng)) {
        spawnEnemyOnEdge(state, 'E0');
    }

    // Surge check
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
    const edgeHexes = [];
    for (const hex of state.map.values()) {
        if (hex.isEdge && TERRAIN_INFO[hex.terrain].moveCost < Infinity) {
            edgeHexes.push(hex);
        }
    }
    // Also use hexes adjacent to edge Deep/Crag that are passable
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

function resolveWindfall(state) {
    const roll = Rando.int(1, 6, state.rng);
    switch (roll) {
        case 1: {
            // Rich Vein: turn a Pale hex near a Vein into Vein
            const veins = [];
            for (const hex of state.map.values()) {
                if (hex.terrain === TERRAIN.VEIN) veins.push(hex);
            }
            if (veins.length > 0) {
                const v = Rando.choice(veins, state.rng);
                for (const n of hexNeighbors(v.q, v.r)) {
                    const h = state.map.get(hexKey(n.q, n.r));
                    if (h && h.terrain === TERRAIN.PALE) {
                        h.terrain = TERRAIN.VEIN;
                        state.log.push('Windfall: Rich Vein discovered!');
                        return;
                    }
                }
            }
            break;
        }
        case 2:
            // Wandering Sentinel
            state.log.push('Windfall: A Sentinel wanders to The Loom!');
            recruitFree(state, 'sentinel');
            break;
        case 3: {
            const res = Rando.choice(ALL_R0, state.rng);
            state.stockpile[res] = (state.stockpile[res] || 0) + 3;
            state.log.push(`Windfall: Cache of 3 ${state.names[res]}!`);
            break;
        }
        case 4:
            state.calmNextTurn = true;
            state.log.push('Windfall: A calm settles over the land.');
            break;
        case 5:
            // Double production this turn (already produced, so produce again)
            state.log.push('Windfall: Resonance! Production doubled this turn.');
            productionPhaseBuildings(state);
            break;
        case 6:
            // Double gather (already gathered, so gather again)
            state.log.push('Windfall: Bountiful harvest!');
            productionPhaseGather(state);
            break;
    }
}

function recruitFree(state, type) {
    const { q, r } = parseHexKey(state.settlement);
    const neighbors = hexNeighbors(q, r);
    const occupied = new Set(state.units.map(u => hexKey(u.q, u.r)));
    for (const n of neighbors) {
        const k = hexKey(n.q, n.r);
        if (occupied.has(k)) continue;
        const hex = state.map.get(k);
        if (!hex || TERRAIN_INFO[hex.terrain].moveCost === Infinity) continue;
        state.units.push({ id: newId(), type, q: n.q, r: n.r, mp: UNIT_TYPES[type].mp, carrying: null });
        return;
    }
}

function productionPhaseBuildings(state) {
    for (const s of state.structures) {
        if (s.buildProgress > 0) continue;
        const sDef = STRUCTURE_TYPES[s.type];
        if (sDef.category !== 'production') continue;
        if (!s.recipe) continue;
        const recipe = RECIPES[s.recipe];
        if (!recipe) continue;
        let canProduce = true;
        for (const [res, amt] of Object.entries(recipe.inputs)) {
            if ((state.stockpile[res] || 0) < amt) { canProduce = false; break; }
        }
        if (!canProduce) continue;
        for (const [res, amt] of Object.entries(recipe.inputs)) state.stockpile[res] -= amt;
        state.stockpile[s.recipe] = (state.stockpile[s.recipe] || 0) + 1;
        for (const goal of state.mandate) {
            if (goal.product === s.recipe && goal.produced < goal.quantity) { goal.produced++; break; }
        }
    }
}

function productionPhaseGather(state) {
    gatherResources(state);
}

function checkMandate(state) {
    let allComplete = true;
    let revealNext = false;
    for (const goal of state.mandate) {
        if (goal.revealed && goal.produced >= goal.quantity) {
            if (revealNext) continue;
            // Reveal next unrevealed goal
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
