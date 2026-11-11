// R-46: a Bridge pushes the piece on it THINGS.BRIDGE.push hexes along its facing, on the
// ground, through the same step as a Belt: onto land, onto the next Bridge, blocked by a
// Wall, into open water (it sinks). A piece that came onto it this tick waits for the next
// (each piece moves at most once, R-13), and it carries gremlins too.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
const water = (terrain, T, ...qs) => qs.forEach(q => terrain(q, 4, T.WATER));
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    water(terrain, T, 4, 5, 6);
    put('BRIDGE', 4, 4, DIR.E); put('BRIDGE', 5, 4, DIR.E); put('BRIDGE', 6, 4, DIR.E);
    const c = piece('crate', 4, 4);
    for (let t = 1; t <= 3; t++) { engine.wait(); check(`tick ${t}: crate carried to q=${4 + t}`, c.isAt(4 + t, 4)); }
    check('lands on the far shore, nothing lost', state.pieces.includes(c) && state.lost === 0);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    water(terrain, T, 4, 5);
    put('BRIDGE', 4, 4, DIR.E);
    const c = piece('crate', 4, 4);
    engine.wait();
    check('a Bridge facing open water sinks the crate (lost +1)', !state.pieces.includes(c) && state.lost === 1);
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    water(terrain, T, 4);
    put('BRIDGE', 4, 4, DIR.E); put('WALL', 5, 4);
    const c = piece('crate', 4, 4);
    engine.wait();
    check('blocked by a Wall: the crate stays on the Bridge', c.isAt(4, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    water(terrain, T, 4);
    put('BRIDGE', 4, 4, DIR.E);   // placed first: acts first, on an empty hex
    put('BELT', 3, 4, DIR.E);
    const c = piece('crate', 3, 4);
    engine.wait();
    check('a crate the Belt pushed onto the Bridge waits there this tick', c.isAt(4, 4));
    engine.wait();
    check('… and the Bridge carries it on the next', c.isAt(5, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    water(terrain, T, 4);
    put('BRIDGE', 4, 4, DIR.NE);
    const gr = piece('gremlin', 4, 4);
    engine.wait();
    check('it carries a gremlin along its facing (no wander)', gr.isAt(5, 3));
}
done();
