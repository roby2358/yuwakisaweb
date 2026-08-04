// tests/player.js — player-facing API paths (run: node tools/headless.js tests/player.js)
//
// Exercises everything GameUI drives: build rules (stacking block, one-per-city),
// selectionSets, moveStack, resolveCombat, bombard, over 25 rounds of a simple
// aggressive scripted player. Asserts move/attack/build all actually fired.
function assert(cond, msg) { if (!cond) { console.error('ASSERT FAIL:', msg); process.exitCode = 1; } }
const state = new GameState();
const engine = new GameEngine(state);
engine.newGame(7, 'concord');
const player = engine.factionOf('concord');

// Build at the capital (rocket = faction unique).
const b1 = engine.build(player.capital, 'rocket');
assert(!b1.ok && b1.reason === 'stack', 'capital full: build blocked by stacking');
const home = engine.citiesOwnedBy('concord').find(h => Hex.key(h.q,h.r) !== player.capital);
const homeKey = Hex.key(home.q, home.r);
const b2 = engine.build(homeKey, 'rocket');
assert(b2.ok, 'rocket built at homeland city');
assert(engine.build(homeKey, 'infantry').ok === false, 'one build per city per turn');

// Split: peel the armor off the capital stack and move it alone.
const armor = engine.stackAt(player.capital).find(u => u.type === 'armor');
const splitSets = engine.selectionSets(player.capital, [armor.id]);
assert(splitSets.reachable.size > 0, 'split armor has moves');
assert(splitSets.attackable.size === 0, 'split selection is movement-only');
const splitDest = [...splitSets.reachable.keys()][0];
assert(engine.moveStack(player.capital, splitDest, [armor.id]).ok, 'split move ok');
assert(engine.stackAt(player.capital).length === 2, 'two units stayed behind');
assert(engine.stackAt(splitDest).some(u => u.id === armor.id), 'armor moved alone');
assert(engine.stackAt(player.capital).every(u => !u.activated), 'stay-behinds not activated');

// Play 25 rounds of a simple aggressive player: move stacks toward nearest non-owned
// city, attack anything attackable, build infantry where possible.
let did = { move: 0, attack: 0, build: 0, bombard: 0 };
for (let round = 0; round < 25 && !state.winner && !player.eliminated; round++) {
    for (const key of engine.factionStackKeys('concord')) {
        const sets = engine.selectionSets(key, null);
        const atk = [...sets.attackable];
        if (atk.length > 0) {
            const res = engine.resolveCombat(key, atk[0]);
            if (res.ok) { did.attack++; continue; }
        }
        const bmb = [...sets.bombardable];
        if (bmb.length > 0) {
            const res = engine.bombard(key, bmb[0]);
            if (res.ok) { did.bombard++; continue; }
        }
        if (sets.reachable.size > 0) {
            // march toward the ai-style objective: nearest city not ours
            const cities = engine.cityHexes().filter(h => h.owner !== 'concord');
            if (cities.length) {
                const origin = Hex.fromKey(key);
                const goal = cities.reduce((a,b) => origin.distance(new Hex(a.q,a.r)) < origin.distance(new Hex(b.q,b.r)) ? a : b);
                let best = null, bd = origin.distance(new Hex(goal.q, goal.r));
                for (const k of sets.reachable.keys()) {
                    const d = Hex.fromKey(k).distance(new Hex(goal.q, goal.r));
                    if (d < bd) { bd = d; best = k; }
                }
                if (best && engine.moveStack(key, best, null).ok) did.move++;
            }
        }
    }
    for (const h of engine.citiesOwnedBy('concord')) {
        if (h.city.builtThisTurn) continue;
        if (engine.build(Hex.key(h.q,h.r), 'infantry').ok) did.build++;
    }
    for (const ev of engine.runOpponentRound()) { }
}
console.log('player actions:', JSON.stringify(did), 'cities:', engine.citiesOwnedBy('concord').length,
    'units:', state.units.filter(u=>u.faction==='concord').length, 'cp:', player.cp,
    'eliminated:', player.eliminated, 'winner:', state.winner);
assert(did.move > 0 && did.attack > 0 && did.build > 0, 'player exercised move/attack/build');
console.log(process.exitCode ? 'PLAYER TEST FAILED' : 'PLAYER TEST OK');
