// R-23: when GEN_MAX_ATTEMPTS maps from a seed all lack a path, newGame falls back to that
// size's knownGoodSeed, records it, and builds the same game newGame(knownGoodSeed) does.
// Each size's knownGoodSeed has a path on its first attempt.
'use strict';
const { check, done } = require('../helpers/check');
const { load, snapshot, terrainSignature } = require('../helpers/load');
const g = load();
const { GEN_MAX_ATTEMPTS, MAP_SIZES } = g.GameArtifacts;
for (const [size, { knownGoodSeed }] of Object.entries(MAP_SIZES)) {
    const realHasPath = g.Board.prototype.hasPath;
    let calls = 0;
    g.Board.prototype.hasPath = function (a, b) { calls++; return calls > GEN_MAX_ATTEMPTS && realHasPath.call(this, a, b); };
    const state = new g.GameState();
    new g.GameEngine(state).newGame(123456, size);
    g.Board.prototype.hasPath = realHasPath;
    check(`${size}: stopped after GEN_MAX_ATTEMPTS + 1 fallback`, calls === GEN_MAX_ATTEMPTS + 1);
    check(`${size}: state.seed is knownGoodSeed`, state.seed === knownGoodSeed);
    const ref = new g.GameState();
    new g.GameEngine(ref).newGame(knownGoodSeed, size);
    check(`${size}: same game as newGame(knownGoodSeed)`,
        snapshot(state) === snapshot(ref) && terrainSignature(state) === terrainSignature(ref));
    const fresh = new g.GameState(), e = new g.GameEngine(fresh);
    fresh.size = size;
    check(`${size}: knownGoodSeed has a path on attempt 1`, e.generateMap(knownGoodSeed, 1));
}
done();
