// R-8: computeReachable() maps each hex whose cheapest path cost (enemy hexes impassable)
// is ≤ mp to that cost; it excludes the player's own hex and is empty when mp ≤ 0.
// Checked against an independent relaxation over the whole map.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

function referenceCosts(g, state, board) {
    const walls = new Set(state.enemies.map(e => e.key()));
    const dist = new Map([[state.player.key(), 0]]);
    let changed = true;
    while (changed) {   // Bellman-Ford style relaxation until stable
        changed = false;
        for (const [key, d] of [...dist]) {
            const { q, r } = g.Hex.fromKey(key);
            for (const n of board.neighbors(q, r)) {
                const nk = g.Hex.key(n.q, n.r);
                const c = walls.has(nk) ? Infinity : board.moveCost(n);
                if (c === Infinity) continue;
                const nd = d + c;
                if (nd <= state.mp && (!dist.has(nk) || nd < dist.get(nk))) { dist.set(nk, nd); changed = true; }
            }
        }
    }
    dist.delete(state.player.key());
    return dist;
}

for (const seed of SEEDS.slice(0, 8)) {
    const { g, state, engine } = newGame(seed);
    // Put an enemy next to the player so walls are exercised.
    const nb = engine.board.neighbors(state.player.q, state.player.r)
        .find(h => engine.board.isPassable(h) && !state.target.isAt(h.q, h.r));
    if (nb && state.enemies.length) state.enemies[0].moveTo(nb.q, nb.r);

    for (const mp of [1, 3, g.GameArtifacts.PLAYER_MP]) {
        state.mp = mp;
        const got = engine.computeReachable();
        const want = referenceCosts(g, state, engine.board);
        const same = got.size === want.size && [...want].every(([k, c]) => got.get(k) === c);
        check(`seed ${seed}, mp ${mp}: reachable set and costs match the reference`, same);
        check(`seed ${seed}, mp ${mp}: player's own hex excluded`, !got.has(state.player.key()));
        check(`seed ${seed}, mp ${mp}: no enemy hex reachable`, state.enemies.every(e => !got.has(e.key())));
    }
    state.mp = 0;
    check(`seed ${seed}: empty at mp 0`, engine.computeReachable().size === 0);
}
done();
