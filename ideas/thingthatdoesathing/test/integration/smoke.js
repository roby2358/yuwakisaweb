// test/integration/smoke.js — happy-path walkthrough of the DOM-free engine stack.
//
// Plays random legal commands (place / rotate / remove / discard / wait) for a while on several seeds and
// checks the ONTOLOGY invariants after every command. Touches many rules at once, so it
// lives outside the test/R-n/ directories; each rule's own assertions are there.
'use strict';

const { newGame, SEEDS } = require('../helpers/load');
const { check, done } = require('../helpers/check');

for (const seed of SEEDS.slice(0, 6)) {
    const { g, state, engine } = newGame(seed, 'small');
    const A = g.GameArtifacts, T = A.TERRAIN;
    let pick = seed;
    const rnd = n => (pick = (pick * 1103515245 + 12345) % 2147483648) % n;
    let ok = true, why = '';
    for (let i = 0; i < 300; i++) {
        const turn = state.turn;
        const roll = rnd(11);
        let res;
        if (roll < 6) {
            const slot = rnd(A.HAND_SIZE);
            const legal = [...engine.legalPlacements(state.hand[slot])];
            res = legal.length ? engine.place(slot, ...legal[rnd(legal.length)].split(',').map(Number), rnd(6)) : engine.wait();
        } else if (roll < 8 && state.things.some(t => t.facing !== null)) {
            const movers = state.things.filter(t => t.facing !== null);
            const t = movers[rnd(movers.length)];
            res = { ...engine.rotate(t.q, t.r), rotated: true };
        } else if (roll < 9 && state.things.length) {
            const t = state.things[rnd(state.things.length)];
            res = engine.remove(t.q, t.r);
        } else if (roll < 10) {
            res = engine.discard(rnd(A.HAND_SIZE));
        } else {
            res = engine.wait();
        }
        const keys = state.pieces.map(p => p.key());
        const thingKeys = state.things.map(t => t.q + ',' + t.r);
        const fail = msg => { if (ok) { ok = false; why = `cmd ${i}: ${msg}`; } };
        if (!res.ok) fail('a legal command was refused');
        if (state.turn !== turn + (res.rotated ? 0 : 1)) fail('turn did not advance by 1 (0 for rotate)');
        if (new Set(keys).size !== keys.length) fail('two pieces share a hex');
        if (new Set(thingKeys).size !== thingKeys.length) fail('two Things share a hex');
        if (state.hand.length !== A.HAND_SIZE) fail('hand size changed');
        if (state.phase !== 'player') fail('phase left as tick');
        if (thingKeys.includes(state.target.q + ',' + state.target.r)) fail('a Thing on the target');
        for (const p of state.pieces) {
            const h = engine.board.get(p.q, p.r);
            const t = engine.thingAt(p.q, p.r);
            if (!h || h.terrain === T.MOUNTAIN || (t && A.THINGS[t.kind].blocks) ||
                (h.terrain === T.WATER && !t)) fail(`piece ${p.id} on an illegal hex`);
        }
    }
    check(`seed ${seed}: invariants hold through random play (turn ${state.turn}, delivered ${state.delivered}, lost ${state.lost}) ${why}`, ok);
}

done();
