// R-64: the Bomb card (D-48). `bomb(slot, hexes)` clears 1 up to TOOLS.BOMB.wipes (3) hexes,
// each holding a Thing or a piece: the Thing is taken off (`clear{kind, q, r, hop: 0}`), the
// piece destroyed (`splat`, hop 0, `by` null): a crate's value counts as lost, a gremlin as an
// ex-gremlin (it re-emerges like any splat). Each hex's events come in the order listed, its
// clear before its splat. A source or target is never cleared itself, but what stands on one
// is. The whole bomb is one command and one tick; the card is spent (a fresh draw in its slot)
// and the idle count resets. Illegal (not a Bomb card, no hexes or more than `wipes`, a bare
// hex, a bare source or target, off the board, a hex listed twice, a bad slot): {ok:false},
// state and Rando unchanged. `legalPicks('BOMB')` is every hex holding a Thing or a piece, and
// the Bomb places nowhere.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, snapshot, DIR } = require('../helpers/load');
const card = kind => ({ kind });

{
    // Three hexes: a Belt with a crate on it, a gremlin, a Wall. One tick for the lot.
    const { g, state, engine, put, piece } = flatGame();
    const belt = put('BELT', 3, 4, DIR.E);
    const crate = piece('crate', 3, 4);
    const grem = piece('gremlin', 6, 2);
    put('WALL', 8, 6);
    const keep = put('BELT', 1, 1, DIR.E);
    state.hand = [card('BELT'), card('BOMB'), card('TRAP')];
    state.idleTicks = 5;
    const turn = state.turn, ex = state.exGremlins, lost = state.lost;
    const res = engine.bomb(1, [{ q: 3, r: 4 }, { q: 6, r: 2 }, { q: 8, r: 6 }]);
    check('a 3-hex bomb is legal and ticks once', res.ok && state.turn === turn + 1);
    check('the bombed Things are gone, the others stay', state.things.length === 1 && state.things[0] === keep && !state.things.includes(belt));
    check('the crate and the gremlin are gone', !state.pieces.includes(crate) && !state.pieces.includes(grem));
    check('the crate counts as lost', state.lost === lost + 1);
    check('the gremlin counts as an ex-gremlin and re-emerges', state.exGremlins === ex + 1 &&
        res.events.some(e => e.type === 'spawn') && state.pieces.some(p => p.kind === 'gremlin'));
    const lead = res.events.slice(0, 4).map(e => e.type + (e.kind ? ':' + e.kind : '') + (e.id !== undefined ? ':' + e.id : '')).join(' ');
    check(`the events lead, hex by hex, all at hop 0 (${lead})`,
        lead === `clear:BELT splat:${crate.id} splat:${grem.id} clear:WALL` && res.events.slice(0, 4).every(e => e.hop === 0));
    check('a clear names its hex; a splat has no culprit', res.events[0].q === 3 && res.events[0].r === 4 &&
        res.events[1].by === null && res.events[1].trap === false);
    check('the Bomb card is spent: a fresh draw in its slot, others kept',
        state.hand.length === g.GameArtifacts.HAND_SIZE && state.hand[0].kind === 'BELT' && state.hand[2].kind === 'TRAP');
    check('it counts as a card used (idle count reset)', state.idleTicks === 0);
}
{
    // One hex is enough; a big crate's whole value is lost.
    const { state, engine, piece } = flatGame();
    piece('bigcrate', 5, 5);
    state.hand = [card('BOMB'), card('BELT'), card('BELT')];
    const res = engine.bomb(0, [{ q: 5, r: 5 }]);
    check('a 1-hex bomb on a big crate: legal, lost += 10', res.ok && state.pieces.length === 0 && state.lost === 10);
}
{
    // A piece on a source or a target can be bombed; the source and target stay.
    const { state, engine, piece } = flatGame();
    const src = state.sources[0], tgt = state.targets[0];
    piece('crate', src.q, src.r);
    piece('gremlin', tgt.q, tgt.r);
    state.hand = [card('BOMB'), card('BELT'), card('BELT')];
    const res = engine.bomb(0, [{ q: src.q, r: src.r }, { q: tgt.q, r: tgt.r }]);
    check('what stands on a source and a target is cleared; they stay', res.ok &&
        !state.pieces.some(p => p.isAt(src.q, src.r) || p.isAt(tgt.q, tgt.r)) &&
        state.sources.length === 1 && state.targets.length === 1 && state.targets[0].delivered === 0);
}
{
    // Illegal: nothing changes, Rando included.
    const { g, state, engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E);
    piece('crate', 6, 4);
    put('WALL', 7, 6);
    put('TRAP', 2, 2);
    state.hand = [card('BELT'), card('BOMB'), card('MOVER')];
    const src = state.sources[0], tgt = state.targets[0];
    const before = snapshot(state);
    const tries = [
        ['a Thing card is not a Bomb', () => engine.bomb(0, [{ q: 3, r: 4 }])],
        ['a Mover is not a Bomb', () => engine.bomb(2, [{ q: 3, r: 4 }])],
        ['no hexes', () => engine.bomb(1, [])],
        ['not a list', () => engine.bomb(1, { q: 3, r: 4 })],
        ['four hexes, one over wipes', () => engine.bomb(1, [{ q: 3, r: 4 }, { q: 6, r: 4 }, { q: 7, r: 6 }, { q: 2, r: 2 }])],
        ['a bare hex among good ones', () => engine.bomb(1, [{ q: 3, r: 4 }, { q: 5, r: 5 }])],
        ['a bare source', () => engine.bomb(1, [{ q: src.q, r: src.r }])],
        ['a bare target', () => engine.bomb(1, [{ q: tgt.q, r: tgt.r }])],
        ['off the board', () => engine.bomb(1, [{ q: 3, r: 4 }, { q: 99, r: 99 }])],
        ['a missing hex', () => engine.bomb(1, [null])],
        ['the same hex twice', () => engine.bomb(1, [{ q: 3, r: 4 }, { q: 3, r: 4 }])],
        ['a bad slot', () => engine.bomb(7, [{ q: 3, r: 4 }])],
        ['place a Bomb card', () => engine.place(1, 5, 4, null, g.GameArtifacts.WHITE)],
    ];
    for (const [label, fn] of tries) {
        g.Rando.seed(99); const res = fn(); const next = g.Rando.random();
        g.Rando.seed(99); const expect = g.Rando.random();
        check(`${label}: ok:false, unchanged, Rando untouched`, res.ok === false && snapshot(state) === before && next === expect);
    }
}
{
    // Picks: every hex holding a Thing or a piece; the Bomb places nowhere.
    const { state, engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E); piece('crate', 3, 4); piece('gremlin', 6, 6);
    piece('crate', state.sources[0].q, state.sources[0].r);
    const picks = engine.legalPicks('BOMB');
    check('legalPicks(BOMB) is exactly the filled hexes, a crate on the source included',
        picks.size === 3 && picks.has('3,4') && picks.has('6,6') && picks.has(`${state.sources[0].q},${state.sources[0].r}`));
    check('the Bomb card places nowhere', engine.legalPlacements('BOMB').size === 0);
}
done();
