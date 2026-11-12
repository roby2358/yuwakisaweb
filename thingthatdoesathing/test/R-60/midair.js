// R-60: lockstep (D-38): two airborne pieces entering the same hex on the same hop, or
// swapping hexes, both crash: gone, their value lost, a splat each naming the other. A flight
// that meets a piece on the ground is only stopped (it comes down), and the ground piece stays.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    // Springs at (2,4) E and (6,4) W: both over (4,4) on hop 2.
    const { state, engine, put, piece } = flatGame();
    put('SPRING', 2, 4, DIR.E); put('SPRING', 6, 4, DIR.W);
    const a = piece('crate', 2, 4), b = piece('crate', 6, 4);
    const { events } = engine.wait();
    const splats = events.filter(e => e.type === 'splat');
    check('two flights into one hex on one hop: both gone, lost +2',
        !state.pieces.includes(a) && !state.pieces.includes(b) && state.lost === 2);
    check('… a splat each, naming the other, on hop 2',
        splats.length === 2 && splats.every(e => e.hop === 2) &&
        splats.some(e => e.id === a.id && e.by === b.id) && splats.some(e => e.id === b.id && e.by === a.id));
}
{
    // Springs at (2,4) E and (5,4) W: over (3,4) and (4,4) after hop 1, swapping on hop 2.
    const { state, engine, put, piece } = flatGame();
    put('SPRING', 2, 4, DIR.E); put('SPRING', 5, 4, DIR.W);
    const a = piece('crate', 2, 4), b = piece('bigcrate', 5, 4);
    engine.wait();
    check('two flights swapping hexes: both gone, each value lost (1 + 10)',
        !state.pieces.includes(a) && !state.pieces.includes(b) && state.lost === 11);
}
{
    const { state, engine, put, piece } = flatGame();
    put('SPRING', 2, 4, DIR.E);
    const a = piece('crate', 2, 4), b = piece('crate', 4, 4);
    const { events } = engine.wait();
    check('a flight meeting a crate on the ground comes down short; the crate stays; nothing lost',
        a.isAt(3, 4) && b.isAt(4, 4) && state.lost === 0 && !events.some(e => e.type === 'splat'));
}
{
    // A flight and a ground push after the same hex on the same hop: no crash, the earlier Thing wins.
    const { state, engine, put, piece } = flatGame();
    put('BELT', 3, 5, DIR.NW); put('SPRING', 2, 4, DIR.E);   // both after (3,4) on hop 1
    const a = piece('crate', 2, 4), b = piece('crate', 3, 5);
    engine.wait();
    check('a flight and a ground mover tie: the earlier-placed Belt wins, the flight never leaves',
        b.isAt(3, 4) && a.isAt(2, 4) && state.lost === 0);
}
{
    // A shot passing over (a Cannon's cleared hexes) never crashes into a flight below it.
    const { state, engine, put, piece } = flatGame();
    put('CANNON', 0, 4, DIR.E); put('SPRING', 2, 5, DIR.NW);   // the Spring throws across (2,4) … (2,2)
    const a = piece('crate', 0, 4), b = piece('crate', 2, 5);
    engine.wait();
    check('a Cannon shot passes over a flight crossing its path', a.isAt(5, 4) && b.isAt(2, 2) && state.lost === 0);
}
done();
