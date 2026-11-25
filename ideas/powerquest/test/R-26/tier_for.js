'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-26: enemy tier rises with distance from villages and with hero level, capped at MAX_ENEMY_TIER.
const { engine, state, A, hero, village, hex } = arena({ w: 90, h: 40 });
village(5, 20, { trust: 0 });
const at = c => hex(c, 20);
check('next to a village: tier 1 at level 1', engine.tierFor(at(6)) === 1);
check('each TIER_DIST hexes adds a tier', engine.siteTier(at(5 + A.TIER_DIST)) === 2 && engine.siteTier(at(5 + 2 * A.TIER_DIST)) === 3);
hero.level = 1 + A.TIER_LEVELS;
check('each TIER_LEVELS hero levels adds a tier', engine.tierFor(at(6)) === 2);
hero.level = 99;
check('never above MAX_ENEMY_TIER', engine.tierFor(at(80)) === A.MAX_ENEMY_TIER);
state.villages[0].ruined = true;
check('with no village standing, tier counts as 1 before level', (hero.level = 1, engine.siteTier(at(6)) === 1));
const picks = new Set();
for (let i = 0; i < 200; i++) picks.add(engine.pickKind(['raider'], 2));
check('pickKind never exceeds the cap and uses the group', [...picks].every(k => A.ENEMY_KINDS[k].tier <= 2 && A.ENEMY_KINDS[k].group === 'raider'));
done();
