# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-player browser adaptation of the social-campaign half of GDW's 1975
*En Garde!* — status climbing, clubs, mistresses, regiments, gambling, duels,
and summer campaigns in 17th-century Paris. One subproject inside the
multi-project `yuwakisaweb` repo (git root is `/work/yuwakisaweb`, two levels
up; `git add` paths are relative to this directory, not the repo root).

## Running and verifying

- **Run:** double-click `index.html` (file:// protocol). No server, no build,
  no dependencies. Plain `<script>` includes only — **never ES modules**
  (`import`/`export` break on file://).
- **No unit tests.** This is a playtest-driven prototype. Verify changes by:
  1. `node --check <file>.js` for syntax,
  2. a throwaway headless sim in the scratchpad: concatenate the DOM-free
     files (`dice.js names.js core.js data.js flourish.js state.js engine.js
     town.js`) into one file, run scenarios under Node, assert on the output,
  3. browser playtest.
- **Cache busting:** `BUILD` in `index.js` and the `?v=N` query on all ten
  script tags in `index.html` must be bumped together on every script change.
  The build number renders in the header so a stale cache is visible.

## Architecture

Ten scripts share the global namespace, loaded in dependency order
(`index.html`): `dice.js` → `names.js` → `core.js` → `data.js` →
`flourish.js` → `state.js` → `engine.js` → `town.js` → `ui.js` → `index.js`.

The core/color split matters: material traceable to the published game goes
in `core.js`; solo-play inventions go in `data.js` (numbers and event tables)
or `town.js` (simulation behavior). New house rules must not land in core.js.

- **core.js** — the published game: tables and rule functions from the
  official reference tables at www.engarde.co.uk (birth, clubs, regiments,
  ranks, campaign outcomes, mistresses, influence, appointments, titles) plus
  economy constants (`MAINTENANCE_MULT`, `LOAN_INTEREST_RATE`, `HORSE_PRICE`,
  …). Nothing invented lives here. Rules-fidelity deviations are listed in
  README.md — keep that list current.
- **data.js** — the solo-play layer: house-rule constants and invented tables
  (regiment friendships `REGIMENT_RELATIONS`, brigade deployment odds, mission
  selection, bawdyhouse gambling, honor-event/mortality/malady chances, the
  paired 40-entry affront tables).
- **flourish.js** — `flourish(table, sl)` picks a purely-cosmetic line from a
  humble→grand 20-item table, indexed by social level with d6 jitter, so flavor
  fits a gentleman's station (`NATURAL_DEATHS`, `QUIET_CAMPAIGN`). Add a ranked
  flourish by adding one 20-item table; depends only on `dice.js`.
- **state.js** — character generation (Birth Tables A–D), `newGame()`, world
  state shape, localStorage save/load. Old saves get lazy back-compat shims at
  load time (e.g. `applications()`, `ensureNpcStats`) rather than migrations.
- **engine.js** — rules resolution: the monthly loop (`resolveMonth`), duels,
  campaigns, and the forecast functions the panels use (`statusForecast`,
  `expensesForecast`, `incomeForecast`).
- **town.js** — the invented living-Paris simulation `resolveMonth` calls into:
  rival gentlemen (campaigning, drift, courtship, replenishment), lady and
  player mortality, maladies, honour events, and mistress suits. Entry point is
  `simulateRivals`.
- **ui.js** — DOM rendering only, plus `collectPlan(state)` which reads the
  planner inputs back into a plan object. `el()` and `esc()` helpers live here.
- **index.js** — boot, event delegation (single document-level `click`/`change`
  listeners with an id→handler table), and the month-flow glue.

### Key patterns

- **Dispatch tables over mode conditionals.** `WEEK_ACTIONS` in engine.js is
  the model: each action carries `label`, `resolve(state, params, ctx)`,
  `forecastSP(state, params)`, `forecastCost(state, params)`, and optionally
  `costLabel`. Adding a week action is one table entry, not a scavenger hunt.
  Follow this shape for any new kind/mode discriminator.
- **Forecast panels mirror resolution.** The Status and Ledger panels
  predict what `resolveMonth` will do by reading live planner selections via
  `collectPlan(state)`. They must render *after* `wirePlanner(state)` in
  `render()`, and are re-rendered from the `onChange` handler whenever an
  input inside `#planner` changes. If you change a resolve function, update
  its forecast counterpart in the same commit.
- **Rules fidelity is the spec.** When behavior and the official tables
  disagree, the tables win; the user quotes the rulebook when correcting.
  Deliberate solo-play deviations go in the README's Deviations list.

## Conventions

- Commit messages are prefixed `engarde:`. Do not commit or push until asked.
- No default or optional parameters; fail fast on missing values.
- Guard clauses and early exits over nesting; shallow call chains.
- Project tasks are tracked in `pjpd/tasks.txt` (tags describe the task, not
  the project — no `engarde-` prefix).
