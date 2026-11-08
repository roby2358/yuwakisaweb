// R-10: movePlayer to a reachable hex moves @ and spends exactly its reachable cost
// ({ ok:true } while MP remains); to any hex outside computeReachable → { ok:false }, no change.
'use strict';
const { quiet } = require('../helpers/fixtures');
const { snapshot } = require('../helpers/load');
const { check, done } = require('../helpers/check');
for (const seed of [11, 22, 33]) {
    const { g, state, engine } = quiet(seed);
    const reach = engine.computeReachable();
    const [key, cost] = [...reach].find(([, c]) => c < state.mp);
    const { q, r } = g.Hex.fromKey(key);
    const res = engine.movePlayer(q, r);
    check(`seed ${seed}: { ok:true }`, JSON.stringify(res) === '{"ok":true}');
    check(`seed ${seed}: moved and paid`, state.player.isAt(q, r) && state.mp === g.GameArtifacts.PLAYER_MP - cost);
    const before = snapshot(state);
    const bad = [state.player.key(), state.stations[0].key(), '9999,9999',
        [...state.hexes.values()].find(h => !engine.board.isPassable(h)).q + ',' + [...state.hexes.values()].find(h => !engine.board.isPassable(h)).r];
    for (const k of bad) {
        const { q: bq, r: br } = g.Hex.fromKey(k);
        check(`seed ${seed}: illegal ${k} refused`, engine.movePlayer(bq, br).ok === false && snapshot(state) === before);
    }
}
done();
