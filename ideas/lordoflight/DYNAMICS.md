# DYNAMICS — The Great-Souled Sam
*A game of heresy, karma, and rebirth, adapted from Roger Zelazny's* Lord of Light.

## Theme

**Hunted prophet.** The emotional experience is being one clever, mortal-scale man
waging an insurgency of *ideas* against an overwhelming, personified power structure —
spreading heresy faster than Heaven can stamp it out, and being reborn faster than
Heaven can kill you. The player should feel defiant, outmatched, and sly: every sermon
is a torch lit and a flare fired at the same moment.

Source-material extraction (relationships, not plot beats):
- *Sam vs. the Deicrats* → an escalation race: your progress **is** the difficulty dial.
- *The Lords of Karma / body shops* → death is a purchasable setback; poverty is the true death.
- *Binding the Rakasha* → power borrowed from demons always has a leash on both ends.
- *Named gods with Aspects* → enemy identity: the hunter that burned Alundil has a name.

## Key Drivers (the load-bearing three)

1. **Escalating Commitment** — you cannot win by hiding; only preaching raises
   Enlightenment, and preaching raises Heaven's Wrath, which deploys ever-stronger gods.
   Your victories summon your punishers.
2. **Loss Aversion over Reward-Seeking** — karma is life itself: the same pool buys
   combat power, demon allies, and *your next body*. Spending it is always spending
   your own resurrection.
3. **Information as Currency** — the gods hunt your *last-seen* position, not you.
   Preaching reveals you; travel and meditation conceal you. You trade visibility
   for progress every single turn.

## Key Mechanics (one per driver)

1. **The Wrath track** *(escalating commitment)* — preaching and conversions raise Wrath;
   at fixed thresholds Agni, then Kali, then Yama descend from Heaven and never stop hunting.
2. **One karma pool** *(loss aversion)* — karma in, karma out: converted cities tithe it;
   fighting, demon-binding, exorcism, and rebirth all drain it. Rebirth cost climbs with
   each death. Zero karma + dead = the real death.
3. **Last-seen hunting** *(information as currency)* — gods pathfind toward where Sam was
   last revealed (preaching reveals; a lost fight reveals). Moving and meditating hide him.
   A god that arrives and finds nothing loses the scent and falls back to purging converted cities.

## Secondary Mechanics (each names its driver and its parent mechanic)

- **Conversion rings** — each city needs 3 sermons to convert; converted cities tithe
  karma and radiate Enlightenment each turn. *(Accumulation; feeds mechanic 2.)*
  Win at Enlightenment 100.
- **Named gods with one exception each** *(enemy identity, roles through exceptions)*:
  - **Agni** (slow, deploys first) — *burns* converted cities he enters: conversion to zero,
    scorched scar on the map, Enlightenment loss. *(Revenge fuel; feeds mechanic 1.)*
  - **Kali** (fast, deploys second) — moves 2 roads per turn; the one you can't outrun,
    only out-think. *(Near-miss architecture; feeds mechanic 3.)*
  - **Yama** (deploys last) — deathgod, near-unbeatable power; but demons *love* fighting
    him — demon combat aid is doubled against Yama. *(Counterplay for the apex threat.)*
- **Slain gods reincarnate** — a defeated god retreats to Heaven and redeploys several
  turns later **one power stronger** (the Lords of Karma serve Heaven too).
  *(Escalating commitment; you can buy time but never safety.)*
- **Rakasha binding (double-edged)** — at Hellwell, spend karma to bind a demon to a god;
  the harried god loses half its movement and Sam gains the demon's power if they battle.
  But each turn the demon may break free and *possess* your nearest converted city,
  freezing its tithe until you travel there and exorcise it. *(Variable reinforcement +
  loss aversion; borrowed power endangers what you guard.)*
- **Karma channeling in battle** — spend karma in 10-point increments for +1 battle power
  (max +3). Literally burning your future lives for the present fight. *(Loss aversion.)*
- **Bodies as templates** — every rebirth deals a random new body: a parameter set
  (power + one perk: warrior, frail preacher-monk, un-catchable thief, tithing merchant,
  demon-binding prince). No bespoke rules per body. *(Variable reinforcement on a
  competence backbone; template-not-snowflake.)*
- **Hellwell sanctuary** — gods will not enter the flame pits; Sam can. A bolt-hole,
  not a home: no preaching there, and unguarded cities get purged while you cower.
  *(Scarcity of agency: safety costs the map.)*
- **Hidden-search brush** — a god entering Sam's city while he's hidden has a 40% chance
  to unmask him; otherwise it passes within arm's reach and the log tells you so.
  *(Near-miss architecture.)*

## Gut Checks

- Fire god burns cities: intuitive. Death god is strongest: intuitive. Demons betray:
  intuitive. Preaching draws attention: intuitive. Buying a new body with karma:
  the book's own logic, established in the intro text.
- The one deliberate inversion — *killing a god makes it come back stronger* — is
  announced in the log the moment it first happens ("the Lords of Karma grow him a
  mightier body"), so it reads as the setting's logic, not a bug.

## State Fits in a Struct

`{ rng, turn, phase, sam{city, bodyId, hidden, lastSeen}, karma, wrath, enlightenment,
deaths, cities{conversion, burned, possessedBy}, gods[{power, speed, status, city,
respawnIn}], demons[{bound, power}], log[] }` — every mechanic above reads or writes a
named field here; nothing is tracked implicitly.

## Strategies

- **Early game — the quiet circuit:** convert the far-southern cities before Wrath 20
  wakes Agni; income compounds before the first hunter lands.
- **Mid game — the flare-and-fade:** preach (revealing yourself), then spend the next
  turns traveling *away* from the flare while gods converge on stale information.
  Recurring tension: every sermon restarts the manhunt clock.
- **Karma triage (the recurring tension):** the same 30 karma is one demon, three combat
  pips, or most of a rebirth. Spending decisions are always mortality decisions.
- **Demon gambit:** bind Taraka onto Kali to halve the only fast hunter — accepting that
  a converted city may fall to possession while you're across the map.
- **Yama protocol:** never fight Yama without a demon; route him near Hellwell,
  or keep a thief-body flee option alive.
- **Anti-strategy — Hellwell turtling:** prevented mechanically: no Enlightenment gain in
  Hellwell, and unhunted gods purge/burn converted cities, so the win track *decays*
  while you hide.
- **Anti-strategy — god farming for karma/Enlightenment:** prevented: slain gods return
  stronger and victory raises Wrath, so each farm cycle worsens the field.
- **Anti-strategy — never preaching (stealth forever):** impossible: Enlightenment only
  rises through conversion; the win condition forces exposure. *(This is driver #1.)*
- **Rival constraints check:** gods have information limits (last-seen), terrain rules
  (same roads, no Hellwell), commitment (walk the whole path, lose the scent on arrival),
  and counterplay (demons, decoy sermons, flight). They can be outmaneuvered, not merely
  outraced.

## Tuning Notes

- Preach +34 conversion → exactly 3 sermons per city.
- Wrath thresholds 20 / 45 / 70 → the hunt escalates roughly in thirds of a run.
- Rebirth cost 25 + 15×deaths → the second death hurts, the fourth is usually the real one.
- All randomness is seeded (mulberry32 in state) → deterministic tests, reproducible runs.
