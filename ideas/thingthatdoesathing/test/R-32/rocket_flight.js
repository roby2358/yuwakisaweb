// R-32: a Rocket flies the piece on it up to THINGS.ROCKET.push hexes in its facing: it
// stops there, before a blocker, sinks in the outer sea (crate: lost +1), or is delivered
// crossing the target. It flies over inland open water and ice (every hex counts, no slide),
// and sinks if it comes down on water. The whole flight is one move event.
'use strict';
const { check, done } = require('../helpers/check');
const { load, flatGame, DIR } = require('../helpers/load');
const RANGE = load().GameArtifacts.THINGS.ROCKET.push;
{
    const { engine, put, piece } = flatGame();
    put('ROCKET', -1, 4, DIR.E);
    const c = piece('crate', -1, 4);
    const res = engine.wait();
    const mv = res.events.filter(e => e.type === 'move' && e.id === c.id);
    check(`flies RANGE (${RANGE}) hexes on open ground, in one move event`,
        c.isAt(-1 + RANGE, 4) && mv.length === 1 && mv[0].path.length === RANGE);
}
{
    const { engine, put, piece } = flatGame();
    put('ROCKET', 0, 4, DIR.E); put('WALL', 5, 4);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a Wall within range stops it on the hex before', c.isAt(4, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('ROCKET', -1, 4, DIR.E);
    for (let q = 0; q <= 11; q++) terrain(q, 4, T.ICE);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('ice neither stretches the flight nor slides it on landing', c.isAt(-1 + RANGE, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('ROCKET', -1, 4, DIR.E); terrain(-1 + RANGE, 4, T.WATER);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('running out of range over inland water, it comes down and sinks', !state.pieces.includes(c) && state.lost === 1);
}
{
    const { engine, put, piece } = flatGame();
    put('ROCKET', 0, 4, DIR.E); put('BELT', 5, 4, DIR.NE); put('WALL', 9, 4);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('flies over movers without stopping', c.isAt(8, 4));
}
{
    const { state, engine, put, piece } = flatGame();
    put('ROCKET', 6, 4, DIR.E);   // 6 inland hexes, then the edge, inside RANGE
    const c = piece('crate', 6, 4);
    const res = engine.wait();
    check('reaching the outer sea within range sinks it: lost +1',
        !state.pieces.includes(c) && state.lost === 1 && res.events.some(e => e.type === 'sink' && e.id === c.id));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('ROCKET', 0, 4, DIR.E); terrain(5, 4, T.WATER); terrain(6, 4, T.WATER); put('WALL', 9, 4);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('it flies over inland open water', c.isAt(8, 4) && state.lost === 0);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('ROCKET', 0, 4, DIR.E); terrain(6, 4, T.WATER); terrain(7, 4, T.WATER); put('WALL', 8, 4);
    const c = piece('crate', 0, 4);
    const res = engine.wait();
    const mv = res.events.find(e => e.type === 'move' && e.id === c.id);
    check('stopped above inland water, it comes down and sinks: lost +1, move then sink',
        !state.pieces.includes(c) && state.lost === 1 && mv.path.at(-1).q === 7 &&
        res.events.some(e => e.type === 'sink' && e.id === c.id));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.WATER);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('other pushers still sink in inland water', !state.pieces.includes(c) && state.lost === 1);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('ROCKET', 0, 4, DIR.E); terrain(6, 4, T.WATER); put('BRIDGE', 6, 4); put('WALL', 9, 4);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a Bridge carries it on', c.isAt(8, 4) && state.lost === 0);
}
{
    const { state, engine, put, piece } = flatGame();
    put('ROCKET', 0, 4, DIR.E); state.targets[0].q = 6; state.targets[0].r = 4;
    const c = piece('crate', 0, 4);
    engine.wait();
    check('crossing the target delivers it', !state.pieces.includes(c) && state.delivered === 1);
}
{
    const { engine, put, piece } = flatGame();
    put('ROCKET', 0, 4, DIR.E); piece('crate', 7, 4);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a crate in the way stops it, and stays put', c.isAt(6, 4) && engine.pieceAt(7, 4));
}
done();
