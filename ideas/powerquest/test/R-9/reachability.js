'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-9: cost-limited flood from the hero; enemies are walls; empty at mp 0; hero hex excluded.
const { engine, state, A, hero, hex, terrain, enemy, g } = arena();
let reach = engine.computeReachable();
const within = [];
for (const h of new g.Hex(hero.q, hero.r).inRange(state.mp)) within.push(h.key());
check('open plains: every hex within mp is reachable at its distance', reach.size === within.length - 1 && [...reach].every(([k, c]) => c === g.hexDist(hero, g.Hex.fromKey(k))));
check('the hero hex is excluded', !reach.has(hero.key()));
terrain(11, 10, A.TERRAIN.JUNGLE);
reach = engine.computeReachable();
const j = hex(11, 10);
check('jungle costs MOVEMENT_COST', reach.get(j.q + ',' + j.r) === A.MOVEMENT_COST[A.TERRAIN.JUNGLE]);
terrain(9, 10, A.TERRAIN.MESA);
const m = hex(9, 10);
check('mesa costs MOVEMENT_COST', engine.computeReachable().get(m.q + ',' + m.r) === A.MOVEMENT_COST[A.TERRAIN.MESA]);
const e = enemy('jackal', 10, 9);
const ek = e.key();
check('an enemy hex is not reachable', !engine.computeReachable().has(ek));
terrain(10, 11, A.TERRAIN.WATER);
check('water is not reachable', !engine.computeReachable().has(hex(10, 11).q + ',' + hex(10, 11).r));
state.mp = 0;
check('empty at mp 0', engine.computeReachable().size === 0);
done();
