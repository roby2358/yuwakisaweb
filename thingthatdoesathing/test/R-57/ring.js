// R-57: lockstep (D-38): a cycle of three or more pieces each moving into the next one's hex
// all go and rotate, so a packed ring of Belts turns.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    // Six Belts around (5,4), each facing the next hex round, a crate on every one.
    const ring = [[6, 4, DIR.NW], [6, 3, DIR.W], [5, 3, DIR.SW], [4, 4, DIR.SE], [4, 5, DIR.E], [5, 5, DIR.NE]];
    const { engine, put, piece } = flatGame();
    ring.forEach(([q, r, f]) => put('BELT', q, r, f));
    const crates = ring.map(([q, r]) => piece('crate', q, r));
    engine.wait();
    check('a packed ring of 6 turns one hex', crates.every((c, i) => c.isAt(ring[(i + 1) % 6][0], ring[(i + 1) % 6][1])));
    for (let t = 0; t < 5; t++) engine.wait();
    check('… and six ticks bring every crate home', crates.every((c, i) => c.isAt(ring[i][0], ring[i][1])));
}
{
    const tri = [[5, 4, DIR.E], [6, 4, DIR.SW], [5, 5, DIR.NW]];
    const { engine, put, piece } = flatGame();
    tri.forEach(([q, r, f]) => put('BELT', q, r, f));
    const crates = tri.map(([q, r]) => piece('crate', q, r));
    engine.wait();
    check('a packed ring of 3 turns too', crates.every((c, i) => c.isAt(tri[(i + 1) % 3][0], tri[(i + 1) % 3][1])));
}
done();
