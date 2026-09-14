// Track: a closed Catmull-Rom loop through control points (with elevation), sampled into segments
// and parameterized by arc length. Track.build returns the track record every other module reads:
//   { center, road, arc, curv, width, jump } — sampled centerline points, edge records per point,
//   cumulative arc length, signed curvature per point, road width in m, and the jump record
//   { takeIndex, landIndex, take, land, height, slope }: the gap in the road runs from sample
//   takeIndex to landIndex (arc lengths take to land), off a lip `height` m up a ramp of `slope`.
var Track = {
  // The bridge is a fixed X at the origin on the diagonals: a ground leg SW->NE and a bridge
  // leg SE->NW, with its four ports on a grid lattice. The pigtail is a fixed chain of six cells
  // stamped in one corner of the lattice: an entry, a ring of four, and an exit that crosses the
  // entry leg. A random quarter of the remaining cells become control points, and one closed tour
  // threads all of them plus the fixed chains: nearest-neighbor order, then 2-opt to untangle,
  // with every chain held as a run of unbreakable edges. The jump is found, not stamped: the
  // straight run of three free points farthest from both crossings gets a ramp and a gap.
  gridStep: 128,         // m between lattice cells; the ports sit one cell out on the diagonals
  gridHalf: 4,           // cells from the origin to the edge; the course spans (2*gridHalf+1)^2 cells
  pickFraction: 1 / 4,   // share of the free cells that become control points
  maxTurn: 1.9,          // radians between successive control-polygon edges
  minTurnRadius: 8,      // m; tighter sampled curvature anywhere is a hairpin, reject
  minCrossAngle: 0.6,    // radians; shallower crossings make endless overlapping decks
  attempts: 3000,        // generation tries before giving up
  bridgeHeight: 9,
  bridgeHalfSpan: 50,
  width: 18,
  laneOffset: 4.5,       // lanes sit this far either side of the centerline
  samplesPerSpan: 10,
  rampSamples: 4,        // centerline segments climbing to the lip
  gapLength: 50,         // m of road cut out between lip and landing, rounded up to a sample
  rampHeight: 5,         // m, lip height above the landing
  jumpClear: 130,        // m the jump keeps from every crossing along the track

  // Pigtail cells in tour order for the NW corner, ring outermost so both ends face the interior;
  // rotated a quarter turn per orientation.
  pigtailCells: [[-2, 3], [-3, 3], [-4, 3], [-4, 4], [-3, 4], [-2, 1]],

  ports: function () {
    var a = Track.gridStep;
    return { sw: Vec.make(-a, 0, -a), ne: Vec.make(a, 0, a), se: Vec.make(a, 0, -a), nw: Vec.make(-a, 0, a) };
  },

  cellPoint: function (c) {
    return Vec.make(c[0] * Track.gridStep, 0, c[1] * Track.gridStep);
  },

  rotateCell: function (c, quarters) {
    for (var q = 0; q < quarters; q++) c = [-c[1], c[0]];
    return c;
  },

  // The pigtail chain in a random one of its four orientations.
  pigtail: function (rnd) {
    var quarters = Math.floor(rnd() * 4);
    return Track.pigtailCells.map(function (c) { return Track.rotateCell(c, quarters); });
  },

  // Every cell inside the bounding box of the given cells.
  blockOf: function (cells) {
    var cols = cells.map(function (c) { return c[0]; }), rows = cells.map(function (c) { return c[1]; });
    var out = [];
    for (var col = Math.min.apply(null, cols); col <= Math.max.apply(null, cols); col++) {
      for (var row = Math.min.apply(null, rows); row <= Math.max.apply(null, rows); row++) out.push([col, row]);
    }
    return out;
  },

  // Every lattice cell except the bridge center, the four port cells and the reserved block.
  freeCells: function (reserved) {
    var taken = {};
    reserved.forEach(function (c) { taken[c.join(',')] = true; });
    var cells = [], h = Track.gridHalf;
    for (var col = -h; col <= h; col++) {
      for (var row = -h; row <= h; row++) {
        if (Math.abs(col) <= 1 && Math.abs(row) <= 1 && Math.abs(col) === Math.abs(row)) continue;
        if (taken[col + ',' + row]) continue;
        cells.push([col, row]);
      }
    }
    return cells;
  },

  // A random subset of the cells, pickFraction of them.
  pickCells: function (rnd, cells) {
    var pool = cells.slice(), out = [], want = Math.round(cells.length * Track.pickFraction);
    while (out.length < want) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  },

  planar: function (a, b) {
    var dx = a.x - b.x, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  },

  // Closed tour through the free points and the chains. Each chain is a run of points that
  // must stay consecutive in the tour, in either direction. Greedy nearest neighbor from the
  // first chain, walking a chain as a unit when either end is reached, then 2-opt that never
  // reverses across a chain edge.
  spanningTour: function (chains, free) {
    var tour = chains[0].slice(), left = free.slice();
    var pending = chains.slice(1);
    var cur = tour[tour.length - 1];
    while (left.length || pending.length) {
      var best = null, bestD = Infinity;
      left.forEach(function (p, i) { var d = Track.planar(cur, p); if (d < bestD) { bestD = d; best = { free: i }; } });
      pending.forEach(function (chain, i) {
        [chain[0], chain[chain.length - 1]].forEach(function (p, end) {
          var d = Track.planar(cur, p);
          if (d < bestD) { bestD = d; best = { chain: i, end: end }; }
        });
      });
      if (best.chain !== undefined) {
        var chain = pending.splice(best.chain, 1)[0];
        var ordered = best.end === 0 ? chain : chain.slice().reverse();
        tour.push.apply(tour, ordered);
      } else {
        tour.push(left.splice(best.free, 1)[0]);
      }
      cur = tour[tour.length - 1];
    }
    return Track.twoOpt(tour, chains);
  },

  twoOpt: function (tour, chains) {
    var n = tour.length;
    var fixed = function (a, b) {
      return chains.some(function (chain) {
        for (var k = 0; k + 1 < chain.length; k++) {
          if ((chain[k] === a && chain[k + 1] === b) || (chain[k] === b && chain[k + 1] === a)) return true;
        }
        return false;
      });
    };
    var improved = true;
    while (improved) {
      improved = false;
      for (var a = 0; a < n - 1; a++) {
        for (var b = a + 2; b < n; b++) {
          var a1 = tour[a + 1], b1 = tour[(b + 1) % n];
          if (a === 0 && b === n - 1) continue;
          if (fixed(tour[a], a1) || fixed(tour[b], b1)) continue;
          var before = Track.planar(tour[a], a1) + Track.planar(tour[b], b1);
          var after = Track.planar(tour[a], tour[b]) + Track.planar(a1, b1);
          if (after >= before - 1e-9) continue;
          tour = tour.slice(0, a + 1).concat(tour.slice(a + 1, b + 1).reverse(), tour.slice(b + 1));
          improved = true;
        }
      }
    }
    return tour;
  },

  // The tour and the fixed chains it threads: the X's two legs and the pigtail.
  randomControlPoints: function (rnd) {
    var p = Track.ports(), pig = Track.pigtail(rnd);
    var chains = [[p.sw, p.ne], [p.se, p.nw], pig.map(Track.cellPoint)];
    var free = Track.pickCells(rnd, Track.freeCells(Track.blockOf(pig))).map(Track.cellPoint);
    return { cp: Track.spanningTour(chains, free), chains: chains };
  },

  // Indices of control points that sit between two others in a straight line, none of them fixed.
  straights: function (cp, chains) {
    var fixed = [];
    chains.forEach(function (c) { fixed.push.apply(fixed, c); });
    var n = cp.length, out = [];
    for (var i = 0; i < n; i++) {
      var a = cp[(i - 1 + n) % n], b = cp[i], c = cp[(i + 1) % n];
      if (fixed.indexOf(a) >= 0 || fixed.indexOf(b) >= 0 || fixed.indexOf(c) >= 0) continue;
      var u = Vec.sub(b, a), v = Vec.sub(c, b);
      if (Math.abs(u.x * v.z - u.z * v.x) > 1e-6 || u.x * v.x + u.z * v.z <= 0) continue;
      out.push(i);
    }
    return out;
  },

  // Distance along the loop between two arc lengths, the short way round.
  around: function (total, a, b) {
    var d = Math.abs(a - b) % total;
    return Math.min(d, total - d);
  },

  // The jump centered on the straight farthest from every crossing, or null when none has room.
  jump: function (cp, chains, arc, crossings) {
    var n = arc.cum.length - 1, best = null, bestRoom = Track.jumpClear;
    Track.straights(cp, chains).forEach(function (i) {
      var mid = i * Track.samplesPerSpan, takeIndex = mid - 1, landIndex = takeIndex + 1;
      while (landIndex < n && arc.cum[landIndex] - arc.cum[takeIndex] < Track.gapLength) landIndex++;
      if (takeIndex - Track.rampSamples < 0 || landIndex >= n) return;
      var room = Infinity;
      crossings.forEach(function (c) {
        room = Math.min(room, Track.around(arc.total, arc.cum[mid], c.sUnder), Track.around(arc.total, arc.cum[mid], c.sOver));
      });
      if (room <= bestRoom) return;
      bestRoom = room;
      best = { takeIndex: takeIndex, landIndex: landIndex, take: arc.cum[takeIndex], land: arc.cum[landIndex],
        height: Track.rampHeight, slope: Track.rampHeight / (arc.cum[takeIndex] - arc.cum[takeIndex - Track.rampSamples]) };
    });
    return best;
  },

  turnsOk: function (cp) {
    var n = cp.length;
    for (var i = 0; i < n; i++) {
      var a = cp[(i - 1 + n) % n], b = cp[i], c = cp[(i + 1) % n];
      var u = Vec.norm(Vec.sub(b, a)), v = Vec.norm(Vec.sub(c, b));
      if (Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.z * v.z))) > Track.maxTurn) return false;
    }
    return true;
  },

  // One generation try: the finished centerline, or the reason it was rejected.
  attempt: function (rnd) {
    var tour = Track.randomControlPoints(rnd), cp = tour.cp;
    if (!Track.turnsOk(cp)) return { reject: 'turn' };
    var center = Track.centerline(cp);
    var arc = Track.arcLength(center);
    var curv = Track.curvature(center);
    if (curv.some(function (k) { return Math.abs(k) > 1 / Track.minTurnRadius; })) return { reject: 'curvature' };
    var crossings = Track.crossings(center, arc);
    if (crossings.length !== 2) return { reject: 'crossings=' + crossings.length };
    if (crossings.some(function (c) { return c.angle < Track.minCrossAngle; })) return { reject: 'crossAngle' };
    var jump = Track.jump(cp, tour.chains, arc, crossings);
    if (!jump) return { reject: 'nojump' };
    Track.elevate(center, arc, crossings, jump);
    if (!Track.clearanceOk(center, arc)) return { reject: 'clearance' };
    var road = Track.edges(center, Track.width / 2);
    return { track: { center: center, road: road, arc: arc, curv: curv, width: Track.width, jump: jump } };
  },

  // Keep trying until a loop has exactly two clean overpasses (the X and the pigtail), a jump, and no near-misses.
  build: function (rnd) {
    for (var attempt = 0; attempt < Track.attempts; attempt++) {
      var got = Track.attempt(rnd);
      if (got.track) return got.track;
    }
    throw new Error('could not generate a track');
  },

  // Self-intersections in the xz plane between non-adjacent segments.
  crossings: function (center, arc) {
    var n = center.length, out = [];
    for (var i = 0; i < n; i++) {
      for (var j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        var hit = Track.segmentsCross(center[i], center[(i + 1) % n], center[j], center[(j + 1) % n]);
        if (!hit) continue;
        var d1 = Vec.sub(center[(i + 1) % n], center[i]), d2 = Vec.sub(center[(j + 1) % n], center[j]);
        var angle = Math.acos(Math.abs(d1.x * d2.x + d1.z * d2.z) / (Math.hypot(d1.x, d1.z) * Math.hypot(d2.x, d2.z)));
        out.push({ sUnder: arc.cum[i] + hit.t * (arc.cum[i + 1] - arc.cum[i]), sOver: arc.cum[j] + hit.u * (arc.cum[j + 1] - arc.cum[j]), angle: angle });
      }
    }
    return out;
  },

  segmentsCross: function (p, p2, q, q2) {
    var r = { x: p2.x - p.x, z: p2.z - p.z }, s = { x: q2.x - q.x, z: q2.z - q.z };
    var den = r.x * s.z - r.z * s.x;
    if (Math.abs(den) < 1e-9) return null;
    var qp = { x: q.x - p.x, z: q.z - p.z };
    var t = (qp.x * s.z - qp.z * s.x) / den, u = (qp.x * r.z - qp.z * r.x) / den;
    if (t < 0 || t >= 1 || u < 0 || u >= 1) return null;  // half-open so a hit on a shared sample counts once
    return { t: t, u: u };
  },

  // Raise a smooth hump centered on the later pass of each crossing, and the ramp up to the lip.
  elevate: function (center, arc, crossings, jump) {
    center.forEach(function (p, i) {
      var y = 0;
      crossings.forEach(function (c) {
        var d = Track.around(arc.total, arc.cum[i], c.sOver);
        if (d < Track.bridgeHalfSpan) y = Math.max(y, Track.bridgeHeight * (0.5 + 0.5 * Math.cos(Math.PI * d / Track.bridgeHalfSpan)));
      });
      p.y = y;
    });
    for (var k = 0; k <= Track.rampSamples; k++) {
      center[jump.takeIndex - Track.rampSamples + k].y = jump.height * k / Track.rampSamples;
    }
  },

  // Any two points far apart along the track but close in the plane must differ in height.
  clearanceOk: function (center, arc) {
    var n = center.length, minGap = Track.width + 4, minDrop = 6;
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var ds = arc.cum[j] - arc.cum[i];
        ds = Math.min(ds, arc.total - ds);
        if (ds < 40) continue;
        var dx = center[i].x - center[j].x, dz = center[i].z - center[j].z;
        if (dx * dx + dz * dz > minGap * minGap) continue;
        if (Math.abs(center[i].y - center[j].y) < minDrop) return false;
      }
    }
    return true;
  },

  // Catmull-Rom interpolation between p1 and p2.
  catmull: function (p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    function f(a, b, c, d) {
      return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    }
    return Vec.make(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z));
  },

  // Returns an array of centerline points around the closed loop through control points cp.
  centerline: function (cp) {
    var n = cp.length, pts = [];
    for (var i = 0; i < n; i++) {
      var p0 = cp[(i - 1 + n) % n], p1 = cp[i], p2 = cp[(i + 1) % n], p3 = cp[(i + 2) % n];
      for (var s = 0; s < Track.samplesPerSpan; s++) {
        pts.push(Track.catmull(p0, p1, p2, p3, s / Track.samplesPerSpan));
      }
    }
    return pts;
  },

  // Horizontal heading at each point (elevation ignored, so road stays level side-to-side).
  flatDir: function (center, i) {
    var n = center.length;
    var d = Vec.sub(center[(i + 1) % n], center[(i - 1 + n) % n]);
    return Vec.norm(Vec.make(d.x, 0, d.z));
  },

  // Left/right edge points for each centerline point.
  edges: function (center, halfWidth) {
    var up = Vec.make(0, 1, 0);
    return center.map(function (p, i) {
      var dir = Track.flatDir(center, i);
      var side = Vec.scale(Vec.cross(up, dir), halfWidth);
      return { left: Vec.add(p, side), right: Vec.sub(p, side), dir: dir, side: Vec.norm(side) };
    });
  },

  // Signed curvature (1/m) at each point; positive turns left. Uses the turn angle between
  // neighboring segments divided by the local segment length.
  curvature: function (center) {
    var n = center.length;
    return center.map(function (p, i) {
      var a = Vec.sub(p, center[(i - 1 + n) % n]), b = Vec.sub(center[(i + 1) % n], p);
      var cross = a.x * b.z - a.z * b.x, dot = a.x * b.x + a.z * b.z;
      var angle = Math.atan2(cross, dot);
      var len = (Math.sqrt(a.x * a.x + a.z * a.z) + Math.sqrt(b.x * b.x + b.z * b.z)) / 2;
      return -angle / len;
    });
  },

  // Arc length from s0 forward to s1, in [0, total).
  ahead: function (track, s0, s1) {
    var total = track.arc.total;
    return (((s1 - s0) % total) + total) % total;
  },

  // Whether arc length s lies in the jump's gap, past the lip and short of the landing.
  inGap: function (track, s) {
    return Track.ahead(track, track.jump.take, s) < track.jump.land - track.jump.take;
  },

  // Segment index i, next index j and fraction f along it at arc length s (wraps the loop).
  locate: function (track, s) {
    var cum = track.arc.cum, n = track.center.length;
    s = ((s % track.arc.total) + track.arc.total) % track.arc.total;
    var i = 0;
    while (i < n - 1 && cum[i + 1] <= s) i++;
    return { i: i, j: (i + 1) % n, f: (s - cum[i]) / (cum[i + 1] - cum[i]) };
  },

  // Curvature of a lane offset lat (m, + = left) from the centerline at arc length s.
  laneCurvature: function (track, s, lat) {
    var at = Track.locate(track, s);
    var k = track.curv[at.i] + (track.curv[at.j] - track.curv[at.i]) * at.f;
    return k / (1 - k * lat);
  },

  // Cumulative arc length at each point, plus total loop length.
  arcLength: function (center) {
    var cum = [0], n = center.length;
    for (var i = 1; i <= n; i++) {
      cum.push(cum[i - 1] + Vec.len(Vec.sub(center[i % n], center[i - 1])));
    }
    return { cum: cum, total: cum[n] };
  },

  // Position, heading and side vector at arc-length s (wraps around the loop).
  at: function (track, s) {
    var l = Track.locate(track, s), center = track.center;
    var dir = Vec.norm(Vec.sub(center[l.j], center[l.i]));
    var side = Vec.lerp(track.road[l.i].side, track.road[l.j].side, l.f);
    return { pos: Vec.lerp(center[l.i], center[l.j], l.f), dir: dir, side: Vec.norm(side) };
  }
};
