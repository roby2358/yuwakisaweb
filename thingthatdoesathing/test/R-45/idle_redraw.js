// R-45: every IDLE_REDRAW_TICKS ticks in a row with no card used (wait, remove, blast), one
// random hand slot is redrawn and a `redraw{slot}` event reports it; the count then starts
// over. Using a card (place, discard) resets the count. rotate doesn't tick, so it doesn't count.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
const redraws = res => res.events.filter(e => e.type === 'redraw');
{
    const { g, state, engine } = flatGame();
    const N = g.GameArtifacts.IDLE_REDRAW_TICKS;
    let early = 0;
    for (let i = 1; i < N; i++) early += redraws(engine.wait()).length;
    check('no redraw before IDLE_REDRAW_TICKS idle ticks', early === 0 && state.idleTicks === N - 1);
    const res = engine.wait();
    const [e] = redraws(res);
    check('the Nth idle tick redraws one slot in range and reports it',
        redraws(res).length === 1 && Number.isInteger(e.slot) && e.slot >= 0 && e.slot < g.GameArtifacts.HAND_SIZE &&
        state.hand.length === g.GameArtifacts.HAND_SIZE);
    check('the count starts over', state.idleTicks === 0);
}
{
    const { g, state, engine, put, piece } = flatGame();
    const N = g.GameArtifacts.IDLE_REDRAW_TICKS;
    for (let i = 1; i < N; i++) engine.wait();
    put('WALL', 3, 4);
    engine.remove(3, 4);
    check('remove counts as idle', state.idleTicks === 0);   // it was the Nth: redrawn and reset
    for (let i = 1; i < N; i++) engine.wait();
    piece('crate', 5, 4);
    const res = engine.blast(5, 4);
    check('blast counts as idle', redraws(res).length === 1);
}
{
    const { g, state, engine } = flatGame();
    const N = g.GameArtifacts.IDLE_REDRAW_TICKS;
    for (let i = 1; i < N; i++) engine.wait();
    state.hand[0] = { kind: 'BELT' };
    const res = engine.place(0, 3, 4, DIR.E, 'white');
    check('place resets the count, with no redraw', redraws(res).length === 0 && state.idleTicks === 0);
    for (let i = 1; i < N; i++) engine.wait();
    const res2 = engine.discard(1);
    check('discard resets the count, with no redraw', redraws(res2).length === 0 && state.idleTicks === 0);
    for (let i = 1; i < N; i++) engine.wait();
    engine.rotate(3, 4);
    check('rotate doesn\'t tick, so it doesn\'t count', state.idleTicks === N - 1);
}
done();
