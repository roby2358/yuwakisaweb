// R-17 (supporting): all engine randomness goes through Rando; Math.random appears in the
// engine only to draw the seed itself.
'use strict';
const { source } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const files = ['gameengine.js', 'board.js', 'piece.js', 'gamestate.js', 'artifacts.js'];
for (const f of files) {
    const n = (source(f).match(/Math\.random/g) || []).length;
    const allowed = f === 'gameengine.js' ? 1 : 0;
    check(`${f}: Math.random used ${n} time(s) (allowed ${allowed})`, n === allowed);
}
done();
