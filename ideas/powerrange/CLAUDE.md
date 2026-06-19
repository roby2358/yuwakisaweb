# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hex & Counters** is a minimal browser hex-and-counter game intended as a clean baseline
for future board-wargame-style games. The current build is a movement puzzle: move the
player counter (P) across a procedurally generated terrain map to a target hex to win.

Authoritative gameplay docs live in `README.md` (intent + UI) and `DYNAMICS.md` (rules).
The codebase began as an extraction from the [Realm](../realm/) project, and `README.md`
notes the ongoing goal of stripping out Realm artifacts (danger points, resources,
installations) so they don't leak into new games.

## Running / Developing

No build or install step. Serve over HTTP so ES6 module imports resolve:
```bash
npx serve .
# or
python -m http.server 8000
```

## Architecture

### What actually runs

The game is **`index.html` + `index.js` + `index.css`**. `index.js` is self-contained:
module-level mutable state (`hexes`, `player`, `target`, `enemies`, `mp`, `turn`, pan vars),
immediate-mode canvas drawing through a single `render()` that redraws everything, and DOM
event listeners wired at the bottom of the file. It inlines its own diamond-square heightmap
(`diamondSquare`) and terrain assignment (`assignTerrain`) rather than using `terrain.js`.

Modules `index.js` imports and depends on:

| Module | Used for |
|---|---|
| `config.js` | `HEX_SIZE`, `TERRAIN`, `MOVEMENT_COST`, `PLAYER_MP`, `MAP_COLS`, `MAP_ROWS` |
| `hex.js` | Axial hex math + `bfsHexes` (Dijkstra reachability), `hexKey`, `drawHexPath` |
| `rando.js` | `Rando` static RNG helpers (`shuffle`, `choice`, `int`, …) |
| `colortheory.js` | `ColorTheory.randomScheme` / `rgbToHex` for per-enemy counter colors |

The live game draws flat-color hexes via `drawHexPath` + `TERRAIN_COLORS`; there is no
sprite/image pipeline. (Earlier `terrain.js` and `renderer.js` modules were Realm leftovers,
unwired and broken, and have been removed.)

### Input architecture (see `UI_CONTROLS.md`)

`UI_CONTROLS.md` is the **controls specification** for a family of hex-and-counter games,
organized in layers (core first, increasingly optional). **This game is the reference
implementation of its core (Layers 1–2)**; `index.js` also carries the wiring and inert
extension points for the optional layers. Comments in `index.js` cite the layer they
implement (e.g. `L1.2`, `L2.1`, `L4`).

- A stack of modal flags decides what any click/key means: `overlay` → `targeting` →
  `selection`, with `phase` gating the whole thing. Handlers check them in that priority order.
- `phase` gates map input to the player's turn (L1.1). `selection = { reachable, attackable }`
  is computed once at select time; the click handler is a **pure lookup** against those sets
  (L1.2). Movement auto-ends the turn at 0 MP (L1.4). Pan is a render-only offset; hover is
  tracked separately (L1.3). `primaryAction()` is the one context-sensitive action behind
  End-Turn / Space / Enter (L2.1). Esc peels back one modal layer, deepest first (L2.2).
  Overlays capture and consume their dismissing input (L5).
- **Extension points that are intentionally inert** in this move-only game (the optional
  layers): `computeAttackable()` returns empty — no combat (L3); the `targeting` modal state —
  no aimed abilities (L4); `locationAt()` returns null — no interactive locations (L2.1).
  When adding combat/skills/locations, fill these in — the dispatch already routes to them.

### Coordinate system

Axial `(q, r)`, pointy-top hexes, stored in a `Map<string, hex>` keyed by `"q,r"` via
`hexKey()`. The grid is laid out as a rectangle of `MAP_COLS × MAP_ROWS` with a per-row
`qOffset = -floor(row/2)`, so each hex also carries its `col`/`row`. Player/target placement
sorts by `col` for true left/right ends. Pan is a screen-space `(panX, panY)` offset applied
in `hexToScreen` / `screenToHex`.

### Hex object shape (as built in `index.js`)

```javascript
{ q, r, col, row, elevation, isEdge, terrain, resource, units: [], controlled }
```
`resource`, `units`, and `controlled` are currently inert placeholders.

## Game Model (see DYNAMICS.md)

- **Map**: 60×40 hex grid; terrain assigned by elevation percentile (water/plains/hills/
  mountain) then forests/gold/quarries scattered in; edges forced to water. `initGame`
  regenerates (up to 20 tries) until a path exists from player to target (`hasPath`).
- **Player**: `PLAYER_MP` (5) movement points per turn, spendable across multiple moves;
  reachability comes from `bfsHexes` treating enemy hexes as impassable.
- **Enemies**: 2d6 of them, spawned on passable hexes; each moves one random hex per turn.
  Water/mountain are impassable (`MOVEMENT_COST` of `Infinity`).
- **Win**: move onto the target hex. **No combat and no defeat condition** — landing on an
  enemy is impossible (enemy hexes are excluded from reachability), not an attack.

### Interaction

Click P to select → reachable hexes highlight yellow → click a highlighted hex to move.
Click P again or a non-highlighted hex to deselect. Right-drag pans. Space/Enter ends the
turn. Movement auto-ends the turn when MP hits 0.

## Conventions

- Pure client-side ES6 modules — no Node/npm, no build step, no bundler, no tests.
- Color values are 0–1 floats except when converting to `#rrggbb` strings for canvas.
- Terrain types come from the `TERRAIN` constant in `config.js`; movement from `MOVEMENT_COST`.
