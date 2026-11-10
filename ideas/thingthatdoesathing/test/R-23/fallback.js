// R-23: when GEN_MAX_ATTEMPTS maps from a seed all lack a path, newGame falls back to
// KNOWN_GOOD_SEED, records it, and builds the same game newGame(KNOWN_GOOD_SEED) does.
// KNOWN_GOOD_SEED has a path on its first attempt.
'use strict';
const { check, done } = require('../helpers/check');
const { load, snapshot, terrainSignature } = require('../helpers/load');
const g = load();
const { GEN_MAX_ATTEMPTS, KNOWN_GOOD_SEED } = g.GameArtifacts;
const realHasPath = g.Board.prototype.hasPath;
let calls = 0;
g.Board.prototype.hasPath = function (a, b) { calls++; return calls > GEN_MAX_ATTEMPTS && realHasPath.call(this, a, b); };
const state = new g.GameState();
new g.GameEngine(state).newGame(123456);
g.Board.prototype.hasPath = realHasPath;
check('stopped after GEN_MAX_ATTEMPTS + 1 fallback', calls === GEN_MAX_ATTEMPTS + 1);
check('state.seed is KNOWN_GOOD_SEED', state.seed === KNOWN_GOOD_SEED);
const ref = new g.GameState();
new g.GameEngine(ref).newGame(KNOWN_GOOD_SEED);
check('same game as newGame(KNOWN_GOOD_SEED)', snapshot(state) === snapshot(ref) && terrainSignature(state) === terrainSignature(ref));
const fresh = new g.GameState(), e = new g.GameEngine(fresh);
check('KNOWN_GOOD_SEED has a path on attempt 1', e.generateMap(KNOWN_GOOD_SEED, 1));
done();
