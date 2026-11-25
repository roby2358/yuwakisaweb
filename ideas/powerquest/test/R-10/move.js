'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-10: move re-derives legality; legal moves spend exactly the cost; illegal ones change nothing.
const { engine, state, A, hero, hex, enemy, terrain } = arena();
const { snapshot } = require('../helpers/load');
terrain(11, 10, A.TERRAIN.JUNGLE);
enemy('jackal', 9, 10);
const before = snapshot(state);
const bad = [hex(9, 10), hex(0, 0), hex(10, 10), hex(25, 10), hex(-5, -5)];
check('enemy, edge water, own hex, out of range, off-map are all refused', bad.every(h => !engine.move(h.q, h.r).ok));
check('refusals change nothing', snapshot(state) === before);
let t = hex(11, 10);
let res = engine.move(t.q, t.r);
check('legal move succeeds, hero is there', res.ok && hero.isAt(t.q, t.r));
check('mp drops by exactly the cost', state.mp === A.BASE_MP - A.MOVEMENT_COST[A.TERRAIN.JUNGLE] && res.cost === A.MOVEMENT_COST[A.TERRAIN.JUNGLE]);
check('a move event is emitted', res.events.some(e => e.type === 'move'));
state.phase = 'world';
t = hex(12, 10);
check('move is refused outside the hero phase', !engine.move(t.q, t.r).ok);
done();
