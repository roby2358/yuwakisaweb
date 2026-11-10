// R-6: newGame starts with one crate on the source; GREMLIN_DICE_COUNT d GREMLIN_DICE_SIDES
// gremlins with #rrggbb colors on distinct passable non-edge hexes, none on source or target;
// no Things; HAND_SIZE cards; turn 1; delivered, lost, spawnTimer 0; unique ids.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, SEEDS } = require('../helpers/load');
for (const seed of SEEDS) {
    const { g, state, engine } = newGame(seed, 'small');
    const A = g.GameArtifacts;
    const crates = state.pieces.filter(p => p.kind === 'crate');
    const grem = state.pieces.filter(p => p.kind === 'gremlin');
    check(`seed ${seed}: one crate, on the source`, crates.length === 1 && crates[0].isAt(state.source.q, state.source.r));
    const n = grem.length;
    check(`seed ${seed}: gremlin count in dice range (${n})`,
        n >= A.GREMLIN_DICE_COUNT && n <= A.GREMLIN_DICE_COUNT * A.GREMLIN_DICE_SIDES);
    const keys = state.pieces.map(p => p.key());
    const okPlace = grem.every(p => {
        const h = engine.board.get(p.q, p.r);
        return h && !h.isEdge && engine.board.isPassable(h) && /^#[0-9a-f]{6}$/.test(p.color) && p.label === '👹' &&
            !p.isAt(state.source.q, state.source.r) && !p.isAt(state.target.q, state.target.r);
    });
    check(`seed ${seed}: gremlins on passable inner hexes, colored, off source/target`, okPlace);
    check(`seed ${seed}: no two pieces share a hex; ids unique`,
        new Set(keys).size === keys.length && new Set(state.pieces.map(p => p.id)).size === keys.length);
    check(`seed ${seed}: empty board, full hand, counters reset`,
        state.things.length === 0 && state.hand.length === A.HAND_SIZE && state.hand.every(k => k in A.THINGS) &&
        state.turn === 1 && state.delivered === 0 && state.lost === 0 && state.spawnTimer === 0 &&
        state.phase === 'player');
}
done();
