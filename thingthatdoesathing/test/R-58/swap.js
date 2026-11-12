// R-58: lockstep (D-38): two pieces each moving into the other's hex (a head-on swap) are both
// blocked and stay; a blocked piece stops for the rest of the tick.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E); put('BELT', 4, 4, DIR.W);
    const a = piece('crate', 3, 4), b = piece('crate', 4, 4);
    const { events } = engine.wait();
    check('two Belts facing each other: neither crate moves', a.isAt(3, 4) && b.isAt(4, 4) && !events.some(e => e.type === 'move'));
}
{
    // A crate behind a swapping pair is blocked too (the chain's front fails).
    const { engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E); put('BELT', 4, 4, DIR.W); put('BELT', 2, 4, DIR.E);
    const a = piece('crate', 3, 4), b = piece('crate', 4, 4), c = piece('crate', 2, 4);
    engine.wait();
    check('a crate pushing into a stuck pair stays too', a.isAt(3, 4) && b.isAt(4, 4) && c.isAt(2, 4));
}
done();
