// R-14: a piece that enters bare ICE keeps going in the same direction, free, until it
// reaches a non-ice hex or is blocked; ice covered by a Thing does not slide. A flying push
// (Spring, Rocket) is airborne: ice under the flight counts toward its range. A Spring that
// comes down on bare ice slides on, and so does a Rocket (D-37).
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); terrain(2, 4, T.ICE); terrain(3, 4, T.ICE);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('slides across three ice to the first plains', c.isAt(4, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); terrain(2, 4, T.ICE); put('WALL', 3, 4);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a slide stops before a wall', c.isAt(2, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); put('BELT', 1, 4, DIR.SE);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('ice under a Thing does not slide', c.isAt(1, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    // Airborne over 0 and 1 (counted), down on ice at 2, then it skids across 3 and 4 to 5.
    put('SPRING', -1, 4, DIR.E); for (let q = 0; q <= 4; q++) terrain(q, 4, T.ICE);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('a Spring counts ice under its throw, then skids on from an ice landing', c.isAt(5, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('SPRING', -1, 4, DIR.E); terrain(0, 4, T.ICE); terrain(1, 4, T.ICE);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('ice under a Spring\'s flight is no shortcut: a plains landing stays put', c.isAt(2, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('SPRING', -1, 4, DIR.E); terrain(2, 4, T.ICE); terrain(3, 4, T.WATER);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('a skid off a Spring landing is on the ground: it slides into a lake and sinks',
        !state.pieces.includes(c) && state.lost === 1);
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('ROCKET', -1, 4, DIR.E); terrain(7, 4, T.ICE); terrain(8, 4, T.ICE);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('a Rocket that comes down on bare ice skids on, too (D-37)', c.isAt(9, 4));
}
done();
