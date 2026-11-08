// R-25: when Sweepers exceed the quota, up to RECALL_PER_TURN leave per regime phase — the
// latest-spawned first, never one whose target is @.
'use strict';
const { quiet, addSweeper } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(2525);
const { g, state, engine } = ctx;
const A = g.GameArtifacts;
const spots = engine.board.passableHexes().slice(100, 100 + A.BASE_SWEEPERS + 3);
const sws = spots.map(h => addSweeper(ctx, h.q, h.r, 0));
const last = sws[sws.length - 1], secondLast = sws[sws.length - 2];
last.target = { kind: 'player', key: state.player.key() };
const events = [];
engine.recallSweepers(events);
check('RECALL_PER_TURN recalled', events.filter(e => e.type === 'recalled').length === Math.min(A.RECALL_PER_TURN, sws.length - engine.alertQuota()));
check('the latest not chasing @ goes first', !state.sweepers.includes(secondLast) && state.sweepers.includes(last));
while (state.sweepers.length > engine.alertQuota()) { const n = state.sweepers.length; engine.recallSweepers([]); if (state.sweepers.length === n) break; }
const ev2 = [];
engine.recallSweepers(ev2);
check('no recall at or under quota', ev2.length === 0);
done();
