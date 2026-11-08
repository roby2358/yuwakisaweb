// R-17: endTurn (not over) runs broadcast under phase 'broadcast', then the regime under
// phase 'regime'; if the game isn't over, turn += 1 and mp = PLAYER_MP; phase is 'player' on
// return; result { ok:true, events: [...], outcome }.
'use strict';
const { newGame } = require('../helpers/load');
const { check, done } = require('../helpers/check');
const { g, state, engine } = newGame(1717);
const phases = [];
const b = engine.broadcast.bind(engine), r = engine.regime.bind(engine);
engine.broadcast = ev => { phases.push('b:' + state.phase); return b(ev); };
engine.regime = ev => { phases.push('r:' + state.phase); return r(ev); };
state.mp = 3;
const res = engine.endTurn();
check('broadcast then regime, each under its phase', phases.join() === 'b:broadcast,r:regime');
check('turn +1, MP refilled, phase player', state.turn === 2 && state.mp === g.GameArtifacts.PLAYER_MP && state.phase === 'player');
check('result shape', res.ok === true && Array.isArray(res.events) && res.outcome === null);
done();
