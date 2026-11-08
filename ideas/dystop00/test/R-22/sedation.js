// R-22: after the Sweepers move, each Sweeper's own hex falls asleep; awake blocks elsewhere —
// including inside JAM_RADIUS — stay awake.
'use strict';
const { quiet, interiorBlock, addSweeper, parkPlayerAway } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(2222);
const { state, engine } = ctx;
const c = interiorBlock(ctx, 2);
parkPlayerAway(ctx, c.q, c.r);
for (const h of engine.board.within(c.q, c.r, 2)) h.awake = true;
addSweeper(ctx, c.q, c.r, 0);
const events = [];
engine.sedate(events);
check("Sweeper's hex asleep", !state.hexes.get(`${c.q},${c.r}`).awake);
check('neighbors stay awake', engine.board.neighbors(c.q, c.r).every(h => h.awake));
check('event', events.some(e => e.type === 'sedated' && e.keys.length === 1));
done();
