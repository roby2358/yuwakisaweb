// R-35: a Trap kills a piece that splats (a gremlin) when it comes onto the Trap's hex:
// walked, pushed, slid on ice, or coming down from a flight. The kill is a splat with by null.
// A flight passing over doesn't trigger it, a Thing built under a gremlin doesn't, and crates
// are safe.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
// Walls on every side of (5,4) but `open` (a direction index, or -1 for none).
const BOX = [[6, 4], [6, 3], [5, 3], [4, 4], [4, 5], [5, 5]];
const box = (put, open) => BOX.forEach(([q, r], dir) => { if (dir !== open) put('WALL', q, r); });
const killed = (state, res, g) => !state.pieces.includes(g) &&
    res.events.some(e => e.type === 'splat' && e.id === g.id && e.by === null);
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 0, 4, DIR.E); put('TRAP', 1, 4);
    const g = piece('gremlin', 0, 4);
    const res = engine.wait();
    const mv = res.events.findIndex(e => e.type === 'move' && e.id === g.id);
    const sp = res.events.findIndex(e => e.type === 'splat' && e.id === g.id);
    check('a gremlin pushed onto a Trap dies: move, then splat', killed(state, res, g) && mv >= 0 && sp > mv);
}
{
    const { state, engine, put, piece } = flatGame();
    box(put, DIR.E); put('TRAP', 6, 4);
    const g = piece('gremlin', 5, 4);   // its only way out is onto the Trap
    const res = engine.wait();
    check('a gremlin that wanders onto a Trap dies', killed(state, res, g));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); put('TRAP', 2, 4);
    const g = piece('gremlin', 0, 4);
    const res = engine.wait();
    check('a gremlin sliding on ice onto a Trap dies', killed(state, res, g));
}
{
    const { state, engine, put, piece } = flatGame();
    put('SPRING', 0, 4, DIR.E); put('TRAP', 3, 4);
    const g = piece('gremlin', 0, 4);
    const res = engine.wait();
    check('a gremlin coming down on a Trap dies', killed(state, res, g));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('SPRING', 0, 4, DIR.E); terrain(3, 4, T.ICE); put('TRAP', 4, 4);
    const g = piece('gremlin', 0, 4);
    const res = engine.wait();
    check('a gremlin skidding off a Spring onto a Trap dies', killed(state, res, g));
}
{
    const { state, engine, put, piece } = flatGame();
    put('SPRING', 0, 4, DIR.E); put('TRAP', 1, 4); put('TRAP', 2, 4);
    const g = piece('gremlin', 0, 4);
    engine.wait();
    check('a gremlin flying over Traps lands alive', state.pieces.includes(g) && g.isAt(3, 4));
}
{
    const { state, engine, put, piece } = flatGame();
    box(put, -1); put('TRAP', 5, 4);
    const g = piece('gremlin', 5, 4);
    const res = engine.wait();
    check('a Trap built under a gremlin does not kill it', state.pieces.includes(g) && !res.events.some(e => e.type === 'splat'));
}
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 0, 4, DIR.E); put('TRAP', 1, 4);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a crate pushed onto a Trap is safe', state.pieces.includes(c) && c.isAt(1, 4) && state.lost === 0);
}
done();
