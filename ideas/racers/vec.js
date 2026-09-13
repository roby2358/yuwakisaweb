// Minimal 3D vector helpers. Points are {x, y, z}; y is up.
var Vec = {
  make: function (x, y, z) { return { x: x, y: y, z: z }; },
  add: function (a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; },
  sub: function (a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; },
  scale: function (a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; },
  len: function (a) { return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); },
  norm: function (a) { var l = Vec.len(a); return l === 0 ? a : Vec.scale(a, 1 / l); },
  cross: function (a, b) {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
  },
  dot: function (a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; },
  lerp: function (a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  },
  centroid: function (pts) {
    var s = pts.reduce(Vec.add, Vec.make(0, 0, 0));
    return Vec.scale(s, 1 / pts.length);
  }
};
