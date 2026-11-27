# ONTOLOGY.md — Warrior

This is the implementation reference for Warrior. It says what exists, what each thing
carries, how things relate, the rules as short pseudocode, the enemy agents, every
tunable number, and the de facto interface between the rules and the screen. The code
is the source of truth: where this doc and the code disagree, the code wins and the doc
gets fixed. Content tables (each skill, each item, each fixed enemy) stay in
`config.js` and `enemies.js`; this doc describes their templates and names the table.
The design story (theme, drivers, strategies) lives in `DYNAMICS.md`; decisions, their
reasoning and history live in `DECISIONS.md`. Open questions (`Q-n`) are the last section here.

**Tags.** **[D]** decided by the designer (shipped behaviour the user designed).
**[P]** proposed or inferred by Claude, pending review. **[T]** tunable number; its value
appears only in the Numbers table. **[D, unbuilt]** decided but not in the code yet.
**Serves:** names the goal (G-n), quality, or DYNAMICS driver an item exists for.

---

## §0 Purpose [D]

Warrior is a single-player tactical hex RPG. A lone, cosmically powered warrior explores
a large procedural world where sword and sorcery meet alien technology and creeping
chaos. The warrior fights on the world map itself, grows stronger from fights, places and
loot, and ends the run by sealing the Maw, the wound where reality is dissolving.

### Qualities (named feelings)

- **Survival escalation** [D] — not a power fantasy. You start weak and claw your way up.
  (DYNAMICS theme.)
- **Defiance against entropy** [D] — every breach sealed and every hex restored pushes
  back against a world getting worse on its own.
- **Windfall** [D] — big, sudden gains: a strong magic item, a level-up heal, a ruin haul.
- **Weight of choice** [D] — few MP, few slots, little Aether; each action costs something.
- **Readability** [D] — what you can reach, hit and fear is shown on the map.
- **Room to break the game** [D] — the system is meant to have exploits. Discoverable
  rule-breaking combos of gear and skills are intended fun, and landing on one that wins
  the game is part of the windfall. Balancing is light, with no reflexive floors or caps;
  a careful player loses only by getting careless.
- **Living map** [D] — huts and ruins are never spent. Repeat visits use a low chance,
  not a one-time limit.

### Goals (priority order)

- **G-1 Seal the Maw and walk away.** [D] A run is won by sealing every breach, slaying
  the Unraveler, sealing the Maw, and invoking the RETURN scroll it leaves. Losing all HP
  ends the run.
- **G-2 Build a different warrior each run.** [D] Procedural magic items, a per-run deal
  of skills (half the optional skills held out), and procedural wildlife make each run's
  character and opposition differ. (DYNAMICS: Accumulation and Windfall, Variable
  Reinforcement.)
- **G-3 Every turn is a triage decision.** [D] Movement points, Aether, skill points and
  skill slots are scarce; engagement halves MP. (DYNAMICS: Scarcity of Agency.)
- **G-4 The land is worth defending.** [D] Chaos shatters terrain and it spreads; Restore
  and Salvage heal it; clean land fuels skills. (DYNAMICS: Guardianship, Escalating
  Commitment.)
- **G-5 Danger tracks capability.** [D] Spawn strength rises toward the Maw on a smooth
  gradient and packs scale to the player's attack, so the early game is not
  avoidance-only. (User decision on spawn engagement.)
- **G-6 Consequences are readable.** [D] Highlights, counters, badges, logs and floats
  show what happened and what can happen. (DYNAMICS: Readable Consequences.)
- **G-7 Runs from a double-clicked index.html.** [D] Plain script includes, no build, no
  server, no dependencies.

### Priorities when goals conflict [P]

G-1 > G-3 > G-2 > G-5 > G-4 > G-6 > G-7 for rules. G-7 is a hard constraint on code
structure and is never traded away. "Room to break the game" beats balance tidiness.

### Non-goals (for now)

- Multiplayer or a server. [P]
- Save migration or back-compat for old saves. [D] A version mismatch shows "New
  Version" and the save is not loaded.
- Seeded or reproducible runs. [D] `Rando` has no seed; it exists to keep the random
  functions in one place.
- Mobile/touch play. [P]

---

## §1 Entities

### GameState (top-level `let`s in `index.js`, plus two in `enemy_ai.js`)

*Serves:* G-1, G-7 — every piece of run state has one named home.

| Field | Type | Notes |
|---|---|---|
| world | GameWorld | Map, POIs, fog. |
| player | Player | The warrior. |
| em | EnemyManager | Enemy list and enemy defs for this run. |
| victory | Victory | Score counters. |
| skillLibrary | SkillLibrary | Per-run skill deal (held out, taken). |
| turn | int | Starts at 1; +1 in advanceTurn. |
| phase | 'player' \| 'enemy' \| 'dialog' | Gates input. Canvas clicks act only in 'player'. |
| gameOver, gameWon | bool | Set by endGame. |
| gameGeneration | int | +1 per gameLoop start; an old async loop whose generation is stale stops. |
| endTurnResolve | fn \| null | Resolves the player-phase promise in gameLoop. |
| selected | bool | Player token selected. |
| reachable | Map<hexKey, cost> \| null | From computeReachable. |
| attackable | Set<hexKey> \| null | From computeAttackable. |
| targeting | {skill, validHexes} \| null | skill is a skill id, `'__ranged__'` or `'__melee__'`. |
| combatAlerted | bool | Set by any attack or skill; cleared at player-turn start. Cancels forest stealth nearby. |
| threatOverlay | Map<hexKey, number> \| null | Ground Weeps heat map until dismissed. |
| showingWorldMap, hoveredHex, panX/panY, panning, dragCandidate, pan origin | view state | UI only. |
| playerSprite, enemySprites | sprite cells | Chosen at new game; saved. |
| ALL_EQUIPMENT | {id: Item} | Global item registry (config.js); mundane items plus every magic item rolled this run. Saved. |
| mawDistances, mawMaxDist | Map<hexKey, cost>, number | In `enemy_ai.js`. Movement-cost distance from the Maw; rebuilt by computeMawDistances at new game and load. Derived, not saved. |
| turnTimesAll, turnTimesNonPoi | number[] | Turn-time metrics (capped at TURN_METRICS_CAP), shown on the Character panel. Not saved. |

### GameWorld (`world.js`)

*Serves:* G-1, G-4.

| Field | Type | Notes |
|---|---|---|
| hexes | Map<hexKey, Hex> | MAP_COLS × MAP_ROWS axial hexes. |
| pois | POI[] | Every point of interest, including scrolls and garrisons. |
| revealed | Set<hexKey> | Ever seen. Persists. |
| visible | Set<hexKey> | In current vision. Rebuilt on refreshVision; not saved. |
| breachesClosed | int | Count of sealed breaches and Maw. |

### Hex

*Serves:* G-4, G-6.

| Field | Type | Notes |
|---|---|---|
| q, r | int | Axial coords; key is `hexKey(q, r)` = "q,r". |
| col, row | int | Offset grid position. Generation only after placement, but kept. |
| elevation | number 0-100 | Heightmap value. Generation only; kept in the save. |
| isEdge | bool | Outer ring; always water. |
| terrain | TERRAIN id | See Terrain. |
| poi | POI type \| null | Mirror of the POI on this hex. |
| goldDeposit | int | Gold collected on entry; 0 = none. |
| shatteredCount | int | Shattered hexes within SHATTER_RADIUS. |
| skillGem | bool | A skill gem lies here. |
| magicItem | bool | A prize magic item lies here. |
| crop | icon \| false (optional) | Added when a crop sprouts; eating it heals. |

### POI (plain object in `world.pois`)

*Serves:* G-1, G-2, "Living map".

| Field | Type | Notes |
|---|---|---|
| q, r, id, type | | type is a `POI` value: haven, village, ruin, breach, maw, hut, scroll, garrison_build, garrison. |
| shopItems | Item[] | Haven (magic + mundane) and village (mundane only). |
| ruinState | 'new' \| 'spawned' \| 'explored' | Ruin only. |
| closed | bool | Breach and Maw. |
| guardianId | int \| null | Breach and Maw: id of the enemy whose death marks the POI ready to seal. |
| guardianDefeated | bool | Breach and Maw: set when that enemy dies; cleared on guardian respawn. |
| skill | skill id \| null | Hut: its standing assigned skill. Scroll: the skill it grants. |
| rolledTurn | int \| absent | Hut: the turn its gift and reroll chances were last rolled. |

### Player (`player.js`)

*Serves:* G-2, G-3.

| Field | Type | Notes |
|---|---|---|
| q, r | int | Position. |
| stats | {might, reflex, warding, vigor} | Start at STARTING_STATS. |
| hp, aether | int | Bounded by maxHP(), maxAether(). |
| xp, level | int | Level 1..LEVEL_CAP. xp resets by the threshold on level-up. |
| gold | int | |
| equipment | {weapon, armor, artifact} | Item ids or null; the weapon slot may be empty (unarmed) [D]. Starts Rusty Blade, Worn Leather, none. |
| inventory | item id[] | Starts with Stick Bow. |
| learnedSkills | Set<skill id> | Everything the player knows. Starts {restore}. |
| activeSkills | Set<skill id> | Trained (usable) subset of learned. Starts {restore}. |
| skills | (skill id \| null)[SKILL_SLOTS] | Hotbar; only active skills go here. Five slots [D]. |
| sp, maxSP | int | Skill points owned, and their ceiling (STARTING_SP, MAX_SP). |
| skillRanks | {skill id: 1..SKILL_MAX_RANK} | Absent = rank 1. |
| statPoints | int | Unspent stat points. |
| mp | int | Movement points left this turn. |
| warpShieldTurns, reflectTurns | int | Defensive buffs, count down at enemy-phase end. |
| dodgeSkillBonus | int | The Dodge skill's active bonus in percent, 0 when not raised. Set by the cast, cleared at advance turn. Not saved: a loaded game starts with 0. |
| movedThisTurn, hexesMovedThisTurn | bool, int | Charge, wall_of_steel, momentum read these. Not saved. |
| phaseStepUsedThisTurn, sprintUsedThisTurn | bool | Once-per-turn gates. Not saved. |
| seenDialogs | Set<string> | Once-only dialog keys and "sp:<poi id>" first-visit SP grants. |

Derived (methods): `maxHP()`, `maxAether()`, `maxMP()`, `vision()`, `defense(terrain)`,
`dodge()`, `meleeDamage(isChaos)`, `rangedDamage(dist, isChaos)`, `weaponRange(terrain,
poiType)`, `effectiveVigor()`, `rankOf(id)`, `skillSPCost(id)`, `freeSP()`. Item passives
are read with `equipped(special)` (first match) and `sumEquipped(special, field)`
(stacks across armor and artifact).

### Enemy instance (in `em.enemies`)

*Serves:* G-3, G-5.

| Field | Type | Notes |
|---|---|---|
| id | int | From em.nextId. |
| type | string | Key into ENEMY_DEFS or em.creatureDefs. |
| q, r | int | Position. |
| hp, maxHp | int | maxHp is the def's hp; Maw proximity adds to the effective max. |
| homeQ, homeR | int | Spawn hex or owning breach/Maw. Guards return here. |
| turnsSinceSpawn | int | +1 each enemy phase. Nothing reads it. |
| targetQ, targetR | int \| null | Hunt target from an alarm or a swarm. |
| stunnedNextTurn | bool | Skips its next turn. |
| stunRolledThisTurn | bool | One stun roll per player turn; cleared in advanceTurn. |
| burnDamage | int | Dealt at the next enemy phase, ignoring defense, then cleared. |
| defReduction | int | Permanent defense shred. |
| noSpawn | bool | Set on the re-formed Unraveler; it is not a chaos spawn source. |

All fields are saved (the enemy list is saved whole).

### EnemyDef (template)

*Serves:* G-2, G-5. Fixed chaos defs live in `ENEMY_DEFS` (config.js): Void Stalker,
Breach Crawler, Flux Archer, Phase Wraith, Breach Guardian, The Unraveler. Wildlife defs
are generated per run into `em.creatureDefs` (see Wildlife tiers).

| Field | Type | Notes |
|---|---|---|
| name, label | string | |
| hp, attack, defense | int | |
| rangedAttack, range | int (optional) | Ranged iff range > 0 (`enemyIsRanged`). |
| speed | int | Steps per turn (chaos AI). |
| detectRange, aggroRange | int | Aggro uses aggroRange, else detectRange. |
| xp, gold | int | Kill rewards (gold adds to a random base). |
| behavior | string | chase, kite, teleport, guard, boss (chaos); wildlife, monster, ruins-guardian (wildlife). Picks the AI. |
| chaosSpawned | bool | Chaos enemies: grant AE on kill, shatter terrain, get corrupted-terrain buffs, are revealed by reveal_maw. |
| teleportRange, teleportChance | | Phase Wraith. |
| guardRadius | int | Breach Guardian. |
| tier, spawnWeight, color | | Wildlife only. |

### Item (template)

*Serves:* G-2, "Windfall", "Room to break the game".

| Field | Type | Notes |
|---|---|---|
| id, name, slot | | slot: weapon, armor, artifact. |
| type | 'melee' \| 'ranged' | Weapons. Display only; ranged-ness is `range > 0` (`weaponIsRanged`). |
| damage, range | int | Weapons. |
| defense | int | Armor. |
| price | int | Buy price; sell price is derived. |
| tier | 0..4 | Mundane only. |
| magical | bool | |
| special | string \| null | One effect id from an effect pool (magic only). |
| effect fields | various | The effect's magnitudes (pierceAmount, burnDamage, dodgeBonus, …). |
| mpCost | 0 \| 1 \| 2 \| 'all' | Magic weapon variant. Absent = default by weapon kind. |
| aetherCost | int | Heavy magic ranged weapons. |

Mundane items: `WEAPONS` and `ARMORS` in config.js. Magic items: rolled by
`rollMagicItem(category)` and registered in ALL_EQUIPMENT.

### Skill def (template, `SKILLS` in config.js)

*Serves:* G-2, G-3.

| Field | Type | Notes |
|---|---|---|
| id, name, desc | | |
| cost | int | Aether cost (before aether_discount). |
| mpCost | int \| 'half' \| absent | Absent = 'all' (ends the turn's movement). 'half' = floor(current MP / DODGE_MP_DIVISOR) (Dodge). |
| target | SKILL_TARGET | self, melee, melee_execute, ranged, ranged_aoe, aoe_self, teleport, teleport_revealed, water_skip, mountain_skip. |
| usage | SKILL_USAGE | anytime, non_combat, pristine. |
| weaponClass | 'melee' \| 'ranged' \| 'direct' \| absent | melee/ranged skills flow through a matching held weapon. |
| scales, tiers | string[], tuple[] | Per-rank values; `effectiveSkill(def, rank)` overlays tiers[rank-1] onto the named axes. |
| minLevel | int | Skill Seek level gate. |
| core, shopOnly, scrollOnly | bool | Skill group flags. |
| shopPrice, goldCost | int | Shop-only skills. |
| panelInvoke | bool | May be invoked from the Skills panel without a hotbar slot. |
| freeAttune | bool | Costs no SP; always active once learned; not shown in Train. |
| other constants | | e.g. duration, takePercent, reflectPercent, aetherPerHit, hpPerHit, baseDamage, range. |

### SkillLibrary (`skilllibrary.js`)

*Serves:* G-2. The single authority on skill discovery, so no skill is awarded twice.

| Field | Type | Notes |
|---|---|---|
| taken | Set<skill id> | Optional skills bound to story scrolls this run. |
| heldOut | Set<skill id> | Optional skills no channel may grant this run. Never shown to the player. |

### Victory (`victory.js`)

*Serves:* G-1, G-6. Counters: enemiesDefeated, guardiansDefeated, garrisonsCompleted,
garrisonKills, distanceTraveled, damageDealt, damageTaken, nearDeathMoments,
hexesRestored, settlementsRestored, ruinsExplored, goldCollected, breachesSealed.
`score()` = Σ counter × `Victory.WEIGHTS[counter]`, rounded. `breakdown()` lists each
with its label (`Victory.LABELS`) and points.

### Save record (localStorage key SAVE_KEY)

`{ version: SAVE_VERSION, turn, victory, player, world, enemies, equipment
(ALL_EQUIPMENT), playerSprite, enemySprites, skillLibrary }`. Every persistent class has
`toJSON()` / static `fromJSON()`.

---

## §2 Relations and invariants

- Exactly one Maw POI, one Player, one GameWorld per run. [D]
- `hex.poi` equals the type of the POI at (q, r), or null; at most one POI per hex. [D]
- POIs placed at generation are at least POI_MIN_DIST apart. Scrolls and garrisons are
  placed later and are exempt. [D]
- Every breach is reachable on foot from the Maw (placement filters on Maw distance). [D]
- Every scroll's skill is set (never blank) and unknown to the player when placed; picking
  up a blank or known scroll throws. [D]
- A skill is in at most one of: learned, heldOut, taken-and-unlearned. Core skills are
  never held out, taken, dealt to huts, or offered by Skill Seek. [D]
- `activeSkills ⊆ learnedSkills`; every non-null hotbar slot is in activeSkills. [D]
- `freeSP() = sp − Σ skillSPCost(active) ≥ 0` after any Train action (Train refuses a step
  it can't pay). [D]
- `sp ≤ maxSP`. `0 ≤ hp ≤ maxHP()` and `0 ≤ aether ≤ maxAether()` after any equip,
  stat or heal change (each clamps). [D]
- `player.level ≤ LEVEL_CAP`. [D]
- No two enemies share a hex; no enemy stands on the player's hex. Enemies never walk into
  havens, villages or garrisons, except a swarm whose explicit goal is that hex. A Phase
  Wraith teleport excludes havens and villages only. [D]
- Breach and Maw hexes are impassable to everyone after spawn. A sealed breach or Maw hex
  becomes Hills. [D]
- `shatteredCount` of a hex = number of shattered hexes within SHATTER_RADIUS (kept by
  shatter and restore). A distressed hex with count 0 reverts to its base terrain on the
  next restore pass. [P: maintained incrementally; not re-derived]
- A haven or village hex never becomes shattered or distressed through enemy shattering,
  and its shatteredCount is not raised. [D]
- Game over ⇒ no further enemy actions this phase; the save is deleted when the loop ends. [D]
- A save with a version other than SAVE_VERSION is never loaded. [D]
- Every random draw in the loaded code goes through `Rando`; `Math.random` is called only
  in rando.js. [D]
- Determinism does **not** hold: same commands do not give the same state (no seed). [P]

---

## §3 Domain structure

### Terrain [D]

*Serves:* G-3, G-4, G-6.

Families (ids in `TERRAIN`, names in `TERRAIN_NAMES`):

| Family | Members | Notes |
|---|---|---|
| Base | Water, Plains, Hills, Mountain, Forest, Quarry | Water and Mountain impassable; Mountain blocks LOS. |
| Special (prize) | Verdant Glade, Hallowed Grove, Gilded Rise | Lighter versions of plains/forest/hills; hold a hidden prize. |
| Shattered | Shattered Plains/Hills/Forest/Quarry | Made by chaos; higher move cost. |
| Distressed | Distressed Plains/Hills/Forest/Quarry | Near shattered hexes; same costs as base. |
| POI terrain | Ruins, Breach, Maw | Ruins passable; Breach and Maw impassable. |

- Move cost per terrain: `MOVEMENT_COST`. Player cost: `playerMoveCost(hex)` — a haven or
  village hex costs SETTLEMENT_MOVE_COST; with `strider` any finite cost above 1 becomes 1.
- Defense bonus: `TERRAIN_DEFENSE_BONUS` (forest family) and `POI_DEFENSE_BONUS` (haven,
  village, garrison) for the occupant player.
- Ranged range bonus: `TERRAIN_RANGE_BONUS` (hills family, ruins) and `POI_RANGE_BONUS`
  (garrison).
- `RANGER_TERRAIN` lists the terrains where `ranger_defense` applies.
- `isChaosTerrain(t)`: shattered or distressed. Lookups `SHATTERED_VERSION`,
  `UNSHATTERED_VERSION`, `DISTRESSED_VERSION`, `UNDISTRESSED_VERSION` map between families.
- Forest stealth: the player on Forest or Distressed Forest lowers enemy aggro (see Agents).

### Map generation [D]

*Serves:* G-2, G-1.

1. Heightmap: diamond-square on a HEIGHTMAP_SIZE grid with HEIGHTMAP_ROUGHNESS,
   normalized to 0-100, sampled onto MAP_COLS × MAP_ROWS offset rows (axial q = col −
   floor(row/2)).
2. Edge hexes are water. Interior hexes sorted by elevation get bands by percentile:
   water below WATER_PCT, plains below PLAINS_PCT, hills below HILLS_PCT, else mountain.
3. FOREST_SHARE of the interior count, taken from random plains, becomes forest.
   max(QUARRY_MIN, QUARRY_SHARE of the interior) random hills become quarry.
4. Special hexes: PRIZE_SHARE of the interior, split evenly across plains, forest and
   hills, become their special version.
5. POIs (below). Steps 1-5 repeat up to MAP_ATTEMPTS times until `_validate()` passes:
   at least one haven and the Maw exist, every haven reaches the Maw on foot, and at least
   half the havens lie more than half of the farthest haven's distance from the Maw. After
   the last attempt the map is kept even if invalid. [D]
6. Prizes are rolled on every special hex that holds no POI.
7. At new game (after the start is chosen): core scrolls, story scrolls, the skill deal,
   enemies.

### Points of interest [D]

*Serves:* G-1, G-2, "Living map".

Placement order and counts: havens (HAVEN_COUNT range), villages (VILLAGE_COUNT range),
ruins (RUIN_COUNT range), the Maw (one, on the passable hex with the highest column that
fits), breaches (BREACH_COUNT range, only on hexes reachable from the Maw), huts
(HUT_COUNT). Each picks shuffled candidates from passable, unused hexes and skips any
within POI_MIN_DIST of an earlier POI; a type that runs out of room places fewer.

| Type | On placement | Purpose |
|---|---|---|
| Haven | shopItems = HAVEN_MAGIC_STOCK magic + HAVEN_MUNDANE_STOCK mundane | Full rest, two smiths, Train, first-visit SP. |
| Village | shopItems = VILLAGE_STOCK mundane | Half rest, weaponsmith, crops. |
| Ruin | ruinState 'new'; terrain → Ruins | Stir creatures, then loot. Never spent. |
| Breach | closed false; terrain → Breach; gets a Breach Guardian and crawlers | Spawns chaos until sealed. |
| Maw | closed false; terrain → Maw; gets the Unraveler | Spawns chaos until sealed. Final seal. |
| Hut | skill dealt by SkillLibrary | Teaches optional skills; small rest, Train, first-visit SP. |
| Scroll | skill set | Grants one skill on pickup; removed. |
| Garrison build → Garrison | made by the Commission Garrison skill | Becomes a garrison by chance; slays chaos nearby. |

The starting settlement: the haven or village farthest from the Maw by movement cost,
skipping any on a hills-family hex.

### Prize hexes [D]

Each special hex without a POI holds one prize, picked by weight from PRIZE_WEIGHTS:
gold (goldDeposit in PRIZE_GOLD range), a skill gem, or a magic item (random category,
rolled when picked up). All share the same sparkle; each is collected once on entry.
Story scrolls placed on plains turn that plains into Verdant Glade, so scrolls also ride a
special-looking hex but hold no other prize.

### Skill model [D]

*Serves:* G-2, G-3.

- **Learned → active → equipped.** A learned skill is latent until trained (made active)
  in the Train dialog; only active skills can be used or put on the hotbar. freeAttune
  skills are active the moment they are learned. Scroll pickups arrive active when the
  player has free SP; other channels give latent skills.
- **Ranks.** Active tiered skills have rank 1..SKILL_MAX_RANK. Keeping a skill active at
  rank R costs R(R+1)/2 SP (`rankSPCost`); each step up costs the target rank. freeAttune
  skills cost 0. Untiered skills stay rank 1.
- **SP sources.** STARTING_SP at start; +1 per level-up; +1 on first visit to each haven and
  hut; skill gems and empty Skill Seeks give +1 (or CONSOLATION_XP when SP is maxed).
- **Usage.** anytime: no limit. non_combat: no enemy within SKILL_SAFE_RADIUS. pristine:
  non_combat and the player's hex is not shattered. Phase Step and Sprint are once per
  turn; Dodge cannot be cast while its bonus is active, which makes it once per turn too.
- **Costs.** Aether: `effectiveAetherCost` = max(0, cost − Σ aether_discount). MP:
  `skillMpCost` = mpCost or 'all'; 'half' spends floor(current MP / DODGE_MP_DIVISOR),
  which can be 0; a weapon-class skill with a matching held weapon pays
  max(skill MP, weapon MP) (`effectiveSkillMpCost`). Some skills cost gold (goldCost) or
  HP (Dimensional Rend) instead of or as well as Aether.
- **Weapon flow.** weaponClass melee/ranged with a matching held weapon: the skill uses the
  weapon's damage, affixes, and (ranged) the weapon's effective range. Mismatch or
  'direct': unarmed damage (1), no affixes, the skill's own range.
- **Stun bucket.** Each damaging skill names a bucket: 'primary' (melee and Might/Vigor
  coded) or 'other'.
- The individual skills, their tiers and descriptions are the `SKILLS` table; their
  handlers are `SKILL_HANDLERS` in actions.js.
- **Formulas.** Each skill with a damage or heal number has one entry in `SKILL_FORMULAS`
  (actions.js): from the rank-resolved skill, the player's stats and the matched weapon
  damage it returns the pre-roll amount of a single hit on one target. The handler takes
  its base amount from that entry (`SkillAction.baseAmount`) and then applies its own
  rolls, multi-hit, area and riders.

### Skill groups and the per-run deal [D]

*Serves:* G-2, "Living map".

| Group | Members | Channel |
|---|---|---|
| core | `core: true` (Channel Aether, Spirit Walk, Mountain Skip, Water Skip, Renew, Retrain) | Exactly one scroll each near the start; nothing else grants them. |
| fixed | shopOnly (Commune, Commission Garrison), scrollOnly (RETURN), the starting skill (Restore) | Magicsmith purchase; the Maw's dropped scroll; known at start. |
| optional | every other skill | Story scrolls, huts, Skill Seek, hut rerolls. |

- **Core scrolls** (`placeCoreScrolls`): Channel Aether's within CHANNEL_SCROLL_RADIUS of
  the start; each other core skill farther than that and within NEAR_CORE_SCROLL_RADIUS.
  All reachable on foot.
- **Deal** (`deal`): shuffle the optional skills the player doesn't know; the back
  floor(n × SKILL_HELD_OUT_FRACTION) are held out. The first STORY_SCROLL_SKILLS of the rest
  go to story scrolls (marked taken). The remaining obtainable skills are shuffled and
  handed to the HUT_COUNT huts in order (distinct while they last; spare huts repeat one at
  random). Unfilled story scrolls are removed.
- **Story scrolls**: STORY_SCROLL_SKILLS scrolls anywhere reachable on foot from the start.
- **Obtainable** = optional, not taken, not held out, not learned. Skill Seek draws the
  obtainable skills with minLevel ≤ player level; hut rerolls draw any obtainable skill.

### Items [D]

*Serves:* G-2, "Windfall", "Room to break the game".

- **Mundane**: `WEAPONS` and `ARMORS`, tiers 0-4, fixed stats, no special. Tier 0 items are
  the starting kit.
- **Magic** (`rollMagicItem(category)`; category random if not given):
  - melee: damage in MAGIC_DAMAGE range, one MELEE_EFFECTS entry, a d6 variant:
    normal / fast (mpCost 0) / heavy (damage × 2, mpCost 'all').
  - ranged: damage in MAGIC_DAMAGE range, range in MAGIC_RANGE range, one RANGED_EFFECTS
    entry, a d6 variant: normal (mpCost 2) / fast (mpCost 1) / heavy (damage × 2, mpCost
    'all', aetherCost 2).
  - armor: defense in MAGIC_DEFENSE range, one ARMOR_OR_PASSIVE entry.
  - artifact: one ARTIFACT_EFFECTS entry (PASSIVE_EFFECTS plus DODGE_BONUS_EFFECTS).
  - price: a per-category formula of damage/range/defense times the effect's `value`
    (the magic item price row in Numbers).
  - name: one of six patterns from MODES, VERBERS, VERBS, ARCHETYPES_GENERAL,
    VERBING_GENERAL, the effect's own words in EFFECT_NAMING, and a noun row chosen by
    damage or defense (MELEE_ITEMS, RANGED_ITEMS, ARMOR_ITEMS) or ARTIFACT_ITEMS.
- **Effect pools** (one `special` per item; magnitudes in the pool entry):
  - on-hit / strike: armor_pierce, aether_siphon, burn, chain, chaos_bonus, defense_shred,
    double_strike, triple_strike, double_shot, triple_shot, ignore_defense, knockback,
    lifesteal, charge, channel, reverberate, riposte, sweep, stun, splash, piercing, sniper,
    free_action, free_ranged, counter_mastery.
  - defensive armor: burning_aura, counter_deflect, dodge_bonus, heal_on_kill,
    high_def_mp_penalty, last_stand, momentum, ranged_defense, ranged_immune, thorns,
    wall_of_steel.
  - dodge_bonus (armor or artifact): the same DODGE_BONUS_EFFECTS rows in both pools, so
    armor and artifact dodge add up in `dodge()`. Weapons never carry it.
  - passives (armor or artifact): aether_bonus, aether_regen, aether_discount,
    aether_signet, blink_ring, breach_jewel, chaos_attune, chaos_circlet, chaos_defense,
    disengage, displacement_immune, heal, hp_bonus, mp_bonus, opportunist, ranger_defense,
    reveal_maw, revive, soul_harvest, strider, threat_shroud, vigor_bonus, vision_bonus,
    wraith_immune.
  - Inert today [P, observed]: ranged_defense and displacement_immune have no effect;
    high_def_mp_penalty applies its MP penalty but not its defBonus (Q-1).
- **Melee with a ranged weapon** deals ceil(damage / RANGED_MELEE_DIVISOR) + Might.
- **Unarmed** (no weapon): damage 1.

### Enemy types [D]

*Serves:* G-4, G-5.

- **Chaos** (`ENEMY_DEFS`, all chaosSpawned): Void Stalker (chase, also ranged), Breach
  Crawler (chase, melee), Flux Archer (kite, ranged), Phase Wraith (teleport), Breach
  Guardian (guard, melee and ranged), The Unraveler (boss, melee and ranged, a chaos
  spawn source until its first death). Stats in the table.
- **Wildlife tiers** (`generateCreatureTypes`, per run): NUM_CREATURE_TIERS tiers. Tier i
  has attack = round(CREATURE_ATTACK_BASE × 10^(i / CREATURE_ATTACK_SPAN)) and a pair of
  creatures sharing speed 1, detect range (min(CREATURE_DETECT_MAX, CREATURE_DETECT_BASE +
  floor(attack/4))), a random aggro range from CREATURE_AGGRO_MIN to detect, xp (attack ×
  CREATURE_XP_PER_ATTACK), gold (max(1, floor(attack/3))), tier, behavior, chaosSpawned
  false:
  - **melee**: hp ≈ attack × CREATURE_HP_PER_ATTACK ± jitter, defense floor(attack/4),
    spawnWeight 1, a procedural name (prefix + predator + suffix).
  - **ranged**: attack and rangedAttack = round(attack × RANGED_CREATURE_ATTACK_RATIO), hp
    ≈ attack × RANGED_CREATURE_HP_PER_ATTACK ± jitter (floor RANGED_CREATURE_HP_MIN),
    defense floor(attack/6), range from RANGED_CREATURE_BANDS by tier band (one band per
    four tiers), spawnWeight RANGED_CREATURE_SPAWN_WEIGHT, a name with a band role word.
  - behavior by tier attack (`wildlifeBehaviorFor`): wildlife below MONSTER_ATTACK,
    monster below RUINS_GUARDIAN_ATTACK, else ruins-guardian.
  - colors from a ColorTheory scheme, saturation shifted per role.
- **Spawn tier weights** (`spawnTierWeights`): weight = exp(−((tier − peak)/SPAWN_TIER_SIGMA)²)
  × spawnWeight.
- **Maw gradient**: `mawDistancePeak(q, r)` falls linearly from the top tier at the Maw to
  tier 0 at the farthest reachable hex (unreachable hexes: 0).
- **Maw proximity buff**: within MAW_PROXIMITY_FRACTION of mawMaxDist, enemies gain attack,
  defense and max HP rising linearly to MAW_PROXIMITY_ATTACK, MAW_PROXIMITY_DEFENSE,
  MAW_PROXIMITY_HP at the Maw.
- **Corrupted terrain buff**: a chaos enemy on shattered or distressed terrain gets
  +CORRUPT_DEFENSE defense, +CORRUPT_ATTACK melee and ranged attack, and heals
  CORRUPT_REGEN HP per turn up to its effective max.

### Corruption (terrain state machine) [D]

*Serves:* G-4, "Defiance against entropy".

```
base ──(chaos enemy shatters here)──▶ shattered
base ──(a shatter within SHATTER_RADIUS)──▶ distressed
distressed ──(restore pass, shatteredCount == 0)──▶ base
shattered ──(Restore / Salvage)──▶ base, or distressed if shatteredCount > 0
```
Shatter: a distressed hex under the enemy first reverts, then becomes shattered; every hex
within SHATTER_RADIUS gets shatteredCount +1 and turns distressed if it has a distressed
version. Settlements and their hexes are skipped. Special, ruins, water, mountain have no
shattered version and never shatter.

### Ruin lifecycle [D]

```
new ──search: creatures spawned──▶ spawned ──enter, none within RUIN_CLEAR_RADIUS──▶ explored (loot)
new ──search: nothing spawned──▶ new (MP → 0)
explored ──search, RUIN_RESTIR_CHANCE──▶ spawned
explored ──search, otherwise──▶ explored (MP → 0)
```
Any entry while an enemy stands within RUIN_CLEAR_RADIUS only logs "clear them first".

### Breach and Maw lifecycle [D]

```
breach open (guardian alive) ──guardian dies──▶ ready (guardianDefeated)
ready ──no guardian within GUARDIAN_PRESENCE_RADIUS, GUARDIAN_RESPAWN_CHANCE──▶ open (new guardian)
ready ──Restore in range, BREACH_SEAL_CHANCE──▶ sealed (Hills, loot)
maw (Unraveler alive) ──Unraveler killed, chaos units exist──▶ Unraveler re-forms elsewhere (noSpawn)
maw ──Unraveler gone, the Maw's current guardian dead, every breach sealed──▶ sealable
sealable ──Restore in range, MAW_SEAL_CHANCE──▶ sealed (Hills, RETURN scroll dropped)
```
The Maw also respawns Breach Guardians (like a breach) when the Unraveler is absent or
farther than UNRAVELER_LEASH from it.

---

## §4 Rules

Each rule names the code that runs it. Pseudocode uses constant names; values are in §6.

### Turn loop [D]
*Serves:* G-3.
```
loop while !gameOver and generation current:
  phase = 'player'; combatAlerted = false
  if 0 < hp < NEAR_DEATH_FRACTION * maxHP: victory.nearDeathMoments++
  await endTurn()                       # Space/E/End Turn, or auto at 0 MP
  saveGame(); phase = 'enemy'
  runEnemyAiPhase()                     # see Enemy phase; ends in advanceTurn
on exit: if gameOver, deleteSave()
```
`checkEndTurn` ends the turn whenever mp ≤ 0 in the player phase (after clicks and
dialog buttons). The End Turn command on a POI hex re-opens that POI instead (hexAction).

### Enemy phase [D]
*Serves:* G-3, G-4, G-5. (`runEnemyAiPhase`)
```
regen: hp += PLAYER_REGEN + Σheal; revive adds hp and ae; ae += Σaether_regen;
       chaos_circlet: +1 ae on chaos terrain          (all clamped to max)
tickBurns: each enemy with burnDamage takes it (no defense), burnDamage = 0
for enemy in copy(enemies) until gameOver:
  turnsSinceSpawn++; if stunnedNextTurn: clear it, skip
  aiFor(def.behavior).takeTurn(enemy)
warpShieldTurns--, reflectTurns-- (floor 0)
respawnGuardians(); spawnChaos(); spawnWildlife(); tickGarrisons(); advanceTurn()
```

### Advance turn and engagement [D]
*Serves:* G-3.
```
turn++; mp = maxMP()
if any enemy adjacent and no disengage: mp = max(1, floor(mp / ENGAGED_MP_DIVISOR))
clear movedThisTurn, hexesMovedThisTurn, phaseStep/sprint flags; dodgeSkillBonus = 0
every enemy: stunRolledThisTurn = false
```
`maxMP()` = max(1, PLAYER_MP − high_def_mp_penalty.mpPenalty + Σmp_bonus).

### Vision and fog [D]
*Serves:* G-6. (`refreshVision`, `GameWorld.updateVision`)
```
visible = hexes within player.vision() (BASE_VISION + Σvision_bonus); revealed ∪= visible
if reveal_maw equipped: reveal the Maw hex; reveal+show each chaos enemy and its neighbours
if the Unraveler stands in visible: once-only "Unraveler sighted" dialog
```
Runs after every player move or teleport and on load. Enemies are drawn only on visible
hexes; revealed hexes keep terrain and POIs.

### Line of sight [D]
`hasLOS(a, b)`: true at distance ≤ 1; otherwise step the line at each interior point,
round to a hex, and fail on any Mountain. Used by ranged attacks, ranged skills, skip
skills, and enemy fire.

### Reachability [D]
*Serves:* G-3, G-6. (`computeReachable`)
```
if mp <= 0: reachable = {}, attackable = {}
reachable = Dijkstra from player over playerMoveCost, enemy hexes = ∞, cost ≤ mp
attackable = ranged weapon ? rangedTargets() : meleeTargets()
meleeTargets = enemies adjacent to player or to any reachable hex,
               plus (blink_ring) enemies at distance 2..blinkRange
```

### Move [D]
*Serves:* G-3. (`MoveAction`)
```
legal: reachable has (q, r)
victory.distanceTraveled += distance; player to (q, r); mp -= cost
movedThisTurn = true; hexesMovedThisTurn += cost
refreshVision(); checkHexEntry(); deselect
```

### Hex entry [D]
*Serves:* "Windfall", G-2. (`checkHexEntry`)
```
if goldDeposit > 0: gold += it; deposit = 0; if crop: heal ceil(maxHP / CROP_HEAL_DIVISOR)
if skillGem: clear; grantConsolation()            # +1 SP, else CONSOLATION_XP
if magicItem: clear; inventory += rollMagicItem()
if a POI is here: open it (haven, village, hut, ruin, scroll)
```

### Melee strike and counter [D]
*Serves:* G-3. (`MeleeAction`)
```
combatAlerted = true
WeaponStrike(base = meleeDamage(target is chaos), bucket 'primary').apply(target)
if not killed and not target.stunnedNextTurn:
  c = enemyMeleeAttack(target); counter_deflect: c *= (100-pct)/100
  dealDamageToPlayer(c, attacker = target)
spend weaponMpCost(weapon)       # none 1; free_action 0; item mpCost; ranged 2; melee 1
```
`meleeDamage` = weapon damage (ranged weapon: ceil(dmg / RANGED_MELEE_DIVISOR); none: 1)
+ Might + chaos_bonus (vs chaos) + charge (if moved) + channel bonus + wall_of_steel (if
not moved).

### Move-and-attack [D]
*Serves:* G-3. (`MoveAndAttackAction`)
```
if blink_ring and 1 < dist ≤ blinkRange and a free hex next to target:
  teleport there; strike with Might + blinkBonus; if killed, step onto target hex (free)
else:
  stand on the cheapest reachable hex adjacent to target (or stay if adjacent); pay its cost
  strike; if killed and mp ≥ playerMoveCost(target hex): step onto it, pay, checkHexEntry
```

### Ranged attack [D]
*Serves:* G-3. (`RangedAction`, `computeRangedAttackable` → `visibleRangedTargets`)
```
aeCost = weapon magical and not free_ranged/channel ? (aetherCost or 1) : 0
legal: ranged weapon, aether ≥ (aeCost > 0 ? 1 : 0), target enemy visible,
       distance ≤ weaponRange(terrain, poi), LOS
RangedStrike(base = rangedDamage(dist, chaos), bucket 'other').apply(target)
aether -= aeCost (floor 0); spend weaponMpCost(weapon)
```
`weaponRange` = weapon range + TERRAIN_RANGE_BONUS + POI_RANGE_BONUS. `rangedDamage` =
weapon damage + Reflex + chaos_bonus + channel bonus (+ sniper at max range, added in the
strike).

### Strike pipeline [D]
*Serves:* "Room to break the game". (`Strike`, `WeaponStrike`, `RangedStrike`)
```
matched = held weapon kind == strike kind
dmg = base + breach_jewel (near breach/Maw) + aether_signet (at full AE; costs AE)
      + chaos_attune (on chaos terrain) [+ sniper bonus, ranged at max range]
targets = primary (hitCount from double/triple affix, or option)
  + if matched: chain/reverberate bounces, sweep neighbours, splash, piercing line
  + skill options: skillChain, skillSweep
for each target once: skillShred; preHit (defense_shred, armor_pierce);
  hitCount × dealDamageToEnemy; onHit (lifesteal, siphon, channel self-hit;
  burn, knockback if alive); skillBurn
```
Skills never provoke a counter.

### Damage to an enemy [D]
*Serves:* G-6. (`dealDamageToEnemy`)
```
rolled = Rando.bellCurve(damage)        # mean ≈ damage
def = ignoreDefense ? 0 : enemyDefense(); def = max(0, def − pierceAmount)
dealt = max(1, rolled − def); hp -= dealt; victory.damageDealt += dealt
log, sound, damage float, hit flash
rollPlayerStun(enemy, rolled, bucket, stunBonus); if hp ≤ 0: killEnemy
```
`enemyDefense` = def.defense + Maw proximity − defReduction (floor 0) + corrupted bonus.
`enemyMeleeAttack` / `enemyRangedAttack` = attack or rangedAttack + Maw proximity +
corrupted bonus.

### Stun [D]
*Serves:* G-3. (`rollPlayerStun`)
```
if no bucket, enemy dead, or stunRolledThisTurn: no roll
stunRolledThisTurn = true
pct = rolled / (bucket == 'primary' ? STUN_DIVISOR_PRIMARY : STUN_DIVISOR_OTHER) × 100
    + (primary and stun weapon ? stunBonus : 0) + skill bonus
if random < min(pct, MAX_STUN_CHANCE): stunnedNextTurn = true
```

### Damage to the player [D]
*Serves:* G-3, "Survival escalation". (`dealDamageToPlayer`)
```
if ranged and ranged_immune: avoid
if warpShieldTurns > 0 and chance(warp effectStrength / 10): avoid
if chance(dodge()): avoid            # dodge = DODGE_PER_REFLEX × Reflex + dodge_bonus summed over equipped items + dodgeSkillBonus, cap MAX_DODGE
rolled = bellCurve(damage); dealt = max(1, rolled − playerDefense())
if melee, reflectTurns > 0 and chance(reflect effectStrength / 10):
  reflected = max(1, dealt × reflectPercent%); dealt = max(1, dealt × takePercent%)
hp -= dealt; then reflect / thorns hit the attacker; burning_aura burns adjacent enemies
if hp ≤ 0: endGame(lost)
```
`playerDefense` = armor defense + floor(effectiveVigor / VIGOR_PER_DEFENSE) + floor(Might /
MIGHT_PER_DEFENSE) + terrain + POI + last_stand (≤ half HP) + momentum × hexes moved +
ranger_defense (ranger terrain) + chaos_defense and chaos_attune (chaos terrain). A
Warding-based skill-damage reduction exists but no caller uses it (Q-1).

effectiveVigor (Vigor + vigor_bonus gear) feeds max HP and defense only. Dodge reads the
Reflex stat itself; no gear raises Reflex.

**Dodge skill.** Casting Dodge (0 Aether, 'half' MP) sets dodgeSkillBonus to the rank's
effectStrength. The bonus is a term of `dodge()`, inside the MAX_DODGE cap, so it covers
the rest of the player's turn and the enemy phase; advance turn clears it. The field is
transient and not saved, although the turn-end save falls inside that window: a load
resumes in the player phase, skipping that turn's enemy phase, with no bonus up, so Dodge
can be cast again.

### Kill [D]
*Serves:* "Windfall", G-2. (`killEnemy`)
```
remove enemy
if Unraveler and any chaos unit exists: replace a random chaos unit with a new Unraveler
   (noSpawn, Maw guardianId = it); give xp; dialog; stop
victory counters; gold += rand(KILL_GOLD) + def.gold
chaos: ae += 1; heal_on_kill; gainXP(def.xp + Σsoul_harvest)
opportunist: OPPORTUNIST_CHANCE for extra gold; trySpawnSkillGem
monster or ruins-guardian: offerSettlementReward(kill hex)
crawler or guardian: CHAOS_DROP_MUNDANE mundane items + CHAOS_DROP_MAGIC_CHANCE magic item
if a breach/Maw names this enemy as guardian: guardianDefeated = true
```

### Skill gem drop [D]
```
chance = GEM_DROP_PEAK_CHANCE × 4 × t × (1 − t), t = sp / maxSP
on success: gem on a random nearest free passable non-POI hex within GEM_DROP_RADIUS,
never the kill hex or the player's hex
```

### XP and level-up [D]
*Serves:* G-2, "Windfall". (`gainXP`)
```
xp += amount
if xp ≥ xpForLevel(level+1) and level < LEVEL_CAP:
  level++; xp -= threshold; hp, aether = max
  statPoints += STAT_POINTS_PER_LEVEL; gainSP(1)
  show the level-up dialog (stat buttons; Done may leave points unspent)
```
`xpForLevel(L)` is the power curve given in Numbers, rounded to the nearest ten. One level
per gainXP call. Unspent stat points stay on the Character panel
[D].
Skills are never granted by levelling.

### Skill use [D]
*Serves:* G-2, G-3. (`activateSkill`, `SkillAction`)
```
legal: phase 'player', not over; skill active (hotbar slot, or panelInvoke from panel);
       aether ≥ effectiveAetherCost; checkSkillUsage passes
RETURN: confirm dialog → endGame(won)
self / aoe_self: execute now; else targeting = getSkillTargets() (must be non-empty)
         ranged: target enemy visible, in range and LOS, as for weapon shots
execute: melee skill out of reach → step to cheapest adjacent reachable hex, pay it
         aether -= cost; combatAlerted = true; run handler
         unless the handler returned false: spend effectiveSkillMpCost
```
A handler that aborts may refund the Aether (Recall with no haven, Sanctuary or Garrison on
a bad hex, Haven's Light away from a settlement).

### Restore and sealing [D]
*Serves:* G-1, G-4. (`executeRestore`)
```
range = RESTORE_BASE_RANGE + floor(level / RESTORE_LEVELS_PER_RANGE)
shattered = shattered hexes in range
breach = an unsealed breach (or the Maw if Unraveler gone and no breach open)
         in range with guardianDefeated
Maw in range but blocked: once-only dialog (Unraveler alive, or open breaches → reveal them)
if no shattered and no breach: abort (no MP spent)
restore hexes; ae += min(deficit, n); per hex RESTORE_GOLD_CHANCE for 1 gold
gainXP(n × RESTORE_XP_PER_HEX); offerSettlementReward(restored hexes)
if breach: chance(Maw ? MAW_SEAL_CHANCE : BREACH_SEAL_CHANCE) → closeBreach, else "failed"
```
`closeBreach`: closed = true, breachesClosed++, hex → Hills, victory.breachesSealed++;
a breach gives loot (BREACH_LOOT_GOLD range + unowned mundane items + 1 magic, as `rollPoiLoot`); the Maw drops
the RETURN scroll on a free reachable hex within MAW_SCROLL_RADIUS.

### Restoring terrain [D]
(`restoreShatteredHexes`, shared by Restore and Salvage)
```
each restored hex → base terrain
each hex within SHATTER_RADIUS of a restored hex: shatteredCount -= 1 (floor 0)
  if count == 0 and distressed → base
restored hex with count > 0 → distressed
```

### Enemy shattering [D]
*Serves:* G-4. (`tryTerrainShatter`, after each chaos enemy's turn)
```
if chaos and chance(SHATTER_CHANCE):
  under the enemy: distressed → base; if it has a shattered version and isn't a settlement:
    → shattered; each hex within SHATTER_RADIUS (not a settlement):
      shatteredCount++, base → distressed
```

### Guardian respawn [D]
```
for each unsealed breach or Maw:
  Maw: skip while the Unraveler lives within UNRAVELER_LEASH
  skip if a Breach Guardian is within GUARDIAN_PRESENCE_RADIUS or the hex is occupied
  chance(GUARDIAN_RESPAWN_CHANCE): spawn guardian on the POI; guardianId = it;
    guardianDefeated = false
```

### Chaos spawning [D]
*Serves:* "Escalating Commitment". (`spawnChaos`, `chaosSpawnSources`)
```
sources = every open breach
        + the Maw while unsealed (whatever has happened to the Unraveler)
        + the Unraveler unless noSpawn (the original, until its first death)
none → none
once a turn: chance(CHAOS_SPAWN_CHANCE) →
  source = uniform draw from sources
  breach or Maw, and em.chaosMight() ≥ CHAOS_MIGHT_CAP: none
  pool = CHAOS_SPAWN_POOL (drop the wraith when wraiths ≥ WRAITH_CAP)
  one pool enemy on nearestFreeHex(source)
  home: the breach for a breach spawn; its own spawn hex for a Maw or Unraveler spawn
  Unraveler spawn: log log_unraveler_spawns (breach and Maw spawns are silent)
```
The one roll covers the whole map, so the spawn rate stays the same as breaches are sealed
and falls on fewer sources, ending at the Maw. Every source has equal weight; while the
original Unraveler lives, it and the Maw are two entries. The Unraveler searches outward
from wherever it stands and ignores the might cap; a breach or the Maw stays in the draw at
the cap, and a draw that lands on one then spawns nothing that turn. The Unraveler leaves the
draw at its first death, whether or not it re-forms; the Maw carries on as a capped source
until it is sealed, so with every breach sealed and the Unraveler slain once, every
successful roll lands on the Maw. Once the Maw is sealed there are no sources.
`nearestFreeHex(source)`: search outward from the source over passable hexes, a step at a
time, walking through occupied ones; take a random hex among the nearest free ones (passable
and unoccupied), never the source itself. A crowded source spawns further out; if no free hex
can be reached, nothing spawns.
`chaosMight` / `wildlifeMight` = Σ def.attack over chaos / wildlife enemies.

### Wildlife spawning and packs [D]
*Serves:* G-5. (`spawnInitialCreatures`, `spawnWildlife`, `pickSpawnPack`, `spawnPack`)
```
initial: until wildlifeMight ≥ WILDLIFE_MIGHT_CAP or no candidates: pick a random hex
  (not visible, not POI, not shattered, farther than SPAWN_SAFE_DISTANCE from player); spawn a pack
per turn: if wildlifeMight < cap and chance(WILDLIFE_SPAWN_CHANCE): one pack at a random such hex
pack: type = weighted(spawnTierWeights(creatureDefs, mawDistancePeak(hex)))
      size = max(1, ceil(bellCurve(player.meleeDamage(false)) / def.attack))
      first at hex, rest on free hexes within PACK_RADIUS, adjacent first
```

### Initial chaos placement [D]
(`spawnInitial`) INITIAL_STALKERS Void Stalkers and INITIAL_ARCHERS Flux Archers on random
passable hexes farther than INITIAL_SAFE_DISTANCE from the player; the Unraveler on the
Maw; a Breach Guardian on each breach plus BREACH_CRAWLERS crawlers within
BREACH_CRAWLER_RADIUS.

### Ruin search [D]
*Serves:* "Living map", "Windfall". (`tryRuinInteraction`, `spawnRuinCreatures`)
```
on entry: if any enemy within RUIN_CLEAR_RADIUS: log, stop
new: Search → spawn; if nothing spawned, mp = 0
spawned: loot → explored, ruinsExplored++, rollPoiLoot(RUIN_LOOT_GOLD), Continue: mp = 0
explored: Search → chance(RUIN_RESTIR_CHANCE) spawn, else nothing; if nothing, mp = 0
spawn: peak = min(top tier, mawDistancePeak + RUIN_TIER_BIAS); fill free hexes within
       RUIN_CLEAR_RADIUS until Σattack ≥ level × RUIN_MIGHT_PER_LEVEL; any → 'spawned'
```
`rollPoiLoot`: gold in range, mundane items the player doesn't own (the poi loot mundane
count in Numbers), 1 magic item.

### Haven visit [D]
*Serves:* G-3, "Windfall".
```
first visit to this haven: gainSP(1)
Rest: hp, aether = max; mp = 0
Weaponsmith / Magicsmith: shop (Done: mp = 0); Train: Train dialog (Done: mp = 0); Leave: free
```

### Village visit and Sanctuary [D]
```
village entry: chance(VILLAGE_CROP_CHANCE) a crop (gold in CROP_GOLD) sprouts adjacent
Rest: heal floor(maxHP × VILLAGE_REST_FRACTION) hp and ae likewise; mp = 0
Weaponsmith: mundane shop; Leave: free
Sanctuary skill (non-POI hex, not distressed): crop chance on self, rest with fraction 1 / effectStrength
every rest caps hp and ae at their maximums and logs the amounts
```

### Hut visit [D]
*Serves:* G-2, "Living map". (`showHutDialog`; `showHutMenu` is the one place the dialog opens)
```
first visit to this hut: gainSP(1)
fresh = hut.rolledTurn ≠ turn; hut.rolledTurn = turn   # the two chances roll once per hut per turn
if fresh and chance(HUT_GIFT_CHANCE): a magic item, hut unchanged; stop
if hut.skill unknown: offer it
else if fresh and chance(HUT_REROLL_CHANCE) and an obtainable skill exists: hut.skill = it; offer it
else: "nothing to teach"
buttons, stacked top to bottom: Learn (only when a skill is offered), Rest, Train, Leave
Learn: learnSkill (latent unless freeAttune); mp = 0
Rest: heal max(1, floor(maxHP × HUT_REST_HP_FRACTION)) hp and
      ceil(maxAether × HUT_REST_AE_FRACTION) ae, each capped at max; mp = 0.
      Always available and unlimited; no crop chance; an offered skill stays for the next visit
Train: Train dialog.  Leave: free
```

### Scroll pickup [D]
```
throw if the scroll has no skill or the skill is known
remove the scroll; learnSkill(skill, active if free SP > 0); dialog
```

### Shops [D]
*Serves:* G-2. (`showShopDialog`)
```
on open: chance(SHOP_NEW_ITEM_CHANCE) add a fresh magic item to this POI's stock
list stock items not owned and matching the smith (weaponsmith: mundane; magicsmith: magic)
magicsmith also lists unbought shopOnly skills at shopPrice
buy: gold ≥ price → gold -= price, item to inventory (stock remains)
sell: only items of the smith's kind, for sellPrice = max(1, floor(price × SELL_PRICE_RATIO))
each sell row also has Equip: equipFromInventory(item), clamp HP/AE, redraw (no new-stock roll); free
weaponsmith: Sell All mundane.  Done: mp = 0
```

### Train [D]
*Serves:* G-2, G-3. (`showTrainDialog`; at havens, huts, or via Retrain)
```
list learned non-freeAttune skills: latent | trained (with rank)
→ on latent: needs freeSP ≥ 1 → active at rank 1
→ on active tiered, rank < SKILL_MAX_RANK: needs freeSP ≥ rank+1 → rank++
← on active: rank > 1 → rank--; rank 1 → latent (cleared from hotbar)
Done: mp = 0
```

### Skill Seek and consolation [D]
```
Skill Seek: chance(effectStrength %) → offer up to SKILL_SEEK_OFFERS from poolSkills; pick one
            (latent); empty pool → grantConsolation
grantConsolation: gainSP(1) if below maxSP, else gainXP(CONSOLATION_XP)
```

### Settlement reward [D]
*Serves:* G-4, "Defiance against entropy". (`offerSettlementReward`)
```
first haven/village within SETTLEMENT_REWARD_RADIUS of any origin hex:
  dialog offering rand(SETTLEMENTS[type].reward) gold; Accept: gold += it,
  settlementsRestored++. At most one offer per call.
```
Called for restored hexes (Restore) and for monster / ruins-guardian kills.

### Garrisons [D]
*Serves:* G-4. (`executeGarrison`, `tickGarrisons`)
```
commission: gold ≥ goldCost, no POI here, passable, a haven or village visible
  → gold -= goldCost; POI garrison_build here
each turn: each build: chance(GARRISON_BUILD_CHANCE) → garrison, garrisonsCompleted++
           each garrison: kill (killEnemy, byGarrison) a random nearest chaos enemy within
           GARRISON_KILL_RANGE
```
Garrison kills give the player the normal kill rewards.

### New game [D]
*Serves:* G-1, G-2. (`initGame`)
```
stop old loop; reset state and ALL_EQUIPMENT; world.generate()
start = farthest settlement from the Maw not on hills
new SkillLibrary; placeCoreScrolls(start); STORY_SCROLL_SKILLS empty story scrolls
player = new Player(start); deal(storyScrolls, huts, learned); drop unfilled scrolls
refreshVision; computeMawDistances; creature tiers; spawnInitial; spawnInitialCreatures
assign sprites; deleteSave(); gameLoop()
```

### Save, continue, version [D]
```
saveGame at each player-turn end (before the enemy phase)
saveIsCurrent = a save exists and its version == SAVE_VERSION
intro: Continue enabled iff saveIsCurrent; label "New Version" when a save exists but isn't
Continue → loadGame: restore registry, classes, sprites; computeMawDistances; refreshVision
```
Bump SAVE_VERSION by 1 on any change that breaks old saves; never migrate.

### Victory and defeat [D]
*Serves:* G-1. (`endGame`)
```
won: RETURN confirmed.  lost: hp ≤ 0 (enemy hit, counter, or channel self-damage)
gameOver = true; endgame overlay: turns, level, victory.breakdown(), score; New Game
```

---

## §5 Agents (enemy AI)

*Serves:* G-5, G-3. Enemy AI (`enemy_ai.js`) acts under the same movement, LOS and
damage rules as the player. It reaches game state only through `enemyAiCtx`. One AI
object per behavior bucket, picked by `aiFor(def.behavior)`: wildlife → WildlifeAI,
monster → MonsterAI, ruins-guardian → RuinsGuardianAI, anything else → ChaosAI.

### Information limits [D]

- Enemies know the player's exact position at all times. Aggro is a pure distance check
  (no fog, no LOS). Firing needs LOS. [D]
- Aggro range = aggroRange or detectRange; −THREAT_SHROUD_REDUCTION (floor 1) with
  threat_shroud. Forest stealth: the player in forest lowers it by FOREST_STEALTH
  (floor 1), and Phase Wraiths lose aggro entirely, unless combatAlerted and the enemy is
  within ALERT_RADIUS.
- Enemies read each other's positions (occupied set) and their own home.
- Enemies don't read the player's HP, gear, or skills.

### Shared moves [D]

- **Alarm** (`soundAlarm`): an aggroed enemy sets its target to the player's hex and sets
  the same target on every enemy within ALARM_RADIUS.
- **Hunt** (`tryHuntTarget`): with a target, step toward it by A*; within
  HUNT_COLD_RADIUS the target clears.
- **Aggro chase** (`tryAggroChase`, wildlife buckets): if in aggro, alarm; a ranged
  creature with a shot (distance > 1, ≤ range, LOS) fires and holds; otherwise step toward
  the player avoiding shattered hexes, and melee if adjacent.
- **Enemy melee** (`doEnemyMelee`): every melee attack an enemy makes on its own turn,
  from any AI, goes through this one rule:
  ```
  dealDamageToPlayer(enemyMeleeAttack(enemy), attacker = enemy)
  for each reply in MELEE_REPLIES, in order:
    stop if player.hp ≤ 0 or enemy.hp ≤ 0
    if the player wears reply.special: run it
  ```
  Every reply is one strike (`runMeleeReply`), differing only in its strength:
  ```
  rolled = bellCurve(weapon damage, or 1 unarmed, + Might)
  dealt = max(1, strength(rolled) − enemyDefense); enemy.hp -= dealt; killEnemy at hp ≤ 0
  ```
  The replies, in order: **counter_mastery**, strength = rolled; then **riposte**,
  strength = floor(rolled / RIPOSTE_DIVISOR) + the weapon's riposteDamage. A player with
  both gets both, riposte only if the enemy survived counter_mastery. A reply runs
  whether the hit landed or was avoided (dodge, Warp Shield). Enemy ranged attacks run no
  replies, and neither does the enemy's counter to the player's own melee strike.
- **Movement limits**: passable, unoccupied, not the player's hex, not a haven, village or
  garrison (a swarm's goal hex excepted). Wildlife never wanders or chases onto shattered
  hexes; hunting a target by A* can cross them.

### WildlifeAI [D]
```
aggro chase → else hunt target → else chance(WILDLIFE_WANDER_CHANCE) wander
```

### MonsterAI [D]
```
aggro chase → else hunt target
→ else nearest settlement within MONSTER_LURK_RADIUS: wander (lurk)
→ else within aggro × SETTLEMENT_HUNT_FACTOR: step toward it → else wander
```

### RuinsGuardianAI [D]
```
aggro chase
→ else nearest ruin within RUIN_PATROL_RADIUS: chance(RUIN_PATROL_CHANCE) patrol around it
→ else within aggro × SETTLEMENT_HUNT_FACTOR: step toward it
→ else chance(GUARDIAN_WANDER_CHANCE) wander
```

### ChaosAI [D]
```
heal CORRUPT_REGEN on corrupted terrain; compute aggro (stealth rules above)
teleport (Phase Wraith, in aggro, no wraith_immune, chance teleportChance):
  jump to a free passable non-settlement hex within teleportRange of the player
prefersRanged = ranged chaser and chance(CHASER_RANGED_PREFERENCE)
if in aggro: alarm
move: not guard, not aggro → hunt target or swarm; else up to speed steps by behavior
attack: kite fires with chance KITE_FIRE_CHANCE if it has a shot;
        others melee if adjacent, else guard/boss/prefersRanged fire if they have a shot
then: terrain shatter
```
Step by behavior: **guard** returns home beyond guardRadius, else steps toward the player
only while staying within guardRadius; **kite** backs off under KITE_MIN_DIST, closes
beyond KITE_MAX_DIST, else holds, and wanders (chance WANDER_CHANCE) out of aggro;
**boss** steps toward the player in aggro; **chase** steps toward the player in aggro
unless prefersRanged, else wanders (WANDER_CHANCE). A chaos enemy's melee is the shared
enemy melee rule above.

**Swarm** (`trySwarmTrigger`): with SWARM_ALLIES or more chaos allies within
SWARM_RADIUS, pick one of the nearest settlements by SWARM_WEIGHTS and hunt toward it.
The Unraveler swarms too.

### Commitment [D]
Alarm and swarm targets persist across turns (saved on the enemy) until the enemy comes
within HUNT_COLD_RADIUS of them. Guards never hunt or swarm. Stunned enemies skip their
whole turn.

---

## §6 Numbers [T]

Every tunable number, by code name. A row whose name is an upper-case constant or a function
is defined under that name in the file its Code column gives. A row named in lower case
(the magic item price, the enemy animation delays) has no constant: it is a
literal or formula written in place in the function it cites.
Content-table numbers (each skill's tiers and costs, each item's stats, each fixed enemy's
stats, effect magnitudes) stay in `SKILLS`, `WEAPONS`, `ARMORS`, the effect pools and
`ENEMY_DEFS`. Decisions about these numbers, as they are written up, live in DECISIONS.md.

| Name | Value | Unit | Code |
|---|---|---|---|
| HEX_SIZE | 24 | px | config.js |
| MAP_COLS × MAP_ROWS | 100 × 100 | hexes | config.js |
| HEIGHTMAP_SIZE / HEIGHTMAP_ROUGHNESS | 129 / 0.55 | | config.js; used in world._generateRectGrid |
| WATER_PCT / PLAINS_PCT / HILLS_PCT | 0.25 / 0.85 / 0.95 | elevation percentile | config.js; used in world._assignTerrain |
| FOREST_SHARE | 0.10 | of interior | config.js; used in world._assignTerrain |
| QUARRY_SHARE / QUARRY_MIN | 0.02 / 2 | of interior / hexes | config.js; used in world._assignTerrain |
| PRIZE_SHARE | 0.01 | of interior, split 3 ways | config.js; used in world._placeSpecialHexes |
| PRIZE_WEIGHTS | gold 7, gem 2, magic item 1 | weight | config.js; used in world._placePrizes |
| PRIZE_GOLD | 10-20 | gold | config.js; used in world._placePrizes |
| MAP_ATTEMPTS | 20 | tries | config.js; used in world.generate |
| POI_MIN_DIST | 10 | hexes | config.js; used in world._placePOIs |
| HAVEN_COUNT / VILLAGE_COUNT / RUIN_COUNT / BREACH_COUNT | 4-6 / 8-12 / 12-20 / 6-8 | | config.js; used in world._placePOIs |
| HUT_COUNT | 12 | huts | world.js |
| HAVEN_MAGIC_STOCK / HAVEN_MUNDANE_STOCK / VILLAGE_STOCK | 2-3 / 2-3 / 2-3 | items | config.js; used in world shop generators |
| BASE_VISION | 6 | hexes | config.js |
| PLAYER_MP | 4 | MP | config.js |
| STARTING_STATS | might 3, reflex 3, warding 2, vigor 3 | | config.js |
| maxHP(vigor) | 50 + 10 × vigor | HP | config.js |
| maxAether(warding) | 5 + 2 × warding | AE | config.js |
| STAT_POINTS_PER_LEVEL | 3 | points | config.js |
| xpForLevel(L) | round(50 × L^1.8 / 10) × 10 | XP to reach level L | config.js |
| LEVEL_CAP | 10 | level | config.js; used in index.gainXP |
| VIGOR_PER_DEFENSE / MIGHT_PER_DEFENSE | 3 / 5 | stat per +1 def | config.js; used in player.defense |
| DODGE_PER_REFLEX | 2 | % per Reflex | config.js; used in player.dodge |
| MAX_DODGE | 90 | % | config.js |
| Dodge skill bonus by rank | 20 / 30 / 40 / 50 / 60 | % dodge | config.js (`SKILLS.dodge.tiers`) |
| DODGE_MP_DIVISOR | 2 | | config.js; a 'half' MP cost spends floor(current MP / this) |
| MAX_STUN_CHANCE | 90 | % | config.js |
| STUN_DIVISOR_PRIMARY / STUN_DIVISOR_OTHER | 40 / 60 | damage per 100% | config.js |
| RANGED_MELEE_DIVISOR | 4 | | config.js; used in player.meleeDamage |
| RIPOSTE_DIVISOR | 2 | | config.js; used in the riposte melee reply (enemy_ai.js) |
| STARTING_SP / MAX_SP | 5 / 50 | SP | config.js; used in Player constructor |
| SKILL_SLOTS | 5 | slots | index.js |
| SKILL_MAX_RANK | 5 | rank | config.js |
| SKILL_SAFE_RADIUS | 2 | hexes | config.js; used in index.checkSkillUsage |
| SKILL_HELD_OUT_FRACTION | 0.5 | | skilllibrary.js |
| STORY_SCROLL_SKILLS | 6 | scrolls | skilllibrary.js |
| CHANNEL_SCROLL_RADIUS / NEAR_CORE_SCROLL_RADIUS | 11 / 50 | hexes | skilllibrary.js |
| HUT_GIFT_CHANCE / HUT_REROLL_CHANCE | 0.02 / 0.02 | per hut per turn | config.js; used in index.js |
| HUT_REST_HP_FRACTION / HUT_REST_AE_FRACTION | 0.25 / 0.5 | of max (hp floored, min 1; ae rounded up) | config.js; used in index.js |
| SKILL_SEEK_OFFERS | 3 | skills | config.js; used in index.showSkillChoiceDialog |
| CONSOLATION_XP | 10 | XP | index.js |
| GEM_DROP_PEAK_CHANCE | 0.25 | | index.js |
| GEM_DROP_RADIUS | 5 | hexes | config.js; used in index.trySpawnSkillGem |
| SELL_PRICE_RATIO | 0.4 | | config.js |
| SHOP_NEW_ITEM_CHANCE | 0.03 | per shop open | config.js; used in index.showShopDialog |
| MAGIC_DAMAGE / MAGIC_RANGE / MAGIC_DEFENSE | 2-6 / 3-5 / 2-6 | | config.js; used in config.rollMagicItem |
| magic item price | melee (dmg+1)×60×value; ranged (dmg+range+1)×30×value; armor (def+1)×60×value; artifact (two rolls of 0-100, summed)×value | gold | config.rollMagicItem |
| KILL_GOLD | 1-5 (+ def.gold) | gold | config.js; used in index.killEnemy |
| OPPORTUNIST_CHANCE / opportunist gold | 0.25 / 3-8 | chance / gold | config.js (the chance); both used in index.killEnemy, the gold range a literal there |
| CHAOS_DROP_MUNDANE / CHAOS_DROP_MAGIC_CHANCE | 0-3 / 0.10 | | config.js; used in index.killEnemy |
| RUIN_LOOT_GOLD / BREACH_LOOT_GOLD | 5-20 / 50-100 | gold | config.js; used in index.js |
| poi loot mundane count | 1-3 | items | index.rollPoiLoot |
| RUIN_CLEAR_RADIUS | 2 | hexes | config.js; used in index.ruinEnemiesNearby |
| RUIN_TIER_BIAS | 2 | tiers | index.js |
| RUIN_MIGHT_PER_LEVEL | 10 | attack per level | config.js; used in index.spawnRuinCreatures |
| RUIN_RESTIR_CHANCE | 0.10 | per search | config.js; used in index.tryRuinInteraction |
| SETTLEMENT_REWARD_RADIUS | 3 | hexes | config.js; used in index.offerSettlementReward |
| SETTLEMENTS reward | haven 5-20, village 1-10 | gold | index.js |
| VILLAGE_REST_FRACTION | 0.5 | of max | config.js; used in index.showVillageDialog |
| VILLAGE_CROP_CHANCE / CROP_GOLD | 0.25 / 1-3 | | config.js; used in index.trySpawnVillageCrop |
| CROP_HEAL_DIVISOR | 10 | maxHP / n | config.js; used in index.eatCrop |
| SETTLEMENT_MOVE_COST | 1 | MP | config.js; used in index.playerMoveCost |
| ENGAGED_MP_DIVISOR | 2 | | config.js; used in index.advanceTurn |
| NEAR_DEATH_FRACTION | 0.10 | of max HP | config.js; used in index.startPlayerTurn |
| PLAYER_REGEN | 1 | HP per turn | config.js; used in enemy_ai.regenPlayerAtPhaseStart |
| RESTORE_BASE_RANGE / RESTORE_LEVELS_PER_RANGE | 1 / 3 | | config.js; used in actions.executeRestore |
| RESTORE_GOLD_CHANCE / RESTORE_XP_PER_HEX | 0.16 / 3 | | config.js; used in actions.executeRestore |
| BREACH_SEAL_CHANCE / MAW_SEAL_CHANCE | 0.40 / 0.20 | per Restore | config.js; used in actions.executeRestore |
| MAW_SCROLL_RADIUS | 3 | hexes | config.js; used in index.sealMaw |
| prospect strike chance / strike radius / deposit | 0.2 / 4 / 10 | per cast / hexes / gold | actions.executeProspect |
| salvage gold per hex | 1-10 | gold | actions.executeSalvage |
| ground weeps threat radius | 3 | hexes | actions.executeGroundWeeps |
| GARRISON_BUILD_CHANCE / GARRISON_KILL_RANGE | 0.10 / 5 | per turn / hexes | index.js |
| SHATTER_CHANCE / SHATTER_RADIUS | 0.02 / 3 | per chaos turn / hexes | config.js; used in enemy_ai.tryTerrainShatter |
| CORRUPT_DEFENSE / CORRUPT_ATTACK / CORRUPT_REGEN | 2 / 3 / 1 | | config.js; used in index.enemyDefense/Attack, ChaosAI |
| MAW_PROXIMITY_FRACTION | 0.5 | of mawMaxDist | config.js; used in enemy_ai.mawProximityBonus |
| MAW_PROXIMITY_ATTACK / MAW_PROXIMITY_DEFENSE / MAW_PROXIMITY_HP | 20 / 10 / 20 | at the Maw | config.js; used in enemy_ai.mawProximityBonus |
| NUM_CREATURE_TIERS | 12 | tiers | enemies.js |
| CREATURE_ATTACK_BASE / CREATURE_ATTACK_SPAN | 3 / 11 | atk = base × 10^(i/span) | config.js; used in enemies.generateCreatureTypes |
| CREATURE_DETECT_BASE / CREATURE_DETECT_MAX / CREATURE_AGGRO_MIN | 4 / 7 / 3 | hexes | config.js; used in enemies.generateCreatureTypes |
| CREATURE_XP_PER_ATTACK / CREATURE_HP_PER_ATTACK | 2 / 4 (±3) | | config.js; used in enemies.generateCreatureTypes |
| RANGED_CREATURE_ATTACK_RATIO / RANGED_CREATURE_HP_PER_ATTACK / RANGED_CREATURE_HP_MIN | 0.75 / 2.5 (±2) / 4 | | config.js; used in enemies.rangedCreatureDef |
| RANGED_CREATURE_SPAWN_WEIGHT | 0.25 | | enemies.js |
| RANGED_CREATURE_BANDS | ranges 2 / 3 / 4, four tiers each | hexes | enemies.js |
| MONSTER_ATTACK / RUINS_GUARDIAN_ATTACK | 20 / 30 | attack | config.js; used in enemies.wildlifeBehaviorFor |
| SPAWN_TIER_SIGMA | 2 | tiers | config.js; used in enemies.spawnTierWeights |
| WILDLIFE_MIGHT_CAP / WILDLIFE_SPAWN_CHANCE | 1000 / 0.20 | attack sum / per turn | config.js; used in enemies.js |
| SPAWN_SAFE_DISTANCE / PACK_RADIUS | 6 / 2 | hexes | config.js; used in enemies.js |
| INITIAL_STALKERS / INITIAL_ARCHERS / INITIAL_SAFE_DISTANCE | 2d4 / 1d3 / 5 | | config.js; used in enemies.spawnInitial |
| BREACH_CRAWLERS / BREACH_CRAWLER_RADIUS | 1-2 / 2 | | config.js; used in enemies.spawnInitial |
| CHAOS_MIGHT_CAP / CHAOS_SPAWN_CHANCE | 500 / 0.5 | attack sum / one roll per turn | config.js; used in enemy_ai.spawnChaos |
| CHAOS_SPAWN_POOL | stalker ×3, archer ×2, crawler ×1, wraith ×1 | repeats in a uniform draw | config.js; used in enemy_ai.chaosSpawnPool |
| WRAITH_CAP | 10 | wraiths | config.js; used in enemy_ai.js |
| GUARDIAN_RESPAWN_CHANCE / GUARDIAN_PRESENCE_RADIUS | 0.3 / 3 | per turn / hexes | config.js; used in enemy_ai.respawnGuardians |
| UNRAVELER_LEASH | 11 | hexes | config.js; used in enemy_ai.respawnGuardians |
| FOREST_STEALTH / THREAT_SHROUD_REDUCTION / ALERT_RADIUS | 2 / 2 / 5 | hexes | config.js; used in enemy_ai.js |
| ALARM_RADIUS / HUNT_COLD_RADIUS | 2 / 3 | hexes | config.js; used in enemy_ai.js |
| WILDLIFE_WANDER_CHANCE / WANDER_CHANCE / GUARDIAN_WANDER_CHANCE | 0.3 / 0.5 / 0.5 | | config.js; used in enemy_ai.js |
| MONSTER_LURK_RADIUS / RUIN_PATROL_RADIUS / RUIN_PATROL_CHANCE | 2 / 2 / 0.3 | | config.js; used in enemy_ai.js |
| SETTLEMENT_HUNT_FACTOR | 2 | × aggro | config.js; used in enemy_ai.js |
| CHASER_RANGED_PREFERENCE / KITE_FIRE_CHANCE | 0.5 / 0.5 | | config.js; used in enemy_ai.js |
| KITE_MIN_DIST / KITE_MAX_DIST | 2 / 3 | hexes | config.js; used in ChaosAI.moveEnemyStep |
| SWARM_ALLIES / SWARM_RADIUS / SWARM_WEIGHTS | 5 / 3 / 20, 10, 5, 5 | | config.js; used in ChaosAI swarm |
| enemy animation delays | 80 move / 100 teleport / 150 attack | ms | enemy_ai.js (`ctx.animDelay` calls) |
| SLIDE_MS / FLOAT_MS | 90 / 420 | ms | fx.js |
| HIT_FLASH_MS | 100 | ms | index.js |
| DRAG_THRESHOLD | 4 | px | index.js |
| LOG_FADE_MS | 4500 | ms | index.js |
| TURN_METRICS_CAP | 1000 | turns | index.js |
| SAVE_VERSION | 4 | | index.js |
| Victory.WEIGHTS | per counter | points | victory.js |

---

## §7 Commands and events (the interface)

There is no formal command API. The de facto commands are the input handlers and dialog
buttons in `index.js`, which build `Action` objects (`actions.js`) with `actionCtx`.
Commands return nothing; an illegal command is a no-op, sometimes with a log line. [P:
formalized from the code]

### Commands

| Command (trigger) | Legal when | Effect | Side effects |
|---|---|---|---|
| selectPlayer (click own token) | phase 'player', not over | selected; computeReachable | highlights |
| deselect (click own token / elsewhere, Esc) | | clears selected, reachable, attackable | Esc also closes panels |
| move(q, r) (click reachable hex) | selected, reachable has hex | MoveAction | vision, hex entry, may open POI; auto end at 0 MP |
| moveAndAttack(q, r) (click attackable, melee weapon; or A then click) | in attackable / melee targeting set | MoveAndAttackAction | counter; kill rewards; may step onto hex |
| rangedAttack(q, r) (click attackable, ranged weapon; or R then click) | ranged targeting rules | RangedAction | AE tax (magic weapons); weapon MP |
| activateMelee (A) | phase 'player'; some melee target | targeting '__melee__' | |
| activateRanged (R, ranged slot) | ranged weapon; AE for tax; a target | targeting '__ranged__' | log when none |
| activateSkill(id) (keys 1-SKILL_SLOTS, slot click, Skills panel "use") | see Skill use | execute now, or targeting | logs reason when blocked |
| executeSkill(id, q, r) (click while targeting) | hex in validHexes | SkillAction | AE, MP, per-skill effects |
| cancelTargeting (right-click, Esc, click outside set) | targeting set | targeting = null | |
| endTurn / hexAction (Space, E, End Turn button) | phase 'player', not over | on a POI hex: re-open its dialog; else end turn | save; enemy phase |
| dismissOverlay (click, Space, Esc) | threat overlay or world map shown | hides it | |
| haven: Rest / Weaponsmith / Magicsmith / Train / Leave | on a haven | see Haven visit | Rest: mp = 0 |
| village: Rest / Weaponsmith / Leave | on a village | see Village visit | Rest: mp = 0 |
| hut: Learn / Rest / Train / Leave | on a hut; Learn only when a lesson is offered | see Hut visit | Learn, Rest: mp = 0; Leave: free |
| ruin: Search / Leave / Continue | on a ruin, none within RUIN_CLEAR_RADIUS | see Ruin search | may spawn; mp = 0 |
| shop: Buy item / Buy skill / Sell / Sell All / Done | shop open, gold ≥ price | see Shops | Done: mp = 0 |
| train: → / ← / Done | Train open | see Train | Done: mp = 0 |
| level-up: + stat / Done | statPoints > 0 for + | stat +1, statPoints −1; clamp HP/AE | |
| character panel: + stat | statPoints > 0 | same as level-up + | |
| skill choice: pick | Skill Seek offer open | learnSkill (latent) | |
| settlement reward: Accept / Decline | offer open | gold, settlementsRestored | |
| RETURN: Return / Cancel | RETURN activated | endGame(won) | |
| equip / unequip item (Inventory panel) | player phase only, game not over [D]; emptying the weapon slot allowed [D]. The buttons render disabled outside the player phase | swap slot ↔ inventory; clamp HP/AE | free: no MP |
| equip item (a smith's sell list) | shop dialog open | same swap as the Inventory panel's Equip (`equipFromInventory`); clamp HP/AE; the shop redraws | free: no MP |
| equip / unequip skill slot (Skills panel) | skill active | first empty slot, else the last slot | free |
| newGame (intro New Game; HUD New Game with confirm; endgame New Game) | always | initGame | deletes save |
| continue (intro) | saveIsCurrent | loadGame | |
| panels C / S / I, world map M, pan (drag past DRAG_THRESHOLD) | phase not 'dialog' for keys | view only | |

### Read-only queries

| Query | Returns | Notes |
|---|---|---|
| computeReachable / reachable | Map hexKey → cost | Same function the move command uses. |
| computeAttackable / attackable | Set hexKey | Melee or ranged by held weapon. |
| getSkillTargets(id) | Set hexKey | Per SKILL_TARGET kind. Ranged-skill enemy targets must be visible and in LOS, through the same check as weapon shots (`visibleRangedTargets`) [D]. Ranged-AoE, Phase Step and the skip skills pick visible hexes; melee kinds pick adjacent enemies. |
| checkSkillUsage(skill) | null or reason text | Drives skill-bar dimming and blocks activation. |
| effectiveAetherCost, effectiveSkillMpCost, skillCostLabel | numbers / label | Same functions as execution. |
| SKILL_POWER / powerLine / skillSummary | expected single-hit score, factors text | The score comes from the skill's `SKILL_FORMULAS` entry in actions.js, the function its handler also calls. SKILL_POWER holds only the factors text (area, hit count, riders); Restore has factors text and no score. |
| threat overlay (Ground Weeps) | Map hexKey → threat | Σ enemyMeleeAttack × (4 − d)/3 for enemies within 3. |
| compareToEquippedHtml, itemStatLine, itemSpecialText | item comparison text | Inventory and shops. |
| Character panel derived | attack, defense, dodge, vision, MP | Calls the Player methods. |
| context bar (hover) | terrain name; visible enemy name and HP | |
| saveIsCurrent, hasSave | bool | Intro buttons. |

### Events (what the player is shown)

| Event | Fields | Who sees it |
|---|---|---|
| log line (`logCombat(msg, cls)`) | text from `say()`; cls log-dmg, log-heal, log-info, log-gold, log-xp | Always, except garrison lines, which log only when the garrison or its target is visible. |
| damage float | hex, amount; enemy or player colour | On the hit hex. |
| gain float | +HP / +AE over a token | The player's rises during the player phase are totalled per stat and float once, "+N", when the turn ends; the player's rises outside that phase, and every enemy's, float when HP or AE rises between frames. |
| hit flash | hex | On the hit hex. |
| token slide | entity, from → to | Any drawn token; jumps beyond SLIDE_MAX_JUMP appear. |
| enemy-phase pacing | animDelay per move / attack | Only for enemies visible and on screen. |
| sound | tick (move), hitEnemy, hitPlayer, killEnemy, victory(scale) | Always. |
| dialog | title, body, buttons | Modal; phase 'dialog'. Once-only dialogs keyed in seenDialogs. |
| endgame overlay | won/lost, turns, level, breakdown, score | At game over. |

### Client contract [D]

- `actions.js` and `enemy_ai.js` never reach into `index.js` state; everything they need
  comes through `actionCtx` / `enemyAiCtx`. New state or callbacks they need are added to
  the ctx.
- `say()` and `TEXT` are stateless and are called directly. Every player-facing line is a
  `TEXT` entry; a missing key, unfilled placeholder or unused var throws.
- The UI layer in `index.js` reads and writes game state directly; there is no boundary
  between rules and UI there. [P: observed]
- Motion is visual only and never blocks input or the turn.

---

## Open questions

Not yet settled. Recommendations are Claude's. A settled question leaves this list.

### Q-1 Inert or half-wired gear effects
ranged_defense, displacement_immune, high_def_mp_penalty's defBonus, and Warding's
skill-damage reduction exist in data or code but do nothing (or only part of what they
say). Filed as a tracker idea for discussion.
- **Options:** wire each one up; remove each one; mix per effect.
- **Recommendation:** decide per effect; wire the ones whose text players see on items, drop
  the rest.

