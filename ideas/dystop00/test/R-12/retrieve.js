// R-12: retrieve() is legal when not over, phase 'player', mp ≥ PLANT_MP, and a planted rig
// stands on @'s hex; it returns that rig to 'carried' (no position) and spends PLANT_MP.
// Otherwise { ok:false } and nothing changes.
'use strict';
const { quiet, stageRig } = require('../helpers/fixtures');
const { snapshot } = require('../helpers/load');
const { check, done } = require('../helpers/check');
const { g, state, engine } = quiet(909);
const A = g.GameArtifacts;
let before = snapshot(state);
check('refused with no rig here', engine.retrieve().ok === false && snapshot(state) === before);
stageRig({ state }, 2, state.player.q, state.player.r);
const res = engine.retrieve();
check('retrieved', res.ok && res.rig === 2 && state.rigs[2].status === 'carried' && state.rigs[2].q === null);
check('spent PLANT_MP', state.mp === A.PLAYER_MP - A.PLANT_MP);
stageRig({ state }, 2, state.player.q, state.player.r);
state.mp = A.PLANT_MP - 1;
before = snapshot(state);
check('refused below PLANT_MP', engine.retrieve().ok === false && snapshot(state) === before);
state.mp = A.PLAYER_MP; state.outcome = 'won';
before = snapshot(state);
check('refused when over', engine.retrieve().ok === false && snapshot(state) === before);
done();
