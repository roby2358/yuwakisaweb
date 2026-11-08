// R-5: after newGame, @ has a terrain path to the Ministry (board.hasPath).
'use strict';
const { newGame } = require('../helpers/load');
const { check, done } = require('../helpers/check');
let all = true;
for (let i = 0; i < 40; i++) {
    const { state, engine } = newGame(77 + i * 131);
    if (!engine.board.hasPath(state.player, state.stations[0])) all = false;
}
check('40 seeds: every map connects @ to the Ministry', all);
done();
