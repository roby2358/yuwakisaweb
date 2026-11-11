// R-41: a Pusher pushes the piece on the hex it faces THINGS.PUSHER.shove hexes on, in its
// facing, with the same step as every mover (blocked, sinking, sliding on ice); it ignores
// a piece on its own hex. It can be turned like any mover.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { g, engine, put, piece } = flatGame();
    put('PUSHER', 2, 4, DIR.E); const c = piece('crate', 3, 4);
    engine.wait();
    check(`pushes the piece in front ${g.GameArtifacts.THINGS.PUSHER.shove} hex on`, c.isAt(3 + g.GameArtifacts.THINGS.PUSHER.shove, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('PUSHER', 2, 4, DIR.SE); const c = piece('crate', 2, 5);
    engine.wait();
    check('facing SE pushes the SE neighbor on to (2, 6)', c.isAt(2, 6));
}
{
    const { engine, put, piece } = flatGame();
    put('PUSHER', 2, 4, DIR.E); const c = piece('crate', 2, 4);
    engine.wait();
    check('ignores a piece on its own hex', c.isAt(2, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('PUSHER', 2, 4, DIR.E); put('WALL', 4, 4); const c = piece('crate', 3, 4);
    engine.wait();
    check('blocked by a Wall', c.isAt(3, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('PUSHER', 2, 4, DIR.E); terrain(4, 4, T.WATER); const c = piece('crate', 3, 4);
    engine.wait();
    check('pushed into water, it sinks', !state.pieces.includes(c) && state.lost === 1);
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('PUSHER', 2, 4, DIR.E); terrain(4, 4, T.ICE); terrain(5, 4, T.ICE); const c = piece('crate', 3, 4);
    engine.wait();
    check('pushed onto ice, it slides on', c.isAt(6, 4));
}
{
    const { engine, put } = flatGame();
    const t = put('PUSHER', 2, 4, DIR.E);
    check('it turns like any mover', engine.rotate(2, 4).ok && t.facing !== DIR.E);
}
done();
