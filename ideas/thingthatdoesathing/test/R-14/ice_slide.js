// R-14: a piece that enters bare ICE keeps going in the same direction, free, until it
// reaches a non-ice hex or is blocked; ice covered by a Thing does not slide.
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
    // A spring's distance doesn't count ice: 1 plains step, 2 ice (free), then 2 more steps.
    put('SPRING', -1, 4, DIR.E); terrain(1, 4, T.ICE); terrain(2, 4, T.ICE);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('ice hexes are free inside a spring push', c.isAt(4, 4));
}
done();
