// index.js — Wilds of Mariguez

import { HEX_SIZE, TERRAIN, HECTO_COST, EVASCOR_COST, ACCESSIBLE, LIGHT_VARIANT, PLAYER_MP, MAP_COLS, MAP_ROWS } from './config.js';

const CITY_COUNT = 3;
import { hexToPixel, pixelToHex, hexKey, hexNeighbors, hexDistance, bfsHexes, findPath, drawHexPath } from './hex.js';
import { Rando } from './rando.js';
import { ColorTheory } from './colortheory.js';

// ============================================================
// Constants
// ============================================================

const COUNTER_SIZE = 28;
const NOTIFY_MS = 3000;
const JHIRLE_MP = 4;

const TERRAIN_COLORS = {
    [TERRAIN.WATER]: '#2a6faa',
    [TERRAIN.PLAINS]: '#7db344',
    [TERRAIN.HILLS]: '#c4a44a',
    [TERRAIN.MOUNTAIN]: '#7a7a7a',
    [TERRAIN.FOREST]: '#2d6e2d',
    [TERRAIN.GOLD]: '#d4a017',
    [TERRAIN.QUARRY]: '#9e8c6c',
    [TERRAIN.CITY]: '#c8a860',
    [TERRAIN.PLAINS_DARK]: '#3e5922',
    [TERRAIN.HILLS_DARK]: '#625225',
    [TERRAIN.MOUNTAIN_DARK]: '#3d3d3d',
    [TERRAIN.FOREST_DARK]: '#163716',
    [TERRAIN.GOLD_DARK]: '#6a500c',
    [TERRAIN.QUARRY_DARK]: '#4f4636',
};

const HECTO_COLOR = '#cc3333';
const EVASCOR_COLOR = '#888888';
const JHIRLE_COLOR = '#9944cc';
const SCROLL_COLOR = '#d2b48c';
const ARTIFACT_COLOR = '#4488ff';

// ============================================================
// Data — Artifacts
// ============================================================

const ARTIFACTS = [
    { id: 1,  name: 'Wind Striders',       role: 'mobility',  template: 'activated', desc: 'Hecto moves at cost 1 this turn', cooldown: 3, effect: 'hecto_move_cost_1', duration: 1 },
    { id: 2,  name: 'Blink Shard',         role: 'mobility',  template: 'targeted',  desc: 'Teleport Hecto to target hex',     cooldown: 4, range: 4, effect: 'teleport_hecto' },
    { id: 3,  name: 'Tide Charm',          role: 'mobility',  template: 'targeted',  desc: 'Convert water hex to plains',      cooldown: 0, range: 3, effect: 'convert_water_to_plains' },
    { id: 4,  name: 'Tremor Stone',        role: 'mobility',  template: 'targeted',  desc: 'Warp Evascor to target hex',       cooldown: 4, range: 3, effect: 'move_evascor_to_hex' },
    { id: 5,  name: 'Gauntlet of Ruin',    role: 'combat',    template: 'targeted',  desc: 'Kill one enemy on target hex',     cooldown: 4, range: 2, effect: 'kill_enemy_at_hex' },
    { id: 6,  name: 'Bellowing Horn',      role: 'combat',    template: 'activated', desc: 'Push enemies away from Evascor',   cooldown: 3, effect: 'push_adjacent_enemies' },
    { id: 7,  name: 'Ember Rod',           role: 'combat',    template: 'one_use',   desc: 'Kill all enemies near Evascor',    effect: 'kill_enemies_in_radius', value: 2 },
    { id: 8,  name: "Puppeteer's Thread",  role: 'combat',    template: 'targeted',  desc: 'Enemy attacks its own allies',     cooldown: 5, range: 3, effect: 'enemy_attacks_allies' },
    { id: 9,  name: 'Prism of Far Light',  role: 'scouting',  template: 'activated', desc: 'Reveal hidden artifacts within 8 hexes',  cooldown: 3, effect: 'reveal_hexes_radius', value: 8 },
    { id: 10, name: 'Danger Sense Amulet', role: 'scouting',  template: 'passive',   desc: 'Spawn hexes are highlighted',      effect: 'show_spawn_hexes' },
    { id: 11, name: 'Whispering Veil',     role: 'scouting',  template: 'activated', desc: "Reveal Jhirle's target",           cooldown: 5, effect: 'show_jhirle_target' },
    { id: 12, name: 'Cloak of Fading',     role: 'survival',  template: 'activated', desc: 'Monsters ignore Hecto 2 turns',    cooldown: 6, effect: 'hecto_invisible', duration: 2 },
    { id: 13, name: 'Stoneblood Elixir',   role: 'survival',  template: 'passive',   desc: "Hecto survives monsters but freezes in place",   effect: 'hecto_invulnerable' },
    { id: 14, name: 'Iron Skull Helm',     role: 'survival',  template: 'passive',   desc: 'Negate first stun',                effect: 'negate_stun' },
    { id: 15, name: 'Blazing Mantle',      role: 'survival',  template: 'activated', desc: 'Evascor routine +2 this turn',     cooldown: 4, effect: 'routine_boost', value: 2, duration: 1 },
    { id: 16, name: 'Thornbark Seed',      role: 'terrain',   template: 'targeted',  desc: 'Grow forest on target area',       cooldown: 5, range: 4, effect: 'grow_forest' },
    { id: 17, name: 'Lodestone',           role: 'terrain',   template: 'activated', desc: 'Pull nearby enemies to Evascor',   cooldown: 3, effect: 'pull_enemies_toward', value: 3 },
    { id: 18, name: 'Dusk Lantern',        role: 'terrain',   template: 'activated', desc: 'Monsters skip movement next turn', cooldown: 5, effect: 'enemies_skip_movement' },
    { id: 19, name: 'Mirror of Echoes',    role: 'wildcard',  template: 'one_use',   desc: 'Place decoy that lures monsters',  effect: 'place_decoy', duration: 3 },
    { id: 20, name: 'Quicksilver Flask',   role: 'wildcard',  template: 'one_use',   desc: 'Gain 5 bonus MP this turn',        effect: 'gain_bonus_mp', value: 5 },
];

const ARTIFACT_BY_ID = new Map(ARTIFACTS.map(a => [a.id, a]));

// ============================================================
// Data — Effect Functions
// ============================================================

const EFFECT_FUNCTIONS = {
    // --- Mobility ---
    hecto_move_cost_1: {
        activate(gs, def) {
            gs.flags.hectoTerrainCostOne = def.duration || 1;
            notify('Wind Striders: all terrain costs 1!');
            if (gs.selectedUnit === 'hecto') computeReachable();
        }
    },
    teleport_hecto: {
        validate(gs, q, r, def) {
            const hex = gs.hexes.get(hexKey(q, r));
            if (!hex) return false;
            if (HECTO_COST[hex.terrain] === undefined) return false;
            const occ = buildOccupiedSet(gs);
            if (occ.has(hexKey(q, r))) return false;
            // Need a passable adjacent hex for Evascor too
            const eSpot = hexNeighbors(q, r).some(n => {
                const nh = gs.hexes.get(hexKey(n.q, n.r));
                return nh && EVASCOR_COST[nh.terrain] !== undefined && !occ.has(hexKey(n.q, n.r));
            });
            if (!eSpot) return false;
            return hexDistance(gs.hecto.q, gs.hecto.r, q, r) <= def.range;
        },
        apply(gs, q, r) {
            const occ = buildOccupiedSet(gs);
            gs.hecto.q = q;
            gs.hecto.r = r;
            // Place Evascor on nearest passable adjacent hex
            for (const n of hexNeighbors(q, r)) {
                const nh = gs.hexes.get(hexKey(n.q, n.r));
                if (nh && EVASCOR_COST[nh.terrain] !== undefined && !occ.has(hexKey(n.q, n.r))) {
                    gs.evascor.q = n.q;
                    gs.evascor.r = n.r;
                    break;
                }
            }
            notify('Hecto and Evascor teleport!');
            checkScrollPickup(q, r);
            checkArtifactClaim(q, r);
        }
    },
    convert_water_to_plains: {
        validate(gs, q, r, def) {
            const hex = gs.hexes.get(hexKey(q, r));
            if (!hex) return false;
            if (hex.terrain !== TERRAIN.WATER) return false;
            return hexDistance(gs.hecto.q, gs.hecto.r, q, r) <= def.range;
        },
        apply(gs, q, r) {
            const hex = gs.hexes.get(hexKey(q, r));
            hex.terrain = TERRAIN.PLAINS;
            notify('Water becomes solid ground!');
        }
    },
    move_evascor_to_hex: {
        validate(gs, q, r, def) {
            const hex = gs.hexes.get(hexKey(q, r));
            if (!hex) return false;
            if (EVASCOR_COST[hex.terrain] === undefined) return false;
            const occ = buildOccupiedSet(gs);
            if (occ.has(hexKey(q, r))) return false;
            return hexDistance(gs.hecto.q, gs.hecto.r, q, r) <= def.range;
        },
        apply(gs, q, r) {
            gs.evascor.q = q;
            gs.evascor.r = r;
            notify('Evascor warps!');
        }
    },

    // --- Combat ---
    kill_enemy_at_hex: {
        validate(gs, q, r, def) {
            if (!gs.enemies.some(e => e.q === q && e.r === r)) return false;
            return hexDistance(gs.hecto.q, gs.hecto.r, q, r) <= def.range;
        },
        apply(gs, q, r) {
            gs.enemies = gs.enemies.filter(e => !(e.q === q && e.r === r));
            notify('Gauntlet of Ruin strikes!');
        }
    },
    push_adjacent_enemies: {
        activate(gs) {
            const adj = gs.enemies.filter(e =>
                hexDistance(gs.evascor.q, gs.evascor.r, e.q, e.r) === 1
            );
            for (const e of adj) {
                const dq = e.q - gs.evascor.q;
                const dr = e.r - gs.evascor.r;
                for (let step = 0; step < 2; step++) {
                    const nq = e.q + dq;
                    const nr = e.r + dr;
                    const hex = gs.hexes.get(hexKey(nq, nr));
                    if (!hex || !isAccessible(hex.terrain) || hex.terrain === TERRAIN.MOUNTAIN) break;
                    e.q = nq;
                    e.r = nr;
                }
            }
            notify(`Horn pushes ${adj.length} enemies back!`);
        }
    },
    kill_enemies_in_radius: {
        activate(gs, def) {
            const range = def.value || 2;
            const killed = gs.enemies.filter(e =>
                hexDistance(gs.evascor.q, gs.evascor.r, e.q, e.r) <= range
            );
            gs.enemies = gs.enemies.filter(e =>
                hexDistance(gs.evascor.q, gs.evascor.r, e.q, e.r) > range
            );
            notify(`Ember Rod incinerates ${killed.length} enemies!`);
        }
    },
    enemy_attacks_allies: {
        validate(gs, q, r, def) {
            if (!gs.enemies.some(e => e.q === q && e.r === r)) return false;
            return hexDistance(gs.hecto.q, gs.hecto.r, q, r) <= def.range;
        },
        apply(gs, q, r) {
            const adjKilled = gs.enemies.filter(e =>
                !(e.q === q && e.r === r) && hexDistance(e.q, e.r, q, r) === 1
            );
            gs.enemies = gs.enemies.filter(e => !adjKilled.includes(e));
            notify(`Thread turns ${adjKilled.length} enemies against each other!`);
        }
    },

    // --- Scouting ---
    reveal_hexes_radius: {
        activate(gs, def) {
            const range = def.value || 8;
            let count = 0;
            for (const art of gs.artifacts) {
                if (art.revealed || art.claimed) continue;
                if (hexDistance(gs.hecto.q, gs.hecto.r, art.q, art.r) <= range) {
                    art.revealed = true;
                    count++;
                }
            }
            if (count > 0) notify(`Prism reveals ${count} artifact${count > 1 ? 's' : ''}!`);
            else notify('Prism reveals nothing new nearby.');
        }
    },
    show_spawn_hexes: {
        // Passive — handled in render
    },
    show_jhirle_target: {
        activate(gs) {
            if (!gs.jhirle.active) {
                notify('Jhirle is not yet in the Wilds.');
                return false;
            }
            gs.flags.showJhirleTarget = true;
            if (gs.jhirle.targetId) {
                const def = ARTIFACT_BY_ID.get(gs.jhirle.targetId);
                if (def) notify(`Jhirle seeks: ${def.name}`);
                else notify('Jhirle is heading to a city.');
            } else {
                notify('Jhirle has no target.');
            }
        }
    },

    // --- Survival ---
    hecto_invisible: {
        activate(gs, def) {
            gs.flags.hectoInvisible = def.duration || 2;
            notify('Hecto fades from sight!');
        }
    },
    hecto_invulnerable: {
        activate(gs, def) {
            gs.flags.hectoInvulnerable = def.duration || 1;
            notify("Hecto can't die but can't move!");
        }
    },
    negate_stun: {
        // Passive — handled in evascorCombat
    },
    routine_boost: {
        activate(gs, def) {
            gs.flags.routineBoost = def.value || 2;
            notify(`Evascor routine boosted to ${gs.evascor.routineBase + gs.flags.routineBoost}!`);
        }
    },

    // --- Terrain Control ---
    grow_forest: {
        validate(gs, q, r, def) {
            const hex = gs.hexes.get(hexKey(q, r));
            if (!hex) return false;
            if (!isAccessible(hex.terrain) || hex.terrain === TERRAIN.WATER) return false;
            if (hex.terrain === TERRAIN.CITY) return false;
            return hexDistance(gs.hecto.q, gs.hecto.r, q, r) <= def.range;
        },
        apply(gs, q, r) {
            const hex = gs.hexes.get(hexKey(q, r));
            if (hex) hex.terrain = TERRAIN.FOREST;
            const neighbors = hexNeighbors(q, r);
            let converted = 0;
            for (const n of neighbors) {
                if (converted >= 2) break;
                const nh = gs.hexes.get(hexKey(n.q, n.r));
                if (nh && isAccessible(nh.terrain) && nh.terrain !== TERRAIN.WATER && nh.terrain !== TERRAIN.CITY) {
                    nh.terrain = TERRAIN.FOREST;
                    converted++;
                }
            }
            notify('Forest springs up!');
        }
    },
    pull_enemies_toward: {
        activate(gs, def) {
            const range = def.value || 3;
            const toMove = gs.enemies.filter(e =>
                hexDistance(gs.evascor.q, gs.evascor.r, e.q, e.r) <= range
            );
            for (const e of toMove) {
                const neighbors = hexNeighbors(e.q, e.r);
                let best = null;
                let bestDist = hexDistance(e.q, e.r, gs.evascor.q, gs.evascor.r);
                for (const n of neighbors) {
                    const hex = gs.hexes.get(hexKey(n.q, n.r));
                    if (!hex || !isAccessible(hex.terrain)) continue;
                    const d = hexDistance(n.q, n.r, gs.evascor.q, gs.evascor.r);
                    if (d < bestDist) { bestDist = d; best = n; }
                }
                if (best) { e.q = best.q; e.r = best.r; }
            }
            notify(`Lodestone pulls ${toMove.length} enemies closer!`);
        }
    },
    enemies_skip_movement: {
        activate(gs) {
            gs.flags.enemiesSkipMovement = true;
            notify('Dusk Lantern freezes all monsters!');
        }
    },

    // --- Wildcards ---
    place_decoy: {
        validate(gs, q, r) {
            const hex = gs.hexes.get(hexKey(q, r));
            if (!hex) return false;
            return isAccessible(hex.terrain) && hex.terrain !== TERRAIN.WATER;
        },
        apply(gs, q, r, def) {
            gs.decoy = { q, r, turnsLeft: def.duration || 3 };
            notify('A decoy shimmers into existence!');
        }
    },
    gain_bonus_mp: {
        activate(gs, def) {
            gs.mp += def.value || 5;
            notify(`Quicksilver Flask grants ${def.value || 5} bonus MP!`);
            if (gs.selectedUnit) computeReachable();
        }
    },
};

// ============================================================
// Artifact Activation
// ============================================================

function hasPassiveArtifact(gs, effectName) {
    return gs.inventory.some(inv => {
        const def = ARTIFACT_BY_ID.get(inv.id);
        return def.template === 'passive' && def.effect === effectName && !inv.spent;
    });
}

function activateArtifact(invIndex) {
    const gs = gameState;
    if (gs.gameOver) return;
    if (gs.mp < 1) {
        notify('Need 1 MP to activate!');
        return;
    }

    const inv = gs.inventory[invIndex];
    if (!inv || inv.spent) return;
    if (inv.cooldownRemaining > 0) {
        notify('Artifact is on cooldown!');
        return;
    }

    const def = ARTIFACT_BY_ID.get(inv.id);
    if (def.template === 'passive') return;

    const fn = EFFECT_FUNCTIONS[def.effect];
    if (!fn) return;

    // Targeted effect — enter targeting mode (MP deducted on apply)
    if (fn.validate) {
        enterTargeting(invIndex);
        return;
    }

    // Immediate effect
    const result = fn.activate(gs, def);
    if (result === false) return;

    gs.mp -= 1;
    showArtifactActivation(def);

    if (def.template === 'one_use') {
        gs.inventory.splice(invIndex, 1);
    } else if (def.cooldown > 0) {
        inv.cooldownRemaining = def.cooldown;
    }

    if (gs.mp <= 0) { deselectUnit(); endTurn(); return; }
    if (gs.selectedUnit) computeReachable();
    updateHUD();
    render();
}

function enterTargeting(invIndex) {
    const gs = gameState;
    gs.targetingArtifact = invIndex;
    gs.targetingValid = new Set();

    const inv = gs.inventory[invIndex];
    const def = ARTIFACT_BY_ID.get(inv.id);
    const fn = EFFECT_FUNCTIONS[def.effect];

    for (const [key, hex] of gs.hexes) {
        if (fn.validate(gs, hex.q, hex.r, def)) {
            gs.targetingValid.add(key);
        }
    }

    gs.selectedUnit = null;
    gs.reachable = null;

    notify(`${def.name}: click a target hex (Esc to cancel)`);
    updateHUD();
    render();
}

function cancelTargeting() {
    const gs = gameState;
    gs.targetingArtifact = null;
    gs.targetingValid = null;
    updateHUD();
    render();
}

function applyTargetedEffect(q, r) {
    const gs = gameState;
    const invIndex = gs.targetingArtifact;
    const inv = gs.inventory[invIndex];
    const def = ARTIFACT_BY_ID.get(inv.id);
    const fn = EFFECT_FUNCTIONS[def.effect];

    fn.apply(gs, q, r, def);
    gs.mp -= 1;
    showArtifactActivation(def);

    if (def.template === 'one_use') {
        gs.inventory.splice(invIndex, 1);
    } else if (def.cooldown > 0) {
        inv.cooldownRemaining = def.cooldown;
    }

    gs.targetingArtifact = null;
    gs.targetingValid = null;

    if (gs.mp <= 0) { deselectUnit(); endTurn(); return; }
    if (gs.selectedUnit) computeReachable();
    updateHUD();
    render();
}

// ============================================================
// Data — Seer's Visions
// ============================================================

const TERRAIN_WORDS = {
    [TERRAIN.WATER]:    ['dark water', 'deep water', 'rushing water'],
    [TERRAIN.PLAINS]:   ['open ground', 'green fields', 'flat earth'],
    [TERRAIN.FOREST]:   ['tall trees', 'deep shade', 'green canopy'],
    [TERRAIN.HILLS]:    ['rising ground', 'stony slopes', 'high earth'],
    [TERRAIN.MOUNTAIN]: ['cold stone', 'gray peaks', 'impassable rock'],
    [TERRAIN.QUARRY]:   ['broken stone', 'golden earth', 'carved rock'],
    [TERRAIN.GOLD]:     ['gleaming ground', 'golden earth', 'bright soil'],
};

const VISION_TEMPLATES_2 = [
    (a, b) => `Where ${a} meets ${b}`,
    (a, b) => `${a} on two sides, touched by ${b}`,
    (a, b) => `Surrounded by ${a}, touched by ${b}`,
    (a, b) => `Between ${a} and ${b}`,
];

const VISION_TEMPLATES_3 = [
    (a, b, c) => `Between ${a} and ${b}, beside ${c}`,
    (a, b, c) => `Where ${a} meets ${b}, near ${c}`,
    (a, b, c) => `${a} and ${b}, touched by ${c}`,
];

// ============================================================
// Helpers
// ============================================================

function isAccessible(terrain) {
    return ACCESSIBLE.has(terrain);
}

function monsterColor() {
    const hue = Math.random();
    const [r, g, b] = ColorTheory.hslToRgb(hue, 1.0, 0.5);
    return ColorTheory.rgbToHex(r, g, b);
}

function buildOccupiedSet(gs) {
    const occupied = new Set();
    occupied.add(hexKey(gs.hecto.q, gs.hecto.r));
    occupied.add(hexKey(gs.evascor.q, gs.evascor.r));
    for (const e of gs.enemies) occupied.add(hexKey(e.q, e.r));
    if (gs.jhirle.active) occupied.add(hexKey(gs.jhirle.q, gs.jhirle.r));
    return occupied;
}

function nearestUnrevealedArtifact(q, r, artifacts) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const art of artifacts) {
        if (art.revealed || art.claimed) continue;
        const d = hexDistance(q, r, art.q, art.r);
        if (d < nearestDist) {
            nearestDist = d;
            nearest = art;
        }
    }
    return nearest;
}

function artifactAt(q, r, artifacts) {
    return artifacts.find(a => a.q === q && a.r === r && !a.claimed);
}

function unitAt(q, r, gs) {
    if (gs.hecto.q === q && gs.hecto.r === r) return 'hecto';
    if (gs.evascor.q === q && gs.evascor.r === r) return 'evascor';
    return null;
}

function isHiddenInForest(unit, hexes) {
    const hex = hexes.get(hexKey(unit.q, unit.r));
    return hex && hex.terrain === TERRAIN.FOREST;
}

function nearestOf(fromQ, fromR, targets) {
    let best = targets[0];
    let bestDist = hexDistance(fromQ, fromR, best.q, best.r);
    for (let i = 1; i < targets.length; i++) {
        const d = hexDistance(fromQ, fromR, targets[i].q, targets[i].r);
        if (d < bestDist) { bestDist = d; best = targets[i]; }
    }
    return best;
}

// ============================================================
// Placement
// ============================================================

function getPassableNonEdge(hexes) {
    const result = [];
    for (const [, hex] of hexes) {
        if (hex.isEdge) continue;
        if (!isAccessible(hex.terrain)) continue;
        if (hex.terrain === TERRAIN.MOUNTAIN) continue;
        result.push(hex);
    }
    return result;
}

function placeWithMinDistance(candidates, count, minDist, occupied) {
    const placed = [];
    const usedKeys = new Set(occupied);
    Rando.shuffle(candidates);

    for (const hex of candidates) {
        if (placed.length >= count) break;
        const key = hexKey(hex.q, hex.r);
        if (usedKeys.has(key)) continue;

        const tooClose = placed.some(p => hexDistance(hex.q, hex.r, p.q, p.r) < minDist);
        if (tooClose) continue;

        placed.push({ q: hex.q, r: hex.r });
        usedKeys.add(key);
    }
    return placed;
}

function generateVisions(hexes, artifacts) {
    const visionArtifacts = Rando.shuffle([...artifacts]).slice(0, 3);
    const visions = [];

    for (const art of visionArtifacts) {
        const neighbors = hexNeighbors(art.q, art.r);
        const terrainSet = new Set();
        for (const n of neighbors) {
            const h = hexes.get(hexKey(n.q, n.r));
            if (h) terrainSet.add(h.terrain);
        }
        const terrains = [...terrainSet];
        if (terrains.length < 2) continue;

        const words = terrains.map(t => Rando.choice(TERRAIN_WORDS[t] || ['unknown land']));
        const tmpl = terrains.length >= 3
            ? Rando.choice(VISION_TEMPLATES_3)
            : Rando.choice(VISION_TEMPLATES_2);
        const text = terrains.length >= 3
            ? tmpl(words[0], words[1], words[2])
            : tmpl(words[0], words[1]);
        visions.push({ text, artifactId: art.id });
    }
    return visions;
}

// ============================================================
// Map Generation
// ============================================================

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

function generateRectGrid() {
    const hexes = new Map();
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

            hexes.set(hexKey(q, r), { q, r, col, row, elevation, isEdge, terrain: null });
        }
    }
    return hexes;
}

function assignTerrain(hexes) {
    const inner = [];
    for (const [, hex] of hexes) {
        if (hex.isEdge) {
            // Eastern border is passable plains; other edges are water
            hex.terrain = (hex.col === MAP_COLS - 1) ? TERRAIN.PLAINS_DARK : TERRAIN.WATER;
            continue;
        }
        inner.push(hex);
    }
    inner.sort((a, b) => a.elevation - b.elevation);
    const n = inner.length;

    // Start dark; illuminateReachable will light up what's reachable
    for (let i = 0; i < n; i++) {
        const pct = i / n;
        if (pct < 0.25) inner[i].terrain = TERRAIN.WATER;
        else if (pct < 0.85) inner[i].terrain = TERRAIN.PLAINS_DARK;
        else if (pct < 0.95) inner[i].terrain = TERRAIN.HILLS_DARK;
        else inner[i].terrain = TERRAIN.MOUNTAIN_DARK;
    }

    const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS_DARK);
    Rando.shuffle(plains);
    const forestCount = Math.round(n * 0.10);
    let idx = 0;
    for (let i = 0; i < forestCount && idx < plains.length; i++, idx++)
        plains[idx].terrain = TERRAIN.FOREST_DARK;

    const hills = inner.filter(h => h.terrain === TERRAIN.HILLS_DARK);
    Rando.shuffle(hills);
    const quarryCount = Math.max(2, Math.round(n * 0.02));
    for (let i = 0; i < quarryCount && i < hills.length; i++)
        hills[i].terrain = TERRAIN.QUARRY_DARK;
}

function isPreIllumPassable(terrain) {
    return terrain !== TERRAIN.WATER && terrain !== TERRAIN.MOUNTAIN_DARK;
}

function placeCities(hexes) {
    // Place cities on the eastern border, spread evenly along the edge
    const eastEdge = [];
    for (const [, hex] of hexes) {
        if (hex.col !== MAP_COLS - 1) continue;
        if (hex.terrain === TERRAIN.WATER) continue;
        eastEdge.push(hex);
    }
    eastEdge.sort((a, b) => a.row - b.row);

    // Space cities evenly: divide edge into segments
    const spacing = Math.floor(eastEdge.length / (CITY_COUNT + 1));
    const cities = [];
    for (let i = 1; i <= CITY_COUNT; i++) {
        const hex = eastEdge[i * spacing];
        hex.terrain = TERRAIN.CITY;
        cities.push(hex);
    }
    return cities;
}

function placeUnits(hexes, cities) {
    // Start just inland from a random city
    const city = Rando.choice(cities);
    const candidates = hexNeighbors(city.q, city.r).filter(n => {
        const nh = hexes.get(hexKey(n.q, n.r));
        return nh && !nh.isEdge && isPreIllumPassable(nh.terrain);
    });

    for (let attempt = 0; attempt < 50; attempt++) {
        const hHex = Rando.choice(candidates);
        const eNeighbors = candidates.filter(n => !(n.q === hHex.q && n.r === hHex.r));
        if (eNeighbors.length === 0) continue;
        const eHex = Rando.choice(eNeighbors);
        return { hecto: { q: hHex.q, r: hHex.r }, evascor: { q: eHex.q, r: eHex.r } };
    }
    // Fallback
    const h = candidates[0];
    return { hecto: { q: h.q, r: h.r }, evascor: { q: h.q, r: h.r } };
}

function illuminateReachable(hexes, start) {
    const reachable = bfsHexes(start, hexes, hex => {
        if (hex.terrain === TERRAIN.WATER) return Infinity;
        return 1;
    }, Infinity);

    for (const [key, hex] of hexes) {
        const light = LIGHT_VARIANT[hex.terrain];
        if (reachable.has(key) && light !== undefined) {
            hex.terrain = light;
        }
    }
}

// ============================================================
// Game State
// ============================================================

let gameState = null;

function newGameState() {
    return {
        turn: 1,
        mp: PLAYER_MP,
        hecto: { q: 0, r: 0 },
        evascor: { q: 0, r: 0, routineBase: 3, stunned: false, stunCount: 0 },
        selectedUnit: null,
        reachable: null,
        hexes: null,
        scrolls: [],
        artifacts: [],
        visions: [],
        inventory: [],
        enemies: [],
        cities: [],
        jhirle: { q: 0, r: 0, active: false, knownArtifacts: new Set(), targetId: null, noProgressTurns: 0, claimCount: 0, lastDist: Infinity },
        jhirlePending: [],
        gameOver: false,
        targetingArtifact: null,
        targetingValid: null,
        decoy: null,
        flags: {
            hectoInvisible: 0,
            hectoInvulnerable: 0,
            hectoTerrainCostOne: 0,
            routineBoost: 0,
            enemiesSkipMovement: false,
            showJhirleTarget: false,
        },
    };
}

// ============================================================
// View State & Canvas
// ============================================================

let panX = 0, panY = 0;
let panning = false;
let panStartX = 0, panStartY = 0;
let panOrigX = 0, panOrigY = 0;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function hexToScreen(q, r) {
    const p = hexToPixel(q, r);
    return { x: p.x + panX, y: p.y + panY };
}

function screenToHex(sx, sy) {
    return pixelToHex(sx - panX, sy - panY);
}

function centerOn(q, r) {
    const p = hexToPixel(q, r);
    panX = canvas.width / 2 - p.x;
    panY = canvas.height / 2 - p.y;
}

// ============================================================
// Game Logic — Selection & Movement
// ============================================================

function selectUnit(unit) {
    const gs = gameState;
    if (gs.gameOver) return;
    if (gs.mp <= 0) return;
    if (unit === 'evascor' && gs.evascor.stunned) {
        notify('Evascor is stunned and cannot move');
        return;
    }
    if (unit === 'hecto' && hasPassiveArtifact(gs, 'hecto_invulnerable')) {
        const adjMonster = gs.enemies.some(e => hexDistance(gs.hecto.q, gs.hecto.r, e.q, e.r) === 1);
        if (adjMonster) {
            notify("Stoneblood Elixir: Hecto is frozen until Evascor clears the threat");
            return;
        }
    }
    if (unit === 'hecto' && gs.flags.hectoInvulnerable > 0) {
        notify("Hecto can't move while protected");
        return;
    }
    gs.selectedUnit = unit;
    computeReachable();
    updateHUD();
    render();
}

function deselectUnit() {
    gameState.selectedUnit = null;
    gameState.reachable = null;
    updateHUD();
}

function computeReachable() {
    const gs = gameState;
    if (gs.mp <= 0) { gs.reachable = new Map(); return; }

    const unit = gs.selectedUnit;
    const pos = gs[unit];
    const costTable = unit === 'hecto' ? HECTO_COST : EVASCOR_COST;
    const flatCost = unit === 'hecto' && gs.flags.hectoTerrainCostOne > 0;

    const blocked = buildOccupiedSet(gs);
    blocked.delete(hexKey(pos.q, pos.r)); // don't block self

    // Hecto pays +2 to enter artifact hexes (claim cost)
    const artifactKeys = new Set();
    if (unit === 'hecto') {
        for (const art of gs.artifacts) {
            if (!art.claimed) artifactKeys.add(hexKey(art.q, art.r));
        }
    }

    gs.reachable = bfsHexes(pos, gs.hexes, hex => {
        const key = hexKey(hex.q, hex.r);
        if (blocked.has(key)) return Infinity;
        const base = flatCost ? (costTable[hex.terrain] !== undefined ? 1 : Infinity) : costTable[hex.terrain];
        if (base === undefined) return Infinity;
        if (artifactKeys.has(key)) return base + 2;
        return base;
    }, gs.mp);
    gs.reachable.delete(hexKey(pos.q, pos.r));
}

function moveUnit(q, r) {
    const gs = gameState;
    const cost = gs.reachable.get(hexKey(q, r));
    if (cost === undefined) return;

    const unit = gs.selectedUnit;
    gs[unit].q = q;
    gs[unit].r = r;
    gs.mp -= cost;

    if (unit === 'hecto') {
        checkScrollPickup(q, r);
        checkArtifactClaim(q, r);
    }

    if (gs.mp <= 0) {
        deselectUnit();
        endTurn();
        return;
    }

    computeReachable();
    render();
}

// ============================================================
// Game Logic — Scrolls
// ============================================================

function checkScrollPickup(q, r) {
    const gs = gameState;
    const idx = gs.scrolls.findIndex(s => s.q === q && s.r === r);
    if (idx === -1) return;

    gs.scrolls.splice(idx, 1);

    const nearest = nearestUnrevealedArtifact(q, r, gs.artifacts);
    if (!nearest) {
        notify("The scroll's text is faded beyond reading");
        return;
    }

    nearest.revealed = true;
    const def = ARTIFACT_BY_ID.get(nearest.id);
    notify(`Scroll reveals: ${def.name} \u2014 ${def.desc}`);
    gs.jhirlePending.push(nearest.id);
}

// ============================================================
// Game Logic — Artifact Claiming
// ============================================================

function checkArtifactClaim(q, r) {
    const gs = gameState;
    const art = artifactAt(q, r, gs.artifacts);
    if (!art) return;

    const dist = hexDistance(gs.hecto.q, gs.hecto.r, gs.evascor.q, gs.evascor.r);
    if (dist > 3) {
        notify('Evascor must be within 3 hexes to claim');
        return;
    }

    if (gs.inventory.length >= 5) {
        showDropPrompt(art);
        return;
    }

    claimArtifact(art);
}

function claimArtifact(art) {
    const gs = gameState;
    art.claimed = true;
    if (!art.revealed) art.revealed = true;
    gs.inventory.push({ id: art.id, cooldownRemaining: 0, spent: false });

    const def = ARTIFACT_BY_ID.get(art.id);
    notify(`Claimed: ${def.name} \u2014 ${def.desc}`);
    if (gs.selectedUnit) computeReachable();
    updateHUD();
    render();
}

function showDropPrompt(newArt) {
    const gs = gameState;
    const el = document.getElementById('drop-prompt');
    const list = el.querySelector('.drop-list');
    list.innerHTML = '';

    for (const inv of gs.inventory) {
        const d = ARTIFACT_BY_ID.get(inv.id);
        const btn = document.createElement('button');
        btn.className = 'drop-btn';
        btn.textContent = `Drop ${d.name}`;
        btn.addEventListener('click', () => {
            gs.inventory = gs.inventory.filter(i => i.id !== inv.id);
            el.classList.add('hidden');
            claimArtifact(newArt);
        });
        list.appendChild(btn);
    }

    const cancelBtn = el.querySelector('.drop-cancel');
    const onCancel = () => {
        cancelBtn.removeEventListener('click', onCancel);
        el.classList.add('hidden');
    };
    cancelBtn.addEventListener('click', onCancel);
    el.classList.remove('hidden');
}

// ============================================================
// Game Logic — Monsters
// ============================================================

function spawnMonsters() {
    const gs = gameState;
    const spawnCount = gs.inventory.length + 1;
    const occupied = buildOccupiedSet(gs);

    const candidates = [];
    for (const [key, hex] of gs.hexes) {
        if (hex.isEdge) continue;
        if (!isAccessible(hex.terrain)) continue;
        if (hex.terrain === TERRAIN.MOUNTAIN) continue;
        if (occupied.has(key)) continue;
        const d = hexDistance(hex.q, hex.r, gs.hecto.q, gs.hecto.r);
        if (d >= 3 && d <= 12) candidates.push(hex);
    }

    Rando.shuffle(candidates);
    for (let i = 0; i < spawnCount && i < candidates.length; i++) {
        if (Math.random() > 0.2) continue;
        const h = candidates[i];
        gs.enemies.push({ q: h.q, r: h.r, color: monsterColor() });
    }
}

function decayMonsters() {
    const gs = gameState;
    gs.enemies = gs.enemies.filter(e => {
        const dH = hexDistance(e.q, e.r, gs.hecto.q, gs.hecto.r);
        const dE = hexDistance(e.q, e.r, gs.evascor.q, gs.evascor.r);
        let minD = Math.min(dH, dE);
        if (gs.jhirle.active) {
            minD = Math.min(minD, hexDistance(e.q, e.r, gs.jhirle.q, gs.jhirle.r));
        }
        if (minD > 5 && Math.random() < 0.2) return false;
        return true;
    });
}

function moveMonsters() {
    const gs = gameState;
    if (gs.flags.enemiesSkipMovement) return;

    const occupied = buildOccupiedSet(gs);

    // Build visible target list once per turn
    const targets = [];
    if (gs.decoy && gs.decoy.turnsLeft > 0) {
        // Decoy overrides all other targets
        targets.push(gs.decoy);
    } else {
        targets.push(gs.evascor);
        const hectoHidden = isHiddenInForest(gs.hecto, gs.hexes) || gs.flags.hectoInvisible > 0;
        if (!hectoHidden) targets.push(gs.hecto);
        if (gs.jhirle.active && !isHiddenInForest(gs.jhirle, gs.hexes)) targets.push(gs.jhirle);
    }

    for (const enemy of gs.enemies) {
        const target = nearestOf(enemy.q, enemy.r, targets);

        // Hesitate near Evascor
        const distToEvascor = hexDistance(enemy.q, enemy.r, gs.evascor.q, gs.evascor.r);
        if (distToEvascor <= 3 && Math.random() < 0.5) continue;

        // Greedy move: pick neighbor closest to target
        const neighbors = hexNeighbors(enemy.q, enemy.r);
        let bestNeighbor = null;
        let bestDist = hexDistance(enemy.q, enemy.r, target.q, target.r);

        for (const n of neighbors) {
            const key = hexKey(n.q, n.r);
            const hex = gs.hexes.get(key);
            if (!hex) continue;
            if (!isAccessible(hex.terrain)) continue;
            if (occupied.has(key)) continue;
            const d = hexDistance(n.q, n.r, target.q, target.r);
            if (d < bestDist) {
                bestDist = d;
                bestNeighbor = n;
            }
        }

        if (!bestNeighbor) continue;
        occupied.delete(hexKey(enemy.q, enemy.r));
        enemy.q = bestNeighbor.q;
        enemy.r = bestNeighbor.r;
        occupied.add(hexKey(enemy.q, enemy.r));
    }
}

// ============================================================
// Game Logic — Combat & Death
// ============================================================

function evascorCombat() {
    const gs = gameState;
    if (gs.evascor.stunned) return;

    const routine = gs.evascor.routineBase + gs.flags.routineBoost;
    const adjacent = gs.enemies.filter(e =>
        hexDistance(gs.evascor.q, gs.evascor.r, e.q, e.r) === 1
    );

    // Kill up to [routine] adjacent enemies
    const killed = adjacent.slice(0, routine);
    for (const k of killed) {
        const idx = gs.enemies.indexOf(k);
        if (idx !== -1) gs.enemies.splice(idx, 1);
    }

    if (killed.length > 0) {
        notify(`Evascor dispatches ${killed.length} monster${killed.length > 1 ? 's' : ''}!`);
    }

    // Overflow stun
    if (adjacent.length <= routine) return;

    // Iron Skull Helm — negate first stun
    const helmIdx = gs.inventory.findIndex(inv => {
        const def = ARTIFACT_BY_ID.get(inv.id);
        return def.effect === 'negate_stun' && !inv.spent;
    });
    if (helmIdx !== -1) {
        gs.inventory.splice(helmIdx, 1);
        notify('Iron Skull Helm shatters, negating the stun!');
        return;
    }

    gs.evascor.stunCount++;
    gs.evascor.stunned = true;
    if (gs.evascor.stunCount >= 3) {
        gs.gameOver = 'evascor_destroyed';
        notify('Evascor is overwhelmed! Game over.');
    } else {
        notify(`Evascor is stunned! (${gs.evascor.stunCount}/3)`);
    }
}

function hectoDeathCheck() {
    const gs = gameState;
    if (gs.gameOver) return;
    if (gs.flags.hectoInvulnerable > 0 || hasPassiveArtifact(gs, 'hecto_invulnerable')) return;

    const dist = hexDistance(gs.hecto.q, gs.hecto.r, gs.evascor.q, gs.evascor.r);
    if (dist <= 3) return;

    const adjacentMonster = gs.enemies.some(e =>
        hexDistance(gs.hecto.q, gs.hecto.r, e.q, e.r) === 1
    );
    if (!adjacentMonster) return;

    gs.gameOver = 'hecto_died';
    notify('A monster caught Hecto too far from Evascor! Game over.');
}

function checkQuarryHealing() {
    const gs = gameState;
    const eHex = gs.hexes.get(hexKey(gs.evascor.q, gs.evascor.r));
    if (!eHex) return;
    if (eHex.terrain !== TERRAIN.QUARRY) return;
    if (!gs.evascor.stunned) return;

    gs.evascor.stunned = false;
    notify('Evascor rests at the quarry. Stun cleared.');
}

// ============================================================
// Game Logic — Jhirle
// ============================================================

function buildMonsterDangerSet(enemies) {
    const danger = new Set();
    for (const e of enemies) {
        danger.add(hexKey(e.q, e.r));
        for (const n of hexNeighbors(e.q, e.r)) {
            danger.add(hexKey(n.q, n.r));
        }
    }
    return danger;
}

function spawnJhirle() {
    const gs = gameState;
    if (gs.jhirle.active) return;

    // Spawn on a passable hex near the map edge (row/col 1-2)
    const edgeCandidates = [];
    for (const [, hex] of gs.hexes) {
        if (hex.isEdge) continue;
        if (!isAccessible(hex.terrain)) continue;
        if (hex.terrain === TERRAIN.MOUNTAIN) continue;
        if (hex.row > 2 && hex.row < MAP_ROWS - 3 && hex.col > 2 && hex.col < MAP_COLS - 3) continue;
        edgeCandidates.push(hex);
    }
    if (edgeCandidates.length === 0) return;

    const spawn = Rando.choice(edgeCandidates);
    gs.jhirle.q = spawn.q;
    gs.jhirle.r = spawn.r;
    gs.jhirle.active = true;

    // Inherit all currently revealed artifact locations
    for (const art of gs.artifacts) {
        if (art.revealed && !art.claimed) gs.jhirle.knownArtifacts.add(art.id);
    }

    notify('Jhirle has entered the Wilds!');
}

function jhirleLearnPending() {
    const gs = gameState;
    if (!gs.jhirle.active) return;
    for (const id of gs.jhirlePending) {
        gs.jhirle.knownArtifacts.add(id);
    }
    gs.jhirlePending = [];
}

function jhirlePickTarget(excludeId) {
    const gs = gameState;
    const j = gs.jhirle;

    let bestId = null;
    let bestDist = Infinity;

    for (const id of j.knownArtifacts) {
        if (id === excludeId) continue;
        const art = gs.artifacts.find(a => a.id === id && !a.claimed);
        if (!art) continue;
        const d = hexDistance(j.q, j.r, art.q, art.r);
        if (d < bestDist) {
            bestDist = d;
            bestId = id;
        }
    }

    return { id: bestId, dist: bestDist };
}

function jhirleRetarget() {
    const gs = gameState;
    const j = gs.jhirle;

    const pick = jhirlePickTarget(null);
    if (pick.id === j.targetId) return;
    j.targetId = pick.id;
    j.noProgressTurns = 0;
    j.lastDist = pick.dist;
    gs.flags.showJhirleTarget = false;
}

function jhirleMoveToward(target) {
    const gs = gameState;
    const j = gs.jhirle;
    const evascorKey = hexKey(gs.evascor.q, gs.evascor.r);
    const danger = buildMonsterDangerSet(gs.enemies);
    const jhirleKey = hexKey(j.q, j.r);

    // Full A* path to target, then walk along it spending MP
    const path = findPath(
        j, target,
        (q, r) => {
            const key = hexKey(q, r);
            if (key === jhirleKey) return true;
            if (key === evascorKey) return false;
            if (danger.has(key)) return false;
            const hex = gs.hexes.get(key);
            if (!hex) return false;
            return isAccessible(hex.terrain);
        },
        (q, r) => {
            const hex = gs.hexes.get(hexKey(q, r));
            if (!hex) return Infinity;
            const cost = HECTO_COST[hex.terrain];
            if (cost === undefined) return Infinity;
            return cost;
        },
        Infinity
    );

    if (!path || path.length < 2) return;

    // Walk along path spending up to JHIRLE_MP
    let remaining = JHIRLE_MP;
    for (let i = 1; i < path.length; i++) {
        const hex = gs.hexes.get(hexKey(path[i].q, path[i].r));
        if (!hex) break;
        const cost = HECTO_COST[hex.terrain];
        if (cost === undefined || cost > remaining) break;
        remaining -= cost;
        j.q = path[i].q;
        j.r = path[i].r;
    }
}

function jhirleTarget(gs) {
    const j = gs.jhirle;

    // After 4 claims, head for a city
    if (j.claimCount >= 4) {
        let bestCity = null;
        let bestDist = Infinity;
        for (const c of gs.cities) {
            const d = hexDistance(j.q, j.r, c.q, c.r);
            if (d < bestDist) { bestDist = d; bestCity = c; }
        }
        return bestCity;
    }

    // Head for nearest known unclaimed artifact
    if (j.targetId) {
        const art = gs.artifacts.find(a => a.id === j.targetId && !a.claimed);
        if (art) return art;
    }

    // No target — hide in nearest forest
    let bestForest = null;
    let bestDist = Infinity;
    for (const [, hex] of gs.hexes) {
        if (hex.terrain !== TERRAIN.FOREST) continue;
        const d = hexDistance(j.q, j.r, hex.q, hex.r);
        if (d < bestDist) { bestDist = d; bestForest = hex; }
    }
    return bestForest;
}

function moveJhirle() {
    const gs = gameState;
    const j = gs.jhirle;
    if (!j.active) return;

    const target = jhirleTarget(gs);
    if (!target) return;

    const distBefore = hexDistance(j.q, j.r, target.q, target.r);
    jhirleMoveToward(target);
    const distAfter = hexDistance(j.q, j.r, target.q, target.r);

    // Track progress (only for artifact hunting, not city return)
    if (j.claimCount < 4) {
        if (distAfter >= distBefore) {
            j.noProgressTurns++;
        } else {
            j.noProgressTurns = 0;
        }
        j.lastDist = distAfter;

        if (j.noProgressTurns >= 3) {
            const alt = jhirlePickTarget(j.targetId);
            if (alt.id) {
                j.targetId = alt.id;
                j.noProgressTurns = 0;
                j.lastDist = alt.dist;
            }
        }
    }
}

function jhirleClaimCheck() {
    const gs = gameState;
    const j = gs.jhirle;
    if (!j.active) return;

    // Check city arrival (win condition)
    if (j.claimCount >= 4 && isOnCity(j.q, j.r, gs.cities)) {
        gs.gameOver = 'jhirle_won';
        notify('Jhirle returned to the city with 4 artifacts! Game over.');
        return;
    }

    // Check artifact pickup
    const art = artifactAt(j.q, j.r, gs.artifacts);
    if (!art) return;
    if (!j.knownArtifacts.has(art.id)) return;

    art.claimed = true;
    j.claimCount++;
    const def = ARTIFACT_BY_ID.get(art.id);
    notify(`Jhirle claimed ${def.name}! (${j.claimCount}/4)`);

    jhirleRetarget();
}

function runJhirlePhase() {
    const gs = gameState;

    // Spawn check: appears the turn after first artifact claim
    if (!gs.jhirle.active && gs.inventory.length >= 1) {
        spawnJhirle();
    }

    if (!gs.jhirle.active) return;

    jhirleLearnPending();
    jhirleRetarget();
    moveJhirle();
    jhirleClaimCheck();
}

// ============================================================
// Game Logic — Win Condition
// ============================================================

function isOnCity(q, r, cities) {
    return cities.some(c => c.q === q && c.r === r);
}

function checkWinCondition() {
    const gs = gameState;
    if (gs.inventory.length < 3) return;
    if (!isOnCity(gs.hecto.q, gs.hecto.r, gs.cities)) return;
    const dist = hexDistance(gs.hecto.q, gs.hecto.r, gs.evascor.q, gs.evascor.r);
    if (dist > 3) return;

    gs.gameOver = 'win';
    notify(`Returned to the city on turn ${gs.turn}!`);
}

// ============================================================
// Turn
// ============================================================

function endTurn() {
    const gs = gameState;
    if (gs.gameOver) return;
    deselectUnit();

    checkWinCondition();
    if (gs.gameOver) { updateHUD(); render(); return; }

    evascorCombat();
    if (gs.gameOver) { updateHUD(); render(); return; }

    hectoDeathCheck();
    if (gs.gameOver) { updateHUD(); render(); return; }

    spawnMonsters();
    decayMonsters();
    moveMonsters();

    runJhirlePhase();
    if (gs.gameOver) { updateHUD(); render(); return; }

    checkQuarryHealing();

    // Decrement artifact cooldowns
    for (const inv of gs.inventory) {
        if (inv.cooldownRemaining > 0) inv.cooldownRemaining--;
    }

    // Decrement flags
    if (gs.flags.hectoInvisible > 0) gs.flags.hectoInvisible--;
    if (gs.flags.hectoInvulnerable > 0) gs.flags.hectoInvulnerable--;
    if (gs.flags.hectoTerrainCostOne > 0) gs.flags.hectoTerrainCostOne--;
    gs.flags.routineBoost = 0;
    gs.flags.enemiesSkipMovement = false;

    // Decrement decoy
    if (gs.decoy) {
        gs.decoy.turnsLeft--;
        if (gs.decoy.turnsLeft <= 0) {
            gs.decoy = null;
            notify('The decoy fades away.');
        }
    }

    gs.turn++;
    gs.mp = PLAYER_MP;
    updateHUD();
    render();
}

// ============================================================
// Rendering
// ============================================================

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

    ctx.fillStyle = contrastText(color);
    ctx.font = 'bold ' + Math.floor(s * 0.55) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
}

function drawSelectionRing(cx, cy) {
    const s = COUNTER_SIZE + 4;
    roundRect(ctx, cx - s / 2, cy - s / 2, s, s, 6);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawTether(gs) {
    const hScreen = hexToScreen(gs.hecto.q, gs.hecto.r);
    const eScreen = hexToScreen(gs.evascor.q, gs.evascor.r);
    const dist = hexDistance(gs.hecto.q, gs.hecto.r, gs.evascor.q, gs.evascor.r);

    ctx.beginPath();
    ctx.moveTo(hScreen.x, hScreen.y);
    ctx.lineTo(eScreen.x, eScreen.y);
    ctx.strokeStyle = dist > 3 ? 'rgba(255, 80, 80, 0.5)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = dist > 3 ? 2 : 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawGameOverOverlay(gs) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const messages = {
        win: 'VICTORY!',
        hecto_died: 'HECTO FELL',
        evascor_destroyed: 'EVASCOR OVERWHELMED',
        jhirle_won: 'JHIRLE PREVAILS',
    };

    ctx.fillStyle = gs.gameOver === 'win' ? '#4f4' : '#f44';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(messages[gs.gameOver] || 'GAME OVER', canvas.width / 2, canvas.height / 2 - 30);

    ctx.fillStyle = '#eee';
    ctx.font = '20px monospace';
    ctx.fillText('Turn ' + gs.turn, canvas.width / 2, canvas.height / 2 + 20);
}

function render() {
    const gs = gameState;
    if (!gs) return;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Terrain
    for (const [, hex] of gs.hexes) {
        const { x, y } = hexToScreen(hex.q, hex.r);
        if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 ||
            y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;
        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
        ctx.fill();
        ctx.strokeStyle = '#00000044';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Spawn hex highlights (Danger Sense Amulet passive)
    if (hasPassiveArtifact(gs, 'show_spawn_hexes')) {
        for (const [key, hex] of gs.hexes) {
            if (hex.isEdge || !isAccessible(hex.terrain) || hex.terrain === TERRAIN.MOUNTAIN) continue;
            const d = hexDistance(hex.q, hex.r, gs.hecto.q, gs.hecto.r);
            if (d < 3 || d > 12) continue;
            const { x, y } = hexToScreen(hex.q, hex.r);
            if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 ||
                y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
            ctx.fill();
        }
    }

    // Reachable highlights
    if (gs.reachable) {
        for (const [key] of gs.reachable) {
            const [q, r] = key.split(',').map(Number);
            const { x, y } = hexToScreen(q, r);
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fill();
        }
    }

    // Targeting highlights
    if (gs.targetingValid) {
        for (const key of gs.targetingValid) {
            const [q, r] = key.split(',').map(Number);
            const { x, y } = hexToScreen(q, r);
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = 'rgba(255, 165, 0, 0.35)';
            ctx.fill();
        }
    }

    // City labels
    for (const city of gs.cities) {
        const { x, y } = hexToScreen(city.q, city.r);
        ctx.fillStyle = '#442200';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CITY', x, y);
    }

    // Scrolls
    for (const scroll of gs.scrolls) {
        const { x, y } = hexToScreen(scroll.q, scroll.r);
        drawCounter(x, y, SCROLL_COLOR, 'S');
    }

    // Revealed artifacts
    for (const art of gs.artifacts) {
        if (!art.revealed || art.claimed) continue;
        const { x, y } = hexToScreen(art.q, art.r);
        drawCounter(x, y, ARTIFACT_COLOR, 'A');
    }

    // Monsters
    for (const enemy of gs.enemies) {
        const { x, y } = hexToScreen(enemy.q, enemy.r);
        drawCounter(x, y, enemy.color, 'M');
    }

    // Decoy
    if (gs.decoy) {
        const dScreen = hexToScreen(gs.decoy.q, gs.decoy.r);
        drawCounter(dScreen.x, dScreen.y, '#ff6600', 'D');
    }

    // Jhirle
    if (gs.jhirle.active) {
        const jScreen = hexToScreen(gs.jhirle.q, gs.jhirle.r);
        drawCounter(jScreen.x, jScreen.y, JHIRLE_COLOR, 'J');
    }

    // Jhirle target highlight (Whispering Veil)
    if (gs.flags.showJhirleTarget && gs.jhirle.active && gs.jhirle.targetId) {
        const art = gs.artifacts.find(a => a.id === gs.jhirle.targetId && !a.claimed);
        if (art) {
            const { x, y } = hexToScreen(art.q, art.r);
            drawHexPath(ctx, x, y, HEX_SIZE + 2);
            ctx.strokeStyle = '#cc66ff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    drawTether(gs);

    // Evascor
    const eScreen = hexToScreen(gs.evascor.q, gs.evascor.r);
    drawCounter(eScreen.x, eScreen.y, EVASCOR_COLOR, 'E');
    if (gs.selectedUnit === 'evascor') drawSelectionRing(eScreen.x, eScreen.y);

    // Hecto
    const hScreen = hexToScreen(gs.hecto.q, gs.hecto.r);
    // Passive aura
    const hasPassive = gs.inventory.some(inv => {
        const def = ARTIFACT_BY_ID.get(inv.id);
        return def.template === 'passive' && !inv.spent;
    });
    const hasActiveFlag = gs.flags.hectoInvisible > 0 || gs.flags.hectoInvulnerable > 0 ||
        gs.flags.hectoTerrainCostOne > 0;
    if (hasPassive || hasActiveFlag) {
        ctx.save();
        const auraR = COUNTER_SIZE * 0.8;
        const grad = ctx.createRadialGradient(hScreen.x, hScreen.y, COUNTER_SIZE * 0.3, hScreen.x, hScreen.y, auraR);
        grad.addColorStop(0, 'rgba(100, 160, 255, 0.25)');
        grad.addColorStop(0.6, 'rgba(100, 160, 255, 0.1)');
        grad.addColorStop(1, 'rgba(100, 160, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(hScreen.x, hScreen.y, auraR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    drawCounter(hScreen.x, hScreen.y, HECTO_COLOR, 'H');
    if (gs.selectedUnit === 'hecto') drawSelectionRing(hScreen.x, hScreen.y);

    if (gs.gameOver) drawGameOverOverlay(gs);
}

// ============================================================
// HUD
// ============================================================

function updateHUD() {
    const gs = gameState;
    if (!gs) return;

    document.getElementById('turn-info').textContent = 'Turn ' + gs.turn;
    document.getElementById('mp-info').textContent = 'MP: ' + gs.mp + '/' + PLAYER_MP;

    document.getElementById('unit-hecto').classList.toggle('selected', gs.selectedUnit === 'hecto');

    const evBtn = document.getElementById('unit-evascor');
    evBtn.classList.toggle('selected', gs.selectedUnit === 'evascor');
    evBtn.classList.toggle('stunned', gs.evascor.stunned);
    const stunText = gs.evascor.stunned ? ' STUNNED' : '';
    evBtn.textContent = `[E] Evascor (R:${gs.evascor.routineBase}) ${gs.evascor.stunCount}/3${stunText}`;

    // Jhirle
    const jhirleEl = document.getElementById('jhirle-info');
    if (gs.jhirle.active) {
        jhirleEl.innerHTML = `<span style="color:${JHIRLE_COLOR}">[J] Jhirle: ${gs.jhirle.claimCount}/4 artifacts</span>`;
    } else {
        jhirleEl.innerHTML = '';
    }

    // Inventory
    const invEl = document.getElementById('inventory');
    if (gs.inventory.length > 0) {
        invEl.innerHTML = gs.inventory.map((inv, i) => {
            const def = ARTIFACT_BY_ID.get(inv.id);
            if (def.template === 'passive') {
                return `<span class="inv-item inv-passive">[${def.name} PASSIVE]</span>`;
            }
            const onCooldown = inv.cooldownRemaining > 0;
            const isTargeting = gs.targetingArtifact === i;
            let label = def.name;
            if (def.template === 'one_use') label += ' \u{1f525}';
            if (onCooldown) label += ` CD:${inv.cooldownRemaining}`;

            const cls = ['inv-btn'];
            if (onCooldown) cls.push('inv-cd');
            if (isTargeting) cls.push('inv-targeting');

            return `<button class="${cls.join(' ')}" data-inv="${i}" ${onCooldown ? 'disabled' : ''}>[${label}]</button>`;
        }).join(' ');
    } else {
        invEl.innerHTML = '<span class="inv-empty">No artifacts</span>';
    }

    // Visions
    const visEl = document.getElementById('visions');
    if (gs.visions.length > 0) {
        visEl.innerHTML = gs.visions.map(v =>
            `<div class="vision">"${v.text}"</div>`
        ).join('');
    } else {
        visEl.innerHTML = '';
    }

    updateArtifactInfo();
}

let artifactInfoTimer = null;

function showArtifactActivation(def) {
    const el = document.getElementById('artifact-info');
    el.innerHTML = `<div class="info-name">${def.name}</div><div class="info-desc">${def.desc}</div>`;
    el.classList.remove('hidden');
    clearTimeout(artifactInfoTimer);
    artifactInfoTimer = setTimeout(() => updateArtifactInfo(), 3000);
}

function updateArtifactInfo() {
    const gs = gameState;
    if (!gs) return;
    const el = document.getElementById('artifact-info');

    const lines = [];

    // Active flags
    if (gs.flags.hectoInvisible > 0)
        lines.push(`Cloak of Fading: invisible (${gs.flags.hectoInvisible} turns)`);
    if (gs.flags.hectoInvulnerable > 0)
        lines.push(`Stoneblood Elixir: invulnerable, immobile`);
    if (gs.flags.hectoTerrainCostOne > 0)
        lines.push(`Wind Striders: all terrain costs 1`);
    if (gs.flags.routineBoost > 0)
        lines.push(`Blazing Mantle: routine +${gs.flags.routineBoost}`);
    if (gs.flags.enemiesSkipMovement)
        lines.push(`Dusk Lantern: monsters frozen`);
    if (gs.flags.showJhirleTarget)
        lines.push(`Whispering Veil: tracking Jhirle`);
    if (gs.decoy)
        lines.push(`Mirror of Echoes: decoy active (${gs.decoy.turnsLeft} turns)`);

    // Passive artifacts
    for (const inv of gs.inventory) {
        const def = ARTIFACT_BY_ID.get(inv.id);
        if (def.template !== 'passive' || inv.spent) continue;
        lines.push(`${def.name}: ${def.desc}`);
    }

    if (lines.length > 0) {
        el.innerHTML = lines.map(l => `<div class="info-passive">${l}</div>`).join('');
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

// ============================================================
// Notification
// ============================================================

let notifyTimer = null;
function notify(msg) {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => el.classList.add('hidden'), NOTIFY_MS);
}

// ============================================================
// Input
// ============================================================

canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
        panning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panOrigX = panX;
        panOrigY = panY;
        e.preventDefault();
        return;
    }

    if (e.button !== 0) return;
    const gs = gameState;
    if (!gs || gs.gameOver) return;

    const hex = screenToHex(e.clientX, e.clientY);

    // Targeting mode — artifact effect
    if (gs.targetingArtifact !== null) {
        const key = hexKey(hex.q, hex.r);
        if (gs.targetingValid && gs.targetingValid.has(key)) {
            applyTargetedEffect(hex.q, hex.r);
        } else {
            cancelTargeting();
        }
        return;
    }

    const clicked = unitAt(hex.q, hex.r, gs);

    if (gs.selectedUnit) {
        if (clicked === gs.selectedUnit) {
            deselectUnit();
        } else if (clicked) {
            selectUnit(clicked);
        } else if (gs.reachable && gs.reachable.has(hexKey(hex.q, hex.r))) {
            moveUnit(hex.q, hex.r);
        } else {
            deselectUnit();
        }
    } else if (clicked) {
        selectUnit(clicked);
    }
    render();
});

canvas.addEventListener('mousemove', e => {
    if (!panning) return;
    panX = panOrigX + (e.clientX - panStartX);
    panY = panOrigY + (e.clientY - panStartY);
    render();
});

canvas.addEventListener('mouseup', e => {
    if (e.button === 2) panning = false;
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('unit-hecto').addEventListener('click', () => {
    if (gameState.selectedUnit === 'hecto') deselectUnit();
    else selectUnit('hecto');
    render();
});

document.getElementById('unit-evascor').addEventListener('click', () => {
    if (gameState.selectedUnit === 'evascor') deselectUnit();
    else selectUnit('evascor');
    render();
});

document.getElementById('end-turn').addEventListener('click', () => { endTurn(); canvas.focus(); });

window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && gameState && gameState.targetingArtifact !== null) {
        cancelTargeting();
        return;
    }
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
    }
    endTurn();
});

document.getElementById('inventory').addEventListener('click', e => {
    const btn = e.target.closest('[data-inv]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.inv);
    activateArtifact(idx);
});

document.getElementById('new-game').addEventListener('click', initGame);

// ============================================================
// Init
// ============================================================

function clearEasternApproach(hexes) {
    for (const [, hex] of hexes) {
        if (hex.col < MAP_COLS - 4) continue;
        if (hex.terrain === TERRAIN.MOUNTAIN_DARK) hex.terrain = TERRAIN.HILLS_DARK;
        if (hex.terrain === TERRAIN.WATER) hex.terrain = TERRAIN.PLAINS_DARK;
    }
}

function initGame() {
    let hexes, units, cities, artifactPositions, scrollPositions;
    let attempts = 0;

    do {
        hexes = generateRectGrid();
        assignTerrain(hexes);
        clearEasternApproach(hexes);
        cities = placeCities(hexes);
        units = placeUnits(hexes, cities);
        illuminateReachable(hexes, units.hecto);

        const passable = getPassableNonEdge(hexes);
        const unitKeys = [hexKey(units.hecto.q, units.hecto.r), hexKey(units.evascor.q, units.evascor.r)];
        const cityKeys = cities.map(c => hexKey(c.q, c.r));

        artifactPositions = placeWithMinDistance(passable, 7, 8, [...unitKeys, ...cityKeys]);
        const artifactKeys = artifactPositions.map(a => hexKey(a.q, a.r));
        scrollPositions = placeWithMinDistance(passable, 10, 5, [...unitKeys, ...cityKeys, ...artifactKeys]);

        attempts++;
    } while (attempts < 20 && (artifactPositions.length < 7 || scrollPositions.length < 10));

    const chosenArtifacts = Rando.shuffle([...ARTIFACTS]).slice(0, 7);

    gameState = newGameState();
    gameState.hexes = hexes;
    gameState.cities = cities.map(c => ({ q: c.q, r: c.r }));
    gameState.hecto.q = units.hecto.q;
    gameState.hecto.r = units.hecto.r;
    gameState.evascor.q = units.evascor.q;
    gameState.evascor.r = units.evascor.r;

    gameState.artifacts = artifactPositions.map((pos, i) => ({
        q: pos.q, r: pos.r,
        id: chosenArtifacts[i].id,
        revealed: false,
        claimed: false,
    }));

    gameState.scrolls = scrollPositions.map(pos => ({ q: pos.q, r: pos.r }));
    gameState.visions = generateVisions(hexes, gameState.artifacts);

    // Set canvas size first so pan calculation has correct dimensions
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Align map so units (on the eastern edge) appear on the right, Wilds fill leftward
    const p = hexToPixel(gameState.hecto.q, gameState.hecto.r);
    panX = canvas.width - p.x - HEX_SIZE * 4;
    panY = canvas.height / 2 - p.y;
    updateHUD();
    render();
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
}

window.addEventListener('resize', resize);
initGame();
