// R-37: a gremlin's own wandering step into a crate's hex wrecks the crate: the crate is gone
// (splat{id: crate, by: gremlin}, after the gremlin's move), counted in lost, and the gremlin
// takes the hex. A gremlin pushed, pulled or flung into a crate is just blocked.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
// Walls on every side of (5,4) but east, where the crate sits.
const BOX_BUT_EAST = [[6, 3], [5, 3], [4, 4], [4, 5], [5, 5]];
{
    const { state, engine, put, piece } = flatGame();
    BOX_BUT_EAST.forEach(([q, r]) => put('WALL', q, r));
    const g = piece('gremlin', 5, 4);
    const c = piece('crate', 6, 4);
    const res = engine.wait();
    const mv = res.events.findIndex(e => e.type === 'move' && e.id === g.id);
    const sp = res.events.findIndex(e => e.type === 'splat' && e.id === c.id && e.by === g.id);
    check('a gremlin that steps onto a crate wrecks it and takes its hex',
        !state.pieces.includes(c) && g.isAt(6, 4) && mv >= 0 && sp > mv);
    check('a wrecked crate is lost', state.lost === 1);
    check('a wrecked crate brings nothing back', !res.events.some(e => e.type === 'spawn'));
}
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 1, 4, DIR.E);
    const g = piece('gremlin', 1, 4);
    const c = piece('crate', 2, 4);
    engine.wait();
    check('a gremlin pushed into a crate is blocked; the crate survives',
        state.pieces.includes(c) && g.isAt(1, 4) && state.lost === 0);
}
{
    const { state, engine, put, piece } = flatGame();
    put('PULLER', 0, 4, DIR.E);
    const c = piece('crate', 1, 4);
    const g = piece('gremlin', 2, 4);
    engine.wait();
    check('a gremlin pulled into a crate is blocked; the crate survives',
        state.pieces.includes(c) && g.isAt(2, 4) && state.lost === 0);
}
{
    const { state, engine, put, piece } = flatGame();
    put('SPRING', 0, 4, DIR.E);
    const g = piece('gremlin', 0, 4);
    const c = piece('crate', 2, 4);
    engine.wait();
    check('a gremlin flung into a crate is blocked; the crate survives',
        state.pieces.includes(c) && g.isAt(1, 4) && state.lost === 0);
}
done();
