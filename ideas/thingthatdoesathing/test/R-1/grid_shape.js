// R-1: newGame builds MAP_COLS × MAP_ROWS hexes; each (col,row) once; key "q,r" with
// q = col - floor(row/2), r = row.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, SEEDS } = require('../helpers/load');
for (const seed of SEEDS.slice(0, 5)) {
    const { g, state } = newGame(seed);
    const { MAP_COLS, MAP_ROWS } = g.GameArtifacts;
    check(`seed ${seed}: ${MAP_COLS}×${MAP_ROWS} hexes`, state.hexes.size === MAP_COLS * MAP_ROWS);
    const seen = new Set();
    let ok = true;
    for (const [key, h] of state.hexes) {
        if (key !== h.q + ',' + h.r || h.q !== h.col - Math.floor(h.row / 2) || h.r !== h.row) ok = false;
        seen.add(h.col + ':' + h.row);
    }
    check(`seed ${seed}: keys and offsets match, each (col,row) once`, ok && seen.size === MAP_COLS * MAP_ROWS);
}
done();
