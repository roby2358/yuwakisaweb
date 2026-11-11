// R-2: isEdge is true exactly on the outer ring, and every edge hex is WATER, at every size.
'use strict';
const { check, done } = require('../helpers/check');
const { load, newGame, SEEDS } = require('../helpers/load');
const { MAP_SIZES, TERRAIN } = load().GameArtifacts;
for (const [size, { cols, rows }] of Object.entries(MAP_SIZES)) {
    for (const seed of SEEDS.slice(0, 3)) {
        const { state } = newGame(seed, size);
        let ok = true;
        for (const [, h] of state.hexes) {
            const ring = h.row === 0 || h.row === rows - 1 || h.col === 0 || h.col === cols - 1;
            if (h.isEdge !== ring || (ring && h.terrain !== TERRAIN.WATER)) ok = false;
        }
        check(`${size} seed ${seed}: ring is edge and water`, ok);
    }
}
done();
