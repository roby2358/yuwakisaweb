// R-21: two games from the same seed have identical terrain, source, target, pieces and
// hand; different seeds give different maps.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, snapshot, terrainSignature, SEEDS } = require('../helpers/load');
for (const seed of SEEDS.slice(0, 5)) {
    const a = newGame(seed, 'small'), b = newGame(seed, 'small');
    check(`seed ${seed}: identical game`,
        terrainSignature(a.state) === terrainSignature(b.state) && snapshot(a.state) === snapshot(b.state));
}
const sigs = new Set(SEEDS.map(s => terrainSignature(newGame(s, 'small').state)));
check(`${SEEDS.length} seeds give ${sigs.size} distinct maps`, sigs.size === SEEDS.length);
done();
