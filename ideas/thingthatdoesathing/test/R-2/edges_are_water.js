// R-2: isEdge is true exactly on the outer ring, and every edge hex is WATER.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, SEEDS } = require('../helpers/load');
for (const seed of SEEDS.slice(0, 5)) {
    const { g, state } = newGame(seed);
    const { MAP_COLS, MAP_ROWS, TERRAIN } = g.GameArtifacts;
    let ok = true;
    for (const [, h] of state.hexes) {
        const ring = h.row === 0 || h.row === MAP_ROWS - 1 || h.col === 0 || h.col === MAP_COLS - 1;
        if (h.isEdge !== ring || (ring && h.terrain !== TERRAIN.WATER)) ok = false;
    }
    check(`seed ${seed}: ring is edge and water`, ok);
}
done();
