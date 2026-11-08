// R-30: endTurn's events describe the state change: 'woke' keys are exactly the blocks that
// became awake at broadcast; 'faded' keys exactly those that fell asleep at broadcast; each 'moved' path starts at the Sweeper's pre-turn hex and ends at
// its post-move hex; 'spawned' ids are the new Sweepers; 'recalled' ids are gone.
'use strict';
const { newGame } = require('../helpers/load');
const { check, done } = require('../helpers/check');
const { g, state, engine } = newGame(3003);
engine.plant();
let ok = true, sawFade = false;
for (let i = 0; i < 12 && !state.outcome; i++) {
    const awakeBefore = new Set([...state.hexes.values()].filter(h => h.awake).map(h => h.q + ',' + h.r));
    const posBefore = new Map(state.sweepers.map(s => [s.id, s.key()]));
    let wokeSeen = null;
    const b = engine.broadcast.bind(engine);
    engine.broadcast = ev => { b(ev); wokeSeen = new Set([...state.hexes.values()].filter(h => h.awake).map(h => h.q + ',' + h.r)); };
    const res = engine.endTurn();
    engine.broadcast = b;
    const woke = new Set(res.events.filter(e => e.type === 'woke').flatMap(e => e.keys));
    const expectWoke = [...wokeSeen].filter(k => !awakeBefore.has(k));
    if (woke.size !== expectWoke.length || !expectWoke.every(k => woke.has(k))) ok = false;
    const faded = new Set(res.events.filter(e => e.type === 'faded').flatMap(e => e.keys));
    const expectFaded = [...awakeBefore].filter(k => !wokeSeen.has(k));
    if (faded.size !== expectFaded.length || !expectFaded.every(k => faded.has(k))) ok = false;
    if (expectFaded.length) sawFade = true;
    const moved = res.events.filter(e => e.type === 'moved');
    const posAfterMove = new Map(moved.map(e => [e.id, e.path[e.path.length - 1]]));
    for (const e of moved) if (e.path[0] !== posBefore.get(e.id)) ok = false;
    for (const s of state.sweepers) if (posAfterMove.has(s.id) && posAfterMove.get(s.id) !== s.key()) ok = false;
    for (const e of res.events.filter(e => e.type === 'spawned'))
        if (posBefore.has(e.id) || !state.sweepers.some(s => s.id === e.id && s.key() === e.key)) ok = false;
    for (const e of res.events.filter(e => e.type === 'recalled'))
        if (state.sweepers.some(s => s.id === e.id)) ok = false;
    if (i === 4) engine.plant();
    if (i === 7) {   // stage a lone awake block out of every rig's range, so the next broadcast fades it
        const lone = engine.board.blocks().find(h => !h.awake &&
            engine.board.neighbors(h.q, h.r).every(n => !n.awake) &&
            engine.plantedRigs().every(r => new g.Hex(r.q, r.r).distance(h) > engine.rigRange(r) + 1));
        if (lone) lone.awake = true;
    }
}
check('setup: some block faded (a lone block staged on turn 8)', sawFade);
check('events match the state change over 12 turns', ok);
done();
