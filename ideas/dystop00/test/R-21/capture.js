// R-21: a Sweeper whose walk enters @'s hex — seen or not — sets outcome 'captured' and the
// regime phase stops (no later Sweeper moves, no sedation, no spawn).
'use strict';
const { quiet, addSweeper } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(2121);
const { g, state, engine } = ctx;
const b = engine.board;
// @ two steps along a patrol path of a Hunter, on an awake block if possible (unseen).
const start = b.passableHexes()[350];
const sw = addSweeper(ctx, start.q, start.r, 5);
let plan = g.dijkstraHexes(sw, state.hexes, engine.sweeperCostFn(sw));
const far = [...plan.cost.entries()].filter(([, c]) => c > 10)[0][0];
let path = g.pathFromPrev(plan.prev, sw.key(), far);
// Shelter @ on the path's first block if there is one (awake changes the Sweeper's costs, so
// re-plan after), else stand on the first step.
const blockStep = path.slice(1, 3).find(k => engine.board.isBlock(state.hexes.get(k)));
if (blockStep) state.hexes.get(blockStep).awake = true;
plan = g.dijkstraHexes(sw, state.hexes, engine.sweeperCostFn(sw));
path = g.pathFromPrev(plan.prev, sw.key(), far);
const { q, r } = g.Hex.fromKey(path[1]);
state.player.moveTo(q, r);
const later = addSweeper(ctx, state.stations[0].q + 1, state.stations[0].r, 0);
const laterBefore = later.key();
sw.target = { kind: 'patrol', key: far };
const events = [];
engine.regime(events);
check('captured even unseen', state.outcome === 'captured' && sw.isAt(q, r));
check('later Sweepers did not move', later.key() === laterBefore);
check('no spawn after capture', !events.some(e => e.type === 'spawned'));
check('event names the captor', events.some(e => e.type === 'captured' && e.by === sw.id));
done();
