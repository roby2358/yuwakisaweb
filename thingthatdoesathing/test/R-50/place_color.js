// R-50: a Thing's color comes with its place command (D-32). colorChoices(kind) is every open
// color for a `colored` kind (Pusher, Puller) and just WHITE for every other kind. place()
// with a color from that list builds the Thing in it, and a colored Thing keeps it for good
// (rotate turns it, nothing recolors it); a colored Thing then acts only on its color's
// crates. Any other color (WHITE or a closed color for a colored kind, a crate color or none
// for a plain one) → {ok:false}, state and Rando unchanged.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, snapshot, DIR } = require('../helpers/load');

const ctx = flatGame();
const { g, state, engine } = ctx;
const { WHITE } = g.GameArtifacts;
state.targets.push({ q: 10, r: 6, color: 'blue', delivered: 0 });   // two colors open: red, blue

check('colorChoices: the open colors for a colored kind, in opening order',
    engine.colorChoices('PUSHER').join() === 'red,blue' && engine.colorChoices('PULLER').join() === 'red,blue');
check('colorChoices: just WHITE for a plain kind', ['BELT', 'WALL', 'BRIDGE', 'SLIDE'].every(k => engine.colorChoices(k).join() === WHITE));

const refused = [   // [label, card, color]
    ['a Pusher in WHITE', 'PUSHER', WHITE],
    ['a Pusher in a color not open', 'PUSHER', 'green'],
    ['a Puller with no color', 'PULLER', undefined],
    ['a Belt in a crate color', 'BELT', 'red'],
    ['a Belt with no color', 'BELT', undefined],
];
for (const [label, kind, color] of refused) {
    state.hand[0] = { kind };
    const before = snapshot(state);
    g.Rando.seed(99); const res = engine.place(0, 3, 4, DIR.E, color); const next = g.Rando.random();
    g.Rando.seed(99); const expect = g.Rando.random();
    check(`${label}: ok:false, unchanged, Rando untouched`, res.ok === false && snapshot(state) === before && next === expect);
}

state.hand[0] = { kind: 'PUSHER' };
const turn = state.turn;
const res = engine.place(0, 2, 4, DIR.E, 'blue');
const pusher = engine.thingAt(2, 4);
check('a Pusher placed in blue: the Thing is blue, one tick', res.ok && pusher.kind === 'PUSHER' && pusher.color === 'blue' && state.turn === turn + 1);
engine.rotate(2, 4);
check('turning it keeps its color', pusher.color === 'blue');
engine.rotate(2, 4); engine.rotate(2, 4); engine.rotate(2, 4); engine.rotate(2, 4); engine.rotate(2, 4);
const red = engine.addPiece('crate', 3, 4, 'red');
engine.wait();
check('it leaves a red crate in front where it is', red.isAt(3, 4));
red.color = 'blue';
engine.wait();
check('and pushes a blue one', red.isAt(4, 4));

state.hand[1] = { kind: 'BELT' };
check('a Belt placed in WHITE is white', engine.place(1, 6, 4, DIR.E, WHITE).ok && engine.thingAt(6, 4).color === WHITE);
done();
