// R-25: every command returns an object with a boolean ok; newGame returns {ok:true}; every
// ok:true from place/rotate/wait carries an events array.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, flatGame, DIR } = require('../helpers/load');
const { state, engine } = newGame(11);
check('newGame → {ok:true}', engine.newGame(11).ok === true);
const shapes = [];
shapes.push(engine.wait());
const [key] = engine.legalPlacements(state.hand[0]);
const [q, r] = key.split(',').map(Number);
shapes.push(engine.place(0, q, r, DIR.E));
shapes.push(engine.rotate(q, r));
shapes.push(engine.rotate(99, 99));
shapes.push(engine.place(9, 0, 0, 0));
check('every result has a boolean ok', shapes.every(s => typeof s.ok === 'boolean'));
check('every ok:true carries events[]', shapes.filter(s => s.ok).every(s => Array.isArray(s.events)));
check('ok:false carries nothing else', shapes.filter(s => !s.ok).every(s => Object.keys(s).length === 1));
done();
