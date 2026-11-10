// R-11: wait() ticks once and changes no Thing or hand; after a win → {ok:false}, unchanged.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, snapshot } = require('../helpers/load');
const { state, engine, put } = flatGame();
put('WALL', 5, 4);
const hand = JSON.stringify(state.hand), things = JSON.stringify(state.things), turn = state.turn;
const res = engine.wait();
check('ticked once, hand and Things untouched',
    res.ok && state.turn === turn + 1 && JSON.stringify(state.hand) === hand && JSON.stringify(state.things) === things);
done();
