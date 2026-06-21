# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Warrior is a single-player tactical hex RPG. Canvas rendering, ES6 modules, no build step or external dependencies. See `SPEC.md` and `DYNAMICS.md` for game design and mechanics.

## Running / Developing

No build or install step. Serve via HTTP for ES6 module imports:
```bash
npx serve .
```

## Architecture

### Module Dependency Graph
```
index.js (orchestrator: rendering, input, UI, save/load, combat math, dialogs)
  ├─ config.js       (constants, terrain, enemy/equipment/skill/POI defs; imports rando, origitems)
  ├─ hex.js          (axial hex math, BFS/Dijkstra, A*, draw helpers; imports HEX_SIZE)
  ├─ rando.js        (Rando: shuffle, choice, int, bellCurve, weighted, bool)
  ├─ player.js       (Player class: stats, equipment, skills, inventory, toJSON/fromJSON)
  ├─ world.js        (GameWorld class: hex grid, POIs, fog, LOS; toJSON/fromJSON)
  ├─ skilllibrary.js (SkillLibrary class: partitions skill discovery channels so no skill is awarded twice)
  ├─ enemies.js      (EnemyManager class: enemy list, spawn, defs; imports colortheory)
  ├─ actions.js      (player Action classes + MP/aether cost helpers; see below)
  ├─ enemy_ai.js     (enemy AI classes, maw-distance math, runEnemyPhase; see below)
  ├─ victory.js      (Victory class: score tracking and final breakdown)
  ├─ sound.js        (Sound class: WebAudio-synth combat sfx)
  └─ sprite_sheet.js (SpriteSheet class: fixed-grid PNG sheet with tinting)
```

- `colortheory.js` is imported by `enemies.js` (for procedural creature tinting), not by `index.js`
- `terrain.js` and `renderer.js` exist but are unused — legacy from the Realm project
- `origitems.js` is an archive of hand-crafted magical items, imported only by `config.js`
- All persistent classes implement `toJSON()` / static `fromJSON(data)` for save/load

### Action / AI Extraction (the `ctx` injection pattern)

`index.js` still owns all module-level game state and combat math, but the **player-action**
and **enemy-AI** logic live in separate files that can't import `index.js` (circular). They
receive everything they need through a plain dependency-injected context object built in
`index.js`:

- `actionCtx` (index.js ~164) — passed to `new MoveAction(actionCtx, ...).execute()` etc.
  Exposes live state via getters (`get player()`, `get world()`, …) and binds index.js
  callbacks (`dealDamageToEnemy`, `refreshVision`, `showDialog`, `setCombatAlerted`, …).
  `actions.js` defines `Action` → `Strike`/`WeaponStrike`/`RangedStrike` and the concrete
  `MoveAction`, `MeleeAction`, `RangedAction`, `MoveAndAttackAction`, `SkillAction`.
- `enemyAiCtx` (index.js ~202) — passed to `runEnemyPhase(enemyAiCtx)`. `enemy_ai.js` defines
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
- `hoveredHex`, `panX/Y`, `panning`, `panStartX/Y`, `panOrigX/Y` — UI/input state
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
2. **Enemy phase** (async, awaited via `endTurnResolve`): `runEnemyPhase(enemyAiCtx)` runs each enemy's AI with `animDelay` between actions
3. **Spawn phase**: breach spawning rolls (`pickSpawnPack`) → turn increment → MP reset (halved if engaged)

Canvas clicks are ignored when `phase !== 'player'`.

### Rendering

- Canvas draws hex map, fog, highlights, and tokens
- Tokens drawn from sprite sheets via `SpriteSheet.drawCell(ctx, col, row, x, y, w, h, tint?)`:
  - `mainSheet` (sprites.png, 5x20 grid) — player, common enemies
  - `guardianSheet` (sprites_guardians.png, 5x2 grid) — guardians
- HTML overlay panels (Character/Skills/Inventory) slide in from right
- Dialog overlay for havens/villages/ruins/level-up/skill choice/shop
- `render()` ends by calling `updateHUD()` — don't call both

### Save / Load

- `localStorage` key: `warrior_save`
- Snapshot composes `victory.toJSON()`, `player.toJSON()`, `world.toJSON()`, `em.toJSON()`, plus `turn`
- `fromJSON` restores instances; `gameGeneration++` invalidates any in-flight async enemy loop

## Conventions

- Pure client-side JavaScript (ES6 modules, no Node/npm)
- No build step, no bundler, no external dependencies
- No tests
- Game state lives as `index.js` module-level `let`s — no `window` pollution
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
