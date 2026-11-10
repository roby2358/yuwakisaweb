// R-4: the source is in the leftmost placement slice and the target in the rightmost, both
// drawn from passable non-edge hexes sorted by col, slice = max(PLACE_SLICE_MIN,
// floor(PLACE_SLICE_FRAC × passable)).
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, SEEDS } = require('../helpers/load');
for (const seed of SEEDS) {
    const { g, state, engine } = newGame(seed);
    const A = g.GameArtifacts;
    const passable = engine.board.passableHexes().sort((a, b) => a.col - b.col);
    const len = Math.max(A.PLACE_SLICE_MIN, Math.floor(passable.length * A.PLACE_SLICE_FRAC));
    const keys = arr => new Set(arr.map(h => g.Hex.key(h.q, h.r)));
    check(`seed ${seed}: source in left slice`, keys(passable.slice(0, len)).has(g.Hex.key(state.source.q, state.source.r)));
    check(`seed ${seed}: target in right slice`, keys(passable.slice(-len)).has(g.Hex.key(state.target.q, state.target.r)));
}
done();
