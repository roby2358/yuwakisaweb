
// tests/smoke.js — engine invariants over full games (run: node tools/headless.js tests/smoke.js)
//
// Four seeds: generation invariants (city/faction/VC counts, capitals owned), one
// player action, then passive-player rounds to a winner or the 120-round cap, checking
// events, finite CP, on-map units, and stack limits every round. Prints one outcome
// line per seed; exits non-zero on any assertion failure.
function assert(cond, msg) { if (!cond) { console.error('ASSERT FAIL:', msg); process.exitCode = 1; } }

for (const seed of [1, 42, 999, 31337]) {
    const state = new GameState();
    const engine = new GameEngine(state);
    engine.newGame(seed, 'concord');

    assert(state.cityKeys.length === 24, `seed ${seed}: 24 cities (got ${state.cityKeys.length})`);
    assert(state.factions.length === 4, `seed ${seed}: 4 factions`);
    const vcs = engine.cityHexes().filter(h => h.city.victory).length;
    assert(vcs === 9, `seed ${seed}: 9 victory cities (got ${vcs})`);
    assert(state.units.length > 0, `seed ${seed}: units spawned`);
    for (const f of state.factions)
        assert(state.hexes.get(f.capital).owner === f.id, `seed ${seed}: ${f.id} owns capital`);

    // Player exercises the API once: select the capital stack, move, maybe attack.
    const player = engine.factionOf('concord');
    const sets = engine.selectionSets(player.capital, null);
    assert(sets.reachable.size > 0, `seed ${seed}: capital stack has moves`);
    const dest = [...sets.reachable.keys()][0];
    const mv = engine.moveStack(player.capital, dest, null);
    assert(mv.ok, `seed ${seed}: capital stack move ok`);

    // Passive player from here: run rounds until someone wins or we hit the cap.
    let rounds = 0;
    while (!state.winner && !player.eliminated && rounds < 120) {
        for (const ev of engine.runOpponentRound()) {
            assert(ev && typeof ev.type === 'string', 'event has a type');
        }
        rounds++;
        for (const f of state.factions)
            assert(Number.isFinite(f.cp), `seed ${seed}: ${f.id} cp finite (${f.cp})`);
        for (const u of state.units) {
            assert(state.hexes.has(Hex.key(u.q, u.r)), `unit ${u.id} on the map`);
            assert(engine.unitsAt(u.q, u.r).length <= 3 || u.faction === 'partisan',
                `seed ${seed} round ${rounds}: stack limit at ${u.q},${u.r} (${engine.unitsAt(u.q, u.r).length})`);
        }
    }
    const outcome = state.winner ? `winner=${state.winner}` :
        player.eliminated ? 'player eliminated' : 'no result';
    console.log(`seed ${seed}: ${rounds} rounds, ${outcome}, ` +
        `units=${state.units.length}, aliveFactions=${engine.aliveFactions().length}`);
}
console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE OK');
