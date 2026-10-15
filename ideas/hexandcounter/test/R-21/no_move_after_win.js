// R-21: once the game is won, movePlayer returns { ok:false } and the player stays on the
// target, even with MP left.
'use strict';
const { newGame, snapshot } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const { g, state, engine } = newGame(4040);
state.player.moveTo(state.target.q, state.target.r);
state.gameWon = true;
state.mp = g.GameArtifacts.PLAYER_MP;
state.enemies = [];
const nb = engine.board.neighbors(state.target.q, state.target.r).find(h => engine.board.isPassable(h));
const before = snapshot(state);
const res = engine.movePlayer(nb.q, nb.r);
check('{ ok:false }', JSON.stringify(res) === '{"ok":false}');
check('state unchanged; player still on the target', snapshot(state) === before);
done();
