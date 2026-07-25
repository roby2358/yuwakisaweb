"use strict";

// Tuning lab: compares edge-coloring strategies for how twisty the cheapest
// expected route becomes, and what each does to game length and skill depth.
// Doesn't touch the game — recolors freshly built mazes in place and measures.
// Usage: node test/twistlab.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = vm.createContext({ Math, console });
for (const file of ["delaunay.js", "game.js"]) {
  const src = fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8");
  vm.runInContext(src, context, { filename: file });
}
const G = vm.runInContext(
  "({ buildMaze, newRun, rollFace, applyRoll, applyMove, applyPass, usableMoves, " +
  "adjacency, pruneLongEdges, indexOfExtreme, randomEdgeColor })",
  context
);
const delaunayEdgesFn = vm.runInContext("delaunayEdges", context);

const EXPECTED = { red: 1.5, green: 2, blue: 3 };
const MAZES = 100;

function pickWeighted(weights) {
  const total = weights.red + weights.green + weights.blue;
  let r = Math.random() * total;
  for (const color of ["red", "green", "blue"]) {
    r -= weights[color];
    if (r < 0) return color;
  }
  return "blue";
}

// --- Coloring strategies: mutate maze.edges[i].color in place ---

const STRATEGIES = {
  uniform(maze) {
    // leave buildMaze's uniform coloring as-is
  },

  axisBias(maze) {
    // Edges aligned with the start->exit axis (horizontal) skew blue,
    // cross-cutting edges skew red: the direct march is the toll road.
    for (const e of maze.edges) {
      const a = maze.nodes[e.a];
      const b = maze.nodes[e.b];
      const align = Math.abs(a.x - b.x) / Math.hypot(a.x - b.x, a.y - b.y);
      e.color = pickWeighted({
        red: 1.5 * (1 - align) + 0.4,
        green: 1,
        blue: 1.5 * align + 0.4,
      });
    }
  },

  vein(maze) {
    // Hidden red artery: BFS path start -> w1 -> w2 -> exit through random
    // waypoints, skewed red; everything off the vein skews blue/green.
    const stops = [maze.start, randomNode(maze), randomNode(maze), maze.end];
    const veinEdges = new Set();
    for (let i = 0; i + 1 < stops.length; i++) {
      for (const edge of bfsPathEdges(maze, stops[i], stops[i + 1])) veinEdges.add(edge);
    }
    maze.edges.forEach((e, i) => {
      e.color = veinEdges.has(i)
        ? pickWeighted({ red: 0.6, green: 0.25, blue: 0.15 })
        : pickWeighted({ red: 0.2, green: 0.35, blue: 0.45 });
    });
  },
};

// Delete random edges down to targetCount (spanning tree kept, colors uniform):
// twist from topology instead of coloring.
function sparsify(maze, targetCount) {
  const shuffled = [...maze.edges].sort(() => Math.random() - 0.5);
  const parent = Array.from({ length: maze.nodes.length }, (_, i) => i);
  const find = x => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const kept = [];
  const extras = [];
  for (const e of shuffled) {
    if (find(e.a) !== find(e.b)) {
      parent[find(e.a)] = find(e.b);
      kept.push(e);
    } else {
      extras.push(e);
    }
  }
  while (kept.length < targetCount && extras.length) kept.push(extras.pop());
  maze.edges = kept;
  maze.adj = G.adjacency(maze.nodes.length, kept);
}

STRATEGIES.sparse95 = maze => sparsify(maze, 95);
STRATEGIES.sparse75 = maze => sparsify(maze, 75);

// Lakes: void regions carved from the point field. The graph stays locally
// dense (choice survives) but routes must physically wind around the voids.
// A strategy may return a replacement maze instead of mutating.
STRATEGIES.lakes = () => lakesMaze(3, 80, 140, false);
STRATEGIES.lakesBig = () => lakesMaze(3, 110, 170, false);
STRATEGIES.lakesMid = () => lakesMaze(3, 100, 150, true);
STRATEGIES.lakeSparse = () => {
  const maze = lakesMaze(3, 110, 170, false);
  sparsify(maze, Math.round(maze.edges.length * 0.8));
  return maze;
};

// centerBias confines lakes to the middle band so they block the direct corridor.
function lakesMaze(count, rMin, rMax, centerBias) {
  const lakes = Array.from({ length: count }, () => ({
    x: centerBias ? 230 + Math.random() * 440 : 170 + Math.random() * 560,
    y: centerBias ? 180 + Math.random() * 240 : 110 + Math.random() * 380,
    r: rMin + Math.random() * (rMax - rMin),
  }));
  const nodes = [];
  const minD2 = 60 * 60;
  for (let attempts = 0; nodes.length < 60 && attempts < 40000; attempts++) {
    const p = { x: 48 + Math.random() * (900 - 96), y: 48 + Math.random() * (600 - 96) };
    if (lakes.some(L => Math.hypot(p.x - L.x, p.y - L.y) < L.r)) continue;
    if (nodes.every(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= minD2)) nodes.push(p);
  }
  const pairs = G.pruneLongEdges(nodes, delaunayEdgesFn(nodes), 120);
  const edges = pairs.map(([a, b]) => ({ a, b, color: G.randomEdgeColor() }));
  const start = G.indexOfExtreme(nodes, (p, q) => p.x < q.x);
  const end = G.indexOfExtreme(nodes, (p, q) => p.x > q.x);
  return { nodes, edges, adj: G.adjacency(nodes.length, edges), start, end };
}

function randomNode(maze) {
  return Math.floor(Math.random() * maze.nodes.length);
}

function bfsPathEdges(maze, from, to) {
  const prev = new Array(maze.nodes.length).fill(null);
  prev[from] = { node: from, edge: -1 };
  const queue = [from];
  while (queue.length) {
    const u = queue.shift();
    if (u === to) break;
    for (const { edge, other } of maze.adj[u]) {
      if (prev[other] === null) {
        prev[other] = { node: u, edge };
        queue.push(other);
      }
    }
  }
  const edges = [];
  for (let u = to; u !== from; u = prev[u].node) edges.push(prev[u].edge);
  return edges;
}

// --- Metrics ---

// Dijkstra from source with expected-roll weights; returns dist + prev arrays.
function costField(maze, source) {
  const n = maze.nodes.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(null);
  const done = new Array(n).fill(false);
  dist[source] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!done[i] && (u === -1 || dist[i] < dist[u])) u = i;
    }
    if (u === -1) return { dist, prev };
    done[u] = true;
    for (const { edge, other } of maze.adj[u]) {
      const alt = dist[u] + EXPECTED[maze.edges[edge].color];
      if (alt < dist[other]) {
        dist[other] = alt;
        prev[other] = u;
      }
    }
  }
}

function hopField(maze, source) {
  const dist = new Array(maze.nodes.length).fill(-1);
  dist[source] = 0;
  const queue = [source];
  while (queue.length) {
    const u = queue.shift();
    for (const { other } of maze.adj[u]) {
      if (dist[other] === -1) {
        dist[other] = dist[u] + 1;
        queue.push(other);
      }
    }
  }
  return dist;
}

function cheapestRoute(maze) {
  const { dist, prev } = costField(maze, maze.start);
  const route = [];
  for (let u = maze.end; u !== null; u = prev[u]) route.push(u);
  return { cost: dist[maze.end], nodes: route.reverse() };
}

function routeLength(maze, routeNodes) {
  let len = 0;
  for (let i = 0; i + 1 < routeNodes.length; i++) {
    const a = maze.nodes[routeNodes[i]];
    const b = maze.nodes[routeNodes[i + 1]];
    len += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return len;
}

// Adaptive bot: take any usable move that strictly lowers distToEnd, else pass.
function runBot(maze, distToEnd) {
  const run = G.newRun(maze);
  for (let i = 0; i < 10000; i++) {
    const moves = G.applyRoll(run, G.rollFace());
    const forward = moves.filter(mv => distToEnd[mv.other] < distToEnd[run.current]);
    if (forward.length) {
      forward.sort((p, q) => distToEnd[p.other] - distToEnd[q.other]);
      G.applyMove(run, forward[0].other);
    } else if (moves.length) {
      G.applyPass(run);
    }
    if (run.phase === "won") return run.rolls;
  }
  return NaN;
}

// --- Run ---

console.log("strategy  par   twist  sinuo  naive  smart  gap");
for (const [name, recolor] of Object.entries(STRATEGIES)) {
  let par = 0, twist = 0, sinuosity = 0, naive = 0, smart = 0;
  for (let m = 0; m < MAZES; m++) {
    let maze = G.buildMaze(900, 600, 48, 80, 35, 3, 120, []); // lakeless base; lake strategies build their own
    maze = recolor(maze) || maze;
    const route = cheapestRoute(maze);
    const minHops = hopField(maze, maze.start)[maze.end];
    const straight = Math.hypot(
      maze.nodes[maze.end].x - maze.nodes[maze.start].x,
      maze.nodes[maze.end].y - maze.nodes[maze.start].y
    );
    par += route.cost;
    twist += (route.nodes.length - 1) / minHops;
    sinuosity += routeLength(maze, route.nodes) / straight;
    naive += runBot(maze, hopField(maze, maze.end));           // routes by hops
    smart += runBot(maze, costField(maze, maze.end).dist);     // routes by expected cost
  }
  console.log(
    name.padEnd(9) +
    (par / MAZES).toFixed(1).padStart(4) + "  " +
    (twist / MAZES).toFixed(2).padStart(5) + "  " +
    (sinuosity / MAZES).toFixed(2).padStart(5) + "  " +
    (naive / MAZES).toFixed(1).padStart(5) + "  " +
    (smart / MAZES).toFixed(1).padStart(5) + "  " +
    (naive / smart).toFixed(2).padStart(4)
  );
}
console.log("\ntwist = cheapest-route hops / min hops; sinuo = route length / straight line");
console.log("naive bot routes by hops, smart bot by expected cost; gap = naive/smart rolls");
