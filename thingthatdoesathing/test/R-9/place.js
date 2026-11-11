// R-9: a legal place() appends {kind, q, r, facing} (facing null for fixtures), refills that
// hand slot so the hand stays HAND_SIZE, and ticks once. Illegal (bad slot, bad facing for a
// mover, illegal hex) → {ok:false} and nothing changes, Rando included.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, snapshot } = require('../helpers/load');
const { g, state, engine } = flatGame();
state.hand = [{ kind: 'BELT', color: 'white' }, { kind: 'WALL', color: 'white' }, { kind: 'BRIDGE', color: 'white' }];
const turn = state.turn;
let res = engine.place(0, 3, 4, 2);
const t = state.things[0];
check('belt placed with its facing', res.ok && t.kind === 'BELT' && t.q === 3 && t.r === 4 && t.facing === 2);
check('hand refilled to HAND_SIZE', state.hand.length === g.GameArtifacts.HAND_SIZE && state.hand.every(card => card.kind in g.GameArtifacts.THINGS));
check('ticked once', state.turn === turn + 1);
state.hand[1] = { kind: 'WALL', color: 'white' };
res = engine.place(1, 5, 4, 3);
check('fixture stores facing null', res.ok && state.things[1].kind === 'WALL' && state.things[1].facing === null);

const illegal = [   // [label, hand[0], place args]
    ['slot out of range', 'BELT', [5, 6, 4, 0]],
    ['non-integer slot', 'BELT', ['0', 6, 4, 0]],
    ['mover without a facing', 'BELT', [0, 6, 4]],
    ['mover with facing 6', 'BELT', [0, 6, 4, 6]],
    ['bridge on land', 'BRIDGE', [0, 6, 4, 0]],
    ['on the target', 'BELT', [0, 10, 8, 0]],
    ['off the map', 'BELT', [0, 40, 40, 0]],
];
for (const [label, card, args] of illegal) {
    state.hand[0] = { kind: card, color: 'white' };
    const before = snapshot(state);
    // Rando untouched: the stream after the call equals a fresh stream from the same seed.
    g.Rando.seed(99); const res2 = engine.place(...args); const next = g.Rando.random();
    g.Rando.seed(99); const expect = g.Rando.random();
    check(`${label}: ok:false, unchanged, Rando untouched`,
        res2.ok === false && snapshot(state) === before && next === expect);
}
done();
