// R-49: cards unlock one UNLOCKS step per milestone. A new game opens the first step only. The
// tick whose delivery reaches a milestone emits unlock{kinds} after that milestone (and after
// its open, if any) and the next step's kinds join the deck. On a board with one color, a step
// of only `colored` kinds is passed over: the unlock names the next step instead. Crossing
// several milestones at once unlocks one step per milestone, in order. Past the last step a
// milestone unlocks nothing. Cards already in hand stay as they are.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

const lineGame = size => {
    const ctx = flatGame();
    ctx.state.size = size;   // the flat board, with this size's color cap
    ctx.put('BELT', 9, 8, DIR.E);
    return ctx;
};
// Deliver one crate on the flatGame line, with `delivered` set just short of `at`.
const reach = (ctx, at) => {
    ctx.state.delivered = at - 1;
    ctx.piece('crate', 9, 8);
    return ctx.engine.wait();
};
const types = res => res.events.map(e => e.type);
const unlocks = events => events.filter(e => e.type === 'unlock').map(e => e.kinds.join('+'));

{
    const ctx = lineGame('medium');
    const { g, state, engine } = ctx;
    const { UNLOCKS, THINGS } = g.GameArtifacts;
    check('every THINGS kind is in exactly one UNLOCKS step',
        UNLOCKS.flat().length === Object.keys(THINGS).length && Object.keys(THINGS).every(k => UNLOCKS.flat().includes(k)));
    check('flatGame starts with one step open', state.unlocks === 1 &&
        engine.unlockedKinds().join() === UNLOCKS[0].join());
    const hand = JSON.stringify(state.hand);
    const res = reach(ctx, 10);
    const t = types(res);
    check(`medium, 10: milestone, open, then unlock (${t.join(' ')})`,
        t.indexOf('milestone') < t.indexOf('open') && t.indexOf('open') < t.indexOf('unlock'));
    check('medium, 10: the second step unlocks (Pusher and Puller, two colors now open)',
        unlocks(res.events).join() === UNLOCKS[1].join('+') && state.unlocks === 2 &&
        engine.drawableKinds().includes('PUSHER') && engine.drawableKinds().includes('PULLER'));
    check('the hand is kept as it was', JSON.stringify(state.hand) === hand);
    check('a tick with no milestone unlocks nothing', unlocks(engine.wait().events).length === 0);
    const r20 = reach(ctx, 20);
    check('medium, 20: the third step', unlocks(r20.events).join() === UNLOCKS[2].join('+') && state.unlocks === 3);
}
{
    const ctx = lineGame('small');
    const { g, state, engine } = ctx;
    const { UNLOCKS } = g.GameArtifacts;
    const res = reach(ctx, 10);
    check('small (1 color), 10: the all-colored step is passed over; the next one unlocks',
        UNLOCKS[1].every(k => g.GameArtifacts.THINGS[k].colored) &&
        unlocks(res.events).join() === UNLOCKS[2].join('+') && state.unlocks === 3);
    check('small: the passed-over kinds are still never drawn', !engine.drawableKinds().some(k => UNLOCKS[1].includes(k)));
    for (const m of [20, 50]) reach(ctx, m);
    check('small: the Rocket opens at 50, one step short of the end', state.unlocks === UNLOCKS.length - 1 &&
        engine.unlockedKinds().includes('ROCKET') && !engine.unlockedKinds().includes('CANNON'));
    const r100 = reach(ctx, 100);
    check('small: the Cannon is the last step, after the Rocket, opening at 100',
        UNLOCKS[UNLOCKS.length - 1].join() === 'CANNON' && UNLOCKS[UNLOCKS.length - 2].join() === 'ROCKET' &&
        unlocks(r100.events).join() === 'CANNON' && state.unlocks === UNLOCKS.length &&
        engine.drawableKinds().includes('CANNON'));
    check('past the last step a milestone unlocks nothing', unlocks(reach(ctx, 200).events).length === 0 &&
        state.unlocks === UNLOCKS.length);
}
{
    // Several milestones crossed at once (9 → 50: 10, 20 and 50): one unlock per milestone.
    const { g, state, engine } = lineGame('huge');
    const { UNLOCKS } = g.GameArtifacts;
    const events = engine.reachMilestones(9, 50);
    const t = events.filter(e => e.type === 'milestone' || e.type === 'unlock').map(e => e.type).join(' ');
    check(`9 → 50: each milestone followed by its unlock (${t})`,
        t === 'milestone unlock milestone unlock milestone unlock');
    check('9 → 50: steps 2, 3, 4 in order', unlocks(events).join() === UNLOCKS.slice(1, 4).map(s => s.join('+')).join() &&
        state.unlocks === 4);
}
done();
