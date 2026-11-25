'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-19: founding needs plains, parts, distance from villages, and trust nearby (or no open village at all).
const { engine, state, A, hero, village, moveHero, terrain, hex } = arena({ w: 70, h: 40, hero: [40, 20] });
hero.pack = { scrap: A.FOUND_SCRAP, cells: A.FOUND_CELLS };
const v = village(40 - A.FOUND_MIN_DIST - 2, 20, { trust: A.FOUND_TRUST });
check('trusted village in range, parts held: legal', engine.canFound() === null);
const t0 = state.villages.length;
let res = engine.found();
check('found creates a tier-0 village with FOUNDER_TRUST and spends the parts', res.ok && state.villages.length === t0 + 1 && state.villages[t0].tier === 0 && state.villages[t0].trust === A.FOUNDER_TRUST && hero.pack.scrap === 0 && hero.pack.cells === 0);
hero.pack = { scrap: A.FOUND_SCRAP, cells: A.FOUND_CELLS };
check('on a site (the new village) is refused', !engine.found().ok);
moveHero(40 + 3, 20);
check('too close to a village is refused', engine.canFound() === 'too close to a village');
moveHero(40, 10);
terrain(40, 10, A.TERRAIN.JUNGLE);
check('not on plains is refused', engine.canFound() === 'must be on plains');
terrain(40, 10, A.TERRAIN.PLAINS);
hero.pack = { scrap: A.FOUND_SCRAP - 1, cells: A.FOUND_CELLS };
check('too few parts is refused', engine.canFound() === 'not enough parts');
hero.pack = { scrap: A.FOUND_SCRAP, cells: A.FOUND_CELLS };
state.villages.forEach(x => x.trust = A.FOUND_TRUST - 1);
state.villages.forEach(x => { x.trust = A.OPEN_TRUST; });
check('open villages exist but none is trusted enough: refused', engine.canFound() === 'no trusted village near enough');
state.villages.forEach(x => { x.trust = A.START_TRUST; });
check('when no village is open at all, founding is allowed', engine.canFound() === null);
done();
