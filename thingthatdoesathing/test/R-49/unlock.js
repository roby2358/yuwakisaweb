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
    const { UNLOCKS, CARDS } = g.GameArtifacts;
    check('every card kind (THINGS and TOOLS) is in exactly one UNLOCKS step',
        UNLOCKS.flat().length === CARDS.length && CARDS.every(k => UNLOCKS.flat().includes(k)));
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
    reach(ctx, 20);
    const r50 = reach(ctx, 50);
    check('small: the Mover opens at 50, the step right after the Spring', UNLOCKS.findIndex(st => st.includes('MOVER')) ===
        UNLOCKS.findIndex(st => st.includes('SPRING')) + 1 && unlocks(r50.events).join() === 'MOVER' &&
        engine.drawableKinds().includes('MOVER') && !engine.unlockedKinds().includes('CANNON'));
    const r100 = reach(ctx, 100);
    check('small: the Cannon opens at 100, right after the Mover, before the Rocket (D-51)',
        UNLOCKS.findIndex(st => st.includes('CANNON')) === UNLOCKS.findIndex(st => st.includes('MOVER')) + 1 &&
        unlocks(r100.events).join() === 'CANNON' &&
        engine.drawableKinds().includes('CANNON') && !engine.unlockedKinds().includes('ROCKET'));
    const r200 = reach(ctx, 200);
    check('small: the Rocket opens at 200, right after the Cannon, one step short of the end',
        UNLOCKS.findIndex(st => st.includes('ROCKET')) === UNLOCKS.findIndex(st => st.includes('CANNON')) + 1 &&
        unlocks(r200.events).join() === 'ROCKET' && state.unlocks === UNLOCKS.length - 1 &&
        engine.drawableKinds().includes('ROCKET') && !engine.unlockedKinds().includes('BOMB'));
    const r500 = reach(ctx, 500);
    check('small: the Bomb is the last step, after the Rocket, opening at 500',
        UNLOCKS[UNLOCKS.length - 1].join() === 'BOMB' && UNLOCKS[UNLOCKS.length - 2].join() === 'ROCKET' &&
        unlocks(r500.events).join() === 'BOMB' && state.unlocks === UNLOCKS.length &&
        engine.drawableKinds().includes('BOMB'));
    check('past the last step a milestone unlocks nothing', unlocks(reach(ctx, 1000).events).length === 0 &&
        state.unlocks === UNLOCKS.length);
}
{
    // Several milestones crossed at once (9 → 50: 10, 20 and 50): one unlock per milestone.
    const { g, state, engine } = lineGame('huge');
    const { UNLOCKS } = g.GameArtifacts;
    const events = (state.delivered = 50, engine.reachMilestones(9, 0));
    const t = events.filter(e => e.type === 'milestone' || e.type === 'unlock').map(e => e.type).join(' ');
    check(`9 → 50: each milestone followed by its unlock (${t})`,
        t === 'milestone unlock milestone unlock milestone unlock');
    check('9 → 50: steps 2, 3, 4 in order', unlocks(events).join() === UNLOCKS.slice(1, 4).map(s => s.join('+')).join() &&
        state.unlocks === 4);
}
done();
