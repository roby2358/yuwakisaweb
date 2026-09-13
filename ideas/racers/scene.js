// Scene: builds the list of 3D polygons (road, kerbs, bridge structure, trees, start line).
var Scene = {
  build: function (rnd) {
    var center = Track.generate(rnd);
    var half = Track.width / 2;
    var road = Track.edges(center, half);
    var kerb = Track.edges(center, half + 1.2);
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

    return { polys: polys, center: center, road: road, arc: Track.arcLength(center), curv: Track.curvature(center) };
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
  },

  // Shade a hex color by a factor (1 = unchanged).
  shade: function (hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.round(((n >> 16) & 255) * k));
    var g = Math.min(255, Math.round(((n >> 8) & 255) * k));
    var b = Math.min(255, Math.round((n & 255) * k));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  },

  // Five faces (no bottom) of a box in car-local coords: f forward, s left, h up.
  box: function (P, f0, f1, s0, s1, h0, h1, color) {
    var top = color, side = color, end = color;
    return [
      { pts: [P(f1, s0, h1), P(f1, s1, h1), P(f0, s1, h1), P(f0, s0, h1)], color: top },
      { pts: [P(f1, s0, h0), P(f1, s1, h0), P(f1, s1, h1), P(f1, s0, h1)], color: end },
      { pts: [P(f0, s1, h0), P(f0, s0, h0), P(f0, s0, h1), P(f0, s1, h1)], color: end },
      { pts: [P(f1, s1, h0), P(f0, s1, h0), P(f0, s1, h1), P(f1, s1, h1)], color: side },
      { pts: [P(f0, s0, h0), P(f1, s0, h0), P(f1, s0, h1), P(f0, s0, h1)], color: side }
    ];
  },

  // Loft a closed hull through cross-sections {f, w, h0, h1} (half-width w, floor h0, roof h1).
  loft: function (P, sections, color) {
    var top = color, end = color, polys = [];
    for (var i = 0; i < sections.length - 1; i++) {
      var a = sections[i], b = sections[i + 1];
      polys.push({ pts: [P(a.f, -a.w, a.h1), P(a.f, a.w, a.h1), P(b.f, b.w, b.h1), P(b.f, -b.w, b.h1)], color: top });
      polys.push({ pts: [P(a.f, a.w, a.h0), P(a.f, a.w, a.h1), P(b.f, b.w, b.h1), P(b.f, b.w, b.h0)], color: color });
      polys.push({ pts: [P(a.f, -a.w, a.h0), P(b.f, -b.w, b.h0), P(b.f, -b.w, b.h1), P(a.f, -a.w, a.h1)], color: color });
    }
    var f0 = sections[0], fn = sections[sections.length - 1];
    polys.push({ pts: [P(f0.f, -f0.w, f0.h0), P(f0.f, f0.w, f0.h0), P(f0.f, f0.w, f0.h1), P(f0.f, -f0.w, f0.h1)], color: end });
    polys.push({ pts: [P(fn.f, fn.w, fn.h0), P(fn.f, -fn.w, fn.h0), P(fn.f, -fn.w, fn.h1), P(fn.f, fn.w, fn.h1)], color: end });
    return polys;
  },

  // Low wedge supercar for a given position, heading, side vector and paint colors.
  carPolys: function (pos, dir, side, scale, paint) {
    function P(f, s, h) {
      return Vec.add(Vec.add(Vec.add(pos, Vec.scale(dir, f * scale)), Vec.scale(side, s * scale)), Vec.make(0, h * scale, 0));
    }
    function S(f, w, h0, h1) { return { f: f, w: w, h0: h0, h1: h1 }; }
    var glass = '#3a4a5a', tire = '#111';
    var B = function () { return Scene.box.apply(null, [P].concat([].slice.call(arguments))); };

    var hull = Scene.loft(P, [
      S(2.5, 0.75, 0.25, 0.35),   // knife-edge nose
      S(1.8, 1.05, 0.22, 0.5),
      S(0.7, 1.15, 0.22, 0.68),   // hood meets windshield
      S(-2.0, 1.15, 0.22, 0.82),  // rear deck kicks up
      S(-2.5, 1.05, 0.3, 0.78)
    ], paint.body);

    var cabin = Scene.loft(P, [
      S(0.7, 0.9, 0.68, 0.7),     // windshield base
      S(-0.3, 0.85, 0.68, 1.12),  // raked windshield to roof
      S(-1.0, 0.8, 0.7, 1.12),
      S(-1.7, 0.7, 0.78, 0.86)    // engine window slope
    ], glass);

    var shadow = { pts: [P(2.4, -1.2, 0), P(2.4, 1.2, 0), P(-2.7, 1.2, 0), P(-2.7, -1.2, 0)], color: '#34373c', ground: true, lift: 0.015 };
    var polys = [].concat(
      [shadow], hull, cabin,
      B(-2.6, -2.3, -1.0, 1.0, 0.08, 0.3, paint.roof),      // diffuser
      B(-2.56, -2.45, 0.5, 0.95, 0.5, 0.7, '#ff3d00'),       // tail lights
      B(-2.56, -2.45, -0.95, -0.5, 0.5, 0.7, '#ff3d00')
    );
    // Only the bottom of each wheel shows, fully under the hull floor like a slot car.
    [1.6, -1.6].forEach(function (f) {
      polys.push.apply(polys, B(f - 0.3, f + 0.3, 0.6, 0.9, 0, 0.2, tire));
      polys.push.apply(polys, B(f - 0.3, f + 0.3, -0.9, -0.6, 0, 0.2, tire));
    });
    return polys;
  }
};
