// Scene: the scenery polygons for a track (road, kerbs, bridge structure, trees, start line).
var Scene = {
  build: function (track, rnd) {
    var center = track.center, road = track.road;
    var kerb = Track.edges(center, track.width / 2 + 1.2);
    var n = center.length;
    var polys = [];

    for (var i = 0; i < n; i++) {
      if (i >= track.jump.takeIndex && i < track.jump.landIndex) continue;
      var j = (i + 1) % n;
      var kerbColor = (i % 2 === 0) ? '#dd3333' : '#eeeeee';
      polys.push({ pts: [kerb[i].left, kerb[j].left, road[j].left, road[i].left], color: kerbColor, ground: true });
      polys.push({ pts: [road[i].right, road[j].right, kerb[j].right, kerb[i].right], color: kerbColor, ground: true });
      var asphalt = (i % 2 === 0) ? '#484b50' : '#4c4f54';
      polys.push({ pts: [road[i].left, road[j].left, road[j].right, road[i].right], color: asphalt, ground: true });
      polys.push.apply(polys, Scene.bridgePolys(center, kerb, i, j));
    }
    polys.push.apply(polys, Scene.slots(track));
    polys.push.apply(polys, Scene.lip(kerb, track.jump.takeIndex));

    polys.push.apply(polys, Scene.startLine(road));
    Scene.trees(center, rnd).forEach(function (t) { polys.push.apply(polys, Scene.treePolys(t)); });

    return polys;
  },

  // A dark slot groove down the middle of each lane, like a toy slot-car track.
  slots: function (track) {
    var center = track.center, polys = [], n = center.length, w = 0.25;
    [-Track.laneOffset, Track.laneOffset].forEach(function (off) {
      var inner = Track.edges(center, off - w), outer = Track.edges(center, off + w);
      for (var i = 0; i < n; i++) {
        if (i >= track.jump.takeIndex && i < track.jump.landIndex) continue;
        var j = (i + 1) % n;
        polys.push({ pts: [outer[i].left, outer[j].left, inner[j].left, inner[i].left], color: '#2b2d31', ground: true, lift: 0.01 });
      }
    });
    return polys;
  },

  // The ramp's end face, from the lip down to the ground.
  lip: function (kerb, takeIndex) {
    var l = kerb[takeIndex].left, r = kerb[takeIndex].right;
    return [{ pts: [r, l, Vec.make(l.x, 0, l.z), Vec.make(r.x, 0, r.z)], color: '#6d7279' }];
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
      out.push({ pos: p, h: 20 + rnd() * 12, r: 6 + rnd() * 3, phase: rnd() * Math.PI * 2, color: (rnd() < 0.5) ? '#2f7d33' : '#3c8f3a' });
    }
    // Keep every other tree to halve foliage rendering while preserving its distribution.
    return out.filter(function (_, i) { return i % 2 === 0; });
  },

  // Tapered trunks and branches support irregular, overlapping leafy crowns.
  treePolys: function (t) {
    var polys = [], p = t.pos, phase = t.phase || 0;
    var shadow = [];
    for (var k = 0; k < 10; k++) {
      var a = k * Math.PI / 5;
      shadow.push(Vec.make(p.x - t.h * 0.2 + Math.cos(a) * t.r * 1.45, 0, p.z - t.h * 0.13 + Math.sin(a) * t.r));
    }
    polys.push({ pts: shadow, color: '#467e32', ground: true, lift: 0.008 });
    var fork = Vec.add(p, Vec.make(Math.cos(phase) * t.r * 0.12, t.h * 0.57, Math.sin(phase) * t.r * 0.12));
    polys.push.apply(polys, Scene.branch(p, fork, t.r * 0.12, t.r * 0.045));
    for (var s = 0; s < 3; s++) {
      var angle = phase + s * Math.PI * 2 / 3;
      var crown = Vec.add(p, Vec.make(Math.cos(angle) * t.r * 0.43, t.h * (0.62 + s * 0.045), Math.sin(angle) * t.r * 0.43));
      polys.push.apply(polys, Scene.branch(Vec.lerp(p, fork, 0.7), crown, t.r * 0.055, t.r * 0.02));
      polys.push.apply(polys, Scene.crown(crown, t.r * 0.76, t.h * 0.24, angle, t.color));
    }
    polys.push.apply(polys, Scene.crown(Vec.add(p, Vec.make(0, t.h * 0.82, 0)), t.r * 0.68, t.h * 0.18, phase + 1, t.color));
    return polys;
  },

  branch: function (a, b, r0, r1) {
    var axis = Vec.norm(Vec.sub(b, a));
    var u = Vec.norm(Vec.cross(axis, Vec.make(0, 0, 1))), v = Vec.cross(axis, u);
    function ring(p, r, angle) { return Vec.add(p, Vec.add(Vec.scale(u, Math.cos(angle) * r), Vec.scale(v, Math.sin(angle) * r))); }
    var polys = [];
    for (var s = 0; s < 6; s++) {
      var x = s * Math.PI / 3, y = (s + 1) * Math.PI / 3;
      polys.push({ pts: [ring(a, r0, x), ring(a, r0, y), ring(b, r1, y), ring(b, r1, x)], color: s % 2 ? '#69452d' : '#805536' });
    }
    return polys;
  },

  crown: function (p, radius, height, phase, color) {
    var rings = [], polys = [], sides = 8;
    for (var row = 0; row < 5; row++) {
      var latitude = -Math.PI / 2 + row * Math.PI / 4, ring = [];
      for (var s = 0; s < sides; s++) {
        var angle = s * Math.PI * 2 / sides + phase;
        var ripple = 1 + 0.13 * Math.sin(s * 2.7 + phase + row * 1.9);
        ring.push(Vec.add(p, Vec.make(Math.cos(angle) * Math.cos(latitude) * radius * ripple,
          Math.sin(latitude) * height, Math.sin(angle) * Math.cos(latitude) * radius * ripple)));
      }
      rings.push(ring);
    }
    for (var j = 0; j < 4; j++) for (var i = 0; i < sides; i++) {
      var next = (i + 1) % sides;
      var pts = j === 0 ? [rings[0][i], rings[1][next], rings[1][i]] :
        j === 3 ? [rings[3][i], rings[3][next], rings[4][i]] :
        [rings[j][i], rings[j][next], rings[j + 1][next], rings[j + 1][i]];
      var tint = 0.9 + 0.12 * (0.5 + 0.5 * Math.sin(i * 3.1 + j + phase));
      polys.push({ pts: pts, color: Render.hex(Render.rgb(color).map(function (c) { return c * tint; })) });
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
