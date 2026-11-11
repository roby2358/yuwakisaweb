// R-52: a big crate is a crate worth PIECES.bigcrate.value (10). A spawn is a big crate with
// bigCrateChance(milestones reached) = m / (m + BIG_CRATE_HALF): 0 before the first
// milestone (and no Rando roll then), rising toward 1 without reaching it. Delivering one adds
// its value to `delivered` and to its target's count; losing one (sunk, wrecked, blasted) adds
// its value to `lost`. It counts as one crate toward the cap, and Things move it like a crate.
// A big delivery that crosses several milestones fires each one's milestone/open/unlock in turn.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');

{
    const { g } = flatGame();
    const { bigCrateChance, BIG_CRATE_HALF, PIECES } = g.GameArtifacts;
    check('values: crate 1, big crate 10, gremlin 0',
        PIECES.crate.value === 1 && PIECES.bigcrate.value === 10 && PIECES.gremlin.value === 0);
    const ps = [0, 1, 2, 3, 5, 10, 100, 1e6].map(bigCrateChance);
    check(`bigCrateChance rises from 0 toward 1, never 1 (${ps.map(p => p.toFixed(3)).join(' ')})`,
        ps[0] === 0 && ps.every((p, i) => i === 0 || (p > ps[i - 1] && p < 1)));
    check('half the spawns are big at BIG_CRATE_HALF milestones', bigCrateChance(BIG_CRATE_HALF) === 0.5);
}
{
    // Before the first milestone every spawn is a plain crate and the kind takes no roll.
    const { g, state, engine } = flatGame();
    state.delivered = 9;
    g.Rando.seed(99);
    const kinds = [...Array(50)].map(() => engine.spawnKind());
    const next = g.Rando.random();
    g.Rando.seed(99);
    check('below the first milestone: all crates, and Rando untouched',
        kinds.every(k => k === 'crate') && next === g.Rando.random());
    // After many milestones (5000 delivered: 9 reached) most, not all, spawns are big.
    state.delivered = 5000;
    const p = g.GameArtifacts.bigCrateChance(9);
    const big = [...Array(400)].map(() => engine.spawnKind()).filter(k => k === 'bigcrate').length / 400;
    check(`9 milestones: big share ${big.toFixed(2)} near bigCrateChance(9) = ${p.toFixed(2)}`,
        Math.abs(big - p) < 0.1 && big < 1);
}
{
    // A spawn chance past the milestones puts a big crate on the source sometimes; it counts once toward the cap.
    const { g, state, engine } = flatGame();
    state.delivered = 5000;
    let spawned = null;
    for (let i = 0; i < 40 && !spawned; i++) {
        state.pieces = [];
        state.spawnTimer = g.GameArtifacts.SPAWN_INTERVAL - 1;
        engine.wait();
        spawned = state.pieces.find(p => p.kind === 'bigcrate');
    }
    check('a tick spawns a big crate on the source', !!spawned && spawned.isAt(state.sources[0].q, state.sources[0].r));
    check('a big crate counts as one toward the cap', engine.crateCount() === state.pieces.filter(p => p.kind !== 'gremlin').length);
}
{
    // Delivered: +10 to the board and the target.
    const { state, engine, put, piece } = flatGame();
    put('BELT', 9, 8, DIR.E);   // the target is (10, 8)
    const c = piece('bigcrate', 9, 8);
    const res = engine.wait();
    check('a delivered big crate: removed, delivered +10, its target +10, a deliver event',
        !state.pieces.includes(c) && state.delivered === 10 && state.targets[0].delivered === 10 &&
        res.events.some(e => e.type === 'deliver' && e.id === c.id));
    check('… and reaching 10 that way is the milestone', res.events.some(e => e.type === 'milestone' && e.count === 10));
}
{
    // Two big crates into the target in one tick from 9 delivered: 29, crossing 10 and 20.
    const { g, state, engine, put, piece } = flatGame();
    const { UNLOCKS } = g.GameArtifacts;
    state.size = 'medium';   // two colors: the first milestone opens one, the second has none left
    put('BELT', 9, 8, DIR.E); put('BELT', 10, 7, DIR.SE);
    piece('bigcrate', 9, 8); piece('bigcrate', 10, 7);
    state.delivered = 9;
    const res = engine.wait();
    const seq = res.events.filter(e => ['milestone', 'open', 'unlock'].includes(e.type))
        .map(e => e.type === 'milestone' ? `m${e.count}` : e.type === 'unlock' ? `u:${e.kinds.join('+')}` : 'open');
    const want = ['m10', 'open', `u:${UNLOCKS[1].join('+')}`, 'm20', `u:${UNLOCKS[2].join('+')}`];
    check(`9 → 29 at once: each milestone with its open and unlock, in order (${seq.join(' ')})`,
        state.delivered === 29 && seq.join() === want.join() && state.unlocks === 3);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 3, 4, DIR.E); terrain(4, 4, T.WATER);
    piece('bigcrate', 3, 4);
    engine.wait();
    check('a sunk big crate: lost +10', state.pieces.length === 0 && state.lost === 10);
}
{
    const { state, engine, piece } = flatGame();
    piece('bigcrate', 3, 4);
    check('a blasted big crate: lost +10', engine.blast(3, 4).ok && state.lost === 10);
}
{
    const { state, engine, put, piece } = flatGame();
    [[6, 3], [5, 3], [4, 4], [4, 5], [5, 5]].forEach(([q, r]) => put('WALL', q, r));   // walls but east
    const gr = piece('gremlin', 5, 4);
    const c = piece('bigcrate', 6, 4);
    engine.wait();
    check('a big crate a gremlin wrecks: lost +10, the gremlin takes the hex',
        !state.pieces.includes(c) && gr.isAt(6, 4) && state.lost === 10);
}
{
    // Things move it like a crate: a Spring throws it 3, a Rocket 8 without splatting it.
    const { engine, put, piece } = flatGame();
    put('SPRING', 0, 4, DIR.E); const a = piece('bigcrate', 0, 4);
    put('ROCKET', 0, 6, DIR.E); const b = piece('bigcrate', 0, 6);
    engine.wait();
    check('a Spring throws it 3, a Rocket 8, unharmed', a.isAt(3, 4) && b.isAt(8, 6));
}
done();
