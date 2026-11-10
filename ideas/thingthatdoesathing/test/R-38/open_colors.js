// R-38: each milestone opens the next color until the board's MAP_SIZES `colors` cap: a
// color not open yet, coming out of an existing source (ENHANCE_CHANCE) or a new source in
// the left slice, with a new target of that color in the right slice that its source has a
// land path to, on a hex with no Thing, piece, source or target. The tick emits
// open{color, source, target} right after its milestone. With no free hex, nothing opens
// and the next milestone tries again.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

// Deliver one red crate on the flatGame line, with `delivered` set just short of `at`.
const reach = (ctx, at) => {
    ctx.state.delivered = at - 1;
    ctx.piece('crate', 9, 8);
    return ctx.engine.wait();
};
const lineGame = size => {
    const ctx = flatGame();
    ctx.state.size = size;   // the flat board, with this size's color cap
    ctx.put('BELT', 9, 8, DIR.E);
    return ctx;
};
const inSlice = (engine, end, h) => engine.endSlice(end).some(x => x.q === h.q && x.r === h.r);

{
    const ctx = lineGame('small');
    const res = reach(ctx, 10);
    check('small (1 color): a milestone opens nothing',
        !res.events.some(e => e.type === 'open') && ctx.state.targets.length === 1);
}
{
    const ctx = lineGame('medium');
    const { state, engine } = ctx;
    const res = reach(ctx, 10);
    const types = res.events.map(e => e.type);
    const open = res.events.find(e => e.type === 'open');
    check('medium: the milestone event is followed by one open event',
        !!open && types.indexOf('open') === types.indexOf('milestone') + 1);
    const t = state.targets[1];
    check('the new color was not open, and its target is in the right slice',
        open.color !== 'red' && t.color === open.color && t.delivered === 0 && inSlice(engine, 'right', t) &&
        t.q === open.target.q && t.r === open.target.r);
    const src = engine.sourceOf(open.color);
    check('its source makes it: an existing source enhanced, or a new one in the left slice',
        src.q === open.source.q && src.r === open.source.r &&
        (state.sources.length === 1 ? src.colors.join() === 'red,' + open.color : inSlice(engine, 'left', src)));
    check('its source has a land path to its target', engine.board.hasPath(src, t));
    check('the next milestone opens nothing past the cap (2)',
        !reach(ctx, 20).events.some(e => e.type === 'open') && state.targets.length === 2);
}
{
    const ctx = lineGame('huge');
    const { state } = ctx;
    for (const m of [10, 20, 50, 100]) reach(ctx, m);
    const colors = state.targets.map(t => t.color);
    check('huge: three milestones open the other three colors, then no more',
        colors.length === 4 && new Set(colors).size === 4);
    const ends = [...state.sources, ...state.targets].map(e => e.q + ',' + e.r);
    check('no two targets, and no source and target, share a hex',
        new Set(state.targets.map(t => t.q + ',' + t.r)).size === 4 &&
        state.sources.every(s => !state.targets.some(t => t.q === s.q && t.r === s.r)));
}
{
    let enhanced = 0, fresh = 0;
    for (let k = 0; k < 40; k++) {
        const ctx = lineGame('medium');
        ctx.g.Rando.seed(100 + k);
        reach(ctx, 10);
        if (ctx.state.sources.length === 1) enhanced++; else fresh++;
    }
    check(`both happen: an enhanced source (${enhanced}) and a new source (${fresh})`, enhanced > 0 && fresh > 0);
}
{
    const ctx = lineGame('medium');
    const { state, engine } = ctx;
    for (const h of engine.endSlice('right')) if (!engine.targetAt(h.q, h.r) && !engine.thingAt(h.q, h.r)) ctx.put('WALL', h.q, h.r);
    check('no free hex for a target: nothing opens',
        !reach(ctx, 10).events.some(e => e.type === 'open') && state.targets.length === 1);
    state.things = state.things.filter(t => t.kind !== 'WALL');
    check('the next milestone tries again', reach(ctx, 20).events.some(e => e.type === 'open') && state.targets.length === 2);
}
done();
