// R-13: endTurn() while not won runs the enemy phase once, adds 1 to turn, refills MP to
// PLAYER_MP, leaves phase 'player', and returns { ok:true }.
'use strict';
const { newGame } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const { g, state, engine } = newGame(31337);
let enemyPhases = 0, phaseDuring = null;
const orig = engine.moveEnemies.bind(engine);
engine.moveEnemies = () => { enemyPhases++; phaseDuring = state.phase; orig(); };

state.mp = 1;
for (let t = 1; t <= 3; t++) {
    const res = engine.endTurn();
    check(`end turn ${t}: { ok:true }`, JSON.stringify(res) === '{"ok":true}');
    check(`end turn ${t}: turn is now ${t + 1}`, state.turn === t + 1);
    check(`end turn ${t}: MP refilled to PLAYER_MP`, state.mp === g.GameArtifacts.PLAYER_MP);
    check(`end turn ${t}: phase is 'player' on return`, state.phase === 'player');
}
check("the enemy phase ran once per endTurn, under phase 'enemy'", enemyPhases === 3 && phaseDuring === 'enemy');
done();
