// R-30: milestones run 10, 20, 50, 100, 200, 500, 1000, … (the 1-2-5 series from
// FIRST_MILESTONE) with no last one. The tick whose deliveries reach a milestone emits one
// `milestone` event for it; other ticks emit none. Reaching one ends nothing: commands
// keep working.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
const { g, state, engine, put, piece } = flatGame();
const { nextMilestone, FIRST_MILESTONE } = g.GameArtifacts;

const series = [];
for (let m = nextMilestone(0); series.length < 9; m = nextMilestone(m)) series.push(m);
check('series: ' + series.join(', '),
    JSON.stringify(series) === JSON.stringify([10, 20, 50, 100, 200, 500, 1000, 2000, 5000]) && series[0] === FIRST_MILESTONE);
check('a milestone already reached points at the next one', nextMilestone(10) === 20 && nextMilestone(19) === 20);

const milestones = res => res.events.filter(e => e.type === 'milestone');
const deliverOne = () => { piece('crate', 9, 8); return engine.wait(); };
put('BELT', 9, 8, DIR.E);   // the target is (10, 8) in flatGame

state.delivered = FIRST_MILESTONE - 2;
check('a delivery short of a milestone: no milestone event', milestones(deliverOne()).length === 0);
const res = deliverOne();
check('the delivery that reaches 10: one milestone event {count: 10}',
    JSON.stringify(milestones(res)) === JSON.stringify([{ type: 'milestone', count: 10 }]) && state.delivered === 10);
check('a tick with no delivery: no milestone event', milestones(engine.wait()).length === 0);

state.delivered = 99;
check('99 → 100 emits {count: 100}', milestones(deliverOne()).map(e => e.count).join() === '100');
state.hand[0] = 'BELT';
check('play goes on past a milestone', engine.wait().ok && engine.place(0, 3, 4, 0).ok);
done();
