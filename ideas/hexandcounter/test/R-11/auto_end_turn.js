// R-11: a move that spends the last MP (and isn't onto the target) returns
// { ok:true, endedTurn:true } and runs the End-turn rule.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS.slice(0, 5)) {
    const { g, state, engine } = newGame(seed);
    const [key, cost] = [...engine.computeReachable()].find(([k]) => k !== state.target.key());
    state.mp = cost;   // this move will spend exactly the last MP
    const { q, r } = g.Hex.fromKey(key);
    let enemyPhases = 0;
    const orig = engine.moveEnemies.bind(engine);
    engine.moveEnemies = () => { enemyPhases++; orig(); };

    const res = engine.movePlayer(q, r);
    check(`seed ${seed}: result is { ok:true, endedTurn:true }`, res.ok === true && res.endedTurn === true && !res.won);
    check(`seed ${seed}: the turn ended (turn 2, MP refilled, phase player)`,
        state.turn === 2 && state.mp === g.GameArtifacts.PLAYER_MP && state.phase === 'player');
    check(`seed ${seed}: the enemy phase ran once`, enemyPhases === 1);
}
done();
