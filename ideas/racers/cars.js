// Cars: arc-length position s (m), speed v (m/s), lateral offset lat (m, + = left).
// Each car chases its cruise speed but brakes for corners it sees ahead. A slowly drifting
// judgment factor makes it misjudge; exceeding the corner limit triggers a slide.
var Cars = {
  scale: 2.8,        // toy-car proportion so cars read at track scale
  length: 4.4 * 2.8,
  width: 2.2 * 2.8,
  accel: 72,          // m/s^2 toward target speed
  brake: 50,         // m/s^2 when slowing for a corner
  grip: 871,          // corner limit: vmax = sqrt(grip / curvature)
  lookahead: 140,     // m scanned ahead for the tightest upcoming corner
  lookStep: 10,
  slideDecel: 60,    // m/s^2 scrubbed while over the limit
  slideShove: 30,    // outward lateral m/s per second of sliding
  judgeSpread: 0.10, // judgment drifts within roughly +/- this fraction of true limit
  judgeRate: 0.4,    // how quickly judgment wanders (per second)
  bumpLoss: 0.5,     // rear car keeps this fraction of the front car's speed after a bump
  bumpShare: 0.2,    // front car takes this share of the speed difference on a bump
  wallBounce: 0.3,   // fraction of lateral speed kept after hitting the track edge
  shove: 6,          // lateral m/s imparted by a bump
  latSpring: 3,      // pull back toward the lane center
  latDamp: 2.5,

  make: function (s, cruise, lane, paint) {
    return { s: s, v: cruise, cruise: cruise, lane: lane, lat: lane, latV: 0, judge: 1, sliding: false, paint: paint };
  },

  // The two-car starting field.
  field: function () {
    return [
      Cars.make(0, 230, Track.laneOffset, { body: '#e53935', roof: '#1a1a1a' }),
      Cars.make(-20, 252, -Track.laneOffset, { body: '#1e88e5', roof: '#1a1a1a' })
    ];
  },

  limit: function (k) {
    var mag = Math.abs(k);
    return mag < 1e-4 ? Infinity : Math.sqrt(Cars.grip / mag);
  },

  // Slowest corner limit within lookahead distance, as the car perceives it.
  perceivedLimit: function (car, track) {
    var v = Cars.limit(Track.laneCurvature(track, car.s, car.lat));
    for (var d = Cars.lookStep; d <= Cars.lookahead; d += Cars.lookStep) {
      v = Math.min(v, Cars.limit(Track.laneCurvature(track, car.s + d, car.lat)));
    }
    return v * car.judge;
  },

  // Ornstein-Uhlenbeck wander around 1.
  driftJudgment: function (car, dt) {
    var noise = (Math.random() * 2 - 1) * Math.sqrt(dt);
    car.judge += (1 - car.judge) * Cars.judgeRate * dt + noise * Cars.judgeSpread * Math.sqrt(2 * Cars.judgeRate);
  },

  step: function (car, dt, track) {
    Cars.driftJudgment(car, dt);
    var k = Track.laneCurvature(track, car.s, car.lat);
    var target = Math.min(car.cruise, Cars.perceivedLimit(car, track));
    var rate = target < car.v ? Cars.brake : Cars.accel;
    car.v += Math.max(-rate * dt, Math.min(rate * dt, target - car.v));

    car.sliding = car.v > Cars.limit(k);
    if (car.sliding) {
      car.v -= Cars.slideDecel * dt;
      car.latV -= Math.sign(k) * Cars.slideShove * dt;
    }

    car.s += car.v * dt;
    car.latV += ((car.lane - car.lat) * Cars.latSpring - car.latV * Cars.latDamp) * dt;
    car.lat += car.latV * dt;
    var lim = track.width / 2 - Cars.width / 2;
    if (Math.abs(car.lat) > lim) {
      car.lat = Math.sign(car.lat) * lim;
      car.latV = -car.latV * Cars.wallBounce;
    }
  },

  // Signed along-track gap from a to b, wrapped into [-total/2, total/2).
  gap: function (a, b, total) {
    var d = (b.s - a.s) % total;
    if (d < -total / 2) d += total;
    if (d >= total / 2) d -= total;
    return d;
  },

  bump: function (a, b, total) {
    var ds = Cars.gap(a, b, total), dl = b.lat - a.lat;
    if (Math.abs(ds) >= Cars.length || Math.abs(dl) >= Cars.width) return;
    var closing = (a.v - b.v) * Math.sign(ds);
    if (closing > 0) {
      // The rear car eats the hit: it drops well below the front car's speed and has to re-accelerate.
      var rear = ds > 0 ? a : b, front = ds > 0 ? b : a;
      front.v += (rear.v - front.v) * Cars.bumpShare;
      rear.v = front.v * Cars.bumpLoss;
    }
    var overlap = Cars.length - Math.abs(ds);
    a.s -= Math.sign(ds) * overlap / 2;
    b.s += Math.sign(ds) * overlap / 2;
    var dir = dl === 0 ? 1 : Math.sign(dl);
    a.latV -= dir * Cars.shove;
    b.latV += dir * Cars.shove;
  },

  polys: function (car, track) {
    var at = Track.at(track, car.s);
    var pos = Vec.add(at.pos, Vec.scale(at.side, car.lat));
    return Cars.mesh(pos, at.dir, at.side, Cars.scale, car.paint);
  },

  // Low wedge supercar for a given position, heading, side vector and paint colors.
  mesh: function (pos, dir, side, scale, paint) {
    function P(f, s, h) {
      return Vec.add(Vec.add(Vec.add(pos, Vec.scale(dir, f * scale)), Vec.scale(side, s * scale)), Vec.make(0, h * scale, 0));
    }
    function S(f, w, h0, h1) { return { f: f, w: w, h0: h0, h1: h1 }; }
    var glass = '#3a4a5a', tire = '#111';
    var B = function () { return Mesh.box.apply(null, [P].concat([].slice.call(arguments))); };

    var hull = Mesh.loft(P, [
      S(2.5, 0.75, 0.25, 0.35),   // knife-edge nose
      S(1.8, 1.05, 0.22, 0.5),
      S(0.7, 1.15, 0.22, 0.68),   // hood meets windshield
      S(-2.0, 1.15, 0.22, 0.82),  // rear deck kicks up
      S(-2.5, 1.05, 0.3, 0.78)
    ], paint.body);

    var cabin = Mesh.loft(P, [
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
