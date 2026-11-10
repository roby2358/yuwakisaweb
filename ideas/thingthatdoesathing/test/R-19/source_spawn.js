// R-19: each tick raises spawnTimer; once it reaches SOURCE_INTERVAL and the source is
// empty, a crate appears there and the timer resets. While the source is occupied the
// timer keeps counting and the spawn waits. Each spawned crate gets a CRATE_COLORS color.
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
    crates().length === 1 && c.isAt(state.source.q, state.source.r) && state.spawnTimer === 0);
for (let t = 0; t < N * 3; t++) engine.wait();
check('while the source is occupied, no new crate; timer keeps counting',
    crates().length === 1 && state.spawnTimer === N * 3);
c.moveTo(0, 4);
engine.wait();
check('the moment it clears, the waiting crate spawns', crates().length === 2 && state.spawnTimer === 0);
const { CRATE_COLORS } = g.GameArtifacts;
check('every spawned crate has a CRATE_COLORS color', crates().every(p => CRATE_COLORS.includes(p.color)));
done();
