// R-24: quota = min(MAX_SWEEPERS, BASE_SWEEPERS + floor(awake / AWAKE_PER_SWEEPER)). The
// regime spawns min(SPAWN_PER_TURN, quota − count) Sweepers, each on a free passable
// neighbor of a station, with a kind from SWEEPER_KINDS and MP printed as its label.
'use strict';
const { quiet } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(2424);
const { g, state, engine } = ctx;
const A = g.GameArtifacts;
const blocks = engine.board.blocks();
blocks.slice(0, A.AWAKE_PER_SWEEPER * 3 + 1).forEach(h => { h.awake = true; });
check('quota formula', engine.alertQuota() === Math.min(A.MAX_SWEEPERS, A.BASE_SWEEPERS + 3));
blocks.forEach(h => { h.awake = true; });
check('quota capped at MAX_SWEEPERS', engine.alertQuota() === Math.min(A.MAX_SWEEPERS, A.BASE_SWEEPERS + Math.floor(blocks.length / A.AWAKE_PER_SWEEPER)));
blocks.forEach(h => { h.awake = false; });
blocks.slice(0, A.AWAKE_PER_SWEEPER * 3).forEach(h => { h.awake = true; });
const quota = engine.alertQuota();
let rounds = 0;
while (state.sweepers.length < quota && rounds < 50) {
    const n0 = state.sweepers.length;
    const events = [];
    engine.spawnSweepers(A.SPAWN_PER_TURN, events);
    check(`round ${rounds}: spawned min(SPAWN_PER_TURN, quota − count)`, state.sweepers.length - n0 === Math.min(A.SPAWN_PER_TURN, quota - n0));
    rounds++;
}
check('reaches the quota and stops', state.sweepers.length === quota);
const events = [];
engine.spawnSweepers(A.SPAWN_PER_TURN, events);
check('no spawn at quota', events.length === 0);
const kinds = new Set(A.SWEEPER_KINDS.map(k => k.name));
check('each on a free passable station neighbor, kind from the table, MP as label',
    state.sweepers.every(sw => kinds.has(sw.kind) && sw.label === String(sw.mp) &&
        state.stations.some(st => new g.Hex(st.q, st.r).distance(sw) === 1) &&
        engine.board.isPassable(state.hexes.get(sw.key()))) &&
    new Set(state.sweepers.map(s => s.key())).size === state.sweepers.length);
done();
