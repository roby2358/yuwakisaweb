"use strict";

// UI smoke test without a browser: loads all three browser scripts against a
// stub DOM, then plays a full game through the real event handlers (roll
// button click, canvas clicks on target nodes). Catches wiring typos and
// handler crashes that the pure-logic sim can't. Usage: node test/smoke.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function stubElement(id) {
  return {
    id,
    handlers: {},
    style: {},
    attrs: {},
    children: [],
    textContent: "",
    disabled: false,
    hidden: false,
    addEventListener(type, fn) { this.handlers[type] = fn; },
    replaceChildren() { this.children = []; },
    appendChild(child) { this.children.push(child); },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    toggleAttribute(name, force) {
      const on = force !== undefined ? force : !(name in this.attrs);
      if (on) this.attrs[name] = "";
      else delete this.attrs[name];
      return on;
    },
  };
}

const canvas = stubElement("board");
canvas.width = 900;
canvas.height = 600;
canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 600 });
canvas.getContext = () => new Proxy({}, {
  get: (t, key) => (key === "canvas" ? canvas : () => undefined),
  set: () => true,
});

const byId = { board: canvas };
const document = {
  getElementById(id) {
    if (!byId[id]) byId[id] = stubElement(id);
    return byId[id];
  },
  createElement: tag => stubElement(tag),
};

const window = { matchMedia: () => ({ matches: false }) }; // desktop layout
const context = vm.createContext({ Math, console, document, window, setInterval, clearInterval });
for (const file of ["delaunay.js", "game.js", "main.js"]) {
  const src = fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8");
  vm.runInContext(src, context, { filename: file });
}
const S = () => vm.runInContext("({ run, rolling, moves: usableMoves(run) })", context);

let failures = 0;
function check(label, ok) {
  if (!ok) failures += 1;
  console.log((ok ? "ok   " : "FAIL ") + label);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Color-aware distances to the exit (Dijkstra, expected rolls per edge);
// moves are forced, and hop or euclidean greed walks into the all-blue road.
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

(async () => {
  const first = S();
  check("game boots: run exists, phase idle, par > 0",
    first.run && first.run.phase === "idle" && first.run.maze.par > 0);
  check("die legend built (6 face chips)", byId["face-list"].children.length === 6);

  const dist = costToEnd(first.run.maze);
  let clicks = 0;
  for (let turn = 0; turn < 600 && S().run.phase !== "won"; turn++) {
    const { run } = S();
    if (run.phase === "idle") {
      byId.roll.handlers.click();
      await sleep(600); // outlast the 8 x 60ms flicker
      continue;
    }
    // phase "move": real canvas click on the least-bad target (moves are forced)
    const { moves } = S();
    moves.sort((p, q) => dist[p.other] - dist[q.other]);
    const node = run.maze.nodes[moves[0].other];
    canvas.handlers.click({ clientX: node.x, clientY: node.y });
    clicks += 1;
  }

  const last = S();
  check("reached the exit through real UI handlers", last.run.phase === "won");
  check("rolls counted (" + last.run.rolls + " >= moves " + clicks + ")", last.run.rolls >= clicks);
  // String(): the stub stores raw values where real textContent coerces
  check("DOM rolls counter matches", String(byId.rolls.textContent) === String(last.run.rolls));
  check("win message mentions par", byId.message.textContent.includes("par " + last.run.maze.par));

  // Retry keeps the maze, resets the run; New maze rebuilds
  const mazeBefore = last.run.maze;
  byId.retry.handlers.click();
  const afterRetry = S();
  check("retry: same maze, rolls reset, back at start",
    afterRetry.run.maze === mazeBefore && afterRetry.run.rolls === 0 &&
    afterRetry.run.current === mazeBefore.start);
  byId["new-maze"].handlers.click();
  const afterNew = S();
  check("new maze: different maze, best cleared",
    afterNew.run.maze !== mazeBefore && byId.best.textContent === "—");

  process.exit(failures ? 1 : 0);
})();
