// R-9: computeReachable maps every hex whose cheapest terrain cost ≤ mp to that cost; Sweeper
// and station hexes are impassable; awake blocks cost @ nothing extra; excludes @'s own hex;
// empty when mp ≤ 0 or the game is over.
'use strict';
const { quiet, addSweeper } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(5150);
const { g, state, engine } = ctx;
const p = state.player;
const nb = engine.board.neighbors(p.q, p.r).filter(h => engine.board.isPassable(h));
const reach0 = engine.computeReachable();
const ref = g.bfsHexes(p, state.hexes, h => engine.board.moveCost(h), state.mp);
ref.delete(p.key());
check('matches a terrain-cost Dijkstra', reach0.size === ref.size && [...ref].every(([k, c]) => reach0.get(k) === c));
check('excludes own hex', !reach0.has(p.key()));
addSweeper(ctx, nb[0].q, nb[0].r);
check('Sweeper hex is a wall', !engine.computeReachable().has(nb[0].key ? nb[0].key() : g.Hex.key(nb[0].q, nb[0].r)));
state.sweepers = [];
for (const h of state.hexes.values()) if (engine.board.isBlock(h)) h.awake = true;
const reachAwake = engine.computeReachable();
check('awake blocks cost @ the same', reachAwake.size === reach0.size && [...reach0].every(([k, c]) => reachAwake.get(k) === c));
const st = state.stations[0];
state.player.moveTo(...(() => { const n = engine.board.neighbors(st.q, st.r).find(h => engine.board.isPassable(h)); return [n.q, n.r]; })());
check('station hex is a wall', !engine.computeReachable().has(st.key()));
state.mp = 0;
check('empty at mp 0', engine.computeReachable().size === 0);
state.mp = 6; state.outcome = 'won';
check('empty when over', engine.computeReachable().size === 0);
done();
