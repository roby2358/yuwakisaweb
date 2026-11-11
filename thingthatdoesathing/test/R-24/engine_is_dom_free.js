// R-24: the engine-side modules load and play with no DOM, canvas, or GameDisplayArtifacts,
// and their sources never reference them.
'use strict';
const { check, done } = require('../helpers/check');
const { load, source } = require('../helpers/load');
const g = load();
check('GameDisplayArtifacts absent from the engine context', g.GameDisplayArtifacts === undefined);
const state = new g.GameState(), engine = new g.GameEngine(state);
engine.newGame(5, 'small');
const [key] = engine.legalPlacements(state.hand[0].kind);
const { q, r } = g.Hex.fromKey(key);
check('a game generates, places, and waits headless', engine.place(0, q, r, 0).ok && engine.wait().ok);
for (const f of ['artifacts.js', 'piece.js', 'board.js', 'gamestate.js', 'gameengine.js']) {
    const src = source(f).replace(/\/\/.*$/gm, '');
    check(`${f} never references document/window/canvas/GameDisplayArtifacts`,
        !/\b(document|window|canvas|GameDisplayArtifacts)\b/.test(src));
}
done();
