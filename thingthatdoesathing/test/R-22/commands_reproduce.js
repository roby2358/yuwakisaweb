// R-22: two engines with the same seed and the same command sequence have identical state
// and identical events after every command.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame, snapshot, SEEDS } = require('../helpers/load');
for (const seed of SEEDS.slice(0, 4)) {
    const a = newGame(seed, 'small'), b = newGame(seed, 'small');
    let same = true;
    for (let i = 0; i < 60; i++) {
        // A scripted mix of commands, chosen from a's state (b must agree anyway).
        const legal = [...a.engine.legalPlacements(a.state.hand[i % 3].kind)];
        const run = e => {
            if (i % 4 === 3) return e.wait();
            if (legal.length) { const { q, r } = a.g.Hex.fromKey(legal[(i * 7) % legal.length]); return e.place(i % 3, q, r, i % 6, e.colorChoices(a.state.hand[i % 3].kind)[0]); }
            return e.wait();
        };
        const ra = run(a.engine), rb = run(b.engine);
        if (JSON.stringify(ra) !== JSON.stringify(rb) || snapshot(a.state) !== snapshot(b.state)) { same = false; break; }
    }
    check(`seed ${seed}: 60 commands reproduce state and events`, same);
}
done();
