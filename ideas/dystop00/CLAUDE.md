# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RADIO FREE SECTOR 9** is a sci-fi dystopian hex-and-counter game presented as a 1987
floppy-disk release, forked from the Hex & Counters base. You plant pirate transmitters
(rigs) to wake a sleeping city: woken tenement blocks wake their neighbors (the Wake, the
core dynamic), every awake block raises the Alert (more Sweepers), and your five named rigs
are finite (Sweepers smash them). Win by waking `WIN_FRAC` of all blocks at once.

Design docs follow the ontology-spec format: **`ONTOLOGY.md`** is the implementation
reference (purpose/goals `G-n`, entities, invariants, rules as pseudocode, numbers,
commands and events); **`CRITERIA.md`** turns each rule into a row `R-n` that owns
`test/R-n/`; **`RATIONALE.md`** holds the why (`D-n`) and open questions (`Q-n`);
**`ARCHITECTURE_LOG.md`** is the dated history. `DYNAMICS.md` is why it's fun; `README.md`
is intent + controls. Cite stable IDs (`R-12`, `D-5`), never section numbers, and reconcile
ONTOLOGY + CRITERIA + RATIONALE + log in the same change as the code. This game has its
own ID namespace; the base's IDs don't apply.

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
| `artifacts.js` | `GameArtifacts` | Static **rules-data** — `TERRAIN`, `MOVEMENT_COST`, `RIG_NAMES`, `SWEEPER_KINDS`, and every tunable number (Wake, Alert, generation). Server-side; no colors/pixels. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only **display attrs** — the EGA palette, `TERRAIN_COLORS`/`NAMES`, counter colors, tints, `HEX_SIZE`, `COUNTER_SIZE`, `HOP_MS`/`FLASH_MS`, canvas chrome mirroring `index.css`. Read only by `GameUI` and the pixel helpers in `hex.js`. |
| `piece.js` | `Piece`, `Rig`, `Sweeper` | **Positioned tokens.** `Rig` adds `id/name/status/airtime`; `Sweeper` adds `id/kind/mp/prefers/target`. Light records, no rules. |
| `board.js` | `Board` | **Query layer over the hex `Map`** — `moveCost`/`isPassable`/`passableHexes`/`neighbors`/`within`/`isBlock`/`blocks`/`hasPath`. Rebuilt with the map. |
| `gamestate.js` | `GameState` | Authoritative, **serializable data only** — `seed`, `hexes` (with per-hex `awake`), `player`, `stations`, `rigs`, `sweepers`, `nextSweeperId`, `turn`, `mp`, `phase`, `outcome`. |
| `gameengine.js` | `GameEngine` | **Rules + generation.** Commands `newGame`/`movePlayer`/`plant`/`retrieve`/`endTurn` mutate state and return `{ ok, events, outcome }`. Turn: player → `broadcast` (the Wake) → `regime` (Sweeper walks, sedation, recall/spawn). |
| `gameui.js` | `GameUI` | The **client**: boot/title/end overlays, canvas rendering, animated regime playback from events, DOM HUD/roster/log, camera, and all input wiring. |

Shared libraries the game modules depend on:

| Module | Used for |
|---|---|
| `hex.js` | Axial hex math, `bfsHexes` (MP-bounded reachability), `dijkstraHexes` + `pathFromPrev` (full-map shortest paths for Sweepers), `drawHexPath`. Pixel helpers read `GameDisplayArtifacts.HEX_SIZE`. |
| `rando.js` | `Rando` RNG helpers, **seedable** via `Rando.seed(n)` (mulberry32) so a game is reproducible from `state.seed` |
| `sound.js` | `GameSound` — client-only PC-speaker cues (pulse wave) plus floppy-drive clicks. Uses `Math.random`, never `Rando`. |

Server-readiness: all randomness routes through the seeded `Rando`; every command
re-derives its own legality. Still deferred — a serialized command layer and `GameState`
(de)serialization; `GameUI` calls engine methods directly and animates the returned events.

### Input architecture (see `UI_CONTROLS.md`)

`UI_CONTROLS.md` is the **controls specification** for a family of hex-and-counter games,
organized in layers (core first, increasingly optional). **This game is the reference
implementation of its core (Layers 1–2)**; `gameui.js` carries the wiring and inert
extension points for the optional layers. Comments in `gameui.js` cite the layer they
implement (e.g. `L1.2`, `L2.1`, `L4`). The rule-side hooks they route to
(`computeAttackable`, `locationAt`) live on `GameEngine`.

- A stack of modal flags decides what any click/key means: `overlay` → `anim` (regime
  playback locks input) → `targeting` → `selection`, with `phase` gating the whole thing. Handlers check them in that priority order.
- `phase` gates map input to the player's turn (L1.1). `selection = { reachable, attackable }`
  is computed once at select time; the click handler is a **pure lookup** against those sets
  (L1.2). Movement auto-ends the turn at 0 MP (L1.4). Pan is a render-only offset; hover is
  tracked separately (L1.3). `primaryAction()` is the one context-sensitive action behind
  End-Turn / Space / Enter (L2.1). Esc peels back one modal layer, deepest first (L2.2).
  Overlays capture and consume their dismissing input (L5).
- **Extension points that are intentionally inert** in this game (the optional
  layers): `computeAttackable()` returns empty — no combat (L3); the `targeting` modal state —
  no aimed abilities (L4); `locationAt()` returns null — no interactive locations (L2.1).
  When adding combat/skills/locations, fill these in — the dispatch already routes to them.

### Coordinate system

Axial `(q, r)`, pointy-top hexes, stored in a `Map<string, hex>` keyed by `"q,r"` via
`hexKey()`. The grid is laid out as a rectangle of `MAP_COLS × MAP_ROWS` with a per-row
`qOffset = -floor(row/2)`, so each hex also carries its `col`/`row`. @/station placement
sorts by `col` for true left/right ends. Pan is a screen-space `(panX, panY)` offset applied
in `hexToScreen` / `screenToHex`.

### Hex object shape (as built in `gameengine.js`)

```javascript
{ q, r, col, row, elevation, density, isEdge, terrain, awake }
```
`elevation` and `density` are generation-only. `awake` is only ever true on a `BLOCK`.

## Game Model (see DYNAMICS.md, ONTOLOGY.md)

- **City**: 48×32; canal and arcology by elevation band, tenement `BLOCK`s at the densest
  (jittered) open hexes, the rest factory/ruins/plaza. @ starts far left; the Ministry and
  precincts (Sweeper spawns) sit on the right.
- **The Wake**: at each broadcast a sleeping block wakes if an unjammed rig's range covers
  it or ≥ `WAKE_THRESHOLD` neighbors are awake; an awake block outside every live rig's
  range with < `FADE_THRESHOLD` awake neighbors falls asleep (`planBroadcast` decides both).
  A rig's range is `TX_RANGE` + 1 per unjammed broadcast, capped at `TX_RANGE_MAX`; plant and
  retrieve reset it. Nothing within `JAM_RADIUS` of a Sweeper wakes; the block under a
  Sweeper sleeps.
- **The Alert**: quota `BASE_SWEEPERS + floor(awake / AWAKE_PER_SWEEPER)`; spawn/recall one
  a turn. Wardens hunt the frontier, Hounds/Hunters hunt rigs, anyone hunts a seen @.
- **Rigs**: five, planted/retrieved for `PLANT_MP`; smashed forever.
- **End**: won at `WIN_FRAC` awake; captured if a Sweeper walks into @; dead air if every
  rig is smashed.

## Conventions

- Pure client-side — plain `<script>` globals (no ES modules), no Node/npm, no build step,
  no bundler. Most modules wrap their definition in an IIFE assigning one global to keep
  top-level names from colliding across scripts; the single-class value libs (`Hex`,
  `Piece`) declare the class at top level instead.
- Tests: `node test/run.js` (`-v` for every check). DOM-free: `test/helpers/load.js` boots
  the engine stack in a vm (no canvas, no display artifacts); `test/helpers/fixtures.js`
  stages boards. Each `CRITERIA.md` R-row owns `test/R-n/` (one rule per test);
  `test/integration/smoke.js` is an engine walkthrough and `test/integration/ui_boot.js`
  boots the real UI under a DOM/canvas stub (runtime errors only, not looks); `test/coverage.js` keeps CRITERIA and the
  dirs in step.
- Tuning: `node test/sim.js [N] [--maps] [--pull-early] [--set NAME=v,…] [-t --seed S]` — the committed
  harness (greedy bot + cascade study). Measure before claiming a balance change; record
  evidence in RATIONALE.
- Every engine command returns `{ ok, ... }`; `ok:false` means illegal and nothing changed.
- Color values are 0–1 floats except when converting to `#rrggbb` strings for canvas.
- Terrain types come from `GameArtifacts.TERRAIN`; movement from `GameArtifacts.MOVEMENT_COST`.
  Colors/labels/geometry come from `GameDisplayArtifacts` (client-only — the engine never reads it).
