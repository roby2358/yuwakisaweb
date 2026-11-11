// R-43: in a tick, the Things that reach ahead (Pusher, Puller) act before every other Thing,
// each group in placement order. So a Pusher or Puller built beside a running Belt line
// catches the crate in front of it before a Belt carries that crate on, whichever was
// placed first.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
const beltLine = put => { for (let q = 1; q <= 8; q++) put('BELT', q, 4, DIR.E); };
{
    // The Pusher at (4,5) faces NE onto (5,4), a Belt hex mid-line; built after the line.
    const { engine, put, putIn, piece } = flatGame();
    beltLine(put);
    putIn('red', 'PUSHER', 4, 5, DIR.NE);
    const c = piece('crate', 1, 4);
    for (let i = 0; i < 8; i++) engine.wait();
    check('a Pusher built after the Belts pushes the passing crate off the line', c.isAt(6, 3));
}
{
    // The Puller at (4,6) faces NE: the far hex (6,4) is on the line, and it pulls the crate
    // there back SW onto the near hex (5,5).
    const { engine, put, putIn, piece } = flatGame();
    beltLine(put);
    putIn('red', 'PULLER', 4, 6, DIR.NE);   // near hex (5,5), far hex (6,4)
    const c = piece('crate', 1, 4);
    for (let i = 0; i < 8; i++) engine.wait();
    check('a Puller built after the Belts pulls the passing crate off the line', c.isAt(5, 5));
}
done();
