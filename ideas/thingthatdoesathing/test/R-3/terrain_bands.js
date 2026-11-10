// R-3: inner hexes ranked by elevation split at WATER_PCT / MOUNTAIN_PCT into water, plains,
// mountain; ICE is carved only out of the plains band, round(ICE_FRAC × inner) of it.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, SEEDS } = require('../helpers/load');
for (const seed of SEEDS) {
    const { g, state } = newGame(seed, 'small');
    const A = g.GameArtifacts, T = A.TERRAIN;
    const inner = [...state.hexes.values()].filter(h => !h.isEdge).sort((a, b) => a.elevation - b.elevation);
    const n = inner.length;
    let ok = true, ice = 0;
    inner.forEach((h, i) => {
        const p = i / n;
        const band = p < A.WATER_PCT ? [T.WATER] : p < A.MOUNTAIN_PCT ? [T.PLAINS, T.ICE] : [T.MOUNTAIN];
        if (!band.includes(h.terrain)) ok = false;
        if (h.terrain === T.ICE) ice++;
    });
    check(`seed ${seed}: every inner hex is in its band`, ok);
    check(`seed ${seed}: ice count is round(ICE_FRAC × inner)`, ice === Math.round(n * A.ICE_FRAC));
}
done();
