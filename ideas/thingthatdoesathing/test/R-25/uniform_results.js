// R-25: every command returns an object with a boolean ok; newGame returns {ok:true} for a
// seed and a MAP_SIZES key and {ok:false} (state untouched) without either; every ok:true from place/rotate/wait
// carries an events array (remove and discard included).
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, DIR, snapshot } = require('../helpers/load');
const { state, engine } = newGame(11, 'small');
check('newGame → {ok:true}', engine.newGame(11, 'small').ok === true);
const fresh = snapshot(state);
check('newGame with no seed → {ok:false}, unchanged',
    [undefined, null, -1, 1.5].every(seed => engine.newGame(seed, 'small').ok === false) && snapshot(state) === fresh);
check('newGame with no or unknown size → {ok:false}, unchanged',
    [undefined, null, 'giant', 'toString'].every(size => engine.newGame(11, size).ok === false) && snapshot(state) === fresh);
const shapes = [];
shapes.push(engine.wait());
const [key] = engine.legalPlacements(state.hand[0]);
const [q, r] = key.split(',').map(Number);
shapes.push(engine.place(0, q, r, DIR.E));
shapes.push(engine.rotate(q, r));
shapes.push(engine.remove(q, r));
shapes.push(engine.discard(1));
shapes.push(engine.discard(9));
shapes.push(engine.rotate(99, 99));
shapes.push(engine.remove(99, 99));
shapes.push(engine.place(9, 0, 0, 0));
check('every result has a boolean ok', shapes.every(s => typeof s.ok === 'boolean'));
check('every ok:true carries events[]', shapes.filter(s => s.ok).every(s => Array.isArray(s.events)));
check('ok:false carries nothing else', shapes.filter(s => !s.ok).every(s => Object.keys(s).length === 1));
done();
