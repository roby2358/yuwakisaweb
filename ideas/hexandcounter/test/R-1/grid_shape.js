// R-1: the map is a MAP_COLS × MAP_ROWS rectangle of axial hexes keyed "q,r",
// with q = col - floor(row/2) and r = row.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS.slice(0, 3)) {
    const { g, state } = newGame(seed);
    const { MAP_COLS, MAP_ROWS } = g.GameArtifacts;
    check(`seed ${seed}: hex count is MAP_COLS × MAP_ROWS`, state.hexes.size === MAP_COLS * MAP_ROWS);
    let shapeOk = true;
    const cells = new Set();
    for (const [key, h] of state.hexes) {
        if (key !== `${h.q},${h.r}`) shapeOk = false;
        if (h.r !== h.row || h.q !== h.col - Math.floor(h.row / 2)) shapeOk = false;
        if (h.col < 0 || h.col >= MAP_COLS || h.row < 0 || h.row >= MAP_ROWS) shapeOk = false;
        cells.add(h.col + ':' + h.row);
    }
    check(`seed ${seed}: every key and (q,r) matches its (col,row)`, shapeOk);
    check(`seed ${seed}: every (col,row) cell appears once`, cells.size === MAP_COLS * MAP_ROWS);
}
done();
