'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-23: raiders next to a village hit it (walls subtract tier); at 0 hp it drops a tier, or is ruined at tier 0.
const { engine, state, A, hero, village, enemy } = arena({ hero: [25, 25] });
const k = A.ENEMY_KINDS.scavenger;
const v = village(10, 10, { trust: 0, tier: 2 });
const r1 = enemy('scavenger', 11, 10, { speed: 1 });
const hp0 = v.hp;
engine.endTurn();
const dmg = Math.max(A.MIN_DMG, Math.round(k.dmg * A.RAID_DAMAGE_PER_HIT) - v.tier);
const regen = A.VILLAGE_HP_REGEN + A.VILLAGE_REGEN_PER_TIER * v.tier;
check('a raid costs dmg x RAID_DAMAGE_PER_HIT minus tier (at least MIN_DMG), then the village regenerates', v.hp === Math.min(engine.villageHpMax(v), hp0 - dmg + regen));
v.hp = 1;
const res = engine.endTurn();
check('at 0 hp the village drops one tier and recovers to half hp', v.tier === 1 && v.stock === A.TIER_COSTS[1] && !v.ruined && res.events.some(e => e.type === 'villageFell' && !e.ruined));
v.tier = 0; v.stock = 0; v.hp = 1;
engine.endTurn();
check('at tier 0 it is ruined', v.ruined === true && v.hp === 0);
check('a ruined village is no longer open or raided', !engine.isOpen(v));
const before = v.hp;
engine.endTurn();
check('raiders ignore a ruined village', v.hp === before && v.ruined);
done();
