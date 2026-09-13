// Main: wires input, steps the cars, renders each frame.
(function () {
  var canvas = document.getElementById('view');
  var ctx = canvas.getContext('2d');
  var cam = new Camera(1, 1);
  var keys = {};
  var follow = false;
  var track, scenery, cars;

  var startHold = 0; // seconds the cars sit on the start line before launching

  function buildTrack(rnd) {
    for (var tries = 0; tries < 10; tries++) {
      try {
        return Track.build(rnd);
      } catch (err) {
        console.error('track generation failed, retrying', err);
      }
    }
    throw new Error('track generation kept failing');
  }

  function newTrack() {
    var rnd = Rng.make(1 + Math.floor(Math.random() * 2147483000));
    track = buildTrack(rnd);
    scenery = Scene.build(track, rnd);
    cars = Cars.field();
    cars.forEach(function (c) { c.v = 0; });
    startHold = 1.0;
    if (!follow) cam.fitGrid(track);
  }
  newTrack();

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam.width = window.innerWidth;
    cam.height = window.innerHeight;
    if (!follow) cam.fitGrid(track);
  }
  window.addEventListener('resize', resize);
  resize();

  // Mouse orbit.
  var drag = null;
  canvas.addEventListener('mousedown', function (e) { drag = { x: e.clientX, y: e.clientY }; canvas.classList.add('dragging'); });
  window.addEventListener('mouseup', function () { drag = null; canvas.classList.remove('dragging'); });
  window.addEventListener('mousemove', function (e) {
    if (!drag) return;
    cam.orbit(e.clientX - drag.x, e.clientY - drag.y);
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    cam.zoom(e.deltaY > 0 ? 1.1 : 0.9);
  }, { passive: false });

  // Touch: one finger orbits, two fingers pinch-zoom.
  var touch = null;
  function touchDist(e) {
    var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    touch = e.touches.length === 2 ? { dist: touchDist(e) } : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: false });
  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!touch) return;
    if (e.touches.length === 2 && touch.dist) {
      var d = touchDist(e);
      cam.zoom(touch.dist / d);
      touch.dist = d;
      return;
    }
    if (touch.x === undefined) return;
    cam.orbit(e.touches[0].clientX - touch.x, e.touches[0].clientY - touch.y);
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: false });
  canvas.addEventListener('touchend', function () { touch = null; });

  window.addEventListener('keydown', function (e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'r') { cam.reset(); cam.fitGrid(track); follow = false; }
    if (e.key === 'n') newTrack();
    if (e.key === ' ') { follow = !follow; if (follow) cam.dist = Math.min(cam.dist, 70); else cam.fitGrid(track); e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

  function applyKeys() {
    var fwd = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    var right = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    if (fwd || right) { cam.pan(fwd, right); follow = false; }
    if (keys.q) cam.raise(-1);
    if (keys.e) cam.raise(1);
  }

  function stepCars(dt) {
    if (startHold > 0) { startHold -= dt; return; }
    cars.forEach(function (c) { Cars.step(c, dt, track); });
    Cars.bump(cars[0], cars[1], track.arc.total);
  }

  var last = performance.now();
  var cycleStart = last;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    applyKeys();
    stepCars(dt);
    Render.setTime((now - cycleStart) / 1000);
    Render.lamps = [];
    if (Render.headlights > 0.01) cars.forEach(function (car) { Render.lamps.push.apply(Render.lamps, Cars.lamps(car, track)); });
    if (follow) {
      var lead = Track.at(track, cars[0].s).pos;
      cam.target = Vec.make(lead.x, lead.y + 1, lead.z);
    }
    var polys = scenery.slice();
    cars.forEach(function (c) { polys.push.apply(polys, Cars.polys(c, track)); });
    Render.draw(ctx, cam, polys);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
