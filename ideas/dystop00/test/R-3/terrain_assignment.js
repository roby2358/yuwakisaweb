// R-3: inner hexes by elevation percentile: below CANAL_PCT canal, at/above ARCOLOGY_PCT
// arcology, the rest open. Of the open hexes, the round(BLOCK_FRAC × open) densest are BLOCK;
// of the remainder, round(INDUSTRIAL_FRAC × rest) INDUSTRIAL, round(RUINS_FRAC × rest) RUINS,
// the rest PLAZA.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');
for (const seed of SEEDS.slice(0, 3)) {
    const { g, state } = newGame(seed);
    const A = g.GameArtifacts, T = A.TERRAIN;
    const inner = [...state.hexes.values()].filter(h => !h.isEdge).sort((a, b) => a.elevation - b.elevation);
    const n = inner.length;
    let bandsOk = true;
    const open = [];
    inner.forEach((h, i) => {
        const p = i / n;
        if (p < A.CANAL_PCT) { if (h.terrain !== T.CANAL) bandsOk = false; }
        else if (p >= A.ARCOLOGY_PCT) { if (h.terrain !== T.ARCOLOGY) bandsOk = false; }
        else { open.push(h); if (h.terrain === T.CANAL || h.terrain === T.ARCOLOGY) bandsOk = false; }
    });
    check(`seed ${seed}: elevation bands`, bandsOk);
    const blocks = open.filter(h => h.terrain === T.BLOCK);
    const nBlocks = Math.round(open.length * A.BLOCK_FRAC);
    check(`seed ${seed}: block count`, blocks.length === nBlocks);
    const minBlockDensity = Math.min(...blocks.map(h => h.density));
    check(`seed ${seed}: blocks are the densest open hexes`,
        open.filter(h => h.terrain !== T.BLOCK).every(h => h.density <= minBlockDensity));
    const rest = open.length - nBlocks;
    const count = t => open.filter(h => h.terrain === t).length;
    check(`seed ${seed}: industrial count`, count(T.INDUSTRIAL) === Math.round(rest * A.INDUSTRIAL_FRAC));
    check(`seed ${seed}: ruins count`, count(T.RUINS) === Math.round(rest * A.RUINS_FRAC));
    check(`seed ${seed}: the rest is plaza`, count(T.PLAZA) === rest - count(T.INDUSTRIAL) - count(T.RUINS));
}
done();
