// R-29: computeAttackable() returns an empty Set and locationAt() returns null (inert hooks).
'use strict';
const { newGame } = require('../helpers/load');
const { check, done } = require('../helpers/check');
const { engine, state } = newGame(2929);
check('computeAttackable empty', engine.computeAttackable().size === 0);
check('locationAt null', engine.locationAt(state.player) === null);
done();
