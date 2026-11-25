'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-17: deposit moves pack into stock, raises tier, gives bucket-capped trust, and works at closed villages.
const { engine, state, A, hero, village, hex } = arena();
const v = village(10, 10, { trust: A.START_TRUST });
hero.pack = { scrap: 40, cells: 5 };
check('zero, negative, fractional and too-large amounts are refused', !engine.deposit(0, 0).ok && !engine.deposit(-1, 2).ok && !engine.deposit(1.5, 0).ok && !engine.deposit(41, 0).ok);
let res = engine.deposit(8, 0);
check('a closed village accepts a gift', res.ok && v.stock === 8 && hero.pack.scrap === 32);
check('trust rises by value / GIFT_VALUE_PER_TRUST', v.trust === A.START_TRUST + 8 / A.GIFT_VALUE_PER_TRUST);
engine.deposit(30, 0);
check('gift trust is capped by GIFT_CAP', v.trust === A.START_TRUST + A.GIFT_CAP && v.giftBucket === 0);
check('stock paid for tier 1 and beyond', v.stock === 38 && v.tier === 2 && A.TIER_COSTS[2] <= 38 && 38 < A.TIER_COSTS[3]);
engine.deposit(0, 2);
check('a cell is worth CELL_VALUE scrap', v.stock === 38 + 2 * A.CELL_VALUE);
const away = hex(15, 10);
hero.moveTo(away.q, away.r);
check('deposit is refused away from a village', !engine.deposit(1, 0).ok);
done();
