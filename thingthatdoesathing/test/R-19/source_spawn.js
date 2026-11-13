// R-19: newGame shuffles every CRATE_COLORS color once, with Rando, into spawnCycle (seeded,
// fixed for the game) and starts spawnSlot at 0. Every tick takes the next slot (wrapping
// after the last). If that slot's color is open, the crates on the board number fewer than
// the cap (crateCap(size) plus one per milestone reached) and the color's source is empty, a
// crate of that color appears there. A closed color is a tick with no crate; a full board or
// an occupied source skips the slot (no retry: the next tick takes the next slot).
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, newGame } = require('../helpers/load');
const { g, state, engine } = flatGame();
const A = g.GameArtifacts;
const L = A.CRATE_COLORS.length;
const cap = A.crateCap('small');
const crates = () => state.pieces.filter(p => A.PIECES[p.kind].cargo);   // a big crate counts as one (D-34)

{
    // The shuffle: every color once, seeded, and fixed (a milestone doesn't reshuffle).
    const a = newGame(11, 'small').state, b = newGame(11, 'small').state;
    check('newGame: spawnCycle holds every CRATE_COLORS color once; spawnSlot 0',
        [...a.spawnCycle].sort().join() === [...A.CRATE_COLORS].sort().join() && a.spawnSlot === 0);
    check('the same seed gives the same cycle', a.spawnCycle.join() === b.spawnCycle.join());
    const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(seed => newGame(seed, 'small').state.spawnCycle.join()));
    check(`different seeds shuffle differently (${orders.size} orders from 8 seeds)`, orders.size > 1);
}

// One open color (red) in the first slot of four: a crate, then L-1 ticks with none.
state.spawnCycle = ['red', 'green', 'blue', 'yellow'];
state.spawnSlot = 0;
engine.wait();
const c = crates()[0];
check('the open color\'s slot spawns its crate on its source; the slot advances',
    crates().length === 1 && c.isAt(state.sources[0].q, state.sources[0].r) && c.color === 'red' && state.spawnSlot === 1);
c.moveTo(0, 4);
for (let t = 1; t < L; t++) engine.wait();
check(`closed colors' slots spawn nothing (${L - 1} ticks), and the slot wraps to 0`,
    crates().length === 1 && state.spawnSlot === 0);
engine.wait();
check('the red slot comes round again: a second crate', crates().length === 2 && state.spawnSlot === 1);
for (let t = 0; t < L * 3; t++) engine.wait();
check('while the source is occupied, its slot spawns nothing; the cycle keeps turning',
    crates().length === 2 && state.spawnSlot === 1);
crates().find(p => p.isAt(-3, 8)).moveTo(1, 4);
engine.wait();
check('clearing the source off its slot spawns nothing: a skipped slot isn\'t retried',
    crates().length === 2 && state.spawnSlot === 2);
for (let t = 0; t < L - 1; t++) engine.wait();
check('the next time round the slot spawns', crates().length === 3 && state.spawnSlot === 1);

{
    // The cap: crateCap(size) crates parked off the source make the red slot skip.
    const { state, engine, piece } = flatGame();
    const crates = () => state.pieces.filter(p => A.PIECES[p.kind].cargo);
    for (let i = 0; i < cap; i++) piece('crate', i - 1, 2);
    check(`crateCap('small') is ${cap} and the engine's max matches`, cap >= 1 && engine.crateMax() === cap);
    state.spawnCycle = ['red'];
    engine.wait();
    check(`at the cap (${cap}) the slot spawns nothing`, crates().length === cap);
    state.pieces.splice(state.pieces.indexOf(crates()[0]), 1);
    engine.wait();
    check('one under the cap, the slot spawns', crates().length === cap);
    state.delivered = 10;
    check('the first milestone raises the max by one', engine.crateMax() === cap + 1);
    state.delivered = 49;
    check('each milestone reached raises it by one more (10, 20 → +2)', engine.crateMax() === cap + 2);
    state.delivered = 50;
    check('a third milestone (50) → +3', engine.crateMax() === cap + 3);
    engine.pieceAt(-3, 8).moveTo(5, 2);   // clear the source
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
    // Two open colors, red jammed: blue's slot spawns at blue's source, red's slot nothing,
    // and the closed colors' slots nothing.
    const { state, engine, piece } = flatGame();
    state.sources.push({ q: -1, r: 6, colors: ['blue'] });
    state.targets.push({ q: 10, r: 6, color: 'blue', delivered: 0 });
    piece('crate', -3, 8);   // jams the red source
    state.spawnCycle = ['green', 'red', 'yellow', 'blue'];
    const spawnedAt = [];
    for (let t = 0; t < 3 * L; t++) {
        const res = engine.wait();
        const sp = res.events.find(e => e.type === 'spawn');
        if (!sp) continue;
        const p = state.pieces.find(x => x.id === sp.id);
        spawnedAt.push([t, p.color, p.q, p.r].join());
        state.pieces.splice(state.pieces.indexOf(p), 1);
    }
    check(`only blue's slot spawns, once per round, at blue's source (${spawnedAt.join(' ')})`,
        spawnedAt.join(' ') === ['3,blue,-1,6', '7,blue,-1,6', '11,blue,-1,6'].join(' '));
}
{
    // All four colors open, sources clear: a crate every tick, one of each color per round.
    const { state, engine } = flatGame();
    state.size = 'huge';   // a cap well above four
    const rest = A.CRATE_COLORS.filter(c => c !== 'red');
    rest.forEach((color, i) => {
        state.sources.push({ q: i, r: 2, colors: [color] });
        state.targets.push({ q: 10, r: 2 + 2 * i, color, delivered: 0 });
    });
    state.spawnCycle = [...A.CRATE_COLORS];
    const colors = [];
    for (let t = 0; t < L; t++) {
        const sp = engine.wait().events.find(e => e.type === 'spawn');
        if (sp) colors.push(state.pieces.find(p => p.id === sp.id).color);
        state.pieces = [];
    }
    check(`every color open: one crate a tick, in cycle order (${colors.join(' ')})`, colors.join() === A.CRATE_COLORS.join());
}
done();
