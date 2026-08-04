---
name: totalwar-tools
description: Project-local dev tools for Total War - the headless engine test runner (tools/headless.js) and the reusable tests under tests/ (smoke, player, balance-watch). Use before and after changing gameengine.js, gamestate.js, or the numbers in artifacts.js, when tuning balance, or when asked to verify the game still works. Do not write throwaway test scripts; extend these.
---

# Total War Dev Tools

The game is plain-script globals with no test framework. All headless testing goes
through one runner that rebuilds the browser's global scope in node:

```bash
node tools/headless.js tests/<file>.js
```

`tools/headless.js` concatenates the engine-side sources (`artifacts.js`,
`displayartifacts.js`, `rando.js`, `hex.js`, `gamestate.js`, `gameengine.js`) with the
given test body and evaluates them as one program. Test bodies are NOT modules — no
`require`, no imports; they just use the globals (`GameState`, `GameEngine`, `Hex`,
`bfsHexes`, `Rando`, `GameArtifacts`) directly. Signal failure by setting
`process.exitCode = 1` (see the `assert` helper at the top of the pass/fail tests).

## Existing tests (extend these instead of writing new throwaway scripts)

| Test | Kind | What it covers |
|---|---|---|
| `tests/smoke.js` | pass/fail | Full-game invariants over 4 seeds with a passive player: generation counts (24 cities, 4 factions, 9 VCs), event shape, finite CP, on-map units, stack limits, and prints each game's outcome line. |
| `tests/player.js` | pass/fail | Every engine API the UI drives: build rules (stack-full block, one-per-city), `selectionSets`, `moveStack`, `resolveCombat`, `bombard`, via 25 rounds of a scripted aggressive player. |
| `tests/balance-watch.js` | telemetry | 120 AI-vs-AI rounds on seed 42, printing per-faction VC/CP/units, partisan cities, and combats-per-10-rounds. Read it for stalemates (combats → 0 means a freeze bug), unit bloat, or snowballs. |

## Workflow

- After any change to `gameengine.js` or `gamestate.js`: run smoke + player. Both must
  end `... OK`.
- After tuning numbers in `GameArtifacts` (ECON, COMBAT, CITIES, AI): also run
  balance-watch and compare the shape against the previous run. Healthy output shows
  ongoing combats most rows and factions trading VCs; known-acceptable: some seeds run
  the full 120 rounds without a winner (three-way AI standoffs — a human breaks them).
- New engine features get their checks added to `tests/player.js` (API surface) or
  `tests/smoke.js` (invariants), not a new one-off file. New telemetry angles can go
  in balance-watch.
- Seeds are deterministic: `engine.newGame(<seed>, '<factionId>')` reproduces a whole
  game, so a failing seed is a permanent repro case — hardcode it into the test.
