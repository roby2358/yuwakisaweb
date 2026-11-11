// R-42: state.trapped counts every gremlin a Trap caught, however it came onto the Trap
// (pushed, or coming down from a flight); its splat event carries trap: true. Gremlins gone any
// other way (a target, a Rocket, the sea) don't count; a new game starts it at 0.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, flatGame, DIR } = require('../helpers/load');
const trapSplat = (res, g) => res.events.some(e => e.type === 'splat' && e.id === g.id && e.trap === true);
{
    const { state } = newGame(5, 'small');
    check('a new game starts at 0', state.trapped === 0);
}
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E); put('TRAP', 4, 4);
    put('BELT', 3, 6, DIR.E); put('TRAP', 4, 6);
    const g = piece('gremlin', 3, 4); piece('gremlin', 3, 6);
    const res = engine.wait();
    check('two pushed onto Traps in one tick count 2, splat says trap', state.trapped === 2 && trapSplat(res, g));
}
{
    const { state, engine, put, piece } = flatGame();
    put('SPRING', 2, 4, DIR.E); put('TRAP', 5, 4);
    const g = piece('gremlin', 2, 4);
    const res = engine.wait();
    check('a gremlin coming down from a flight onto a Trap counts', state.trapped === 1 && trapSplat(res, g));
}
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 9, 8, DIR.E);
    const g = piece('gremlin', 9, 8);   // pushed onto the red target at (10,8)
    const res = engine.wait();
    check('a gremlin killed on a target does not count; its splat says trap: false',
        state.trapped === 0 && res.events.some(e => e.type === 'splat' && e.id === g.id && e.trap === false));
}
{
    const { state, engine, put, piece } = flatGame();
    put('ROCKET', 0, 4, DIR.E); put('WALL', 9, 4);
    piece('gremlin', 0, 4);
    engine.wait();
    check('a splatted gremlin does not count', state.trapped === 0 && state.exGremlins === 1);
}
done();
