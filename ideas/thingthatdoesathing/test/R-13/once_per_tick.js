// R-13: each piece moves at most once per tick — a crate on a line of belts advances one
// hex per tick, and a gremlin carried by a mover doesn't also wander.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { engine, put, piece } = flatGame();
    for (let q = 0; q <= 5; q++) put('BELT', q, 4, DIR.E);
    const c = piece('crate', 0, 4);
    for (let t = 1; t <= 4; t++) { engine.wait(); check(`tick ${t}: crate at q=${t}`, c.isAt(t, 4)); }
}
{
    const { engine, put, piece } = flatGame();
    // Belts placed in reverse order: the later belt acts first on its (empty) hex.
    put('BELT', 1, 4, DIR.E); put('BELT', 0, 4, DIR.E);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('placement order does not let a crate ride twice', c.isAt(1, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E); const gr = piece('gremlin', 3, 4);
    for (let i = 0; i < 20; i++) {
        gr.moveTo(3, 4);
        engine.wait();
        if (!gr.isAt(4, 4)) { check('carried gremlin did not also wander', false); break; }
    }
    check('a carried gremlin moves exactly with the belt', gr.isAt(4, 4));
}
done();
