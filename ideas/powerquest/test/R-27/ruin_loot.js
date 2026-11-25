'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-27: entering an unlooted ruin gives its blueprint, RUIN_CELLS cells and DISCOVERY_XP, once.
const { engine, state, A, hero, ruin, hex } = arena();
const ru = ruin(12, 10, 'scope');
const t = hex(12, 10);
const res = engine.move(t.q, t.r);
check('the blueprint is learned', hero.blueprints.includes('scope'));
check('cells and xp are paid', hero.pack.cells === A.RUIN_CELLS && hero.xp === A.DISCOVERY_XP);
check('the ruin is looted and a loot event emitted', ru.looted && res.events.some(e => e.type === 'loot' && e.blueprint === 'scope'));
const back = hex(13, 10);
engine.move(back.q, back.r);
engine.move(t.q, t.r);
check('looting happens once', hero.pack.cells === A.RUIN_CELLS && hero.xp === A.DISCOVERY_XP);
const ru2 = ruin(14, 10, 'scope');
engine.move(hex(14, 10).q, hex(14, 10).r);
check('a known blueprint pays extra cells instead', hero.pack.cells === A.RUIN_CELLS * 3 && hero.blueprints.filter(b => b === 'scope').length === 1);
done();
