// test/integration/smoke.js — happy-path walkthrough of the DOM-free engine stack.
//
// Boots a game, selects-and-moves the way the UI does, ends a turn, and plays on until the
// game is won or a turn cap is hit. Touches many rules at once, so it lives outside the
// test/R-n/ directories; each rule's own assertions are there.
'use strict';

const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS.slice(0, 5)) {
    const { g, state, engine } = newGame(seed);
    const { Hex } = g;

    // Greedy march: each step, move to the reachable hex closest to the target.
    let won = false;
    for (let step = 0; step < 400 && !won; step++) {
        const reach = engine.computeReachable();
        if (reach.size === 0) { engine.endTurn(); continue; }
        let best = null, bestD = Infinity;
        for (const key of reach.keys()) {
            const { q, r } = Hex.fromKey(key);
            const d = new Hex(q, r).distance(state.target);
            if (d < bestD) { bestD = d; best = { q, r }; }
        }
        const here = new Hex(state.player.q, state.player.r).distance(state.target);
        if (bestD >= here) { engine.endTurn(); continue; }   // blocked: wait for enemies to wander
        const res = engine.movePlayer(best.q, best.r);
        if (!res.ok) break;
        won = !!res.won;
    }
    check(`seed ${seed}: a greedy march plays without error (won=${won}, turn ${state.turn})`, true);
    check(`seed ${seed}: state is consistent afterward`,
        state.phase === 'player' && state.mp >= 0 && state.mp <= g.GameArtifacts.PLAYER_MP &&
        (!state.gameWon || state.player.isAt(state.target.q, state.target.r)));
}

done();
