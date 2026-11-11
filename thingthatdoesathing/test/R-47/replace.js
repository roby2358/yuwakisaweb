// R-47: placing a card on a hex that holds a Thing replaces it, as one command and one tick:
// the old Thing is gone, the new one is last in placement order and acts in that same tick
// on a piece standing there. The hex is judged as if bare, so a Bridge over water can only
// be replaced by a water kind (a Bridge), and a Wall still can't go where a piece stands.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
const card = kind => ({ kind, color: 'white' });
{
    const { g, state, engine, put, piece } = flatGame();
    const other = put('BELT', 6, 6, DIR.E);
    put('BELT', 3, 4, DIR.W);
    const c = piece('crate', 3, 4);
    state.hand = [card('BELT'), card('WALL'), card('TRAP')];
    const turn = state.turn, count = state.things.length;
    const res = engine.place(0, 3, 4, DIR.E);
    const here = state.things.filter(t => t.q === 3 && t.r === 4);
    check('replace is legal and ticks once', res.ok && state.turn === turn + 1);
    check('one Thing on the hex, the new one', here.length === 1 && here[0].facing === DIR.E);
    check('Thing count unchanged', state.things.length === count);
    check('the new Thing goes last in placement order', state.things[count - 1] === here[0] && state.things[0] === other);
    check('it acts this tick on the crate standing there', c.isAt(4, 4));
    check('hand stays HAND_SIZE', state.hand.length === g.GameArtifacts.HAND_SIZE);
}
{
    const { state, engine, put } = flatGame();
    put('BELT', 3, 4, DIR.E);
    state.hand = [card('BELT'), card('WALL'), card('TRAP')];
    check('a Belt over a Belt (same kind, new facing)', engine.place(0, 3, 4, DIR.SE).ok && engine.thingAt(3, 4).facing === DIR.SE);
    state.hand[1] = card('WALL');
    check('a Wall replaces a Belt with nothing on it', engine.place(1, 3, 4).ok && engine.thingAt(3, 4).kind === 'WALL');
}
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E);
    piece('crate', 3, 4);
    state.hand = [card('WALL'), card('WALL'), card('WALL')];
    check('no Wall over a Belt carrying a crate', !engine.legalPlacements('WALL').has('3,4') && engine.place(0, 3, 4).ok === false);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    terrain(4, 4, T.WATER); terrain(5, 4, T.WATER);
    put('BRIDGE', 4, 4, DIR.E);
    const c = piece('crate', 4, 4);
    state.hand = [card('BELT'), card('BRIDGE'), card('WALL')];
    check('a land kind can\'t replace a Bridge on water', !engine.legalPlacements('BELT').has('4,4') && engine.place(0, 4, 4, DIR.E).ok === false);
    check('a Bridge replaces a Bridge, turned back to shore', engine.place(1, 4, 4, DIR.W).ok && engine.thingAt(4, 4).kind === 'BRIDGE');
    check('the crate on it never sinks: carried onto land', state.pieces.includes(c) && c.isAt(3, 4) && state.lost === 0);
}
done();
