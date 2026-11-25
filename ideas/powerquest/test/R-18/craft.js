'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-18: craft needs an open village, the blueprint, village tier >= module tier - 1 and the parts.
const { engine, state, A, hero, village } = arena();
const v = village(10, 10, { trust: A.OPEN_TRUST, tier: 0 });
hero.pack = { scrap: 30, cells: 10 };
hero.blueprints.push('plating', 'long_rail', 'mender');
check('canCraft is null when everything is in order', engine.canCraft('plating') === null);
let res = engine.craft('plating', 1);
check('craft fills the socket and spends the price', res.ok && hero.sockets[1] === 'plating' && hero.pack.scrap === 30 - A.MODULES.plating.price.scrap);
check('crafting a passive module changes stats', engine.heroStats().armor === A.MODULES.plating.amount);
check('unknown blueprint refused', !engine.craft('aegis', 1).ok);
check('village tier too low refused (long_rail needs tier 2)', !engine.craft('long_rail', 1).ok && engine.canCraft('long_rail') === 'village tier too low');
check('a bad socket is refused', !engine.craft('mender', 7).ok && !engine.craft('mender', -1).ok);
res = engine.craft('mender', 1);
check('a module replaces whatever was in the socket (tier 2 needs village tier 1)', !res.ok);
v.tier = 1;
check('with village tier 1 the tier-2 module crafts and replaces', engine.craft('mender', 1).ok && hero.sockets[1] === 'mender');
hero.pack = { scrap: 0, cells: 0 };
check('not enough parts refused', !engine.craft('plating', 1).ok);
hero.pack = { scrap: 30, cells: 10 };
v.trust = A.OPEN_TRUST - 1;
check('a closed village refuses', !engine.craft('plating', 1).ok);
done();
