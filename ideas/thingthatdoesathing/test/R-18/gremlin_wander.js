// R-18: each gremlin not moved by a Thing steps to one random adjacent hex that is enterable
// and not open water, or stays put when none is; no two pieces ever share a hex.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, flatGame, SEEDS } = require('../helpers/load');
for (const seed of SEEDS.slice(0, 5)) {
    const { g, state, engine } = newGame(seed, 'small');
    const T = g.GameArtifacts.TERRAIN;
    let ok = true, distinct = true, moves = 0;
    for (let t = 0; t < 40; t++) {
        const before = new Map(state.pieces.map(p => [p.id, { q: p.q, r: p.r }]));
        engine.wait();
        for (const p of state.pieces.filter(p => p.kind === 'gremlin')) {
            const b = before.get(p.id);
            if (!b || p.isAt(b.q, b.r)) continue;
            moves++;
            const h = engine.board.get(p.q, p.r);
            // No Things here: one step, or further only if it slid off ice. Survivors are on land.
            const d = new g.Hex(b.q, b.r).distance(p);
            const fromIce = d === 1 || engine.board.get(p.q - Math.sign(p.q - b.q), p.r - Math.sign(p.r - b.r))?.terrain === T.ICE;
            if (!(h.terrain === T.PLAINS || h.terrain === T.ICE) || !fromIce) ok = false;
        }
        const keys = state.pieces.map(p => p.key());
        if (new Set(keys).size !== keys.length) distinct = false;
    }
    check(`seed ${seed}: gremlin steps land on land (${moves} moves)`, ok && moves > 0);
    check(`seed ${seed}: no two pieces share a hex`, distinct);
}
{
    const { engine, put, piece } = flatGame();
    const gr = piece('gremlin', 3, 4);
    for (const [q, r] of [[4, 4], [4, 3], [3, 3], [2, 4], [2, 5], [3, 5]]) put('WALL', q, r);
    engine.wait();
    check('a boxed-in gremlin stays put', gr.isAt(3, 4));
}
{
    const { state, engine, piece, terrain, T } = flatGame();
    const gr = piece('gremlin', 3, 4);
    for (const [q, r] of [[4, 4], [4, 3], [3, 3], [2, 4], [2, 5]]) terrain(q, r, T.WATER);
    for (let i = 0; i < 10; i++) { gr.moveTo(3, 4); engine.wait(); if (!state.pieces.includes(gr)) break; }
    check('a gremlin never walks into open water', state.pieces.includes(gr));
}
done();
