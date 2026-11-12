// R-61: lockstep (D-38): no two pieces stand on one hex at any hop of a tick. Replaying each
// tick's events hop by hop (test/helpers/hops.js) never finds two live pieces on a hex (a
// shot passing over, a move's first `over` hexes, doesn't count), and the events still replay
// to the board's end positions. Random play with every kind of Thing unlocked and extra
// crates scattered about to crowd the board.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, flatGame, DIR, SEEDS } = require('../helpers/load');
const { hopOverlap } = require('../helpers/hops');

function play(seed) {
    const { g, state, engine } = newGame(seed, 'small');
    const KINDS = Object.keys(g.GameArtifacts.THINGS);
    let pick = seed;
    const rnd = n => (pick = (pick * 1103515245 + 12345) % 2147483648) % n;
    for (let i = 0; i < 250; i++) {
        if (i % 4 === 0) {
            const free = engine.board.passableHexes().filter(h => engine.canEnter(h) && !engine.isEndpoint(h));
            if (free.length) { const h = free[rnd(free.length)]; engine.addPiece('crate', h.q, h.r, state.targets[0].color); }
        }
        state.hand[0] = { kind: KINDS[rnd(KINDS.length)] };
        const legal = [...engine.legalPlacements(state.hand[0].kind)];
        const color = engine.colorChoices(state.hand[0].kind)[0];
        const before = new Map(state.pieces.map(p => [p.id, { q: p.q, r: p.r }]));
        const res = legal.length && rnd(3) ? engine.place(0, ...legal[rnd(legal.length)].split(',').map(Number), rnd(6), color) : engine.wait();
        const overlap = hopOverlap(before, res.events);
        if (overlap) return `turn ${state.turn - 1}: hex ${overlap.key} at hop ${overlap.hop} holds ${overlap.ids}`;
        const keys = state.pieces.map(p => p.key());
        if (new Set(keys).size !== keys.length) return `turn ${state.turn - 1}: two pieces share a hex after the tick`;
    }
    return null;
}
for (const seed of SEEDS.slice(0, 8)) {
    const why = play(seed);
    check(`seed ${seed}: no two pieces on one hex at any hop ${why || ''}`, !why);
}
{
    // The case that used to draw overlapping: a bumped line is still leaving its hexes while
    // another mover comes in behind it. Here a Belt train follows a bump's bumper.
    const { state, engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); put('BELT', -1, 4, DIR.E); terrain(1, 4, T.ICE);
    piece('crate', -1, 4); piece('crate', 0, 4); piece('crate', 1, 4); piece('crate', 2, 4);
    const before = new Map(state.pieces.map(p => [p.id, { q: p.q, r: p.r }]));
    const { events } = engine.wait();
    check('a train behind a bump never shares a hex at any hop', !hopOverlap(before, events));
}
done();
