---
name: thingfactory-tools
description: Project-local dev recipes for Thing Factory (ideas/thingthatdoesathing) - `just cc-test` runs the whole suite and `just cc-sim N` runs the builder-bot tuning harness. Use before and after changing gameengine.js, gameui.js, artifacts.js numbers, or the docs' CRITERIA rows, and when asked to verify the game still works. Extend these instead of writing throwaway scripts.
---

# Thing Factory dev recipes

Run from `ideas/thingthatdoesathing/`. Invoke the recipes, not the raw script paths.

| Recipe | Runs | Use it |
|---|---|---|
| `just cc-test` | `node test/run.js` | After any code or CRITERIA change. Must end `ALL PASS`. `just cc-test -v` prints every check. |
| `just cc-sim 200` | `node test/sim.js 200` | After touching rules or numbers in `artifacts.js`. Compare against the figure in RATIONALE D-7. A pure refactor must reproduce it exactly. |

## What the suite holds

- `test/R-n/`: one directory per automated CRITERIA row, one rule per test. Use `flatGame()` from
  `test/helpers/load.js` for a controlled all-plains board.
- `test/integration/smoke.js`: random legal play, checking invariants.
- `test/integration/uiboot.js`: boots the real UI on a stub DOM with a seeded `Math.random`
  (`UI_RANDOM_SEED`) and plays a whole game by simulated clicks.
- `test/coverage.js`: fails if CRITERIA rows and `test/R-n/` directories disagree.

New rules get a CRITERIA row and a `test/R-n/` directory, not a one-off script.
