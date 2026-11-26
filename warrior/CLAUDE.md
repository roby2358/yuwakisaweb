# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Warrior is a single-player tactical hex RPG. Canvas rendering, plain `<script>` includes (shared globals, not ES modules), no build step or external dependencies. See `SPEC.md` and `DYNAMICS.md` for game design and mechanics.

## Running / Developing

No build or install step, and no server: double-click `index.html` (it must run from `file://`).

Checks (Node, DOM-free): `node test/scripts.js` (the script includes load as one shared scope, no duplicate top-level names), `node test/fx.js` and `node test/skilllibrary.js` (skill-group dealing).

### Plain scripts, not modules

Every file is a classic script listed in `index.html` in dependency order; a top-level `const`/`class`/`function` in one file is a global in the rest. So there is no `import`/`export`, top-level names must be unique across files, and a new file needs a `<script>` tag in the right place. `origitems.js`, `terrain.js` and `renderer.js` are not loaded.

## Architecture

### Module Dependency Graph
```
index.js (orchestrator: rendering, input, UI, save/load, combat math, dialogs)
  ├─ config.js       (constants, terrain, enemy/equipment/skill/POI defs; uses rando)
  ├─ hex.js          (axial hex math, BFS/Dijkstra, A*, draw helpers; uses HEX_SIZE)
  ├─ rando.js        (Rando: shuffle, choice, int, bellCurve, weighted, bool)
  ├─ player.js       (Player class: stats, equipment, skills, inventory, toJSON/fromJSON)
  ├─ world.js        (GameWorld class: hex grid, POIs, fog, LOS; toJSON/fromJSON)
  ├─ skilllibrary.js (SkillLibrary class: per-run skill groups (core / fixed / optional, half of optional held out) and discovery channels so no skill is awarded twice; each Wise Man's hut gives one core lesson (`firstUnlearnedCore`), then teaches optional skills; checked by `node test/skilllibrary.js`)
  ├─ enemies.js      (EnemyManager class: enemy list, spawn, defs; uses colortheory)
  ├─ actions.js      (player Action classes + MP/aether cost helpers; see below)
  ├─ enemy_ai.js     (enemy AI classes, maw-distance math, runEnemyAiPhase; see below)
  ├─ victory.js      (Victory class: score tracking and final breakdown)
  ├─ sound.js        (Sound class: WebAudio-synth combat sfx)
  ├─ sprite_sheet.js (SpriteSheet class: fixed-grid PNG sheet with tinting)
  └─ fx.js           (Fx class: token-slide and floating-number bookkeeping; DOM-free, checked by `node test/fx.js`)
```

- `colortheory.js` is used by `enemies.js` (for procedural creature tinting), not by `index.js`
- `terrain.js` and `renderer.js` exist but are unused — legacy from the Realm project
- `origitems.js` is an archive of hand-crafted magical items, retired from play and not loaded
- All persistent classes implement `toJSON()` / static `fromJSON(data)` for save/load

### Action / AI Extraction (the `ctx` injection pattern)

`index.js` still owns all module-level game state and combat math, but the **player-action**
and **enemy-AI** logic live in separate files that are loaded before `index.js` and don't reach into its state. They
receive everything they need through a plain dependency-injected context object built in
`index.js`:

- `actionCtx` (index.js ~164) — passed to `new MoveAction(actionCtx, ...).execute()` etc.
  Exposes live state via getters (`get player()`, `get world()`, …) and binds index.js
  callbacks (`dealDamageToEnemy`, `refreshVision`, `showDialog`, `setCombatAlerted`, …).
  `actions.js` defines `Action` → `Strike`/`WeaponStrike`/`RangedStrike` and the concrete
  `MoveAction`, `MeleeAction`, `RangedAction`, `MoveAndAttackAction`, `SkillAction`.
- `enemyAiCtx` (index.js ~202) — passed to `runEnemyAiPhase(enemyAiCtx)` (index.js wraps it as `runEnemyPhase()`). `enemy_ai.js` defines
  `EnemyAI` → `WildlifeAI`/`MonsterAI`/`RuinsGuardianAI`/`ChaosAI`, dispatched by `aiFor(behavior)`.

When you add a callback or piece of state that actions/AI need, wire it into the relevant
`ctx` object — don't reach back into `index.js` from those modules.

### Game State (index.js module-level variables)

- `world`: `GameWorld` instance — owns `hexes` (Map<"q,r", hex>), `pois`, `revealed`, `visible`, `breachesClosed`
- `player`: `Player` instance — `{q, r, stats, hp, aether, xp, level, gold, equipment, skills, inventory, statPoints, ...}`
- `em`: `EnemyManager` — owns `enemies` array, `creatureDefs`, `nextId`
- `victory`: `Victory` — score counters
- `sound`: `Sound` — singleton, constructed at load
- `phase`: `'player' | 'enemy' | 'dialog'` — gates input (canvas clicks ignored unless `'player'`)
- `selected`, `reachable` (Map<hexKey, cost>), `attackable` (Set<hexKey>) — recomputed on selection
- `targeting`: `{skill, validHexes: Set}` or null — for skill/ranged target picking
- `turn`, `gameOver`, `gameWon`, `gameGeneration` (incremented on new game to halt old loops)
- `combatAlerted`, `threatOverlay`, `showingWorldMap` — combat/overlay UI flags
- `hoveredHex`, `panX/Y`, `panning`, `dragCandidate`, `panStartX/Y`, `panOrigX/Y` — UI/input state (left-drag past `DRAG_THRESHOLD` pans; clicks act on mouseup via `handleClick`)
- `endTurnResolve` — promise resolver used by the async enemy phase
- `actionCtx`, `enemyAiCtx` — the injection objects described above

Maw-proximity BFS (`mawDistances`/`mawMaxDist`) lives in `enemy_ai.js`, not index.js;
recompute it via `computeMawDistances(world)` and read it via `mawProximityBonus`/`mawDistancePeak`.

### Coordinate System

Axial coordinates `(q, r)` with pointy-top hexes. Hex objects keyed by `"q,r"` strings via `hexKey()`. World is `MAP_COLS x MAP_ROWS` (100x100, set in `config.js`). Screen coordinates apply pan via `hexToScreen(q, r)` which wraps `hexToPixel`.

### Hex Object Shape
```javascript
{ q, r, col, row, elevation, isEdge, terrain, poi, goldDeposit, shatteredCount }
// `crop` is added dynamically during spawn logic
```

### Turn Flow

1. **Player phase**: select → move/attack/skill via `Action` classes → auto-end on 0 MP or manual end
2. **Enemy phase** (async, awaited via `endTurnResolve`): `runEnemyAiPhase(enemyAiCtx)` runs each enemy's AI with `animDelay` between actions
3. **Spawn phase**: breach spawning rolls (`pickSpawnPack`) → turn increment → MP reset (halved if engaged)

Canvas clicks are ignored when `phase !== 'player'`.

### Rendering

- Canvas draws hex map, fog, highlights, and tokens
- Tokens drawn from sprite sheets via `SpriteSheet.drawCell(ctx, col, row, x, y, w, h, tint?)`:
  - `mainSheet` (sprites.png, 5x20 grid) — player, common enemies
  - `guardianSheet` (sprites_guardians.png, 5x2 grid) — guardians
- HTML overlay panels (Character/Skills/Inventory) slide in from right
- Dialog overlay for havens/villages/ruins/level-up/skill choice/shop
- `render()` = `drawScene()` (canvas only) + `updateHUD()` + `refreshOpenPanels()` — don't call `render()` and `updateHUD()` both
- Motion is visual only and never blocks input or the turn: tokens are drawn via `tokenScreenPos(entity)`, which glides one from where it was drawn last frame (no call needed at the sites that move things), and `spawnDamageFloat` adds a rising number. While `fx.busy`, `kickAnim()` redraws `drawScene()` per animation frame
- UI colours and fonts are CSS variables at the top of `index.css` (serif for titles/prose, monospace for numbers); the intro overlay deliberately keeps its own hardcoded look

### Save / Load

- `localStorage` key: `warrior_save`
- Snapshot composes `victory.toJSON()`, `player.toJSON()`, `world.toJSON()`, `em.toJSON()`, plus `turn`
- `fromJSON` restores instances; `gameGeneration++` invalidates any in-flight async enemy loop

## Conventions

- Pure client-side JavaScript (plain script includes, no ES modules, no npm; Node is used only to run `test/`)
- No build step, no bundler, no external dependencies
- No gameplay tests; `test/` holds the load/motion/skill-dealing checks above
- Game state lives as `index.js` top-level `let`s (shared script scope, not `window` properties)
- Lookups via config tables: `ALL_EQUIPMENT[id]`, `ENEMY_DEFS[type]`, `SKILLS[id]`, `TERRAIN[...]`
- All randomness goes through `Rando` — `bellCurve(strength)` for damage rolls
- Color values are 0-1 floats internally, converted to hex strings only for canvas
- Phase management gates input: canvas clicks ignored when `phase !== 'player'`
- `deselectPlayer()` clears selection/reachable/attackable but NOT targeting state
- Persistent classes must keep `toJSON`/`fromJSON` in sync when fields are added

## Design Documents

- `SPEC.md` — Full game specification with functional requirements
- `DYNAMICS.md` — Game design philosophy, key drivers, strategy analysis
- `docs/` — `ASPIRATIONS.md`, `RUST_WASM.md` (forward-looking notes)
- `md/` — design brainstorms: `MAGIC_ITEMS.md`, `PRIME_GOALS.md`, `QUEST_BRAINSTORM.md`

## Repo Layout Gotcha

The git root is `/work/yuwakisaweb`, but the working directory is the `warrior/` subdirectory inside it. `git status` and `git diff` print paths from the repo root (e.g. `warrior/world.js`), but `git add` from this cwd must use paths relative to cwd (e.g. `world.js`, `pjpd/tasks.txt`). Don't copy the `warrior/`-prefixed paths out of diff output into `git add` — that will fail with "did not match any files".
