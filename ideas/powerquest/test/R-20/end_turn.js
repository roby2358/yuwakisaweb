'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-20: endTurn runs the world phase, advances the turn, refills mp, clears shield.
const { engine, state, A, hero } = arena();
state.mp = 0; hero.shield = 5;
const t0 = state.turn;
const res = engine.endTurn();
check('endTurn succeeds', res.ok);
check('turn advances by one', state.turn === t0 + 1);
check('mp refills to stats.mp', state.mp === engine.heroStats().mp);
check('shield is cleared', hero.shield === 0);
check('phase returns to hero', state.phase === 'hero');
state.perkOffers.push(['tough', 'fleet', 'wired']);
check('refused while a perk offer is pending', !engine.endTurn().ok && state.turn === t0 + 1);
done();
