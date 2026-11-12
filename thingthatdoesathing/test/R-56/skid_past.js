// R-56: lockstep (D-38): a flight or skid meets whatever is on a hex at the hop it gets there.
// A Rocket's crate that comes down on ice skids on through a hex whose crate a Belt carried
// away earlier in the same tick; it isn't left stuck on bare ice.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
for (const order of ['Belt placed after the Rocket', 'Belt placed before the Rocket']) {
    const { engine, put, piece, terrain, T } = flatGame();
    const belt = () => put('BELT', 9, 4, DIR.NE);
    if (order.endsWith('before the Rocket')) belt();
    put('ROCKET', -1, 4, DIR.E);
    if (order.endsWith('after the Rocket')) belt();
    for (let q = 4; q <= 8; q++) terrain(q, 4, T.ICE);
    const other = piece('crate', 9, 4);
    const c = piece('crate', -1, 4);
    engine.wait();
    check(`${order}: the Belt carries its crate off on hop 1`, other.isAt(10, 3));
    check(`${order}: the Rocket's crate lands on (7,4), skids across (8,4) into the empty Belt hex`, c.isAt(9, 4));
}
{
    // Whereas a crate that stays put still stops the skid.
    const { engine, put, piece, terrain, T } = flatGame();
    put('ROCKET', -1, 4, DIR.E);
    for (let q = 4; q <= 8; q++) terrain(q, 4, T.ICE);
    piece('crate', 9, 4);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('a crate that stays on plains stops the skid on the ice before it', c.isAt(8, 4));
}
done();
