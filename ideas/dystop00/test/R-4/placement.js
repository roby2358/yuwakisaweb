// R-4: @ stands in the leftmost placement slice; the Ministry (stations[0]) in the rightmost
// slice on a non-block hex; PRECINCT_COUNT precincts on non-block passable hexes with
// col ≥ floor(PRECINCT_MIN_COL_FRAC × MAP_COLS), every pair of stations ≥ STATION_SPACING apart.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');
for (const seed of SEEDS.slice(0, 5)) {
    const { g, state, engine } = newGame(seed);
    const A = g.GameArtifacts;
    const passable = engine.board.passableHexes().sort((a, b) => a.col - b.col);
    const slice = Math.max(A.PLACE_SLICE_MIN, Math.floor(passable.length * A.PLACE_SLICE_FRAC));
    const leftCut = passable[slice - 1].col, rightCut = passable[passable.length - slice].col;
    const at = p => state.hexes.get(p.key());
    check(`seed ${seed}: @ in the left slice`, at(state.player).col <= leftCut && engine.board.isPassable(at(state.player)));
    const m = state.stations[0];
    check(`seed ${seed}: Ministry in the right slice, not a block`, at(m).col >= rightCut && !engine.board.isBlock(at(m)) && m.label === 'M');
    const precincts = state.stations.slice(1);
    check(`seed ${seed}: PRECINCT_COUNT precincts`, precincts.length === A.PRECINCT_COUNT);
    const minCol = Math.floor(A.PRECINCT_MIN_COL_FRAC * A.MAP_COLS);
    check(`seed ${seed}: precincts in the right part, passable, not blocks`,
        precincts.every(p => at(p).col >= minCol && engine.board.isPassable(at(p)) && !engine.board.isBlock(at(p)) && !at(p).isEdge));
    let spaced = true;
    for (let i = 0; i < state.stations.length; i++)
        for (let j = i + 1; j < state.stations.length; j++)
            if (new g.Hex(state.stations[i].q, state.stations[i].r).distance(state.stations[j]) < A.STATION_SPACING) spaced = false;
    check(`seed ${seed}: stations spaced`, spaced);
}
done();
