'use strict';
const { newGame, snapshot, terrainSignature, load } = require('../helpers/load');
const { check, done } = require('../helpers/check');

// R-1: the rectangle, its key mapping, and the water edge ring.
const { g, state } = newGame(1);
const A = g.GameArtifacts;
check('hexes.size === MAP_COLS x MAP_ROWS', state.hexes.size === A.MAP_COLS * A.MAP_ROWS);
const seen = new Set();
let keysOk = true, edgesOk = true;
for (const [key, h] of state.hexes) {
    seen.add(h.col + ',' + h.row);
    if (key !== (h.col - Math.floor(h.row / 2)) + ',' + h.row) keysOk = false;
    const ring = h.row === 0 || h.row === A.MAP_ROWS - 1 || h.col === 0 || h.col === A.MAP_COLS - 1;
    if (h.isEdge !== ring || (ring && h.terrain !== A.TERRAIN.WATER)) edgesOk = false;
}
check('each (col,row) appears once', seen.size === state.hexes.size);
check('every key is q,r with q = col - floor(row/2)', keysOk);
check('isEdge is exactly the outer ring and edges are water', edgesOk);
done();
