// Orbit camera: looks at a target from a distance, yaw/pitch, with perspective projection.
function Camera(width, height) {
  this.width = width;
  this.height = height;
  this.reset();
}

Camera.prototype.reset = function () {
  this.target = Vec.make(0, 0, 0);
  this.yaw = 0.6;
  this.pitch = 1.05;
  this.dist = 950;
  this.fov = 1.1;
};

Camera.prototype.position = function () {
  var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
  var off = Vec.make(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
  return Vec.add(this.target, Vec.scale(off, this.dist));
};

// Basis vectors: forward (toward target), right, up.
Camera.prototype.basis = function () {
  var eye = this.position();
  var fwd = Vec.norm(Vec.sub(this.target, eye));
  var right = Vec.norm(Vec.cross(fwd, Vec.make(0, 1, 0)));
  var up = Vec.cross(right, fwd);
  return { eye: eye, fwd: fwd, right: right, up: up };
};

// Returns {x, y, depth} in screen space, or depth <= 0 if behind camera.
Camera.prototype.project = function (basis, p) {
  var d = Vec.sub(p, basis.eye);
  var depth = Vec.dot(d, basis.fwd);
  var f = (this.height / 2) / Math.tan(this.fov / 2);
  var sx = this.width / 2 + Vec.dot(d, basis.right) * f / depth;
  var sy = this.height / 2 - Vec.dot(d, basis.up) * f / depth;
  return { x: sx, y: sy, depth: depth };
};

Camera.prototype.orbit = function (dx, dy) {
  this.yaw -= dx * 0.005;
  this.pitch = Math.min(1.5, Math.max(0.08, this.pitch + dy * 0.005));
};

Camera.prototype.zoom = function (factor) {
  this.dist = Math.min(Math.max(1200, this.overviewDist || 0) * 2, Math.max(8, this.dist * factor));
};

// Fit the actual track's projected diagonal to 90% of the shorter dimension.
Camera.prototype.fitGrid = function (track) {
  if (!track) return;
  var points = [];
  Track.edges(track.center, track.width / 2 + 1.2).forEach(function (e) { points.push(e.left, e.right); });
  var camera = this, min = Vec.make(Infinity, Infinity, Infinity), max = Vec.make(-Infinity, -Infinity, -Infinity);
  points.forEach(function (p) {
    ['x','y','z'].forEach(function (k) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); });
  });
  this.target = Vec.lerp(min, max, 0.5);
  var desired = 0.9 * Math.max(1, Math.min(this.width, this.height));
  var focal = (this.height / 2) / Math.tan(this.fov / 2);
  function bounds() {
    var basis = camera.basis(), box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, valid: true };
    points.forEach(function (p) {
      var s = camera.project(basis, p);
      if (s.depth < 0.5) box.valid = false;
      box.x0 = Math.min(box.x0, s.x); box.x1 = Math.max(box.x1, s.x);
      box.y0 = Math.min(box.y0, s.y); box.y1 = Math.max(box.y1, s.y);
    });
    box.span = box.valid ? Math.hypot(box.x1 - box.x0, box.y1 - box.y0) : Infinity;
    return box;
  }
  // Recenter after each distance solve to compensate for perspective asymmetry.
  for (var pass = 0; pass < 12; pass++) {
    var low = 0.5, high = Math.max(100, Vec.len(Vec.sub(max, min)));
    this.dist = high;
    while (bounds().span > desired) { high *= 2; this.dist = high; }
    for (var step = 0; step < 40; step++) {
      this.dist = (low + high) / 2;
      if (bounds().span > desired) low = this.dist; else high = this.dist;
    }
    this.dist = high;
    var box = bounds(), basis = this.basis();
    var dx = (box.x0 + box.x1 - this.width) / 2, dy = (box.y0 + box.y1 - this.height) / 2;
    if (Math.abs(dx) + Math.abs(dy) < 0.001) break;
    this.target = Vec.add(this.target, Vec.add(Vec.scale(basis.right, dx * this.dist / focal), Vec.scale(basis.up, -dy * this.dist / focal)));
  }
  this.overviewDist = this.dist;
};

// Pan along the ground relative to the current view heading.
Camera.prototype.pan = function (forwardAmt, rightAmt) {
  var fwd = Vec.make(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  var right = Vec.make(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  var step = this.dist * 0.01;
  this.target = Vec.add(this.target, Vec.add(Vec.scale(fwd, forwardAmt * step), Vec.scale(right, rightAmt * step)));
};

Camera.prototype.raise = function (amt) {
  this.target.y = Math.max(0, this.target.y + amt * this.dist * 0.01);
};
