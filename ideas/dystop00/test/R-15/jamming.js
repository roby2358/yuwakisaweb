// R-15: blocks within JAM_RADIUS of a Sweeper never wake at broadcast; a rig within JAM_RADIUS of a
// Sweeper is silent (rigWakeSet empty). rigWakeSet(q, r, jammedKeys(), TX_RANGE) is exactly the set the broadcast
// rule applies for a rig at (q, r).
'use strict';
const { quiet, interiorBlock, stageRig, addSweeper, parkPlayerAway, awakeKeys } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(4040);
const { g, state, engine } = ctx;
const A = g.GameArtifacts, b = engine.board;
const c = interiorBlock(ctx, A.TX_RANGE);
parkPlayerAway(ctx, c.q, c.r);

// A Sweeper two hexes away jams part of the rig's ring.
const sweeperSpot = b.within(c.q, c.r, 2).find(h => new g.Hex(h.q, h.r).distance(c) === 2);
addSweeper(ctx, sweeperSpot.q, sweeperSpot.r);
const preview = engine.rigWakeSet(c.q, c.r, engine.jammedKeys(), A.TX_RANGE).map(h => h.q + ',' + h.r).sort();
stageRig(ctx, 0, c.q, c.r);
engine.broadcast([]);
check('broadcast applies exactly rigWakeSet', JSON.stringify(awakeKeys(state)) === JSON.stringify(preview));
const jam = engine.jammedKeys();
check('nothing jammed woke', awakeKeys(state).every(k => !jam.has(k)));
check('jam covers JAM_RADIUS around the Sweeper',
    b.within(sweeperSpot.q, sweeperSpot.r, A.JAM_RADIUS).every(h => jam.has(g.Hex.key(h.q, h.r))));

// A Sweeper adjacent to the rig silences it.
for (const h of state.hexes.values()) h.awake = false;
state.sweepers = [];
const adj = b.neighbors(c.q, c.r)[0];
addSweeper(ctx, adj.q, adj.r);
check('a jammed rig is silent', engine.rigWakeSet(c.q, c.r, engine.jammedKeys(), A.TX_RANGE).length === 0);
engine.broadcast([]);
check('a jammed rig wakes nothing', awakeKeys(state).length === 0);
done();
