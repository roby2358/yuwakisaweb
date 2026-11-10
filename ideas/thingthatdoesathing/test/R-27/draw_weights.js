// R-27: draws come from THINGS by weight: only known kinds, every kind appears, and each
// kind's share of many draws is near weight / total.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame } = require('../helpers/load');
const { g, engine } = newGame(21);
const { THINGS } = g.GameArtifacts;
const N = 20000, count = {};
for (let i = 0; i < N; i++) { const k = engine.draw(); count[k] = (count[k] || 0) + 1; }
const total = Object.values(THINGS).reduce((s, t) => s + t.weight, 0);
check('only known kinds', Object.keys(count).every(k => k in THINGS));
for (const k of Object.keys(THINGS)) {
    const share = (count[k] || 0) / N, want = THINGS[k].weight / total;
    check(`${k}: share ${share.toFixed(3)} ≈ ${want.toFixed(3)}`, Math.abs(share - want) < 0.02);
}
done();
