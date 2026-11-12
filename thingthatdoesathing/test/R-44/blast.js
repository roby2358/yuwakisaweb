// R-44: blast(q, r) on a crate removes it, counts it lost, leads the tick's events with its
// splat (by null), leaves Things alone and ticks once. On a gremlin or an empty hex it's
// illegal: {ok:false}, nothing changes, Rando included.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, snapshot, DIR } = require('../helpers/load');
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E);
    const c = piece('crate', 3, 4);
    const turn = state.turn;
    const res = engine.blast(3, 4);
    check('the crate is gone and counts lost', res.ok && !state.pieces.includes(c) && state.lost === 1);
    check('its splat leads the events', JSON.stringify(res.events[0]) === JSON.stringify({ type: 'splat', id: c.id, by: null, trap: false, hop: 0 }));
    check('the Belt under it stays, and one tick ran', state.things.length === 1 && state.turn === turn + 1);
}
{
    const { state, engine, piece, g } = flatGame();
    piece('gremlin', 3, 4);
    for (const [label, q, r] of [['a gremlin', 3, 4], ['an empty hex', 5, 5]]) {
        const before = snapshot(state);
        // Rando untouched: the stream after the call equals a fresh stream from the same seed.
        g.Rando.seed(99); const res = engine.blast(q, r); const next = g.Rando.random();
        g.Rando.seed(99); const expect = g.Rando.random();
        check(`${label} can't be blasted: ok:false, unchanged, Rando untouched`,
            res.ok === false && snapshot(state) === before && next === expect);
    }
}
done();
