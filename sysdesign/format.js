// LOAD BEARING — Fmt: how numbers become words, in one place.
//
// Everything that renders (the canvas scene, the DOM panels, the guru, the
// headless probe dump) shows the same handful of quantities: request rates,
// percentages, dollars, milliseconds, durations. They were being formatted
// independently in each renderer, which is how "15.0k req/s" ended up next to
// "15k req/s" on the same screen.
//
// level() is here for the same reason. "Is 82% CPU bad?" is a game-design
// judgement, not a rendering detail — the thresholds themselves live in
// Content.BANDS; this just applies them. Every gauge in the game asks the
// question the same way and gets the answer from the same table.
//
// `var`, not `const`/`class`: these load as classic scripts into one shared
// global scope. See flourish.js for the collision this avoids.
var Fmt = (() => {
  // Magnitude-scaled counts: 940 · 1.2k · 15k · 1.2M · 12M. Decimals are
  // dropped above 10× a magnitude because at that size they are noise.
  function count(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k';
    return Math.round(n).toString();
  }

  const rate = n => count(n) + '/s';
  const money = n => '$' + count(n);
  const moneyRate = n => '$' + count(n) + '/s';
  // exact dollars — for run-rates, where $8.5/s vs $9/s is the decision
  const dollars = n => '$' + n.toFixed(1);
  const pct = x => Math.round(100 * x) + '%';
  const pct1 = x => (100 * x).toFixed(1) + '%';
  const ms = n => n.toFixed(0) + 'ms';
  const ratio = (a, b) => count(a) + ' / ' + count(b);

  function dur(secs) {
    const m = Math.floor(secs / 60), s = Math.round(secs % 60);
    return m > 0 ? m + 'm ' + s + 's' : s + 's';
  }

  // Classify a reading against a band from Content.BANDS → 'good'|'warn'|'bad'.
  // Direction is inferred: if bad > warn the metric is worse when high (CPU,
  // error rate); if bad < warn it is worse when low (hit rate, reputation).
  // One function, so no gauge can quietly disagree with another about which
  // side of a number is the bad side.
  function level(value, band) {
    const worseWhenHigh = band.bad > band.warn;
    const past = threshold => worseWhenHigh ? value >= threshold : value <= threshold;
    if (past(band.bad)) return 'bad';
    if (past(band.warn)) return 'warn';
    return 'good';
  }

  return { count, rate, money, moneyRate, dollars, pct, pct1, ms, ratio, dur, level };
})();

if (typeof module !== 'undefined') module.exports = Fmt;
