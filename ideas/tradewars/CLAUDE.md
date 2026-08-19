# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Caravans & Conquest** is a browser strategy game built on the Hex & Counters foundation.
The caravan crosses a procedurally generated frontier, gathers cargo, fulfills contracts,
buys provisions, and decides when force against raiders is worth increased unrest.

Authoritative gameplay docs live in `README.md` (intent + UI) and `DYNAMICS.md` (rules).

## Running / Developing

No build or install step. Scripts load as plain globals, so you can **double-click
`index.html` to run from `file://`**. Serving over HTTP also works if you prefer:
```bash
npx serve .
# or
python -m http.server 8000
```

## Architecture

### What actually runs

The game is **`index.html` + game modules + shared libs + `index.css`**. It loads as
**plain `<script>` globals** (no ES modules) so the page runs from `file://` on a
double-click; `index.html` lists the scripts in dependency order and `index.js` is a thin
bootstrap that wires them together. The code is factored for an eventual client/server
split — the seam is drawn so State + Engine could run server-side unchanged:

| Module | Global | Role |
|---|---|---|
| `artifacts.js` | `GameArtifacts` | Static rules vocabulary: terrain, resources, phases, outcomes, movement, costs, rewards, and thresholds. Server-side; no colors or pixels. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only colors, terrain names, canvas geometry, and seeded raider palette construction. |
| `piece.js` | `Piece` | Generic positioned-counter foundation: coordinates, identity, and movement helpers. |
| `domain.js` | `GameDomain` | Game ontology: `ResourceStock`, `Caravan`, `Market`, and `Raider`. Cargo belongs to the caravan; markets distinguish trading posts from the Crown Market. |
| `board.js` | `Board` | **Query layer over the hex `Map`** — `moveCost`/`isPassable`/`passableHexes`/`neighbors`/`hasPath`. Rebuilt whenever the map is. |
| `gamestate.js` | `GameState` | Authoritative map, actors, campaign values, phase, status message, and one nullable outcome. No DOM or view state. |
| `gameengine.js` | `GameEngine` | Rules and generation over `GameState`, delegating terrain queries to `Board` and resource arithmetic to `ResourceStock`. |
| `gameui.js` | `GameUI` | The **client**: canvas rendering, DOM HUD, camera/pan, hover, selection/targeting/overlay modal state, and all input wiring. Drives the engine and re-renders from state. |

Shared libraries the game modules depend on:

| Module | Used for |
|---|---|
| `hex.js` | Axial hex math + `bfsHexes` (Dijkstra reachability), `Hex.key`, `drawHexPath`. Pixel helpers read `GameDisplayArtifacts.HEX_SIZE`; the axial math the engine uses needs neither artifacts file. |
| `rando.js` | `Rando` RNG helpers, **seedable** via `Rando.seed(n)` (mulberry32) so a game is reproducible from `state.seed` |
| `colortheory.js` | Client-only color-scheme utilities. `GameDisplayArtifacts` uses its monochromatic generator for the red raider palette without consuming the authoritative `Rando` stream. |
| `sound.js` | `GameSound` — client-only WebAudio bleeps/boops (pulse wave over a pentatonic scale), adapted from Warrior. Owned by `GameUI`; randomizes with `Math.random` so it never perturbs the seeded `Rando` stream. |

Server-readiness notes baked into the split: all randomness routes through the seeded
`Rando` (map, spawns, and AI reproduce from `state.seed`); `GameEngine.moveCaravan`
re-derives legality from its own `computeReachable` rather than trusting a caller-supplied
cost (the "never trust the client" rule). Still deferred — a serialized command/protocol
layer between UI and engine, and `GameState` (de)serialization; today `GameUI` calls engine
methods directly.

The live game draws flat-color hexes via `drawHexPath` + `TERRAIN_COLORS`; there is no
sprite/image pipeline. (Earlier `terrain.js` and `renderer.js` modules were Realm leftovers,
unwired and broken, and have been removed.)

### Input architecture (see `UI_CONTROLS.md`)

`UI_CONTROLS.md` is the generic Hex & Counters control specification. This game specializes
its selected-counter sets as `{ reachable, forceTargets }`. Phase gates map actions to the
caravan phase; yellow and red highlights are precomputed by the engine and the click handler
only dispatches against those sets. Native clicks perform actions, left drags pan after a
small threshold, and overlays consume input before board actions.

### Coordinate system

Axial `(q, r)`, pointy-top hexes, stored in a `Map<string, hex>` keyed by `"q,r"` via
`hexKey()`. The grid is laid out as a rectangle of `MAP_COLS × MAP_ROWS` with a per-row
`qOffset = -floor(row/2)`, so each hex also carries its `col`/`row`. Caravan/Crown Market placement
sorts by `col` for true left/right ends. Pan is a screen-space `(panX, panY)` offset applied
in `hexToScreen` / `screenToHex`.

### Hex object shape (as built in `gameengine.js`)

```javascript
{ q, r, col, row, elevation, isEdge, terrain, depleted }
```
`depleted` records whether a one-use timber, ore, or coin site has been gathered.

## Game Model (see DYNAMICS.md)

- **Map**: 60×40 hex grid; terrain assigned by elevation percentile (water/plains/hills/
  mountain) then forests/gold/quarries scattered in; edges forced to water.
  `GameEngine.newGame` regenerates (up to 20 tries) until a path exists from caravan to
  Crown Market (`Board.hasPath`), after seeding `Rando` so the world reproduces from `state.seed`.
- **Caravan**: `CARAVAN_MP` (5) movement points per turn, spendable across multiple moves;
  reachability comes from `bfsHexes` treating raider hexes as impassable.
- **Economy**: forests yield timber, quarries yield ore, and gold terrain yields coin once.
  Trading posts and the Crown Market exchange timber + ore for influence and coin, or coin for provisions.
- **Raiders**: spawned on the caravan's connected landmass and biased toward the caravan.
  Adjacent raiders steal cargo; attacking one costs provisions + ore, earns coin, and
  increases unrest. Higher unrest can spawn reinforcements.
- **Win**: reach the Crown Market with 15 influence. **Lose** by exhausting provisions or
  reaching maximum unrest.

### Interaction

Click C to select → reachable hexes highlight yellow and adjacent raiders highlight red.
Click C again or a non-highlighted hex to deselect. A stationary left press is a click;
left-dragging past `DRAG_THRESHOLD` pans. Space/Enter ends the turn. Movement auto-ends
the turn when MP hits 0.

## Conventions

- Pure client-side — plain `<script>` globals (no ES modules), no Node/npm, no build step,
  and no bundler. `test/gameengine.test.js` is a DOM-free regression test for the
  engine/state/board/piece stack and Trade Wars rules.
- Color values are 0–1 floats except when converting to `#rrggbb` strings for canvas.
- Terrain types come from `GameArtifacts.TERRAIN`; movement from `GameArtifacts.MOVEMENT_COST`.
  Colors/labels/geometry come from `GameDisplayArtifacts` (client-only — the engine never reads it).
