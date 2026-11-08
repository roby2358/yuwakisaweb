// R-32: a planted rig's range is min(TX_RANGE + airtime, TX_RANGE_MAX). Planting and retrieving
// set airtime to 0; each broadcast in which the rig is unjammed adds 1; a jammed broadcast
// adds nothing. The broadcast wakes with the rig's range at the start of the phase.
'use strict';
const { NO_FADE, quiet, interiorBlock, addSweeper, awakeKeys } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(3232, NO_FADE);   // fading is R-31's rule
const { g, state, engine } = ctx;
const A = g.GameArtifacts, b = engine.board;
const c = interiorBlock(ctx, 1);
state.player.moveTo(c.q, c.r);
const sleepAll = () => { for (const h of state.hexes.values()) h.awake = false; };
const blocksWithin = d => b.within(c.q, c.r, d).filter(h => b.isBlock(h)).map(h => h.q + ',' + h.r).sort();

// 1. Planting starts at TX_RANGE.
check('plant succeeds', engine.plant().ok);
const rig = engine.rigAt(c.q, c.r);
check('fresh rig: airtime 0, range TX_RANGE', rig.airtime === 0 && engine.rigRange(rig) === A.TX_RANGE);

// 2. Each unjammed broadcast widens it by one, up to TX_RANGE_MAX; the wake uses the
//    range at the start of the phase. (Everything is put back to sleep between broadcasts
//    so only the rig rule can wake anything.)
let ok = true;
for (let k = 0; k <= A.TX_RANGE_MAX - A.TX_RANGE + 2; k++) {
    const range = engine.rigRange(rig);
    if (range !== Math.min(A.TX_RANGE + k, A.TX_RANGE_MAX)) ok = false;
    sleepAll();
    engine.broadcast([]);
    if (JSON.stringify(awakeKeys(state)) !== JSON.stringify(blocksWithin(range))) ok = false;
    if (rig.airtime !== k + 1) ok = false;
}
check('range grows +1 per broadcast to TX_RANGE_MAX, and the wake uses it', ok);

// 3. A jammed broadcast adds no airtime.
const t = rig.airtime;
const adj = b.neighbors(c.q, c.r).find(h => b.isPassable(h));
addSweeper(ctx, adj.q, adj.r);
engine.broadcast([]);
check('a jammed broadcast adds no airtime', rig.airtime === t);
state.sweepers = [];

// 4. Retrieving resets it; planting again starts over.
state.mp = A.PLAYER_MP;
check('retrieve succeeds', engine.retrieve().ok);
check('retrieve resets airtime', rig.airtime === 0);
engine.plant();
check('re-planted rig starts at TX_RANGE', engine.rigRange(engine.rigAt(c.q, c.r)) === A.TX_RANGE);
done();
