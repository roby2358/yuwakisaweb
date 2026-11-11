// R-36: state.exGremlins counts every gremlin gone except those a Trap caught (R-42): sunk,
// splatted by a Rocket, killed on a target, or sunk when its Bridge is removed. Crates never
// count; a new game starts it at 0.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, flatGame, DIR } = require('../helpers/load');
{
    const { state } = newGame(5, 'small');
    check('a new game starts at 0', state.exGremlins === 0);
}
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E); put('TRAP', 4, 4);
    put('BELT', 3, 6, DIR.E); put('TRAP', 4, 6);
    piece('gremlin', 3, 4); piece('gremlin', 3, 6);
    engine.wait();
    check('trapped gremlins do not count', state.exGremlins === 0);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 3, 4, DIR.E); terrain(4, 4, T.WATER);
    piece('gremlin', 3, 4);
    engine.wait();
    check('a sunk gremlin counts', state.exGremlins === 1);
}
{
    const { state, engine, put, piece } = flatGame();
    put('ROCKET', 0, 4, DIR.E); put('WALL', 9, 4);
    piece('gremlin', 0, 4);
    engine.wait();
    check('a splatted gremlin counts', state.exGremlins === 1);
}
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 9, 8, DIR.E);
    piece('gremlin', 9, 8);   // pushed onto the red target at (10,8)
    engine.wait();
    check('a gremlin killed on a target counts', state.exGremlins === 1);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    terrain(4, 4, T.WATER); put('BRIDGE', 4, 4);
    piece('gremlin', 4, 4);
    engine.remove(4, 4);
    check('a gremlin sunk by removing its Bridge counts', state.exGremlins === 1);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 3, 4, DIR.E); terrain(4, 4, T.WATER);
    piece('crate', 3, 4);
    engine.wait();
    check('a sunk crate does not count', state.exGremlins === 0 && state.lost === 1);
}
done();
