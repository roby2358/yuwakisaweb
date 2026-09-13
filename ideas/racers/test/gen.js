// Sweeps track generation over seeds and reports rejection reasons and corner stats.
// Usage: node test/gen.js [seeds]
var fs = require('fs'), path = require('path');
var names = { vec: 'Vec', track: 'Track' };
for (var f in names) eval(fs.readFileSync(path.join(__dirname, '..', f + '.js'), 'utf8') + ';global.' + names[f] + '=' + names[f]);
function rng(s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

var seeds = +(process.argv[2] || 40), why = {}, slow = [], laps = [], fails = 0;
function count(k) { why[k] = (why[k] || 0) + 1; }
for (var seed = 1; seed <= seeds; seed++) {
  var rnd = rng(seed), ok = false;
  for (var a = 0; a < 3000 && !ok; a++) {
    var cp = Track.randomControlPoints(rnd);
    if (!Track.turnsOk(cp)) { count('turn'); continue; }
    var c = Track.centerline(cp), arc = Track.arcLength(c);
    var kmax = Math.max.apply(null, Track.curvature(c).map(Math.abs));
    if (kmax > 1 / Track.minTurnRadius) { count('curvature'); continue; }
    var cr = Track.crossings(c, arc);
    if (cr.length !== 1) { count('crossings=' + cr.length); continue; }
    if (cr.some(function (x) { return x.angle < Track.minCrossAngle; })) { count('crossAngle'); continue; }
    Track.elevate(c, arc, cr);
    if (!Track.clearanceOk(c, arc)) { count('clearance'); continue; }
    ok = true; slow.push(Math.round(Math.sqrt(420 * 1 / kmax))); laps.push(Math.round(arc.total)); count('ok@' + (a + 1));
  }
  if (!ok) fails++;
}
console.log('seeds', seeds, 'fails', fails);
console.log('rejections', why);
if (slow.length) console.log('slowest corner m/s', Math.min.apply(null, slow), '-', Math.max.apply(null, slow), 'lap m', Math.min.apply(null, laps), '-', Math.max.apply(null, laps));
