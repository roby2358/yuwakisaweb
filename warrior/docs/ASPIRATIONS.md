# Aspirations

Structural regrets and directions worth pursuing when the codebase gets a
breather. Not a roadmap; a checklist of known sharp edges.

## Top regrets

### 1. `index.js` is 3,343 lines and 150+ top-level declarations

It's the orchestrator, the renderer, the input router, the dialog factory,
the enemy AI runner, the HUD updater, *and* the save/load layer. The README's
module graph paints `index.js` as a thin top — the reality is the opposite.
Natural extractions sitting in plain sight:

- Enemy phase AI (`runMonsterTurn`, `runChaosTurn`, `runRuinsGuardianTurn`,
  `tryAggroChase`, `trySwarmMarch`, `pickSpawnPack`, ...) → `enemy_ai.js`.
- UI panels and dialogs (`updateCharPanel`, `showShopDialog`,
  `showLevelUpDialog`, ...) → `ui.js` / `dialogs.js`.
- Rendering pipeline (`render`, `drawCounter`, `renderWorldMap`, attack icons)
  → `render.js`.
- Save/load → `persist.js`.

### 2. `actionCtx` is a 35-entry shim that smells like a circular dependency

Every time `actions.js` needs to reach into `index.js` state, another
arrow-wrapped passthrough gets added. `(...a) => dealDamageToEnemy(...a)` ×
~10 means callbacks lose their identity for stack traces, and the surface
area only grows. Two cleaner shapes:

- (a) Hoist combat resolution (`dealDamageToEnemy`, `killEnemy`,
  `enemyDefense`, `rollPlayerStun`) into a `combat.js` that both sides import.
- (b) Make `GameState` a real object with methods so the ctx *is* the state
  instead of a curtain over it.

### 3. Naming collision: `ctx`

`actions.js` uses `ctx` for game context; `index.js:178` uses `ctx` for the
canvas 2D context. They never mix, but every reader has to disambiguate.
Rename one — `gctx`/`gameCtx` for the action context is the cheap fix.

### 4. `Action` base class is doing two jobs

Helpers like `applyEquipmentBonusDamage`, `applyOnHitEffects`,
`chainBounceRaw`, `pushEnemyAway`, `nearestUnhit` are weapon-strike concerns,
but they live on the base that `MoveAction`, `SkillAction`, and `SkillAction`'s
50+ handlers also inherit. Either:

- (a) Move them onto `Strike`/`WeaponStrike` where they actually apply, or
- (b) Split into `WeaponAction extends Action` and keep `Action` lean.

### 5. 50+ skill handlers as bare functions + a registry, while everything else is a class

`SKILL_HANDLERS[id](action)` works, but it sidesteps the class system
committed to for actions. Either skills should be
`class ImmolateAction extends SkillAction` and self-register, or the
data-driven dispatch should extend to all actions. The current half-and-half
means skill behavior lives in two indirections (the data in `config.js`, the
handler in `actions.js`, the dispatch in `SkillAction.execute`).

### 6. `config.js` (849 lines) is four config files in a trenchcoat

Terrain tables, equipment catalog, enemy defs, skill defs, POI rules, balance
constants. They have different change frequencies and different reviewers
(designer vs. coder). Splitting `terrain_config.js`, `equipment.js`,
`enemy_defs.js`, `skills.js`, `balance.js` would make designer-iteration
commits stop touching shared files.

### 7. Dead code is still in the tree

`terrain.js` (351 lines) and `renderer.js` (263 lines) are documented as
legacy. `CLAUDE.md` notes it but the files are still imported nowhere and
still ship. Just delete them — `git` remembers.

### 8. No tests, against the stated rule

The coding conventions say "Unit tests are critical to our process...
non-negotiable." This repo has zero. The pure functions in `hex.js`,
`rando.js`, `colortheory.js`, and the damage math on `Player`/`Strike` would
all be cheap, fast, and high-value to cover — they're already pure enough
that the "shallow call chains, concrete returns" rule is satisfied.

### 9. Selection state lives in three correlated `let`s

`selected`, `reachable`, `attackable` are three module variables that must
move together — the bug fixed in May 2026 (RangedAction not refreshing) was
exactly an instance of one of them going stale. A `Selection` object with a
single `clear()` / `refresh()` would make it impossible to forget one.

## Things that are good, for the record

- The action-as-class model with a `ctx` argument is the right shape; the
  trouble is the shim, not the idea.
- `toJSON`/`fromJSON` symmetry on persistent classes is disciplined.
- `gameGeneration++` to invalidate in-flight async loops on new-game is a
  nice touch — easy to get wrong without it.
- Coordinate math (`hex.js`) is genuinely isolated and pure.
- The `Rando` indirection over `Math.random` will pay off the day seeded
  replays or determinism become useful.

## Suggested first cut

Extract enemy AI out of `index.js` into `enemy_ai.js`. It's the largest
cohesive chunk that doesn't touch rendering or DOM, and it's where future
combat work will keep adding lines.
