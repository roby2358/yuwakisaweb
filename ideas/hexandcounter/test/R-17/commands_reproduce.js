// R-17: same seed + same command sequence ⇒ same state after every command, including
// the AI's enemy moves.
'use strict';
const { newGame, snapshot } = require('../helpers/load');
const { check, done } = require('../helpers/check');

// Two engines in separate contexts, each with its own Rando, driven identically.
const a = newGame(8080), b = newGame(8080);
let same = true;
for (let step = 0; step < 60; step++) {
    const keys = [...a.engine.computeReachable().keys()].sort();
    if (step % 3 === 2 || keys.length === 0) { a.engine.endTurn(); b.engine.endTurn(); }
    else {
        const { q, r } = a.g.Hex.fromKey(keys[step % keys.length]);
        a.engine.movePlayer(q, r); b.engine.movePlayer(q, r);
    }
    if (snapshot(a.state) !== snapshot(b.state)) { same = false; break; }
    if (a.state.gameWon) break;
}
check('state matches after every command', same);
done();
