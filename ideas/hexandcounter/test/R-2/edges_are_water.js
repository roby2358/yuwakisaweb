// R-2: isEdge is true exactly on the rectangle's outer ring, and every edge hex is WATER.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS) {
    const { g, state } = newGame(seed);
    const { MAP_COLS, MAP_ROWS, TERRAIN } = g.GameArtifacts;
    let ring = true, water = true;
    for (const [, h] of state.hexes) {
        const onRing = h.row === 0 || h.row === MAP_ROWS - 1 || h.col === 0 || h.col === MAP_COLS - 1;
        if (h.isEdge !== onRing) ring = false;
        if (h.isEdge && h.terrain !== TERRAIN.WATER) water = false;
    }
    check(`seed ${seed}: isEdge marks exactly the outer ring`, ring);
    check(`seed ${seed}: every edge hex is WATER`, water);
}
done();
