// R-6: newGame starts with one source and one target sharing a CRATE_COLORS color, and one
// crate of that color on the source; gremlinDice(size) d GREMLIN_DICE_SIDES
// gremlins (one die per GREMLIN_HEXES_PER_DIE of board area) with #rrggbb colors on distinct passable non-edge hexes, none on source or target;
// no Things; HAND_SIZE cards, all from the starting UNLOCKS step (unlocks 1); turn 1; delivered, lost, spawnTimer 0; unique ids.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, SEEDS } = require('../helpers/load');
for (const seed of SEEDS) {
    const { g, state, engine } = newGame(seed, 'small');
    const A = g.GameArtifacts;
    const crates = state.pieces.filter(p => p.kind === 'crate');
    const grem = state.pieces.filter(p => p.kind === 'gremlin');
    check(`seed ${seed}: one crate, on the source`, crates.length === 1 && crates[0].isAt(state.sources[0].q, state.sources[0].r));
    const color = state.targets[0] && state.targets[0].color;
    check(`seed ${seed}: one source and one target sharing a color, and the crate is that color`,
        state.sources.length === 1 && state.targets.length === 1 && g.GameArtifacts.CRATE_COLORS.includes(color) &&
        state.sources[0].colors.join() === color && crates[0].color === color && state.targets[0].delivered === 0);
    const n = grem.length;
    const dice = A.gremlinDice('small');
    check(`seed ${seed}: gremlin count in dice range (${n})`, n >= dice && n <= dice * A.GREMLIN_DICE_SIDES);
    const keys = state.pieces.map(p => p.key());
    const okPlace = grem.every(p => {
        const h = engine.board.get(p.q, p.r);
        return h && !h.isEdge && engine.board.isPassable(h) && /^#[0-9a-f]{6}$/.test(p.color) && p.label === '👹' &&
            !engine.isEndpoint(p);
    });
    check(`seed ${seed}: gremlins on passable inner hexes, colored, off source/target`, okPlace);
    check(`seed ${seed}: no two pieces share a hex; ids unique`,
        new Set(keys).size === keys.length && new Set(state.pieces.map(p => p.id)).size === keys.length);
    check(`seed ${seed}: empty board, full hand, counters reset`,
        state.things.length === 0 && state.hand.length === A.HAND_SIZE && state.hand.every(card => card.kind in A.THINGS && Object.keys(card).join() === 'kind') &&
        state.turn === 1 && state.delivered === 0 && state.lost === 0 && state.spawnTimer === 0 &&
        state.phase === 'player');
    check(`seed ${seed}: only the starting cards unlocked, and the hand comes from them`,
        state.unlocks === 1 && state.hand.every(card => A.UNLOCKS[0].includes(card.kind)));
}
// Bigger boards roll more dice: one per GREMLIN_HEXES_PER_DIE hexes of area, rounded.
{
    const { g } = newGame(1, 'small');
    const A = g.GameArtifacts;
    for (const size of Object.keys(A.MAP_SIZES)) {
        const { cols, rows } = A.MAP_SIZES[size];
        const want = Math.max(1, Math.round(cols * rows / A.GREMLIN_HEXES_PER_DIE));
        let inRange = true;
        for (const seed of [2, 3, 4]) {
            const n = newGame(seed, size).state.pieces.filter(p => p.kind === 'gremlin').length;
            if (n < want || n > want * A.GREMLIN_DICE_SIDES) inRange = false;
        }
        check(`${size}: ${A.gremlinDice(size)} dice (${cols}×${rows} / ${A.GREMLIN_HEXES_PER_DIE}), counts in range`,
            A.gremlinDice(size) === want && inRange);
    }
}
done();
