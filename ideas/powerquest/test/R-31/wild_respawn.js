'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-31: while fewer than ROAMER_FLOOR wild creatures remain, new ones appear, never near the hero.
const { engine, state, A, hero, g } = arena({ w: 60, h: 40, hero: [30, 20] });
check('no wild creatures to start', state.enemies.length === 0);
let nearSpawn = false;
for (let i = 0; i < 120; i++) {
    const before = new Set(state.enemies.map(c => c.id));
    engine.endTurn();
    hero.hp = 999;
    // creatures born this phase have just acted? no: respawn runs after enemiesAct, so they stand where they appeared
    for (const c of state.enemies) if (!before.has(c.id) && g.hexDist(c, hero) < A.ROAMER_SPAWN_MIN_DIST) nearSpawn = true;
}
const wild = state.enemies.filter(c => !c.guardian && c.home === null);
check('the wilds refill, and never exceed ROAMER_FLOOR', wild.length > 0 && wild.length <= A.ROAMER_FLOOR);
check('nothing appears within ROAMER_SPAWN_MIN_DIST of the hero', !nearSpawn);
done();
