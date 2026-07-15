# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hex & Counters** is a minimal browser hex-and-counter game intended as a clean baseline
for future board-wargame-style games. The current build is a **living world with no
victory condition and no game over**: villages grow farmland, prosperity draws raiders
from the wilds, and the player earns prestige defending what grows. Prestige decays and
drives a status ladder whose ranks grant privileges. The game is geared toward long-term
improvement, not winning.

Authoritative gameplay docs live in `README.md` (intent + UI) and `DYNAMICS.md` (rules).
The codebase began as an extraction from the [Realm](../realm/) project, and `README.md`
notes the ongoing goal of stripping out Realm artifacts (danger points, resources,
installations) so they don't leak into new games.

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

The game is **`index.html` + four game modules + shared libs + `index.css`**. It loads as
**plain `<script>` globals** (no ES modules) so the page runs from `file://` on a
double-click; `index.html` lists the scripts in dependency order and `index.js` is a thin
bootstrap that wires them together. The code is factored for an eventual client/server
split — the seam is drawn so State + Engine could run server-side unchanged:

| Module | Global | Role |
|---|---|---|
| `artifacts.js` | `GameArtifacts` | Static **rules-data** — `TERRAIN`, `MOVEMENT_COST`, `PLAYER_MP/HP`, `MAP_COLS/ROWS`, the village/raider/prestige tuning constants, and the `PRIVILEGES` table (one cumulative row per status rank — the single dispatch point for rank-dependent rules). Server-side; no colors/pixels. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only **display attrs** — `HEX_SIZE`, `COUNTER_SIZE`, `TERRAIN_COLORS`, `TERRAIN_NAMES`, `PLAYER_COLOR`, `STATUS_TITLES`, animation pacing. Keyed off `GameArtifacts.TERRAIN`; read only by `GameUI` and the pixel helpers in `hex.js`. |
| `gamestate.js` | `GameState` | Authoritative, **serializable data only** — `seed`, `hexes`, `player {q,r,hp}`, `villages [{q,r,hp,name,farms}]`, `enemies` (raiders, with per-raider `id/speed/burned/sated/color/home`), `nextEnemyId`, `prestige`, `status`, `turn`, `mp`, `phase`. No behavior, no DOM, no view/interaction state. |
| `gameengine.js` | `GameEngine` | **Rules + generation** over a `GameState`. DOM-free and render-free: methods mutate state and *return outcomes*. Owns `newGame`/`placeVillages`, `computeReachable`/`computeAttackable`, `movePlayer`/`attack`, and `endTurn` — which resolves the raider phase + world phase (growth, spawns, decay, ladder) and **returns an ordered event list** the client replays. |
| `gameui.js` | `GameUI` | The **client**: canvas rendering, DOM HUD + message bar, camera/pan, hover, selection/targeting/overlay modal state, all input wiring, and **enemy-phase playback** (`playEvents` animates the engine's event list hop by hop; any input fast-forwards). |

Shared libraries the game modules depend on:

| Module | Used for |
|---|---|
| `hex.js` | Axial hex math + `bfsHexes` (Dijkstra reachability), `Hex.key`, `drawHexPath`. Pixel helpers read `GameDisplayArtifacts.HEX_SIZE`; the axial math the engine uses needs neither artifacts file. |
| `rando.js` | `Rando` RNG helpers, **seedable** via `Rando.seed(n)` (mulberry32) so a game is reproducible from `state.seed` |
| `colortheory.js` | `ColorTheory.randomScheme` / `rgbToHex` for per-raider counter colors (assigned at spawn, stored on the raider) |

Server-readiness notes baked into the split: all randomness routes through the seeded
`Rando` (map, spawns, and AI reproduce from `state.seed`); `GameEngine.movePlayer` and
`attack` re-derive legality from the engine's own `computeReachable`/`computeAttackable`
rather than trusting a caller-supplied cost (the "never trust the client" rule); `endTurn`
returns an event list that a server would broadcast and the UI already treats as its only
animation source. Still deferred — a serialized command/protocol layer between UI and
engine, and `GameState` (de)serialization; today `GameUI` calls engine methods directly.

The live game draws flat-color hexes via `drawHexPath` + `TERRAIN_COLORS`; there is no
sprite/image pipeline. (Earlier `terrain.js` and `renderer.js` modules were Realm leftovers,
unwired and broken, and have been removed.)

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
- **L3 combat is live**: `computeAttackable()` returns adjacent raider hexes (when MP
  covers the attack cost) and the click handler routes red-highlighted hexes to
  `engine.attack`. **Still intentionally inert** (optional layers): the `targeting` modal
  state — no aimed abilities (L4); `locationAt()` returns null — no interactive locations
  (L2.1). When adding skills/locations, fill these in — the dispatch already routes to them.
- The **enemy-phase playback** is view state (`this.anim`), never game state: the engine
  resolves the whole turn synchronously and the UI replays the returned events against a
  display-only raider list. Input is gated on `this.anim` during playback; any click/key
  fast-forwards to the (already final) state.

### Coordinate system

Axial `(q, r)`, pointy-top hexes, stored in a `Map<string, hex>` keyed by `"q,r"` via
`hexKey()`. The grid is laid out as a rectangle of `MAP_COLS × MAP_ROWS` with a per-row
`qOffset = -floor(row/2)`, so each hex also carries its `col`/`row`. Pan is a screen-space
`(panX, panY)` offset applied in `hexToScreen` / `screenToHex`.

### Hex object shape (as built in `gameengine.js`)

```javascript
{ q, r, col, row, elevation, isEdge, terrain, resource, units: [], controlled }
```
`resource`, `units`, and `controlled` are currently inert placeholders.

## Game Model (see DYNAMICS.md)

- **Map**: 60×40 hex grid; terrain assigned by elevation percentile (water/plains/hills/
  mountain) then forests/gold/quarries scattered in; edges forced to water.
  `GameEngine.newGame` regenerates (up to 20 tries) until 3–5 villages place on plains of
  one connected region, `VILLAGE_MIN_DIST` apart, after seeding `Rando` so the whole map
  reproduces from `state.seed`. The player starts on the first village.
- **Villages**: each has 3 HP, a generated name, and a farm cluster; 20%/turn chance to
  grow one farm hex adjacent to the cluster. A village with ≥1 farm regains 1 HP/turn.
  At 0 HP it falls (hex reverts to plains) and a new village founds itself elsewhere.
- **Raiders**: spawn chance per turn = totalFarms × 1%, in the wilds (> 8 hexes from every
  village); speed rolled at spawn (1d6 → 1/1/1/2/2/3 hexes per turn); path via full A*
  toward the nearest farm — or the hex of a farm-less village, which they strike from
  adjacent (never entering) for 1 damage, plundering (instantly sated). Burning 3 farms
  also sates a raider; sated raiders walk home and despawn there. The player's hex is
  pathable but never entered, so the player can physically block a road.
- **Combat**: attacking an adjacent raider costs 2 MP (1 MP at rank 3+) and kills it.
  Raiders adjacent to the player at the end of their phase each deal 1 damage; at 0 HP
  the player is carried to the nearest raider-free village, HP restored, prestige halved.
- **Prestige/status**: kills earn prestige (+1, +2 near farms/villages, +2 vs sated);
  decay each turn is `floor(prestige/10)`. End of turn: `prestige > 3×status` promotes,
  `prestige < status` demotes (one step per turn, ranks 0–5). Each rank's privileges are
  one row in `GameArtifacts.PRIVILEGES`.
- **No win, no game over** — see DYNAMICS.md for why (theme, drivers, strategies).

### Interaction

Click P to select → reachable hexes highlight yellow, attackable raiders red → click
yellow to move, red to attack. Click P again or a non-highlighted hex to deselect.
Right-drag pans. Space/Enter ends the turn; movement auto-ends the turn when MP hits 0.
The enemy phase then plays back animated (click/Space fast-forwards). The message bar
narrates events; hovering a village shows name/farms/HP.

## Conventions

- Pure client-side — plain `<script>` globals (no ES modules), no Node/npm, no build step,
  no bundler, no tests. Each module wraps its definition in an IIFE assigning one global to
  keep top-level names from colliding across scripts.
- Color values are 0–1 floats except when converting to `#rrggbb` strings for canvas.
- Terrain types come from `GameArtifacts.TERRAIN`; movement from `GameArtifacts.MOVEMENT_COST`.
  Colors/labels/geometry come from `GameDisplayArtifacts` (client-only — the engine never reads it).
