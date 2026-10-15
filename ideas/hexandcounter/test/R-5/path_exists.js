// R-5: after newGame, the target is reachable from the player over terrain (ignoring pieces).
'use strict';
const { newGame } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const seeds = Array.from({ length: 60 }, (_, i) => i * 104729 + 3);
let bad = [];
for (const seed of seeds) {
    const { state, engine } = newGame(seed);
    if (!engine.board.hasPath(state.player, state.target)) bad.push(seed);
}
check(`player→target path exists for all ${seeds.length} seeds (failing: ${bad.join(',') || 'none'})`, bad.length === 0);
done();
