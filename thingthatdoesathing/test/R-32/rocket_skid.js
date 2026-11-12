// R-32: a Rocket's flight that comes down on slick ground (bare ice or a Slide), at full range
// or short, skids on, on the ground (D-37): the skid sinks in open water, delivers on its color's
// target, stops at a Wall or another color's target, and bumps a piece on ice (D-33). A flight
// that splatted a gremlin in its way stops on that hex, and a gremlin riding the Rocket splats
// where it lands.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

// A Rocket at (-1,4) facing E (it comes down on (7,4)) with a `kind` piece on it, `setup`
// applied, then one tick.
function launch(setup, kind = 'crate') {
    const ctx = flatGame();
    ctx.put('ROCKET', -1, 4, DIR.E);
    setup(ctx);
    const c = ctx.piece(kind, -1, 4);
    const res = ctx.engine.wait();
    const moves = res.events.filter(e => e.type === 'move' && e.id === c.id);
    return { ...ctx, c, res, moves, gone: !ctx.state.pieces.includes(c) };
}

{
    const { c, moves } = launch(({ terrain, T }) => { terrain(7, 4, T.ICE); terrain(8, 4, T.ICE); });
    check('down on bare ice, it skids on to the first hex that isn\'t slick', c.isAt(9, 4));
    check('one move: the 8-hex flight, then the skid', moves.length === 1 && moves[0].path.length === 10);
}
{
    const { c } = launch(({ put }) => put('SLIDE', 7, 4));
    check('down on a Slide, it skids on', c.isAt(8, 4));
}
{
    const { gone, state, res, c } = launch(({ terrain, T }) => { terrain(7, 4, T.ICE); terrain(8, 4, T.WATER); });
    check('a skid into open water sinks it', gone && state.lost === 1 && res.events.some(e => e.type === 'sink' && e.id === c.id));
}
{
    const { gone, state } = launch(({ terrain, state, T }) => {
        terrain(7, 4, T.ICE); state.targets[0] = { q: 8, r: 4, color: 'red', delivered: 0 };
    });
    check('a skid onto its color\'s target delivers it', gone && state.delivered === 1);
}
{
    const { c } = launch(({ terrain, put, T }) => { terrain(7, 4, T.ICE); terrain(8, 4, T.ICE); put('WALL', 9, 4); });
    check('a skid stops at a Wall', c.isAt(8, 4));
}
{
    const { c } = launch(({ terrain, state, T }) => {
        terrain(7, 4, T.ICE); state.targets.push({ q: 8, r: 4, color: 'blue', delivered: 0 });
    });
    check('a skid stops at another color\'s target', c.isAt(7, 4));
}
{
    let other;
    const { c, res } = launch(({ terrain, piece, T }) => {
        terrain(7, 4, T.ICE); terrain(8, 4, T.ICE); other = piece('crate', 8, 4);
    });
    check('a skid that meets a piece on ice bumps it: the line advances 2, the skid ends 1 past the hit hex',
        other.isAt(10, 4) && c.isAt(9, 4));
    check('… the bumped line moves from the contact hop, the one after its 8-hex flight',
        res.events.some(e => e.type === 'move' && e.id === other.id && e.hop === 9));
}
{
    const { c, moves } = launch(({ terrain, put, T }) => { terrain(5, 4, T.ICE); put('WALL', 6, 4); });
    check('blocked mid-flight, down on ice, it skids on too: the Wall that stopped the flight stops the skid',
        c.isAt(5, 4) && moves.length === 1 && moves[0].path.length === 6);
}
{
    const { c } = launch(({ terrain, state, T }) => {
        for (let q = 6; q <= 11; q++) terrain(q, 4, T.ICE);
        state.targets.push({ q: 7, r: 4, color: 'blue', delivered: 0 });
    });
    check('ending over another color\'s target on ice, it comes down short of it (canLand) and its skid meets that target', c.isAt(6, 4));
}
{
    let g;
    const { c, state } = launch(({ terrain, piece, put, T }) => {
        for (let q = 3; q <= 6; q++) terrain(q, 4, T.ICE);
        // Walled in, with a lake to its west, so it has nowhere to wander (the flight crosses the lake).
        for (const [q, r] of [[4, 4], [4, 3], [3, 3], [2, 5], [3, 5]]) put('WALL', q, r);
        terrain(2, 4, T.WATER);
        g = piece('gremlin', 3, 4);
    });
    check('a flight that splats a gremlin on ice stops on that hex: no skid (the one exception)',
        !state.pieces.includes(g) && c.isAt(3, 4));
}
{
    const { gone, res, c, moves } = launch(({ terrain, T }) => { terrain(7, 4, T.ICE); terrain(8, 4, T.ICE); }, 'gremlin');
    check('a gremlin riding the Rocket splats where it comes down, no skid',
        gone && moves[0].path.length === 8 && res.events.some(e => e.type === 'splat' && e.id === c.id));
}
done();
