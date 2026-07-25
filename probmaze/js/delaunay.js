"use strict";

// Bowyer-Watson Delaunay triangulation over {x, y} points.
// Returns unique edges as [i, j] index pairs with i < j.
function delaunayEdges(points) {
  const n = points.length;
  const verts = points.concat(superTriangle(points));
  let triangles = [makeTriangle(verts, n, n + 1, n + 2)];

  for (let i = 0; i < n; i++) {
    const p = verts[i];
    const bad = triangles.filter(t => inCircumcircle(t, p));
    const hole = boundaryEdges(bad);
    triangles = triangles.filter(t => !bad.includes(t));
    for (const [a, b] of hole) {
      triangles.push(makeTriangle(verts, a, b, i));
    }
  }

  const edgeSet = new Set();
  for (const t of triangles) {
    if (t.a >= n || t.b >= n || t.c >= n) continue;
    for (const [a, b] of triangleEdges(t)) {
      edgeSet.add(edgeKey(a, b));
    }
  }
  return [...edgeSet].map(key => key.split(",").map(Number));
}

function superTriangle(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const dmax = Math.max(maxX - minX, maxY - minY);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  return [
    { x: midX - 20 * dmax, y: midY - dmax },
    { x: midX, y: midY + 20 * dmax },
    { x: midX + 20 * dmax, y: midY - dmax },
  ];
}

function makeTriangle(verts, a, b, c) {
  return { a, b, c, cc: circumcircle(verts[a], verts[b], verts[c]) };
}

function circumcircle(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return null;
  const asq = a.x * a.x + a.y * a.y;
  const bsq = b.x * b.x + b.y * b.y;
  const csq = c.x * c.x + c.y * c.y;
  const ux = (asq * (b.y - c.y) + bsq * (c.y - a.y) + csq * (a.y - b.y)) / d;
  const uy = (asq * (c.x - b.x) + bsq * (a.x - c.x) + csq * (b.x - a.x)) / d;
  const r2 = (a.x - ux) * (a.x - ux) + (a.y - uy) * (a.y - uy);
  return { x: ux, y: uy, r2 };
}

function inCircumcircle(triangle, p) {
  if (!triangle.cc) return false;
  const dx = p.x - triangle.cc.x;
  const dy = p.y - triangle.cc.y;
  return dx * dx + dy * dy <= triangle.cc.r2;
}

function triangleEdges(t) {
  return [[t.a, t.b], [t.b, t.c], [t.c, t.a]];
}

function edgeKey(a, b) {
  return a < b ? a + "," + b : b + "," + a;
}

// Edges of the bad-triangle region that belong to exactly one bad triangle.
function boundaryEdges(badTriangles) {
  const counts = new Map();
  for (const t of badTriangles) {
    for (const [a, b] of triangleEdges(t)) {
      const key = edgeKey(a, b);
      const entry = counts.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        counts.set(key, { count: 1, a, b });
      }
    }
  }
  return [...counts.values()].filter(e => e.count === 1).map(e => [e.a, e.b]);
}
