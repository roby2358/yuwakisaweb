// R-27: a card's kind comes from THINGS by weight: only known kinds, and each kind's share of
// many draws is near weight / total over the kinds in the deck. With one color open the
// `colored` kinds are out of the deck; with two or more every kind is in. A kind that isn't
// `colored` is WHITE; a `colored` one is one of the open colors, each equally likely.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame } = require('../helpers/load');
const { g, state, engine } = newGame(21, 'small');
const { THINGS, WHITE } = g.GameArtifacts;
const N = 20000, count = {};
const cards = [];
for (let i = 0; i < N; i++) { const c = engine.draw(); cards.push(c); count[c.kind] = (count[c.kind] || 0) + 1; }
// Each kind's share of `count` is near its weight over the total weight of `kinds`; the rest never appear.
function checkShares(label, count, kinds) {
    const total = kinds.reduce((s, k) => s + THINGS[k].weight, 0);
    check(`${label}: only known kinds`, Object.keys(count).every(k => k in THINGS));
    for (const k of Object.keys(THINGS)) {
        const share = (count[k] || 0) / N, want = kinds.includes(k) ? THINGS[k].weight / total : 0;
        check(`${label}, ${k}: share ${share.toFixed(3)} ≈ ${want.toFixed(3)}`, Math.abs(share - want) < 0.02);
    }
}
const allKinds = Object.keys(THINGS);
checkShares('one color open', count, allKinds.filter(k => !THINGS[k].colored));
check('one color open: no colored cards, every card white', cards.every(c => c.color === WHITE));

state.targets.push({ q: 0, r: 0, color: 'blue', delivered: 0 }, { q: 0, r: 1, color: 'green', delivered: 0 });
const open = state.targets.map(t => t.color);
const colors = {}, count3 = {};
let plainWhite = true;
for (let i = 0; i < N; i++) {
    const c = engine.draw();
    count3[c.kind] = (count3[c.kind] || 0) + 1;
    if (!THINGS[c.kind].colored) { plainWhite = plainWhite && c.color === WHITE; continue; }
    colors[c.color] = (colors[c.color] || 0) + 1;
}
checkShares('three colors open', count3, allKinds);
check('kinds that aren\'t colored stay white', plainWhite);
const coloredN = Object.values(colors).reduce((a, b) => a + b, 0);
check('colored kinds: only an open color, never white', Object.keys(colors).every(c => open.includes(c)));
for (const c of open) {
    const share = (colors[c] || 0) / coloredN;
    check(`colored kinds, ${c}: share ${share.toFixed(3)} ≈ ${(1 / open.length).toFixed(3)}`, Math.abs(share - 1 / open.length) < 0.03);
}
done();
