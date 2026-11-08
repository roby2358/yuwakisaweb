// R-19: a Sweeper walks the shortest plan path to its target, paying terrain cost +
// AWAKE_DRAG on awake blocks, with stations and other Sweepers as walls; it stops before a step
// that costs more than its remaining MP, and at its target.
'use strict';
const { quiet, addSweeper, parkPlayerAway } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(1919);
const { g, state, engine } = ctx;
const A = g.GameArtifacts, b = engine.board, H = g.Hex;

const start = b.passableHexes().find(h => h.col === 20 && h.row === 16) || b.passableHexes()[300];
const sw = addSweeper(ctx, start.q, start.r, 5);  // Hunter, the most MP
parkPlayerAway(ctx, start.q, start.r, 20);
const costFn = engine.sweeperCostFn(sw);
const plan = g.dijkstraHexes(sw, state.hexes, costFn);
// Patrol to a far reachable hex, then check the walk against the path.
const far = [...plan.cost.entries()].filter(([, c]) => c > 3 * sw.mp)[0][0];
sw.target = { kind: 'patrol', key: far };
const path = g.pathFromPrev(plan.prev, sw.key(), far);
let mp = sw.mp, i = 1;
while (i < path.length && costFn(state.hexes.get(path[i])) <= mp) { mp -= costFn(state.hexes.get(path[i])); i++; }
const events = [];
engine.walkSweeper(sw, events);
check('walks the plan path as far as MP allows', sw.key() === path[i - 1]);
check('the walk event lists the path', events[0].type === 'moved' && JSON.stringify(events[0].path) === JSON.stringify(path.slice(0, i)));

// AWAKE_DRAG: awake blocks cost terrain + AWAKE_DRAG to a Sweeper.
const blk = b.blocks()[0];
blk.awake = true;
check('awake block costs + AWAKE_DRAG', costFn(blk) === b.moveCost(blk) + A.AWAKE_DRAG);
blk.awake = false;
// Walls.
const other = addSweeper(ctx, path[path.length - 1].split(',').map(Number)[0], path[path.length - 1].split(',').map(Number)[1], 0);
check('other Sweepers are walls', engine.sweeperCostFn(sw)(state.hexes.get(other.key())) === Infinity);
check('stations are walls', costFn(state.hexes.get(state.stations[0].key())) === Infinity);
check('@ is not a wall', costFn(state.hexes.get(state.player.key())) !== Infinity);
done();
