// R-10: rotate(q,r) on a Thing with a facing (Belt, Spring, Rocket, Pusher, Puller, Bridge) turns its facing
// clockwise ((f+5) mod 6) and doesn't tick: events is empty, and turn, pieces (a free gremlin
// would wander on a tick), hand and timers are untouched. On a fixture or an empty hex →
// {ok:false}, unchanged.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, snapshot } = require('../helpers/load');
const { state, engine, put, piece } = flatGame();
piece('gremlin', 6, 6);
for (const kind of ['BELT', 'SPRING', 'ROCKET', 'CANNON', 'PUSHER', 'PULLER', 'BRIDGE']) {
    state.things = [];
    const t = put(kind, 3, 4, 0);
    const before = snapshot(state);
    const res = engine.rotate(3, 4);
    check(`${kind}: E → SE (clockwise)`, res.ok && t.facing === 5);
    t.facing = 0;
    check(`${kind}: no tick (no events, nothing else changed)`, res.events.length === 0 && snapshot(state) === before);
    t.facing = 5;
    engine.rotate(3, 4);
    check(`${kind}: SE → SW`, t.facing === 4);
}
put('WALL', 5, 4);
for (const [label, q, r] of [['a wall', 5, 4], ['an empty hex', 7, 4]]) {
    const before = snapshot(state);
    check(`${label}: ok:false, unchanged`, engine.rotate(q, r).ok === false && snapshot(state) === before);
}
done();
