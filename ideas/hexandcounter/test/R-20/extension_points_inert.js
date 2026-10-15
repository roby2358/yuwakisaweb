// R-20: the optional-layer extension points are inert: computeAttackable() is an empty Set
// and locationAt(hex) is null.
'use strict';
const { newGame } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const { state, engine } = newGame(99);
const att = engine.computeAttackable();
check('computeAttackable() returns an empty Set', att instanceof Set || att.constructor.name === 'Set');
check('computeAttackable() is empty', att.size === 0);
check('locationAt(player) is null', engine.locationAt(state.player) === null);
check('locationAt(target) is null', engine.locationAt(state.target) === null);
done();
