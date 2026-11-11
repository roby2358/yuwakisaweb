// R-27: a card's kind comes from THINGS by weight: only known kinds, every kind appears, and
// each kind's share of many draws is near weight / total. A kind that isn't `colored` is
// WHITE; a `colored` one is one of the open colors, each equally likely, never WHITE.
'use strict';
const { check, done } = require('../helpers/check');
const { newGame } = require('../helpers/load');
const { g, state, engine } = newGame(21, 'small');
const { THINGS, WHITE } = g.GameArtifacts;
const N = 20000, count = {};
const cards = [];
for (let i = 0; i < N; i++) { const c = engine.draw(); cards.push(c); count[c.kind] = (count[c.kind] || 0) + 1; }
const total = Object.values(THINGS).reduce((s, t) => s + t.weight, 0);
check('only known kinds', Object.keys(count).every(k => k in THINGS));
for (const k of Object.keys(THINGS)) {
    const share = (count[k] || 0) / N, want = THINGS[k].weight / total;
    check(`${k}: share ${share.toFixed(3)} ≈ ${want.toFixed(3)}`, Math.abs(share - want) < 0.02);
}
const onlyColor = state.targets[0].color;
check('one color open: colored cards take it, the rest are white',
    cards.every(c => c.color === (THINGS[c.kind].colored ? onlyColor : WHITE)));

state.targets.push({ q: 0, r: 0, color: 'blue', delivered: 0 }, { q: 0, r: 1, color: 'green', delivered: 0 });
const open = state.targets.map(t => t.color);
const colors = {};
let plainWhite = true;
for (let i = 0; i < N; i++) {
    const c = engine.draw();
    if (!THINGS[c.kind].colored) { plainWhite = plainWhite && c.color === WHITE; continue; }
    colors[c.color] = (colors[c.color] || 0) + 1;
}
check('kinds that aren\'t colored stay white', plainWhite);
const coloredN = Object.values(colors).reduce((a, b) => a + b, 0);
check('colored kinds: only an open color, never white', Object.keys(colors).every(c => open.includes(c)));
for (const c of open) {
    const share = (colors[c] || 0) / coloredN;
    check(`colored kinds, ${c}: share ${share.toFixed(3)} ≈ ${(1 / open.length).toFixed(3)}`, Math.abs(share - 1 / open.length) < 0.03);
}
done();
