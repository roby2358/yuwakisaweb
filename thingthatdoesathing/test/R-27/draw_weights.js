// R-27: a card's kind comes from THINGS by weight: only known kinds, and each kind's share of
// many draws is near weight / total over the kinds in the deck. The deck is the unlocked kinds
// (R-49): a new game deals only UNLOCKS[0]. With one color open the `colored` kinds are out of
// the deck; with two or more (and everything unlocked) every kind is in. A card is just its
// kind: no color, `colored` kinds included (their color is picked at place, R-50, D-32).
'use strict';
const { check, done } = require('../helpers/check');
const { newGame } = require('../helpers/load');
const { g, state, engine } = newGame(21, 'small');
const { THINGS, UNLOCKS } = g.GameArtifacts;
const N = 20000;
const drawMany = () => {
    const count = {}, cards = [];
    for (let i = 0; i < N; i++) { const c = engine.draw(); cards.push(c); count[c.kind] = (count[c.kind] || 0) + 1; }
    return { count, cards };
};
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
const start = drawMany();
checkShares('new game', start.count, UNLOCKS[0]);

state.unlocks = UNLOCKS.length;
const { count, cards } = drawMany();
checkShares('all unlocked, one color open', count, allKinds.filter(k => !THINGS[k].colored));
check('one color open: no colored cards, and a card is just its kind', cards.every(c => Object.keys(c).join() === 'kind'));

state.targets.push({ q: 0, r: 0, color: 'blue', delivered: 0 }, { q: 0, r: 1, color: 'green', delivered: 0 });
const three = drawMany();
checkShares('three colors open', three.count, allKinds);
check('three colors open: colored kinds come as cards with no color too',
    three.cards.some(c => THINGS[c.kind].colored) && three.cards.every(c => Object.keys(c).join() === 'kind'));
done();
