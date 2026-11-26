# RATIONALE.md — Warrior

Why each current design choice in Warrior is the way it is, with the alternatives that were
considered, plus the questions still open. ONTOLOGY.md says what the rules are; this doc says
why. Decisions are `D-n`, open questions `Q-n`; IDs are stable and never reused. History of
how things changed lives in ARCHITECTURE_LOG.md.

**This is a stub, written while moving the docs to the ontology format.** It holds only the
decisions the designer ruled on during the conversion (2026-11-26) and the questions the
conversion left open. The larger body of decisions behind the game (most of the [D] rules in
ONTOLOGY.md, and the design story in DYNAMICS.md) is still to be written up here.

---

## Decisions

### Progression

### D-1 Level-up stat points may stay unspent — *Decided*
Done closes the level-up dialog with points unspent; they stay on the Character panel.
- **Alternatives:** force all points to be spent before the dialog closes.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.

### Breaches, the Maw and victory

### D-2 Breaches and the Maw are sealed by a Restore cast, with a chance — *Decided*
Once a breach's guardian is dead (and, for the Maw, the Unraveler gone and every breach
sealed), each Restore cast in range seals it with BREACH_SEAL_CHANCE or MAW_SEAL_CHANCE.
- **Alternatives:** seal by killing the guardian while adjacent, or by stepping onto the breach.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.

### D-3 The run is won by invoking RETURN after sealing the Maw — *Decided*
Sealing the Maw drops the RETURN scroll; invoking it (with a confirm) wins.
- **Alternatives:** win on killing the Unraveler; challenge the Maw after two sealed breaches
  by stepping onto it.
- **Why:** designer's call; to be filled in. Serves G-1 ("Seal the Maw and walk away").
- **Evidence:** not measured.

### Skills and gear

### D-4 Five skill slots — *Decided*
SKILL_SLOTS is 5 (keys 1-5).
- **Alternatives:** four slots.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.

### D-5 The weapon slot may be emptied — *Decided*
The player may unequip the weapon and fight unarmed (damage 1).
- **Alternatives:** the weapon slot can only be swapped, never emptied.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.

### D-6 Dodge uses gear-boosted Vigor — *Decided*
Dodge reads effective Vigor (base plus vigor_bonus gear), as defense and max HP already do.
- **Alternatives:** keep dodge on base Vigor.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.

### D-7 Hut Leave does not end the turn — *Decided*
Leaving a hut is free, as Leave is at havens and villages; only Learn ends the turn's movement.
- **Alternatives:** keep hut Leave ending the turn's movement.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.

### D-8 Ranged skills need a visible target — *Decided*
Ranged-skill targets need the enemy to be visible as well as in LOS, like weapon shots.
- **Alternatives:** keep LOS-only targeting for skills.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.

### D-9 Gear changes only in the player phase — *Decided, unbuilt*
Equipping and unequipping from the Inventory panel will be allowed only while phase is
'player'. The code has no phase check; filed as a tracker task.
- **Alternatives:** allow gear changes at any time, including the enemy phase.
- **Why:** designer's call; to be filled in.
- **Evidence:** not measured.

---

## Open questions

Raised by the SPEC.md → ONTOLOGY.md conversion. Recommendations are Claude's.

### Q-1 Inert or half-wired gear effects
ranged_defense, displacement_immune, high_def_mp_penalty's defBonus, riposte's
riposteDamage, and Warding's skill-damage reduction exist in data or code but do nothing (or
only part of what they say). Filed as a tracker idea for discussion.
- **Options:** wire each one up; remove each one; mix per effect.
- **Recommendation:** decide per effect; wire the ones whose text players see on items, drop
  the rest.

### Q-2 Dead effect names from retired items
regen_combo, mp_penalty, armor_aether_bonus, wall_crown and cleave are still referenced but no
live item carries them. An existing tracker idea covers tying them back to items or dropping
them.
- **Options:** tie them back to new magic-item effects; delete the references.
- **Recommendation:** delete the references unless the tracker idea revives them as effects.

### Q-3 counter_mastery fires only against chaos melee
Wildlife melee does not trigger it. Filed as a tracker idea for discussion.
- **Options:** extend it to all melee attackers; keep it chaos-only and say so in its text.
- **Recommendation:** extend it to all melee, unless chaos-only is meant as flavour.

### Q-4 Map validation keeps an invalid map after MAP_ATTEMPTS
If every attempt fails the stricter check, the last map is kept anyway.
- **Options:** keep as is; keep retrying until valid; relax the check on later attempts.
- **Recommendation:** relax the check on later attempts so a run never starts on a failed map.

### Q-5 Inline literals have no constant names
Many tunables (marked † in ONTOLOGY) are inline literals.
- **Options:** name them as constants in config.js; leave them inline.
- **Recommendation:** name them, using the proposed names in ONTOLOGY's Numbers table.

### Q-10 Enemies sense the player through fog by distance alone
Aggro uses hex distance with no fog or LOS check.
- **Options:** keep distance-only sensing; require LOS (or forest stealth rules) to notice.
- **Recommendation:** keep it unless playtests show it feels unfair; it keeps pressure up.

### Q-14 No seeded randomness
All randomness goes through `Rando` over `Math.random`.
- **Options:** add a seed to Rando; keep unseeded.
- **Recommendation:** keep unseeded for now (a non-goal); a seed becomes worth it if a headless
  sim or tests need reproducible runs.

### Q-15 Chaos drops may duplicate owned mundane items
Crawlers and guardians drop random mundane items whether owned or not.
- **Options:** keep; prefer unowned items as breach loot does.
- **Recommendation:** prefer unowned items, falling back to owned when none remain.

### Q-17 SKILL_POWER previews mirror the handlers' formulas
Skill-power previews recompute the formulas instead of calling the handlers' code.
- **Options:** keep the mirror; factor shared formula functions both call.
- **Recommendation:** factor shared functions so the preview is the rule.

---

## Deliberately left out

- **Save migration or back-compat for old saves** [D]. A version mismatch shows "New Version"
  and the save is not loaded.
- **Multiplayer or a server; mobile/touch play** [P] (ONTOLOGY non-goals).
- **Seeded or reproducible runs** [P] (ONTOLOGY non-goal; open as Q-14).
