// R-23: every command returns a result object with a boolean `ok`: newGame → { ok:true };
// movePlayer and endTurn per their own rules (R-9 – R-14, R-21).
'use strict';
const { load } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const g = load();
const engine = new g.GameEngine(new g.GameState());
check('newGame() returns { ok:true }', JSON.stringify(engine.newGame()) === '{"ok":true}');
check('newGame(seed) returns { ok:true }', JSON.stringify(engine.newGame(7)) === '{"ok":true}');
check('endTurn() returns an object with boolean ok', typeof engine.endTurn().ok === 'boolean');
check('movePlayer() returns an object with boolean ok', typeof engine.movePlayer(-999, -999).ok === 'boolean');
done();
