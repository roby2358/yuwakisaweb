'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-14: active modules spend charge for heal/shield; boost converts charge to mp.
const { engine, state, A, hero } = arena();
hero.sockets = ['mender', 'aegis', null];
hero.hp = 5;
let res = engine.activate(0);
check('mender heals by its amount and costs charge', res.ok && hero.hp === 5 + A.MODULES.mender.amount && hero.charge === A.BASE_CHARGE - A.MODULES.mender.cost);
hero.hp = engine.heroStats().hpMax - 1;
engine.activate(0);
check('healing is capped at hpMax', hero.hp === engine.heroStats().hpMax);
res = engine.activate(1);
check('aegis adds shield', res.ok && hero.shield === A.MODULES.aegis.amount);
check('an empty socket is not an active module', !engine.activate(2).ok);
hero.charge = A.BASE_CHARGE;
const mp0 = state.mp, c0 = hero.charge;
check('boost(n) moves n charge into mp', engine.boost(2).ok && hero.charge === c0 - 2 && state.mp === mp0 + 2 * A.BOOST_MP_PER_CHARGE);
check('boost refuses 0, more than charge, and non-integers', !engine.boost(0).ok && !engine.boost(hero.charge + 1).ok && !engine.boost(1.5).ok);
hero.charge = 0;
check('no charge, no activation', !engine.activate(0).ok);
done();
