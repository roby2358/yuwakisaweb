// ai.js — Movement primitive shared by party and enemy AI.
//
// Per DYNAMICS.md "Pathfinding Needs Global Vision": plan with full A* to the goal, then
// walk the path within a movement budget. A local reachable-set would create a horizon
// problem (units stuck on coastlines / behind obstacles). Targeting and attack *policy*
// live in index.js where the game state is; this module only answers "given a goal and a
// budget, where does this unit end up this turn?".
//
// `ctx` is a plain bag of closures over live state:
//   { terrainPassable(q, r), moveCost(q, r), occupied(key) }
// `occupied` reflects other units' current hexes; index.js updates it between units so a
// unit never lands where another already stands.


// Best free, passable neighbor that gets strictly closer to the goal — or null if none.
// Used when the A* next-step is blocked by a unit, so movers route around each other.
function sidestep(unit, goal, ctx) {
    const here = new Hex(unit.q, unit.r);
    let best = null;
    let bestDist = here.distance(goal);
    for (const n of here.neighbors()) {
        if (!ctx.terrainPassable(n.q, n.r)) continue;
        if (ctx.occupied(n.key())) continue;
        const d = n.distance(goal);
        if (d < bestDist) {
            bestDist = d;
            best = { q: n.q, r: n.r };
        }
    }
    return best;
}

// Walk from the unit toward goal, spending up to `budget` movement cost. Returns the
// destination { q, r } (possibly the unit's own hex if fully blocked).
function walkToward(unit, goal, budget, ctx) {
    if (goal.q === unit.q && goal.r === unit.r) return { q: unit.q, r: unit.r };

    // Unbounded A* — full global vision so the unit can plan detours longer than one
    // turn's budget (DYNAMICS: "Pathfinding Needs Global Vision"). The budget caps how far
    // it walks the path below, not how far it plans.
    const path = findPath(unit, goal, ctx.terrainPassable, ctx.moveCost, Infinity);
    let pos = { q: unit.q, r: unit.r };

    if (path && path.length >= 2) {
        let spent = 0;
        for (let i = 1; i < path.length; i++) {
            const next = path[i];
            const cost = ctx.moveCost(next.q, next.r);
            if (spent + cost > budget) break;
            if (ctx.occupied(next.key())) break;   // a unit blocks the path — fall to sidestep
            pos = { q: next.q, r: next.r };
            spent += cost;
            if (pos.q === goal.q && pos.r === goal.r) break;
        }
    }

    if (pos.q === unit.q && pos.r === unit.r) {
        const ss = sidestep(unit, goal, ctx);
        if (ss) pos = ss;
    }
    return pos;
}
