// R-5: after newGame there is a land path from the source to the target, at every size.
'use strict';
const { check, done } = require('../helpers/check');
const { load, newGame } = require('../helpers/load');
const { MAP_SIZES } = load().GameArtifacts;
const RUNS = { small: 200, medium: 60, large: 30, huge: 10 };
for (const size of Object.keys(MAP_SIZES)) {
    let ok = 0;
    for (let seed = 1; seed <= RUNS[size]; seed++) {
        const { state, engine } = newGame(seed * 104729, size);
        if (engine.board.hasPath(state.sources[0], state.targets[0])) ok++;
    }
    check(`${size}: ${RUNS[size]} seeds all have a source→target path (${ok})`, ok === RUNS[size]);
}
done();
