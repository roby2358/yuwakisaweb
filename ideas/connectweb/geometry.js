"use strict";

// Pure geometry/algorithm layer — no DOM, no canvas, no globals from the page.
// Wrapped in an IIFE so it leaks only the single `Geometry` name: in the browser
// classic scripts share one global lexical scope, so exposing each function would
// collide with script.js. In Node it exports via module.exports for unit tests.
(function (root) {

const CANVAS_SIZE = 800;  // coordinate space is CANVAS_SIZE x CANVAS_SIZE
const KERNEL_K = 1.2;     // gradient-noise support radius = K * longest incident edge

// Variable-radius Poisson-disk sampling by dart throwing. Each candidate dot
// gets its own exclusion radius drawn uniformly in [base/3, 3*base]; it is kept
// only if it clears every nearby dot by max(its radius, the other's radius), so
// neither dot's personal space is violated and the larger radius always wins.
// The result: big-radius dots open up sparse voids, small-radius dots form dense
// clusters — genuine spatially-varying density, not a uniform lattice.
function scatterDots(width, height, base) {
  const rMin = base / 3;
  const rMax = base * 3;

  // Spatial grid (cell = rMax) so each dart only tests its 3x3 cell neighborhood:
  // a conflict reaches at most rMax, which spans at most one cell.
  const cell = rMax;
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const grid = Array.from({ length: cols * rows }, () => []);
  const placed = [];

  const attempts = Math.ceil((width * height) / (rMin * rMin)) * 8;
  for (let n = 0; n < attempts; n++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const excl = rMin + Math.random() * (rMax - rMin);
    const gx = Math.min(cols - 1, Math.floor(x / cell));
    const gy = Math.min(rows - 1, Math.floor(y / cell));

    let ok = true;
    for (let j = gy - 1; j <= gy + 1 && ok; j++) {
      if (j < 0 || j >= rows) continue;
      for (let k = gx - 1; k <= gx + 1 && ok; k++) {
        if (k < 0 || k >= cols) continue;
        for (const p of grid[j * cols + k]) {
          const dx = p.x - x, dy = p.y - y;
          const need = Math.max(excl, p.excl);
          if (dx * dx + dy * dy < need * need) { ok = false; break; }
        }
      }
    }

    if (ok) {
      const dot = { x, y, excl };
      placed.push(dot);
      grid[gy * cols + gx].push(dot);
    }
  }
  return placed;
}

// True if segments AB and CD properly cross. Shared endpoints don't count —
// every edge from a dot meets its siblings there, and that's not a crossing.
function segmentsCross(a, b, c, d) {
  if (a === c || a === d || b === c || b === d) return false;

  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);

  return o1 * o2 < 0 && o3 * o4 < 0;
}

function orient(p, q, r) {
  return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
}

// The literal README rule: draw every line, then for each crossing pair remove
// the longer one. Equivalently, a line survives iff NO shorter line crosses it
// (so for any crossing, the longer one is gone). We test each line against every
// shorter line — including ones already eliminated, which is what distinguishes
// this from the greedy triangulation (that only checked the survivors). Sorting
// is purely an optimization: it makes "all shorter lines" == "all earlier ones"
// and lets us stop at the first crossing.
function buildElimination(points) {
  const candidates = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      candidates.push({ a: points[i], b: points[j], len: dx * dx + dy * dy });
    }
  }
  candidates.sort((e1, e2) => e1.len - e2.len);

  const kept = [];
  for (let i = 0; i < candidates.length; i++) {
    const e = candidates[i];
    let crossed = false;
    for (let j = 0; j < i; j++) { // every strictly-shorter line
      const s = candidates[j];
      if (segmentsCross(e.a, e.b, s.a, s.b)) { crossed = true; break; }
    }
    if (!crossed) kept.push(e);
  }
  return kept;
}

// Circumcircle of triangle abc: center and squared radius. Returns null when
// the three points are (nearly) collinear, so there is no finite circle.
function circumcircle(a, b, c) {
  const ax = a.x, ay = a.y, bx = b.x, by = b.y, cx = c.x, cy = c.y;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  const dx = ax - ux, dy = ay - uy;
  return { x: ux, y: uy, r2: dx * dx + dy * dy };
}

function makeTri(a, b, c) {
  return { a, b, c, cc: circumcircle(a, b, c) };
}

// Do triangle t's three edges include the undirected edge (u, v)?
function triHasEdge(t, u, v) {
  return (
    (t.a === u || t.b === u || t.c === u) &&
    (t.a === v || t.b === v || t.c === v)
  );
}

// Delaunay triangulation via the Bowyer-Watson incremental algorithm. Returns
// the list of triangles (each with its circumcircle). Every triangle satisfies
// the empty-circumcircle property: no other dot lies inside any triangle's
// circumcircle, which maximizes the smallest angle and avoids sliver triangles.
function delaunayTriangles(points) {
  // A "super-triangle" big enough to enclose every point; we strip it at the end.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const dmax = Math.max(maxX - minX, maxY - minY) || 1;
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  const s1 = { x: midX - 20 * dmax, y: midY - dmax };
  const s2 = { x: midX, y: midY + 20 * dmax };
  const s3 = { x: midX + 20 * dmax, y: midY - dmax };

  let tris = [makeTri(s1, s2, s3)];

  for (const p of points) {
    // Triangles whose circumcircle contains p are no longer Delaunay.
    const bad = tris.filter(
      (t) => t.cc && (p.x - t.cc.x) ** 2 + (p.y - t.cc.y) ** 2 < t.cc.r2
    );

    // The boundary of the hole is every edge owned by exactly one bad triangle.
    const boundary = [];
    for (const t of bad) {
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
        const shared = bad.some((o) => o !== t && triHasEdge(o, u, v));
        if (!shared) boundary.push([u, v]);
      }
    }

    // Carve out the hole, then fan new triangles from p to each boundary edge.
    tris = tris.filter((t) => !bad.includes(t));
    for (const [u, v] of boundary) tris.push(makeTri(u, v, p));
  }

  // Drop any triangle still touching the super-triangle's corners.
  const fake = [s1, s2, s3];
  return tris.filter(
    (t) => !fake.includes(t.a) && !fake.includes(t.b) && !fake.includes(t.c)
  );
}

// Delaunay edges: flatten the triangles to a deduplicated edge list.
function buildDelaunay(points) {
  if (points.length < 3) return allPairs(points);
  const tris = delaunayTriangles(points);
  const index = new Map(points.map((p, i) => [p, i]));
  const seen = new Set();
  const result = [];
  for (const t of tris) {
    for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
      const i = index.get(u), j = index.get(v);
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ a: u, b: v });
      }
    }
  }
  return result;
}

// The vertex of triangle t that is neither u nor v.
function thirdVertex(t, u, v) {
  for (const x of [t.a, t.b, t.c]) if (x !== u && x !== v) return x;
}

// Clip segment p0->p1 to the canvas box (Liang-Barsky). Returns the clipped
// {a, b} segment, or null if it lies entirely outside.
function clipToCanvas(p0, p1) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const p = [-dx, dx, -dy, dy];
  const q = [p0.x, CANVAS_SIZE - p0.x, p0.y, CANVAS_SIZE - p0.y];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null; // parallel and outside this boundary
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
  }
  return {
    a: { x: p0.x + t0 * dx, y: p0.y + t0 * dy },
    b: { x: p0.x + t1 * dx, y: p0.y + t1 * dy },
  };
}

// Voronoi diagram as the dual of the Delaunay triangulation. Group Delaunay
// edges by the triangles that own them: an edge shared by two triangles maps to
// a Voronoi segment between their circumcenters; a hull edge (one triangle) maps
// to a ray from its circumcenter outward along the edge's perpendicular bisector.
function buildVoronoi(points) {
  if (points.length < 3) return [];
  const tris = delaunayTriangles(points);
  const index = new Map(points.map((p, i) => [p, i]));

  const edgeMap = new Map();
  for (const t of tris) {
    for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
      const i = index.get(u), j = index.get(v);
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      let rec = edgeMap.get(key);
      if (!rec) { rec = { u, v, tris: [] }; edgeMap.set(key, rec); }
      rec.tris.push(t);
    }
  }

  const segs = [];
  const BIG = 3 * CANVAS_SIZE;
  for (const rec of edgeMap.values()) {
    if (rec.tris.length === 2) {
      const c0 = rec.tris[0].cc, c1 = rec.tris[1].cc;
      if (c0 && c1) {
        const s = clipToCanvas(c0, c1);
        if (s) segs.push(s);
      }
    } else {
      // Hull edge: emit the perpendicular-bisector ray, aimed away from the
      // triangle's interior (its third vertex).
      const t = rec.tris[0];
      if (!t.cc) continue;
      const w = thirdVertex(t, rec.u, rec.v);
      const mx = (rec.u.x + rec.v.x) / 2, my = (rec.u.y + rec.v.y) / 2;
      let dx = -(rec.v.y - rec.u.y), dy = rec.v.x - rec.u.x;
      if (dx * (w.x - mx) + dy * (w.y - my) > 0) { dx = -dx; dy = -dy; }
      const len = Math.hypot(dx, dy) || 1;
      const far = { x: t.cc.x + (dx / len) * BIG, y: t.cc.y + (dy / len) * BIG };
      const s = clipToCanvas(t.cc, far);
      if (s) segs.push(s);
    }
  }
  return segs;
}

// Fallback for fewer than 3 points: just connect whatever we have.
function allPairs(points) {
  const e = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      e.push({ a: points[i], b: points[j] });
    }
  }
  return e;
}

// Prepare the triangulation for a noise mode: give each dot a random scalar
// value (for value noise), a random unit gradient vector and a compact-support
// radius (for gradient noise). Returns { triangles, grid } where grid is a
// spatial bucket index (cell = largest support radius, so a dot reaches at most
// one cell) used by the gradient sampler to sum only nearby dots.
function buildNoise(points) {
  if (points.length < 3) return { triangles: [], grid: null };
  for (const p of points) {
    p.value = Math.random();
    const ang = Math.random() * Math.PI * 2;
    p.gx = Math.cos(ang);
    p.gy = Math.sin(ang);
    p.maxEdge2 = 0;
  }

  const tris = delaunayTriangles(points);

  // Each vertex's support radius scales with its longest incident Delaunay edge.
  // Because a point in triangle abc is within max(|a-b|,|a-c|) of vertex a, and
  // both are <= a's longest edge, K >= 1 guarantees the whole hull is covered.
  for (const t of tris) {
    for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
      const dx = u.x - v.x, dy = u.y - v.y, d2 = dx * dx + dy * dy;
      if (d2 > u.maxEdge2) u.maxEdge2 = d2;
      if (d2 > v.maxEdge2) v.maxEdge2 = d2;
    }
  }
  let maxR = 1;
  for (const p of points) {
    p.radius = KERNEL_K * Math.sqrt(p.maxEdge2 || 1);
    p.r2 = p.radius * p.radius;
    if (p.radius > maxR) maxR = p.radius;
  }

  // Bin dots into a grid whose cell equals the largest radius.
  const cols = Math.max(1, Math.ceil(CANVAS_SIZE / maxR));
  const rows = Math.max(1, Math.ceil(CANVAS_SIZE / maxR));
  const buckets = Array.from({ length: cols * rows }, () => []);
  for (const p of points) {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(p.x / maxR)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(p.y / maxR)));
    buckets[cy * cols + cx].push(p);
  }

  return { triangles: tris, grid: { cell: maxR, cols, rows, buckets } };
}

// Value noise: barycentric blend of the three vertices' random scalars. The
// dots become local extrema, so the field looks blobby around them. The (grid)
// argument is ignored — it exists so every sampler factory has one shape.
function valueSampler() {
  return (t, wa, wb, wc) => wa * t.a.value + wb * t.b.value + wc * t.c.value;
}

// Gradient noise with a smooth compact kernel (the true Perlin/Simplex idea).
// Each vertex contributes falloff(r2) * dot(g, P - vertex): a ramp that is zero
// at the vertex, faded by the t^4 kernel which has zero value, slope AND
// curvature at the support edge -> the summed field is C2 smooth, so the
// triangle-edge creases of barycentric blending disappear. (x, y) are canvas
// coordinates; only dots in the 3x3 neighbor cells (per `grid`) can reach a pixel.
function kernelSampler(grid) {
  return (_t, _wa, _wb, _wc, x, y) => {
    const cx = Math.min(grid.cols - 1, Math.max(0, Math.floor(x / grid.cell)));
    const cy = Math.min(grid.rows - 1, Math.max(0, Math.floor(y / grid.cell)));
    let sum = 0;
    for (let j = cy - 1; j <= cy + 1; j++) {
      if (j < 0 || j >= grid.rows) continue;
      for (let i = cx - 1; i <= cx + 1; i++) {
        if (i < 0 || i >= grid.cols) continue;
        for (const p of grid.buckets[j * grid.cols + i]) {
          const dx = x - p.x, dy = y - p.y;
          const r2 = dx * dx + dy * dy;
          if (r2 >= p.r2) continue;
          const t = 1 - r2 / p.r2;
          const t2 = t * t;
          sum += t2 * t2 * (p.gx * dx + p.gy * dy);
        }
      }
    }
    return sum;
  };
}

// Build a noise scene: triangles plus the per-pixel sampler the renderer needs.
function noiseScene(points, makeSampler) {
  const { triangles, grid } = buildNoise(points);
  return { triangles, sampler: makeSampler(grid) };
}

// Evaluate `sampler` over every pixel covered by the triangulation, returning a
// raw float field (NaN where no triangle covers the pixel). Coordinates are in
// device pixels; the sampler receives canvas-space (x, y) via px/scale.
function noiseField(W, H, scale, sampler, triangles) {
  const raw = new Float32Array(W * H).fill(NaN);
  for (const t of triangles) {
    const ax = t.a.x * scale, ay = t.a.y * scale;
    const bx = t.b.x * scale, by = t.b.y * scale;
    const cx = t.c.x * scale, cy = t.c.y * scale;
    const denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(denom) < 1e-9) continue; // degenerate triangle

    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const wa = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denom;
        const wb = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denom;
        const wc = 1 - wa - wb;
        if (wa < 0 || wb < 0 || wc < 0) continue; // outside the triangle
        raw[y * W + x] = sampler(t, wa, wb, wc, px / scale, py / scale);
      }
    }
  }
  return raw;
}

// The public surface, shared by the browser glue (script.js) and Node tests.
const Geometry = {
  CANVAS_SIZE,
  scatterDots,
  segmentsCross,
  buildElimination,
  circumcircle,
  delaunayTriangles,
  buildDelaunay,
  clipToCanvas,
  buildVoronoi,
  buildNoise,
  valueSampler,
  kernelSampler,
  noiseScene,
  noiseField,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = Geometry; // Node (tests)
} else {
  root.Geometry = Geometry;  // browser (global for script.js)
}

})(typeof globalThis !== "undefined" ? globalThis : this);
