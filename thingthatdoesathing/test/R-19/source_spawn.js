// R-19: each tick raises spawnTimer; at SPAWN_INTERVAL the tick is a spawn chance and the
// timer resets. On a chance, if the crates on the board are fewer than the cap
// (crateCap(size) plus one per milestone reached), the tick rolls one of the open colors, and
// if that color's source is empty a crate of that color appears there. A full board or an
// occupied source spawns nothing; the next chance is SPAWN_INTERVAL ticks later.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame } = require('../helpers/load');
const { g, state, engine, piece } = flatGame();
const A = g.GameArtifacts;
const N = A.SPAWN_INTERVAL;
const cap = A.crateCap('small');
const crates = () => state.pieces.filter(p => A.PIECES[p.kind].cargo);   // a big crate counts as one (D-34)
state.spawnTimer = 0;
for (let t = 1; t < N; t++) engine.wait();
check(`no crate before SPAWN_INTERVAL (${N}) ticks`, crates().length === 0 && state.spawnTimer === N - 1);
engine.wait();
const c = crates()[0];
check('a crate appears on the source at SPAWN_INTERVAL; timer resets',
    crates().length === 1 && c.isAt(state.sources[0].q, state.sources[0].r) && state.spawnTimer === 0);
for (let t = 0; t < N * 3; t++) engine.wait();
check('while the source is occupied, no new crate; the timer still resets every chance',
    crates().length === 1 && state.spawnTimer === 0);
c.moveTo(0, 4);
engine.wait();
check('clearing the source between chances spawns nothing until the next chance',
    crates().length === 1 && state.spawnTimer === 1);
for (let t = 1; t < N; t++) engine.wait();
check('the next chance spawns', crates().length === 2 && state.spawnTimer === 0);
check('every spawned crate has the open color', crates().every(p => p.color === 'red'));

{
    // The cap: crateCap(size) crates parked off the source hold the source back.
    const { state, engine, piece } = flatGame();
    const crates = () => state.pieces.filter(p => A.PIECES[p.kind].cargo);   // a big crate counts as one (D-34)
    for (let i = 0; i < cap; i++) piece('crate', i - 1, 2);
    check(`crateCap('small') is ${cap} and the engine's max matches`, cap >= 1 && engine.crateMax() === cap);
    state.spawnTimer = N - 1;
    engine.wait();
    check(`at the cap (${cap}) a chance spawns nothing`, crates().length === cap && state.spawnTimer === 0);
    state.pieces.splice(state.pieces.indexOf(crates()[0]), 1);
    state.spawnTimer = N - 1;
    engine.wait();
    check('one under the cap, the chance spawns', crates().length === cap);
    state.delivered = 10;
    check('the first milestone raises the max by one', engine.crateMax() === cap + 1);
    state.delivered = 49;
    check('each milestone reached raises it by one more (10, 20 → +2)', engine.crateMax() === cap + 2);
    state.delivered = 50;
    check('a third milestone (50) → +3', engine.crateMax() === cap + 3);
    engine.pieceAt(-3, 8).moveTo(5, 2);   // clear the source
    state.spawnTimer = N - 1;
    engine.wait();
    check('with the raised max, the full board spawns again', crates().length === cap + 1);
    check(`milestonesReached counts 1-2-5 milestones (0, 1, 3, 4)`,
        A.milestonesReached(9) === 0 && A.milestonesReached(10) === 1 &&
        A.milestonesReached(99) === 3 && A.milestonesReached(100) === 4);
}
{
    // crateCap scales with the square root of area: CRATE_CAP_PER_ROOT per root hex, rounded, at least one.
    const ok = Object.entries(A.MAP_SIZES).every(([size, { cols, rows }]) =>
        A.crateCap(size) === Math.max(1, Math.round(A.CRATE_CAP_PER_ROOT * Math.sqrt(cols * rows))));
    check('crateCap(size) = max(1, round(CRATE_CAP_PER_ROOT * sqrt(area))) on every size', ok);
    const caps = ['small', 'medium', 'large', 'huge'].map(A.crateCap).join(' ');
    check(`caps by size are 8 12 18 36 (got ${caps})`, caps === '8 12 18 36');
}
{
    // Two colors: red from the flatGame source, blue from a second source at (-1, 6), whose
    // red source is jammed.
    const { state, engine, piece } = flatGame();
    state.sources.push({ q: -1, r: 6, colors: ['blue'] });
    state.targets.push({ q: 10, r: 6, color: 'blue', delivered: 0 });
    piece('crate', -3, 8);   // jams the red source
    state.spawnTimer = 0;
    const spawned = [];
    let chances = 0;
    for (let t = 0; t < 60 * N; t++) {
        const res = engine.wait();
        if (state.spawnTimer === 0) chances++;
        const sp = res.events.find(e => e.type === 'spawn');
        if (sp) { spawned.push(state.pieces.find(p => p.id === sp.id)); state.pieces.pop(); }
    }
    check(`each crate is its color, at its color's source (${spawned.length})`,
        spawned.length > 0 && spawned.every(c => c.color === 'blue' && c.isAt(-1, 6)));
    check(`rolling the jammed color spawns nothing that chance (${spawned.length} of ${chances})`,
        spawned.length < chances);
}
done();
