// R-3: terrain follows the Assign-terrain rule. Inner hexes, ranked by elevation, fall into
// bands split at WATER_PCT / HILLS_PCT / MOUNTAIN_PCT. FOREST and SCRUB are carved only out
// of the plains band, ROUGH only out of the hills band, in the counts the constants give.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS) {
    const { g, state } = newGame(seed);
    const A = g.GameArtifacts, T = A.TERRAIN;

    // Re-derive each inner hex's band exactly as the rule ranks them (stable sort, Map order).
    const inner = [...state.hexes.values()].filter(h => !h.isEdge);
    inner.sort((a, b) => a.elevation - b.elevation);
    const n = inner.length;
    const band = pct => pct < A.WATER_PCT ? T.WATER
        : pct < A.HILLS_PCT ? T.PLAINS
        : pct < A.MOUNTAIN_PCT ? T.HILLS : T.MOUNTAIN;

    const allowed = {
        [T.WATER]: [T.WATER], [T.MOUNTAIN]: [T.MOUNTAIN],
        [T.PLAINS]: [T.PLAINS, T.FOREST, T.SCRUB], [T.HILLS]: [T.HILLS, T.ROUGH]
    };
    let bandsOk = true;
    const count = {}, bandCount = {};
    inner.forEach((h, i) => {
        const b = band(i / n);
        if (!allowed[b].includes(h.terrain)) bandsOk = false;
        count[h.terrain] = (count[h.terrain] || 0) + 1;
        bandCount[b] = (bandCount[b] || 0) + 1;
    });
    check(`seed ${seed}: every inner hex's terrain is allowed by its elevation band`, bandsOk);

    const plainsBand = bandCount[T.PLAINS] || 0, hillsBand = bandCount[T.HILLS] || 0;
    const forest = Math.min(plainsBand, Math.round(n * A.FOREST_FRAC));
    const scrub = Math.min(plainsBand - forest, Math.max(A.SCRUB_MIN, Math.round(n * A.SCRUB_FRAC)));
    const rough = Math.min(hillsBand, Math.max(A.ROUGH_MIN, Math.round(n * A.ROUGH_FRAC)));
    check(`seed ${seed}: FOREST count = round(n × FOREST_FRAC)`, (count[T.FOREST] || 0) === forest);
    check(`seed ${seed}: SCRUB count = max(SCRUB_MIN, round(n × SCRUB_FRAC))`, (count[T.SCRUB] || 0) === scrub);
    check(`seed ${seed}: ROUGH count = max(ROUGH_MIN, round(n × ROUGH_FRAC))`, (count[T.ROUGH] || 0) === rough);
}
done();
