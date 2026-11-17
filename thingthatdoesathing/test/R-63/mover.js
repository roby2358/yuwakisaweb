// R-63: the Mover card (D-47). `move(slot, fq, fr, q, r, facing)` picks up the Thing on
// (fq, fr) and puts it down on (q, r): same kind, same color, the new facing if it aims, last
// in placement order, judged by that kind's own place rule with it gone (so it can go back on
// its own hex, and a Thing on (q, r) is replaced). `scrap(slot, fq, fr)` picks it up and
// throws it away. Each is one command and one tick; the Mover card is spent (the slot gets a
// fresh draw) and the idle count resets. A piece left standing on open water when its Bridge
// is lifted sinks first (hop 0), unless the Bridge goes back under it. Illegal (the slot isn't
// a Mover, no Thing on the pick-up hex, an illegal landing, a missing facing for a mover):
// {ok:false}, state and Rando unchanged. `legalPicks('MOVER')` is the hexes holding a Thing;
// a Thing card picks nothing, and the Mover can't be placed.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, snapshot, DIR } = require('../helpers/load');
const card = kind => ({ kind });

{
    // Move a Belt: same kind, new hex and facing, last in order, acts this tick.
    const { g, state, engine, put, piece } = flatGame();
    const belt = put('BELT', 3, 4, DIR.E);
    const other = put('WALL', 8, 6);
    const c = piece('crate', 6, 4);
    state.hand = [card('BELT'), card('MOVER'), card('TRAP')];
    state.idleTicks = 5;
    const turn = state.turn;
    const res = engine.move(1, 3, 4, 6, 4, DIR.SE);
    const moved = engine.thingAt(6, 4);
    check('move is legal and ticks once', res.ok && state.turn === turn + 1);
    check('the old hex is bare', !engine.thingAt(3, 4));
    check('same kind on the new hex, new facing', moved && moved.kind === 'BELT' && moved.facing === DIR.SE && moved.color === g.GameArtifacts.WHITE);
    check('the Thing count is unchanged', state.things.length === 2 && !state.things.includes(belt));
    check('the moved Thing is last in placement order', state.things[0] === other && state.things[1] === moved);
    check('it acts this tick on the piece standing there', c.isAt(6, 5));
    check('the Mover card is spent: a fresh draw in its slot, others kept',
        state.hand.length === g.GameArtifacts.HAND_SIZE && state.hand[0].kind === 'BELT' && state.hand[2].kind === 'TRAP');
    check('it counts as a card used (idle count reset)', state.idleTicks === 0);
}
{
    // A colored Thing keeps its color; it can go back on its own hex with a new facing.
    const { state, engine, putIn } = flatGame();
    state.targets.push({ q: 10, r: 7, color: 'blue', delivered: 0 });
    putIn('blue', 'PUSHER', 3, 4, DIR.E);
    state.hand = [card('MOVER'), card('MOVER'), card('MOVER')];
    check('a blue Pusher moves and stays blue', engine.move(0, 3, 4, 5, 2, DIR.W).ok &&
        engine.thingAt(5, 2).kind === 'PUSHER' && engine.thingAt(5, 2).color === 'blue');
    check('back onto its own hex, turned', engine.move(1, 5, 2, 5, 2, DIR.NE).ok &&
        engine.thingAt(5, 2).facing === DIR.NE && state.things.length === 1);
}
{
    // A Thing on the landing hex is replaced; a Wall can't land on a piece; a non-aimer needs no facing.
    const { state, engine, put, piece } = flatGame();
    put('WALL', 3, 4);
    put('BELT', 5, 4, DIR.E);
    piece('crate', 7, 4);
    state.hand = [card('MOVER'), card('MOVER'), card('MOVER')];
    const before = snapshot(state);
    check('no Wall onto a crate', engine.move(0, 3, 4, 7, 4, null).ok === false && snapshot(state) === before);
    check('a Wall replaces the Belt', engine.move(0, 3, 4, 5, 4, null).ok &&
        engine.thingAt(5, 4).kind === 'WALL' && engine.thingAt(5, 4).facing === null && state.things.length === 1);
}
{
    // Scrap: the Thing is gone, the card spent, one tick.
    const { g, state, engine, put } = flatGame();
    put('SPRING', 3, 4, DIR.E);
    state.hand = [card('MOVER'), card('BELT'), card('BELT')];
    const turn = state.turn;
    const res = engine.scrap(0, 3, 4);
    check('scrap is legal and ticks once', res.ok && state.turn === turn + 1);
    check('the Thing is gone, nothing else built', state.things.length === 0);
    check('the card is spent: its slot redrawn, hand full', state.hand.length === g.GameArtifacts.HAND_SIZE &&
        state.hand[1].kind === 'BELT' && state.hand[2].kind === 'BELT' && state.idleTicks === 0);
}
{
    // Lifting a Bridge: the crate on it sinks (hop 0, first), unless the Bridge goes back under it.
    const { state, engine, put, piece, terrain, T } = flatGame();
    terrain(4, 4, T.WATER); terrain(4, 2, T.WATER);
    put('BRIDGE', 4, 4, DIR.E);
    const c = piece('crate', 4, 4);
    state.hand = [card('MOVER'), card('MOVER'), card('MOVER')];
    const res = engine.move(0, 4, 4, 4, 2, DIR.E);
    check('the Bridge moves to the other water hex', res.ok && engine.thingAt(4, 2).kind === 'BRIDGE');
    check('the crate it left sinks first, at hop 0, lost', !state.pieces.includes(c) && state.lost === 1 &&
        res.events[0].type === 'sink' && res.events[0].id === c.id && res.events[0].hop === 0);
    const d = piece('crate', 4, 2);
    check('a Bridge put back on its own hex keeps its crate (carried off it)', engine.move(1, 4, 2, 4, 2, DIR.W).ok &&
        state.pieces.includes(d) && d.isAt(3, 2) && state.lost === 1);
    const e = piece('crate', 4, 2);
    const s = engine.scrap(2, 4, 2);
    check('scrapping a Bridge under a crate sinks it', s.ok && !state.pieces.includes(e) && s.events[0].type === 'sink' && state.lost === 2);
}
{
    // Illegal: nothing changes, Rando included.
    const { g, state, engine, put, terrain, T } = flatGame();
    put('BELT', 3, 4, DIR.E);
    terrain(6, 4, T.WATER);
    state.hand = [card('BELT'), card('MOVER'), card('TRAP')];
    const before = snapshot(state);
    const tries = [
        ['a Thing card is not a Mover', () => engine.move(0, 3, 4, 5, 4, DIR.E)],
        ['no Thing on the pick-up hex', () => engine.move(1, 4, 4, 5, 4, DIR.E)],
        ['a land Thing onto water', () => engine.move(1, 3, 4, 6, 4, DIR.E)],
        ['off the board', () => engine.move(1, 3, 4, 99, 99, DIR.E)],
        ['onto a target', () => engine.move(1, 3, 4, 10, 8, DIR.E)],
        ['a mover with no facing', () => engine.move(1, 3, 4, 5, 4, null)],
        ['a bad slot', () => engine.move(7, 3, 4, 5, 4, DIR.E)],
        ['scrap with a Thing card', () => engine.scrap(0, 3, 4)],
        ['scrap a bare hex', () => engine.scrap(1, 5, 5)],
        ['place a Mover card', () => engine.place(1, 5, 4, null, g.GameArtifacts.WHITE)],
    ];
    for (const [label, fn] of tries) {
        g.Rando.seed(99); const res = fn(); const next = g.Rando.random();
        g.Rando.seed(99); const expect = g.Rando.random();
        check(`${label}: ok:false, unchanged, Rando untouched`, res.ok === false && snapshot(state) === before && next === expect);
    }
}
{
    // Picks: the Mover takes any hex holding a Thing; a Thing card takes none; the Mover places nowhere.
    const { state, engine, put } = flatGame();
    put('BELT', 3, 4, DIR.E); put('WALL', 6, 6);
    const picks = engine.legalPicks('MOVER');
    check('legalPicks(MOVER) is exactly the Thing hexes', picks.size === 2 && picks.has('3,4') && picks.has('6,6'));
    check('a Thing card picks nothing', engine.legalPicks('BELT').size === 0);
    check('the Mover card places nowhere', engine.legalPlacements('MOVER').size === 0);
}
done();
