// R-15: in the enemy phase each enemy stays put or steps to one adjacent passable hex;
// afterward no two enemies share a hex and none is on the player.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS.slice(0, 5)) {
    const { g, state, engine } = newGame(seed);
    const board = engine.board;
    let stepOk = true, distinct = true, offPlayer = true, moved = 0;
    for (let t = 0; t < 40; t++) {
        const before = state.enemies.map(e => ({ q: e.q, r: e.r }));
        engine.endTurn();
        state.enemies.forEach((e, i) => {
            const b = before[i];
            if (e.isAt(b.q, b.r)) return;
            moved++;
            const h = board.get(e.q, e.r);
            if (new g.Hex(b.q, b.r).distance(e) !== 1 || !h || !board.isPassable(h)) stepOk = false;
        });
        const keys = state.enemies.map(e => e.key());
        if (new Set(keys).size !== keys.length) distinct = false;
        if (keys.includes(state.player.key())) offPlayer = false;
    }
    check(`seed ${seed}: every enemy move is one step onto a passable hex (${moved} moves)`, stepOk && moved > 0);
    check(`seed ${seed}: no two enemies ever share a hex`, distinct);
    check(`seed ${seed}: no enemy ever lands on the player`, offPlayer);
}
done();
