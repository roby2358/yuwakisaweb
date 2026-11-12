// R-53: a Spring's throw (`overMountains`) passes over mountains and lands on the third hex;
// it can't come down on a mountain, so it lands on the last hex short of one that it flew
// over (or doesn't throw), and skids on if that's ice; Walls and pieces still stop it; a Rocket
// is still stopped by one.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

// A Spring at (0,4) facing E with a crate on it, these hexes mountain, then one tick.
function throwOver(mountains, extra) {
    const ctx = flatGame();
    const { engine, put, piece, terrain, T } = ctx;
    put('SPRING', 0, 4, DIR.E);
    mountains.forEach(q => terrain(q, 4, T.MOUNTAIN));
    extra(ctx);
    const c = piece('crate', 0, 4);
    const res = engine.wait();
    return { ...ctx, c, moves: res.events.filter(e => e.type === 'move' && e.id === c.id) };
}
const nothing = () => {};

{
    const { c, state } = throwOver([1], nothing);
    check('a Spring throws over one mountain, landing on the third hex', c.isAt(3, 4) && state.pieces.includes(c));
}
{
    const { c, moves } = throwOver([1, 2], nothing);
    check('a Spring throws over two mountains, landing on the third hex', c.isAt(3, 4));
    const end = moves[0].path[moves[0].path.length - 1];
    check('its move path ends on the landing hex', moves.length === 1 && end.q === 3 && end.r === 4);
}
{
    const { c } = throwOver([3], nothing);
    check('a mountain as the landing hex: it comes down on the hex before', c.isAt(2, 4));
}
{
    const { c } = throwOver([2, 3], nothing);
    check('two mountains ending the throw: it comes down on the first hex', c.isAt(1, 4));
}
{
    const { c, moves } = throwOver([3], ({ terrain, T }) => { terrain(1, 4, T.ICE); terrain(2, 4, T.ICE); });
    check('stepped back off a mountain onto ice, it skids on: the mountain it backed off stops it (D-37)',
        c.isAt(2, 4) && moves.length === 1 && moves[0].path.map(h => h.q).join() === '1,2');
}
{
    const { c, moves } = throwOver([1, 2, 3], nothing);
    check('three mountains: it doesn\'t throw (no move)', c.isAt(0, 4) && moves.length === 0);
}
{
    const { c } = throwOver([1, 2], ({ terrain, T }) => terrain(3, 4, T.ICE));
    check('past two mountains onto bare ice it skids on', c.isAt(4, 4));
}
{
    const { c, state } = throwOver([1, 2], ({ terrain, T }) => terrain(3, 4, T.WATER));
    check('past two mountains into a lake it sinks', !state.pieces.includes(c) && state.lost === 1);
}
{
    const { c } = throwOver([1], ({ put }) => put('WALL', 2, 4));
    check('a Wall still stops it; over a mountain it comes down short of it', c.isAt(0, 4));
}
{
    const { c, state } = throwOver([1], ({ piece }) => piece('crate', 2, 4));
    check('a piece on plains still stops it, and it comes down short of the mountain', c.isAt(0, 4) && state.pieces.length === 2);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('ROCKET', 0, 4, DIR.E); terrain(2, 4, T.MOUNTAIN);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a Rocket is still stopped by a mountain', c.isAt(1, 4) && state.pieces.includes(c));
}
done();
