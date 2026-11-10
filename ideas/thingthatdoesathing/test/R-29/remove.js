// R-29: remove(q,r) takes the Thing at (q,r) off the board and ticks once; the hand is
// untouched (the card is spent). A piece left on open water by a removed Bridge sinks first
// (counted lost if cargo, a sink event leads the tick's events). On an empty hex →
// {ok:false}, unchanged.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, snapshot, DIR } = require('../helpers/load');
{
    const { state, engine, put } = flatGame();
    for (const [kind, facing] of [['BELT', DIR.E], ['SPRING', DIR.E], ['PULLER', DIR.E], ['WALL', null]]) {
        state.things = [];
        put(kind, 3, 4, facing);
        const turn = state.turn, hand = state.hand.join();
        const res = engine.remove(3, 4);
        check(`${kind}: gone, ticked once, hand unchanged`,
            res.ok && !engine.thingAt(3, 4) && state.turn === turn + 1 && state.hand.join() === hand);
    }
}
{
    const { state, engine, put, piece } = flatGame();
    put('BELT', 3, 4, DIR.E); put('BELT', 5, 4, DIR.E);
    const c = piece('crate', 4, 4);
    engine.remove(3, 4);
    check('only the Thing at (q,r) goes; the rest keep working', state.things.length === 1 && c.isAt(4, 4));
    put('BELT', 4, 4, DIR.E);
    engine.remove(4, 4);
    check('removing the mover under a piece leaves the piece in place', c.isAt(4, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    terrain(4, 4, T.WATER); put('BRIDGE', 4, 4, null);
    const c = piece('crate', 4, 4);
    const res = engine.remove(4, 4);
    check('a crate on a removed Bridge sinks and is lost',
        res.ok && !state.pieces.includes(c) && state.lost === 1);
    check('its sink event comes first', res.events[0].type === 'sink' && res.events[0].id === c.id);
}
{
    const { state, engine, put } = flatGame();
    const before = snapshot(state);
    check('an empty hex: ok:false, unchanged', engine.remove(7, 4).ok === false && snapshot(state) === before);
}
done();
