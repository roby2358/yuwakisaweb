// R-31: a gremlin that splats (hit by a Rocket's flier, or launched by one) is replaced at
// the end of the command by a new gremlin on a shore hex, just as a drowned one is, with its
// `spawn` after the `splat`.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
const gremlins = state => state.pieces.filter(p => p.kind === 'gremlin');
for (const [label, setup] of [
    ['a gremlin hit by a rocketed crate', ({ put, piece }) => {
        put('ROCKET', 0, 4, DIR.E); put('WALL', 6, 4); put('WALL', 6, 3); put('WALL', 5, 3); put('WALL', 5, 5); put('WALL', 4, 5);
        piece('crate', 0, 4);
        return piece('gremlin', 5, 4);
    }],
    ['a gremlin launched by a Rocket', ({ put, piece }) => {
        put('ROCKET', 0, 4, DIR.E); put('WALL', 9, 4);
        return piece('gremlin', 0, 4);
    }],
]) {
    const ctx = flatGame();
    const { state, engine } = ctx;
    const gr = setup(ctx);
    const res = engine.wait();
    const [fresh] = gremlins(state);
    const types = res.events.map(e => e.type + ':' + e.id);
    check(`${label} splats and a new one climbs out: ${types.join(' ')}`,
        gremlins(state).length === 1 && fresh.id !== gr.id &&
        types.indexOf('splat:' + gr.id) >= 0 && types.indexOf('splat:' + gr.id) < types.indexOf('spawn:' + fresh.id));
}
done();
