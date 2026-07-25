"use strict";

const EDGE_COLORS = ["red", "blue", "green"];

// Six faces: red on 4, green on 3, blue on 2 — a frequency spectrum, red
// common, green mid, blue rare. Half the faces are single-color (narrow
// rolls), and every paired face includes red.
const DIE_FACES = [
  ["red"],
  ["red", "blue"],
  ["red", "green"],
  ["red", "green"],
  ["green"],
  ["blue"],
];

// Void regions carved from the point field: routes must wind around them,
// while the graph stays locally dense enough to keep color choices alive.
function randomLakes(width, height, count, rMin, rMax) {
  return Array.from({ length: count }, () => ({
    x: width * 0.19 + Math.random() * width * 0.62,
    y: height * 0.18 + Math.random() * height * 0.64,
    r: rMin + Math.random() * (rMax - rMin),
  }));
}

function inAnyLake(lakes, p) {
  return lakes.some(lake => Math.hypot(p.x - lake.x, p.y - lake.y) < lake.r);
}

// Each node claims an exclusion circle of random size (minDist x1 .. x
// distSpread); later nodes must land outside every claimed circle. Big circles
// make sparse stretches, small ones make dense webs — variable density.
function scatterPoints(width, height, margin, count, minDist, distSpread, lakes) {
  const points = [];
  let attempts = 0;
  while (points.length < count && attempts < 20000) {
    attempts += 1;
    const p = {
      x: margin + Math.random() * (width - 2 * margin),
      y: margin + Math.random() * (height - 2 * margin),
      r: minDist * (1 + (distSpread - 1) * Math.random()),
    };
    if (inAnyLake(lakes, p)) continue;
    const clear = points.every(q => Math.hypot(q.x - p.x, q.y - p.y) >= q.r);
    if (clear) points.push(p);
  }
  return points;
}

function randomEdgeColor() {
  return EDGE_COLORS[Math.floor(Math.random() * EDGE_COLORS.length)];
}

function indexOfExtreme(nodes, isBetter) {
  let best = 0;
  for (let i = 1; i < nodes.length; i++) {
    if (isBetter(nodes[i], nodes[best])) best = i;
  }
  return best;
}

function edgeLength(nodes, [a, b]) {
  return Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
}

function unionFind(n) {
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a, b) {
    parent[find(a)] = find(b);
  }
  return { find, union };
}

// Drop edges longer than maxLen — they act as highways across the maze — but
// re-add the shortest dropped ones wherever needed to keep the graph connected.
function pruneLongEdges(nodes, pairs, maxLen) {
  const kept = pairs.filter(p => edgeLength(nodes, p) <= maxLen);
  const dropped = pairs
    .filter(p => edgeLength(nodes, p) > maxLen)
    .sort((p, q) => edgeLength(nodes, p) - edgeLength(nodes, q));
  const uf = unionFind(nodes.length);
  for (const [a, b] of kept) uf.union(a, b);
  for (const [a, b] of dropped) {
    if (uf.find(a) !== uf.find(b)) {
      uf.union(a, b);
      kept.push([a, b]);
    }
  }
  return kept;
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Thin the web: always keep a random spanning tree (connectivity), then keep
// keepFraction of the loop-making extras. The fraction applies to the extras,
// not the total — a pruned planar web has ~2n edges, so half the TOTAL is ~n-1,
// which is exactly a spanning tree: a maze with no route choice at all.
function sparsifyPairs(nodeCount, pairs, keepFraction) {
  const uf = unionFind(nodeCount);
  const tree = [];
  const extras = [];
  for (const [a, b] of shuffled(pairs)) {
    if (uf.find(a) !== uf.find(b)) {
      uf.union(a, b);
      tree.push([a, b]);
    } else {
      extras.push([a, b]);
    }
  }
  return tree.concat(extras.slice(0, Math.round(extras.length * keepFraction)));
}

function adjacency(nodeCount, edges) {
  const adj = Array.from({ length: nodeCount }, () => []);
  edges.forEach((e, i) => {
    adj[e.a].push({ edge: i, other: e.b });
    adj[e.b].push({ edge: i, other: e.a });
  });
  return adj;
}

// Expected rolls to cross an edge of each color: 6 / (faces showing the color).
const EXPECTED_ROLLS = { red: 1.5, green: 2, blue: 3 };

// Minimum expected roll count start -> end over fixed routes: Dijkstra with
// edges weighted by EXPECTED_ROLLS. The graph is connected, so this resolves.
function expectedRollsPar(adj, edges, start, end) {
  const dist = new Array(adj.length).fill(Infinity);
  const done = new Array(adj.length).fill(false);
  dist[start] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < adj.length; i++) {
      if (!done[i] && (u === -1 || dist[i] < dist[u])) u = i;
    }
    if (u === end) return dist[end];
    done[u] = true;
    for (const { edge, other } of adj[u]) {
      const alt = dist[u] + EXPECTED_ROLLS[edges[edge].color];
      if (alt < dist[other]) dist[other] = alt;
    }
  }
}

// Edge indices along a shortest-hop path start -> end.
function shortestHopPathEdges(adj, start, end) {
  const prev = new Array(adj.length).fill(null);
  prev[start] = { node: start, edge: -1 };
  const queue = [start];
  while (queue.length) {
    const u = queue.shift();
    if (u === end) break;
    for (const { edge, other } of adj[u]) {
      if (prev[other] === null) {
        prev[other] = { node: u, edge };
        queue.push(other);
      }
    }
  }
  const path = [];
  for (let u = end; u !== start; u = prev[u].node) path.push(prev[u].edge);
  return path;
}

function buildMaze(width, height, margin, nodeCount, minDist, distSpread, maxEdgeLen, edgeKeep, lakes) {
  const nodes = scatterPoints(width, height, margin, nodeCount, minDist, distSpread, lakes);
  const pruned = pruneLongEdges(nodes, delaunayEdges(nodes), maxEdgeLen);
  const pairs = sparsifyPairs(nodes.length, pruned, edgeKeep);
  const edges = pairs.map(([a, b]) => ({ a, b, color: randomEdgeColor() }));
  const start = indexOfExtreme(nodes, (p, q) => p.x < q.x);
  const end = indexOfExtreme(nodes, (p, q) => p.x > q.x);
  const adj = adjacency(nodes.length, edges);
  // The favor (sort of): the direct route is traceable — and priced in blue.
  for (const i of shortestHopPathEdges(adj, start, end)) edges[i].color = "blue";
  const par = Math.round(expectedRollsPar(adj, edges, start, end));
  return { nodes, edges, adj, start, end, par, lakes };
}

// Run state: one attempt at one maze.
// phase: "idle" (may roll) | "move" (must move or pass) | "won"
function newRun(maze) {
  return { maze, current: maze.start, rolls: 0, face: null, phase: "idle" };
}

function rollFace() {
  return DIE_FACES[Math.floor(Math.random() * DIE_FACES.length)];
}

function usableMoves(run) {
  if (!run.face) return [];
  return run.maze.adj[run.current].filter(
    ({ edge }) => run.face.includes(run.maze.edges[edge].color)
  );
}

// Returns the usable moves; empty means a dead roll (turn lost, phase stays idle).
function applyRoll(run, face) {
  run.rolls += 1;
  run.face = face;
  const moves = usableMoves(run);
  run.phase = moves.length ? "move" : "idle";
  return moves;
}

function applyMove(run, target) {
  run.current = target;
  run.face = null;
  run.phase = target === run.maze.end ? "won" : "idle";
}
