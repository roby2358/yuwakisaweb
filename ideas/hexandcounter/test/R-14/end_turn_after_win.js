// R-14: endTurn() after a win returns { ok:false } and changes nothing.
'use strict';
const { newGame, snapshot } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const { state, engine } = newGame(2024);
state.player.moveTo(state.target.q, state.target.r);
state.gameWon = true;
const before = snapshot(state);
const res = engine.endTurn();
check('{ ok:false }', JSON.stringify(res) === '{"ok":false}');
check('state unchanged', snapshot(state) === before);
done();
