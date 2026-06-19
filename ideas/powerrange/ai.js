// ai.js — the enemy city-state's turn. It plays by exactly the same rules as the player,
// reaching the board only through Game's command methods. Behaviour is a simple ecology:
// build one unit if flush, then for each unit attack-if-able, else advance, then attack
// again. (DYNAMICS.md "Pathfinding Needs Global Vision", "Ecology Over Choreography".)
// Classic script: depends on config.js, hex.js, rando.js.

const AI_ME = FACTION.ENEMY;
const AI_FOE = FACTION.PLAYER;
const AI_UNIT_CAP = 8;

function runEnemyTurn(game) {
    aiBuildPhase(game);
    // Snapshot ids: units may be removed mid-phase (a captured foundry ends the game).
    const ids = game.factionUnits(AI_ME).map(u => u.id);
    for (const id of ids) {
        const unit = game.units.find(u => u.id === id);
        if (unit) aiActUnit(game, unit);
        if (game.winner) return;
    }
}

function aiBuildPhase(game) {
    if (game.factionUnits(AI_ME).length >= AI_UNIT_CAP) return;
    const spots = [...game.buildHexes(AI_ME)];
    if (spots.length === 0) return;
    const key = aiChooseBuild(game);
    if (!key) return;
    const { q, r } = Hex.fromKey(spots[0]);
    game.build(AI_ME, key, q, r);
}

// Spend within budget: a heavy hitter when rich, a cheap engineer to harass siege targets,
// an elite knight only when flush, else the workhorse railgun.
function aiChooseBuild(game) {
    const t = game.factions[AI_ME].treasury;
    const affordable = ['RAILGUN', 'LASER', 'PLASMA', 'INCENDIARY', 'BOMBARD', 'ENGINEER', 'KNIGHT']
        .filter(k => game.buildCost(AI_ME, k) <= t);
    if (affordable.length === 0) return null;
    if (t > game.buildCost(AI_ME, 'BOMBARD') && Rando.bool(0.2) && affordable.includes('BOMBARD')) return 'BOMBARD';
    if (t > game.buildCost(AI_ME, 'PLASMA') && Rando.bool(0.25)) return 'PLASMA';
    if (Rando.bool(0.3) && affordable.includes('ENGINEER')) return 'ENGINEER';
    if (t > game.buildCost(AI_ME, 'KNIGHT') + 60 && Rando.bool(0.25) && affordable.includes('KNIGHT')) return 'KNIGHT';
    if (affordable.includes('RAILGUN')) return 'RAILGUN';
    return affordable[0];
}

function aiActUnit(game, unit) {
    if (unit.isFoundry()) return;
    if (aiTryAttack(game, unit)) return;
    const goal = aiChooseGoal(game, unit);
    if (goal) aiWalkToward(game, unit, goal);
    aiTryAttack(game, unit);
}

// Knights siege; weapons fire. Returns whether the unit spent its action.
function aiTryAttack(game, unit) {
    if (unit.canSiege()) {
        const sieges = [...game.siegeTargets(unit)];
        if (sieges.length > 0) {
            const best = aiPickByValue(game, sieges);
            game.siege(unit, best.q, best.r);
            return true;
        }
    }
    if (!unit.canFire()) return false;
    const shots = [...game.fireTargets(unit)];
    if (shots.length === 0) return false;
    const target = aiPickFireTarget(game, shots);
    game.fire(unit, target.q, target.r);
    return true;
}

// Prefer killing the weakest enemy unit in range; an igniter with no unit in range
// torches whatever gold hex it can reach.
function aiPickFireTarget(game, keys) {
    const cells = keys.map(k => Hex.fromKey(k));
    const occupied = cells.filter(c => {
        const u = game.unitAt(c.q, c.r);
        return u && u.owner === AI_FOE;
    });
    if (occupied.length === 0) return cells[0];
    return occupied.sort((a, b) => game.unitAt(a.q, a.r).hp - game.unitAt(b.q, b.r).hp)[0];
}

// The juiciest siege: a foundry over a platform, an expensive platform over a cheap one.
function aiPickByValue(game, keys) {
    const cells = keys.map(k => Hex.fromKey(k));
    return cells.sort((a, b) => aiSiegeValue(game.unitAt(b.q, b.r)) - aiSiegeValue(game.unitAt(a.q, a.r)))[0];
}

function aiSiegeValue(unit) {
    if (!unit) return -1;
    return unit.kind === KIND.FOUNDRY ? 1000 : unit.cost;
}

// Knights hunt the foe's machines; weapons close on the nearest foe, or expand to gold.
function aiChooseGoal(game, unit) {
    if (unit.canSiege()) {
        return aiNearest(unit, game.factionUnits(AI_FOE).filter(u => u.isPlatform() || u.isFoundry()));
    }
    const foe = aiNearest(unit, game.factionUnits(AI_FOE));
    if (foe) return foe;
    return aiNearestGold(game, unit);
}

function aiNearest(unit, candidates) {
    const here = new Hex(unit.q, unit.r);
    let best = null, bestD = Infinity;
    for (const c of candidates) {
        const d = here.distance(new Hex(c.q, c.r));
        if (d < bestD) { bestD = d; best = c; }
    }
    return best ? { q: best.q, r: best.r } : null;
}

function aiNearestGold(game, unit) {
    const here = new Hex(unit.q, unit.r);
    let best = null, bestD = Infinity;
    for (const [, h] of game.hexes) {
        if (h.terrain !== TERRAIN.GOLD || h.controlledBy === AI_ME) continue;
        const d = here.distance(new Hex(h.q, h.r));
        if (d < bestD) { bestD = d; best = h; }
    }
    return best ? { q: best.q, r: best.r } : null;
}

// Full path to the goal, then advance as far along it as this turn's movement allows.
function aiWalkToward(game, unit, goal) {
    const path = game.pathTo(unit, goal.q, goal.r);
    if (!path || path.length < 2) return;
    const reach = game.reachable(unit);
    for (let i = path.length - 1; i >= 1; i--) {
        const key = Hex.key(path[i].q, path[i].r);
        if (reach.has(key)) { game.move(unit, path[i].q, path[i].r); return; }
    }
}
