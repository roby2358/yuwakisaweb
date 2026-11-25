'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-6: stats = base + perk ranks + passive modules; weapons and actives add nothing.
const { engine, state, A, hero } = arena();
let s = engine.heroStats();
check('base stats', s.hpMax === A.BASE_HP && s.mp === A.BASE_MP && s.chargeMax === A.BASE_CHARGE && s.melee === A.MELEE_BASE && s.armor === 0 && s.sight === A.BASE_SIGHT && s.chargeRegen === A.CHARGE_REGEN_WILD);
hero.perks = { tough: 2, brutal: 1 };
s = engine.heroStats();
check('perk ranks multiply their amount', s.hpMax === A.BASE_HP + 2 * A.PERKS.tough.amount && s.melee === A.MELEE_BASE + A.PERKS.brutal.amount);
hero.sockets = ['plating', 'hardsuit', 'pulse_rifle'];
s = engine.heroStats();
check('passive modules add their stat', s.armor === A.MODULES.plating.amount + A.MODULES.hardsuit.amount);
check('weapons do not change stats', s.mp === A.BASE_MP && s.melee === A.MELEE_BASE + A.PERKS.brutal.amount);
done();
