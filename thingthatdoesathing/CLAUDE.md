# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Thing Factory** ("a thing that does a thing") is a place-then-tick contraption game on a
small hex board, forked from the Hex & Counters base (`../ideas/hexandcounter`). Each command
places, removes or discards a Thing from a random hand, or waits, and then the world ticks
once (turning a placed mover is free and doesn't tick): every Thing does its one thing (most act on the piece standing on them; the Pusher
shoves the hex in front, the Puller reaches two hexes ahead). Crates come out of a source; deliver
them to the target, through endless milestones (10, 20, 50, 100, 200, 500, 1000, …). On
bigger boards each milestone opens a new crate color with its own target (`MAP_SIZES.colors`). There's
no end, time limit or defeat; the score is the turn each milestone was reached.

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
| `artifacts.js` | `GameArtifacts` | Rules data: `MAP_SIZES`, `TERRAIN`, `THINGS` (the Thing templates: `push`, `pull`, `shove`, `splat`, `flies`, `skids`, `blocks`, `traps`, `colored`, `on`, `weight`), `WHITE`, `PIECES` (the piece templates: `label`, `cargo`, `wanders`, `splats`, `reemerges`), `aims(kind)`, `MOVEMENT_COST`, and every tunable number. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only: `HEX_SIZE`, `COUNTER_SIZE`, `HOP_MS`, terrain colors/names, `THING_LOOK` (name, verb line, colors, inset), `PIECE_LOOK` (hover name), `CRATE_SHADES`, `MAP_SIZE_NOTES` (size-picker notes), port colors. |
| `piece.js` | `Piece` | A positioned token. Crates and gremlins are `Piece`s with engine-set `id` and `kind`. |
| `board.js` | `Board` | Query layer over the hex `Map` (passable = land). |
| `gamestate.js` | `GameState` | Serializable data: `sources` (`{q, r, colors}`), `targets` (`{q, r, color, delivered}`), `pieces`, `things` (`{kind, color, q, r, facing}`), `hand` (`{kind, color}` cards), `turn`, `delivered`, `lost`, `exGremlins`, `trapped`, `idleTicks`, `spawnTimer`, `nextId`, `phase`, `size`. |
| `gameengine.js` | `GameEngine` | Generation + rules. `newGame(seed, size)` takes the seed from the caller (the UI rolls it) and a `MAP_SIZES` key (the player picks it). Commands `place`/`remove`/`blast`/`discard`/`wait` each run one `tick()` and return `{ ok, events }`; `rotate` doesn't tick (`events: []`, D-19); a tick that reaches a milestone emits `milestone{count}`, then `open{color, source, target}` if it opened a color. One `step()` handles every movement (movers, springs, rockets, ice slides, gremlins); a Rocket's flight emits `splat` for gremlins it destroys. |
| `gameui.js` | `GameUI` | Canvas, HUD (top left), tally (top right: delivered, ex-gremlins, trapped, lost), the hand, input, and the tick animation, which is driven only by the events the engine returns. |

Libs: `hex.js` (axial math, `NEIGHBOR_DIRS` = facing order E, NE, NW, W, SW, SE;
`Hex.clockwise` is `(f+5)%6`, plus `Hex.counterClockwise`, `Hex.opposite`, `Hex.same`), `rando.js` (seeded RNG), `colortheory.js` (gremlin colors), `sound.js`
(client-only cues; `Math.random`, never `Rando`).

### Input architecture (see `UI_CONTROLS.md`)

`UI_CONTROLS.md` is the layered controls spec for the hex-game family; `gameui.js` cites
its layers (`L1.2`, `L2.1`, `L5`). Dispatch order: `overlay` → `anim` (input waits for the
tick animation) → `picked` card → bare map click.

- **L1.2 pick-then-act:** picking a card (click or `1`–`3`) computes
  `engine.legalPlacements(kind)` once; clicking a hex is a lookup into that set. `R`/wheel
  turn the ghost's facing. With no card picked, a click selects a hex (`selected`: outline, white facing arrow over a mover, holds Go); a click on the selected hex calls `rotate`, which doesn't tick, so the UI just re-renders; a click elsewhere or Esc deselects. Selecting and turning work mid-animation.
  `D` calls `remove` on the hovered Thing; `B` calls `blast` on the hovered crate. With a card picked, the Discard spot or `X` calls `discard`.
- **L2.1 primary action:** Wait button → `engine.wait()`. Enter toggles Go (`toggleRun()`), like the Go button. Space is `oneTick()`: a Wait when Go is off; when Go runs it turns Go off, and the tick in flight finishes.
- **L2.2:** Esc and right-click put the card back.
- **L5:** the intro and New Game overlays are both board-size pickers (click or `1`–`4`); they
  consume all other input, and Esc closes New Game only. A milestone that opens a color shows
  the `color` overlay, which closes on a click or any key (`OVERLAY_KEYS` dispatches keys per
  overlay). The `help` overlay is the keys legend: shown once after the intro's size pick, and by
  the Help button; it closes on a click or any key and holds Go while open. The milestone
  banner is not an overlay; it never blocks input.
- **Go/Pause** (`running`): after each animation, `wait()` again `RUN_GAP_MS` later; holds
  while a card is picked or a hex is selected (both work mid-animation).
- Every command goes through `commit()`, which snapshots piece positions, calls the engine,
  and animates from `res.events` (`move` paths, then `sink`/`deliver` fades; `spawn` appears
  at the end).

### Coordinate system

Axial `(q, r)`, pointy-top hexes, stored in a `Map<string, hex>` keyed by `"q,r"` via
`hexKey()`. The grid is laid out as a rectangle of `cols × rows` (a `MAP_SIZES` row) with a per-row
`qOffset = -floor(row/2)`, so each hex also carries its `col`/`row`. Player/target placement
sorts by `col` for true left/right ends. Pan is a screen-space `(panX, panY)` offset applied
in `hexToScreen` / `screenToHex`.

### Hex object shape (as built in `gameengine.js`)

```javascript
{ q, r, col, row, elevation, isEdge, terrain }
```
`elevation` is generation-only. Forks add their own per-hex fields when a rule needs them.

## Game Model (see ONTOLOGY.md / DYNAMICS.md)

- **Map:** 16×10, 20×20, 30×30 or 60×60 (`MAP_SIZES`, picked at New Game), edges water; terrain water / plains / mountain by elevation, ice carved
  from plains. Sources on the left slice, targets on the right, land path guaranteed
  (fallback: the size's `knownGoodSeed`).
- **Things:** Belt pushes the piece on its own hex; the Spring and Rocket throw it 3 and 8 hexes (airborne: over inland water; a Spring skids on if it lands on ice), the Rocket splatting gremlins; a Trap kills a gremlin that comes onto it; the Pusher pushes the piece on the hex in front on; the Puller pulls the piece
  two hexes ahead back into the hex between (both always come in a crate color and move only that color's crates, and gremlins; they're rare draws); a gremlin coming onto a target dies; Wall blocks; Bridge is a Belt built on water (it carries the piece on it 1 hex). One Thing per hex, none on a target; movers may be built
  under a piece.
- **Tick:** Pushers and Pullers first, then the other Things, each in placement order (each piece moves at most once), unmoved gremlins
  wander, every `SOURCE_INTERVAL` a random open color spawns at its source if clear; each milestone may open a color (`openColor`).
- **Step:** blocked by off-map / mountain / Wall / piece; a gremlin on a Trap dies; open water sinks; bare ice slides
  free; a crate on its color's target is delivered (other colors' targets block it on the ground).
- **Tuning harness:** `just cc-sim 200 small`, which runs `node test/sim.js 200 small` (greedy builder bot; lays belts and
  springs, throws every other card away with `discard`).

## Conventions

- Pure client-side — plain `<script>` globals (no ES modules), no Node/npm, no build step,
  no bundler. Most modules wrap their definition in an IIFE assigning one global to keep
  top-level names from colliding across scripts; the single-class value libs (`Hex`,
  `Piece`) declare the class at top level instead.
- Tests: `just cc-test`, which runs `node test/run.js` (`-v` for every check). The recipes are
  described in the project-local `thingfactory-tools` skill. DOM-free: `test/helpers/load.js` boots
  the engine/state/board/piece stack in a vm (no canvas, no display artifacts). Each
  `CRITERIA.md` R-row owns `test/R-n/` (one rule per test); `flatGame()` in the helpers gives
  a controlled all-plains board for rule tests; `test/integration/smoke.js` plays random legal
  commands checking invariants; `test/integration/uiboot.js` boots the real UI on a stub DOM
  and plays to the first milestone by simulated clicks, then drives Go/Pause; `test/coverage.js` fails if CRITERIA and the `R-n` dirs disagree.
- Every engine command returns `{ ok, ... }`; `ok:false` means illegal and nothing changed
  (`Rando` included). `ok:true` carries the tick's `events`.
- Color values are 0–1 floats except when converting to `#rrggbb` strings for canvas.
- Terrain types come from `GameArtifacts.TERRAIN`; movement from `GameArtifacts.MOVEMENT_COST`.
  Colors/labels/geometry come from `GameDisplayArtifacts` (client-only — the engine never reads it).
