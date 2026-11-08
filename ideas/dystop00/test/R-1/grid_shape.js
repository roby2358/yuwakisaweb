// R-1: the map is a MAP_COLS × MAP_ROWS rectangle; each (col,row) once; key "q,r" with
// q = col - floor(row/2), r = row.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');
for (const seed of SEEDS.slice(0, 3)) {
    const { g, state } = newGame(seed);
    const { MAP_COLS, MAP_ROWS } = g.GameArtifacts;
    check(`seed ${seed}: size`, state.hexes.size === MAP_COLS * MAP_ROWS);
    const seen = new Set();
    let ok = true;
    for (const [key, h] of state.hexes) {
        seen.add(h.col + ':' + h.row);
        if (key !== `${h.col - Math.floor(h.row / 2)},${h.row}` || h.q !== h.col - Math.floor(h.row / 2) || h.r !== h.row) ok = false;
    }
    check(`seed ${seed}: each (col,row) once`, seen.size === MAP_COLS * MAP_ROWS);
    check(`seed ${seed}: axial keys`, ok);
}
done();
