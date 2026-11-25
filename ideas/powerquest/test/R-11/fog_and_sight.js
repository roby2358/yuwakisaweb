'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-11: sight radius by terrain, explored hexes, jungle-hidden sites, enemy visibility.
const { engine, state, A, hero, hex, terrain, enemy, ruin, g } = arena();
const T = A.TERRAIN;
check('sight on plains is BASE_SIGHT', engine.sightRadius() === A.BASE_SIGHT);
terrain(10, 10, T.MESA);
check('mesa adds MESA_SIGHT_BONUS', engine.sightRadius() === A.BASE_SIGHT + A.MESA_SIGHT_BONUS);
terrain(10, 10, T.JUNGLE);
check('jungle subtracts JUNGLE_SIGHT_PENALTY (not below MIN_SIGHT)', engine.sightRadius() === Math.max(A.MIN_SIGHT, A.BASE_SIGHT - A.JUNGLE_SIGHT_PENALTY));
terrain(10, 10, T.PLAINS);
engine.reveal();
const inR = new g.Hex(hero.q, hero.r).inRange(A.BASE_SIGHT);
check('every hex inside sight is explored', inR.every(h => !state.hexes.has(h.key()) || state.explored[h.key()] === 1));
check('hexes outside sight are not', !state.explored[hex(10, 10 + A.BASE_SIGHT + 2).q + ',' + (10 + A.BASE_SIGHT + 2)]);
const near = ruin(10, 13), far = ruin(10, 16);
engine.reveal();
check('a ruin inside sight is discovered, one outside is not', near.discovered && !far.discovered);
const hid = ruin(13, 10);
terrain(13, 10, T.JUNGLE);
engine.reveal();
check('a jungle site beyond JUNGLE_HIDE_RADIUS stays hidden', !hid.discovered);
const foeNear = enemy('jackal', 10, 12), foeFar = enemy('jackal', 10, 18);
const vis = engine.visibleEnemies();
check('enemies inside sight are visible, outside are not', vis.includes(foeNear) && !vis.includes(foeFar));
done();
