// Render: project polygons, sort far-to-near, light by surface normal, fill.
// A poly is { pts: [Vec...], color: '#rrggbb', ground: bool, lift: m }. ground marks a flat tile
// that sorts by its farthest vertex so things resting on it draw later; lift raises it slightly
// so overlapping ground tiles (slots, start line, shadows) win against the road.
var Render = {
  skyTop: '#4a8ad6',
  skyHorizon: '#d9e8f6',
  grass: '#5a9e3f',
  light: Vec.norm(Vec.make(0.45, 1, 0.3)),
  ambient: 0.4,
  skyBands: 96,
  daylight: 1,
  headlights: 0,
  lamps: [],

  // A complete noon -> dusk -> midnight -> dawn -> noon cycle lasts five minutes.
  setTime: function (seconds) {
    var sun = Math.cos(seconds * Math.PI * 2 / 300);
    var t = Math.max(0, Math.min(1, (sun + 0.25) / 0.75));
    Render.daylight = t * t * (3 - 2 * t);
    Render.headlights = 1 - Render.daylight;
    var dusk = Math.max(0, 1 - Math.abs(sun - 0.1) / 0.4);
    Render.skyTop = Render.hex(Render.mix([8, 14, 32], [74, 138, 214], Render.daylight));
    var horizon = Render.mix([22, 30, 53], [217, 232, 246], Render.daylight);
    Render.skyHorizon = Render.hex(Render.mix(horizon, [214, 126, 91], dusk * 0.65));
    Render.grass = Render.hex(Render.mix([17, 32, 27], [90, 158, 63], Render.daylight));
  },

  // Twin forward cones illuminate surfaces near the cars, including elevated road decks.
  lampStrength: function (p) {
    if (Render.headlights < 0.01) return 0;
    var total = 0;
    for (var i = 0; i < Render.lamps.length; i++) {
      var lamp = Render.lamps[i], delta = Vec.sub(p, lamp.pos);
      var forward = Vec.dot(delta, lamp.dir);
      if (forward < 0 || forward > 85) continue;
      var sideways = Math.abs(Vec.dot(delta, lamp.side));
      var width = 1.8 + forward * 0.20;
      var vertical = Math.abs(delta.y - lamp.dir.y * forward);
      if (sideways >= width || vertical > 6) continue;
      var edge = 1 - sideways / width;
      total += edge * edge * Math.pow(1 - forward / 85, 1.4) * (1 - vertical / 6);
    }
    return Math.min(1, total) * Render.headlights;
  },

  // Only subdivide nearby road tiles at night, keeping the extra rendering work local.
  lightTiles: function (poly) {
    if (!poly.ground || poly.pts.length !== 4 || Render.headlights < 0.01) return [poly];
    var p = poly.pts, center = Vec.scale(Vec.add(Vec.add(p[0], p[1]), Vec.add(p[2], p[3])), 0.25);
    if (!Render.lamps.some(function (lamp) { return Vec.len(Vec.sub(center, lamp.pos)) < 115; })) return [poly];
    var rows = Math.min(24, Math.ceil(Math.max(Vec.len(Vec.sub(p[1], p[0])), Vec.len(Vec.sub(p[2], p[3]))) / 5));
    var cols = Math.min(12, Math.ceil(Math.max(Vec.len(Vec.sub(p[3], p[0])), Vec.len(Vec.sub(p[2], p[1]))) / 4));
    if (rows * cols <= 1) return [poly];
    function point(u, v) { return Vec.lerp(Vec.lerp(p[0], p[1], u), Vec.lerp(p[3], p[2], u), v); }
    var tiles = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      tiles.push({ pts: [point(r / rows, c / cols), point((r + 1) / rows, c / cols),
        point((r + 1) / rows, (c + 1) / cols), point(r / rows, (c + 1) / cols)],
        color: poly.color, ground: true, lift: poly.lift });
    }
    return tiles;
  },

  rgb: function (hex) {
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
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
  lit: function (pts, color, emissive) {
    var n = Render.normal(pts);
    var k = Render.ambient + (1 - Render.ambient) * Math.abs(Vec.dot(n, Render.light)) / Render.light.y;
    var base = Render.rgb(color);
    var night = Render.mix([0.15, 0.20, 0.30], [1, 1, 1], Render.daylight);
    var center = Vec.make(0, 0, 0);
    if (Render.headlights > 0.01) pts.forEach(function (p) { center = Vec.add(center, p); });
    var beam = Render.lampStrength(Vec.scale(center, 1 / pts.length));
    return Render.hex(base.map(function (v, i) {
      var shaded = v * k * night[i];
      var illuminated = Math.min(255, v * 1.35 + [90, 83, 57][i]);
      var glow = emissive ? Render.headlights : 0;
      return (shaded + (illuminated - shaded) * beam) * (1 - glow) + v * glow;
    }));
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
    if (Render.headlights > 0.01) {
      var tiles = [];
      polys.forEach(function (poly) { tiles.push.apply(tiles, Render.lightTiles(poly)); });
      polys = tiles;
    }

    var projected = [];
    for (var i = 0; i < polys.length; i++) {
      var poly = polys[i];
      var scr = poly.pts.map(function (p) {
        return cam.project(basis, poly.lift ? Vec.add(p, Vec.make(0, poly.lift, 0)) : p);
      });
      if (scr.some(function (s) { return s.depth < 0.5; })) continue;
      var depth = Render.sortDepth(scr, poly.ground);
      if (scr.every(function (s) { return s.x < -2; }) || scr.every(function (s) { return s.x > cam.width + 2; }) ||
          scr.every(function (s) { return s.y < -2; }) || scr.every(function (s) { return s.y > cam.height + 2; })) continue;
      projected.push({ scr: scr, depth: depth, color: Render.lit(poly.pts, poly.color, poly.emissive) });
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
