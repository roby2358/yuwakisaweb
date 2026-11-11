// R-16: a crate that enters the target of its color is removed and delivered +1. A gremlin
// that comes onto any target dies there (splat, by null, after its move; it counts in
// exGremlins and a new one climbs out on the shore), so gremlins can't camp a target. A
// flight carrying a gremlin over a target doesn't kill it.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 9, 8, DIR.E); piece('crate', 9, 8);
    engine.wait();
    check('crate delivered: removed, delivered +1', state.pieces.length === 0 && state.delivered === 1);
}
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 9, 8, DIR.E); const gr = piece('gremlin', 9, 8);
    const res = engine.wait();
    const types = res.events.filter(e => e.id === gr.id).map(e => e.type + (e.by === null ? ':null' : ''));
    check('a gremlin pushed onto the target dies there (move, then splat by null)',
        !state.pieces.includes(gr) && types.join() === 'move,splat:null' && state.delivered === 0);
    check('it counts in exGremlins and a new one climbs out', state.exGremlins === 1 && res.events.some(e => e.type === 'spawn'));
}
{
    const { state, engine, put, piece } = flatGame();
    const gr = piece('gremlin', 9, 8);
    // Wall every other way out, so its only step is onto the target.
    for (const [q, r] of [[8, 8], [9, 7], [10, 7], [8, 9], [9, 9]]) put('WALL', q, r);
    engine.wait();
    check('a gremlin that wanders onto the target dies too', !state.pieces.includes(gr) && state.exGremlins === 1);
}
{
    const { state, engine, put, piece } = flatGame();
    state.targets[0].q = 2; state.targets[0].r = 4;
    put('SPRING', 0, 4, DIR.E); const gr = piece('gremlin', 0, 4);
    engine.wait();
    check('a Spring flinging a gremlin over a target: it lands beyond, alive', state.pieces.includes(gr) && state.exGremlins === 0 &&
        gr.isAt(3, 4));
}
done();
