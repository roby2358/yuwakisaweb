'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-16: killing a guardian deactivates its lair and doubles its loot; a cleared lair rearms after LAIR_REARM turns.
const { engine, state, A, hero, hex, enemy, lair, phases } = arena({ w: 60, h: 40, hero: [5, 5] });
const L = lair(30, 20, 'den', 1);
const gk = enemy('jackal', 30, 20, { home: L.id, guardian: true, hp: 1 });
check('a guardian exists on its lair', state.enemies.some(c => c.guardian && c.isAt(L.q, L.r)));
hero.moveTo(hex(29, 20).q, hex(29, 20).r);
const k = A.ENEMY_KINDS.jackal;
engine.attack(L.q, L.r);
check('the lair deactivates', L.active === false);
check('guardian loot is doubled', hero.pack.scrap === k.drop.scrap * 2);
hero.moveTo(hex(5, 5).q, hex(5, 5).r);
phases(A.LAIR_REARM);
check('the lair stirs again with a new guardian after LAIR_REARM turns', L.active === true && state.enemies.some(c => c.guardian && c.home === L.id && c.isAt(L.q, L.r)));
done();
