"use strict";

// Headless verification: loads the browser scripts (no DOM needed) into a vm
// context, checks maze structure, die distribution, and runs a greedy bot to
// the exit across many mazes. Usage: node test/sim.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = vm.createContext({ Math, console });
for (const file of ["delaunay.js", "game.js"]) {
  const src = fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8");
  vm.runInContext(src, context, { filename: file });
}
const G = vm.runInContext(
  "({ buildMaze, randomLakes, newRun, rollFace, applyRoll, applyMove, usableMoves, DIE_FACES })",
  context
);

let failures = 0;
function check(label, ok) {
  if (!ok) failures += 1;
  console.log((ok ? "ok   " : "FAIL ") + label);
}

// --- Die distribution ---
const ROLLS = 60000;
const seen = { red: 0, blue: 0, green: 0 };
for (let i = 0; i < ROLLS; i++) {
  for (const color of G.rollFace()) seen[color] += 1;
}
check("die faces: 6 faces, 9 color slots", G.DIE_FACES.length === 6 &&
  G.DIE_FACES.reduce((s, f) => s + f.length, 0) === 9);
check("red available ~4/6 (" + (seen.red / ROLLS).toFixed(3) + ")",
  Math.abs(seen.red / ROLLS - 4 / 6) < 0.02);
check("green available ~3/6 (" + (seen.green / ROLLS).toFixed(3) + ")",
  Math.abs(seen.green / ROLLS - 3 / 6) < 0.02);
check("blue available ~2/6 (" + (seen.blue / ROLLS).toFixed(3) + ")",
  Math.abs(seen.blue / ROLLS - 2 / 6) < 0.02);

// --- Maze structure ---
const MAZES = 200;
let structureOk = true;
let parWeighted = true;
let botFailures = 0;
let totalRolls = 0;
let totalPar = 0;

for (let m = 0; m < MAZES; m++) {
  const lakes = G.randomLakes(900, 600, 3, 55, 85);
  const maze = G.buildMaze(900, 600, 48, 80, 35, 3, 120, 1.0, lakes);
  const colorsValid = maze.edges.every(e => ["red", "green", "blue"].includes(e.color));
  const dryNodes = maze.nodes.every(p =>
    lakes.every(L => Math.hypot(p.x - L.x, p.y - L.y) >= L.r));
  if (maze.start === maze.end || maze.par < 1 || !colorsValid || !dryNodes) {
    structureOk = false;
    continue;
  }
  // Cheapest edge is red at 1.5 expected rolls, so par can't be under 1.5x hops
  const hops = hopsToEnd(maze)[maze.start];
  if (maze.par < 1.5 * hops - 0.5) parWeighted = false;
  const rolls = runBot(maze);
  if (rolls === null) botFailures += 1;
  else {
    totalRolls += rolls;
    totalPar += maze.par;
  }
}
check("all " + MAZES + " mazes: connected, start!=end, valid colors, no node in a lake", structureOk);
check("par is expected-rolls weighted (>= 1.5x hop count)", parWeighted);
check("greedy bot reached exit in every maze", botFailures === 0);

const meanRolls = totalRolls / (MAZES - botFailures);
const meanPar = totalPar / (MAZES - botFailures);
console.log("bot mean rolls " + meanRolls.toFixed(1) + ", mean par " + meanPar.toFixed(1) +
  ", ratio " + (meanRolls / meanPar).toFixed(2));

// Color-aware distance: Dijkstra to the exit weighted by expected rolls per
// edge (red 1.5, green 2, blue 3). Hop counting walks straight into the blue
// road; this prices it.
function costToEnd(maze) {
  const EXPECTED = { red: 1.5, green: 2, blue: 3 };
  const n = maze.nodes.length;
  const dist = new Array(n).fill(Infinity);
  const done = new Array(n).fill(false);
  dist[maze.end] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!done[i] && (u === -1 || dist[i] < dist[u])) u = i;
    }
    if (u === -1) return dist;
    done[u] = true;
    for (const { edge, other } of maze.adj[u]) {
      const alt = dist[u] + EXPECTED[maze.edges[edge].color];
      if (alt < dist[other]) dist[other] = alt;
    }
  }
}

// Greedy bot: precompute expected-cost distance to exit; a usable roll MUST
// be spent (no pass), so take the least-bad edge — backward if that's all
// there is. Returns roll count or null if capped.
function runBot(maze) {
  const dist = costToEnd(maze);
  const run = G.newRun(maze);
  for (let i = 0; i < 10000; i++) {
    const moves = G.applyRoll(run, G.rollFace());
    if (moves.length) {
      moves.sort((p, q) => dist[p.other] - dist[q.other]);
      G.applyMove(run, moves[0].other);
    }
    if (run.phase === "won") return run.rolls;
  }
  return null;
}

function hopsToEnd(maze) {
  const dist = new Array(maze.nodes.length).fill(-1);
  dist[maze.end] = 0;
  const queue = [maze.end];
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

process.exit(failures ? 1 : 0);
