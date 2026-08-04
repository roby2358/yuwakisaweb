// tests/balance-watch.js — AI-vs-AI balance telemetry (run: node tools/headless.js tests/balance-watch.js)
//
// Not pass/fail: a passive player watches 120 rounds on seed 42, printing per-faction
// VC/CP/unit counts, partisan city count, and combats-per-10-rounds. Use after tuning
// GameArtifacts numbers (ECON, COMBAT, AI) to spot stalemates, freezes (combats -> 0),
// unit bloat, or runaway snowballs.
const state = new GameState();
const engine = new GameEngine(state);
engine.newGame(42, 'concord');
let combats = 0;
for (let round = 1; round <= 120; round++) {
    for (const ev of engine.runOpponentRound()) if (ev.type === 'combat') combats++;
    if (round % 10 === 0) {
        const vcs = state.factions.map(f => `${f.id}:${engine.victoryCityCount(f.id)}vc/${f.cp}cp/${state.units.filter(u=>u.faction===f.id).length}u`).join(' ');
        const partisanCities = engine.cityHexes().filter(h => h.owner === 'partisan').length;
        console.log(`r${round} ${vcs} partisanCities=${partisanCities} combats10=${combats}`);
        combats = 0;
    }
    if (state.winner) { console.log('winner', state.winner, 'round', round); break; }
}
