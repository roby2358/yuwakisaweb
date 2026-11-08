// R-28: every command returns an object with a boolean ok; newGame returns { ok:true }.
'use strict';
const { load } = require('../helpers/load');
const { check, done } = require('../helpers/check');
const g = load();
const engine = new g.GameEngine(new g.GameState());
const isRes = r => r && typeof r.ok === 'boolean';
check('newGame', JSON.stringify(engine.newGame(2828)) === '{"ok":true}');
check('plant', isRes(engine.plant()));
check('retrieve', isRes(engine.retrieve()));
check('movePlayer illegal', isRes(engine.movePlayer(9999, 9999)) && engine.movePlayer(9999, 9999).ok === false);
check('endTurn', isRes(engine.endTurn()));
done();
