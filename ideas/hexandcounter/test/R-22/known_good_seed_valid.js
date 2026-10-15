// R-22: KNOWN_GOOD_SEED produces a player→target path on its first generation attempt,
// so the fallback itself can never fail.
'use strict';
const { load } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const g = load();
const engine = new g.GameEngine(new g.GameState());
check('KNOWN_GOOD_SEED has a path on attempt 1', engine.generateMap(g.GameArtifacts.KNOWN_GOOD_SEED, 1) === true);
done();
