'use strict';
const { newGame, snapshot, terrainSignature, load } = require('../helpers/load');
const { check, done } = require('../helpers/check');

// R-5: KNOWN_GOOD_SEED produces a valid world on its first attempt, so the fallback can't fail.
const g = load();
const state = new g.GameState(), engine = new g.GameEngine(state);
g.Rando.seed(g.GameArtifacts.KNOWN_GOOD_SEED);
check('WorldGen.build succeeds in one attempt', g.WorldGen.build(engine, 1));
check('it placed a home village and a hero', state.villages.some(v => v.home) && !!state.hero);
done();
