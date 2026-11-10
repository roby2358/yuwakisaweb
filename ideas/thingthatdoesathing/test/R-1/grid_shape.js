// R-1: newGame(seed, size) builds cols × rows hexes for that MAP_SIZES row; each (col,row)
// once; key "q,r" with q = col - floor(row/2), r = row. Checked at every size.
'use strict';
const { check, done } = require('../helpers/check');
const { load, newGame, SEEDS } = require('../helpers/load');
const { MAP_SIZES } = load().GameArtifacts;
for (const [size, { cols, rows }] of Object.entries(MAP_SIZES)) {
    for (const seed of SEEDS.slice(0, 3)) {
        const { state } = newGame(seed, size);
        check(`${size} seed ${seed}: ${cols}×${rows} hexes, state.size recorded`,
            state.hexes.size === cols * rows && state.size === size);
        const seen = new Set();
        let ok = true;
        for (const [key, h] of state.hexes) {
            if (key !== h.q + ',' + h.r || h.q !== h.col - Math.floor(h.row / 2) || h.r !== h.row) ok = false;
            seen.add(h.col + ':' + h.row);
        }
        check(`${size} seed ${seed}: keys and offsets match, each (col,row) once`, ok && seen.size === cols * rows);
    }
}
done();
