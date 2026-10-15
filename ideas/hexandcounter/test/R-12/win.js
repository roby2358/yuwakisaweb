// R-12: moving onto the target — even with exactly the last MP — sets gameWon, returns
// { ok:true, won:true }, and does not run the enemy phase.
'use strict';
const { newGame, SEEDS, snapshot } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS.slice(0, 5)) {
    const { g, state, engine } = newGame(seed);
    const board = engine.board;
    // Stand the player on a passable neighbor of the target, with exactly the MP to step in.
    const nb = board.neighbors(state.target.q, state.target.r).find(h => board.isPassable(h));
    state.player.moveTo(nb.q, nb.r);
    state.enemies = state.enemies.filter(e => !e.isAt(nb.q, nb.r) && !e.isAt(state.target.q, state.target.r));
    state.mp = board.moveCost(board.get(state.target.q, state.target.r));
    const enemiesBefore = JSON.stringify(state.enemies.map(e => e.key()));
    const turnBefore = state.turn;

    const res = engine.movePlayer(state.target.q, state.target.r);
    check(`seed ${seed}: result is { ok:true, won:true }`, res.ok === true && res.won === true && !res.endedTurn);
    check(`seed ${seed}: gameWon is set and the player is on the target`,
        state.gameWon && state.player.isAt(state.target.q, state.target.r));
    check(`seed ${seed}: no enemy phase (enemies and turn unchanged)`,
        JSON.stringify(state.enemies.map(e => e.key())) === enemiesBefore && state.turn === turnBefore);
}
done();
