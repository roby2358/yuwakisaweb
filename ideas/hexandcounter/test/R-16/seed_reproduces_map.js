// R-16: two games generated from the same seed have identical terrain, player, target,
// and enemy positions and colors.
'use strict';
const { newGame, snapshot, terrainSignature, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS.slice(0, 5)) {
    const a = newGame(seed), b = newGame(seed);
    check(`seed ${seed}: same terrain`, terrainSignature(a.state) === terrainSignature(b.state));
    check(`seed ${seed}: same pieces and colors`, snapshot(a.state) === snapshot(b.state));
}
const x = newGame(1), y = newGame(2);
check('different seeds give different maps', terrainSignature(x.state) !== terrainSignature(y.state));
done();
