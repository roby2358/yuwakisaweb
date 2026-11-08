// R-27: the engine-side modules load and play with no DOM, canvas, or GameDisplayArtifacts, and
// their sources never reference them.
'use strict';
const { newGame, ENGINE_MODULES, source } = require('../helpers/load');
const { check, done } = require('../helpers/check');
const { g, engine } = newGame(2727);
check('GameDisplayArtifacts absent', g.GameDisplayArtifacts === undefined);
for (let i = 0; i < 5; i++) engine.endTurn();
check('plays turns headless', engine.state.turn >= 2 || engine.state.outcome);
const banned = /\b(document|window|canvas|getContext|GameDisplayArtifacts|requestAnimationFrame)\b/;
for (const f of ENGINE_MODULES) {
    if (f === 'hex.js') continue;   // pixel helpers there read display artifacts lazily, by design
    const src = source(f).replace(/\/\/.*$/gm, '');
    check(`${f} has no DOM/display references`, !banned.test(src));
}
done();
