// R-31: a gremlin left on open water by a removed Bridge sinks before the tick; its newcomer
// climbs out in that same command's emerge, so the spawn comes after the sink and, like every
// tick event, before the milestone the tick's deliveries reached (only that milestone's own
// open/unlock events follow it).
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
const { state, engine, put, piece, terrain, T } = flatGame();
terrain(4, 4, T.WATER); put('BRIDGE', 4, 4);
const gr = piece('gremlin', 4, 4);
put('BELT', 9, 8, DIR.E); piece('crate', 9, 8);   // delivered this tick (target is 10,8)
state.delivered = 9;                               // … reaching the first milestone
const res = engine.remove(4, 4);
const types = res.events.map(e => e.type);
const spawn = res.events.findIndex(e => e.type === 'spawn');
check(`sink first, then the spawn, then the milestone: ${types.join(' ')}`,
    types[0] === 'sink' && res.events[0].id === gr.id && spawn > 0 && spawn < types.indexOf('milestone') &&
    types.slice(types.indexOf('milestone') + 1).every(t => t === 'open' || t === 'unlock'));
done();
