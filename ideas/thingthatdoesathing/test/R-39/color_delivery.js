// R-39: a target takes only crates of its color: a matching crate that enters it (walking,
// pushed, or crossing it in flight) is delivered, and the target's own `delivered` and the
// board's `delivered` go up by one. Another color's target is solid to a crate on the
// ground; a flight passes over it, but can't come down on it and drops one hex short.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

// flatGame's target is red at (10, 8); a blue one is added at (6, 4) on the middle row.
const twoTargets = () => {
    const ctx = flatGame();
    ctx.state.targets.push({ q: 6, r: 4, color: 'blue', delivered: 0 });
    ctx.crate = (color, q, r) => { const c = ctx.piece('crate', q, r); c.color = color; return c; };
    return ctx;
};
{
    const { state, engine, put, crate } = twoTargets();
    put('BELT', 5, 4, DIR.E); const c = crate('blue', 5, 4);
    engine.wait();
    check('a crate entering its own color target is delivered; that target and the board count it',
        !state.pieces.includes(c) && state.targets[1].delivered === 1 && state.targets[0].delivered === 0 && state.delivered === 1);
}
{
    const { state, engine, put, crate } = twoTargets();
    put('BELT', 5, 4, DIR.E); const c = crate('red', 5, 4);
    const res = engine.wait();
    check('another color\'s target is solid on the ground: the crate stays put',
        state.pieces.includes(c) && c.isAt(5, 4) && state.delivered === 0 && !res.events.some(e => e.id === c.id));
}
{
    const { state, engine, put, crate } = twoTargets();
    put('ROCKET', 0, 4, DIR.E); const c = crate('red', 0, 4);
    engine.wait();
    check('a flight passes over another color\'s target', c.isAt(8, 4) && state.delivered === 0);
}
{
    const { state, engine, put, crate } = twoTargets();
    put('SPRING', 3, 4, DIR.E); const c = crate('red', 3, 4);
    const res = engine.wait();
    const mv = res.events.find(e => e.type === 'move' && e.id === c.id);
    check('a flight that would come down on another color\'s target drops one hex short',
        c.isAt(5, 4) && mv.path.length === 2 && mv.path[1].q === 5);
}
{
    const { state, engine, put, crate } = twoTargets();
    put('ROCKET', 0, 4, DIR.E); const c = crate('blue', 0, 4);
    engine.wait();
    check('a flight crossing its own color target delivers', !state.pieces.includes(c) && state.targets[1].delivered === 1);
}
done();
