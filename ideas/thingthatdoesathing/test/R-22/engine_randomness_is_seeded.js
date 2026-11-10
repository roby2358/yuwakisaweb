// R-22 (supporting): all engine randomness goes through Rando; Math.random never appears in
// the engine (the client rolls the seed and passes it to newGame).
'use strict';
const { check, done } = require('../helpers/check');
const { source } = require('../helpers/load');
for (const f of ['gameengine.js', 'board.js', 'piece.js', 'gamestate.js', 'artifacts.js']) {
    const n = (source(f).match(/Math\.random/g) || []).length;
    check(`${f}: Math.random used ${n} time(s)`, n === 0);
}
done();
