// R-20: a Sweeper whose walk enters a planted rig's hex smashes it (status 'smashed', forever),
// ends its walk there, and drops its target.
'use strict';
const { quiet, addSweeper, stageRig, parkPlayerAway } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(2020);
const { g, state, engine } = ctx;
const b = engine.board;
const start = b.passableHexes()[400];
const sw = addSweeper(ctx, start.q, start.r, 3);   // Hound
parkPlayerAway(ctx, start.q, start.r, 15);
const plan = g.dijkstraHexes(sw, state.hexes, engine.sweeperCostFn(sw));
const [rigKey] = [...plan.cost.entries()].find(([, c]) => c >= 2 && c <= sw.mp - 1);
const { q, r } = g.Hex.fromKey(rigKey);
stageRig(ctx, 0, q, r);
const events = [];
engine.walkSweeper(sw, events);
check('rig smashed', state.rigs[0].status === 'smashed');
check('walk ended on the rig hex', sw.isAt(q, r));
check('target dropped', sw.target === null);
check('event', events.some(e => e.type === 'smashed' && e.rig === 0 && e.by === sw.id));
check('a smashed rig is not planted any more', engine.rigAt(q, r) === null);
done();
