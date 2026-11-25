# Power Quest — Architecture Log

Dated entries, newest first. This is the only doc that records what something used to be.

### 2026-11-18 — Power Quest forked from the Hex & Counters base
The Hex & Counters movement puzzle (single player counter, target hex, wandering enemies, no combat)
was replaced by Power Quest: open-ended, fogged 80×60 map of plains, jungle and mesa; a leveling hero in
power armor; villages with tier and trust; hunting, crafting, charge, shutdown and founding. New docs
written for the new game: DYNAMICS, ONTOLOGY, CRITERIA (R-1…R-31), RATIONALE (D-1…D-24, Q-1…Q-6).
- **Removed:** `MOUNTAIN`, `HILLS`, `FOREST`, `SCRUB`, `ROUGH` terrain; the target counter and win state;
  per-enemy ColorTheory colors (`colortheory.js` stays in the tree, unloaded); the base's R-1…R-23 and
  `smoke.js`; the "progress to end" meter.
- **Added modules:** `pieces.js` (Hero, Creature, Village, Ruin, Lair), `worldgen.js` (map and sites),
  `ecology.js` (enemy phase, lair spawning). `GameEngine` now holds all hero rules.
- **Kept:** the five-way split (artifacts / display artifacts / state / engine / UI), seeded `Rando`,
  `Board` queries, `bfsHexes`, plain-script globals, the R-n test layout and coverage test, the click-or-pan
  input model.
- **Tuning from the first bot runs (see RATIONALE D-5, D-7, D-16, D-20):** `XP_STEP` 10→25;
  `RAID_DAMAGE_PER_HIT` 1→0.5 with tier-scaled village regeneration; home village always open; convalescent
  shelter after shutdown; wild respawn and lair re-arming added after the map emptied. These changed
  together between sim runs, so no single one is attributed.
- Settled with the designer: after a shutdown charge and hp come back depleted (D-8); no perk cap (D-9).
