# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Warrior is a single-player tactical hex RPG. Canvas rendering, plain `<script>` includes (shared globals, not ES modules), no build step or external dependencies. See `ONTOLOGY.md` (the implementation reference) and `DYNAMICS.md` (design philosophy) for game design and mechanics.

## Running / Developing

No build or install step, and no server: double-click `index.html` (it must run from `file://`).

Checks (Node, DOM-free): `node test/scripts.js` (the script includes load as one shared scope, no duplicate top-level names), `node test/fx.js`, `node test/skilllibrary.js` (skill-group dealing), `node test/text.js` (the text table's shape and fail-fast helper), `node test/creatures.js` (each wildlife tier's melee/ranged pair and the ranged spawn share) and `node test/skillformulas.js` (the shared skill formulas and the previews cover the same skills).

### Plain scripts, not modules

Every file is a classic script listed in `index.html` in dependency order; a top-level `const`/`class`/`function` in one file is a global in the rest. So there is no `import`/`export`, top-level names must be unique across files, and a new file needs a `<script>` tag in the right place. `origitems.js`, `terrain.js` and `renderer.js` are not loaded.

## Architecture

### Module Dependency Graph
```
index.js (orchestrator: rendering, input, UI, save/load, combat math, dialogs)
  ├─ config.js       (constants, terrain, enemy/equipment/skill/POI defs; uses rando)
  ├─ hex.js          (axial hex math, BFS/Dijkstra, A*, draw helpers; uses HEX_SIZE)
  ├─ rando.js        (Rando: shuffle, choice, int, float, gaussian, bellCurve, weighted, bool; the only caller of `Math.random`)
  ├─ player.js       (Player class: stats, equipment, skills, inventory, toJSON/fromJSON)
  ├─ world.js        (GameWorld class: hex grid, POIs, fog, LOS; toJSON/fromJSON)
  ├─ skilllibrary.js (SkillLibrary class: per-run skill groups (core / fixed / optional, half of optional held out) and discovery channels so no skill is awarded twice; core skills come only from their one scroll each near the start (`placeCoreScrolls`, Channel Aether's nearest), story scrolls (`STORY_SCROLL_SKILLS`) land anywhere reachable and each of the `HUT_COUNT` huts gets a distinct optional skill; huts and Skill Seek give only optional skills; checked by `node test/skilllibrary.js`)
  ├─ enemies.js      (EnemyManager class: enemy list, spawn, defs; per-run wildlife tiers, each a melee creature plus a rarer ranged one (`spawnWeight`); uses colortheory; checked by `node test/creatures.js`)
  ├─ text.js         (TEXT table of every player-facing line + say(key, vars): picks a variant via Rando, styles by kind, fills {placeholders}, throws on a missing key, an unfilled placeholder or an unused var; `itemSpecialText(item)` fills an item special's stat line from the item's own fields; checked by `node test/text.js`, which also checks every literal `say()` key in index.js, actions.js and enemy_ai.js)
  ├─ actions.js      (player Action classes + MP/aether cost helpers; `SKILL_FORMULAS`, one damage/heal formula per skill, called by its `execute*` handler via `SkillAction.baseAmount()` and by the skill previews (`skillSummary` in index.js, whose `SKILL_POWER` holds only factors text); checked by `node test/skillformulas.js`; see below)
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

`say()` and the `TEXT` table are stateless and load before both files, so actions and AI call `say()` directly rather than through `ctx`.

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
{ q, r, col, row, elevation, isEdge, terrain, poi, goldDeposit, shatteredCount, skillGem, magicItem }
// goldDeposit / skillGem / magicItem mark a prize hex's hidden reward, cleared on pickup
// `crop` is added dynamically during spawn logic
```

### Turn Flow

1. **Player phase**: select → move/attack/skill via `Action` classes → auto-end on 0 MP or manual end
2. **Enemy phase** (async, awaited via `endTurnResolve`): `runEnemyAiPhase(enemyAiCtx)` runs each enemy's AI with `animDelay` between actions
3. **Spawn phase**: guardian respawn → one chaos spawn roll at a random source: an open breach, the unsealed Maw or the original Unraveler (`spawnChaos`) → wildlife pack spawn (`pickSpawnPack`) → garrisons tick → turn increment → MP reset (halved if engaged)

Canvas clicks are ignored when `phase !== 'player'`.

### Rendering

- Canvas draws hex map, fog, highlights, and tokens
- Tokens drawn from sprite sheets via `SpriteSheet.drawCell(ctx, col, row, x, y, w, h, tint?)`:
  - `mainSheet` (sprites.png, 5x20 grid) — player, common enemies
  - `guardianSheet` (sprites_guardians.png, 5x2 grid) — guardians
- HTML overlay panels (Character/Skills/Inventory) slide in from right
- Dialog overlay for havens/villages/ruins/level-up/skill choice/shop
- `render()` = `drawScene()` (canvas only) + `updateHUD()` + `refreshOpenPanels()` — don't call `render()` and `updateHUD()` both
- Motion is visual only and never blocks input or the turn: tokens are drawn via `tokenScreenPos(entity)`, which glides one from where it was drawn last frame (no call needed at the sites that move things), and `spawnDamageFloat` adds a rising number. `floatGain` floats a token's HP/AE rises, except the player's during the player phase, which are totalled in `turnGains` and floated once by `floatTurnGains` at end of turn. While `fx.busy`, `kickAnim()` redraws `drawScene()` per animation frame
- UI colours and fonts are CSS variables at the top of `index.css` (serif for titles/prose, monospace for numbers); the intro overlay deliberately keeps its own hardcoded look

### Save / Load

- `localStorage` key: `warrior_save`
- Every save carries `version: SAVE_VERSION` (an integer next to `SAVE_KEY` in index.js). Bump it by 1 whenever a change breaks old saves (a field added to or renamed in any `toJSON`/`fromJSON`, a changed save shape); leave it alone for non-breaking changes. `saveIsCurrent()` gates Continue: a save with another version, or none, shows a disabled "New Version" button on the intro and is never loaded (no migration; New Game overwrites it)
- Snapshot composes `victory.toJSON()`, `player.toJSON()`, `world.toJSON()`, `em.toJSON()`, plus `turn`
- `fromJSON` restores instances; `gameGeneration++` invalidates any in-flight async enemy loop

## Conventions

- Pure client-side JavaScript (plain script includes, no ES modules, no npm; Node is used only to run `test/`)
- No build step, no bundler, no external dependencies
- No gameplay tests; `test/` holds the load/motion/skill-dealing/text/creature/skill-formula checks above
- Game state lives as `index.js` top-level `let`s (shared script scope, not `window` properties)
- Lookups via config tables: `ALL_EQUIPMENT[id]`, `ENEMY_DEFS[type]`, `SKILLS[id]`, `TERRAIN[...]`
- Player-facing wording lives in `text.js`, not at call sites: `say('key', { name })` (always pass the vars object, `{}` when none). Prose kinds (narration/stage/speech) render to `<p>` blocks; labels and log lines are plain text. Functional entries keep one variant; flavor entries (huts, scrolls/ruins, havens/villages/smith greetings, level-up/Skill Seek) carry 20, every variant with the same placeholders. Log colour classes stay at the call site. Skill names/descriptions and item names stay in config.js as data.
- All randomness goes through `Rando` — `bellCurve(strength)` for damage rolls
- Color values are 0-1 floats internally, converted to hex strings only for canvas
- Phase management gates input: canvas clicks ignored when `phase !== 'player'`; player actions (skills, hex action, Inventory equip/unequip) check `isPlayerTurn()` (player phase and not game over). Set the phase only through `changePhase(p)`, which also redraws open panels
- `deselectPlayer()` clears selection/reachable/attackable but NOT targeting state
- Persistent classes must keep `toJSON`/`fromJSON` in sync when fields are added

## Design Documents

- `ONTOLOGY.md` — Implementation reference: purpose and goals, entities, invariants, rules as pseudocode, numbers, commands and events, open questions (Q-n); tagged [D]/[P]/[T]. Code wins where they disagree
- `DECISIONS.md` — Decisions with their reasoning, alternatives and dated history; records of other changes. Not needed to implement the game
- `DYNAMICS.md` — Game design philosophy, key drivers, strategy analysis
- `docs/` — `ASPIRATIONS.md`, `RUST_WASM.md` (forward-looking notes)
- `md/` — design brainstorms: `MAGIC_ITEMS.md`, `PRIME_GOALS.md`, `QUEST_BRAINSTORM.md`

## Repo Layout Gotcha

The git root is `/work/yuwakisaweb`, but the working directory is the `warrior/` subdirectory inside it. `git status` and `git diff` print paths from the repo root (e.g. `warrior/world.js`), but `git add` from this cwd must use paths relative to cwd (e.g. `world.js`, `pjpd/tasks.txt`). Don't copy the `warrior/`-prefixed paths out of diff output into `git add` — that will fail with "did not match any files".
