// R-31: a gremlin that sinks (pushed, pulled, slid, or left on a removed Bridge) is replaced
// at the end of the command by a new gremlin (new id, palette color) on a random shore hex:
// land next to an edge hex, free to stand on, not the source or target. Its `spawn` event
// comes after the `sink`. A sunk crate brings nothing back. A full shore brings nothing back.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

const gremlins = state => state.pieces.filter(p => p.kind === 'gremlin');
const onShore = (engine, state, p) => {
    const h = engine.board.get(p.q, p.r);
    return engine.board.isPassable(h) && !h.isEdge &&
        engine.board.neighbors(p.q, p.r).some(n => n.isEdge) &&
        !(p.q === state.source.q && p.r === state.source.r) && !(p.q === state.target.q && p.r === state.target.r);
};
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 3, 4, DIR.E); terrain(4, 4, T.WATER);
    const gr = piece('gremlin', 3, 4);
    const res = engine.wait();
    const [fresh] = gremlins(state);
    check('a drowned gremlin is replaced by a new one',
        gremlins(state).length === 1 && fresh.id !== gr.id && /^#[0-9a-f]{6}$/.test(fresh.color));
    check('it climbs out on a shore hex', onShore(engine, state, fresh));
    const types = res.events.map(e => e.type + (e.id === undefined ? '' : ':' + e.id));
    check('sink, then spawn for the newcomer: ' + types.join(' '),
        types.indexOf('sink:' + gr.id) >= 0 && types.indexOf('sink:' + gr.id) < types.indexOf('spawn:' + fresh.id));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 3, 4, DIR.E); terrain(4, 4, T.WATER);
    piece('crate', 3, 4);
    const res = engine.wait();
    check('a sunk crate brings nothing back', state.pieces.length === 0 && !res.events.some(e => e.type === 'spawn'));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    terrain(4, 4, T.WATER); put('BRIDGE', 4, 4, null);
    const gr = piece('gremlin', 4, 4);
    engine.remove(4, 4);
    const now = gremlins(state);
    check('a gremlin left on a removed Bridge re-emerges too',
        now.length === 1 && now[0].id !== gr.id && onShore(engine, state, now[0]));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    for (const h of engine.shoreHexes()) put('WALL', h.q, h.r, null);
    put('BELT', 3, 4, DIR.E); terrain(4, 4, T.WATER);
    piece('gremlin', 3, 4);
    engine.wait();
    check('a walled-off shore: the gremlin stays drowned', gremlins(state).length === 0);
}
done();
