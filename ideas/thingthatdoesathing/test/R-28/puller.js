// R-28: a Puller reaches across the near hex (one ahead in its facing) and pulls the piece
// on the far hex (two ahead) back into the near hex — one step toward itself, through the
// ordinary step rule. It never moves a piece standing on its own hex or the near hex.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { engine, put, piece } = flatGame();
    put('PULLER', 3, 4, DIR.E);
    const c = piece('crate', 5, 4);
    engine.wait();
    check('crate on the far hex is pulled into the near hex', c.isAt(4, 4));
    engine.wait();
    check('a piece on the near hex stays put', c.isAt(4, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('PULLER', 3, 4, DIR.SE);
    const c = piece('crate', 3, 6);
    engine.wait();
    check('works along any facing (SE: far (0,+2) → near (0,+1))', c.isAt(3, 5));
}
{
    const { engine, put, piece } = flatGame();
    put('PULLER', 3, 4, DIR.E);
    const c = piece('crate', 3, 4);
    engine.wait();
    check('a piece on the puller itself is left alone', c.isAt(3, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('PULLER', 3, 4, DIR.E); put('WALL', 4, 4);
    const c = piece('crate', 5, 4);
    engine.wait();
    check('a blocked near hex stops the pull', c.isAt(5, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('PULLER', 3, 4, DIR.E); terrain(4, 4, T.WATER);
    const gr = piece('gremlin', 5, 4);
    engine.wait();
    check('a gremlin pulled into open water sinks', !state.pieces.includes(gr));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('PULLER', 3, 4, DIR.E); terrain(4, 4, T.ICE);
    const c = piece('crate', 5, 4);
    engine.wait();
    check('pulled onto bare ice, it slides on and stops on the puller (a Thing)', c.isAt(3, 4));
}
{
    const { engine, put, piece } = flatGame();
    // A belt pushes the crate onto the far hex; the puller (placed later) can't move it again.
    put('BELT', 6, 4, DIR.W); put('PULLER', 3, 4, DIR.E);
    const c = piece('crate', 6, 4);
    engine.wait();
    check('a piece already moved this tick is not pulled too', c.isAt(5, 4));
    engine.wait();
    check('next tick the puller takes it', c.isAt(4, 4));
}
done();
