// Track: a closed Catmull-Rom loop through control points (with elevation), sampled into segments
// and parameterized by arc length.
var Track = {
  // The bridge is a fixed X at the origin on the diagonals: a ground leg SW->NE and a bridge
  // leg SE->NW. A figure 8 through a right-angle X can only put its lobes in the two opposite
  // wedges between the legs, so random points are dropped in an east lobe and a west lobe,
  // one per angular sector, with a random-walk radius so the sweep stays smooth.
  portReach: 45,
  innerRadius: 140,
  outerRadius: 260,
  lobeHalfAngle: 0.95,   // radians either side of the lobe axis
  pointsPerLobe: 6,
  radiusStep: 90,        // max radius change between neighboring points
  maxTurn: 1.9,          // radians between successive control-polygon edges
  minTurnRadius: 8,      // m; tighter sampled curvature anywhere is a hairpin, reject

  ports: function () {
    var a = Track.portReach;
    return { sw: Vec.make(-a, 0, -a), ne: Vec.make(a, 0, a), se: Vec.make(a, 0, -a), nw: Vec.make(-a, 0, a) };
  },

  // Points sweeping from angle a0 to a1 around the origin, one per sector.
  lobePoints: function (rnd, a0, a1) {
    var pts = [], count = Track.pointsPerLobe, span = (a1 - a0) / count;
    var r = Track.innerRadius + rnd() * (Track.outerRadius - Track.innerRadius);
    for (var k = 0; k < count; k++) {
      var t = a0 + (k + 0.15 + rnd() * 0.7) * span;
      r = Math.min(Track.outerRadius, Math.max(Track.innerRadius, r + (rnd() - 0.5) * 2 * Track.radiusStep));
      pts.push(Vec.make(r * Math.cos(t), 0, r * Math.sin(t)));
    }
    return pts;
  },

  // SW -> NE (ground), east lobe clockwise, SE -> NW (bridge), west lobe counterclockwise, back to SW.
  randomControlPoints: function (rnd) {
    var p = Track.ports(), h = Track.lobeHalfAngle;
    var east = Track.lobePoints(rnd, h, -h);
    var west = Track.lobePoints(rnd, Math.PI - h, Math.PI + h);
    return [p.sw, p.ne].concat(east, [p.se, p.nw], west);
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

  bridgeHeight: 9,
  bridgeHalfSpan: 50,
  minCrossAngle: 0.6,  // radians; shallower crossings make endless overlapping decks

  // Keep generating until a loop has at least one clean overpass and no near-misses.
  generate: function (rnd) {
    for (var attempt = 0; attempt < 500; attempt++) {
      var cp = Track.randomControlPoints(rnd);
      if (!Track.turnsOk(cp)) continue;
      var center = Track.centerline(cp);
      var arc = Track.arcLength(center);
      if (Track.curvature(center).some(function (k) { return Math.abs(k) > 1 / Track.minTurnRadius; })) continue;
      var crossings = Track.crossings(center, arc);
      if (crossings.length !== 1) continue;
      if (crossings.some(function (c) { return c.angle < Track.minCrossAngle; })) continue;
      Track.elevate(center, arc, crossings);
      if (!Track.clearanceOk(center, arc)) continue;
      return center;
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
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { t: t, u: u };
  },

  // Raise a smooth hump centered on the later pass of each crossing.
  elevate: function (center, arc, crossings) {
    center.forEach(function (p, i) {
      var y = 0;
      crossings.forEach(function (c) {
        var d = Math.abs(arc.cum[i] - c.sOver);
        d = Math.min(d, arc.total - d);
        if (d < Track.bridgeHalfSpan) y = Math.max(y, Track.bridgeHeight * (0.5 + 0.5 * Math.cos(Math.PI * d / Track.bridgeHalfSpan)));
      });
      p.y = y;
    });
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

  width: 18,
  laneOffset: 4.5, // lanes sit this far either side of the centerline
  samplesPerSpan: 10,

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

  // Curvature of a lane offset lat (m, + = left) from the centerline at arc length s.
  laneCurvature: function (geom, s, lat) {
    var cum = geom.arc.cum, n = geom.center.length;
    s = ((s % geom.arc.total) + geom.arc.total) % geom.arc.total;
    var i = 0;
    while (i < n - 1 && cum[i + 1] <= s) i++;
    var f = (s - cum[i]) / (cum[i + 1] - cum[i]);
    var k = geom.curv[i] + (geom.curv[(i + 1) % n] - geom.curv[i]) * f;
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
  at: function (geom, s) {
    var center = geom.center, cum = geom.arc.cum, n = center.length;
    s = ((s % geom.arc.total) + geom.arc.total) % geom.arc.total;
    var i = 0;
    while (i < n - 1 && cum[i + 1] <= s) i++;
    var f = (s - cum[i]) / (cum[i + 1] - cum[i]);
    var j = (i + 1) % n;
    var dir = Vec.norm(Vec.sub(center[j], center[i]));
    var side = Vec.lerp(geom.road[i].side, geom.road[j].side, f);
    return { pos: Vec.lerp(center[i], center[j], f), dir: dir, side: Vec.norm(side) };
  }
};
