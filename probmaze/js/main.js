"use strict";

const BOARD_WIDTH = 900;
const BOARD_HEIGHT = 600;
const BOARD_MARGIN = 48;
const NODE_COUNT = 80;
const NODE_MIN_DIST = 35;
const NODE_DIST_SPREAD = 3;
const EDGE_MAX_LEN = 120;
const LAKE_COUNT = 3;
const LAKE_R_MIN = 55;
const LAKE_R_MAX = 85;
const NODE_RADIUS = 8;
const CLICK_RADIUS = 18;
const ROLL_FLICKER_TICKS = 8;
const ROLL_FLICKER_MS = 60;

const COLOR_HEX = { red: "#e5484d", blue: "#3e83f8", green: "#46a758" };

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const els = {
  die: document.getElementById("die"),
  roll: document.getElementById("roll"),
  pass: document.getElementById("pass"),
  message: document.getElementById("message"),
  rolls: document.getElementById("rolls"),
  par: document.getElementById("par"),
  best: document.getElementById("best"),
  faceList: document.getElementById("face-list"),
  retry: document.getElementById("retry"),
  newMaze: document.getElementById("new-maze"),
};

let run = null;
let bestRolls = null;
let rolling = false;

function startGame(maze) {
  run = newRun(maze);
  rolling = false;
  setMessage("Roll the die.");
  refresh();
}

function newMaze() {
  bestRolls = null;
  const lakes = randomLakes(BOARD_WIDTH, BOARD_HEIGHT, LAKE_COUNT, LAKE_R_MIN, LAKE_R_MAX);
  startGame(buildMaze(BOARD_WIDTH, BOARD_HEIGHT, BOARD_MARGIN, NODE_COUNT, NODE_MIN_DIST, NODE_DIST_SPREAD, EDGE_MAX_LEN, lakes));
}

function setMessage(text) {
  els.message.textContent = text;
}

function refresh() {
  render();
  updatePanel();
}

// --- Dice ---

function startRoll() {
  if (rolling || run.phase !== "idle") return;
  rolling = true;
  let ticks = 0;
  const timer = setInterval(() => {
    ticks += 1;
    showFace(rollFace());
    if (ticks < ROLL_FLICKER_TICKS) return;
    clearInterval(timer);
    rolling = false;
    resolveRoll(rollFace());
  }, ROLL_FLICKER_MS);
  updatePanel();
}

function resolveRoll(face) {
  const moves = applyRoll(run, face);
  if (moves.length) {
    setMessage("Take a bright edge — or pass.");
  } else {
    setMessage("Dead roll — no " + face.join(" or ") + " edge here. Turn lost.");
  }
  refresh();
}

// --- Board input ---

canvas.addEventListener("click", event => {
  if (run.phase !== "move") return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  const target = pickTarget(x, y);
  if (target === null) return;
  applyMove(run, target);
  if (run.phase === "won") finishRun();
  else setMessage("Roll the die.");
  refresh();
});

function pickTarget(x, y) {
  let best = null;
  let bestD2 = CLICK_RADIUS * CLICK_RADIUS;
  for (const { other } of usableMoves(run)) {
    const p = run.maze.nodes[other];
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d2 <= bestD2) {
      best = other;
      bestD2 = d2;
    }
  }
  return best;
}

function finishRun() {
  if (bestRolls === null || run.rolls < bestRolls) bestRolls = run.rolls;
  setMessage("Out in " + run.rolls + " rolls (par " + run.maze.par + "). Retry or new maze?");
}

// --- Panel ---

function updatePanel() {
  els.rolls.textContent = run.rolls;
  els.par.textContent = run.maze.par;
  els.best.textContent = bestRolls === null ? "—" : bestRolls;
  els.roll.disabled = rolling || run.phase !== "idle";
  els.pass.hidden = run.phase !== "move";
  if (!rolling) showFace(run.face);
}

function showFace(face) {
  els.die.replaceChildren();
  if (!face) {
    const blank = document.createElement("span");
    blank.className = "pip blank";
    blank.textContent = "?";
    els.die.appendChild(blank);
    return;
  }
  for (const color of face) {
    const pip = document.createElement("span");
    pip.className = "pip";
    pip.style.background = COLOR_HEX[color];
    els.die.appendChild(pip);
  }
}

function buildFaceLegend() {
  els.faceList.replaceChildren();
  for (const face of DIE_FACES) {
    const chip = document.createElement("span");
    chip.className = "face-chip";
    for (const color of face) {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = COLOR_HEX[color];
      chip.appendChild(dot);
    }
    els.faceList.appendChild(chip);
  }
}

// --- Rendering ---

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { nodes, edges } = run.maze;
  const moves = usableMoves(run);
  const usable = new Set(moves.map(m => m.edge));
  const targets = new Set(moves.map(m => m.other));
  const choosing = run.phase === "move";

  for (let i = 0; i < edges.length; i++) {
    drawEdge(edges[i], nodes, choosing, usable.has(i));
  }
  for (let i = 0; i < nodes.length; i++) {
    drawNode(i, nodes[i], choosing && targets.has(i));
  }
}

function drawEdge(edge, nodes, choosing, isUsable) {
  const a = nodes[edge.a];
  const b = nodes[edge.b];
  ctx.save();
  ctx.strokeStyle = COLOR_HEX[edge.color];
  if (choosing && isUsable) {
    ctx.lineWidth = 7;
    ctx.shadowColor = COLOR_HEX[edge.color];
    ctx.shadowBlur = 12;
  } else {
    ctx.lineWidth = 3;
    ctx.globalAlpha = choosing ? 0.22 : 0.85;
  }
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawNode(index, p, isTarget) {
  const isStart = index === run.maze.start;
  const isEnd = index === run.maze.end;
  const isCurrent = index === run.current;

  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, NODE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = isEnd ? "#f5c518" : "#cbd2dc";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#14161a";
  ctx.stroke();

  if (isCurrent) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, NODE_RADIUS + 5, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }
  if (isTarget) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, NODE_RADIUS + 9, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }
  ctx.restore();

  if (isStart || isEnd) {
    ctx.save();
    ctx.fillStyle = "#e8ebf0";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isStart ? "START" : "EXIT", p.x, p.y - NODE_RADIUS - 10);
    ctx.restore();
  }
}

// --- Wiring ---

els.roll.addEventListener("click", startRoll);
els.pass.addEventListener("click", () => {
  applyPass(run);
  setMessage("Passed. Roll the die.");
  refresh();
});
els.retry.addEventListener("click", () => startGame(run.maze));
els.newMaze.addEventListener("click", newMaze);

buildFaceLegend();
newMaze();
