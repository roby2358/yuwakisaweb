// R-10: movePlayer to a reachable non-target hex that leaves MP over moves the player there,
// deducts exactly the reachable cost, and returns { ok:true }.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS.slice(0, 5)) {
    const { g, state, engine } = newGame(seed);
    const reach = engine.computeReachable();
    const [key, cost] = [...reach].find(([k, c]) => c < state.mp && k !== state.target.key());
    const { q, r } = g.Hex.fromKey(key);
    const mpBefore = state.mp, turnBefore = state.turn;
    const res = engine.movePlayer(q, r);
    check(`seed ${seed}: result is exactly { ok:true }`, JSON.stringify(res) === '{"ok":true}');
    check(`seed ${seed}: player moved to the hex`, state.player.isAt(q, r));
    check(`seed ${seed}: mp dropped by the reachable cost`, state.mp === mpBefore - cost);
    check(`seed ${seed}: turn did not end`, state.turn === turnBefore);
}
done();
