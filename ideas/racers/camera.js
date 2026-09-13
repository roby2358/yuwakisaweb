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
  this.dist = Math.min(1200, Math.max(8, this.dist * factor));
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
