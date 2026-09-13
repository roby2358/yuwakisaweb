// Render: project polygons, sort far-to-near, fill.
var Render = {
  sky: '#8ec5ff',
  grass: '#4caf50',

  // Flat tiles sort by their farthest vertex so objects resting on them always draw later;
  // everything else sorts by average depth.
  sortDepth: function (scr, ground) {
    if (ground) return scr.reduce(function (a, s) { return Math.max(a, s.depth); }, 0);
    return scr.reduce(function (a, s) { return a + s.depth; }, 0) / scr.length;
  },

  draw: function (ctx, cam, polys) {
    var basis = cam.basis();
    ctx.fillStyle = Render.sky;
    ctx.fillRect(0, 0, cam.width, cam.height);
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
      projected.push({ scr: scr, depth: depth, color: poly.color, ground: poly.ground });
    }
    projected.sort(function (a, b) { return b.depth - a.depth; });

    for (var k = 0; k < projected.length; k++) {
      var q = projected[k];
      ctx.beginPath();
      ctx.moveTo(q.scr[0].x, q.scr[0].y);
      for (var m = 1; m < q.scr.length; m++) ctx.lineTo(q.scr[m].x, q.scr[m].y);
      ctx.closePath();
      ctx.fillStyle = q.color;
      ctx.fill();
      // Stroke ground tiles in their own color to hide seams between adjacent quads.
      ctx.strokeStyle = q.ground ? q.color : 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  },

  // A big grass quad centered on the camera target, so the ground looks infinite.
  drawGround: function (ctx, cam, basis) {
    // Everything below the horizon is grass; tiles near the camera get culled so this fills behind them.
    var f = (cam.height / 2) / Math.tan(cam.fov / 2);
    var horizon = cam.height / 2 - f * Math.tan(cam.pitch);
    ctx.fillStyle = Render.grass;
    ctx.fillRect(0, Math.max(0, horizon), cam.width, cam.height);
    var t = cam.target, R = 900;
    var corners = [
      Vec.make(t.x - R, 0, t.z - R), Vec.make(t.x + R, 0, t.z - R),
      Vec.make(t.x + R, 0, t.z + R), Vec.make(t.x - R, 0, t.z + R)
    ];
    // Subdivide to keep every projected point in front of the camera.
    var N = 12, step = (2 * R) / N;
    ctx.fillStyle = Render.grass;
    ctx.strokeStyle = Render.grass;
    for (var i = 0; i < N; i++) {
      for (var j = 0; j < N; j++) {
        var x0 = corners[0].x + i * step, z0 = corners[0].z + j * step;
        var quad = [Vec.make(x0, 0, z0), Vec.make(x0 + step, 0, z0), Vec.make(x0 + step, 0, z0 + step), Vec.make(x0, 0, z0 + step)];
        var scr = quad.map(function (p) { return cam.project(basis, p); });
        if (scr.some(function (s) { return s.depth < 0.5; })) continue;
        ctx.beginPath();
        ctx.moveTo(scr[0].x, scr[0].y);
        for (var m = 1; m < 4; m++) ctx.lineTo(scr[m].x, scr[m].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }
};
