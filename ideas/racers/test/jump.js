// Runs the two cars for a while and reports every jump: lip speed, clean or short landing.
// Usage: node test/jump.js [seed] [seconds]
require('./load');

var seed = +(process.argv[2] || 5), seconds = +(process.argv[3] || 120), dt = 1 / 60;
var rnd = Rng.make(seed), track = Track.build(rnd), cars = Cars.field();
var j = track.jump;
console.log('gap m', Math.round(j.land - j.take), 'lip m', j.height, 'slope', j.slope.toFixed(3),
  'clear speed m/s', Math.round(Cars.clearSpeed(j)), 'lap m', Math.round(track.arc.total));
var jumps = [], airborne = [false, false];
for (var t = 0; t < seconds; t += dt) {
  cars.forEach(function (c, i) {
    var wasFlying = airborne[i], v = c.v, s = c.s;
    Cars.step(c, dt, track);
    if (!wasFlying && c.flight) jumps.push({ car: i, lip: Math.round(v), t: t.toFixed(1) });
    if (wasFlying && !c.flight) {
      var last = jumps.filter(function (x) { return x.car === i; }).pop();
      last.landing = Math.round(c.v);
      last.result = c.v / last.lip < 0.5 ? 'SHORT' : 'clean';
    }
    airborne[i] = !!c.flight;
  });
  Cars.bump(cars[0], cars[1], track.arc.total);
}
jumps.forEach(function (x) { console.log('t', x.t, 'car', x.car, 'lip', x.lip, '->', x.landing, x.result); });
