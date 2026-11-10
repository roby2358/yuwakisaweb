# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Thing Factory** ("a thing that does a thing") is a place-then-tick contraption game on a
small hex board, forked from the Hex & Counters base (`../hexandcounter`). Each command
places a Thing from a random hand, turns a placed mover, or waits, and then the world ticks
once: every Thing does its one thing (most act on the piece standing on them; the Puller
reaches two hexes ahead). Crates come out of a source; deliver
`DELIVER_GOAL` of them to the target. There's no time limit and no defeat; the score is turns.

Design docs follow the ontology-spec format: **`ONTOLOGY.md`** is the implementation
reference (purpose/goals `G-n`, entities, invariants, rules as pseudocode, numbers,
commands/events); **`CRITERIA.md`** turns each rule into a row `R-n` that owns `test/R-n/`;
**`RATIONALE.md`** holds the why (`D-n`) and open questions (`Q-n`);
**`ARCHITECTURE_LOG.md`** is the dated history. `DYNAMICS.md` is why it's fun; `README.md`
is intent + UI. Cite stable IDs (`R-12`, `D-6`), never section numbers, and reconcile
ONTOLOGY + CRITERIA + RATIONALE + log in the same change as the code. This doc set has its
own ID namespace; the base's R-/D-numbers don't apply.

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

`index.html` + game modules + shared libs + `index.css`, as **plain `<script>` globals**
(no ES modules) so it runs from `file://` on a double-click. The State/Engine half runs
headless; `GameUI` is the only browser-coupled code.

| Module | Global | Role |
|---|---|---|
| `artifacts.js` | `GameArtifacts` | Rules data: `TERRAIN`, `THINGS` (the Thing templates: `push`, `pull`, `blocks`, `on`, `weight`), `MOVEMENT_COST`, and every tunable number. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only: `HEX_SIZE`, `COUNTER_SIZE`, `HOP_MS`, terrain colors/names, `THING_LOOK` (name, verb line, colors), port colors. |
| `piece.js` | `Piece` | A positioned token. Crates and gremlins are `Piece`s with engine-set `id` and `kind`. |
| `board.js` | `Board` | Query layer over the hex `Map` (passable = land). |
| `gamestate.js` | `GameState` | Serializable data: `source`, `target`, `pieces`, `things`, `hand`, `turn`, `delivered`, `lost`, `spawnTimer`, `nextId`, `gameWon`, `phase`. |
| `gameengine.js` | `GameEngine` | Generation + rules. Commands `place`/`rotate`/`wait` each run one `tick()` and return `{ ok, events, won? }`. One `step()` handles every movement (movers, springs, ice slides, gremlins). |
| `gameui.js` | `GameUI` | Canvas, HUD, the hand, input, and the tick animation, which is driven only by the events the engine returns. |

Libs: `hex.js` (axial math, `NEIGHBOR_DIRS` = facing order E, NE, NW, W, SW, SE; clockwise
is `(f+5)%6`), `rando.js` (seeded RNG), `colortheory.js` (gremlin colors), `sound.js`
(client-only cues; `Math.random`, never `Rando`).

### Input architecture (see `UI_CONTROLS.md`)

`UI_CONTROLS.md` is the layered controls spec for the hex-game family; `gameui.js` cites
its layers (`L1.2`, `L2.1`, `L5`). Dispatch order: `overlay` → `anim` (input waits for the
tick animation) → `picked` card → bare map click.

- **L1.2 pick-then-act:** picking a card (click or `1`–`3`) computes
  `engine.legalPlacements(kind)` once; clicking a hex is a lookup into that set. `R`/wheel
  turn the ghost's facing. With no card picked, clicking a Belt/Spring/Puller calls `rotate`.
- **L2.1 primary action:** Wait button / Space / Enter → `engine.wait()`.
- **L2.2:** Esc and right-click put the card back.
- **L5:** the intro and victory overlays consume the input that dismisses them.
- Every command goes through `commit()`, which snapshots piece positions, calls the engine,
  and animates from `res.events` (`move` paths, then `sink`/`deliver` fades; `spawn` appears
  at the end).

### Coordinate system

Axial `(q, r)`, pointy-top hexes, stored in a `Map<string, hex>` keyed by `"q,r"` via
`hexKey()`. The grid is laid out as a rectangle of `MAP_COLS × MAP_ROWS` with a per-row
`qOffset = -floor(row/2)`, so each hex also carries its `col`/`row`. Player/target placement
sorts by `col` for true left/right ends. Pan is a screen-space `(panX, panY)` offset applied
in `hexToScreen` / `screenToHex`.

### Hex object shape (as built in `gameengine.js`)

```javascript
{ q, r, col, row, elevation, isEdge, terrain }
```
`elevation` is generation-only. Forks add their own per-hex fields when a rule needs them.

## Game Model (see ONTOLOGY.md / DYNAMICS.md)

- **Map:** 16×10, edges water; terrain water / plains / mountain by elevation, ice carved
  from plains. Source on the left slice, target on the right, land path guaranteed
  (fallback `KNOWN_GOOD_SEED`).
- **Things:** Belt and Spring push the piece on their own hex; the Puller pulls the piece
  two hexes ahead back into the hex between; Wall blocks; Bridge makes water crossable. One Thing per hex, none on the target; movers may be built
  under a piece.
- **Tick:** Things in placement order (each piece moves at most once), unmoved gremlins
  wander, the source spawns every `SOURCE_INTERVAL` if clear.
- **Step:** blocked by off-map / mountain / Wall / piece; open water sinks; bare ice slides
  free; a crate on the target is delivered.
- **Tuning harness:** `node test/sim.js [games]` (greedy builder bot; lays belts and
  springs, discards pullers facing away from its path).

## Conventions

- Pure client-side — plain `<script>` globals (no ES modules), no Node/npm, no build step,
  no bundler. Most modules wrap their definition in an IIFE assigning one global to keep
  top-level names from colliding across scripts; the single-class value libs (`Hex`,
  `Piece`) declare the class at top level instead.
- Tests: `node test/run.js` (`-v` for every check). DOM-free: `test/helpers/load.js` boots
  the engine/state/board/piece stack in a vm (no canvas, no display artifacts). Each
  `CRITERIA.md` R-row owns `test/R-n/` (one rule per test); `flatGame()` in the helpers gives
  a controlled all-plains board for rule tests; `test/integration/smoke.js` plays random legal
  commands checking invariants; `test/integration/uiboot.js` boots the real UI on a stub DOM
  and plays a game to the victory card by simulated clicks; `test/coverage.js` fails if CRITERIA and the `R-n` dirs disagree.
- Every engine command returns `{ ok, ... }`; `ok:false` means illegal and nothing changed
  (`Rando` included). `ok:true` carries the tick's `events`.
- Color values are 0–1 floats except when converting to `#rrggbb` strings for canvas.
- Terrain types come from `GameArtifacts.TERRAIN`; movement from `GameArtifacts.MOVEMENT_COST`.
  Colors/labels/geometry come from `GameDisplayArtifacts` (client-only — the engine never reads it).
