// Scene: the scenery polygons for a track (road, kerbs, bridge structure, trees, start line).
var Scene = {
  build: function (track, rnd) {
    var center = track.center, road = track.road;
    var kerb = Track.edges(center, track.width / 2 + 1.2);
    var n = center.length;
    var polys = [];

    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var kerbColor = (i % 2 === 0) ? '#dd3333' : '#eeeeee';
      polys.push({ pts: [kerb[i].left, kerb[j].left, road[j].left, road[i].left], color: kerbColor, ground: true });
      polys.push({ pts: [road[i].right, road[j].right, kerb[j].right, kerb[i].right], color: kerbColor, ground: true });
      var asphalt = (i % 2 === 0) ? '#484b50' : '#4c4f54';
      polys.push({ pts: [road[i].left, road[j].left, road[j].right, road[i].right], color: asphalt, ground: true });
      polys.push.apply(polys, Scene.bridgePolys(center, kerb, i, j));
    }
    polys.push.apply(polys, Scene.slots(center));

    polys.push.apply(polys, Scene.startLine(road));
    Scene.trees(center, rnd).forEach(function (t) { polys.push.apply(polys, Scene.treePolys(t)); });

    return polys;
  },

  // A dark slot groove down the middle of each lane, like a toy slot-car track.
  slots: function (center) {
    var polys = [], n = center.length, w = 0.25;
    [-Track.laneOffset, Track.laneOffset].forEach(function (off) {
      var inner = Track.edges(center, off - w), outer = Track.edges(center, off + w);
      for (var i = 0; i < n; i++) {
        var j = (i + 1) % n;
        polys.push({ pts: [outer[i].left, outer[j].left, inner[j].left, inner[i].left], color: '#2b2d31', ground: true, lift: 0.01 });
      }
    });
    return polys;
  },

  // Raised segments get a deck skirt on each side and a pillar every few samples.
  bridgePolys: function (center, kerb, i, j) {
    var raised = Math.min(center[i].y, center[j].y) > 0.6;
    if (!raised) return [];
    var deck = 1.0, drop = Vec.make(0, -deck, 0);
    var rail = Vec.make(0, 0.9, 0), railColor = (i % 2 === 0) ? '#d7dbe0' : '#c3c8ce';
    var polys = [
      { pts: [kerb[i].left, kerb[j].left, Vec.add(kerb[j].left, drop), Vec.add(kerb[i].left, drop)], color: '#7a7f86' },
      { pts: [kerb[j].right, kerb[i].right, Vec.add(kerb[i].right, drop), Vec.add(kerb[j].right, drop)], color: '#7a7f86' },
      { pts: [kerb[i].left, kerb[j].left, Vec.add(kerb[j].left, rail), Vec.add(kerb[i].left, rail)], color: railColor },
      { pts: [kerb[j].right, kerb[i].right, Vec.add(kerb[i].right, rail), Vec.add(kerb[j].right, rail)], color: railColor }
    ];
    if (i % 4 === 0) polys.push.apply(polys, Scene.pillar(center[i], center[i].y - deck));
    return polys;
  },

  pillar: function (p, top) {
    var r = 1.0, polys = [];
    var corners = [[-r, -r], [r, -r], [r, r], [-r, r]];
    for (var s = 0; s < 4; s++) {
      var a = corners[s], b = corners[(s + 1) % 4];
      polys.push({
        pts: [Vec.make(p.x + a[0], 0, p.z + a[1]), Vec.make(p.x + b[0], 0, p.z + b[1]),
              Vec.make(p.x + b[0], top, p.z + b[1]), Vec.make(p.x + a[0], top, p.z + a[1])],
        color: (s % 2 === 0) ? '#9a9fa6' : '#868b92'
      });
    }
    return polys;
  },

  startLine: function (road) {
    var polys = [], checks = 6;
    for (var c = 0; c < checks; c++) {
      var a = c / checks, b = (c + 1) / checks;
      polys.push({
        pts: [Vec.lerp(road[0].left, road[0].right, a), Vec.lerp(road[1].left, road[1].right, a),
              Vec.lerp(road[1].left, road[1].right, b), Vec.lerp(road[0].left, road[0].right, b)],
        color: (c % 2 === 0) ? '#ffffff' : '#222222', ground: true, lift: 0.02
      });
    }
    return polys;
  },

  trees: function (center, rnd) {
    var out = [];
    var xs = center.map(function (p) { return p.x; }), zs = center.map(function (p) { return p.z; });
    var x0 = Math.min.apply(null, xs) - 30, x1 = Math.max.apply(null, xs) + 30;
    var z0 = Math.min.apply(null, zs) - 30, z1 = Math.max.apply(null, zs) + 30;
    for (var k = 0; k < 360; k++) {
      var p = Vec.make(x0 + rnd() * (x1 - x0), 0, z0 + rnd() * (z1 - z0));
      var tooClose = center.some(function (c) {
        var d = Vec.sub(c, p);
        return Math.sqrt(d.x * d.x + d.z * d.z) < Track.width + 3;
      });
      if (tooClose) continue;
      out.push({ pos: p, h: 6 + rnd() * 5, r: 2.2 + rnd() * 1.8, color: (rnd() < 0.5) ? '#2f7d33' : '#3c8f3a' });
    }
    return out;
  },

  // A tree is a trunk box under two stacked foliage cones.
  treePolys: function (t) {
    var polys = [], sides = 7, p = t.pos, trunkTop = t.h * 0.25;
    polys.push.apply(polys, Scene.cone(p, trunkTop, t.h * 0.7, t.r, sides, t.color));
    polys.push.apply(polys, Scene.cone(p, t.h * 0.5, t.h, t.r * 0.72, sides, t.color));
    var tr = t.r * 0.18;
    for (var s = 0; s < 4; s++) {
      var a0 = (s / 4) * Math.PI * 2, a1 = ((s + 1) / 4) * Math.PI * 2;
      var t0 = Vec.make(p.x + Math.cos(a0) * tr, 0, p.z + Math.sin(a0) * tr);
      var t1 = Vec.make(p.x + Math.cos(a1) * tr, 0, p.z + Math.sin(a1) * tr);
      polys.push({ pts: [t0, t1, Vec.add(t1, Vec.make(0, trunkTop, 0)), Vec.add(t0, Vec.make(0, trunkTop, 0))], color: '#5d4037' });
    }
    return polys;
  },

  cone: function (p, base, top, r, sides, color) {
    var polys = [], apex = Vec.make(p.x, top, p.z);
    for (var s = 0; s < sides; s++) {
      var a0 = (s / sides) * Math.PI * 2, a1 = ((s + 1) / sides) * Math.PI * 2;
      var b0 = Vec.make(p.x + Math.cos(a0) * r, base, p.z + Math.sin(a0) * r);
      var b1 = Vec.make(p.x + Math.cos(a1) * r, base, p.z + Math.sin(a1) * r);
      polys.push({ pts: [b0, b1, apex], color: color });
    }
    return polys;
  }
};
