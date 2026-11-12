// R-59: lockstep (D-38): two pieces wanting the same hex on the same hop: the one moved by the
// Thing earlier in the tick's order wins (Pushers and Pullers first, then placement order,
// D-24), the other is blocked and stops for the rest of the tick, even if the hex is free on a
// later hop.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
// Belt X at (3,4) facing E and Belt Y at (4,5) facing NW both push into (4,4).
for (const first of ['X', 'Y']) {
    const { engine, put, piece } = flatGame();
    const X = () => put('BELT', 3, 4, DIR.E), Y = () => put('BELT', 4, 5, DIR.NW);
    if (first === 'X') { X(); Y(); } else { Y(); X(); }
    const x = piece('crate', 3, 4), y = piece('crate', 4, 5);
    engine.wait();
    const [win, lose, from] = first === 'X' ? [x, y, [4, 5]] : [y, x, [3, 4]];
    check(`Belt ${first} placed first: its crate takes (4,4), the other stays`, win.isAt(4, 4) && lose.isAt(...from));
}
{
    const { engine, put, putIn, piece } = flatGame();
    put('BELT', 4, 5, DIR.NW);                 // placed first …
    putIn('red', 'PUSHER', 2, 4, DIR.E);       // … but the Pusher acts first (D-24)
    const x = piece('crate', 3, 4), y = piece('crate', 4, 5);
    engine.wait();
    check('a Pusher outranks an earlier-placed Belt for the hex', x.isAt(4, 4) && y.isAt(4, 5));
}
{
    // (4,4) is ice: X's crate slides on through it, so it's free from hop 2, but Y's crate,
    // blocked on hop 1, has stopped for the tick.
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 3, 4, DIR.E); put('BELT', 4, 5, DIR.NW); terrain(4, 4, T.ICE);
    const x = piece('crate', 3, 4), y = piece('crate', 4, 5);
    engine.wait();
    check('the loser stops for the tick (no retry when the hex frees up)', x.isAt(5, 4) && y.isAt(4, 5));
}
done();
