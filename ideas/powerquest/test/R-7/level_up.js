'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-7: xp crosses XP_STEP x level; sockets grow every SOCKET_LEVEL_STEP levels; no free refill.
const { engine, state, A, hero } = arena();
hero.hp = 10; hero.charge = 2;
engine.gainXp(A.XP_STEP - 1);
check('one xp short: still level 1', hero.level === 1 && hero.xp === A.XP_STEP - 1);
engine.gainXp(1);
check('level 2 at XP_STEP, xp carried over as 0', hero.level === 2 && hero.xp === 0);
check('a perk offer of PERK_OFFER distinct perks is queued', state.perkOffers.length === 1 && state.perkOffers[0].length === A.PERK_OFFER && new Set(state.perkOffers[0]).size === A.PERK_OFFER);
check('hp and charge are not refilled', hero.hp === 10 && hero.charge === 2);
engine.gainXp(A.XP_STEP * 2 + A.XP_STEP * 3);
check('one gain can cross several levels', hero.level === 4 && state.perkOffers.length === 3);
check('socket count is BASE_SOCKETS plus one per SOCKET_LEVEL_STEP levels', hero.sockets.length === A.BASE_SOCKETS + Math.floor(3 / A.SOCKET_LEVEL_STEP));
check('xpToNext is XP_STEP x level', engine.xpToNext() === A.XP_STEP * hero.level);
done();
