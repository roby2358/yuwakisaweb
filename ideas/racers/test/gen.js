// Sweeps track generation over seeds and reports rejection reasons and corner stats.
// Usage: node test/gen.js [seeds]
require('./load');

var seeds = +(process.argv[2] || 40), why = {}, slow = [], laps = [], fails = 0;
function count(k) { why[k] = (why[k] || 0) + 1; }
for (var seed = 1; seed <= seeds; seed++) {
  var rnd = Rng.make(seed), ok = false;
  for (var a = 0; a < Track.attempts && !ok; a++) {
    var got = Track.attempt(rnd);
    if (got.reject) { count(got.reject); continue; }
    var kmax = Math.max.apply(null, got.track.curv.map(Math.abs));
    ok = true; slow.push(Math.round(Math.sqrt(Cars.grip / kmax))); laps.push(Math.round(got.track.arc.total)); count('ok@' + (a + 1));
  }
  if (!ok) fails++;
}
console.log('seeds', seeds, 'fails', fails);
console.log('rejections', why);
if (slow.length) console.log('slowest corner m/s', Math.min.apply(null, slow), '-', Math.max.apply(null, slow), 'lap m', Math.min.apply(null, laps), '-', Math.max.apply(null, laps));
