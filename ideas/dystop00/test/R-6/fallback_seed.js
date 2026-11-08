// R-6: if GEN_MAX_ATTEMPTS maps from a seed are all invalid, newGame falls back to
// KNOWN_GOOD_SEED, records it as state.seed, and builds the same game newGame(KNOWN_GOOD_SEED)
// does. KNOWN_GOOD_SEED is valid on its first attempt.
'use strict';
const { load, newGame, terrainSignature } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const g = load();
const { KNOWN_GOOD_SEED } = g.GameArtifacts;
const probe = new g.GameEngine(new g.GameState());
check('KNOWN_GOOD_SEED is valid on its first attempt', probe.generateMap(KNOWN_GOOD_SEED, 1));

// Force every map invalid until the fallback seed: stub hasPath to fail for other seeds.
const g2 = load();
const state = new g2.GameState();
const engine = new g2.GameEngine(state);
const realGenerate = engine.generateMap.bind(engine);
engine.generateMap = (seed, attempts) => seed === KNOWN_GOOD_SEED ? realGenerate(seed, attempts) : (realGenerate(seed, attempts), false);
engine.newGame(12345);
check('state.seed records the fallback', state.seed === KNOWN_GOOD_SEED);
const ref = newGame(KNOWN_GOOD_SEED);
check('fallback game equals newGame(KNOWN_GOOD_SEED)',
    terrainSignature(state) === terrainSignature(ref.state) && state.player.key() === ref.state.player.key() &&
    JSON.stringify(state.sweepers.map(s => s.key())) === JSON.stringify(ref.state.sweepers.map(s => s.key())));
done();
