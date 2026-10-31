// Dungeon generation and grid geometry: line of sight, BFS flow fields, wall collision.
(function (ID) {
  const N = ID.N, CELL = N.CELL;

  function generateLevel(seed, depth) {
    const W = N.MAP_W, H = N.MAP_H;
    const rng = new ID.Rng(ID.hash(seed, 'map', depth));
    const cells = new Uint8Array(W * H).fill(1);
    const rooms = [];
    const m = N.ROOM_MARGIN;
    for (let t = 0; t < 800 && rooms.length < N.ROOM_COUNT; t++) {
      const w = rng.int(N.ROOM_MIN, N.ROOM_MAX), h = rng.int(N.ROOM_MIN, Math.round(N.ROOM_MAX * 0.75));
      const x = rng.int(1, W - w - 1), y = rng.int(1, H - h - 1);
      const clash = rooms.some(r => x < r.x + r.w + m && x + w + m > r.x && y < r.y + r.h + m && y + h + m > r.y);
      if (!clash) rooms.push({ x, y, w, h });
    }
    rooms.sort((a, b) => a.x - b.x);

    const carve = (x0, y0, x1, y1) => {
      for (let y = Math.max(1, y0); y <= Math.min(H - 2, y1); y++)
        for (let x = Math.max(1, x0); x <= Math.min(W - 2, x1); x++) cells[y * W + x] = 0;
    };
    const half = Math.floor(N.CORRIDOR_W / 2);
    const mid = r => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });
    const hline = (xa, xb, y) => carve(Math.min(xa, xb) - half, y - half, Math.max(xa, xb) + half, y + half);
    const vline = (ya, yb, x) => carve(x - half, Math.min(ya, yb) - half, x + half, Math.max(ya, yb) + half);
    const corridor = (a, b) => {
      const ca = mid(a), cb = mid(b);
      if (rng.next() < 0.5) { hline(ca.x, cb.x, ca.y); vline(ca.y, cb.y, cb.x); }
      else { vline(ca.y, cb.y, ca.x); hline(ca.x, cb.x, cb.y); }
    };

    for (const r of rooms) carve(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1);
    for (let i = 0; i < rooms.length - 1; i++) corridor(rooms[i], rooms[i + 1]);
    for (let e = 0; e < N.EXTRA_LINKS; e++) {
      const a = rng.int(0, rooms.length - 1), b = rng.int(0, rooms.length - 1);
      if (a !== b) corridor(rooms[a], rooms[b]);
    }

    const roomOf = new Int16Array(W * H).fill(-1);
    rooms.forEach((r, i) => {
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) roomOf[y * W + x] = i;
    });

    return { depth, w: W, h: H, cells, rooms, roomOf, entrance: roomCenter({ rooms }, 0) };
  }

  function roomCenter(L, i) {
    const r = L.rooms[i];
    return { x: (r.x + r.w / 2) * CELL, y: (r.y + r.h / 2) * CELL };
  }

  function cellIndex(L, x, y) { return Math.floor(y / CELL) * L.w + Math.floor(x / CELL); }

  function isWallCell(L, cx, cy) {
    return cx < 0 || cy < 0 || cx >= L.w || cy >= L.h || L.cells[cy * L.w + cx] === 1;
  }

  function isWallAt(L, x, y) { return isWallCell(L, Math.floor(x / CELL), Math.floor(y / CELL)); }

  // Box approximation of a circle against the wall grid.
  function circleHits(L, x, y, r) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (isWallCell(L, cx, cy)) return true;
    return false;
  }

  // Substepped, axis-separated so fast units slide along walls and never tunnel.
  function moveBy(L, u, dx, dy, r) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (CELL / 4)));
    const sx = dx / n, sy = dy / n;
    for (let i = 0; i < n; i++) {
      if (!circleHits(L, u.x + sx, u.y, r)) u.x += sx;
      if (!circleHits(L, u.x, u.y + sy, r)) u.y += sy;
    }
  }

  function los(L, ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.ceil(d / (CELL / 4));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (isWallAt(L, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  }

  // Line of sight for a body of radius r: the centre line plus both edges must be clear.
  function losWide(L, ax, ay, bx, by, r) {
    const d = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / d * r, ny = (bx - ax) / d * r;
    return los(L, ax, ay, bx, by) && los(L, ax + nx, ay + ny, bx + nx, by + ny) && los(L, ax - nx, ay - ny, bx - nx, by - ny);
  }

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // Diagonals only when both orthogonal neighbours are open (no corner cutting).
  function stepOpen(L, cx, cy, dx, dy) {
    if (isWallCell(L, cx + dx, cy + dy)) return false;
    return !(dx && dy) || (!isWallCell(L, cx + dx, cy) && !isWallCell(L, cx, cy + dy));
  }

  function bfs(L, start) {
    const dist = new Int16Array(L.w * L.h).fill(-1);
    const q = new Int32Array(L.w * L.h);
    let head = 0, tail = 0;
    dist[start] = 0;
    q[tail++] = start;
    while (head < tail) {
      const c = q[head++], cx = c % L.w, cy = (c - cx) / L.w;
      for (const [dx, dy] of DIRS) {
        if (!stepOpen(L, cx, cy, dx, dy)) continue;
        const n = (cy + dy) * L.w + cx + dx;
        if (dist[n] < 0) { dist[n] = dist[c] + 1; q[tail++] = n; }
      }
    }
    return dist;
  }

  // The centre of the neighbouring cell one step closer to the field's root, or null at the root.
  function descend(L, field, x, y) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    let best = field[cy * L.w + cx], bx = -1, by = -1;
    if (best <= 0) return null;
    for (const [dx, dy] of DIRS) {
      if (!stepOpen(L, cx, cy, dx, dy)) continue;
      const d = field[(cy + dy) * L.w + cx + dx];
      if (d >= 0 && d < best) { best = d; bx = cx + dx; by = cy + dy; }
    }
    return bx < 0 ? null : { x: (bx + 0.5) * CELL, y: (by + 0.5) * CELL };
  }

  function randomPointInRoom(L, rng, i) {
    const r = L.rooms[i];
    return { x: (rng.int(r.x + 1, r.x + r.w - 2) + 0.5) * CELL, y: (rng.int(r.y + 1, r.y + r.h - 2) + 0.5) * CELL };
  }

  ID.Map = { generateLevel, roomCenter, cellIndex, isWallAt, circleHits, moveBy, los, losWide, bfs, descend, randomPointInRoom };
})(this.ID = this.ID || {});
