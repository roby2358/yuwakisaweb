---
name: thingfactory-tools
description: Project-local dev recipes for Thing Factory (thingthatdoesathing) - `just cc-test` runs the whole suite and `just cc-sim N SIZE` runs the builder-bot tuning harness on one board size. Use before and after changing gameengine.js, gameui.js, artifacts.js numbers, or the docs' CRITERIA rows, and when asked to verify the game still works. Extend these instead of writing throwaway scripts.
---

# Thing Factory dev recipes

Run from `thingthatdoesathing/`. Invoke the recipes, not the raw script paths.

| Recipe | Runs | Use it |
|---|---|---|
| `just cc-test` | `node test/run.js` | After any code or CRITERIA change. Must end `ALL PASS`. `just cc-test -v` prints every check. |
| `just cc-sim 200 small` | `node test/sim.js 200 small` | After touching rules or numbers in `artifacts.js`. Sizes: small, medium, large, huge (huge is slow; 50 games is plenty). Prints turns, crates lost, mean/peak crates on the board and `at cap` (share of ticks at the crate cap). Compare against the latest numbers in RATIONALE (D-43 for the current spawn rule; D-7 small and D-3 every size are older). A pure refactor must reproduce them exactly. |
| `just cc-sim-to 100 small 5` | `node test/sim.js 100 small 5` | Same bot, played on to the Nth milestone: median turn per milestone and big crates spawned per game. Use when tuning anything past the first milestone (big crates, D-34). |

## What the suite holds

- `test/R-n/`: one directory per automated CRITERIA row, one rule per test. Use `flatGame()` from
  `test/helpers/load.js` for a controlled all-plains board.
- `test/integration/smoke.js`: random legal play, checking invariants.
- `test/integration/uiboot.js`: boots the real UI on a stub DOM with a seeded `Math.random`
  (`UI_RANDOM_SEED`) picks each board size, and plays a whole game by simulated clicks.
- `test/coverage.js`: fails if CRITERIA rows and `test/R-n/` directories disagree.

New rules get a CRITERIA row and a `test/R-n/` directory, not a one-off script.
