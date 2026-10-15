// R-22: when GEN_MAX_ATTEMPTS maps from the seed all lack a path, newGame falls back to
// KNOWN_GOOD_SEED, records it as state.seed, and builds the same game newGame(KNOWN_GOOD_SEED) does.
'use strict';
const { load, snapshot, terrainSignature } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const g = load();
const { GEN_MAX_ATTEMPTS, KNOWN_GOOD_SEED } = g.GameArtifacts;

// Force the first GEN_MAX_ATTEMPTS path checks to fail.
const realHasPath = g.Board.prototype.hasPath;
let calls = 0;
g.Board.prototype.hasPath = function (a, b) { calls++; return calls > GEN_MAX_ATTEMPTS && realHasPath.call(this, a, b); };
const state = new g.GameState();
new g.GameEngine(state).newGame(123456);
g.Board.prototype.hasPath = realHasPath;

check('generation stopped after GEN_MAX_ATTEMPTS tries + 1 fallback', calls === GEN_MAX_ATTEMPTS + 1);
check('state.seed is KNOWN_GOOD_SEED', state.seed === KNOWN_GOOD_SEED);

const ref = new g.GameState();
new g.GameEngine(ref).newGame(KNOWN_GOOD_SEED);
check('the game equals newGame(KNOWN_GOOD_SEED)',
    snapshot(state) === snapshot(ref) && terrainSignature(state) === terrainSignature(ref));
done();
