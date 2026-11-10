// R-10: rotate(q,r) on a Thing with a facing (Belt, Spring, Puller) turns its facing clockwise ((f+5) mod 6) and ticks once. On a
// fixture, an empty hex, or after a win → {ok:false}, unchanged.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, snapshot } = require('../helpers/load');
const { state, engine, put } = flatGame();
for (const kind of ['BELT', 'SPRING', 'PULLER']) {
    state.things = [];
    const t = put(kind, 3, 4, 0);
    const turn = state.turn;
    const res = engine.rotate(3, 4);
    check(`${kind}: E → SE (clockwise), ticked`, res.ok && t.facing === 5 && state.turn === turn + 1);
    engine.rotate(3, 4);
    check(`${kind}: SE → SW`, t.facing === 4);
}
put('WALL', 5, 4);
for (const [label, q, r] of [['a wall', 5, 4], ['an empty hex', 7, 4]]) {
    const before = snapshot(state);
    check(`${label}: ok:false, unchanged`, engine.rotate(q, r).ok === false && snapshot(state) === before);
}
state.gameWon = true;
const before = snapshot(state);
check('after a win: ok:false', engine.rotate(3, 4).ok === false && snapshot(state) === before);
done();
