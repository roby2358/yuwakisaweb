'use strict';
const { newGame, snapshot, terrainSignature, load } = require('../helpers/load');
const { check, done } = require('../helpers/check');

// R-3: every site on the largest land mass; spacing rules; home connects to every village.
const { g, state, engine } = newGame(11);
const A = g.GameArtifacts;
const land = new Set(g.WorldGen.largestLand(engine.board).map(h => h.q + ',' + h.r));
const sites = [].concat(state.villages, state.ruins, state.lairs);
check('every site is on the largest land mass', sites.every(s => land.has(s.q + ',' + s.r)));
check('villages stand on plains', state.villages.every(v => engine.terrainAt(v) === A.TERRAIN.PLAINS));
let spaced = true;
for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) if (g.hexDist(sites[i], sites[j]) < A.SITE_MIN_DIST) spaced = false;
check('sites are at least SITE_MIN_DIST apart', spaced);
let vs = true;
for (const a of state.villages) for (const b of state.villages) if (a !== b && g.hexDist(a, b) < A.VILLAGE_MIN_DIST) vs = false;
check('villages are at least VILLAGE_MIN_DIST apart', vs);
const home = state.villages.find(v => v.home);
check('exactly one home village, with HOME_TRUST', state.villages.filter(v => v.home).length === 1 && home.trust === A.HOME_TRUST);
check('other villages start at START_TRUST', state.villages.filter(v => !v.home).every(v => v.trust === A.START_TRUST));
check('lairs keep HOME_SAFE_DIST from home and LAIR_VILLAGE_MIN from villages',
    state.lairs.every(l => g.hexDist(l, home) >= A.HOME_SAFE_DIST && state.villages.every(v => g.hexDist(l, v) >= A.LAIR_VILLAGE_MIN)));
check('home connects to every village', state.villages.every(v => engine.board.hasPath(home, v)));
check('the hero starts on the home village', state.hero.isAt(home.q, home.r));
done();
