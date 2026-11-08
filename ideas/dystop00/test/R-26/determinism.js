// R-26: same seed ⇒ same map, stations, Sweepers; same seed + same commands ⇒ same state after
// every command; different seeds differ. The engine never reads Math.random (the client draws the seed).
'use strict';
const { newGame, snapshot, terrainSignature, source } = require('../helpers/load');
const { check, done } = require('../helpers/check');
const a = newGame(2626), b = newGame(2626), c = newGame(2627);
check('same seed, same map', terrainSignature(a.state) === terrainSignature(b.state) && snapshot(a.state) === snapshot(b.state));
check('different seed, different map', terrainSignature(a.state) !== terrainSignature(c.state));
let same = true;
for (let i = 0; i < 25; i++) {
    for (const ctx of [a, b]) {
        const reach = [...ctx.engine.computeReachable().keys()].sort();
        if (i % 4 === 1) ctx.engine.plant();
        else if (reach.length) { const [q, r] = reach[Math.floor(reach.length / 2)].split(',').map(Number); ctx.engine.movePlayer(q, r); }
        ctx.engine.endTurn();
    }
    if (snapshot(a.state) !== snapshot(b.state)) same = false;
}
check('same commands, same state each turn', same);
const engineSrc = source('gameengine.js').replace(/\/\/.*$/gm, '');
check('the engine never reads Math.random', !/Math\.random/.test(engineSrc));
done();
