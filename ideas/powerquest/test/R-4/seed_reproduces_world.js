'use strict';
const { newGame, snapshot, terrainSignature, load } = require('../helpers/load');
const { check, done } = require('../helpers/check');

// R-4: the same seed gives the same world, a different seed a different one.
const a = newGame(21), b = newGame(21), c = newGame(22);
check('same seed, same terrain', terrainSignature(a.state) === terrainSignature(b.state));
check('same seed, same state', snapshot(a.state) === snapshot(b.state));
check('different seed, different terrain', terrainSignature(a.state) !== terrainSignature(c.state));
check('state.seed records the seed', a.state.seed === 21);
done();
