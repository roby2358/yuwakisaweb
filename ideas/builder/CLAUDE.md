# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Founders' Road** is a browser hex-and-counter frontier-building game, grown from the
minimal Hex & Counters movement base. The player leads a crew of worker counters across
a big procedurally generated map: building resource producers on matching terrain,
laying roads, recruiting workers at Halls, shooing building-smashing beasts, and winning
by raising the three-stage Monument on the far side of the map.

Authoritative gameplay docs live in `README.md` (intent + UI) and `DYNAMICS.md`
(design journal: theme, drivers, mechanics, strategies — keep it updated when
mechanics change).

## Running / Developing

No build or install step. Scripts load as plain globals, so you can **double-click
`index.html` to run from `file://`**. Serving over HTTP also works if you prefer:
```bash
npx serve .
# or
python -m http.server 8000
```

**Verify engine changes headless**: `node test/sim.js [seed ...]` bundles the DOM-free
modules into a Node vm and has an A*-driven bot play whole games, asserting invariants
every turn (non-negative stockpile, no stacked workers, beast cap, legal building
terrain, traversable map). Default seeds should all win in ~25-30 turns. UI changes are
browser-playtested by the user.

## Architecture

### What actually runs

The game is **`index.html` + four game modules + shared libs + `index.css`**. It loads as
**plain `<script>` globals** (no ES modules) so the page runs from `file://` on a
double-click; `index.html` lists the scripts in dependency order and `index.js` is a thin
bootstrap that wires them together. The code is factored for an eventual client/server
split — the seam is drawn so State + Engine could run server-side unchanged:

| Module | Global | Role |
|---|---|---|
| `artifacts.js` | `GameArtifacts` | Static **rules-data** — `TERRAIN`, `MOVEMENT_COST`, the `BUILDINGS` table (siting terrain, cost, production), `ROAD`, `MONUMENT_STAGES`, `RECRUIT`, `BEAST` ecology rates, `WORKER_MP`, `MAP_COLS/ROWS`. Server-side; no colors/pixels. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only **display attrs** — `HEX_SIZE`, `COUNTER_SIZE`, terrain/building colors and labels, road/monument colors. Keyed off `GameArtifacts`; read only by `GameUI` and the pixel helpers in `hex.js`. Worker/beast colors are NOT here — they come from per-game ColorTheory palettes stored in `GameState`. |
| `gamestate.js` | `GameState` | Authoritative, **serializable data only** — `seed`, `hexes` (with `.road` flags), `workers`, `buildings`, `beasts`, `monument`, `resources`, the two palettes, `turn`, `phase`, `gameWon`. No behavior, no DOM, no view/interaction state. |
| `gameengine.js` | `GameEngine` | **Rules + generation** over a `GameState`. DOM-free and render-free: methods mutate state and *return outcomes*. Owns `newGame`/`diamondSquare`/`assignTerrain`, `computeReachable`/`computeAttackable`, `buildOptions`, the actions (`moveWorker`, `build`, `buildRoad`, `buildMonumentStage`, `recruit`, `shooBeast`), and `endTurn` (beast movement/spawn, then production). |
| `gameui.js` | `GameUI` | The **client**: canvas rendering (elevation-shaded terrain, road network, counters), DOM HUD (stockpile/income, Monument meter, build panel, beast reports), camera/pan, hover, selection, and all input wiring. Drives the engine and re-renders from state. |

Shared libraries the game modules depend on:

| Module | Used for |
|---|---|
| `hex.js` | Axial hex math + `bfsHexes` (Dijkstra reachability), `findPath` (A*, used by the sim bot), `Hex.key`, `drawHexPath`. Pixel helpers read `GameDisplayArtifacts.HEX_SIZE`; the axial math the engine uses needs neither artifacts file. |
| `rando.js` | `Rando` RNG helpers, **seedable** via `Rando.seed(n)` (mulberry32) so a game is reproducible from `state.seed` |
| `colortheory.js` | `ColorTheory.randomScheme` / `rgbToHex` for the per-game worker and beast palettes |
| `sound.js` | `GameSound` — client-only WebAudio bleeps/boops (pulse wave over a pentatonic scale). Owned by `GameUI`; randomizes with `Math.random` so it never perturbs the seeded `Rando` stream. Cues: `step`, `endTurn`, `fanfare`, `build`, `recruit`, `shoo`, `smash`. |

Server-readiness notes baked into the split: all randomness routes through the seeded
`Rando` (map, spawns, palettes, and beast AI reproduce from `state.seed`); every engine
action re-derives legality from its own rules (`computeReachable`, `buildOptions`)
rather than trusting caller-supplied costs (the "never trust the client" rule). Still
deferred — a serialized command/protocol layer between UI and engine, and `GameState`
(de)serialization; today `GameUI` calls engine methods directly.

### Input architecture (see `UI_CONTROLS.md`)

`UI_CONTROLS.md` is the **controls specification** for a family of hex-and-counter games,
organized in layers (core first, increasingly optional). This game implements Layers 1-2
plus the L3 attack slot; comments in `gameui.js` cite the layer they implement.

- A stack of modal flags decides what any click/key means: `overlay` → `targeting` →
  `selection`, with `phase` gating the whole thing. Handlers check them in that priority order.
- `selection = { workerId, reachable, attackable }` is computed at select time and
  recomputed after each action; the click handler is a **pure lookup** against those sets
  (L1.2). Clicking any worker selects it; Tab cycles workers with MP left.
- **L3 attackable is live**: `computeAttackable` returns adjacent beasts a worker with
  ≥ 2 MP can shoo; clicking a red hex commits `shooBeast`. There is no combat — shooing
  relocates the beast.
- The **build panel** renders `engine.buildOptions(worker)` descriptors as buttons
  (`data-action`/`data-type`); one delegated click handler dispatches to
  `build`/`buildRoad`/`buildMonumentStage`. Rules stay in the engine.
- `primaryAction()` (End Turn / Space / Enter) resolves the beast phase via
  `engine.endTurn()`, which returns smash events the HUD reports (L2.1). Esc peels back
  one modal layer, deepest first (L2.2). Overlays capture their dismissing input (L5).
- Still inert: modal `targeting` (L4 — no aimed abilities) and `locationAt` (L2.1 —
  no interactive locations).

### Coordinate system

Axial `(q, r)`, pointy-top hexes, stored in a `Map<string, hex>` keyed by `"q,r"` via
`Hex.key()`. The grid is laid out as a rectangle of `MAP_COLS × MAP_ROWS` (96×64) with a
per-row `qOffset = -floor(row/2)`, so each hex also carries its `col`/`row`. Hall/Monument
placement sorts by `col` for true left/right ends. Pan is a screen-space `(panX, panY)`
offset applied in `hexToScreen` / `screenToHex`.

### Hex object shape (as built in `gameengine.js`)

```javascript
{ q, r, col, row, elevation, isEdge, terrain, road }
```
`road` marks laid roads; workers/buildings/beasts live in their own `GameState` arrays,
not on the hex.

## Game Model (see DYNAMICS.md for the full design)

- **Map**: 96×64 hexes; terrain by elevation percentile (water/plains/hills/mountain)
  with forests + gold veins on plains and quarries on hills; edges forced to water.
  Regenerates (up to 20 tries) until Hall→Monument is traversable.
- **Movement cost**: plains 1; forest/hills/gold/quarry 2; water/mountain impassable.
  **A hex with a road or building always costs 1** — baked into `GameEngine.moveCost`
  so every consumer sees it. Beasts use `rawMoveCost` (roads mean nothing to them).
- **Economy**: one global stockpile (wood/stone/gold); buildings produce each end-of-turn
  (after beast movement — a smashed building pays nothing). All building rules live in
  the `GameArtifacts.BUILDINGS` table: new building type = new row, not new branches.
- **Beasts**: wander randomly (speed 1-2, rolled at spawn), destroy buildings they step
  on, refuse hexes within 2 of a watchtower, never enter the Monument hex or stack.
  Spawn chance scales with building count (escalation tied to progress); spawns are
  ≥ 8 hexes from anything the player owns; hard cap 12.
- **Win**: a worker on the Monument hex pays for stages Foundation (12s) → Frame (20w)
  → Crown (6g). **No defeat condition** — losses are smashed buildings, never workers.

## Conventions

- Pure client-side — plain `<script>` globals (no ES modules), no Node/npm dependencies,
  no build step, no bundler. Each module wraps its definition in an IIFE assigning one
  global. The only Node usage is the headless sim harness in `test/`.
- Color values are 0–1 floats except when converting to `#rrggbb` strings for canvas.
- Rules data (terrain, costs, buildings, ecology) comes from `GameArtifacts`;
  colors/labels/geometry from `GameDisplayArtifacts` (client-only — the engine never
  reads it). Tune balance numbers in `GameArtifacts` first — halve and double.
