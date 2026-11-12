// R-54: a Cannon (`clears` 4, push 5) shoots the piece on it 5 hexes: the first 4 pass over
// everything (water, mountains, Walls, pieces, gremlins unsplatted, targets, Traps), then the
// 5th is an ordinary ground step (sinks, delivers, blocked, bumps a line on slick ground, slides
// on ice, kills a gremlin on a Trap). Blocked there, it comes down on the 4th hex if the ground
// could take it, else it doesn't fire; a path off the map doesn't fire (D-36). It unlocks last.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

// A Cannon at (q0,4) facing E with a `kind` piece on it, `setup` applied, then one tick.
function shoot(setup, kind = 'crate', q0 = 0) {
    const ctx = flatGame();
    const { engine, put, piece } = ctx;
    put('CANNON', q0, 4, DIR.E);
    setup(ctx);
    const c = piece(kind, q0, 4);
    const res = engine.wait();
    const moves = res.events.filter(e => e.type === 'move' && e.id === c.id);
    return { ...ctx, c, res, moves, gone: !ctx.state.pieces.includes(c) };
}

{
    const { c, moves, state } = shoot(({ terrain, put, piece, T }) => {
        terrain(1, 4, T.WATER); terrain(2, 4, T.MOUNTAIN); put('WALL', 3, 4); piece('crate', 4, 4);
    });
    check('clears water, a mountain, a Wall and a piece over 4 hexes, landing on the 5th', c.isAt(5, 4) && state.pieces.length === 2);
    check('one move whose path lists all 5 hexes', moves.length === 1 && moves[0].path.length === 5 &&
        moves[0].path.map(h => h.q).join() === '1,2,3,4,5');
    check('the piece it passed over is untouched', state.pieces.some(p => p !== c && p.isAt(4, 4)));
}
{
    let g;
    const { c, res } = shoot(({ piece }) => { g = piece('gremlin', 2, 4); });
    check('a gremlin under the shot is passed over, not splatted', c.isAt(5, 4) &&
        !res.events.some(e => e.type === 'splat' && e.id === g.id));
}
{
    const { c, gone, state } = shoot(({ state }) => { state.targets[0] = { q: 2, r: 4, color: 'red', delivered: 0 }; });
    check('its own target under the cleared stretch is passed over', !gone && c.isAt(5, 4) && state.delivered === 0);
}
{
    const { c } = shoot(({ put }) => { put('TRAP', 3, 4); }, 'gremlin');
    check('a Trap under the cleared stretch doesn\'t catch a shot gremlin', c.isAt(5, 4));
}
{
    const { gone, state, res, c } = shoot(({ terrain, T }) => terrain(5, 4, T.WATER));
    check('the 5th hex open water: it sinks', gone && state.lost === 1 && res.events.some(e => e.type === 'sink' && e.id === c.id));
}
{
    const { gone, state } = shoot(({ state }) => { state.targets[0] = { q: 5, r: 4, color: 'red', delivered: 0 }; });
    check('the 5th hex its color\'s target: delivered', gone && state.delivered === 1);
}
{
    const { c } = shoot(({ state }) => { state.targets.push({ q: 5, r: 4, color: 'blue', delivered: 0 }); });
    check('the 5th hex another color\'s target blocks it: it comes down on the 4th', c.isAt(4, 4));
}
{
    const { gone } = shoot(({ put }) => put('TRAP', 5, 4), 'gremlin');
    check('a gremlin shot onto a Trap on the 5th hex dies', gone);
}
{
    const { c, moves } = shoot(({ put }) => put('WALL', 5, 4));
    check('the 5th hex blocked (a Wall): it comes down on the 4th', c.isAt(4, 4) && moves[0].path.length === 4);
}
{
    const { c } = shoot(({ terrain, T }) => { terrain(5, 4, T.MOUNTAIN); terrain(4, 4, T.ICE); });
    check('blocked by a mountain, onto bare ice on the 4th: it comes down there and skids on, into the mountain that stopped it (D-37)', c.isAt(4, 4));
}
{
    const { c, moves } = shoot(({ put, terrain, T }) => { put('WALL', 5, 4); put('SLIDE', 4, 4); });
    check('blocked by a Wall, a Slide on the 4th: it comes down there and skids on, stopped by the Wall; each hex once',
        c.isAt(4, 4) && moves.length === 1 && moves[0].path.map(h => h.q).join() === '1,2,3,4');
}
{
    const { c } = shoot(({ put, terrain, T }) => { put('WALL', 5, 4); terrain(4, 4, T.WATER); put('BRIDGE', 4, 4, DIR.E); });
    check('blocked, a Bridge on the 4th: it comes down on the Bridge', c.isAt(4, 4));
}
const illegal4th = {
    'open water': ({ terrain, T }) => terrain(4, 4, T.WATER),
    'a mountain': ({ terrain, T }) => terrain(4, 4, T.MOUNTAIN),
    'a Wall': ({ put }) => put('WALL', 4, 4),
    'a piece': ({ piece }) => piece('crate', 4, 4),
    'another color\'s target': ({ state }) => state.targets.push({ q: 4, r: 4, color: 'blue', delivered: 0 }),
};
for (const [what, fourth] of Object.entries(illegal4th)) {
    const { c, moves, state } = shoot(ctx => { ctx.put('WALL', 5, 4); fourth(ctx); });
    check(`blocked, with ${what} on the 4th: it doesn't fire`, c.isAt(0, 4) && moves.length === 0 && state.lost === 0);
}
{
    const { c, gone, state } = shoot(({ put, state }) => {
        put('WALL', 5, 4); state.targets[0] = { q: 4, r: 4, color: 'red', delivered: 0 };
    });
    check('blocked, its color\'s target on the 4th: it comes down there and is delivered', gone && state.delivered === 1 && c.isAt(4, 4));
}
{
    const { c, state, res } = shoot(({ terrain, piece, T }) => { terrain(5, 4, T.ICE); piece('crate', 5, 4); });
    const other = state.pieces.find(p => p !== c);
    check('a piece on ice on the 5th is bumped: the line advances 2 and the shot ends 1 past the hit hex',
        other.isAt(7, 4) && c.isAt(6, 4));
    check('the bumped line moves from the contact hop, the one after its 4 cleared hexes',
        res.events.some(e => e.type === 'move' && e.id === other.id && e.hop === 5));
}
{
    const { c, moves } = shoot(({ terrain, T }) => { terrain(5, 4, T.ICE); terrain(6, 4, T.ICE); });
    check('the 5th hex bare ice: an ordinary ground step slides on', c.isAt(7, 4));
    check('… and slides once (the ground step\'s slide is its skid): one move, hexes 1–7 each once (D-37)',
        moves.length === 1 && moves[0].path.map(h => h.q).join() === '1,2,3,4,5,6,7');
}
{
    const { c } = shoot(({ put }) => put('SLIDE', 5, 4));
    check('the 5th hex a Slide: it slides on', c.isAt(6, 4));
}
{
    const { gone, state } = shoot(({ terrain, T }) => { terrain(5, 4, T.ICE); terrain(6, 4, T.WATER); });
    check('a slide off the 5th hex into open water sinks it', gone && state.lost === 1);
}
{
    const { gone } = shoot(({ terrain, put, T }) => { terrain(5, 4, T.ICE); put('TRAP', 6, 4); }, 'gremlin');
    check('a gremlin sliding off the 5th hex onto a Trap dies', gone);
}
{
    const { c, moves } = shoot(() => {}, 'crate', 10);
    check('a path that leaves the map within the cleared hexes: no fire', c.isAt(10, 4) && moves.length === 0);
}
{
    const { c, moves } = shoot(() => {}, 'crate', 9);
    check('the 5th hex off the map, the 4th the outer sea: no fire', c.isAt(9, 4) && moves.length === 0);
}
{
    const { gone, state } = shoot(() => {}, 'crate', 8);
    check('the 5th hex the outer sea: it sinks', gone && state.lost === 1);
}
{
    // R-13: the piece it passes over doesn't move, and a Belt under it still moves it this tick.
    const { state, c } = shoot(({ put, piece }) => { put('BELT', 3, 4, DIR.NE); piece('crate', 3, 4); });
    const other = state.pieces.find(p => p !== c);
    check('a piece passed over on a Belt still gets its own push', c.isAt(5, 4) && !other.isAt(3, 4));
}
{
    const { UNLOCKS } = flatGame().g.GameArtifacts;
    check('the Cannon is the last unlock step, right after the Rocket',
        UNLOCKS[UNLOCKS.length - 1].join() === 'CANNON' && UNLOCKS[UNLOCKS.length - 2].join() === 'ROCKET');
}
done();
