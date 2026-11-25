'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-28: every DECAY_PERIOD turns a village the hero is far from loses one trust, never below 0.
const { engine, state, A, hero, village, phases } = arena({ w: 80, h: 40, hero: [70, 30] });
const far = village(5, 10, { trust: 2 });
const near = village(68, 30, { trust: 2 });
phases(A.DECAY_PERIOD - 1);
check('no decay before a period has passed', far.trust === 2);
phases(1);
check('the neglected village loses one trust', far.trust === 1);
check('a village within NEGLECT_RADIUS does not', near.trust === 2);
phases(A.DECAY_PERIOD * 5);
check('trust floors at 0', far.trust === 0);
const neg = village(5, 30, { trust: A.START_TRUST });
phases(A.DECAY_PERIOD * 2);
check('a closed village does not decay further', neg.trust === A.START_TRUST);
done();
