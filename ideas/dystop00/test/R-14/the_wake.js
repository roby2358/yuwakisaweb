// R-14: at broadcast, exactly these blocks wake: sleeping, unjammed BLOCKs within TX_RANGE of a
// planted rig that is itself unjammed, or with ≥ WAKE_THRESHOLD awake neighbors counted
// before the phase (synchronous: one ring per broadcast). Non-blocks never wake.
'use strict';
const { NO_FADE, quiet, interiorBlock, stageRig, parkPlayerAway, awakeKeys } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(3030, NO_FADE);   // fading is R-31's rule
const { g, state, engine } = ctx;
const A = g.GameArtifacts, b = engine.board;

// 1. A rig wakes every block within TX_RANGE, nothing else.
const c = interiorBlock(ctx, 1);
parkPlayerAway(ctx, c.q, c.r);
stageRig(ctx, 0, c.q, c.r);
engine.broadcast([]);
const expect = b.within(c.q, c.r, A.TX_RANGE).filter(h => b.isBlock(h)).map(h => h.q + ',' + h.r).sort();
check('rig wakes exactly the blocks in TX_RANGE', JSON.stringify(awakeKeys(state)) === JSON.stringify(expect));
check('no non-block is awake', [...state.hexes.values()].every(h => !h.awake || b.isBlock(h)));

// 2. Threshold spread: compute the expected next ring from the pre-phase state.
state.rigs[0].status = 'carried'; state.rigs[0].moveTo(null, null);
const before = new Set(awakeKeys(state));
const next = b.blocks().filter(h => !h.awake &&
    b.neighbors(h.q, h.r).filter(n => n.awake).length >= A.WAKE_THRESHOLD).map(h => h.q + ',' + h.r);
engine.broadcast([]);
const after = awakeKeys(state);
check('spread wakes exactly the sleeping blocks with ≥ WAKE_THRESHOLD awake neighbors',
    JSON.stringify(after) === JSON.stringify([...before, ...next].sort()));

// 3. A one-wide line does not carry: a block with exactly one awake neighbor stays asleep
//    (when WAKE_THRESHOLD ≥ 2), unless the rig rule applies.
const lone = b.blocks().find(h => !h.awake && b.neighbors(h.q, h.r).filter(n => n.awake).length === 1);
if (lone && A.WAKE_THRESHOLD >= 2) {
    for (const h of state.hexes.values()) h.awake = false;
    const nbr = b.neighbors(lone.q, lone.r).find(n => b.isBlock(n));
    nbr.awake = true;
    const others = b.neighbors(lone.q, lone.r).filter(n => n !== nbr);
    const onlyOne = others.every(n => !n.awake);
    engine.broadcast([]);
    check('one awake neighbor is not enough', onlyOne && !lone.awake);
}
done();
