// R-4: the player is placed in the leftmost slice of passable non-edge hexes (by col), the
// target in the rightmost slice; slice = max(PLACE_SLICE_MIN, floor(PLACE_SLICE_FRAC × passable)).
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS) {
    const { g, state, engine } = newGame(seed);
    const A = g.GameArtifacts;
    const passable = engine.board.passableHexes().sort((a, b) => a.col - b.col);
    const len = Math.max(A.PLACE_SLICE_MIN, Math.floor(passable.length * A.PLACE_SLICE_FRAC));
    const left = new Set(passable.slice(0, len).map(h => g.Hex.key(h.q, h.r)));
    const right = new Set(passable.slice(-len).map(h => g.Hex.key(h.q, h.r)));
    check(`seed ${seed}: player is in the left placement slice`, left.has(state.player.key()));
    check(`seed ${seed}: target is in the right placement slice`, right.has(state.target.key()));
}
done();
