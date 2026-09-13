// Cars: arc-length position s (m), speed v (m/s), lateral offset lat (m, + = left).
// Each car chases its cruise speed but brakes for corners it sees ahead. A slowly drifting
// judgment factor makes it misjudge; exceeding the corner limit triggers a slide.
var Cars = {
  scale: 2.8,        // toy-car proportion so cars read at track scale
  length: 4.4 * 2.8,
  width: 2.2 * 2.8,
  accel: 60,          // m/s^2 toward target speed
  brake: 50,         // m/s^2 when slowing for a corner
  grip: 420,          // corner limit: vmax = sqrt(grip / curvature)
  lookahead: 140,     // m scanned ahead for the tightest upcoming corner
  lookStep: 10,
  slideDecel: 60,    // m/s^2 scrubbed while over the limit
  slideShove: 3,     // outward lateral m/s per second of sliding
  judgeSpread: 0.10, // judgment drifts within roughly +/- this fraction of true limit
  judgeRate: 0.4,    // how quickly judgment wanders (per second)
  bumpLoss: 0.5,     // rear car keeps this fraction of the front car's speed after a bump
  shove: 6,          // lateral m/s imparted by a bump
  latSpring: 3,      // pull back toward the lane center
  latDamp: 2.5,

  make: function (s, cruise, lane, paint) {
    return { s: s, v: cruise, cruise: cruise, lane: lane, lat: lane, latV: 0, judge: 1, sliding: false, paint: paint };
  },

  limit: function (k) {
    var mag = Math.abs(k);
    return mag < 1e-4 ? Infinity : Math.sqrt(Cars.grip / mag);
  },

  // Slowest corner limit within lookahead distance, as the car perceives it.
  perceivedLimit: function (car, geom) {
    var v = Cars.limit(Track.laneCurvature(geom, car.s, car.lat));
    for (var d = Cars.lookStep; d <= Cars.lookahead; d += Cars.lookStep) {
      v = Math.min(v, Cars.limit(Track.laneCurvature(geom, car.s + d, car.lat)));
    }
    return v * car.judge;
  },

  // Ornstein-Uhlenbeck wander around 1.
  driftJudgment: function (car, dt) {
    var noise = (Math.random() * 2 - 1) * Math.sqrt(dt);
    car.judge += (1 - car.judge) * Cars.judgeRate * dt + noise * Cars.judgeSpread * Math.sqrt(2 * Cars.judgeRate);
  },

  step: function (car, dt, geom, halfWidth) {
    Cars.driftJudgment(car, dt);
    var k = Track.laneCurvature(geom, car.s, car.lat);
    var target = Math.min(car.cruise, Cars.perceivedLimit(car, geom));
    var rate = target < car.v ? Cars.brake : Cars.accel;
    car.v += Math.max(-rate * dt, Math.min(rate * dt, target - car.v));

    car.sliding = car.v > Cars.limit(k);
    if (car.sliding) {
      car.v -= Cars.slideDecel * dt;
      car.latV -= Math.sign(k) * Cars.slideShove * dt * 10;
    }

    car.s += car.v * dt;
    car.latV += ((car.lane - car.lat) * Cars.latSpring - car.latV * Cars.latDamp) * dt;
    car.lat += car.latV * dt;
    var lim = halfWidth - Cars.width / 2;
    if (Math.abs(car.lat) > lim) {
      car.lat = Math.sign(car.lat) * lim;
      car.latV = -car.latV * 0.3;
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
      front.v += (rear.v - front.v) * 0.2;
      rear.v = front.v * Cars.bumpLoss;
    }
    var overlap = Cars.length - Math.abs(ds);
    a.s -= Math.sign(ds) * overlap / 2;
    b.s += Math.sign(ds) * overlap / 2;
    var dir = dl === 0 ? 1 : Math.sign(dl);
    a.latV -= dir * Cars.shove;
    b.latV += dir * Cars.shove;
  },

  polys: function (car, geom) {
    var at = Track.at(geom, car.s);
    var pos = Vec.add(at.pos, Vec.scale(at.side, car.lat));
    return Scene.carPolys(pos, at.dir, at.side, Cars.scale, car.paint);
  }
};
