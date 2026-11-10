// R-19: each tick raises spawnTimer; once it reaches SOURCE_INTERVAL, the tick rolls one of
// the open colors, and if that color's source is empty a crate of that color appears there
// and the timer resets. If the source is occupied, nothing spawns and the timer keeps
// counting; the next tick rolls again.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame } = require('../helpers/load');
const { g, state, engine, piece } = flatGame();
const N = g.GameArtifacts.SOURCE_INTERVAL;
state.spawnTimer = 0;
const crates = () => state.pieces.filter(p => p.kind === 'crate');
for (let t = 1; t < N; t++) engine.wait();
check(`no crate before SOURCE_INTERVAL (${N}) ticks`, crates().length === 0 && state.spawnTimer === N - 1);
engine.wait();
const c = crates()[0];
check('a crate appears on the source at SOURCE_INTERVAL; timer resets',
    crates().length === 1 && c.isAt(state.sources[0].q, state.sources[0].r) && state.spawnTimer === 0);
for (let t = 0; t < N * 3; t++) engine.wait();
check('while the source is occupied, no new crate; timer keeps counting',
    crates().length === 1 && state.spawnTimer === N * 3);
c.moveTo(0, 4);
engine.wait();
check('the moment it clears, the waiting crate spawns', crates().length === 2 && state.spawnTimer === 0);
check('every spawned crate has the open color', crates().every(p => p.color === 'red'));
{
    // Two colors: red from the flatGame source, blue from a second source at (-1, 6), whose
    // red source is jammed.
    const { state, engine, piece } = flatGame();
    state.sources.push({ q: -1, r: 6, colors: ['blue'] });
    state.targets.push({ q: 10, r: 6, color: 'blue', delivered: 0 });
    piece('crate', -3, 8);   // jams the red source
    state.spawnTimer = N;
    const spawned = [];
    let waits = 0;
    for (let t = 0; t < 60; t++) {
        const res = engine.wait();
        const sp = res.events.find(e => e.type === 'spawn');
        if (sp) { spawned.push(state.pieces.find(p => p.id === sp.id)); state.pieces.pop(); }
        else if (state.spawnTimer > N) waits++;
    }
    check(`each crate is its color, at its color's source (${spawned.length})`,
        spawned.length > 0 && spawned.every(c => c.color === 'blue' && c.isAt(-1, 6)));
    check(`rolling the jammed color spawns nothing that tick, and the next tick rolls again (${waits})`, waits > 0);
}
done();
