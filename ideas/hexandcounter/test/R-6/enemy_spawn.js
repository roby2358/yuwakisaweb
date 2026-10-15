// R-6: enemy spawn. Count lies within ENEMY_DICE_COUNT d ENEMY_DICE_SIDES; each enemy is a
// Piece labeled 'E' with a #rrggbb color, on a passable non-edge hex; no two share a hex;
// none is on the player or the target.
'use strict';
const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS) {
    const { g, state, engine } = newGame(seed);
    const A = g.GameArtifacts;
    const n = state.enemies.length;
    check(`seed ${seed}: enemy count ${n} within the dice range`,
        n >= A.ENEMY_DICE_COUNT && n <= A.ENEMY_DICE_COUNT * A.ENEMY_DICE_SIDES);
    check(`seed ${seed}: every enemy is a Piece labeled 'E' with a #rrggbb color`,
        state.enemies.every(e => e instanceof g.Piece && e.label === 'E' && /^#[0-9a-f]{6}$/i.test(e.color)));
    check(`seed ${seed}: every enemy stands on a passable non-edge hex`,
        state.enemies.every(e => { const h = engine.board.get(e.q, e.r); return h && !h.isEdge && engine.board.isPassable(h); }));
    const keys = state.enemies.map(e => e.key());
    check(`seed ${seed}: no two enemies share a hex`, new Set(keys).size === keys.length);
    check(`seed ${seed}: no enemy on the player or target`,
        !keys.includes(state.player.key()) && !keys.includes(state.target.key()));
}
done();
