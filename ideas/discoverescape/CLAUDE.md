# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Waking Isle** is a discover-and-escape hex-and-counter game built on the
[Hex & Counters](../hexandcounter/) base. The player lands on a fog-shrouded island,
explores for relic tombs, and every relic taken wakes hunters that chase them back to
the boat: win by escaping with at least one relic, lose if a hunter reaches your hex.

Authoritative gameplay docs live in `DYNAMICS.md` (design: theme, drivers, mechanics,
strategies, tuning — including the tuning history of *why* the numbers are what they
are) and `README.md` (intent + UI). Balance is verified headlessly by `test/sim.js`.

## Running / Developing

No build or install step. Scripts load as plain globals, so you can **double-click
`index.html` to run from `file://`**. Serving over HTTP also works if you prefer:
```bash
npx serve .
# or
python -m http.server 8000
```

Headless verification (no DOM, drives a greedy bot through whole games and asserts
rule invariants every turn — also the balance harness):
```bash
node test/sim.js            # stat matrix over seeds x escape thresholds
node test/sim.js <seed> [n] # replay one game verbosely (escape after n relics)
```

## Architecture

### What actually runs

The game is **`index.html` + four game modules + shared libs + `index.css`**. It loads as
**plain `<script>` globals** (no ES modules) so the page runs from `file://` on a
double-click; `index.html` lists the scripts in dependency order and `index.js` is a thin
bootstrap that wires them together. The code is factored for an eventual client/server
split — the seam is drawn so State + Engine could run server-side unchanged:

| Module | Global | Role |
|---|---|---|
| `artifacts.js` | `GameArtifacts` | Static **rules-data** — `TERRAIN`, `MOVEMENT_COST`, `PLAYER_MP`, `MAP_COLS/ROWS`, `SIGHT` radii, `RELIC`/`CAIRN` placement rules, `NIGHT_TURN`, and the `HUNTER` tuning block (speeds, scent, burst, trickle, decay). Server-side; no colors/pixels. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only **display attrs** — `HEX_SIZE`, `COUNTER_SIZE`, `TERRAIN_COLORS/NAMES`, `FOG_COLOR`, `NIGHT_TINT`, `PLAYER/BOAT/RELIC/CAIRN` colors, `HUNTER_COLORS` (keyed by speed — brighter = faster). Keyed off `GameArtifacts.TERRAIN`; read only by `GameUI` and the pixel helpers in `hex.js`. |
| `gamestate.js` | `GameState` | Authoritative, **serializable data only** — `seed`, `hexes` (each hex carries `explored`), `player`, `boat`, `relics`, `cairns`, `hunters`, `carried`, `turn`, `mp`, `night`, `gameWon`, `gameLost`, `phase`. No behavior, no DOM, no view/interaction state. |
| `gameengine.js` | `GameEngine` | **Rules + generation** over a `GameState`. DOM-free and render-free: methods mutate state and *return outcomes*. Owns `newGame`/`diamondSquare`/`assignTerrain`/`oceanKeys`/`placeBoat`/`placeRelics`/`placeCairns`, `reveal`/`sightRadius`/`glimpse`/`losClear` (fog + distant sight), `computeReachable`, `movePlayer`, `endTurn`, and the hunter ecology (`moveHunters`, `spawnHunter`, `burstFromTomb`, `trickleFromTombs`, `decayFarHunters`, `scentRange`). |
| `gameui.js` | `GameUI` | The **client**: canvas rendering (fog, boat/relic/cairn markers, hunter counters, night tint), DOM HUD, camera/pan, hover, selection/targeting/overlay modal state, and all input wiring. Drives the engine and re-renders from state. |

Shared libraries the game modules depend on:

| Module | Used for |
|---|---|
| `hex.js` | Axial hex math + `bfsHexes` (Dijkstra reachability) + `findPath` (A*, used by hunter pursuit) + `lineTo` (cube-lerp hex line, used by LOS), `Hex.key`, `drawHexPath`. Pixel helpers read `GameDisplayArtifacts.HEX_SIZE`; the axial math the engine uses needs neither artifacts file. |
| `rando.js` | `Rando` RNG helpers, **seedable** via `Rando.seed(n)` (mulberry32) so a game is reproducible from `state.seed` |
| `sound.js` | `GameSound` — client-only WebAudio bleeps/boops (pulse wave over a pentatonic scale), adapted from Warrior. Owned by `GameUI`; randomizes with `Math.random` so it never perturbs the seeded `Rando` stream. Cues: step, endTurn, fanfare, pickup (relic), defeat (caught). |

Server-readiness notes baked into the split: all randomness routes through the seeded
`Rando` (map, spawns, and hunter AI reproduce from `state.seed`); `GameEngine.movePlayer`
re-derives legality from its own `computeReachable` rather than trusting a caller-supplied
cost (the "never trust the client" rule) — and the fog is part of that legality (unexplored
hexes cost `Infinity`), so the highlight *is* the rule. Still deferred — a serialized
command/protocol layer between UI and engine, and `GameState` (de)serialization; today
`GameUI` calls engine methods directly.

The live game draws flat-color hexes via `drawHexPath` + `TERRAIN_COLORS`; there is no
sprite/image pipeline.

### Input architecture (see `UI_CONTROLS.md`)

`UI_CONTROLS.md` is the **controls specification** for a family of hex-and-counter games,
organized in layers (core first, increasingly optional). **This game is the reference
implementation of its core (Layers 1–2)**; `gameui.js` carries the wiring and inert
extension points for the optional layers. Comments in `gameui.js` cite the layer they
implement (e.g. `L1.2`, `L2.1`, `L4`). The rule-side hooks they route to
(`computeAttackable`, `locationAt`) live on `GameEngine`.

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
`Hex.key()`. The grid is laid out as a rectangle of `MAP_COLS × MAP_ROWS` with a per-row
`qOffset = -floor(row/2)`, so each hex also carries its `col`/`row`. Boat placement sorts
by `col` for a true left-edge landing; relics filter on `col` for depth. Pan is a
screen-space `(panX, panY)` offset applied in `hexToScreen` / `screenToHex`.

### Hex object shape (as built in `gameengine.js`)

```javascript
{ q, r, col, row, elevation, isEdge, terrain, explored, glimpsed }
```

## Game Model (see DYNAMICS.md)

- **Map**: 60×40 hex grid; terrain assigned by elevation percentile (water/plains/hills/
  mountain) then forests scattered among plains; edges forced to water (it's an island).
  `GameEngine.newGame` regenerates (up to 20 tries) until all 5 relic tombs are placed
  deep (col ≥ 35%), spaced ≥8 apart, and reachable from the boat, after seeding `Rando`
  so the whole game reproduces from `state.seed`. Cairns are best-effort.
- **Fog**: hexes start unexplored; entering a hex reveals radius 3 (4 on hills; cairns
  one-shot radius 6). Only explored hexes are reachable — you move at the pace of sight.
  Beyond the reveal, straight sightlines out to 8 hexes mark hexes `glimpsed` (faded
  terrain, no markers, not walkable); hills/mountains/forests (`LOS_BLOCKERS`) block
  the line. The boat lands on a waterfront hex touching the *ocean* — the edge-connected
  water body found by flood fill (`oceanKeys`) — never a lakeshore.
- **Player**: `PLAYER_MP` (6) per turn, spendable across multiple moves; reachability
  from `bfsHexes` treating hunter hexes *and unexplored hexes* as impassable.
- **Hunters**: spawn from plundered tombs (burst of 2, dormant one turn, ring 6–10; then
  a trickle that accelerates with relics carried); pursue with full A* but only within
  scent range (`9 + 2×carried`, +4 at night); roll speed at spawn (d6 → 2/2/2/3/3/4 MP,
  +1 at night); 30% hesitation; decay beyond 15 hexes; hard cap 10.
- **Win/Loss**: reach the boat carrying ≥1 relic to win; a hunter entering your hex is
  the loss event. No combat — landing on a hunter is impossible (excluded from
  reachability), not an attack.

### Interaction

Click P to select → reachable hexes highlight yellow → click a highlighted hex to move.
Click P again or a non-highlighted hex to deselect. Left-drag pans: a stationary left
press is a click (select/move), a drag past a few px pans (see `DRAG_THRESHOLD` in
`gameui.js`). Space/Enter ends the turn. Movement auto-ends the turn when MP hits 0 —
and because ending a turn hands the hunters their phase, `movePlayer` can return
`caught: true` from a move that merely spent the last MP.

## Conventions

- Pure client-side — plain `<script>` globals (no ES modules), no Node/npm, no build step,
  no bundler, no tests. Each module wraps its definition in an IIFE assigning one global to
  keep top-level names from colliding across scripts.
- Color values are 0–1 floats except when converting to `#rrggbb` strings for canvas.
- Terrain types come from `GameArtifacts.TERRAIN`; movement from `GameArtifacts.MOVEMENT_COST`.
  Colors/labels/geometry come from `GameDisplayArtifacts` (client-only — the engine never reads it).
