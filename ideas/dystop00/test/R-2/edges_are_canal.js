// R-2: isEdge is true exactly on the outer ring, and every edge hex is CANAL.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');
for (const seed of SEEDS.slice(0, 3)) {
    const { g, state } = newGame(seed);
    const { MAP_COLS, MAP_ROWS, TERRAIN } = g.GameArtifacts;
    let ringOk = true, canalOk = true;
    for (const [, h] of state.hexes) {
        const ring = h.row === 0 || h.row === MAP_ROWS - 1 || h.col === 0 || h.col === MAP_COLS - 1;
        if (ring !== h.isEdge) ringOk = false;
        if (h.isEdge && h.terrain !== TERRAIN.CANAL) canalOk = false;
    }
    check(`seed ${seed}: isEdge marks exactly the ring`, ringOk);
    check(`seed ${seed}: every edge is canal`, canalOk);
}
done();
