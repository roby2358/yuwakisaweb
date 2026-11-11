// R-12: in a tick, a piece on a mover is pushed THINGS[kind].push hexes in its facing, one
// step at a time, stopping early before a blocked hex.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { g, engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E); const c = piece('crate', 3, 4);
    engine.wait();
    check('belt: one hex east', c.isAt(4, 4));
}
{
    const { g, engine, put, piece } = flatGame();
    const n = g.GameArtifacts.THINGS.SPRING.push;
    put('SPRING', 0, 4, DIR.E); const c = piece('crate', 0, 4);
    engine.wait();
    check(`spring: SPRING.push (${n}) hexes east`, c.isAt(0 + n, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('SPRING', 0, 4, DIR.E); const c = piece('crate', 0, 4); put('WALL', 2, 4);
    engine.wait();
    check('spring stops before a wall', c.isAt(1, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.SE); const c = piece('crate', 3, 4);
    engine.wait();
    check('belt facing SE moves (0,+1)', c.isAt(3, 5));
}
{
    const { engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E); const c = piece('crate', 3, 4); piece('crate', 4, 4);
    engine.wait();
    check('a belt cannot push into another piece', c.isAt(3, 4));
}
done();
