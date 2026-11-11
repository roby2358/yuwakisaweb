// R-40: a colored Thing (a Pusher or Puller in a crate color) acts only on crates of its
// color, and on every gremlin; a crate of another color is left where it is. A white one
// acts on every piece.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

const setup = () => {
    const ctx = flatGame();
    ctx.crate = (color, q, r) => { const c = ctx.piece('crate', q, r); c.color = color; return c; };
    return ctx;
};
{
    const { engine, putIn, crate } = setup();
    putIn('red', 'PUSHER', 2, 4, DIR.E); const c = crate('red', 3, 4);
    engine.wait();
    check('a red Pusher pushes a red crate', c.isAt(4, 4));
}
{
    const { engine, putIn, crate } = setup();
    putIn('red', 'PUSHER', 2, 4, DIR.E); const c = crate('blue', 3, 4);
    const res = engine.wait();
    check('a red Pusher leaves a blue crate where it is', c.isAt(3, 4) && !res.events.some(e => e.id === c.id));
}
{
    const { engine, putIn, crate } = setup();
    putIn('white', 'PUSHER', 2, 4, DIR.E); const c = crate('blue', 3, 4);
    engine.wait();
    check('a white Pusher pushes any crate', c.isAt(4, 4));
}
{
    const { engine, putIn, piece } = setup();
    putIn('red', 'PUSHER', 2, 4, DIR.E); const gr = piece('gremlin', 3, 4);
    engine.wait();
    check('a red Pusher still pushes a gremlin', gr.isAt(4, 4));
}
{
    const { engine, putIn, crate } = setup();
    putIn('green', 'PULLER', 2, 4, DIR.E); const a = crate('green', 4, 4);
    engine.wait();
    check('a green Puller pulls a green crate', a.isAt(3, 4));
}
{
    const { engine, putIn, crate } = setup();
    putIn('green', 'PULLER', 2, 4, DIR.E); const b = crate('red', 4, 4);
    engine.wait();
    check('a green Puller leaves a red crate where it is', b.isAt(4, 4));
}
{
    const { engine, putIn, piece } = setup();
    putIn('green', 'PULLER', 2, 4, DIR.E); const gr = piece('gremlin', 4, 4);
    engine.wait();
    check('a green Puller still pulls a gremlin', gr.isAt(3, 4));
}
done();
