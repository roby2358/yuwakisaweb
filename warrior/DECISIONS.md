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
Leaving a hut is free, as Leave is at havens and villages; only Learn ends the turn's movement.
- **Alternatives:** keep hut Leave ending the turn's movement.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: settled Q-16, unbuilt; filed as a task. ONTOLOGY kept the shipped behaviour
    and tagged the change [D, unbuilt].
  - 2026-11-26: built — hut Leave no longer sets MP to 0. ONTOLOGY dropped the
    [D, unbuilt] tag.

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

### Code structure

### D-17 Inline tunables get constant names — *Decided*
Every tunable that is an inline literal (marked † in ONTOLOGY) becomes a named constant in
config.js, under the name ONTOLOGY's Numbers table already uses for it.
- **Alternatives:** leave them inline.
- **Why:** one named source per number, so tuning is one edit and the docs and code share
  a name.
- **Evidence:** none needed; no value changes.
- **History:**
  - 2026-11-27: settled Q-5; unbuilt, filed as a task.

### D-18 Skill previews call the same formulas as the skills — *Decided*
Each skill's damage or heal formula is one shared function that both the skill's handler and
its SKILL_POWER preview call.
- **Alternatives:** keep the preview as a hand-kept mirror of the handlers' math.
- **Why:** the preview is then the rule and cannot drift from it.
- **Evidence:** none needed; no value changes.
- **History:**
  - 2026-11-27: settled Q-17; unbuilt, filed as a task.

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
describes the code side. Constants are named as in ONTOLOGY's Numbers table († = inline
literal, proposed name).

**World and terrain**
1. SPEC lists a "Gold" terrain (lootable once for 10 gold). There is no gold terrain:
   gold is a per-hex `goldDeposit`, set by prize hexes (PRIZE_GOLD†), crops, Salvage and
   Prospect.
2. SPEC's terrain table omits the special (prize), shattered and distressed families and
   the Ruins, Breach and Maw terrains. Ruins cost 2 and give +1 ranged range; Breach and
   Maw are impassable.
3. SPEC says the map regenerates until a haven-to-Maw path exists. The code tries up to
   MAP_ATTEMPTS† times with a stricter check (every haven reaches the Maw, half the havens
   are far from it) and keeps the last map if all attempts fail.
4. SPEC's error-handling items are unbuilt or moot: shops never switch to consumable
   healing items (there are no consumables); "if all breaches are closed when the player
   reaches the Breach" no longer describes anything.

**Points of interest**
5. Havens offer Rest, Weaponsmith, Magicsmith, Train and Leave (SPEC: Rest, Shop, Leave).
   Haven Rest ends the turn's movement. The first visit to each haven and hut grants +1 SP.
6. Villages also have a VILLAGE_CROP_CHANCE† to sprout a crop next to them on each visit.
7. Breaches are not closed by defeating the guardian while adjacent or by stepping onto
   the breach (the hex is impassable). After its guardian dies, a breach is sealed by
   casting Restore within range, with BREACH_SEAL_CHANCE† per cast. Guardians respawn
   (GUARDIAN_RESPAWN_CHANCE† per turn when none is within GUARDIAN_PRESENCE_RADIUS†),
   which un-readies the breach. A sealed breach becomes Hills and gives loot.
8. Breach spawning: SPEC says 15% per open breach per turn, Void Stalker or Phase Wraith
   only, with a 20-enemy map cap. Code: BREACH_SPAWN_CHANCE† per open breach, from
   CHAOS_SPAWN_POOL† (stalker, archer, crawler, wraith; wraith dropped at WRAITH_CAP†),
   paused while chaos attack totals CHAOS_MIGHT_CAP†. There is no global enemy cap;
   wildlife has its own WILDLIFE_MIGHT_CAP†.
9. SPEC's initial spawn omits the Unraveler on the Maw and the wildlife fill (packs until
   WILDLIFE_MIGHT_CAP†).
10. The Maw: SPEC says it can be challenged after 2 closed breaches, by moving onto it, and
    the run is won by defeating the Unraveler. Code: the Maw is impassable; the Unraveler
    sits on it from the start; its first death re-forms it in place of a random chaos
    unit; sealing the Maw needs the Unraveler gone, its current guardian dead and **every**
    breach sealed, then a Restore cast with MAW_SEAL_CHANCE†. Sealing drops the RETURN
    scroll; invoking RETURN wins the run.
11. The Unraveler does not spawn a Void Stalker every 3 turns. It rolls its spawnChance
    each turn (not its first) for a CHAOS_SPAWN_POOL† enemy; the re-formed Unraveler does
    not spawn. It also joins chaos swarms.
12. Ruins re-entered while enemies are near only log "clear them first" (no dialog).
13. Garrisons (Commission Garrison skill, build chance, chaos-slaying) are absent from SPEC.
14. Hut Leave ends the turn's movement (SPEC is silent).

**Player**
15. Warding's "reduces incoming skill damage by Warding%" is not in effect: the code path
    exists but no caller marks damage as skill damage.
16. Reflex gives no turn-order priority; there is no turn order.
17. Vigor does not raise HP restored at rest. Might also adds +1 defense per
    MIGHT_PER_DEFENSE†. Dodge uses base Vigor, not Vigor raised by gear.
18. The player starts with SP (STARTING_SP of MAX_SP†) and a Stick Bow in the inventory;
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
    unspent; they stay on the Character panel. Levels cap at LEVEL_CAP†.
34. SPEC's weapon, armor and artifact tables (Void Cleaver, Starplate, Seer's Lens, …) are
    retired. Gear is mundane tiers 0-4 plus procedural magic items (four categories,
    effect pools, MP variants); there are no static artifacts.
35. Breach Guardians do not always drop an unowned breach-tier item: crawlers and
    guardians drop CHAOS_DROP_MUNDANE† random mundane items (owned or not) and a
    CHAOS_DROP_MAGIC_CHANCE† magic item.
36. The Maw Compass is not a haven item unlocked by a closed breach; reveal_maw is a magic
    item effect, and it also reveals chaos units and their neighbouring hexes.
37. The weapon slot can be unequipped to empty (unarmed damage 1).

**Economy**
38. Kill gold is KILL_GOLD† plus the def's gold (SPEC: 1-5). Gold also comes from crops,
    Salvage, Loot, settlement rewards, Restore and opportunist.
39. Haven stock is HAVEN_MAGIC_STOCK† magic + HAVEN_MUNDANE_STOCK† mundane (SPEC 3-5);
    villages stock mundane gear; each shop open has SHOP_NEW_ITEM_CHANCE† to add a magic
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
- Q-4 Map validation keeps an invalid map after MAP_ATTEMPTS†.
- Q-5 Inline literals (†) have no constant names.
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
