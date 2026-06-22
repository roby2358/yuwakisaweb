// ai/movement.js — Movement primitive shared by both AI strategies (friend and foe).
//
// Per DYNAMICS.md "Pathfinding Needs Global Vision": plan with full A* to the goal, then
// walk the path within a movement budget. A local reachable-set would create a horizon
// problem (units stuck on coastlines / behind obstacles). Targeting and positioning
// *policy* live in PartyAI / EnemyAI; this class only answers "given a goal and a budget,
// where does this unit end up this turn?".
//
// `ctx` is a plain bag of closures over live state (built by index.js `aiCtx`):
//   { terrainPassable(q, r), moveCost(q, r), planCost(q, r), occupied(key), zoc(q, r) }
// `moveCost` is spent from the budget per step; `planCost` is what the A* planner minimizes
// (terrain alone, or terrain + danger for a danger-aware ctx) — they may differ on purpose.
// `occupied` reflects other units' current hexes; the caller updates it between units so a
// unit never lands where another already stands.
class Movement {
    // Best free, passable neighbor that gets strictly closer to the goal — or null if none.
    // Used when the A* next-step is blocked by a unit, so movers route around each other.
    static sidestep(unit, goal, ctx) {
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
    static walkToward(unit, goal, budget, ctx) {
        if (goal.q === unit.q && goal.r === unit.r) return { q: unit.q, r: unit.r };

        // Unbounded A* — full global vision so the unit can plan detours longer than one
        // turn's budget (DYNAMICS: "Pathfinding Needs Global Vision"). The budget caps how
        // far it walks the path below, not how far it plans. Other units are treated as
        // obstacles here (except the unit's own hex and the goal), so a mover routes the
        // long way around a blocker within its full budget instead of stalling on a 1-hex
        // sidestep behind it.
        const passable = (q, r) => {
            if (!ctx.terrainPassable(q, r)) return false;
            if (q === unit.q && r === unit.r) return true;
            if (q === goal.q && r === goal.r) return true;
            return !ctx.occupied(Hex.key(q, r));
        };
        // Plan with planCost (terrain, plus danger for a danger-aware ctx) so the route can
        // bend around hazards; the walk below still spends moveCost (terrain × ZOC) from budget.
        const path = findPath(unit, goal, passable, ctx.planCost, Infinity);
        let pos = { q: unit.q, r: unit.r };

        if (path && path.length >= 2) {
            let spent = 0;
            for (let i = 1; i < path.length; i++) {
                if (spent >= budget) break;            // out of movement
                const next = path[i];
                if (ctx.occupied(next.key())) break;   // a unit blocks the path — fall to sidestep
                // Zone of control: a hex next to a hostile unit costs ZOC_PENALTY times as much.
                // A unit with any budget left always gets one step (so it can reach contact and
                // attack), but the inflated cost zeroes its movement there — it can't grind on
                // past the front line in a single turn. Symmetric: applies to whoever is moving.
                const zoc = ctx.zoc(next.q, next.r) ? ZOC_PENALTY : 1;
                pos = { q: next.q, r: next.r };
                spent += ctx.moveCost(next.q, next.r) * zoc;
                if (pos.q === goal.q && pos.r === goal.r) break;
            }
        }

        if (pos.q === unit.q && pos.r === unit.r) {
            const ss = Movement.sidestep(unit, goal, ctx);
            if (ss) pos = ss;
        }
        return pos;
    }
}
