// R-48: a Slide (THINGS.slides) is slick ground, through the same step as bare ICE: a piece
// that comes onto it on the ground keeps going the same way, free, until it reaches ground
// that isn't slick or is blocked. Built on water it isn't open water: the piece slides over
// it and isn't sunk, but slides into open water beyond and sinks. A Spring that comes down on
// a Slide skids on (D-29); a Rocket doesn't. A piece standing on one isn't moved. No facing.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { engine, put, piece } = flatGame();
    put('BELT', 0, 4, DIR.E); put('SLIDE', 1, 4); put('SLIDE', 2, 4);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('slides across two Slides to the first plains', c.isAt(3, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 2, 4, DIR.E);
    for (const q of [3, 4, 5]) { terrain(q, 4, T.WATER); put('SLIDE', q, 4); }
    const c = piece('crate', 2, 4);
    engine.wait();
    check('slides across a lake on Slides, in one tick, to the far shore', c.isAt(6, 4));
    check('… and nothing is lost', state.pieces.includes(c) && state.lost === 0);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 2, 4, DIR.E); terrain(3, 4, T.WATER); put('SLIDE', 3, 4); terrain(4, 4, T.WATER);
    const c = piece('crate', 2, 4);
    const { events } = engine.wait();
    check('a Slide over water slides the crate on into open water: it sinks (lost +1)',
        !state.pieces.includes(c) && state.lost === 1 && events.some(e => e.type === 'sink' && e.id === c.id));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 2, 4, DIR.E); terrain(3, 4, T.WATER); put('SLIDE', 3, 4); put('WALL', 4, 4);
    const c = piece('crate', 2, 4);
    engine.wait();
    check('blocked by a Wall: the crate stays on the water Slide, not sunk', c.isAt(3, 4) && state.lost === 0);
    engine.wait();
    check('… and stays there on later ticks (a Slide moves nothing standing on it)', c.isAt(3, 4) && state.lost === 0);
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    terrain(1, 4, T.ICE); put('SLIDE', 1, 4); put('BELT', 0, 4, DIR.E);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a Slide on ice still slides (it is the Thing that decides)', c.isAt(2, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('SPRING', -1, 4, DIR.E); put('SLIDE', 2, 4); put('SLIDE', 3, 4);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('a Spring that comes down on a Slide skids on, across the next one', c.isAt(4, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('SPRING', -1, 4, DIR.E); put('SLIDE', 0, 4); put('SLIDE', 1, 4);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('Slides under a Spring\'s flight are no shortcut', c.isAt(2, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('ROCKET', -1, 4, DIR.E); put('SLIDE', 7, 4);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('a Rocket that comes down on a Slide does not skid', c.isAt(7, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('SLIDE', 3, 4);
    const before = piece('crate', 3, 4);
    check('a Slide has no facing: rotate is illegal', engine.rotate(3, 4).ok === false);
    engine.wait();
    check('a crate standing on a Slide stays put', before.isAt(3, 4));
}
{
    const { state, engine, piece, terrain, T } = flatGame();
    terrain(3, 4, T.WATER);
    const slot = 0;
    state.hand[slot] = { kind: 'SLIDE', color: 'white' };
    check('a Slide card places on water', engine.place(slot, 3, 4, 0).ok && engine.thingAt(3, 4).kind === 'SLIDE');
    check('… with no facing', engine.thingAt(3, 4).facing === null);
    const c = piece('crate', 3, 4);
    engine.remove(3, 4);
    check('removing a water Slide sinks the crate on it', !state.pieces.includes(c) && state.lost === 1);
}
done();
