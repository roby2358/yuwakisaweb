// R-33: a Rocket splats gremlins. A flier stopped by a gremlin removes it (splat{id, by})
// and lands on its hex; a gremlin launched by a Rocket splats where it lands (splat with
// by null), unless it sank. Splats don't count as lost. Other pushers never splat.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { state, engine, put, piece } = flatGame();
    put('ROCKET', 0, 4, DIR.E); put('WALL', 6, 4); put('WALL', 6, 3); put('WALL', 5, 3); put('WALL', 5, 5); put('WALL', 4, 5);
    const g = piece('gremlin', 5, 4);   // boxed in, so it can't wander out of the way
    const c = piece('crate', 0, 4);
    const res = engine.wait();
    const sp = res.events.find(e => e.type === 'splat');
    check('a crate hitting a gremlin splats it and lands on its hex',
        c.isAt(5, 4) && !state.pieces.includes(g) && sp && sp.id === g.id && sp.by === c.id);
    check('a splat is not lost cargo', state.lost === 0);
}
{
    const { state, engine, put, piece } = flatGame();
    put('ROCKET', 0, 4, DIR.E); put('WALL', 9, 4);
    const g = piece('gremlin', 0, 4);
    const res = engine.wait();
    const mv = res.events.find(e => e.type === 'move' && e.id === g.id);
    const sp = res.events.find(e => e.type === 'splat' && e.id === g.id);
    check('a launched gremlin flies, then splats where it lands',
        !state.pieces.includes(g) && mv && mv.path.at(-1).q === 8 && sp && sp.by === null);
}
{
    const { state, engine, put, piece } = flatGame();
    put('ROCKET', 6, 4, DIR.E);
    const g = piece('gremlin', 6, 4);
    const res = engine.wait();
    check('a launched gremlin that drops in the water sinks instead',
        res.events.some(e => e.type === 'sink' && e.id === g.id) && !res.events.some(e => e.type === 'splat' && e.id === g.id));
}
{
    const { state, engine, put, piece } = flatGame();
    put('ROCKET', 0, 4, DIR.E); put('WALL', 1, 4);
    const g = piece('gremlin', 0, 4);
    engine.wait();
    check('a launched gremlin that can\'t move at all still splats', !state.pieces.some(p => p.id === g.id));
}
{
    const { state, engine, put, piece } = flatGame();
    put('SPRING', 0, 4, DIR.E);
    const g = piece('gremlin', 3, 4);   // the Spring's crate stops at 2, short of it
    const c = piece('crate', 0, 4);
    const res = engine.wait();
    check('a Spring stopped by a gremlin does not splat it',
        state.pieces.includes(g) && !res.events.some(e => e.type === 'splat'));
}
done();
