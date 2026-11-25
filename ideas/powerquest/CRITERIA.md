# Power Quest — Criteria

How we know the build is right. Each row has a stable ID that is never reused. Rules are in
[ONTOLOGY.md](ONTOLOGY.md), cited by name; constants are cited by name, never by value.

**Instrument** is the row's status: `automated`, `manual — <what a human checks>`,
`not yet covered`, or `retired`. An `automated` R-row owns `test/R-n/`; each test there asserts
that one rule, with its cases commented in the test itself. **Test command:** `node test/run.js`
(`-v` for every check); `test/coverage.js` fails when this table and the `test/R-n/` directories
disagree. Tuning harness: `node test/sim.js [turns] [seeds]`.

---

## R — Rules (automated)

| ID | Given | Expect | Instrument |
|---|---|---|---|
| R-1 | `newGame(seed)` | `hexes.size === MAP_COLS × MAP_ROWS`; each `(col,row)` once; key `"q,r"` with `q = col - floor(row/2)`; `isEdge` is exactly the outer ring and edges are WATER | automated |
| R-2 | any generated map | water, mesa counts follow `WATER_PCT`/`MESA_PCT` over inner hexes ranked by elevation; the wettest `JUNGLE_FRAC` of the rest is jungle; mesa is higher than all other land | automated |
| R-3 | a generated world | every site on the largest land mass; sites ≥ `SITE_MIN_DIST` apart, villages ≥ `VILLAGE_MIN_DIST`, lairs clear of home (`HOME_SAFE_DIST`) and villages (`LAIR_VILLAGE_MIN`); one home village at `HOME_TRUST`, the rest at `START_TRUST`; home reaches every village; hero starts on home | automated |
| R-4 | the same seed twice, then another seed | identical terrain and state for the same seed; different terrain for another | automated |
| R-5 | `KNOWN_GOOD_SEED` | `WorldGen.build` succeeds in one attempt | automated |
| R-6 | perks and sockets set | `heroStats` = base + perk ranks × amount + passive module amounts; weapons and actives add nothing | automated |
| R-7 | `gainXp` across thresholds | level at `XP_STEP × level`; one perk offer per level; sockets grow every `SOCKET_LEVEL_STEP` levels; hp and charge not refilled | automated |
| R-8 | a perk offer pending | `pickPerk` ranks the perk and pops the offer; bad indexes refused; `move`/`endTurn` refused until picked | automated |
| R-9 | the hero with mp | `computeReachable` maps every hex within mp to its cheapest cost; jungle/mesa cost `MOVEMENT_COST`; enemy hexes and water are walls; empty at 0 mp; hero hex excluded | automated |
| R-10 | `move` to unreachable hexes, then a reachable one | illegal moves return `ok:false` and change nothing; legal moves spend exactly the cost and emit `move`; refused outside the hero phase | automated |
| R-11 | the hero on plains, jungle, mesa | sight radius is `BASE_SIGHT` ± terrain; hexes in sight are explored; sites in sight are discovered (jungle sites only within `JUNGLE_HIDE_RADIUS`); only enemies in sight are visible | automated |
| R-12 | `attack` | adjacent enemy only; costs `MELEE_MP`; damage in melee … melee + `DMG_SPREAD`; `hit` event; refused at 0 mp | automated |
| R-13 | `shoot` | needs a weapon in the socket, range (+`MESA_RANGE_BONUS` on mesa) and charge; spends charge not mp; damage in dmg … dmg + `DMG_SPREAD` | automated |
| R-14 | `activate`, `boost` | heal capped at hpMax, shield added, both cost charge; `boost(n)` converts n charge to mp; bad n refused | automated |
| R-15 | a kill | xp = kind xp (× `REVENGE_XP_MULT` for a nemesis, × `HOME_XP_MULT` near an open village); loot = drop (+ loot stat); villages within `TRUST_RADIUS` gain `KILL_TRUST_PER_TIER` × tier | automated |
| R-16 | a guardian killed | its lair deactivates, loot doubles; after `LAIR_REARM` turns the lair re-arms with a new guardian | automated |
| R-17 | `deposit` | pack → stock; tier follows `TIER_COSTS`; trust += value / `GIFT_VALUE_PER_TRUST` capped by the gift bucket (`GIFT_CAP`); closed villages accept; bad amounts and off-village refused | automated |
| R-18 | `craft` | needs an open village, the blueprint, village tier ≥ module tier − 1, and the price; fills or replaces a socket; each failure refused with no change | automated |
| R-19 | `found` | plains, off sites, ≥ `FOUND_MIN_DIST` from villages, parts held, and a village with trust ≥ `FOUND_TRUST` within `FOUND_RADIUS` (or no open village); creates a tier-0 village at `FOUNDER_TRUST` | automated |
| R-20 | `endTurn` | turn +1, mp refilled, shield cleared, phase back to hero; refused while a perk offer is pending | automated |
| R-21 | the world phase | charge regenerates by `chargeRegen`; an open village adds hp (`HEAL_BASE` + `HEAL_PER_TIER` × tier) and full charge; a closed one does not; a ruin hex fills charge | automated |
| R-22 | hero hp reaches 0 | shutdown: `SHUTDOWN_DAYS` pass, pack and xp cut by `LOSE_*_FRAC`, level kept, hero at the nearest open village (door stays open) at `SHUTDOWN_HP` with 0 charge; attacker becomes a nemesis; a sheltered hero cannot be attacked until it leaves or heals to half | automated |
| R-23 | raiders beside a village | village hp drops by dmg × `RAID_DAMAGE_PER_HIT` − tier (≥ `MIN_DMG`); at 0 it loses a tier, at tier 0 it is ruined; ruined villages are ignored | automated |
| R-24 | the enemy phase | raiders walk to the nearest village and stop adjacent; non-guardians never enter mesa or water or sites; beasts within `AGGRO` close on the hero; wanderers stay within `ROAM_LEASH`; guardians within `GUARD_LEASH` | automated |
| R-25 | lair timers | one offspring per `LAIR_SPAWN_PERIOD`, at most `LAIR_CAP`; camps breed raiders; inactive lairs do not breed | automated |
| R-26 | `tierFor`, `siteTier`, `pickKind` | +1 tier per `TIER_DIST` from villages and per `TIER_LEVELS` hero levels, capped at `MAX_ENEMY_TIER`; picks respect the cap and group | automated |
| R-27 | entering a ruin | blueprint learned (or extra cells if known), `RUIN_CELLS` cells, `DISCOVERY_XP`, once | automated |
| R-28 | turns pass | a village farther than `NEGLECT_RADIUS` loses 1 trust per `DECAY_PERIOD`, floor 0; near or closed villages do not | automated |
| R-29 | every command, illegally | `ok:false`, no events, state unchanged | automated |
| R-30 | same seed + same commands; the engine sources | identical final state; no DOM, display-artifact or unseeded randomness references in the engine modules | automated |
| R-31 | fewer than `ROAMER_FLOOR` wild creatures | wild ones appear, never within `ROAMER_SPAWN_MIN_DIST` of the hero, never beyond the floor | automated |

## U — UI / readability

| ID | Criterion | Instrument |
|---|---|---|
| U-1 | The game runs from `file://` by double-clicking `index.html` | manual — open it, press Begin |
| U-2 | Click the hero: reachable hexes tint yellow, attackable enemies red, shootable enemies orange; clicking a tinted hex acts | manual — select and act |
| U-3 | Unexplored hexes are dark, explored-but-unseen hexes dim, and enemies appear only inside sight | manual — walk and watch |
| U-4 | The HUD shows level, xp bar, hp, charge, mp, pack, and the village tier/trust when on or near one | manual — read the HUD |
| U-5 | A level-up opens a perk picker that blocks other input until chosen | manual — gain a level |
| U-6 | At a village, a panel offers deposit, crafting (with price and the reason when unavailable), and rest info | manual — enter a village |
| U-7 | The message log narrates hits, kills, loot, trust, raids, shutdowns | manual — play a few turns |
| U-8 | A nemesis is drawn with a skull mark and named in the log | manual — be shut down |
| U-9 | Hovering an enemy shows name, kind, tier, hp, range | manual — hover |
| U-10 | The hover readout shows terrain, move cost and sight modifiers | manual — hover |

## X — Experience / outcomes (measured or playtested)

| ID | Criterion | Linked decision · Instrument |
|---|---|---|
| X-1 | The first levels come quickly enough to feel like growth: a bot reaches level 5 within ~100 turns. Fails if it takes most of 300 | D-5 · manual — `node test/sim.js 300` |
| X-2 | The hero is not trivially safe: the bot is shut down at least once in some games by turn 500. Fails if no game in 8 sees one | D-3 · manual — `node test/sim.js 500 8` |
| X-3 | Villages are under real pressure: not all villages survive 500 turns of a hunting bot, and not all fall | D-7 · manual — `node test/sim.js 500 8` |
| X-4 | The player can name what they would craft next and what blocks them | D-6 · manual — playtest |
| X-5 | A shutdown stings but doesn't end the run: players resume within a few turns | D-8 · manual — playtest |
| X-6 | Founding a second village feels like a choice, not a chore | D-15 · manual — playtest |

## Status

2026-11-18. R-1 … R-31 automated. **Partial coverage:** R-24 checks movement rules on a flat arena, not
on a full generated map; R-25 does not check that offspring appear on a free neighbor in tight terrain;
R-3 checks one seed. U-rows and X-rows are manual and unrun. X-1…X-3 have a bot harness (`test/sim.js`)
whose bot is more disciplined than a human, so its numbers bound the pace, not set it. Last bot run
(`node test/sim.js 500 8`): level 3–5 at turn 100, shutdowns in 6 of 8 games, 2–3 of 5 villages standing at turn
500, so X-1, X-2 and X-3 hold for the bot; no human has played it. `test/integration/ui_smoke.js` drives the
input handlers on a stub DOM, so U-rows remain unchecked for look and feel.
