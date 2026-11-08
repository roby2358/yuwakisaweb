// R-23: when the regime leaves every rig smashed, outcome = 'deadair' and nothing spawns.
'use strict';
const { quiet, addSweeper, stageRig, parkPlayerAway } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(2323);
const { g, state, engine } = ctx;
state.rigs.forEach((r, i) => { if (i > 0) r.status = 'smashed'; });
const start = engine.board.passableHexes()[420];
const sw = addSweeper(ctx, start.q, start.r, 5);
parkPlayerAway(ctx, start.q, start.r, 15);
const plan = g.dijkstraHexes(sw, state.hexes, engine.sweeperCostFn(sw));
const [k] = [...plan.cost.entries()].find(([, c]) => c >= 2 && c <= 4);
stageRig(ctx, 0, ...Object.values(g.Hex.fromKey(k)));
const events = [];
engine.regime(events);
check('last rig smashed → dead air', state.outcome === 'deadair');
check('no spawn', !events.some(e => e.type === 'spawned'));
done();
