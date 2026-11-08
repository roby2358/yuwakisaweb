// test/integration/smoke.js — happy-path walkthrough of the DOM-free engine stack.
//
// Boots games, plants and pulls rigs, walks around and ends turns until each game ends or a
// turn cap is hit. Touches many rules at once, so it lives outside the test/R-n/ directories.
'use strict';

const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS.slice(0, 5)) {
    const { g, state, engine } = newGame(seed);
    const A = g.GameArtifacts;
    let error = null;
    try {
        for (let turn = 0; turn < 60 && !state.outcome; turn++) {
            // Walk right as far as possible, plant every few turns, pull a spent rig when standing on one.
            const reach = [...engine.computeReachable()].filter(([, c]) => c <= state.mp - A.PLANT_MP);
            reach.sort((a, b) => g.Hex.fromKey(b[0]).q - g.Hex.fromKey(a[0]).q);
            if (reach.length) engine.movePlayer(...Object.values(g.Hex.fromKey(reach[0][0])));
            if (state.outcome) break;
            if (turn % 3 === 0) engine.plant();
            else if (engine.canRetrieve()) engine.retrieve();
            if (!state.outcome && state.turn === turn + 1) engine.endTurn();
        }
    } catch (e) { error = e; }
    check(`seed ${seed}: plays without error (outcome ${state.outcome}, turn ${state.turn})`, !error);
    if (error) console.log(error.stack);
    check(`seed ${seed}: state consistent`, ['player', 'broadcast', 'regime'].includes(state.phase) && state.phase === 'player' &&
        state.mp >= 0 && state.mp <= A.PLAYER_MP &&
        state.rigs.every(r => (r.status === 'carried') === (r.q === null) || r.status === 'smashed') &&
        new Set(state.sweepers.map(s => s.key())).size === state.sweepers.length);
}
done();
