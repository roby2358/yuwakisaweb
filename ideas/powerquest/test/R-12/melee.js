'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-12: bumping an adjacent enemy costs MELEE_MP and deals melee damage in its spread.
const { engine, state, A, hero, hex, enemy } = arena();
const e = enemy('tusker', 11, 10), far = enemy('tusker', 14, 10);
const hp0 = e.hp;
check('a non-adjacent enemy cannot be attacked', !engine.attack(far.q, far.r).ok);
const t = hex(11, 10);
const res = engine.attack(t.q, t.r);
const dealt = hp0 - e.hp;
check('adjacent attack succeeds and spends MELEE_MP', res.ok && state.mp === A.BASE_MP - A.MELEE_MP);
check('damage is melee .. melee + DMG_SPREAD', dealt >= A.MELEE_BASE && dealt <= A.MELEE_BASE + A.DMG_SPREAD);
check('a hit event is emitted', res.events.some(ev => ev.type === 'hit' && ev.by === 'hero' && ev.dmg === dealt));
state.mp = 0;
check('no attack at 0 mp', !engine.attack(t.q, t.r).ok);
done();
