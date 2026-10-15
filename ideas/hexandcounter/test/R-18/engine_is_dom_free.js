// R-18: the engine-side modules load and play a game with no DOM, no canvas, and no
// GameDisplayArtifacts, and their sources never reach for them.
'use strict';
const { load, source } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const g = load();   // the vm context has no document/window and never loads displayartifacts.js
check('GameDisplayArtifacts is absent from the engine context', g.GameDisplayArtifacts === undefined);
const state = new g.GameState(), engine = new g.GameEngine(state);
engine.newGame(5);
const [key] = engine.computeReachable().keys();
const { q, r } = g.Hex.fromKey(key);
check('a game generates, moves, and ends a turn headless',
    engine.movePlayer(q, r).ok && engine.endTurn().ok);

for (const f of ['artifacts.js', 'piece.js', 'board.js', 'gamestate.js', 'gameengine.js']) {
    const src = source(f).replace(/\/\/.*$/gm, '');   // ignore comments
    check(`${f} never references document/window/canvas/GameDisplayArtifacts`,
        !/\b(document|window|canvas|GameDisplayArtifacts)\b/.test(src));
}
done();
