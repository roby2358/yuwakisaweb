// Render: project polygons, sort far-to-near, light by surface normal, fill.
var Render = {
  skyTop: '#4a8ad6',
  skyHorizon: '#d9e8f6',
  grass: '#5a9e3f',
  light: Vec.norm(Vec.make(0.45, 1, 0.3)),
  ambient: 0.4,
  skyBands: 32,

  rgb: function (hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },

  hex: function (c) {
    var r = Math.max(0, Math.min(255, Math.round(c[0])));
    var g = Math.max(0, Math.min(255, Math.round(c[1])));
    var b = Math.max(0, Math.min(255, Math.round(c[2])));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  },

  mix: function (a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  },

  // Unit normal from the first non-degenerate triangle of the polygon.
  normal: function (pts) {
    for (var i = 2; i < pts.length; i++) {
      var n = Vec.cross(Vec.sub(pts[1], pts[0]), Vec.sub(pts[i], pts[0]));
      if (Vec.len(n) > 1e-6) return Vec.norm(n);
    }
    return Vec.make(0, 1, 0);
  },

  // Lambert shading normalised so an upward face keeps its base color.
  lit: function (pts, color) {
    var n = Render.normal(pts);
    var k = Render.ambient + (1 - Render.ambient) * Math.abs(Vec.dot(n, Render.light)) / Render.light.y;
    return Render.hex(Render.rgb(color).map(function (v) { return v * k; }));
  },

  // Flat tiles sort by their farthest vertex so objects resting on them always draw later;
  // everything else sorts by average depth.
  sortDepth: function (scr, ground) {
    if (ground) return scr.reduce(function (a, s) { return Math.max(a, s.depth); }, 0);
    return scr.reduce(function (a, s) { return a + s.depth; }, 0) / scr.length;
  },

  horizon: function (cam) {
    var f = (cam.height / 2) / Math.tan(cam.fov / 2);
    return cam.height / 2 - f * Math.tan(cam.pitch);
  },

  draw: function (ctx, cam, polys) {
    var basis = cam.basis();
    Render.drawSky(ctx, cam);
    Render.drawGround(ctx, cam, basis);

    var projected = [];
    for (var i = 0; i < polys.length; i++) {
      var poly = polys[i];
      var lift = poly.lift || 0;
      var scr = poly.pts.map(function (p) {
        return cam.project(basis, lift ? Vec.add(p, Vec.make(0, lift, 0)) : p);
      });
      if (scr.some(function (s) { return s.depth < 0.5; })) continue;
      var depth = Render.sortDepth(scr, poly.ground);
      projected.push({ scr: scr, depth: depth, color: Render.lit(poly.pts, poly.color) });
    }
    projected.sort(function (a, b) { return b.depth - a.depth; });

    for (var k = 0; k < projected.length; k++) Render.fillPoly(ctx, projected[k].scr, projected[k].color);
  },

  // Stroke in the fill color to hide antialiasing seams between adjacent polygons.
  fillPoly: function (ctx, scr, color) {
    ctx.beginPath();
    ctx.moveTo(scr[0].x, scr[0].y);
    for (var m = 1; m < scr.length; m++) ctx.lineTo(scr[m].x, scr[m].y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  // Vertical gradient from deep blue overhead to pale haze at the horizon, drawn as bands.
  drawSky: function (ctx, cam) {
    var top = Render.rgb(Render.skyTop), bottom = Render.rgb(Render.skyHorizon);
    var horizon = Math.max(1, Render.horizon(cam));
    var span = Math.max(horizon, cam.height * 0.6);
    ctx.fillStyle = Render.skyHorizon;
    ctx.fillRect(0, 0, cam.width, cam.height);
    for (var b = 0; b < Render.skyBands; b++) {
      var y0 = horizon - span * (1 - b / Render.skyBands);
      var y1 = horizon - span * (1 - (b + 1) / Render.skyBands);
      ctx.fillStyle = Render.hex(Render.mix(top, bottom, Math.pow(b / Render.skyBands, 1.4)));
      ctx.fillRect(0, y0 - 1, cam.width, y1 - y0 + 2);
    }
  },

  // Stable per-tile mottling keyed on world grid coordinates.
  tileColor: function (xi, zi) {
    var h = Math.sin(xi * 127.1 + zi * 311.7) * 43758.5453;
    var t = h - Math.floor(h);
    return Render.hex(Render.rgb(Render.grass).map(function (v) { return v * (0.965 + 0.07 * t); }));
  },

  // Plain grass below the horizon for any ground the tiles miss.
  drawGroundBackdrop: function (ctx, cam) {
    var horizon = Math.max(0, Render.horizon(cam));
    ctx.fillStyle = Render.grass;
    ctx.fillRect(0, horizon, cam.width, cam.height - horizon);
  },

  // World-aligned grass tiles around the camera target.
  drawGround: function (ctx, cam, basis) {
    Render.drawGroundBackdrop(ctx, cam);
    var t = cam.target, R = 1200, N = 28, step = (2 * R) / N;
    var xi0 = Math.floor((t.x - R) / step), zi0 = Math.floor((t.z - R) / step);
    for (var i = 0; i <= N; i++) {
      for (var j = 0; j <= N; j++) {
        var xi = xi0 + i, zi = zi0 + j, x0 = xi * step, z0 = zi * step;
        var quad = [Vec.make(x0, 0, z0), Vec.make(x0 + step, 0, z0), Vec.make(x0 + step, 0, z0 + step), Vec.make(x0, 0, z0 + step)];
        var scr = quad.map(function (p) { return cam.project(basis, p); });
        if (scr.some(function (s) { return s.depth < 0.5; })) continue;
        Render.fillPoly(ctx, scr, Render.tileColor(xi, zi));
      }
    }
  }
};
