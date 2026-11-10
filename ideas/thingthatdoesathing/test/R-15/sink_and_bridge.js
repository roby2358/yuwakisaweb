// R-15: a piece that enters water with no Thing on it is removed (a crate also counts
// toward lost); water with a bridge carries it like land.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 3, 4, DIR.E); terrain(4, 4, T.WATER);
    piece('crate', 3, 4);
    engine.wait();
    check('crate sank: removed, lost +1', state.pieces.length === 0 && state.lost === 1);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 3, 4, DIR.E); terrain(4, 4, T.WATER);
    piece('gremlin', 3, 4);
    engine.wait();
    check('gremlin sank: removed, lost unchanged', state.pieces.length === 0 && state.lost === 0);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 3, 4, DIR.E); terrain(4, 4, T.WATER); put('BRIDGE', 4, 4);
    const c = piece('crate', 3, 4);
    engine.wait();
    check('a bridge carries the crate', state.pieces.includes(c) && c.isAt(4, 4) && state.lost === 0);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); terrain(2, 4, T.WATER);
    piece('crate', 0, 4);
    engine.wait();
    check('ice slides a crate into water and it sinks', state.pieces.length === 0 && state.lost === 1);
}
done();
