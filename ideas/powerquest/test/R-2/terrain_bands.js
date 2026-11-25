'use strict';
const { newGame, snapshot, terrainSignature, load } = require('../helpers/load');
const { check, done } = require('../helpers/check');

// R-2: terrain by elevation percentile; the wettest plains become jungle.
const { g, state } = newGame(3);
const A = g.GameArtifacts, T = A.TERRAIN;
const inner = [...state.hexes.values()].filter(h => !h.isEdge);
const n = inner.length;
const by = t => inner.filter(h => h.terrain === t);
const water = by(T.WATER), mesa = by(T.MESA), jungle = by(T.JUNGLE), plains = by(T.PLAINS);
check('water count follows WATER_PCT', water.length === Math.ceil(A.WATER_PCT * n));
check('mesa count follows MESA_PCT', mesa.length === n - Math.ceil(A.MESA_PCT * n));
check('jungle is JUNGLE_FRAC of the non-water non-mesa hexes', jungle.length === Math.round((jungle.length + plains.length) * A.JUNGLE_FRAC));
const maxE = a => Math.max(...a.map(h => h.elevation)), minE = a => Math.min(...a.map(h => h.elevation));
check('every mesa is higher than every water, plains and jungle hex', minE(mesa) >= maxE(water.concat(plains, jungle)));
check('every water hex is lower than the land', maxE(water) <= minE(plains.concat(jungle, mesa)));
check('jungle hexes are wetter than every plains hex', Math.min(...jungle.map(h => h.moisture)) >= Math.max(...plains.map(h => h.moisture)));
done();
