// R-7: a step into an off-map hex, mountain, Wall, or a hex holding a piece that stays is
// blocked and the piece stays; plains, ice, a bridge, or a mover's hex accept it.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
// A Belt at (3,4) facing E pushes a crate toward (4,4), set up by `setup`; one tick.
const tryStep = (setup, blocked, label) => {
    const ctx = flatGame();
    ctx.put('BELT', 3, 4, DIR.E);
    const c = ctx.piece('crate', 3, 4);
    setup(ctx);
    ctx.engine.wait();
    check(label + (blocked ? ' → blocked' : ' → entered'), blocked ? c.isAt(3, 4) : !c.isAt(3, 4));
};
tryStep(({ terrain, T }) => terrain(4, 4, T.MOUNTAIN), true, 'mountain');
tryStep(({ put }) => put('WALL', 4, 4), true, 'wall');
tryStep(({ piece }) => piece('crate', 4, 4), true, 'another piece');
tryStep(() => {}, false, 'plains');
tryStep(({ terrain, T }) => terrain(4, 4, T.ICE), false, 'ice');
tryStep(({ put }) => put('BELT', 4, 4, DIR.W), false, 'a belt');
tryStep(({ terrain, put, T }) => { terrain(4, 4, T.WATER); put('BRIDGE', 4, 4, DIR.E); }, false, 'a bridge');
{
    // Off-map: from the east-most column of row 4 (col 15 is q = 13, an edge hex made
    // plains here so a Belt can stand on it).
    const { engine, put, piece, terrain, T } = flatGame();
    terrain(13, 4, T.PLAINS); put('BELT', 13, 4, DIR.E);
    const c = piece('crate', 13, 4);
    engine.wait();
    check('off-map is blocked', c.isAt(13, 4));
}
done();
