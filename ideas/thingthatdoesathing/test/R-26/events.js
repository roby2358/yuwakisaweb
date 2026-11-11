// R-26: a tick's events describe exactly what changed: each move's path is the hexes entered
// in order and ends where the piece is (or where it vanished); sink/deliver/splat follow
// their move; spawn reports the new crate.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, flatGame, DIR } = require('../helpers/load');
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); terrain(2, 4, T.ICE);
    const c = piece('crate', 0, 4);
    const { events } = engine.wait();
    const mv = events.find(e => e.type === 'move' && e.id === c.id);
    check('slide path lists every hex entered', JSON.stringify(mv.path) === JSON.stringify([{ q: 1, r: 4 }, { q: 2, r: 4 }, { q: 3, r: 4 }]));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 3, 4, DIR.E); terrain(4, 4, T.WATER);
    const c = piece('crate', 3, 4);
    const { events } = engine.wait();
    check('move into water, then sink', JSON.stringify(events) ===
        JSON.stringify([{ type: 'move', id: c.id, path: [{ q: 4, r: 4 }] }, { type: 'sink', id: c.id }]));
}
{
    const { engine, put, piece } = flatGame();
    put('BELT', 9, 8, DIR.E);
    const c = piece('crate', 9, 8);
    const { events } = engine.wait();
    check('move onto target, then deliver', JSON.stringify(events) ===
        JSON.stringify([{ type: 'move', id: c.id, path: [{ q: 10, r: 8 }] }, { type: 'deliver', id: c.id }]));
}
{
    const { state, engine } = flatGame();
    state.spawnTimer = 99;
    const { events } = engine.wait();
    const c = state.pieces.find(p => p.kind === 'crate');
    check('spawn reports the new crate', JSON.stringify(events) ===
        JSON.stringify([{ type: 'spawn', id: c.id, q: state.sources[0].q, r: state.sources[0].r }]));
}
{
    const { engine, put, piece } = flatGame();
    put('ROCKET', 0, 4, DIR.E); put('WALL', 4, 4);
    const gr = piece('gremlin', 0, 4);
    const { events } = engine.wait();
    const mine = events.filter(e => e.id === gr.id);
    check('a launched gremlin: move, then splat', JSON.stringify(mine) ===
        JSON.stringify([{ type: 'move', id: gr.id, path: [{ q: 1, r: 4 }, { q: 2, r: 4 }, { q: 3, r: 4 }] }, { type: 'splat', id: gr.id, by: null, trap: false }]));
}
// Replay check on real games (Rockets included, forced into the hand): applying events to the pre-tick positions reproduces the post-tick ones.
for (const seed of [3, 4, 5]) {
    const { g, state, engine } = newGame(seed, 'small');
    let ok = true;
    for (let i = 0; i < 80; i++) {
        const pos = new Map(state.pieces.map(p => [p.id, p.key()]));
        if (i % 8 === 1) state.hand[0] = { kind: 'ROCKET', color: 'white' };
        const legal = [...engine.legalPlacements(state.hand[0].kind)];
        const res = legal.length && i % 2 ? engine.place(0, ...legal[(i * 5) % legal.length].split(',').map(Number), i % 6) : engine.wait();
        for (const e of res.events) {
            if (e.type === 'move') pos.set(e.id, g.Hex.key(e.path.at(-1).q, e.path.at(-1).r));
            if (e.type === 'sink' || e.type === 'deliver' || e.type === 'splat') pos.delete(e.id);
            if (e.type === 'spawn') pos.set(e.id, g.Hex.key(e.q, e.r));
        }
        const actual = new Map(state.pieces.map(p => [p.id, p.key()]));
        if (JSON.stringify([...pos].sort()) !== JSON.stringify([...actual].sort())) ok = false;
    }
    check(`seed ${seed}: replaying events reproduces every piece position`, ok);
}
done();
