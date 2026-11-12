// R-51: a mover (any Thing's push, a flight, an ice slide, a gremlin) stopped by a piece
// standing on slick ground (bare ICE, a Slide) bumps it (D-33): the line from that piece on
// (it and the unmoved pieces right behind it) advances 2 hexes, each step through `step`
// (water sinks, its color's target delivers, a Trap kills a gremlin, a Wall or the piece ahead
// stops it, no slide afterward), and the bumper follows as far as the bumped piece went, so
// the bumped hex is left empty. Line moves name the bumper (`by`) and the hexes it had entered
// at contact (`byAt`). A flight that bumps ends there. Every piece involved moves once.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

const moveOf = (events, p) => events.find(e => e.type === 'move' && e.id === p.id);
const pathIs = (mv, qs) => !!mv && JSON.stringify(mv.path) === JSON.stringify(qs.map(q => ({ q, r: 4 })));
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); terrain(2, 4, T.ICE); terrain(3, 4, T.ICE);
    const b = piece('crate', 0, 4), a = piece('crate', 1, 4);
    const { events, ok } = engine.wait();
    check('a Belt bump: the bumped crate advances 2 (no slide on), the bumper ends right behind it',
        ok && a.isAt(3, 4) && b.isAt(2, 4) && !engine.pieceAt(1, 4));
    const mb = moveOf(events, b), ma = moveOf(events, a);
    check('… the bumper\'s path runs through the bumped hex', pathIs(mb, [1, 2]) && mb.by === null);
    check('… the bumped move names the bumper, at contact, and comes after it',
        pathIs(ma, [2, 3]) && ma.by === b.id && ma.byAt === 0 && events.indexOf(mb) < events.indexOf(ma));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE);
    const b = piece('crate', 0, 4), a = piece('crate', 1, 4), c = piece('crate', 2, 4), d = piece('crate', 3, 4);
    const { events } = engine.wait();
    check('a line of 3 advances 2 (only the bumped hex needs to be slick)',
        a.isAt(3, 4) && c.isAt(4, 4) && d.isAt(5, 4) && b.isAt(2, 4));
    check('… every line move names the bumper', [a, c, d].every(p => moveOf(events, p).by === b.id));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); put('WALL', 4, 4);
    const b = piece('crate', 0, 4), a = piece('crate', 1, 4), c = piece('crate', 2, 4);
    engine.wait();
    check('a line blocked part way compresses behind the Wall; the bumper ends behind it',
        c.isAt(3, 4) && a.isAt(2, 4) && b.isAt(1, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); put('WALL', 3, 4);
    const b = piece('crate', 0, 4), a = piece('crate', 1, 4), c = piece('crate', 2, 4);
    const { events } = engine.wait();
    check('a line that can\'t move at all: nobody moves', b.isAt(0, 4) && a.isAt(1, 4) && c.isAt(2, 4) &&
        !events.some(e => e.type === 'move'));
    terrain(3, 4, T.MOUNTAIN);
    engine.remove(3, 4);
    check('… and the same against a mountain', b.isAt(0, 4) && a.isAt(1, 4) && c.isAt(2, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); terrain(3, 4, T.WATER);
    const b = piece('crate', 0, 4), a = piece('crate', 1, 4), c = piece('crate', 2, 4);
    const { events } = engine.wait();
    check('a line into water: each piece sinks as it steps in (lost +2); the bumper ends behind',
        !state.pieces.includes(a) && !state.pieces.includes(c) && state.lost === 2 && b.isAt(2, 4));
    check('… each sink follows its move',
        events.findIndex(e => e.type === 'sink' && e.id === a.id) > events.indexOf(moveOf(events, a)));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); terrain(2, 4, T.WATER);
    const b = piece('crate', 0, 4), a = piece('crate', 1, 4);
    engine.wait();
    check('a bumped crate that sinks on its first step: the bumper follows one, not into the water',
        !state.pieces.includes(a) && state.lost === 1 && b.isAt(1, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    const tgt = state.targets[0];
    put('BELT', tgt.q - 2, tgt.r, DIR.E); terrain(tgt.q - 1, tgt.r, T.ICE);
    const b = piece('crate', tgt.q - 2, tgt.r), a = piece('crate', tgt.q - 1, tgt.r);
    a.color = tgt.color;
    engine.wait();
    check('bumped onto its color\'s target: delivered; the bumper ends on the bumped hex',
        !state.pieces.includes(a) && state.delivered === 1 && b.isAt(tgt.q - 1, tgt.r));
}
{
    const { engine, put, piece } = flatGame();
    put('BELT', 0, 4, DIR.E); put('SLIDE', 1, 4);
    const b = piece('crate', 0, 4), a = piece('crate', 1, 4);
    engine.wait();
    check('a crate standing on a Slide is bumped too', a.isAt(3, 4) && b.isAt(2, 4));
}
{
    const { engine, put, piece } = flatGame();
    put('BELT', 0, 4, DIR.E);
    const b = piece('crate', 0, 4), a = piece('crate', 1, 4);
    engine.wait();
    check('a crate on plains is only a blocker: nothing moves', b.isAt(0, 4) && a.isAt(1, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('SPRING', 0, 4, DIR.E); terrain(2, 4, T.ICE);
    const b = piece('crate', 0, 4), a = piece('crate', 2, 4);
    const { events } = engine.wait();
    check('a Spring\'s flight bumps: the line advances 2, the flier comes down right behind it',
        a.isAt(4, 4) && b.isAt(3, 4) && pathIs(moveOf(events, b), [1, 2, 3]));
    check('… the bumped move starts where the flier made contact (byAt 1)', moveOf(events, a).byAt === 1);
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('SPRING', 0, 4, DIR.E); terrain(2, 4, T.ICE); put('WALL', 3, 4);
    const b = piece('crate', 0, 4), a = piece('crate', 2, 4);
    engine.wait();
    check('… a flight whose line can\'t move comes down short', a.isAt(2, 4) && b.isAt(1, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('ROCKET', 0, 4, DIR.E); terrain(4, 4, T.ICE); terrain(6, 4, T.ICE);
    const b = piece('crate', 0, 4), a = piece('crate', 4, 4);
    engine.wait();
    check('a Rocket\'s flight bumps, and the bump ends the flight', a.isAt(6, 4) && b.isAt(5, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('ROCKET', 0, 4, DIR.E); terrain(2, 4, T.ICE);
    const b = piece('crate', 0, 4), g = piece('gremlin', 2, 4);
    engine.wait();
    check('a Rocket still splats a gremlin on ice rather than bumping it',
        !state.pieces.includes(g) && b.isAt(2, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('SPRING', -1, 4, DIR.E); for (const q of [2, 3, 4]) terrain(q, 4, T.ICE);
    const b = piece('crate', -1, 4), a = piece('crate', 4, 4);
    engine.wait();
    check('a Spring\'s skid bumps like any mover', a.isAt(6, 4) && b.isAt(5, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); put('TRAP', 4, 4);
    const b = piece('crate', 0, 4), a = piece('crate', 1, 4), g = piece('gremlin', 2, 4);
    engine.wait();
    check('a gremlin in a line is carried along, here onto a Trap: it dies (trapped +1)',
        !state.pieces.includes(g) && state.trapped === 1 && a.isAt(3, 4) && b.isAt(2, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE);
    const g = piece('gremlin', 0, 4), a = piece('crate', 1, 4);
    engine.wait();
    check('a carried gremlin bumps a crate on ice (it doesn\'t wreck it)', a.isAt(3, 4) && g.isAt(2, 4));
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
    // The bump comes first (its Belt placed first); the Belts under the line's landing hex
    // and under the bumper's landing hex act later in the tick and must find moved pieces.
    put('BELT', 0, 4, DIR.E); put('BELT', 3, 4, DIR.E); put('BELT', 2, 4, DIR.E); terrain(1, 4, T.ICE);
    const b = piece('crate', 0, 4), a = piece('crate', 1, 4);
    engine.wait();
    check('every piece in a bump counts as moved: Belts under them later in the tick don\'t move them again',
        a.isAt(3, 4) && b.isAt(2, 4));
}
done();
