// R-62: a newly opened source or target takes its hex whatever stands there (D-44): a Thing
// is removed (`clear{kind, q, r}`, no card back), a gremlin is destroyed (`splat`, +1
// exGremlins, and it re-emerges like any splat), a crate is destroyed (`splat`, `lost` + its
// value), any color, source or target. The splats come at the tick's last hop, after the
// `open`. An enhanced source clears nothing on its own hex.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

const key = h => h.q + ',' + h.r;

// A medium-capped flat board where every end-slice hex but the endpoints holds something:
// the left slice `left(h)`, the right slice `right(h)`. Everything else is walled except the
// delivery line (a Belt at 9,8 into the target at 10,8) and one far shore hex for re-emerging.
// A hex next to the line, the target or the source gets a Wall, so no gremlin moves.
const board = (seed, left, right) => {
    const ctx = flatGame();
    const { state, engine, g } = ctx;
    g.Rando.seed(seed);
    state.size = 'medium';
    const line = ['9,8', '10,8', '-3,8'];
    const nearLine = h => engine.board.neighbors(h.q, h.r).some(n => line.includes(key(n)));
    const ends = new Map();
    for (const h of engine.endSlice('left')) ends.set(key(h), nearLine(h) ? null : left);
    for (const h of engine.endSlice('right')) ends.set(key(h), nearLine(h) ? null : right);
    for (const h of engine.board.passableHexes()) {
        if (line.includes(key(h)) || key(h) === '7,1') continue;
        const fill = ends.get(key(h));
        if (fill) fill(ctx, h); else ctx.put('WALL', h.q, h.r);
    }
    ctx.put('BELT', 9, 8, DIR.E);
    ctx.piece('crate', 9, 8);
    state.delivered = 9;
    state.idleTicks = 0;
    return ctx;
};
const gremlin = (ctx, h) => ctx.piece('gremlin', h.q, h.r);
const crate = (ctx, h) => ctx.piece('crate', h.q, h.r);
const bigcrate = (ctx, h) => ctx.piece('bigcrate', h.q, h.r);

// One tick to the first milestone; what stood on each new endpoint before it.
const play = ctx => {
    const { state, engine } = ctx;
    const pieceOn = new Map(state.pieces.map(p => [key(p), p]));
    const thingOn = new Map(state.things.map(t => [key(t), t]));
    const sourcesBefore = state.sources.length;
    const was = { lost: state.lost, ex: state.exGremlins, hand: state.hand.map(c => c.kind).join() };
    const res = engine.wait();
    const open = res.events.find(e => e.type === 'open');
    const fresh = open ? [open.target, ...(state.sources.length > sourcesBefore ? [open.source] : [])] : [];
    return { res, open, fresh, pieceOn, thingOn, was, enhanced: open && state.sources.length === sourcesBefore };
};

const bare = (ctx, h) => !ctx.engine.thingAt(h.q, h.r) && !ctx.engine.pieceAt(h.q, h.r);
const lastHop = res => Math.max(...res.events.filter(e => e.type === 'move').map(e => e.hop + e.path.length - 1));

let gremlins = 0, things = 0, bigs = 0, enhanced = 0, fresh = 0;
for (let seed = 1; seed <= 30; seed++) {
    const ctx = board(seed, bigcrate, gremlin);
    const { state } = ctx;
    const { res, open, pieceOn, thingOn, was, enhanced: enh } = play(ctx);
    if (!open) { check(`seed ${seed}: every end hex occupied, the color still opens`, false); continue; }
    const tgt = open.target;
    const ok = [bare(ctx, tgt)];
    const splats = res.events.filter(e => e.type === 'splat');
    const clears = res.events.filter(e => e.type === 'clear');
    const after = res.events.slice(res.events.indexOf(open) + 1);
    const g = pieceOn.get(key(tgt));
    const t = thingOn.get(key(tgt));
    if (g) {
        gremlins++;
        const sp = splats.find(e => e.id === g.id);
        ok.push(!!sp && after.includes(sp) && sp.hop === lastHop(res) && !sp.trap && sp.by === null,
            state.exGremlins === was.ex + 1, res.events.some(e => e.type === 'spawn'),
            !state.pieces.some(p => p.id === g.id));
    }
    if (t) {
        things++;
        ok.push(clears.some(e => after.includes(e) && e.kind === t.kind && e.q === tgt.q && e.r === tgt.r),
            !state.things.includes(t));
    }
    if (enh) {
        enhanced++;
        ok.push(state.lost === was.lost, splats.length === (g ? 1 : 0), clears.length === (t ? 1 : 0));
    } else {
        fresh++;
        const src = open.source;
        const b = pieceOn.get(key(src));
        const w = thingOn.get(key(src));
        ok.push(bare(ctx, src));
        if (b) bigs++;
        if (b) ok.push(splats.some(e => e.id === b.id && after.includes(e)), state.lost === was.lost + 10);
        if (w) ok.push(clears.some(e => e.kind === w.kind && e.q === src.q && e.r === src.r));
    }
    ok.push(state.hand.map(c => c.kind).join() === was.hand);
    check(`seed ${seed}: the new ${enh ? 'target' : 'source and target'} cleared, tallies right, no card back`,
        ok.every(x => x));
}
check(`a gremlin cleared (${gremlins}), a Thing cleared (${things}), a big crate cleared (+10 lost, ${bigs})`,
    gremlins > 0 && things > 0 && bigs > 0);
check(`enhanced sources (${enhanced}) and new sources (${fresh}) both seen`, enhanced > 0 && fresh > 0);

{
    // A crate on the new target is destroyed and lost, whatever its color.
    let seen = 0, right = 0;
    for (let seed = 1; seed <= 10; seed++) {
        const ctx = board(seed, crate, crate);
        const { res, open, pieceOn, fresh, was } = play(ctx);
        const hit = fresh.map(h => pieceOn.get(key(h))).filter(p => p);
        if (!hit.length) continue;
        seen++;
        if (ctx.state.lost === was.lost + hit.length && hit.every(p => res.events.some(e => e.type === 'splat' && e.id === p.id)) &&
            fresh.every(h => bare(ctx, h)) && ctx.state.exGremlins === was.ex) right++;
    }
    check(`crates on the new endpoints: destroyed, +1 lost each, no ex-gremlin (${right}/${seen})`, seen > 0 && right === seen);
}
done();
