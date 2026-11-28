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

### D-6 Dodge uses gear-boosted Vigor — *Superseded by D-26*
Dodge reads effective Vigor (base plus vigor_bonus gear), as defense and max HP already do.
- **Alternatives:** keep dodge on base Vigor.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.
- **History:**
  - 2026-11-26: settled Q-13, unbuilt; filed as a task. ONTOLOGY kept the shipped behaviour
    (dodge on base Vigor) and tagged the change [D, unbuilt].
  - 2026-11-26: built — `Player.dodge()` in player.js reads `effectiveVigor()`. ONTOLOGY
    dropped the [D, unbuilt] tag.
  - 2026-11-27: superseded by D-26; dodge left Vigor for Reflex.

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
  - 2026-11-27: artifacts roll dodge_bonus too. Only armor carried it and there is one
    armor slot, so nothing ever stacked. `DODGE_BONUS_EFFECTS` in config.js holds the three
    rows (10 / 20 / 30 at values 2 / 3 / 4), spread into `ARMOR_EFFECTS` and into the new
    `ARTIFACT_EFFECTS` pool that `rollMagicItem` draws artifacts from. Weapons do not get
    it. ONTOLOGY's magic-item rule and DYNAMICS's effect lists were updated. Existing items
    are untouched and no save shape changed.

### D-26 Dodge comes from Reflex, not Vigor — *Decided*
Dodge = DODGE_PER_REFLEX × the Reflex stat + every equipped dodge_bonus item's bonus, capped
at MAX_DODGE. Vigor and vigor_bonus gear no longer affect dodge; they still give max HP and
defense. Supersedes D-6; D-12 (dodge bonuses stack) stands.
- **Alternatives:** keep dodge on gear-boosted Vigor (D-6); split dodge between the two
  stats.
- **Why:** designer's call. Vigor was the whole survival stat (max HP, defense and dodge),
  while Reflex had no defensive side at all; moving dodge gives Reflex one and makes
  survival a choice between soaking hits and avoiding them.
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: built — `Player.dodge()` in player.js reads `stats.reflex` in place of
    `effectiveVigor()`; there is no Reflex gear, so it reads the stat directly. The
    per-point rate, formerly an inline 2 (the "dodge per vigor" row), became
    `DODGE_PER_REFLEX` in config.js at the same value; MAX_DODGE is unchanged. ONTOLOGY's
    player-damage rule and Numbers table and DYNAMICS's dodge lines were updated. No
    player-facing text named the stat. No save shape changed.

### D-27 The Dodge skill trades half your current MP for dodge — *Decided*
Dodge is an optional skill (minLevel 2, 0 Aether, self, usable any time). Casting it spends
half the player's current MP, rounded down, and adds 20 / 30 / 40 / 50 / 60 percent (by
rank) to dodge, inside MAX_DODGE, until the player's next turn starts. It cannot be cast
again while the bonus is up. It shares its name with the Dodge number on the Character
panel on purpose.
- **Alternatives:** charge half of maximum MP, so an engaged player (whose MP is already
  halved) could not also attack; a flat +50 at every rank; round the cost up; name it Evade.
- **Why:** designer's call. A defensive choice that costs no Aether is always available;
  paying in current MP trades mobility for safety, leaving enough MP to attack but making
  it hard to run. Rounding down keeps it castable on 1 MP.
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: decided and built. `SKILLS.dodge` in config.js carries the bonus in its
    tiers and the new MP cost value `'half'` (`DODGE_MP_DIVISOR`), which `Action.spendMP`
    and `mpLabel` in actions.js understand. `executeDodge` sets `player.dodgeSkillBonus`;
    `Player.dodge()` adds it; `advanceTurn` clears it; `checkSkillUsage` blocks a second
    cast. The turn-end save runs before the enemy phase, while the bonus is up, but the
    field is transient: it stays out of `Player.toJSON`, starts at 0 in the constructor,
    and SAVE_VERSION stays 4, so saves from before this change still load. A loaded game
    has no bonus up and Dodge can be cast again; that is harmless because a load resumes
    in the player phase and skips that turn's enemy phase. The optional skills
    went from 36 to 37, so 19 appear in a run and one of the 13 hut/Skill Seek skills has
    no hut of its own. ONTOLOGY (player fields, skill costs and usage, advance turn,
    player-damage rule, Numbers) and DYNAMICS (dodge lines, skill groups, skill table) were
    updated.

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

### D-32 Two of seven chaos spawns shoot; the Void Stalker is melee only — *Decided*
The Void Stalker has no ranged attack: it is the fast melee unit (speed 2) and nothing
else about it changed. Two slow melee units join the chaos pool, the Drudge (weak) and the
Brute (strong), both plain chasers with no ranged attack and no special drops.
CHAOS_SPAWN_POOL is two slots of Flux Archer and one each of Void Stalker, Breach Crawler,
Phase Wraith, Drudge and Brute, so two spawns in seven shoot and the Stalker is one in
seven. Each spawn roll still makes one enemy; the Drudge does not come in groups. The
opening scatter, the crawlers around breaches and WRAITH_CAP are unchanged. The Drudge and
the Brute draw from fixed cells on the main sprite sheet, for now, with no standout look.
- **Alternatives:** reweighting the old pool only, which leaves the Stalker shooting and
  has too few melee types to fill the slots; capping the number of archers on the map;
  softening the archer (shorter range or a weaker shot).
- **Why:** five of the seven slots (Stalker ×3, Archer ×2) were enemies that shoot, far
  above the 20 to 30 percent ranged share wildlife gets, and play felt ranged-heavy. The
  Stalker was only ever meant to be fast, not ranged. A fast melee unit cannot be
  disengaged from, so it should be uncommon, with ordinary ground units filling the pool.
- **Evidence:** play felt ranged-heavy (designer's playtest); the new mix is not measured.
- **History:**
  - 2026-11-27: decided and built. In config.js the Void Stalker def lost `range` and
    `rangedAttack`, ENEMY_TYPE and ENEMY_DEFS gained the Drudge and the Brute, and
    CHAOS_SPAWN_POOL was rewritten. index.js gained `FIXED_ENEMY_SPRITES` (the two fixed
    cells), which the token draw reads before `enemySprites` and `assignSprites` leaves
    out, and two token colours in `enemyColor`. `enemySprites` keeps its saved shape and
    nothing else saved changed, so SAVE_VERSION was not bumped; a game in progress draws
    from the new pool, and its Stalkers stop shooting. The Stalker was the only ranged
    chaser, so ChaosAI's prefer-ranged roll and CHASER_RANGED_PREFERENCE (0.5) had no user
    left and were removed; only guards and the boss fire outside kiting. ONTOLOGY's enemy lists,
    chaos-spawning rule, ChaosAI rule and Numbers rows, DYNAMICS's enemy table, spawn mix
    and dual-attack section, and CLAUDE.md's rendering notes were updated.

### D-33 Hovering a ranged enemy shows its shot strength and range — *Decided*
The context bar reads "name (HP hp/max)" for a melee enemy, as before, and
"name (HP hp/max, Ranged atk at range)" for an enemy that `enemyIsRanged`. The strength is
what `enemyRangedAttack(enemy, def)` returns, the same call the shot makes, so it includes
the Maw-proximity and corrupted-ground bonuses where the enemy stands; the range is the
def's `range`. The two forms are two text entries, `hud_enemy` and `hud_enemy_ranged`.
- **Alternatives:** reading `rangedAttack` straight from the def, which understates the
  shot near the Maw or on corrupted ground; changing the bar for every enemy.
- **Why:** a ranged token carries the arrow badge and its melee attack, but nothing showed
  how far it shoots or how hard, and the shot's strength differs from the melee attack.
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: decided and built. `updateHUD` in index.js picks the text key by
    `enemyIsRanged(def)`; text.js gained `hud_enemy_ranged`. Display only: nothing saved
    changed and SAVE_VERSION was not bumped. ONTOLOGY's read-only queries row for the
    context bar and DYNAMICS's readability paragraph were updated.

### D-25 Every enemy melee attack draws the player's replies — *Decided*
Every melee attack an enemy makes on its own turn goes through one function, which deals
the hit and then runs the player's reply effects, so counter_mastery answers wildlife,
monsters and ruin guardians as well as chaos. Enemy ranged attacks draw no reply. The
enemy's counter to the player's own melee strike is not an enemy attack and draws none. A
reply runs only while both the enemy and the player are alive, and runs whether the hit
landed or was avoided. counter_mastery's own roll is unchanged.
- **Alternatives:** keep it chaos-only and say so in the item's text.
- **Why:** the item's text promises a counter-attack on enemy melee, with no exception;
  one shared attack function keeps any later reply effect from being chaos-only by
  accident.
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: settled Q-3; decided and built. `EnemyAI.doEnemyMelee` in enemy_ai.js
    (moved up from ChaosAI) is the one place enemy-phase melee damage reaches the player; `tryAggroChase`
    now calls it instead of `dealDamageToPlayer`. The replies are the `MELEE_REPLIES`
    table (item special + what it does), so a second reply is a new entry. The player-alive
    check is new. ONTOLOGY's shared moves gained the enemy melee rule and Q-3 left its
    open questions; DYNAMICS and CLAUDE.md were updated.

### D-28 Riposte is a half-strength reply to enemy melee — *Decided*
A riposte weapon answers every melee attack an enemy makes on its own turn, like
counter_mastery but lighter: the same roll of weapon damage plus Might, halved rounding
down, plus the weapon's riposteDamage, less the enemy's defense, and never below 1 damage.
It follows the same reply rules as counter_mastery (both sides alive; fires whether the hit
landed or was avoided; none for ranged attacks or for the enemy's counter to the player's
own strike). A player with both effects gets both replies, counter_mastery first and
riposte only if the enemy is still alive. A riposte weapon no longer halves the enemy's
counter to the player's own melee strike.
- **Alternatives:** keep the halved enemy counter and drop riposteDamage; remove the
  effect.
- **Why:** this is what riposte was designed to be; the halved counter was a misreading of
  the design, and it left riposteDamage, the number printed on the item, unread.
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: settled the riposte part of Q-1; decided and built. `MELEE_REPLIES` in
    enemy_ai.js gained a riposte entry; each entry now gives only its strength and its log
    line, and `runMeleeReply` holds the roll, defense, minimum and kill for both.
    `RIPOSTE_DIVISOR` is new in config.js. The halving line left `MeleeAction.execute`.
    text.js gained `log_riposte` and `spec_riposte` now reads "Half-strength reply +N on
    enemy melee". No item field changed, so SAVE_VERSION was not bumped. ONTOLOGY's melee
    strike rule, enemy melee rule, Numbers table and Q-1, DYNAMICS, md/MAGIC_ITEMS.md and
    CLAUDE.md were updated.

### D-29 Warding does not reduce damage the player takes — *Decided*
Damage to the player is the roll less the player's defense, whatever its source. Warding
raises Aether and the skills that scale with it; it gives no defense. The unused
skill-damage branch in `dealDamageToPlayer`, which raised defense by Warding percent of
the roll, is removed along with the flag that selected it.
- **Alternatives:** wire it up by giving enemies attacks marked as skill damage; leave the
  dead branch in place.
- **Why:** enemies have no skills, so every caller passed false and the branch never ran;
  nothing the player reads mentions it and no save holds it. A parameter that is always
  false misleads whoever reads the function next.
- **Evidence:** not measured; behaviour is unchanged, since no caller ever set the flag.
- **History:**
  - 2026-11-27: settled the Warding part of Q-1; decided and built. `dealDamageToPlayer`
    in index.js lost its `isSkillDamage` parameter and the line that read it, so it takes
    (damage, source, opts); its three callers (the enemy counter in actions.js, enemy
    ranged and melee in enemy_ai.js) dropped the argument. No saved field changed, so
    SAVE_VERSION was not bumped. ONTOLOGY's damage-to-the-player rule and Q-1 no longer
    mention the reduction.

### D-30 ranged_defense adds to defense against ranged attacks — *Decided*
An enemy ranged attack is reduced by the player's defense plus the rangedDefenseBonus of
every equipped ranged_defense item. The bonus counts for that hit only: melee attacks and
the Character panel's defense figure do not include it, and the item's own text ("+N def
vs ranged") is the only place it shows. The order of checks is unchanged (ranged_immune,
Warp Shield, then dodge, before any damage is rolled) and a hit that lands still does at
least 1 damage. The bonus sizes stay 2 and 4.
- **Alternatives:** a percent reduction of ranged damage, which would need new numbers and
  new item text; removing the effect; counting only the best equipped item.
- **Why:** the item already says "+N def vs ranged", so a flat addition to defense is what
  the player has been promised, with the numbers already on the items. Summing over items
  matches how dodge and the other gear bonuses stack.
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: settled the ranged_defense part of Q-1; decided and built.
    `dealDamageToPlayer` in index.js adds
    `player.sumEquipped('ranged_defense', 'rangedDefenseBonus')` to `playerDefense()`
    when `opts.isRanged` is set. Before this nothing read rangedDefenseBonus, so the item
    did nothing. No item field or value changed, so SAVE_VERSION was not bumped. ONTOLOGY's
    damage-to-the-player rule, effect-pool notes and Q-1, and DYNAMICS's armor effect list
    and defensive mechanics, were updated. md/MAGIC_ITEMS.md listed the two ranged_defense
    rows under ranged_immune's name and verbs; they now carry their own.

### D-31 Dimensional Rend never takes the player below 1 HP — *Decided*
Dimensional Rend's HP cost is effectStrength − REND_HP_COST_OFFSET. A player with more HP
than the cost pays it and strikes at full strength, as before. A player whose HP is no
higher than the cost pays all but 1 HP and the
whole strike, weapon part and Vigor part together, is scaled by paid / cost and rounded;
the usual minimum of 1 damage still applies, and a log line says the strike was weakened.
Flat equipment bonus damage (Breach Jewel, Aether Signet, Chaos Attune) is not part of the
formula amount and is added unscaled.
At 1 HP the skill cannot be cast: its button is disabled with a reason, like any other
unusable skill, so no MP or turn is spent. The preview keeps showing the full cost and the
full-strength numbers whatever the player's HP.
- **Alternatives:** fizzle with no cost when HP is too low; scale only the weapon part and
  keep the Vigor part whole; a preview that follows current HP.
- **Why:** the old rule took the full cost from a player who could not afford it and then
  did nothing, so the skill could kill its caster for no effect. Paying what you have for a
  proportional strike keeps the skill usable at low HP without making the last HP free
  damage. Scaling the whole strike keeps one rule (the share paid is the share dealt). A
  fixed preview matches every other skill's preview, which describes the skill and not the
  moment.
- **Evidence:** not measured.
- **History:**
  - 2026-11-27: decided and built. `executeDimensionalRend` in actions.js pays
    min(cost, HP − 1) and scales `baseAmount()` when short; `SKILL_FORMULAS.dimensional_rend`
    stays the full-strength formula. `checkSkillUsage` in index.js blocks the skill at
    1 HP or less; the handler also returns false there, spending nothing, should a caller
    skip that check. text.js gained `why_rend_hp` and `log_rend_weakened` and lost
    `log_rend_fizzle` with the fizzle branch. Nothing saved changed, so SAVE_VERSION was
    not bumped. ONTOLOGY's skill usage and cost rules and DYNAMICS's Dimensional Rend row
    were updated. `node test/rend.js` casts the skill at every rank and HP from 1 to past
    the cost.
  - 2026-11-27: design-doc review. The cost's inline 4, written once in the handler and
    once in the preview, became REND_HP_COST_OFFSET in config.js, read through
    `rendHpCost` in actions.js by the handler, the preview and the test; no value or
    behaviour change. ONTOLOGY gained the constant's Numbers row, the handler's rule under
    Skill use and a never-below-1-HP invariant.

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

### 2026-11-27 — Core skills all carry minLevel 2

Channel Aether (3), Spirit Walk (6), Renew (4) and Retrain (4) had their minLevel set to 2,
matching Water Skip and Mountain Skip. The level is read only when Skill Seek filters the
optional skills, and a core skill is taught only by its scroll, at any level, so the assorted
values were misleading data. No rule changed and nothing saved changed.

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
Q-1 and Q-3 (filed as tracker ideas for discussion; Q-3 later settled as D-25), Q-2 (covered
by an existing tracker idea; later settled as D-10), Q-4, Q-5, Q-10, Q-14, Q-15, Q-17.

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
