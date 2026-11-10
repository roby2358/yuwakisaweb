// R-20: the tick that brings delivered to DELIVER_GOAL sets gameWon and returns
// {ok:true, won:true}; every command afterward returns {ok:false} and changes nothing.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, snapshot, DIR } = require('../helpers/load');
const { g, state, engine, put, piece } = flatGame();
const goal = g.GameArtifacts.DELIVER_GOAL;
state.delivered = goal - 1;
put('BELT', 9, 8, DIR.E); piece('crate', 9, 8);
let res = engine.wait();
check('won on the delivering tick', res.ok && res.won === true && state.gameWon && state.delivered === goal);
const before = snapshot(state);
check('wait refused', engine.wait().ok === false);
check('rotate refused', engine.rotate(9, 8).ok === false);
state.hand[0] = 'BELT';
const before2 = snapshot(state);
check('place refused', engine.place(0, 3, 4, 0).ok === false);
check('nothing changed', snapshot(state) === before2);
{
    const { state, engine } = flatGame();
    state.delivered = 0;
    check('an ordinary tick has no won flag', engine.wait().won === undefined && !state.gameWon);
}
done();
