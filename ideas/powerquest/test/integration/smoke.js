// test/integration/smoke.js — happy-path walkthrough of a whole generated game (no rule asserted in depth).
'use strict';
const { newGame } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const { engine, state, g } = newGame(5);
const A = g.GameArtifacts;
check('a world was generated', state.hexes.size === A.MAP_COLS * A.MAP_ROWS && state.villages.length >= 3);
for (let i = 0; i < 60; i++) {
    const reach = [...engine.computeReachable().keys()];
    if (reach.length) { const [q, r] = reach[i % reach.length].split(',').map(Number); engine.move(q, r); }
    for (const k of engine.attackable()) { const [q, r] = k.split(',').map(Number); engine.attack(q, r); }
    while (state.perkOffers.length) engine.pickPerk(0);
    check('turn ' + i + ' ends', engine.endTurn().ok);
}
check('60 turns passed without breaking invariants', state.hero.hp >= 0 && state.hero.charge >= 0 && state.enemies.every(c => c.hp > 0));
done();
