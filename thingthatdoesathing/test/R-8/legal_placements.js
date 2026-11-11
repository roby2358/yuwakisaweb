// R-8: legalPlacements(kind) is exactly the hexes with no Thing, not the target, of the
// right ground (BRIDGE: water; others: plains or ice), and — for a blocking kind — no piece
// and not a source.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, newGame, SEEDS } = require('../helpers/load');
for (const seed of SEEDS.slice(0, 5)) {
    const { g, state, engine } = newGame(seed, 'small');
    const A = g.GameArtifacts, T = A.TERRAIN;
    // Give the board some Things and pieces to exclude.
    for (let i = 0; i < 6; i++) engine.wait();
    const land = [...engine.legalPlacements('BELT')].slice(0, 3);
    land.forEach(k => { const { q, r } = g.Hex.fromKey(k); state.things.push({ kind: 'BELT', q, r, facing: 0 }); });
    for (const kind of Object.keys(A.THINGS)) {
        const tpl = A.THINGS[kind], got = engine.legalPlacements(kind);
        let ok = true;
        for (const [key, h] of state.hexes) {
            const want = !engine.targetAt(h.q, h.r) &&
                !engine.thingAt(h.q, h.r) &&
                (tpl.on === 'water' ? h.terrain === T.WATER : (h.terrain === T.PLAINS || h.terrain === T.ICE)) &&
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
check('the target never does', !engine.legalPlacements('BELT').has('10,8'));
state.targets.push({ q: 6, r: 4, color: 'blue', delivered: 0 });
check('nor does a second color\'s target', !engine.legalPlacements('BELT').has('6,4'));
done();
