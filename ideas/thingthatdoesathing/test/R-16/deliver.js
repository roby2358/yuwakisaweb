// R-16: a crate that enters the target is removed and delivered +1; a gremlin that enters
// the target stays there, and a crate can't enter while it does.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 9, 8, DIR.E); piece('crate', 9, 8);
    engine.wait();
    check('crate delivered: removed, delivered +1', state.pieces.length === 0 && state.delivered === 1);
}
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 9, 8, DIR.E); const gr = piece('gremlin', 9, 8);
    engine.wait();
    check('gremlin on the target stays a piece', state.pieces.includes(gr) && gr.isAt(10, 8) && state.delivered === 0);
}
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 9, 8, DIR.E); const c = piece('crate', 9, 8);
    const gr = piece('gremlin', 10, 8);
    // Pin the gremlin in place by walling every other neighbor of the target.
    for (const [q, r] of [[11, 8], [11, 7], [10, 7], [9, 9], [10, 9]]) put('WALL', q, r);
    engine.wait();
    check('a gremlin on the target blocks the crate', c.isAt(9, 8) && gr.isAt(10, 8) && state.delivered === 0);
}
done();
