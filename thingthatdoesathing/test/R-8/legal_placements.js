// R-8: legalPlacements(kind) is exactly the hexes that aren't a target, of the right ground
// (THINGS.on: 'water', 'land' = plains or ice, 'unslick' = plains or water), and — for a blocking kind — no piece and not a
// source. A Thing already on the hex doesn't matter: placing replaces it (R-47).
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, newGame, SEEDS } = require('../helpers/load');
for (const seed of SEEDS.slice(0, 5)) {
    const { g, state, engine } = newGame(seed, 'small');
    const A = g.GameArtifacts, T = A.TERRAIN;
    const land = t => t === T.PLAINS || t === T.ICE;
    const ground = { land, water: t => t === T.WATER, unslick: t => t === T.PLAINS || t === T.WATER };
    // Give the board some Things (still legal: replaced) and pieces.
    for (let i = 0; i < 6; i++) engine.wait();
    const belts = [...engine.legalPlacements('BELT')].slice(0, 3);
    belts.forEach(k => { const { q, r } = g.Hex.fromKey(k); state.things.push({ kind: 'BELT', q, r, facing: 0 }); });
    for (const kind of Object.keys(A.THINGS)) {
        const tpl = A.THINGS[kind], got = engine.legalPlacements(kind);
        let ok = true;
        for (const [key, h] of state.hexes) {
            const want = !engine.targetAt(h.q, h.r) &&
                ground[tpl.on](h.terrain) &&
                !(tpl.blocks && (engine.pieceAt(h.q, h.r) || state.sources.some(s => s.q === h.q && s.r === h.r)));
            if (want !== got.has(key)) ok = false;
        }
        check(`seed ${seed}: ${kind} placements match the rule (${got.size})`, ok);
    }
}
// Spot checks on a controlled board.
const { state, engine, piece, terrain, T } = flatGame();
piece('crate', 3, 4);
terrain(5, 4, T.MOUNTAIN);
check('a belt may go under a piece', engine.legalPlacements('BELT').has('3,4'));
check('a wall may not go on a piece', !engine.legalPlacements('WALL').has('3,4'));
check('nothing on mountain', !engine.legalPlacements('BELT').has('5,4'));
check('the source accepts a Thing', engine.legalPlacements('BELT').has('-3,8'));
check('but never a Wall', !engine.legalPlacements('WALL').has('-3,8'));
check('a hex holding a Thing is legal (placing replaces it)', (state.things.push({ kind: 'WALL', q: 6, r: 4, facing: null }), engine.legalPlacements('BELT').has('6,4')));
terrain(7, 4, T.WATER);
check('a Slide goes on land or water', engine.legalPlacements('SLIDE').has('3,4') && engine.legalPlacements('SLIDE').has('7,4'));
check('but not on mountain', !engine.legalPlacements('SLIDE').has('5,4'));
terrain(8, 4, T.ICE);
check('nor on bare ice (already slick, D-29), where a Belt goes', !engine.legalPlacements('SLIDE').has('8,4') && engine.legalPlacements('BELT').has('8,4'));
check('the target never does', !engine.legalPlacements('BELT').has('10,8'));
state.targets.push({ q: 6, r: 4, color: 'blue', delivered: 0 });
check('nor does a second color\'s target', !engine.legalPlacements('BELT').has('6,4'));
done();
