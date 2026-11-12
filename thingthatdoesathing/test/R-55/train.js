// R-55: lockstep (D-38): every moving piece advances one hex per hop, all together, so a hex
// its occupant leaves on a hop is open to the piece behind on that same hop. A packed train
// of crates on a Belt line moves as one, whatever order the Belts were placed in.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
for (const order of ['back-to-front', 'front-to-back']) {
    const { engine, put, piece } = flatGame();
    const qs = [0, 1, 2, 3, 4, 5, 6, 7];
    (order === 'back-to-front' ? [...qs].reverse() : qs).forEach(q => put('BELT', q, 4, DIR.E));
    const train = [0, 1, 2].map(q => piece('crate', q, 4));
    const { events } = engine.wait();
    check(`${order}: the whole train advances one hex in one tick`, train.every((c, i) => c.isAt(i + 1, 4)));
    check(`${order}: … every car moves on hop 1`, train.every(c => events.find(e => e.type === 'move' && e.id === c.id).hop === 1));
    engine.wait(); engine.wait();
    check(`${order}: three ticks on it is still packed`, train.every((c, i) => c.isAt(i + 3, 4)));
}
done();
