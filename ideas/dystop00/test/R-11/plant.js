// R-11: plant() is legal when not over, phase 'player', mp ≥ PLANT_MP, a rig is carried, and no
// rig stands on @'s hex. It plants the first carried rig (roster order) on @'s hex and spends
// PLANT_MP, returning { ok:true, rig }. Otherwise { ok:false } and nothing changes.
'use strict';
const { quiet } = require('../helpers/fixtures');
const { snapshot } = require('../helpers/load');
const { check, done } = require('../helpers/check');
const { g, state, engine } = quiet(808);
const A = g.GameArtifacts;
const res = engine.plant();
check('first carried rig planted here', res.ok && res.rig === 0 && state.rigs[0].status === 'planted' && state.rigs[0].isAt(state.player.q, state.player.r));
check('spent PLANT_MP', state.mp === A.PLAYER_MP - A.PLANT_MP);
let before = snapshot(state);
check('refused on a hex with a rig', engine.plant().ok === false && snapshot(state) === before);
const step = [...engine.computeReachable()].find(([, c]) => c === 1);
engine.movePlayer(...Object.values(g.Hex.fromKey(step[0])));
state.mp = A.PLANT_MP - 1;
before = snapshot(state);
check('refused below PLANT_MP', engine.plant().ok === false && snapshot(state) === before);
state.mp = A.PLAYER_MP;
state.rigs.forEach(r => { if (r.status === 'carried') r.status = 'smashed'; });
before = snapshot(state);
check('refused with nothing carried', engine.plant().ok === false && snapshot(state) === before);
state.rigs[1].status = 'carried'; state.outcome = 'captured';
before = snapshot(state);
check('refused when over', engine.plant().ok === false && snapshot(state) === before);
state.outcome = null;
check('plants the next carried rig in roster order', engine.plant().rig === 1);
done();
