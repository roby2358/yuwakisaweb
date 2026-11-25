'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-13: shoot needs a weapon, range (+MESA_RANGE_BONUS on mesa) and charge; costs charge, not mp.
const { engine, state, A, hero, hex, enemy, terrain } = arena();
const w = A.MODULES[A.STARTER_MODULE];
const e3 = enemy('tusker', 10, 13), e4 = enemy('tusker', 10, 14);
const hp0 = e3.hp;
let res = engine.shoot(0, e3.q, e3.r);
check('in range: succeeds, spends the weapon cost in charge and no mp', res.ok && hero.charge === A.BASE_CHARGE - w.cost && state.mp === A.BASE_MP);
check('damage is dmg .. dmg + DMG_SPREAD', hp0 - e3.hp >= w.dmg && hp0 - e3.hp <= w.dmg + A.DMG_SPREAD);
check('out of range is refused', !engine.shoot(0, e4.q, e4.r).ok);
terrain(10, 10, A.TERRAIN.MESA);
check('on mesa the range grows by MESA_RANGE_BONUS', engine.shoot(0, e4.q, e4.r).ok);
check('an empty socket is not a weapon', !engine.shoot(1, e3.q, e3.r).ok);
hero.charge = 0;
check('no charge, no shot', !engine.shoot(0, e3.q, e3.r).ok);
done();
