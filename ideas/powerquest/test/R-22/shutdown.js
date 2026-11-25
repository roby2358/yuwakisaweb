'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-22: at 0 hp the armor shuts down: pack and xp penalties, shelter, depleted, nemesis, protected convalescence.
const { engine, state, A, hero, village, enemy, hex, moveHero } = arena({ w: 40, h: 40, hero: [20, 20] });
const home = village(10, 10, { trust: A.OPEN_TRUST + 1, home: true });
hero.hp = 1; hero.pack = { scrap: 9, cells: 3 }; hero.xp = 11; hero.level = 3;
hero.sockets = [A.STARTER_MODULE, null, null];
const foe = enemy('brute', 21, 20, { speed: 1 });
const turn0 = state.turn;
const res = engine.endTurn();
const ev = res.events.find(e => e.type === 'shutdown');
check('a shutdown event names the attacker and the shelter', !!ev && ev.byId === foe.id && ev.shelterId === home.id);
check('hero wakes at the shelter, depleted', hero.isAt(home.q, home.r) && hero.hp === A.SHUTDOWN_HP && hero.charge === 0 && hero.shield === 0);
check('half the pack is lost, rounded against the player', hero.pack.scrap === 9 - Math.ceil(9 * A.LOSE_PACK_FRAC) && hero.pack.cells === 3 - Math.ceil(3 * A.LOSE_PACK_FRAC));
check('xp is cut but the level is kept', hero.xp === 11 - Math.ceil(11 * A.LOSE_XP_FRAC) && hero.level === 3);
check('SHUTDOWN_DAYS pass (plus the turn itself)', state.turn === turn0 + A.SHUTDOWN_DAYS + 1);
check('the attacker is the nemesis', foe.slayer && state.nemeses.includes(foe.id));
check('the shelter keeps its door open', engine.isOpen(home));
check('shutdowns are counted', state.stats.shutdowns === 1);
check('convalescing hero is sheltered', hero.sheltered === true);
const adj = enemy('brute', 11, 10, { speed: 1 });
const hp0 = hero.hp;
engine.endTurn();
check('a sheltered hero cannot be attacked', hero.hp >= hp0);
const away = hex(9, 10);
check('leaving the village ends the shelter', engine.move(away.q, away.r).ok && hero.sheltered === false);
done();
