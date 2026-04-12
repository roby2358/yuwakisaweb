// DEFRAG — solo puzzle game. See DYNAMICS.md for design.

import { ColorTheory } from './colortheory.js';

// ---------- Config ----------
const COLS = 32;
const ROWS = 16;
const CELL = 20;

const FILE_COUNT = 4;
const FILE_SIZE_MIN = 4;
const FILE_SIZE_MAX = 7;
const SYSTEM_COUNT = 20;
const SWAP_PER_TICK = 20;
const WRITES_PER_TURN = 2;
const MFT_HP_MAX = 5;
const CORRUPT_BASE = 0.20;
const CORRUPT_GROWTH_PER_5 = 0.05;
const FRESH_DECAY_CHANCE = 0.10;

const FILE_NAMES = ['winlogon.exe', 'kernel32.dll', 'boot.cfg', 'user.dat'];

// Generate a fresh, harmonious palette for each run. randomScheme returns
// 5 colors sorted by luminance ascending — we drop the darkest so the file
// blocks always read clearly against the dark canvas.
function generateFileColors() {
  const palette = ColorTheory.randomScheme(Math.random);
  return palette.slice(1).map(([r, g, b]) => ColorTheory.rgbToHex(r, g, b));
}

const EMPTY = 'empty';
const FILE = 'file';
const SYSTEM = 'system';
const BAD = 'bad';
const MFT = 'mft';

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

// ---------- State ----------
const state = {
  grid: [],
  files: [],
  swapTotal: 0,
  turn: 1,
  score: 0,
  archived: 0,
  mft: MFT_HP_MAX,
  mftPos: null,
  selected: null,
  gameOver: false,
  outcome: null, // 'win' | 'partial' | 'loss'
  message: '',
};

// ---------- Utils ----------
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const inBounds = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const at = (x, y) => state.grid[y][x];

// ---------- Init ----------
function init() {
  state.grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ kind: EMPTY }))
  );
  state.files = [];
  state.swapTotal = 0;
  state.turn = 1;
  state.score = 0;
  state.archived = 0;
  state.mft = MFT_HP_MAX;
  state.selected = null;
  state.gameOver = false;
  state.outcome = null;
  state.message = 'Click a sector, then click another to swap. Every 20 units of movement advances the disk.';

  // MFT at center
  const mx = Math.floor(COLS / 2);
  const my = Math.floor(ROWS / 2);
  state.grid[my][mx] = { kind: MFT };
  state.mftPos = { x: mx, y: my };

  placeRandom(SYSTEM, SYSTEM_COUNT);

  const fileColors = generateFileColors();
  for (let i = 0; i < FILE_COUNT; i++) {
    state.files.push({
      id: i,
      name: FILE_NAMES[i],
      color: fileColors[i],
      blocks: [],
      archived: false,
      defragged: false,
      lost: false,
    });
    let prev = findEmpty();
    if (!prev) break;
    state.grid[prev.y][prev.x] = { kind: FILE, fileId: i };
    const size = FILE_SIZE_MIN + rand(FILE_SIZE_MAX - FILE_SIZE_MIN + 1);
    for (let b = 1; b < size; b++) {
      let next;
      if (Math.random() < 0.50) {
        next = nextEmptyInReadingOrder(prev);
        if (!next) next = findEmpty();
      } else {
        next = findEmpty();
      }
      if (!next) break;
      state.grid[next.y][next.x] = { kind: FILE, fileId: i };
      prev = next;
    }
  }

  // Initial bad sector on an edge (not on a locked cell)
  const edges = [];
  for (let x = 0; x < COLS; x++) {
    edges.push({ x, y: 0 });
    edges.push({ x, y: ROWS - 1 });
  }
  for (let y = 1; y < ROWS - 1; y++) {
    edges.push({ x: 0, y });
    edges.push({ x: COLS - 1, y });
  }
  const edgeEmpties = edges.filter((p) => at(p.x, p.y).kind === EMPTY);
  if (edgeEmpties.length) {
    const p = pick(edgeEmpties);
    state.grid[p.y][p.x] = { kind: BAD };
  }

  rebuildFileBlocks();
  recomputeDefragStatus();
}

function placeRandom(kind, count) {
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < 5000) {
    tries++;
    const x = rand(COLS);
    const y = rand(ROWS);
    if (state.grid[y][x].kind !== EMPTY) continue;
    state.grid[y][x] = { kind };
    placed++;
  }
}

function findEmpty() {
  const empties = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (state.grid[y][x].kind === EMPTY) empties.push({ x, y });
    }
  }
  return empties.length ? pick(empties) : null;
}

function nextEmptyInReadingOrder(start) {
  const total = COLS * ROWS;
  const startIdx = start.y * COLS + start.x;
  for (let i = 1; i <= total; i++) {
    const idx = (startIdx + i) % total;
    const x = idx % COLS;
    const y = Math.floor(idx / COLS);
    if (state.grid[y][x].kind === EMPTY) return { x, y };
  }
  return null;
}

function rebuildFileBlocks() {
  for (const f of state.files) f.blocks = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = state.grid[y][x];
      if (c.kind === FILE) state.files[c.fileId].blocks.push({ x, y });
    }
  }
}

function recomputeDefragStatus() {
  for (const f of state.files) {
    if (f.archived || f.lost || f.blocks.length === 0) {
      f.defragged = false;
      continue;
    }
    f.defragged = isContinuousRun(f);
  }
}

// A file is defragged when its blocks occupy consecutive sector indices
// (index = y * COLS + x), which means a horizontal run that naturally
// wraps from the right edge of one row to the left edge of the next.
function isContinuousRun(file) {
  const blocks = file.blocks;
  if (blocks.length <= 1) return true;
  const indices = blocks.map((b) => b.y * COLS + b.x).sort((a, b) => a - b);
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) return false;
  }
  return true;
}

// ---------- Swap ----------
const isMovable = (cell) => cell.kind === EMPTY || cell.kind === FILE;

function trySwap(a, b) {
  if (a.x === b.x && a.y === b.y) return { ok: false, reason: 'same' };
  const ca = at(a.x, a.y);
  const cb = at(b.x, b.y);
  if (!isMovable(ca) || !isMovable(cb)) return { ok: false, reason: 'locked' };
  if (ca.kind === EMPTY && cb.kind === EMPTY) return { ok: false, reason: 'no-op' };
  const cost = manhattan(a, b);
  state.grid[a.y][a.x] = cb;
  state.grid[b.y][b.x] = ca;
  markFreshAround(a);
  markFreshAround(b);
  rebuildFileBlocks();
  recomputeDefragStatus();
  advanceClock(cost);
  return { ok: true, cost };
}

function advanceClock(cost) {
  const prevTicks = Math.floor(state.swapTotal / SWAP_PER_TICK);
  state.swapTotal += cost;
  const newTicks = Math.floor(state.swapTotal / SWAP_PER_TICK);
  for (let i = prevTicks; i < newTicks; i++) {
    runTick();
    if (state.gameOver) return;
  }
}

function markFreshAround(p) {
  const self = state.grid[p.y][p.x];
  if (self.kind === EMPTY || self.kind === FILE) self.fresh = true;
  for (const [dx, dy] of DIRS) {
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (!inBounds(nx, ny)) continue;
    const c = state.grid[ny][nx];
    if (c.kind === EMPTY || c.kind === FILE) c.fresh = true;
  }
}

function decayFreshness() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = state.grid[y][x];
      if (c.fresh && Math.random() < FRESH_DECAY_CHANCE) c.fresh = false;
    }
  }
}

// ---------- Archive ----------
function archiveFile(fileId) {
  const file = state.files[fileId];
  if (file.archived || !file.defragged) return;
  const blockCount = file.blocks.length;
  state.score += blockCount * 100;
  let cleansed = 0;
  for (const b of file.blocks) {
    for (const [dx, dy] of DIRS) {
      const nx = b.x + dx;
      const ny = b.y + dy;
      if (!inBounds(nx, ny)) continue;
      if (state.grid[ny][nx].kind === BAD) {
        state.grid[ny][nx] = { kind: EMPTY };
        cleansed++;
      }
    }
  }
  for (const b of file.blocks) state.grid[b.y][b.x] = { kind: EMPTY };
  file.blocks = [];
  file.archived = true;
  file.defragged = false;
  state.archived++;
  state.message =
    `Archived ${file.name} (+${blockCount * 100})` +
    (cleansed ? ` — ${cleansed} sector${cleansed > 1 ? 's' : ''} cleansed` : '');
  checkEndGame();
  render();
}

function checkEndGame() {
  if (state.gameOver) return;
  if (state.mft <= 0) {
    state.gameOver = true;
    state.outcome = 'loss';
    state.message = `MFT CORRUPTED — DISK LOST on turn ${state.turn}. Final: ${state.score} pts.`;
    return;
  }
  const resolved = state.files.filter((f) => f.archived || f.lost);
  if (resolved.length < state.files.length) return;
  const archivedCount = state.files.filter((f) => f.archived).length;
  const lostCount = state.files.filter((f) => f.lost).length;
  state.gameOver = true;
  if (archivedCount === state.files.length) {
    state.outcome = 'win';
    state.message = `PERFECT DEFRAG — all ${archivedCount} files archived in ${state.turn} turns. Final: ${state.score} pts.`;
  } else if (archivedCount === 0) {
    state.outcome = 'loss';
    state.message = `DISK WIPED — every file lost. Final: ${state.score} pts.`;
  } else {
    state.outcome = 'partial';
    state.message = `PARTIAL RECOVERY — ${archivedCount} archived, ${lostCount} lost. Final: ${state.score} pts.`;
  }
}

// ---------- Tick (the periodic event pulse, fired every SWAP_PER_TICK units of movement) ----------
function runTick() {
  if (state.gameOver) return;

  for (let i = 0; i < WRITES_PER_TURN; i++) writeBlock();
  rebuildFileBlocks();
  const lostEvents = spreadCorruption();
  decayFreshness();

  rebuildFileBlocks();
  recomputeDefragStatus();

  const dmg = countAdjacentBadToMft();
  state.mft -= dmg;

  state.turn++;

  const parts = [];
  for (const ev of lostEvents) parts.push(`${ev.name} LOST (-${ev.penalty})`);
  if (dmg > 0) parts.push(`MFT -${dmg}`);
  if (parts.length) {
    state.message = `Turn ${state.turn}: ${parts.join(' · ')}`;
  } else {
    state.message = `Turn ${state.turn}: disk stable.`;
  }
  checkEndGame();
}

function writeBlock() {
  if (Math.random() < 1 / 3) {
    const pos = findEmpty();
    if (!pos) return;
    state.grid[pos.y][pos.x] = { kind: SYSTEM };
    return;
  }
  const active = state.files.filter((f) => !f.archived && !f.lost);
  if (!active.length) return;
  const file = pick(active);
  let pos = null;
  if (file.defragged && file.blocks.length > 0) {
    const extensions = runExtensions(file);
    if (extensions.length) pos = pick(extensions);
  }
  if (!pos) pos = findEmpty();
  if (!pos) return;
  state.grid[pos.y][pos.x] = { kind: FILE, fileId: file.id };
}

// For a defragged (continuous) file, the only valid write positions that
// preserve the run are the two sector indices immediately before the first
// block and immediately after the last block in reading order.
function runExtensions(file) {
  const indices = file.blocks.map((b) => b.y * COLS + b.x).sort((a, b) => a - b);
  const total = COLS * ROWS;
  const candidates = [indices[0] - 1, indices[indices.length - 1] + 1];
  const out = [];
  for (const idx of candidates) {
    if (idx < 0 || idx >= total) continue;
    const x = idx % COLS;
    const y = Math.floor(idx / COLS);
    if (state.grid[y][x].kind === EMPTY) out.push({ x, y });
  }
  return out;
}

function adjacentEmptyOf(blocks) {
  const out = [];
  const seen = new Set();
  for (const b of blocks) {
    for (const [dx, dy] of DIRS) {
      const nx = b.x + dx;
      const ny = b.y + dy;
      if (!inBounds(nx, ny)) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      if (state.grid[ny][nx].kind === EMPTY) {
        seen.add(k);
        out.push({ x: nx, y: ny });
      }
    }
  }
  return out;
}

function spreadCorruption() {
  const chance = CORRUPT_BASE + Math.floor(state.turn / 5) * CORRUPT_GROWTH_PER_5;
  const bads = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (state.grid[y][x].kind === BAD) bads.push({ x, y });
    }
  }
  const lostEvents = [];
  for (const b of bads) {
    if (Math.random() >= chance) continue;
    const targets = [];
    for (const [dx, dy] of DIRS) {
      const nx = b.x + dx;
      const ny = b.y + dy;
      if (!inBounds(nx, ny)) continue;
      const c = state.grid[ny][nx];
      if ((c.kind === EMPTY || c.kind === FILE) && !c.fresh) targets.push({ x: nx, y: ny });
    }
    if (!targets.length) continue;
    const t = pick(targets);
    const victim = state.grid[t.y][t.x];
    if (victim.kind === FILE) {
      const file = state.files[victim.fileId];
      if (!file.lost) {
        file.lost = true;
        const penalty = 100 * file.blocks.length;
        state.score -= penalty;
        lostEvents.push({ name: file.name, penalty });
      }
    }
    state.grid[t.y][t.x] = { kind: BAD };
  }
  return lostEvents;
}

function countAdjacentBadToMft() {
  const { x, y } = state.mftPos;
  let n = 0;
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(nx, ny)) continue;
    if (state.grid[ny][nx].kind === BAD) n++;
  }
  return n;
}

// ---------- Rendering ----------
const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

function render() {
  ctx.fillStyle = '#0a0f18';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      drawCell(x, y);
    }
  }

  for (const file of state.files) {
    if (file.defragged) drawDefragOutline(file);
  }

  if (state.selected) {
    const { x, y } = state.selected;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  }

  if (state.gameOver) drawGameOver();

  renderHud();
  renderFileList();
}

function drawCell(x, y) {
  const c = state.grid[y][x];
  const px = x * CELL;
  const py = y * CELL;
  let color = '#141a26'; // empty, not fresh — darkest
  if (c.kind === EMPTY && c.fresh) color = '#2e3643'; // empty, fresh — mid gray
  else if (c.kind === FILE) color = state.files[c.fileId].color;
  else if (c.kind === SYSTEM) color = '#64748b'; // locked — brightest gray
  else if (c.kind === BAD) color = '#dc2626';
  else if (c.kind === MFT) color = '#fbbf24';

  ctx.fillStyle = color;
  ctx.fillRect(px, py, CELL, CELL);

  if (c.kind === FILE && state.files[c.fileId].lost) {
    ctx.fillStyle = 'rgba(6, 9, 15, 0.6)';
    ctx.fillRect(px, py, CELL, CELL);
    ctx.strokeStyle = 'rgba(127, 29, 29, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 3, py + 3);
    ctx.lineTo(px + CELL - 3, py + CELL - 3);
    ctx.stroke();
  }

  ctx.strokeStyle = '#06090f';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);

  if (c.kind === BAD) {
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 2, py + 2);
    ctx.lineTo(px + CELL - 2, py + CELL - 2);
    ctx.moveTo(px + CELL - 2, py + 2);
    ctx.lineTo(px + 2, py + CELL - 2);
    ctx.stroke();
  }

  if (c.kind === MFT) {
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', px + CELL / 2, py + CELL / 2 + 1);
  }

  if (c.kind === SYSTEM) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(px + 4, py + 4, 2, 2);
    ctx.fillRect(px + CELL - 6, py + CELL - 6, 2, 2);
  }

}

function drawDefragOutline(file) {
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  for (const b of file.blocks) {
    const px = b.x * CELL;
    const py = b.y * CELL;
    const edges = [
      [0, -1, px, py, px + CELL, py],
      [0, 1, px, py + CELL, px + CELL, py + CELL],
      [-1, 0, px, py, px, py + CELL],
      [1, 0, px + CELL, py, px + CELL, py + CELL],
    ];
    for (const [dx, dy, x1, y1, x2, y2] of edges) {
      const nx = b.x + dx;
      const ny = b.y + dy;
      const same =
        inBounds(nx, ny) &&
        at(nx, ny).kind === FILE &&
        at(nx, ny).fileId === file.id;
      if (same) continue;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(6, 9, 15, 0.82)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const banner = {
    win:     { color: '#5eead4', text: 'DISK RESTORED' },
    partial: { color: '#fbbf24', text: 'PARTIAL RECOVERY' },
    loss:    { color: '#f87171', text: 'DISK LOST' },
  }[state.outcome] || { color: '#94a3b8', text: 'GAME OVER' };
  ctx.fillStyle = banner.color;
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(banner.text, canvas.width / 2, canvas.height / 2 - 18);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px monospace';
  const archivedCount = state.files.filter((f) => f.archived).length;
  const lostCount = state.files.filter((f) => f.lost).length;
  ctx.fillText(
    `${archivedCount} archived · ${lostCount} lost · ${state.score} pts`,
    canvas.width / 2,
    canvas.height / 2 + 10
  );
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px monospace';
  ctx.fillText('press NEW DISK to retry', canvas.width / 2, canvas.height / 2 + 32);
}

function renderHud() {
  document.getElementById('turn').textContent = state.turn;
  document.getElementById('clock').textContent = state.swapTotal % SWAP_PER_TICK;
  document.getElementById('score').textContent = state.score;
  document.getElementById('archived').textContent = `${state.archived}/${FILE_COUNT}`;
  document.getElementById('mft').textContent = state.mft;
  document.getElementById('message').textContent = state.message;
}

function renderFileList() {
  const ul = document.getElementById('file-list');
  ul.innerHTML = '';
  for (const file of state.files) {
    const li = document.createElement('li');

    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = file.color;
    sw.style.color = file.color;
    li.appendChild(sw);

    const nm = document.createElement('span');
    nm.className = 'fname';
    nm.textContent = file.name;
    li.appendChild(nm);

    const st = document.createElement('span');
    st.className = 'status';
    if (file.archived) {
      st.classList.add('archived');
      st.textContent = 'ARCHIVED';
      li.appendChild(st);
    } else if (file.lost) {
      st.classList.add('lost');
      st.textContent = file.blocks.length > 0 ? `LOST ${file.blocks.length}b` : 'LOST';
      li.appendChild(st);
    } else if (file.blocks.length === 0) {
      st.classList.add('lost');
      st.textContent = 'LOST';
      li.appendChild(st);
    } else if (file.defragged) {
      st.classList.add('defragged');
      st.textContent = `${file.blocks.length}b OK`;
      li.appendChild(st);
      const btn = document.createElement('button');
      btn.textContent = 'ARCHIVE';
      btn.onclick = () => archiveFile(file.id);
      li.appendChild(btn);
    } else {
      st.classList.add('fragmented');
      st.textContent = `${file.blocks.length}b frag`;
      li.appendChild(st);
    }
    ul.appendChild(li);
  }
}

// ---------- Input ----------
canvas.addEventListener('click', (e) => {
  if (state.gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  const x = Math.floor(px / CELL);
  const y = Math.floor(py / CELL);
  if (!inBounds(x, y)) return;
  const cell = at(x, y);

  if (!state.selected) {
    if (!isMovable(cell)) {
      state.message = 'Locked sector — cannot move that.';
      render();
      return;
    }
    state.selected = { x, y };
    state.message = `Source (${x},${y}) — click destination.`;
    render();
    return;
  }

  const a = state.selected;
  const b = { x, y };
  const result = trySwap(a, b);
  state.selected = null;

  if (result.ok && !state.gameOver) {
    state.message = `Swap cost ${result.cost}. Clock ${state.swapTotal % SWAP_PER_TICK}/${SWAP_PER_TICK}.`;
  } else if (!result.ok) {
    const reasons = {
      same: 'Deselected.',
      locked: 'Destination locked.',
      'no-op': 'Both sectors empty.',
    };
    state.message = reasons[result.reason] || 'Swap failed.';
  }
  render();
});

document.getElementById('restart').addEventListener('click', () => {
  init();
  render();
});

// ---------- Start ----------
init();
render();
