# ARCHITECTURE_LOG.md — Warrior

Dated entries, newest first. This is the only design doc that records history.

### 2026-11-26 — Gear changes only in the player phase (D-9 built)

The Inventory panel's equip/unequip handler now returns unless phase is 'player' and the game
is not over, and the buttons render disabled otherwise. `changePhase` now calls
`refreshOpenPanels`, since entering the enemy phase or opening a dialog did not redraw open
panels. Equipping stays free. The repeated `phase === 'player' && !gameOver` test is now one
`isPlayerTurn()` predicate, used by the inventory panel and the existing player-action guards. D-9 is now *Decided*, and ONTOLOGY drops its [D, unbuilt] tag.

### 2026-11-26 — Ranged skills need a visible target (D-8 built)

`getSkillTargets`' ranged case now uses `visibleRangedTargets`, the enemy-visible-plus-LOS
target set ranged weapon shots use, so a skill can't target an enemy hidden in fog (settles the
former Q-12). The other ranged target kinds already required visible hexes. D-8 is now
*Decided*, and ONTOLOGY drops its [D, unbuilt] tag.

### 2026-11-26 — Dodge uses gear-boosted Vigor (D-6 built)

`Player.dodge()` now reads `effectiveVigor()`, so vigor_bonus gear raises dodge like base Vigor.
D-6 is now *Decided*, and ONTOLOGY drops its [D, unbuilt] tag.

### 2026-11-26 — Hut Leave is free (D-7 built)

Leave at a hut no longer sets MP to 0, matching haven and village Leave; Learn still ends
movement. D-7 is now *Decided*, and ONTOLOGY drops its [D, unbuilt] tag.

### 2026-11-26 — Conversion questions ruled on; RATIONALE.md started

The designer ruled on the open questions from the conversion entry below. RATIONALE.md was
created as a stub in the ontology format to hold the decisions and the still-open questions;
the larger body of decisions is still to be written up there.
- Confirmed as shipped design: Q-6 → D-1 (level-up stat points may stay unspent), Q-7 → D-2
  (breach and Maw sealing by Restore chance), Q-8 → D-3 (victory by RETURN after sealing the
  Maw), Q-9 → D-4 (five skill slots), Q-11 → D-5 (the weapon slot may be emptied).
  ONTOLOGY cites the D IDs; the Inventory equip row moved from [P] to [D].
- Decided, unbuilt (filed as tracker tasks): Q-13 → D-6 (dodge uses gear-boosted Vigor),
  Q-16 → D-7 (hut Leave does not end the turn), Q-12 → D-8 (ranged skills need a visible
  target), Q-18 → D-9 (gear changes only in the player phase). ONTOLOGY keeps the current
  behaviour and tags the decided change [D, unbuilt].
- Still open: Q-1 and Q-3 (now tracker ideas for discussion), Q-2 (covered by an existing
  tracker idea on tying the dead effects back to items or dropping them), Q-4, Q-5, Q-10,
  Q-14, Q-15, Q-17.
- A stale code comment ("Can't unequip weapon to nothing") was removed; it contradicted D-5.

### 2026-11-26 — SPEC.md replaced by ONTOLOGY.md

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
RATIONALE.md, and the 2026-11-26 rulings entry above records which became decisions)
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
