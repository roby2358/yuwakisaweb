'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-15: a kill pays xp (revenge x2, near an open village x HOME_XP_MULT), loot (+ loot stat) and trust.
const K = require('../helpers/arena');
function killOne(setup) {
    const a = arena();
    if (setup) setup(a);
    const e = a.enemy('scavenger', 11, 10, { hp: 1 });
    if (setup && setup.slayer) e.slayer = true;
    const xp0 = a.hero.xp + (a.hero.level - 1) * 1000;
    const t = a.hex(11, 10);
    a.engine.attack(t.q, t.r);
    return { a, e };
}
const A = arena().A, k = A.ENEMY_KINDS.scavenger;
let r = killOne();
check('enemy is removed and kills counted', r.a.state.enemies.length === 0 && r.a.state.stats.kills === 1);
check('xp equals the kind xp', r.a.hero.xp === k.xp);
check('loot equals the kind drop', r.a.hero.pack.scrap === k.drop.scrap && r.a.hero.pack.cells === k.drop.cells);
r = killOne(a => { a.hero.perks = { scavenger: 2 }; });
check('the loot stat adds to each part that drops', r.a.hero.pack.scrap === k.drop.scrap + 2 && r.a.hero.pack.cells === 0);
r = killOne(a => a.village(12, 10, { trust: A.OPEN_TRUST, home: false }));
check('near an open village xp is x HOME_XP_MULT', r.a.hero.xp === Math.round(k.xp * A.HOME_XP_MULT));
check('a village within TRUST_RADIUS gains KILL_TRUST_PER_TIER x tier trust', r.a.state.villages[0].trust === A.OPEN_TRUST + A.KILL_TRUST_PER_TIER * k.tier);
r = killOne(a => a.village(10 + A.TRUST_RADIUS + 5, 10, { trust: 0 }));
check('a village beyond TRUST_RADIUS gains nothing', r.a.state.villages[0].trust === 0);
{
    const a = arena();
    const e = a.enemy('scavenger', 11, 10, { hp: 1 });
    e.slayer = true; a.state.nemeses.push(e.id);
    const t = a.hex(11, 10);
    a.engine.attack(t.q, t.r);
    check('a nemesis pays REVENGE_XP_MULT and leaves the nemeses list', a.hero.xp === k.xp * A.REVENGE_XP_MULT && a.state.nemeses.length === 0);
}
done();
