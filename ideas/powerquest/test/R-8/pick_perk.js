'use strict';
const { arena } = require('../helpers/arena');
const { check, done } = require('../helpers/check');

// R-8: pickPerk ranks a perk and pops the offer; while an offer is pending other hero commands are refused.
const { engine, state, A, hero, hex } = arena();
engine.gainXp(A.XP_STEP);
const offer = state.perkOffers[0].slice();
let snap = JSON.stringify(state.perkOffers);
check('a bad index is refused and changes nothing', !engine.pickPerk(9).ok && !engine.pickPerk(-1).ok && JSON.stringify(state.perkOffers) === snap);
const n = hex(11, 10);
check('move is refused while an offer is pending', !engine.move(n.q, n.r).ok);
check('endTurn is refused while an offer is pending', !engine.endTurn().ok);
const res = engine.pickPerk(1);
check('a legal pick succeeds', res.ok && hero.perks[offer[1]] === 1 && state.perkOffers.length === 0);
const gain = A.PERKS[offer[1]];
check('the perk is reflected in stats', engine.heroStats()[gain.stat] >= 1);
check('commands work again', engine.move(n.q, n.r).ok);
done();
