// Mesh: polygon builders in a local frame. P(f, s, h) maps forward/left/up coords to world points.
var Mesh = {
  // Five faces (no bottom) of a box.
  box: function (P, f0, f1, s0, s1, h0, h1, color) {
    return [
      { pts: [P(f1, s0, h1), P(f1, s1, h1), P(f0, s1, h1), P(f0, s0, h1)], color: color },
      { pts: [P(f1, s0, h0), P(f1, s1, h0), P(f1, s1, h1), P(f1, s0, h1)], color: color },
      { pts: [P(f0, s1, h0), P(f0, s0, h0), P(f0, s0, h1), P(f0, s1, h1)], color: color },
      { pts: [P(f1, s1, h0), P(f0, s1, h0), P(f0, s1, h1), P(f1, s1, h1)], color: color },
      { pts: [P(f0, s0, h0), P(f1, s0, h0), P(f1, s0, h1), P(f0, s0, h1)], color: color }
    ];
  },

  // Loft a closed hull through cross-sections {f, w, h0, h1} (half-width w, floor h0, roof h1).
  loft: function (P, sections, color) {
    var polys = [];
    for (var i = 0; i < sections.length - 1; i++) {
      var a = sections[i], b = sections[i + 1];
      polys.push({ pts: [P(a.f, -a.w, a.h1), P(a.f, a.w, a.h1), P(b.f, b.w, b.h1), P(b.f, -b.w, b.h1)], color: color });
      polys.push({ pts: [P(a.f, a.w, a.h0), P(a.f, a.w, a.h1), P(b.f, b.w, b.h1), P(b.f, b.w, b.h0)], color: color });
      polys.push({ pts: [P(a.f, -a.w, a.h0), P(b.f, -b.w, b.h0), P(b.f, -b.w, b.h1), P(a.f, -a.w, a.h1)], color: color });
    }
    var f0 = sections[0], fn = sections[sections.length - 1];
    polys.push({ pts: [P(f0.f, -f0.w, f0.h0), P(f0.f, f0.w, f0.h0), P(f0.f, f0.w, f0.h1), P(f0.f, -f0.w, f0.h1)], color: color });
    polys.push({ pts: [P(fn.f, fn.w, fn.h0), P(fn.f, -fn.w, fn.h0), P(fn.f, -fn.w, fn.h1), P(fn.f, fn.w, fn.h1)], color: color });
    return polys;
  }
};
