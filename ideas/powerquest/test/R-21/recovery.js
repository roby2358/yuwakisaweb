'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-21: charge regenerates in the wild; an open village rests the hero; a ruin recharges fully.
const { engine, state, A, hero, village, ruin, moveHero } = arena();
hero.charge = 0; hero.hp = 5;
engine.endTurn();
check('charge regenerates by chargeRegen in the wild and hp does not', hero.charge === engine.heroStats().chargeRegen && hero.hp === 5);
const v = village(10, 10, { trust: A.OPEN_TRUST, tier: 2 });
hero.charge = 0;
engine.endTurn();
check('open village: hp += HEAL_BASE + HEAL_PER_TIER x tier, charge full', hero.hp === 5 + A.HEAL_BASE + 2 * A.HEAL_PER_TIER && hero.charge === engine.heroStats().chargeMax);
v.trust = A.OPEN_TRUST - 1;
hero.hp = 5; hero.charge = 0;
engine.endTurn();
check('closed village: no rest', hero.hp === 5 && hero.charge === engine.heroStats().chargeRegen);
moveHero(14, 10);
ruin(14, 10, null);
hero.charge = 0;
engine.endTurn();
check('a ruin hex refills charge', hero.charge === engine.heroStats().chargeMax);
done();
