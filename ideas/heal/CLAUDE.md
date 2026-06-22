# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Healer** is a browser hex-and-counter tactics game, built on a minimal "Hex & Counters"
baseline. You play the **medic of an AI-driven party you cannot command**: the heroes march
toward the treasure and back home on their own, picking their own fights; your job is to keep
them alive with positioning and healing/warding skills, earning reputation for the run.

Authoritative docs:
- `README.md` — intent + UI
- `DYNAMICS.md` — the design journal (*why* each mechanic is fun; the load-bearing reference)
- `TRAINING.md` — recommendation for learned AI (a 12×12 arena testbed; not yet built)
- `UI_CONTROLS.md` — the layered controls spec for this family of games

The codebase began as an extraction from the [Realm](../realm/) project; Realm artifacts
(danger points, resources, installations) have largely been stripped out.

## Running / Developing

No build, install, or server step. Scripts are plain `<script>` includes (not ES modules),
so `index.html` runs by double-clicking it (over `file://`). A static server still works if
you prefer one:
```bash
npx serve .
# or
python -m http.server 8000
```

> **No ES modules — double-click to run.** To keep `index.html` runnable over `file://`
> (browsers block ES module `import` there via CORS), every `.js` file is a classic script
> that exposes globals, wired up by ordered `<script>` tags in `index.html`. Load order:
> `config → rando → colortheory → hex → content → mechanics → gamestate → ai/movement →
> ai/partyai → ai/enemyai → gameengine → index`. When adding a file, add a `<script>` tag in
> dependency order; do **not** reintroduce `import`/`export` or `type="module"`.

## Architecture

### The three layers

The game is split so the rules can run without a browser (a prerequisite for the learned-AI
plan in `TRAINING.md`, and what makes the turn loop testable headless):

- **`gamestate.js` — `GameState`**: all the *data* and pure read-only queries over it. The
  board (`hexes`), units (`healer`, `party`, `enemies`), landmarks, `turn`, `reputation`,
  color schemes, and `outcome`. It holds **no UI state** (no pan/selection/overlay/animation)
  and never mutates itself as a side effect of play. Query helpers live here: `hexAt`,
  `moveCost`/`isPassable`, `passableHexes`, `boardUnits`, `renderOrder`, `unitAt`, `allies`,
  `nearest`, `currentTier`, `snapshot`. `toJSON`/`fromJSON` round-trip a whole game as one
  value (for save/restore in browser memory). No back-compat shims — playtest saves aren't
  durable, so `fromJSON` assumes the current shape.

- **`gameengine.js` — `GameEngine`**: the *rules*. It owns a `GameState` (`this.state`) and is
  the **only thing that mutates it**. Map generation (it inlines its own diamond-square
  heightmap + terrain assignment), unit factories, warband spawning, the player's actions
  (`computeReachable`, `moveHealer`, `castSkill`, `skillUsable`, `beginPlayerTurn`), and the AI
  turn (`resolveTurn`). It **draws nothing and sleeps for nothing**, and reports win/loss by
  setting `state.outcome` (+ `outcomeMessage`) rather than popping an overlay.

- **`index.js` — the UI**: canvas rendering, input, the input-modal stack, and the animated
  turn playback. It holds **one** `GameEngine`, calls its methods in response to input, and
  reconstructs the animated turn from the frames `resolveTurn()` returns. This is the only file
  that touches the DOM/canvas.

### Turn resolution returns event frames

`resolveTurn()` runs party phase → enemy phase → resolution tick → start-of-next-turn
**synchronously** and returns an ordered list of **frames** — one per unit action, each a plain
`{ snapshot, flash }` where `snapshot` is a renderable picture of the board (via
`GameState.snapshot()` / `cloneRenderable`) and `flash` is an optional `{ q, r }` hit marker.
Because the engine has already advanced the state to its final position, each frame carries its
own snapshot so the UI can **replay** the turn step by step (`render()` + `await sleep(110)`).
Resolution stops early the moment `state.outcome` is set.

### Supporting modules

| Module | Used for |
|---|---|
| `config.js` | constants: `HEX_SIZE`, `TERRAIN`, `MOVEMENT_COST`, `PLAYER_MP`, `PARTY_MP`, `MAP_COLS/ROWS`, aggro/danger/reputation tuning |
| `hex.js` | axial hex math + `bfsHexes` (Dijkstra reachability), `findPath` (A*), `Hex.key`/`Hex.fromKey`, `drawHexPath` |
| `rando.js` | `Rando` static RNG helpers (`shuffle`, `choice`, `int`, `bool`, `weighted`, …) |
| `colortheory.js` | `ColorTheory.randomScheme` / `rgbToHex` for per-unit counter colors |
| `content.js` | data tables: `PARTY_CLASSES`, `ENEMY_CLASSES`, `SKILLS`, `STATUS_COLORS` |
| `mechanics.js` | rules primitives — status effects, damage, skill application, attacks — via dispatch tables keyed on a discriminator (skill template / damage type / striker kind). **Pure**: every function takes explicit args, references no mutable globals. |
| `ai/movement.js` | `Movement.walkToward` — plan with full A* to a goal, then walk it within a budget. Operates on a `ctx` bag of closures (`{ terrainPassable, moveCost, planCost, occupied, zoc }`); `planCost` shapes the route, `moveCost` is spent from the budget. |
| `ai/partyai.js` | `PartyAI` — friendly policy (`goal`/`budget`); takes the live `state` explicitly |
| `ai/enemyai.js` | `EnemyAI` — hostile policy (`target`/`budget`); takes the live `state` explicitly |

`mechanics.js` and `ai/movement.js` are fully decoupled (no globals) and are reused as-is by
the engine. `PartyAI`/`EnemyAI` read game data through the `state` they're handed
(`state.party`, `state.hexAt`, `state.nearest`, …) — never module globals.

The live game draws flat-color hexes via `drawHexPath` + `TERRAIN_COLORS`; there is no
sprite/image pipeline.

### Input architecture (see `UI_CONTROLS.md`)

`UI_CONTROLS.md` is the **controls specification** for a family of hex-and-counter games,
organized in layers (core first, increasingly optional). Comments in `index.js` cite the layer
they implement (e.g. `L1.2`, `L4`, `L5`).

- A stack of modal flags decides what any click/key means: `overlay` → `targeting` →
  `selection`, gated by `resolving` (true while a turn animates) and by `overlay`. Handlers
  check them in that priority order.
- Input is live only when not `resolving` and no `overlay` is up (L1.1).
- `selection = { reachable }` (a `Map<key, cost>` from `engine.computeReachable()`) is computed
  at select time; the click handler is a **pure lookup** against it (L1.2). Moving re-selects
  while MP remains and deselects at 0 — it does **not** end the turn (the player may still want
  to cast). Pan is a render-only offset; hover is tracked separately (L1.3).
- `targeting = { skill, validKeys }` is the **active** aimed-skill modal (L4): pick a skill,
  then click a valid ally to cast via `engine.castSkill`.
- `primaryAction()` (End-Turn button / Space / Enter) ends the turn, kicking off frame playback
  (L2.1). Esc peels back one modal layer, deepest first (L2.2). Overlays capture and consume
  their dismissing input (L5).

### Coordinate system

Axial `(q, r)`, pointy-top hexes, stored in a `Map<string, hex>` keyed by `"q,r"` via
`Hex.key()`. The grid is laid out as a rectangle of `MAP_COLS × MAP_ROWS` with a per-row
`qOffset = -floor(row/2)`, so each hex also carries its `col`/`row`. Home/treasure placement
uses `col` to pull the landmarks to a fixed margin in from the left/right water edge. Pan is a
screen-space `(panX, panY)` offset applied in `hexToScreen` / `screenToHex`.

### Hex object shape (as built in `GameEngine.generateRectGrid`)

```javascript
{ q, r, col, row, elevation, isEdge, terrain }
```

## Game Model (see DYNAMICS.md)

- **Map**: 60×40 hex grid; terrain assigned by elevation percentile (water/plains/hills/
  mountain) then forests/gold/quarries scattered in; edges forced to water. `newGame`
  regenerates (up to 20 tries) until a path exists from home to treasure (`hasPath`). Home sits
  near the left edge, treasure near the right (a journey out and back).
- **Healer (the player)**: `PLAYER_MP` (5) movement points/turn, `HEALER_MAX_AETHER` (12)
  Aether regenerating `AETHER_REGEN` (3)/turn to pay for skills. Reachability comes from
  `bfsHexes` treating other units and enemy zone-of-control as walls. The healer has no attack;
  it dies if reduced to 0 HP → **defeat**.
- **Party**: AI heroes (`PARTY_CLASSES`) the player can't command (`PartyAI`). The toughest
  living member is the **leader** and paths toward the objective on a leash from the healer
  (`LEADER_LEASH`); others form up around it, and any member diverts to fight a threat within
  `PARTY_ENGAGE_RANGE` (ranged units kite behind the toughest ally). Downed members can be
  revived within `REVIVE_WINDOW` turns before going permanently `gone`.
- **Enemies**: spawned in **warbands** (`ENEMY_MIN`–`ENEMY_MAX` total, clustered `GROUP_MIN`–
  `GROUP_MAX` per center) far from home. A warband is dormant until a hero comes within
  `AGGRO_RANGE` (8), then commits and pursues (`EnemyAI`). A flat **danger heat map** (each
  living enemy stamps its strength over an `AGGRO_RANGE` disk) biases the leader's pathing to
  skirt warbands without slowing it (`DANGER_WEIGHT`). `REINFORCE_CHANCE` per-turn pressure
  spawns reinforcements near the objective, scaling tier with reputation.
- **Combat**: melee/ranged via `mechanics.js`; armor is flat per-hit reduction, wards absorb,
  poison bypasses both. Breaking out of a hostile's zone of control provokes a free
  disengagement strike (`ZOC_PENALTY` also makes ZOC hexes costly to enter).
- **Reputation / skills**: kills, collecting the treasure, and returning home grant reputation;
  crossing `TIER2_REP`/`TIER3_REP` unlocks higher-tier skills.
- **Win**: a party member returns **home** carrying the treasure. **Defeat**: the healer falls,
  or the whole party perishes.

### Interaction

Click the healer (H) to select → reachable hexes highlight yellow → click a highlighted hex to
move. Click a skill in the left panel, then a valid (green-outlined) ally to cast it. Click H
again or a non-highlighted hex to deselect; Esc peels back targeting/selection. Right-drag
pans. The **Danger** button (nav bar) toggles the heat-map overlay. Space/Enter or **End Turn**
resolves the party + enemy turns (animated). New Game regenerates everything.

## Conventions

- Pure client-side JS loaded via ordered `<script>` tags (no ES modules, so `index.html`
  runs from `file://`) — no Node/npm, no build step, no bundler.
- **No unit tests.** This is a playtest-driven prototype; iteration speed wins over
  coverage. Verify changes by running the game in a browser (and, for pure logic, the engine
  can be exercised headless by bundling everything except `index.js`) — not by writing tests,
  even though general coding guidance insists on them. This project intentionally opts out.
- **Keep rules out of the UI.** New game logic belongs on `GameEngine` (mutations) or
  `GameState` (data + pure queries), surfaced to `index.js` through method calls and the frame
  snapshots — `index.js` should stay a thin view/input layer.
- Color values are 0–1 floats except when converting to `#rrggbb` strings for canvas.
- Terrain types come from the `TERRAIN` constant in `config.js`; movement from `MOVEMENT_COST`.
- Behavior that varies by kind is routed through **one** dispatch table keyed on the
  discriminator (see `mechanics.js`), never scattered `if kind == …` conditionals.
