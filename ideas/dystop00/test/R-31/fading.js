// R-31: at broadcast, an awake block falls asleep when it has fewer than FADE_THRESHOLD awake
// neighbors (counted before the phase) and lies outside the current range of every live
// (unjammed) planted rig. Wakes and fades are decided together from the pre-phase state.
// planBroadcast(rig) — the UI's "pull this rig" preview — is exactly what the broadcast does
// once that rig is gone.
'use strict';
const { quiet, interiorBlock, stageRig, addSweeper, parkPlayerAway, awakeKeys } = require('../helpers/fixtures');
const { check, done } = require('../helpers/check');
const ctx = quiet(3131);
const { g, state, engine } = ctx;
const A = g.GameArtifacts, b = engine.board;
const key = h => g.Hex.key(h.q, h.r);
const sleepAll = () => { for (const h of state.hexes.values()) h.awake = false; };
const c = interiorBlock(ctx, 1);
parkPlayerAway(ctx, c.q, c.r);

// 1. A lone awake block (no awake neighbors, no rig) falls asleep.
c.awake = true;
engine.broadcast([]);
check('a lone awake block fades', !c.awake);

// 2. A triangle of mutually adjacent blocks: each has two awake neighbors, so none fades
//    (FADE_THRESHOLD 2); a pair has one each, so both fade.
const nb = b.neighbors(c.q, c.r);
const [n1, n2] = nb.flatMap(x => nb.filter(y => new g.Hex(x.q, x.r).distance(y) === 1).map(y => [x, y]))[0];
if (A.FADE_THRESHOLD === 2) {
    sleepAll(); [c, n1, n2].forEach(h => { h.awake = true; });
    engine.broadcast([]);
    check('a triangle holds itself up', c.awake && n1.awake && n2.awake);
    sleepAll(); [c, n1].forEach(h => { h.awake = true; });
    engine.broadcast([]);
    check('a pair fades', !c.awake && !n1.awake);
}

// 3. Inside a live rig's range, nothing fades; a jammed rig holds nothing.
sleepAll();
const rig = stageRig(ctx, 0, c.q, c.r);
const inRange = b.within(c.q, c.r, engine.rigRange(rig)).filter(h => b.isBlock(h));
const lone = inRange.find(h => new g.Hex(h.q, h.r).distance(c) === engine.rigRange(rig));
sleepAll(); lone.awake = true;
const before = awakeKeys(state);
engine.broadcast([]);
check('a block in a live rig\'s range does not fade', lone.awake && before.every(k => state.hexes.get(k).awake));
sleepAll(); lone.awake = true; rig.airtime = 0;
const adj = b.neighbors(c.q, c.r).find(h => b.isPassable(h) && h !== lone);
addSweeper(ctx, adj.q, adj.r);
check('setup: the rig is jammed', engine.jammedKeys().has(key(c)));
engine.broadcast([]);
check('a jammed rig holds nothing up', !lone.awake);
state.sweepers = [];

// 4. Synchronous: compare the whole board to a rule computed from the pre-phase state.
sleepAll(); rig.airtime = 0;
let seed = 7;
for (const h of b.blocks()) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; h.awake = seed % 3 === 0; }
const jam = engine.jammedKeys();
const held = new Set(b.within(c.q, c.r, engine.rigRange(rig)).map(key));
const expect = b.blocks().filter(h => {
    const n = b.neighbors(h.q, h.r).filter(x => x.awake).length;
    if (held.has(key(h))) return h.awake || !jam.has(key(h));
    return h.awake ? n >= A.FADE_THRESHOLD : (!jam.has(key(h)) && n >= A.WAKE_THRESHOLD);
}).map(key).sort();
engine.broadcast([]);
check('wake and fade are decided together from the pre-phase state', JSON.stringify(awakeKeys(state)) === JSON.stringify(expect));

// 5. The pull preview is the rule: planBroadcast(rig) = the broadcast after pulling rig.
const plan = engine.planBroadcast(rig);
const expectFade = [...plan.fade.keys()].sort(), expectWake = [...plan.wake.keys()].sort();
const was = new Set(awakeKeys(state));
rig.status = 'carried'; rig.moveTo(null, null);
engine.broadcast([]);
const now = new Set(awakeKeys(state));
check('planBroadcast(rig) predicts the fade after pulling it',
    JSON.stringify([...was].filter(k => !now.has(k)).sort()) === JSON.stringify(expectFade));
check('planBroadcast(rig) predicts the wake after pulling it',
    JSON.stringify([...now].filter(k => !was.has(k)).sort()) === JSON.stringify(expectWake));
done();
