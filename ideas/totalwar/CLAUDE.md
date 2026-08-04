# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Total War** is a browser hex-and-counter grand strategy game — Avalon Hill's *Third
Reich* as the skeleton, in a WWII-shaped world where four genre-flavored powers
(dieselpunk, high fantasy, low fantasy, retro-futurist sci-fi) fight over cities. The
player runs one faction; the engine runs the other three plus partisans.

Authoritative gameplay docs live in `README.md` (intent + UI) and `DYNAMICS.md` (the
design journal: theme, psychological drivers, rules, strategies, and v1 implementation
notes). Read DYNAMICS.md before changing rules — every mechanic there names the driver
it serves, and the Strategies section documents the anti-degenerate-play constraints.
The codebase grew from the Hex & Counters baseline (itself extracted from
[Realm](../realm/)).

## Running / Developing

No build or install step. Scripts load as plain globals, so you can **double-click
`index.html` to run from `file://`**. Serving over HTTP also works if you prefer:
```bash
npx serve .
# or
python -m http.server 8000
```

Headless testing: `node tools/headless.js tests/<file>.js` runs a test body against the
engine-side sources (no DOM needed). See the `totalwar-tools` skill in
`.claude/skills/` — use those tests (`smoke`, `player`, `balance-watch`) rather than
writing throwaway scripts, and run smoke + player after any engine change.

## Architecture

### What actually runs

The game is **`index.html` + four game modules + shared libs + `index.css`**. It loads as
**plain `<script>` globals** (no ES modules) so the page runs from `file://` on a
double-click; `index.html` lists the scripts in dependency order and `index.js` is a thin
bootstrap. The code is factored for an eventual client/server split — State + Engine
could run server-side unchanged:

| Module | Global | Role |
|---|---|---|
| `artifacts.js` | `GameArtifacts` | Static **rules-data** — `TERRAIN`, `MOVEMENT_COST`, `UNITS` (stat/flag templates), `FACTIONS`, `COMBAT` (CRT + multipliers), `ECON`, `CITIES`, `STACK_LIMIT`, `AI` temperament. Server-side; no colors/pixels. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only **display attrs** — geometry, terrain/faction colors, unit counter labels, faction blurbs, highlight styles. Read only by `GameUI` and the pixel helpers in `hex.js`. |
| `gamestate.js` | `GameState` | Authoritative, **serializable data only** — `seed`, `hexes`, `cityKeys`, `factions`, `units`, `playerFaction`, `turn`, `phase`, `winner`. No behavior, no DOM. |
| `gameengine.js` | `GameEngine` | **Rules + generation + AI** over a `GameState`. DOM-free: methods mutate state and *return outcomes*. Owns generation (`newGame`, cities/capitals/homelands), movement (`computeStackReachable` with ZOC + stacking), combat (`computeOdds`, `resolveCombat`, breakthrough, `bombard`), economy (`build`, `startFactionTurn`), strain (`endFactionTurn` revolts), and the AI (`aiOperations`, balance-of-power targeting). `runOpponentRound()` is a **generator yielding one event per mutation** so the client animates from the same code path. |
| `gameui.js` | `GameUI` | The **client**: canvas rendering (terrain, ownership tint, command web, cities, counter stacks, highlights, odds preview), DOM HUD + build panel + faction-select/end overlays, camera/pan, and all input wiring. Consumes the engine's event generator with async delays to animate the opponents' round. |

Shared libraries: `hex.js` (axial hex math, `bfsHexes` Dijkstra, `findPath` A*,
`drawHexPath`), `rando.js` (seedable RNG — all engine randomness routes through it so a
game reproduces from `state.seed`), `colortheory.js` (currently unused by the game
modules), `sound.js` (`GameSound` WebAudio cues; uses `Math.random`, never the seeded
stream).

### Input architecture (see `UI_CONTROLS.md`)

`UI_CONTROLS.md` is the controls specification; `gameui.js` cites layers (L1.2, L2.1, …).
Modal priority: overlay → animating → selection. Selection is computed once via
`engine.selectionSets(key)` (reachable/attackable/bombardable with CP checks baked in);
the click handler is a pure lookup. Esc deselects; Space/Enter is the primary action
(end turn). The formerly-inert extension points are now live: `computeAttackable` (red),
`computeBombardable` (orange), build panel on friendly cities.

### Coordinate system

Axial `(q, r)`, pointy-top hexes, stored in a `Map<string, hex>` keyed by `"q,r"` via
`Hex.key()`. Rectangle of `MAP_COLS × MAP_ROWS` with per-row `qOffset = -floor(row/2)`.
Pan is a screen-space offset in `hexToScreen` / `screenToHex`.

### Key data shapes (all plain serializable data — see `gamestate.js` header)

```javascript
hex     { q, r, col, row, elevation, isEdge, terrain, owner,
          city: null | { name, victory, homelandOf, heldTurns, builtThisTurn } }
faction { id, name, unique, capital, cp, eliminated, victoryStreak,
          uniqueCostBump, aiObjective, aiObjectiveAge }
unit    { id, type, faction, q, r, entrenched, activated, attacked, freeMP }
```

## Game Model (authoritative: DYNAMICS.md)

- **Map**: 60×40 hexes, diamond-square terrain (water/plains/hills/mountain + forests),
  edges water; 24 named cities, 4 capitals seated max-spread, 3 homeland cities each,
  the rest partisan-held; 9 victory cities. Regenerates until capitals connect by land.
- **Economy**: cities pay CP (capital 5 / homeland 3 / conquered 2 after a full turn
  held); activating a stack costs 1 CP in the command web (capital/HQ radius), 2 beyond.
- **Units**: 6 shared types + 1 unique per faction, all one template
  `{atk, def, mp, cost, cap, flags}` — identity lives in the flags (exploit, support,
  strike, occupier, command, bombard, flies, allTerrain, siege, cohesion).
- **Combat**: odds CRT (1:1–4:1, d6), terrain/city/entrench multipliers, auto-joining
  adjacent stacks + artillery/air support, ZOC baked into movement BFS, retreat-denied
  defenders eliminated (pockets), exploit units advance + get a free 2-MP move.
- **Strain**: empty conquered cities revolt on 5–6 → flip partisan + spawn militia
  hostile to all; capital loss cascades revolts.
- **Victory**: hold 5/9 victory cities for 3 consecutive turns (public countdown);
  faction with no cities is eliminated. AI dogpiles whoever nears victory.

## Conventions

- Pure client-side — plain `<script>` globals (no ES modules), no Node/npm, no build
  step, no bundler, no test framework (headless node concat harness only). Each module
  wraps its definition in an IIFE assigning one global.
- Rules numbers live in `GameArtifacts` (including AI temperament); colors/labels/
  geometry in `GameDisplayArtifacts` (the engine never reads it).
- All engine randomness goes through the seeded `Rando`; UI/audio randomness uses
  `Math.random` so it never perturbs the seeded stream.
- Engine methods re-derive legality themselves ("never trust the client") and return
  outcome objects; the UI renders from state, never computes rules.
