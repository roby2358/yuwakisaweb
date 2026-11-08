// R-13: a move, plant, or retrieve that leaves mp = 0 runs endTurn once and returns
// { ok:true, endedTurn:true, events, outcome } with endTurn's events and outcome.
'use strict';
const { quiet, stageRig } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const A = require('../helpers/load').load().GameArtifacts;

{
    const { g, state, engine } = quiet(1201);
    const step = [...engine.computeReachable()].find(([, c]) => c === 1);
    state.mp = 1;
    const res = engine.movePlayer(...Object.values(g.Hex.fromKey(step[0])));
    check('move: endedTurn with events', res.ok && res.endedTurn && Array.isArray(res.events) && 'outcome' in res);
    check('move: turn advanced once, MP refilled', state.turn === 2 && state.mp === A.PLAYER_MP);
}
{
    const { state, engine } = quiet(1202);
    state.mp = A.PLANT_MP;
    const res = engine.plant();
    check('plant: endedTurn', res.ok && res.endedTurn && state.turn === 2);
}
{
    const ctx = quiet(1203);
    const { state, engine } = ctx;
    stageRig(ctx, 0, state.player.q, state.player.r);
    state.mp = A.PLANT_MP;
    const res = engine.retrieve();
    check('retrieve: endedTurn', res.ok && res.endedTurn && state.turn === 2);
}
{
    const { state, engine } = quiet(1204);
    const res = engine.plant();
    check('MP left: no turn end', res.ok && !res.endedTurn && state.turn === 1);
}
done();
