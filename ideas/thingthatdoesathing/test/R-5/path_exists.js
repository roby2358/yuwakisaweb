// R-5: after newGame there is a land path from the source to the target.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame } = require('../helpers/load');
let ok = 0;
for (let seed = 1; seed <= 200; seed++) {
    const { state, engine } = newGame(seed * 104729);
    if (engine.board.hasPath(state.source, state.target)) ok++;
}
check(`200 seeds all have a source→target path (${ok})`, ok === 200);
done();
