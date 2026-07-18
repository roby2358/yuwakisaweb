// Hex math + pathfinding. Pointy-top hexes, odd-r offset coordinates (c = col, r = row).
// Pure logic — no DOM. Exposed as `var Hex` so it loads via <script> and in test harnesses.

var Hex = (function () {
  const DIRS_EVEN = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
  const DIRS_ODD = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];

  function neighbors(c, r) {
    const dirs = (r & 1) ? DIRS_ODD : DIRS_EVEN;
    return dirs.map(d => ({ c: c + d[0], r: r + d[1] }));
  }

  function toCube(c, r) {
    const x = c - ((r - (r & 1)) / 2);
    return { x: x, y: -x - r, z: r };
  }

  function distance(c1, r1, c2, r2) {
    const a = toCube(c1, r1);
    const b = toCube(c2, r2);
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
  }

  function toPixel(c, r, size) {
    return {
      x: size * Math.sqrt(3) * (c + 0.5 * (r & 1)),
      y: size * 1.5 * r,
    };
  }

  function key(c, r) { return c + ',' + r; }

  // Dijkstra flood within a movement budget. costFn(c, r) returns the cost to ENTER
  // a hex, or Infinity if impassable. Returns Map<key, {c, r, cost, prev}> of hexes
  // reachable with total cost <= budget (start excluded).
  function reachable(startC, startR, budget, costFn) {
    const out = new Map();
    const frontier = [{ c: startC, r: startR, cost: 0 }];
    const best = new Map([[key(startC, startR), 0]]);
    while (frontier.length > 0) {
      frontier.sort((a, b) => a.cost - b.cost);
      const cur = frontier.shift();
      if (cur.cost > (best.get(key(cur.c, cur.r)) ?? Infinity)) continue;
      for (const n of neighbors(cur.c, cur.r)) {
        const step = costFn(n.c, n.r);
        const total = cur.cost + step;
        if (total > budget) continue;
        const k = key(n.c, n.r);
        if (total >= (best.get(k) ?? Infinity)) continue;
        best.set(k, total);
        out.set(k, { c: n.c, r: n.r, cost: total, prev: { c: cur.c, r: cur.r } });
        frontier.push({ c: n.c, r: n.r, cost: total });
      }
    }
    return out;
  }

  // Full A* to a goal — global vision, no movement-radius horizon (an NPC plans the
  // whole detour, then walks what its MP allows). goalFn(c, r) marks acceptable goals;
  // heuristicTarget is {c, r} used for the admissible distance heuristic.
  // Returns array of {c, r} steps from start (exclusive) to goal (inclusive), or null.
  function findPath(startC, startR, heuristicTarget, goalFn, costFn) {
    const startKey = key(startC, startR);
    const open = [{ c: startC, r: startR, g: 0, f: 0 }];
    const gBest = new Map([[startKey, 0]]);
    const cameFrom = new Map();
    const closed = new Set();
    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      const curKey = key(cur.c, cur.r);
      if (closed.has(curKey)) continue;
      closed.add(curKey);
      if (goalFn(cur.c, cur.r)) return rebuildPath(cameFrom, cur, startKey);
      for (const n of neighbors(cur.c, cur.r)) {
        const step = costFn(n.c, n.r);
        if (step === Infinity) continue;
        const g = cur.g + step;
        const k = key(n.c, n.r);
        if (g >= (gBest.get(k) ?? Infinity)) continue;
        gBest.set(k, g);
        cameFrom.set(k, { c: cur.c, r: cur.r });
        open.push({ c: n.c, r: n.r, g: g, f: g + distance(n.c, n.r, heuristicTarget.c, heuristicTarget.r) });
      }
    }
    return null;
  }

  function rebuildPath(cameFrom, goal, startKey) {
    const path = [];
    let cur = { c: goal.c, r: goal.r };
    while (key(cur.c, cur.r) !== startKey) {
      path.unshift({ c: cur.c, r: cur.r });
      cur = cameFrom.get(key(cur.c, cur.r));
    }
    return path;
  }

  return { neighbors, toCube, distance, toPixel, key, reachable, findPath };
})();
