// R-51: a piece stopped on the ground by a piece standing on slick ground (bare ICE, a Slide)
// bumps it (D-33): the bumper stays where it stopped, and the bumped piece is pushed one hex
// the same way and slides on through the same step, so it can sink, deliver, die on a Trap or
// be blocked. Its move names the bumper (`by`). It may bump the next one (a chain); a piece
// that already moved this tick can't be bumped. Gremlins bump and are bumped. A piece on
// ground that isn't slick is only a blocker, and so is any piece to a flight.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

const moveOf = (events, p) => events.find(e => e.type === 'move' && e.id === p.id);
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); terrain(2, 4, T.ICE);
    const a = piece('crate', 0, 4), b = piece('crate', 1, 4);
    const { events } = engine.wait();
    check('the bumper stays where it stopped', a.isAt(0, 4) && !moveOf(events, a));
    check('the bumped crate slides off the same way to the first plains', b.isAt(3, 4));
    const mv = moveOf(events, b);
    check('… its move lists every hex entered and names the bumper', !!mv && mv.by === a.id &&
        JSON.stringify(mv.path) === JSON.stringify([{ q: 2, r: 4 }, { q: 3, r: 4 }]));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); for (const q of [1, 2, 3, 4]) terrain(q, 4, T.ICE);
    const a = piece('crate', 0, 4), b = piece('crate', 1, 4), c = piece('crate', 3, 4);
    const { events } = engine.wait();
    check('a chain: the bumped crate stops against the next one on ice and bumps it on',
        a.isAt(0, 4) && b.isAt(2, 4) && c.isAt(5, 4));
    const mb = moveOf(events, b), mc = moveOf(events, c);
    check('… each move names its bumper, in chain order', mb.by === a.id && mc.by === b.id &&
        events.indexOf(mb) < events.indexOf(mc));
}
{
    const { engine, put, piece } = flatGame();
    put('BELT', 0, 4, DIR.E);
    const a = piece('crate', 0, 4), b = piece('crate', 1, 4);
    engine.wait();
    check('a crate on plains is only a blocker: nothing moves', a.isAt(0, 4) && b.isAt(1, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('BELT', 0, 4, DIR.E); put('SLIDE', 1, 4);
    const a = piece('crate', 0, 4), b = piece('crate', 1, 4);
    engine.wait();
    check('a crate standing on a Slide is bumped too', a.isAt(0, 4) && b.isAt(2, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); terrain(2, 4, T.WATER);
    const a = piece('crate', 0, 4), b = piece('crate', 1, 4);
    const { events } = engine.wait();
    check('bumped into water: it sinks (lost +1), move then sink',
        a.isAt(0, 4) && !state.pieces.includes(b) && state.lost === 1 &&
        events.findIndex(e => e.type === 'sink' && e.id === b.id) > events.indexOf(moveOf(events, b)));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); put('WALL', 2, 4);
    const a = piece('crate', 0, 4), b = piece('crate', 1, 4);
    const { events } = engine.wait();
    check('bumped against a Wall: it is blocked, nobody moves', a.isAt(0, 4) && b.isAt(1, 4) && !events.some(e => e.type === 'move'));
    terrain(2, 4, T.MOUNTAIN);
    engine.remove(2, 4);
    check('… and the same against a mountain', a.isAt(0, 4) && b.isAt(1, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    const tgt = state.targets[0];
    put('BELT', tgt.q - 2, tgt.r, DIR.E); terrain(tgt.q - 1, tgt.r, T.ICE);
    piece('crate', tgt.q - 2, tgt.r); const b = piece('crate', tgt.q - 1, tgt.r);
    b.color = tgt.color;
    engine.wait();
    check('bumped onto its color\'s target: delivered', !state.pieces.includes(b) && state.delivered === 1);
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE);
    const g = piece('gremlin', 0, 4), b = piece('crate', 1, 4);
    engine.wait();
    check('a carried gremlin bumps a crate on ice', g.isAt(0, 4) && b.isAt(2, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); put('TRAP', 2, 4);
    const a = piece('crate', 0, 4), g = piece('gremlin', 1, 4);
    engine.wait();
    check('a gremlin on ice is bumped too, here onto a Trap: it dies (trapped +1)',
        a.isAt(0, 4) && !state.pieces.includes(g) && state.trapped === 1);
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    // B rides its Belt (placed first) SE onto ice and stops against a Wall; then A's Belt
    // pushes A into B, which already moved this tick.
    put('BELT', 1, 3, DIR.SE); put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); put('WALL', 1, 5);
    const b = piece('crate', 1, 3), a = piece('crate', 0, 4);
    engine.wait();
    check('a piece that already moved this tick can\'t be bumped', b.isAt(1, 4) && a.isAt(0, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('SPRING', 0, 4, DIR.E); terrain(2, 4, T.ICE);
    const a = piece('crate', 0, 4), c = piece('crate', 2, 4);
    engine.wait();
    check('a flight stopped by a crate on ice doesn\'t bump it: it comes down short', a.isAt(1, 4) && c.isAt(2, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('SPRING', -1, 4, DIR.E); for (const q of [2, 3, 4]) terrain(q, 4, T.ICE);
    const a = piece('crate', -1, 4), c = piece('crate', 4, 4);
    engine.wait();
    check('a Spring\'s skid (on the ground) bumps: the skidder stops, the crate slides on', a.isAt(3, 4) && c.isAt(5, 4));
}
done();
