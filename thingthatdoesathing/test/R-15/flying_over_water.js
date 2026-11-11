// R-15: a flying push (Spring, Rocket) passes over inland open water and sinks only if it
// comes down on it; a Belt's push into the same water sinks the piece.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('SPRING', 0, 4, DIR.E); terrain(1, 4, T.WATER); terrain(2, 4, T.WATER);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a Spring flings a crate over a two-hex lake', c.isAt(3, 4) && state.lost === 0);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('SPRING', 0, 4, DIR.E); terrain(3, 4, T.WATER);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a Spring that lands in a lake sinks it', !state.pieces.includes(c) && state.lost === 1);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('SPRING', 0, 4, DIR.E); terrain(1, 4, T.WATER); put('WALL', 2, 4);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a Spring stopped above a lake comes down in it', !state.pieces.includes(c) && state.lost === 1);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('SPRING', 10, 4, DIR.E);   // 11, 12 inland, then the edge at 13
    const c = piece('crate', 10, 4);
    engine.wait();
    check('the outer sea still takes a flung crate', !state.pieces.includes(c) && state.lost === 1);
}
done();
