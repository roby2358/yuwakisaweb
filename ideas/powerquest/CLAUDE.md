# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Power Quest** is an open-ended browser hex-and-counter game on the Hex & Counters base: a villager in
ancient power armor ranges a fogged wilderness (plains, jungle, flat-topped mesa), hunts powered monsters and
raiders, crafts relic parts into armor modules, and levels both the hero and the villages. See README.md for
play and the doc set below for design.

Design docs follow the ontology-spec format: **`ONTOLOGY.md`** is the implementation reference (purpose/goals
`G-n`, entities, invariants, rules as pseudocode, numbers, commands); **`CRITERIA.md`** turns each rule into a
row `R-n` that owns `test/R-n/`; **`RATIONALE.md`** holds the why (`D-n`, open `Q-n`); **`ARCHITECTURE_LOG.md`**
is the dated history; **`DYNAMICS.md`** is why it is fun. Cite stable IDs (`R-12`, `D-9`), never section
numbers, and reconcile ONTOLOGY + CRITERIA + RATIONALE + log in the same change as the code.

## Running / Developing

No build or install step. Scripts load as plain globals, so you can **double-click `index.html`** to run from
`file://`. Tests: `node test/run.js` (`-v` for every check). Tuning harness: `node test/sim.js [turns] [seeds]`
(a bot plays headless games). `node test/numbers.js` prints ONTOLOGY's numbers table from `artifacts.js`.

## Architecture

Plain `<script>` globals, no ES modules; `index.html` lists them in dependency order and `index.js` is the
bootstrap. State + Engine are DOM-free so they could run server-side unchanged.

| Module | Global | Role |
|---|---|---|
| `artifacts.js` | `GameArtifacts` | Rules-data: terrain, move costs, `MODULES`, `PERKS`, `ENEMY_KINDS` and every tunable number. No colors. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only colors, names, geometry. |
| `piece.js`, `pieces.js` | `Piece`; `Hero`, `Creature`, `Village`, `Ruin`, `Lair`, `hexDist` | Positioned tokens as plain serializable records. |
| `board.js` | `Board` | Terrain queries over `GameState.hexes`. |
| `gamestate.js` | `GameState` | Serializable data only. |
| `worldgen.js` | `WorldGen` | Map and site generation, seeded. |
| `ecology.js` | `Ecology` | Enemy phase, lair spawning, wild respawn. |
| `gameengine.js` | `GameEngine` | All hero rules and commands; every command returns `{ ok, events }`, `ok:false` changes nothing. |
| `gameui.js` | `GameUI` | Canvas with fog, DOM panels, input. Calls engine commands/queries only; never mutates state or computes legality. |
| `hex.js`, `rando.js`, `sound.js` | | Axial math + Dijkstra; seedable RNG (all engine randomness goes through it); WebAudio cues. |

Tests: `test/R-n/` (one rule per test, owned by a CRITERIA row), `test/helpers/arena.js` (a flat world for rule
tests), `test/integration/` (smoke walkthrough, stub-DOM UI smoke), `test/coverage.js` (CRITERIA ↔ directories).

## Conventions

- Pure client-side; no Node/npm, no bundler. Most modules wrap in an IIFE assigning one global; value classes
  (`Piece`, `Hero`, …) declare at top level.
- All randomness through `Rando` so a seed plus commands reproduces a game (R-4, R-30). Audio uses `Math.random`.
- Every tunable number lives in `artifacts.js` and is cited by name in docs and tests.
- Fog is a display filter: the engine state is complete.
- `UI_CONTROLS.md` is the controls specification inherited from the base; `gameui.js` follows its layers.
