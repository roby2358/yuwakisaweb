// R-34: discard(slot) replaces that hand card with a fresh draw and runs one tick; the board
// and the other cards are untouched. A bad slot is {ok:false} with nothing changed.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, snapshot } = require('../helpers/load');
const { g, state, engine } = flatGame();
state.hand = [{ kind: 'WALL', color: 'white' }, { kind: 'BELT', color: 'white' }, { kind: 'SPRING', color: 'white' }];
const things = JSON.stringify(state.things), turn = state.turn;
const res = engine.discard(0);
check('ok, with events, and one tick', res.ok && Array.isArray(res.events) && state.turn === turn + 1);
check('the slot is redrawn from the known kinds; the others stay',
    Object.keys(g.GameArtifacts.THINGS).includes(state.hand[0].kind) && state.hand[1].kind === 'BELT' && state.hand[2].kind === 'SPRING');
check('the hand stays HAND_SIZE and no Thing is placed',
    state.hand.length === g.GameArtifacts.HAND_SIZE && JSON.stringify(state.things) === things);
const before = snapshot(state);
check('a bad slot is ok:false and changes nothing',
    [-1, 3, 1.5, undefined, null].every(s => engine.discard(s).ok === false) && snapshot(state) === before);
done();
