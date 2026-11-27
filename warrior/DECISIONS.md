# DECISIONS.md — Warrior

ONTOLOGY.md describes what is. This file records what we decided, why, and how it changed:
each decision with the alternatives considered, the reasoning and evidence, and a dated
history of the code changes behind it, plus records of other changes and what was deliberately left out. Nobody needs this file or its IDs to understand or
implement the game; they are for reconstructing history. Decisions are `D-n`; the open questions
(`Q-n`) live in ONTOLOGY.md until a decision settles them. IDs are stable and never reused. History entries are dated.

---

## Decisions

### Progression

### D-1 Level-up stat points may stay unspent — *Decided*
Done closes the level-up dialog with points unspent; they stay on the Character panel.
- **Alternatives:** force all points to be spent before the dialog closes.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: settled Q-6; confirmed shipped behaviour.

### Breaches, the Maw and victory

### D-2 Breaches and the Maw are sealed by a Restore cast, with a chance — *Decided*
Once a breach's guardian is dead (and, for the Maw, the Unraveler gone and every breach
sealed), each Restore cast in range seals it with BREACH_SEAL_CHANCE or MAW_SEAL_CHANCE.
- **Alternatives:** seal by killing the guardian while adjacent, or by stepping onto the breach.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: settled Q-7; confirmed shipped behaviour.

### D-3 The run is won by invoking RETURN after sealing the Maw — *Decided*
Sealing the Maw drops the RETURN scroll; invoking it (with a confirm) wins.
- **Alternatives:** win on killing the Unraveler; challenge the Maw after two sealed breaches
  by stepping onto it.
- **Why:** designer's call; to be filled in. Serves G-1 ("Seal the Maw and walk away").
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: settled Q-8; confirmed shipped behaviour.

### Skills and gear

### D-4 Five skill slots — *Decided*
SKILL_SLOTS is 5 (keys 1-5).
- **Alternatives:** four slots.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: settled Q-9; confirmed shipped behaviour.

### D-5 The weapon slot may be emptied — *Decided*
The player may unequip the weapon and fight unarmed (damage 1).
- **Alternatives:** the weapon slot can only be swapped, never emptied.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: settled Q-11; confirmed shipped behaviour. ONTOLOGY's Inventory equip row
    moved from [P] to [D]. A stale code comment ("Can't unequip weapon to nothing") that
    contradicted it was removed.

### D-6 Dodge uses gear-boosted Vigor — *Decided*
Dodge reads effective Vigor (base plus vigor_bonus gear), as defense and max HP already do.
- **Alternatives:** keep dodge on base Vigor.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: settled Q-13, unbuilt; filed as a task. ONTOLOGY kept the shipped behaviour
    (dodge on base Vigor) and tagged the change [D, unbuilt].
  - 2026-11-26: built — `Player.dodge()` in player.js reads `effectiveVigor()`. ONTOLOGY
    dropped the [D, unbuilt] tag.

### D-7 Hut Leave does not end the turn — *Decided*
Leaving a hut is free, as Leave is at havens and villages; Learn and Rest end the turn's movement.
- **Alternatives:** keep hut Leave ending the turn's movement.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: settled Q-16, unbuilt; filed as a task. ONTOLOGY kept the shipped behaviour
    and tagged the change [D, unbuilt].
  - 2026-11-26: built — hut Leave no longer sets MP to 0. ONTOLOGY dropped the
    [D, unbuilt] tag.
  - 2026-11-27: the statement formerly read "only Learn ends the turn's movement"; hut Rest
    (D-19) ends it too. Leave is unchanged.

### D-8 Ranged skills need a visible target — *Decided*
Ranged-skill targets need the enemy to be visible as well as in LOS, like weapon shots.
- **Alternatives:** keep LOS-only targeting for skills.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: settled Q-12, unbuilt; filed as a task. ONTOLOGY kept the shipped behaviour
    and tagged the change [D, unbuilt].
  - 2026-11-26: built — `getSkillTargets`' ranged case uses `visibleRangedTargets`, the
    target set ranged weapon shots use, so a skill can no longer target an enemy hidden in
    fog. The other ranged target kinds already required visible hexes. ONTOLOGY dropped the
    [D, unbuilt] tag.

### D-9 Gear changes only in the player phase — *Decided*
Equipping and unequipping from the Inventory panel is allowed only while phase is 'player'
and the game is not over; outside it the buttons render disabled. Equipping costs no MP.
- **Alternatives:** allow gear changes at any time, including the enemy phase.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: settled Q-18, unbuilt; filed as a task. ONTOLOGY kept the shipped behaviour
    and tagged the change [D, unbuilt].
  - 2026-11-26: built — the Inventory panel's equip/unequip handler returns early outside
    the player turn, and its buttons render disabled. `changePhase` now calls
    `refreshOpenPanels`, since entering the enemy phase or opening a dialog had not redrawn
    open panels. The repeated `phase === 'player' && !gameOver` test became one
    `isPlayerTurn()` predicate, used by the inventory panel and the existing player-action
    guards. ONTOLOGY dropped the [D, unbuilt] tag.

### D-10 Item effects with no carrier are removed — *Decided*
An item effect that no item in config.js carries has no code; the five such effects are
removed.
- **Alternatives:** tie them back to new magic-item effects.
- **Why:** newer effects cover each one: high_def_mp_penalty's MP loss, aether_bonus,
  wall_of_steel, heal plus aether_regen, and sweep/chain. Sweep, hitting enemies around the
  player, is how the designer wants a cleaving hit to work.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: raised as Q-2 by the SPEC.md → ONTOLOGY.md conversion; left open at the
    rulings, covered by an existing tracker idea on tying the dead effects back to items or
    dropping them.
  - 2026-11-26: settled Q-2 and built — mp_penalty, armor_aether_bonus, wall_crown,
    regen_combo and cleave were deleted from player.js (maxAether, maxMP, meleeDamage),
    enemy_ai.js (the player regen step), actions.js (meleeAffixTargets, MELEE_AFFIX_LABEL)
    and text.js (src_cleave). No save shape changed.

### D-11 The player's gain floats show as a turn total — *Decided*
During the player phase the player's HP and AE rises are summed per stat and float once each,
"+N" in the stat's colour, when the player ends the turn. Only rises count. Rises outside the
player phase, and every enemy's, float as they happen.
- **Alternatives:** float every rise as it lands (one "+1" per step of a stepped gain).
- **Why:** one number per stat for the turn reads at a glance (G-6); a string of small floats
  is noise.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: built — `floatGain` in index.js adds the player's player-phase rises to
    `turnGains` (next to GAIN_FLOATS, reset in `startPlayerTurn`) instead of floating them;
    `floatTurnGains`, called in `gameLoop` where the player phase hands off to the enemy
    phase, floats each non-zero total and resets. Formerly every rise between drawn frames
    floated on its own, so a gain arriving in steps showed one "+1" per step. Restore adds
    its AE in one step, so actions.js was unchanged. ONTOLOGY's gain-float event row was
    updated. No save shape changed.

### D-12 Dodge bonuses stack — *Decided*
Every equipped item's dodge_bonus adds to dodge, as vigor_bonus and other bonuses do. The
total stays capped at MAX_DODGE (90%), so there is always at least a 10% chance to be hit.
- **Alternatives:** count only the first equipped dodge_bonus item, which made dodge a
  single-slot choice.
- **Why:** designer's call; stacking lets dodge be a build across several slots, and the cap
  keeps a floor on being hit.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: built — `Player.dodge()` in player.js adds
    `sumEquipped('dodge_bonus', 'dodgeBonus')` in place of the first equipped dodge_bonus
    item's bonus. No item values or MAX_DODGE changed; the character panel already read
    `player.dodge()`. ONTOLOGY's player-damage rule and DYNAMICS's dodge lines were updated.
    No save shape changed.

### D-13 All randomness goes through Rando — *Decided*
Every random draw in the files index.html loads goes through a `Rando` method: percent rolls
use `Rando.bool(p / 100)`, fixed chances `Rando.bool(c)`, continuous values `Rando.float`,
and the creature palette's RNG function is `() => Rando.float(0, 1)`. Only rando.js calls
`Math.random`. `Rando.bool` takes its probability explicitly.
- **Alternatives:** leave the scattered `Math.random` calls (gameplay rolls, map noise,
  palette, sound noise) as they were.
- **Why:** the random functions live in one place in the code. Seeding is not a goal. Odds
  are unchanged.
- **Evidence:** `grep -n Math.random` over the loaded files finds only rando.js and a
  comment in colortheory.js.
- **History:**
  - 2026-11-26: built — the remaining direct `Math.random()` calls moved to Rando: the stun
    and dodge percent rolls in index.js, the Phase Wraith teleport (keeping its 0.3
    fallback), guardian respawn and breach chaos spawn in enemy_ai.js, the diamond-square
    noise in world.js and the noise buffer in sound.js, and the creature palette RNG in
    enemies.js. `Rando.bool` lost its 0.5 default. Q-14 stayed open. ONTOLOGY gained a
    matching invariant. No save shape changed.
  - 2026-11-27: Q-14 (no seeded randomness) closed. Seeded runs are a non-goal; Rando exists
    only to centralize the functions.

### Map and enemies

### D-14 A map that fails validation on every attempt is kept — *Decided*
Map generation retries up to MAP_ATTEMPTS times; if every attempt fails `_validate()`, the
last map is used anyway.
- **Alternatives:** keep retrying until valid; relax the check on later attempts.
- **Why:** every attempt failing is not going to happen in practice (the designer: a
  civilization-ending comet will hit first), so it is not worth code.
- **Evidence:** none measured; the designer's judgment of the odds.
- **History:**
  - 2026-11-27: settled Q-4; no code change.

### D-15 Enemies sense the player by distance alone — *Decided*
Aggro is a hex-distance check with no fog or line-of-sight test. Firing still needs LOS.
- **Alternatives:** require LOS, or forest stealth rules, before an enemy notices.
- **Why:** the player already has an overwhelming advantage.
- **Evidence:** none measured.
- **History:**
  - 2026-11-27: settled Q-10; no code change.

### D-16 Crawlers and guardians may drop items the player already owns — *Decided*
Chaos drops are random mundane items, owned or not.
- **Alternatives:** prefer unowned items, as breach loot does.
- **Why:** as intended: crawlers and guardians just drop stuff.
- **Evidence:** none needed.
- **History:**
  - 2026-11-27: settled Q-15; no code change.

### D-19 Huts offer a small rest, in one vertical menu — *Decided*
A hut's Rest restores HUT_REST_HP_FRACTION of max HP, rounded down but at least 1, and
HUT_REST_AE_FRACTION of max Aether, rounded up, then ends the turn's movement as village Rest
does. It is always offered and unlimited, rolls no village crop chance, and leaves an offered
lesson in place for the next visit. The hut dialog is one vertical menu: Learn (only when a
lesson is offered), Rest, Train, Leave.
- **Alternatives:** keep the hut as it was: no Rest, and a row of buttons built separately by
  each of the three outcomes (nothing to teach, the gift, a lesson).
- **Why:** designer's call: the hut should read like the village menu, and be a useful stop
  even when the sage has nothing to teach. Unlimited because huts are never spent ("Living
  map").
- **Evidence:** not measured. The fractions (0.25 HP, 0.5 AE) are first values.
- **History:**
  - 2026-11-27: decided and built — `showHutMenu` in index.js is the one place the hut
    dialog opens (via `showVerticalDialog`); `showHutDialog`, `giveHutGift` and
    `offerHutLesson` pass it a body and an optional Learn button, replacing three separate
    `showDialog` calls and the `hutTrainButton`/`hutLeaveButton` helpers. `restHeal` now
    takes the HP and AE amounts already computed, so each caller owns its rounding:
    `restByFraction` (village Rest, Sanctuary; amounts unchanged) and `hutRest`. ONTOLOGY's
    Hut visit rule, POI table, Numbers table and command row were updated. No save shape
    changed.

### D-20 Hut gift and reroll chances roll once per turn, at 2% — *Decided*
A hut rolls HUT_GIFT_CHANCE and HUT_REROLL_CHANCE at most once per turn; re-entering the hut
on the same turn (after Leave) shows the menu without rolling again. Both chances are 0.02.
- **Alternatives:** roll on every opening of the dialog, at 0.05 each (the previous behaviour).
- **Why:** designer's call: it was too easy to camp a hut and get good stuff. Leave is free, so
  every re-entry was another try within one turn; now a try costs a turn (Rest ends it).
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: decided and built. The hut POI carries `rolledTurn`; `showHutDialog` rolls
    only when it differs from the current turn. Both constants moved from 0.05 to 0.02. Old
    saves load unchanged (a hut without the field simply rolls on its next visit), so
    SAVE_VERSION was not bumped.

### D-21 Sanctuary needs clean ground: not shattered, not distressed — *Decided*
Sanctuary aborts (with refund) on a distressed hex, on top of the Pristine rule that already
keeps it off shattered hexes. The other Pristine skills still work on distressed terrain.
- **Alternatives:** leave distressed hexes allowed; make every Pristine skill refuse them.
- **Why:** designer's call: a rest in the wilds should need unspoiled ground.
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: decided and built, as a check in `executeSanctuary` beside the no-POI one.

### D-22 A chaos spawn at a crowded source lands on the nearest free hex — *Decided*
Every chaos spawn (from a breach, the Maw or the Unraveler) lands on the nearest free
passable hex to its source, found by searching outward over passable hexes; ties at the same distance are broken
at random, the source hex is never used, and nothing spawns only when no free hex can be
reached. Spawn chances, the might cap, the pool and homes are unchanged.
- **Alternatives:** skip the spawn when the adjacent hexes are all taken (the previous
  behaviour); draw only from sources that still have room.
- **Why:** designer's call: a crowded source keeps growing outward, so an army can pile up
  around it.
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: decided and built. `nearestFreeHex` in enemy_ai.js is the one placement
    helper, called by `spawnChaosAtBreaches` and `ChaosAI.tryBossSpawn` in place of their
    own adjacent-hex filters; it widens a `bfsHexes` search one step at a time. ONTOLOGY's
    chaos-spawning and Unraveler-minion rules were updated. No save shape changed.
  - 2026-11-27: D-24 made the Maw a source and moved every spawn into `spawnChaos`, now
    the helper's one caller; the statement was widened from breach and Unraveler spawns.

### D-23 Chaos spawning is one flat roll a turn at a random source — *Decided*
The spawn step makes one CHAOS_SPAWN_CHANCE roll each turn; on a success one source is
drawn uniformly and one enemy from the chaos pool spawns there. Which sources are in the
draw, and which of them obey the might cap, is D-24. With no source nothing spawns.
Guardian respawn, wildlife, the pool and WRAITH_CAP are unchanged.
- **Alternatives:** every open breach rolls its own chance each turn (the previous
  behaviour, BREACH_SPAWN_CHANCE 0.075 per breach), so the total rate falls as breaches
  close.
- **Why:** designer's call: a steady spawn rate that lands on fewer and fewer sources, so
  chaos scatters early and concentrates as breaches close.
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: decided and built. `spawnChaosAtBreaches` in enemy_ai.js collects its
    sources (`chaosSpawnSources`, the open breaches), rolls once and draws one;
    CHAOS_SPAWN_CHANCE (0.5) replaced BREACH_SPAWN_CHANCE in config.js. ONTOLOGY's
    chaos-spawning rule and Numbers row, and DYNAMICS, were updated. No save shape changed.
    As decided, the sources were the open breaches only, the might cap stopped the roll
    outright, and the Unraveler kept its own per-turn roll.
  - 2026-11-27: D-24 widened the sources to the Maw and the original Unraveler and moved
    the might-cap check to after the draw; the title and statement were rewritten from
    "Breach spawning is one flat roll a turn at a random open breach".

### D-24 The Maw and the Unraveler join the chaos spawn draw — *Decided*
The one CHAOS_SPAWN_CHANCE roll a turn draws from every open breach, the Maw until it is
sealed (whatever has happened to the Unraveler) and the original Unraveler until its first
death, each with equal weight, so the Maw side holds two entries while both are up. The
Unraveler no longer rolls on its own turn, and the re-formed Unraveler is still not a
source. Every source uses the same pool and nearest-free-hex placement; an Unraveler spawn
searches from where it stands. A breach spawn is homed on its breach and silent; a Maw
spawn has no home and is silent; an Unraveler spawn has no home and logs its line. The
Unraveler ignores CHAOS_MIGHT_CAP; breaches and the Maw obey it but stay in the draw, so a
draw that lands on one at the cap spawns nothing that turn. Guardian respawn, wildlife, the
pool and WRAITH_CAP are unchanged.
- **Alternatives:** the Unraveler rolling its own spawnChance each turn, apart from the
  shared roll (the previous behaviour, 0.16 per turn, with the Maw spawning nothing); the
  Maw as the only Maw-side source; the Unraveler as the only Maw-side source; one cap for
  all sources; the Maw exempt from the cap too; a heavier Maw weight.
- **Why:** designer's call: one steady rate shared by every source ends at the Maw as
  breaches close, so the player arrives to find an army of chaos there, which the designer
  recalls as a fun endgame; killing the Unraveler the first time starts the wind-down.
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: decided and built. `chaosSpawnSources` in enemy_ai.js returns each source
    as data (where to search from, its home or none, whether it obeys the cap, its log line
    or none) and `spawnChaos` (renamed from `spawnChaosAtBreaches`) rolls, draws and
    spawns on one code path. `ChaosAI.tryBossSpawn`, the Unraveler def's spawnChance and
    its 0.16 fallback were removed. The `noSpawn` flag on the re-formed Unraveler is kept
    as saved, so SAVE_VERSION was not bumped. ONTOLOGY's chaos-spawning rule (which absorbed
    the Unraveler-minions rule), entity tables and Numbers table, DYNAMICS and CLAUDE.md
    were updated.

### Code structure

### D-17 Inline tunables get constant names — *Decided*
A tunable number is a named top-level constant in config.js, under the name ONTOLOGY's
Numbers table uses for it, and the code reads it by that name. Per-entry fields of the
content tables (skills, enemies, items) stay in their tables.
- **Alternatives:** leave them inline.
- **Why:** one named source per number, so tuning is one edit and the docs and code share
  a name.
- **Evidence:** none needed; no value changes.
- **History:**
  - 2026-11-27: settled Q-5; unbuilt, filed as a task.
  - 2026-11-27: built: the inline literals became constants in a "Tunable numbers" block in
    config.js (ranges as [min, max] pairs), and world.js, player.js, enemies.js,
    enemy_ai.js, actions.js and index.js read them by name; the HUT_* constants moved there
    from index.js. No value, behaviour or save-shape change. ONTOLOGY dropped its marks for
    unnamed literals. A few Numbers rows stay literals or formulas in place and are named
    in lower case there: the magic item price formulas, dodge per vigor, opportunist gold,
    the POI loot mundane count, the Prospect, Salvage and Ground Weeps numbers, the
    teleportChance and spawnChance fallbacks, and the enemy animation delays.
  - 2026-11-27: the teleportChance fallback row left the Numbers table. ChaosAI rolls the
    Phase Wraith def's `teleportChance` directly, with no inline 0.3 behind it, so the def
    is the chance's only source. The chance stays a per-entry field of ENEMY_DEFS. No value,
    behaviour or save-shape change.

### D-18 Skill previews call the same formulas as the skills — *Decided*
Each skill's damage or heal formula is one shared function that both the skill's handler and
its SKILL_POWER preview call.
- **Alternatives:** keep the preview as a hand-kept mirror of the handlers' math.
- **Why:** the preview is then the rule and cannot drift from it.
- **Evidence:** none needed; no value changes.
- **History:**
  - 2026-11-27: settled Q-17; unbuilt, filed as a task.
  - 2026-11-27: built: `SKILL_FORMULAS` in actions.js holds one function per skill with a
    damage or heal number (21 skills; the four weapon-plus-Might skills share one), giving
    the pre-roll amount of a single hit on one target. Each handler takes its base amount
    from it through `SkillAction.baseAmount()`, and `skillSummary` in index.js takes the
    preview score from the same entry, so SKILL_POWER keeps only the factors text. Restore
    has factors text and no formula. The old previews and handlers agreed on every skill,
    so no number changed; no save-shape change. `node test/skillformulas.js` checks that
    the two tables cover the same skills.

---

## Records

Dated changes that are history but not a single decision, newest first.

### 2026-11-27 — RATIONALE.md and ARCHITECTURE_LOG.md merged into DECISIONS.md

The decisions file (RATIONALE.md) and the dated log (ARCHITECTURE_LOG.md) became this one
file. Each log entry about a decision now sits in that decision's History; the rest are here.
ONTOLOGY.md no longer cites D IDs.

### 2026-11-27 — Open questions moved to ONTOLOGY.md

The open questions (Q-n) are unsettled current state, not history, so they moved to the end
of ONTOLOGY.md. A settled question leaves that list and becomes a decision here.

### 2026-11-26 — Conversion questions ruled on

The designer ruled on the open questions from the conversion entry below. The ones that
became decisions (D-1 to D-9) are recorded in each decision's History. Still open after the
rulings:
Q-1 and Q-3 (filed as tracker ideas for discussion), Q-2 (covered by an existing tracker idea;
later settled as D-10), Q-4, Q-5, Q-10, Q-14, Q-15, Q-17.

### 2026-11-26 — ONTOLOGY.md replaces SPEC.md

ONTOLOGY.md is now the implementation reference. It was written from the code (code
wins), not from SPEC.md. SPEC.md stays in the tree until the back-reference sweep retires
it. No code changed. Below is every place SPEC.md disagreed with the code; ONTOLOGY.md
describes the code side. Constants are named as in ONTOLOGY's Numbers table.

**World and terrain**
1. SPEC lists a "Gold" terrain (lootable once for 10 gold). There is no gold terrain:
   gold is a per-hex `goldDeposit`, set by prize hexes (PRIZE_GOLD), crops, Salvage and
   Prospect.
2. SPEC's terrain table omits the special (prize), shattered and distressed families and
   the Ruins, Breach and Maw terrains. Ruins cost 2 and give +1 ranged range; Breach and
   Maw are impassable.
3. SPEC says the map regenerates until a haven-to-Maw path exists. The code tries up to
   MAP_ATTEMPTS times with a stricter check (every haven reaches the Maw, half the havens
   are far from it) and keeps the last map if all attempts fail.
4. SPEC's error-handling items are unbuilt or moot: shops never switch to consumable
   healing items (there are no consumables); "if all breaches are closed when the player
   reaches the Breach" no longer describes anything.

**Points of interest**
5. Havens offer Rest, Weaponsmith, Magicsmith, Train and Leave (SPEC: Rest, Shop, Leave).
   Haven Rest ends the turn's movement. The first visit to each haven and hut grants +1 SP.
6. Villages also have a VILLAGE_CROP_CHANCE to sprout a crop next to them on each visit.
7. Breaches are not closed by defeating the guardian while adjacent or by stepping onto
   the breach (the hex is impassable). After its guardian dies, a breach is sealed by
   casting Restore within range, with BREACH_SEAL_CHANCE per cast. Guardians respawn
   (GUARDIAN_RESPAWN_CHANCE per turn when none is within GUARDIAN_PRESENCE_RADIUS),
   which un-readies the breach. A sealed breach becomes Hills and gives loot.
8. Breach spawning: SPEC says 15% per open breach per turn, Void Stalker or Phase Wraith
   only, with a 20-enemy map cap. Code: BREACH_SPAWN_CHANCE per open breach, from
   CHAOS_SPAWN_POOL (stalker, archer, crawler, wraith; wraith dropped at WRAITH_CAP),
   paused while chaos attack totals CHAOS_MIGHT_CAP. There is no global enemy cap;
   wildlife has its own WILDLIFE_MIGHT_CAP.
9. SPEC's initial spawn omits the Unraveler on the Maw and the wildlife fill (packs until
   WILDLIFE_MIGHT_CAP).
10. The Maw: SPEC says it can be challenged after 2 closed breaches, by moving onto it, and
    the run is won by defeating the Unraveler. Code: the Maw is impassable; the Unraveler
    sits on it from the start; its first death re-forms it in place of a random chaos
    unit; sealing the Maw needs the Unraveler gone, its current guardian dead and **every**
    breach sealed, then a Restore cast with MAW_SEAL_CHANCE. Sealing drops the RETURN
    scroll; invoking RETURN wins the run.
11. The Unraveler does not spawn a Void Stalker every 3 turns. It rolls its spawnChance
    each turn (not its first) for a CHAOS_SPAWN_POOL enemy; the re-formed Unraveler does
    not spawn. It also joins chaos swarms.
12. Ruins re-entered while enemies are near only log "clear them first" (no dialog).
13. Garrisons (Commission Garrison skill, build chance, chaos-slaying) are absent from SPEC.
14. Hut Leave ends the turn's movement (SPEC is silent).

**Player**
15. Warding's "reduces incoming skill damage by Warding%" is not in effect: the code path
    exists but no caller marks damage as skill damage.
16. Reflex gives no turn-order priority; there is no turn order.
17. Vigor does not raise HP restored at rest. Might also adds +1 defense per
    MIGHT_PER_DEFENSE. Dodge uses base Vigor, not Vigor raised by gear.
18. The player starts with SP (STARTING_SP of MAX_SP) and a Stick Bow in the inventory;
    SPEC omits both.

**Combat**
19. Melee into a kill moves onto the target hex only if the player still has the MP for
    it. Melee costs the weapon's MP (normal, fast 0, heavy all). Move-and-attack first
    walks to the cheapest adjacent reachable hex.
20. Ranged attacks: only magical ranged weapons cost Aether (1, heavy 2; free_ranged and
    channel cost 0); mundane bows are free (SPEC: always 1). A ranged attack costs the
    weapon's MP (2 by default) rather than ending movement. Range adds the hills/ruins and
    garrison bonuses; the target must be visible and in LOS.
21. All damage, player and enemy, is rolled with `Rando.bellCurve` before defense.
22. Enemy stats in SPEC differ from `ENEMY_DEFS` (e.g. Flux Archer range, Phase Wraith
    speed and HP, Void Stalker and Breach Guardian also fire at range). The Phase Wraith
    teleports only when the player is within its aggro and not wearing wraith_immune.
23. Wildlife behaviors monster and ruins-guardian, the alarm/hunt/swarm system, forest
    stealth, threat_shroud, the Maw proximity buff, the corrupted-terrain buff and heal,
    and enemy terrain shattering are absent from SPEC.
24. Enemy AI: SPEC says attacks happen after all enemy movement (and contradicts itself in
    Turn Structure). Code: each enemy moves then attacks, one enemy at a time. Enemies also
    may not enter havens, villages or garrisons.
25. Turn structure: the enemy phase also runs player regen, burn ticks, warp/reflect
    countdown, guardian respawn, wildlife spawning and garrisons; the save happens when the
    player ends the turn. Engagement halves MP at turn start (not in SPEC).

**Skills**
26. Skill slots: SKILL_SLOTS is 5 (keys 1-5), not 4.
27. Not every skill costs Aether: several cost 0 AE, Commission Garrison costs gold,
    Dimensional Rend costs HP.
28. SPEC's skill table (costs, levels, effects, Void Strike at start) is obsolete; the
    `SKILLS` table with per-rank tiers is the content.
29. Skills don't all end movement: each has its own MP cost (absent = all), and weapon-class
    skills pay the larger of their own and the weapon's MP.
30. Skills are not limited to once per turn; only Phase Step and Sprint are.
31. The learned → active (trained) → equipped model, SP budget, ranks and Train dialog are
    absent from SPEC (it mentions Skill Points only at level-up). There are no skill
    cooldowns for the Skills panel to show.
32. Skill usage categories (anytime, non-combat, pristine) are absent from SPEC.

**Progression and equipment**
33. Level-up stat allocation does not block play: Done closes the dialog with points
    unspent; they stay on the Character panel. Levels cap at LEVEL_CAP.
34. SPEC's weapon, armor and artifact tables (Void Cleaver, Starplate, Seer's Lens, …) are
    retired. Gear is mundane tiers 0-4 plus procedural magic items (four categories,
    effect pools, MP variants); there are no static artifacts.
35. Breach Guardians do not always drop an unowned breach-tier item: crawlers and
    guardians drop CHAOS_DROP_MUNDANE random mundane items (owned or not) and a
    CHAOS_DROP_MAGIC_CHANCE magic item.
36. The Maw Compass is not a haven item unlocked by a closed breach; reveal_maw is a magic
    item effect, and it also reveals chaos units and their neighbouring hexes.
37. The weapon slot can be unequipped to empty (unarmed damage 1).

**Economy**
38. Kill gold is KILL_GOLD plus the def's gold (SPEC: 1-5). Gold also comes from crops,
    Salvage, Loot, settlement rewards, Restore and opportunist.
39. Haven stock is HAVEN_MAGIC_STOCK magic + HAVEN_MUNDANE_STOCK mundane (SPEC 3-5);
    villages stock mundane gear; each shop open has SHOP_NEW_ITEM_CHANCE to add a magic
    item. Each smith buys back only its own kind; sell price has a floor of 1.

**HUD, input, end screen, style**
40. Space/E on a POI hex re-opens that POI's dialog instead of ending the turn. A, R and M
    are bound (melee targeting, ranged targeting, world map). N is not bound; New Game is
    the HUD button with a confirm.
41. The end screen shows turns, level, the 13-counter score breakdown and a total score
    (SPEC: turns, enemies, breaches, level).
42. Style: titles and prose use a serif font, numbers monospace (SPEC: monospace). Tokens
    are sprites from sprite sheets, not letter labels.

**Open questions raised by the conversion** (IDs are stable; the open ones now live in
ONTOLOGY.md under Open questions, and the 2026-11-26 rulings entry above records which
became decisions)
- Q-1 Inert or half-wired effects: ranged_defense, displacement_immune,
  high_def_mp_penalty's defBonus, riposte's riposteDamage, Warding skill-damage reduction.
- Q-2 Dead special references from retired items: regen_combo, mp_penalty,
  armor_aether_bonus, wall_crown, cleave.
- Q-3 counter_mastery fires only against chaos melee, not wildlife melee.
- Q-4 Map validation keeps an invalid map after MAP_ATTEMPTS.
- Q-5 Inline literals have no constant names.
- Q-6 Level-up stat points may stay unspent.
- Q-7 Breach and Maw sealing by Restore chance.
- Q-8 Victory by RETURN after sealing the Maw (DYNAMICS still describes 2 breaches and
  stepping on the Maw).
- Q-9 Five skill slots (DYNAMICS still says 4).
- Q-10 Enemies sense the player through fog by distance alone.
- Q-11 The weapon slot can be emptied.
- Q-12 Ranged skills need LOS but not enemy visibility.
- Q-13 Dodge ignores vigor_bonus.
- Q-14 No seeded randomness.
- Q-15 Chaos drops may duplicate owned mundane items.
- Q-16 Hut Leave ends the turn; haven and village Leave do not.
- Q-17 SKILL_POWER previews mirror the handlers' formulas instead of calling them.
- Q-18 The Inventory panel allows equipping during the enemy phase.

---

## Deliberately left out

- **Seeded or reproducible runs** [D]. Rando exists only to keep the random functions in one
  place.
- **Save migration or back-compat for old saves** [D]. A version mismatch shows "New Version"
  and the save is not loaded.
- **Multiplayer or a server; mobile/touch play** [P] (ONTOLOGY non-goals).
