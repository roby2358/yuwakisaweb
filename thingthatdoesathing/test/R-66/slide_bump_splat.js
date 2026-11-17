// R-66: a sliding gremlin that bumps goes splat (D-54). A piece whose template has
// `splatsOnSlideBump` (the gremlin), sliding (a skid, or a ground motion that came onto slick
// ground free) into a bump (D-33), splats where it is at the bump's hop instead of following.
// The bumped line still advances 2, unless the bumped piece splatsOnSlideBump too: then both
// splat and neither moves on. Each counts as an ex-gremlin and re-emerges. Unchanged: a
// gremlin that bumps without sliding, a sliding crate, a sliding gremlin simply blocked.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

const moveOf = (events, p) => events.find(e => e.type === 'move' && e.id === p.id);
const splatOf = (events, p) => events.find(e => e.type === 'splat' && e.id === p.id);
const pathIs = (mv, qs) => !!mv && JSON.stringify(mv.path) === JSON.stringify(qs.map(q => ({ q, r: 4 })));
{
    const { g } = flatGame();
    const P = g.GameArtifacts.PIECES;
    check('the gremlin template splatsOnSlideBump; crates don\'t',
        P.gremlin.splatsOnSlideBump === true && !P.crate.splatsOnSlideBump && !P.bigcrate.splatsOnSlideBump);
}
{
    // The Belt pushes the gremlin onto ice at 1; it slides to 2 and bumps the crate on ice at 3.
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); for (const q of [1, 2, 3]) terrain(q, 4, T.ICE);
    const gr = piece('gremlin', 0, 4), c = piece('crate', 3, 4);
    const { events } = engine.wait();
    check('a sliding gremlin bumping a crate: the crate still advances 2', c.isAt(5, 4));
    check('… starting on the contact hop', pathIs(moveOf(events, c), [4, 5]) && moveOf(events, c).hop === 3);
    const sp = splatOf(events, gr);
    check('… and the gremlin splats where it is, at the bump\'s hop', !state.pieces.includes(gr)
        && pathIs(moveOf(events, gr), [1, 2]) && sp && sp.hop === 3);
    check('… counted as an ex-gremlin, and a new one re-emerges',
        state.exGremlins === 1 && state.pieces.some(p => p.kind === 'gremlin' && p.id !== gr.id)
        && events.some(e => e.type === 'spawn' || e.type === 'emerge'));
}
{
    // The victim gremlin on ice at 3 can't wander (walls, a mountain, and a gremlin at 2 as the
    // tick starts, not a crate it could wreck); the Pusher moves that gremlin off 2 on hop 1.
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); for (const q of [1, 2, 3]) terrain(q, 4, T.ICE);
    for (const [q, r] of [[4, 4], [4, 3], [3, 3], [3, 5]]) put('WALL', q, r);
    terrain(2, 5, T.MOUNTAIN); put('PUSHER', 2, 5, DIR.NW);
    const gr = piece('gremlin', 0, 4), c = piece('gremlin', 2, 4), v = piece('gremlin', 3, 4);
    const { events } = engine.wait();
    check('(setup) the gremlin at 2 was pushed off the slider\'s path', c.isAt(2, 3));
    const a = splatOf(events, gr), b = splatOf(events, v);
    check('a sliding gremlin bumping a gremlin: both splat at the bump\'s hop',
        !state.pieces.includes(gr) && !state.pieces.includes(v) && a && b && a.hop === 3 && b.hop === 3);
    check('… neither moves on', pathIs(moveOf(events, gr), [1, 2]) && !moveOf(events, v));
    check('… both count as ex-gremlins', state.exGremlins === 2);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE);
    const gr = piece('gremlin', 0, 4), c = piece('crate', 1, 4);
    engine.wait();
    check('a gremlin pushed off plains (not sliding) bumps as before: it follows, no splat',
        c.isAt(3, 4) && gr.isAt(2, 4) && state.exGremlins === 0);
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); for (const q of [1, 2, 3]) terrain(q, 4, T.ICE);
    const b = piece('crate', 0, 4), c = piece('crate', 3, 4);
    engine.wait();
    check('a sliding crate bumping a crate is unchanged: it follows', c.isAt(5, 4) && b.isAt(4, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); for (const q of [1, 2]) terrain(q, 4, T.ICE); put('WALL', 3, 4);
    const gr = piece('gremlin', 0, 4);
    engine.wait();
    check('a sliding gremlin simply blocked (a Wall) stops, alive', gr.isAt(2, 4) && state.exGremlins === 0);
}
done();
