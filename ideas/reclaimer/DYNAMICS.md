# Reclaimer — Game Dynamics

This is a design journal, not a spec. It answers **"why is this fun?"** before it says
what the buttons do. Numbers are starting points, tuned by halve-and-double.

---

## 1. Theme

**A beleaguered pioneer clawing a dead world back to life, one hex at a time.**

Not "sci-fi tactics on hexes." The *feeling* is: you landed with nothing but a blaster and
a hull full of sleeping people, the blight is everywhere and it is patient, and every meter
of clean ground you win is bought with a risk you can't afford. The satisfaction is the
frontier creeping outward on the map — corruption receding, lights coming on in your
settlement — set against the dread that your perimeter is now longer than you can hold.

The economy is not a side system. The core question the player asks every turn is a
**budget** question dressed as a survival question: *guns, ground, or people?* Spend on
weapons and you don't expand. Spend on expansion and you don't defend. Wake colonists and
you have more hands — and more mouths, and a louder heat signature drawing the swarm.

---

## 2. Key Drivers (the load-bearing pillars)

The theme naturally activates three:

1. **Accumulation and Windfall** — the reclamation economy. Territory compounds: clean
   hexes produce, production funds expansion, expansion produces more. Patient investment
   tips into windfalls (a relic weapon, a corridor cleared that unlocks a whole region).
2. **Escalating Commitment** — the frontier. Reclaiming ground *lengthens your perimeter*
   and *raises the heat*, so success makes survival harder. To win you must push to the map
   edges and kill the source; you cannot turtle your way out.
3. **Scarcity of Agency** — one captain, few actions, a spreading emergency. You can never
   cleanse, build, defend, and scout in the same turn. Choosing which fire to let burn is
   the game.

Woven throughout: **Loss Aversion** (the blight eats what you built), **Guardianship**
(the Lander and named colonists), **Revenge** (the alien that breached your wall is still
on the board).

---

## 3. State Model (write it early — it exposes hidden complexity)

Everything below must live in a field. If a mechanic needs state with no home here, the
mechanic is too vague or this model is incomplete.

```javascript
// Per hex (extends the baseline hex object)
{ q, r, col, row, elevation, terrain,     // terrain: water|plains|forest|hills|mountain
  corruption,      // 0..3   0 = clean, 3 = node (breeds a Breeder)
  controlled,      // bool   inside settlement influence
  deposit,         // null | 'minerals' | 'biomass' | 'relic'
  structure,       // null | { type, hp, ... }
  units }          // occupant refs (usually 0..1)

// Colony (global)
{ materials, rations,          // the two economies
  frozen,                      // count of colonists still in cryo
  units,                       // captain + awakened colonists + turret actors
  lander,                      // { q, r, hp }  the crashed ship = home base
  turn,
  influence }                  // Set<hexKey> recomputed from beacons/Lander each turn

// Unit (captain | colonist | alien)
{ id, kind, q, r, hp, maxHp, mp, faction,   // faction: 'colony' | 'alien'
  weapon,          // { range, dmg, aoe }  captain/soldiers only
  speed,           // aliens: rolled at spawn (variable-speed dread)
  fedThisTurn }    // colonists: upkeep bookkeeping

// Threat (the escalation engine, derived each turn — not free-floating)
threat = base + turn*k_t + unitsAwake*k_u + controlledHexes*k_c
```

`threat` is the single knob the escalation crescendo reads from. It sets alien spawn rate,
alien HP/speed rolls, and corruption spread pressure. Everything that feels like "the game
getting harder" routes through this one number, so consequences stay traceable.

---

## 4. Key Mechanics (one sentence each; driver named)

### M1 — Influence & the Reclamation Frontier
**The Lander and Beacons project Control over hexes within an influence radius; you may only
act on controlled hexes or the frontier ring adjacent to them, and controlled clean ground is
where you build — the income engine is the Lander recycler plus structures, not raw area (§10).**
*Driver: Accumulation (economy compounds), Escalating Commitment (bigger territory = longer
frontier), Scarcity (you can't act beyond the frontier).*
Reclamation is literally ring-by-ring: you can only reach out one hex past what you hold.

### M2 — Corruption (the spreading blight)
**Corruption is a per-hex level (0–3) that spreads to adjacent hexes under threat pressure,
suppresses control and production, and damages colony units standing in it; ambient spread
tops out at level 2, while the level-3 nests are a fixed seeded set that scar their own
neighbors but never multiply — so "destroy every nest" stays a bounded, targetable goal and
the escalation comes from the threat curve, not from nests breeding more nests.**
*Driver: Escalating Commitment, Loss Aversion (it reclaims what you cleaned), Terrain as
Language (the blight *is* the level design).*
Double-edged / shared obstacle (Asymmetry): corruption **hurts your units but heals aliens**
that stand in it, so the same terrain is your hazard and their fortress.

### M3 — Cleansing (the restore verb)
**A unit spends its one action for the turn to lower an adjacent hex's corruption by one (no
material cost); a hex brought to 0 while contiguous with your control and within influence
joins your territory.**
*Driver: Accumulation (each cleanse is frontier gained), Repair/Restore verb, Loss Aversion.*
The throttle is the **action economy**, not currency: a unit cleanses *or* builds *or* fires
each turn, so reclamation speed is bounded by how many colonists you've woken (M4) — that's
where "guns vs. ground vs. people" actually lives. (Materials-to-scrub failed the gut-check;
cut it.)

### M4 — Awakening Colonists
**At the Lander (or a Cryo-bay) you spend rations to thaw a frozen colonist into a worker
unit, gaining an actor — but every awake colonist eats rations in upkeep each turn and raises
the threat that draws the swarm.**
*Driver: Scarcity→Agency trade (more hands, but each is a standing cost), Guardianship (named,
mournable), Loss Aversion, Escalating Commitment (heat climbs).*
Gut check: waking more people makes the aliens angrier because a bigger, warmer, noisier
colony is easier to sense — the player feels the logic, it doesn't read as a bug.

### M5 — Combat & the Blaster
**Units attack adjacent aliens; the captain's blaster is ranged (and upgradeable); killing a
Breeder stops a node's spawns, after which the node hex can be cleansed and reclaimed.**
*Driver: Revenge (the breacher is trackable — Enemy Identity), Scarcity (attacking is an
action you didn't spend on the economy), Near-Miss.*
Fight *then* farm: you shoot your way to a node, kill the Breeder, and only then can your
colonists move in to cleanse and claim it. Combat and economy share one frontier.

### M6 — Structures (the settlement)
**Buildings are placed on controlled hexes for materials and act every turn as one of three
templates — Aura, Producer, or Defender — extending, feeding, or guarding the frontier.**
*Driver: Accumulation (compounding infrastructure), Landmarks as Anchors, Guardianship.*
See §6 for the templates. A structure is a parameter set, not a bespoke system.

---

## 5. Turn Structure (the code-check spine)

```
PLAYER PHASE
  for each colony unit: spend mp/actions on M9 actions (move/cleanse/build/gather/attack/awaken)

ECONOMY PHASE
  influence = flood(lander + beacons, radius)          // M1 recompute
  for each controlled clean hex: += resource trickle by terrain/deposit
  for each Producer structure: += yield
  rations -= unitsAwake * upkeep                        // M4 upkeep
  if rations < 0: starve() → thawed colonists lose hp / go dormant, rations floored at 0

CORRUPTION PHASE  (Ecology over Choreography — probabilistic, not scripted)
  threat = recompute()                                 // §3
  for each corruption hex L>0:
     with p(threat): raise a neighbor by 1 — cap 2 for ambient blight, cap 3 only from a live node
  for each Purifier aura: lower corruption in radius by 1 (never below a live node's floor)
  // nests are the seeded set — none spawn spontaneously; escalation is carried by threat

ALIEN PHASE  (animate it — §8)
  spawn: each Breeder, with p(threat): emit an alien (type by threat, speed 1d6)
  move: A* toward nearest colony asset (unit > structure > Lander); walk `speed` hexes
        (full global pathfinding, never local BFS)
  act:  adjacent alien attacks unit/structure/Lander; spitters raise corruption instead
        aliens standing in corruption heal
  DEATH IS AN EVENT: an alien that steps onto a unit's hex kills it on screen, now

CHECK
  win  if frozen == 0 AND no Breeders remain on the map
  lose if lander.hp <= 0  OR  (units empty AND frozen == 0)
```

Each mechanic above is ≤5 lines of pseudocode. If one grows past that, it's two mechanics.

---

## 6. Templates (template, don't snowflake)

### Structure templates (3)
| Template | Every-turn behavior | Examples (params) |
|---|---|---|
| **Aura** | apply an effect to hexes/units in radius | **Beacon** (+influence radius), **Purifier** (−1 corruption in r), **Med-tent** (heal units in r) |
| **Producer** | add resources | **Extractor** (deposit→materials), **Farm** (biomass hex→rations) |
| **Defender** | attack aliens in range | **Turret** (auto-fire r=2), **Wall** (r=0, blocks movement, high hp) |

One `applyStructure(struct, board)` dispatch over `struct.type` → template fn. Adding a
building is a row in a table, not a new code path.

### Unit templates (3)
- **Captain** — hero; ranged blaster; irreplaceable (dies → respawns at Lander after a delay,
  costing rations; if no rations, game continues only via colonists). Role: reach and range.
- **Colonist (worker)** — moves, cleanses, builds, gathers, fights weakly. The economy's hands.
- **Specialist** (awakened later / via tech) — a worker with one **mechanical exception**:
  *Engineer* cleanses 2 levels per action, *Soldier* carries a blaster, *Scout* has extra mp
  and reveals fog. Identity by the rule they break, not stat deltas.

### Alien templates (params over hp/speed/target/on-hex)
- **Swarmling** — low hp, fast, targets nearest unit. The dread of the 1d6 roll.
- **Mauler** — high hp, slow, targets structures/Lander. The siege clock.
- **Spitter** — ranged; instead of damage, **raises corruption** — it re-seeds the blight,
  looping combat back into M2.
- **Breeder** — immobile node-spawn; the win-condition target; killing it opens the hex.

### Action templates (M9 — one dispatch, cost baked in)
`Move · Cleanse · Build · Gather/Repair · Attack · Awaken`. Each is `(unit, targetHex)` with a
cost checked against mp + materials/rations. Costs live *in the reachability/legality calc*
(Bake Costs Into Systems): a hex you can't afford simply doesn't highlight — no modal, no
error. The player learns the price by seeing the frontier.

---

## 7. Discovery & Information (secondary systems, woven in)

- **Fog beyond influence.** Hexes outside ever-controlled range are unrevealed. Scouting
  (a Scout's move, or a Beacon coming online) reveals deposits and **relic caches**.
  *Driver: Scarcity (scouting is an action), Accumulation (map knowledge compounds).*
- **Relics = weapon/tech windfall** (Low-Probability Hope). A cache grants a blaster upgrade
  (range/dmg/aoe), a Specialist unlock, or a one-use mobile purifier. Rare by design — the
  *possibility* is what sustains morale through attrition. This is the earned windfall the
  Accumulation pillar builds toward.
- **Deposits** make terrain legible: minerals under hills, biomass in forest/plains, relics
  in mountains you must fight the blight to reach. Map generation becomes level design.

---

## 8. Feel Notes (how the rules reach the player)

Built on the counter UI (gold player counter, reachable hexes highlighted, right-drag pan).
- **Corruption is visible weather**, not a stat — the player reads the board's "sickness" at a
  glance and sees it recede where they've worked.
- **Animate the alien phase** — hop-by-hop movement, a turret flash, a death bang when a
  colonist falls. Consequences must land where the player can watch them (see the skill's
  *Death Should Be an Event*). The alien that did it stays on the board: a revenge target.
- **The Lander is the emotional anchor** — a named place you defend and respawn from; its hp
  bar is the game's heartbeat.

---

## 9. Strategies (adversarial review — every anti-strategy must map to a real mechanic)

### Intended arcs
- **Early (foothold).** Captain solo-cleanses the ring around the Lander, builds one Extractor
  and one Purifier, wakes 1–2 colonists. Tight, cheap, defensible. Engages M1/M3/M4/M6.
- **Mid (frontier war).** Push toward the nearest deposits and a Breeder node; Soldier +
  captain clear it, colonists cleanse and claim; a Turret line freezes the reclaimed border.
  Economy now funds both guns and growth. Engages M2/M5 + the guns-vs-ground tension.
- **Late (the purge).** Threat is high; you must strike the edge nodes and wake the last
  colonists before the swarm outpaces your perimeter. The crescendo of Escalating Commitment.

### Recurring tensions (a genuine decision every turn)
- **Guns vs. ground vs. people** — materials to weapons/walls, or to cleansing, or rations to
  colonists. The three-way pull is the game.
- **Push vs. hold** — every hex claimed is production gained *and* perimeter (and threat)
  added. M1 + threat make this self-balancing.
- **Wake now vs. wake later** — agency vs. upkeep vs. heat (M4).

### Anti-strategies and their mechanical prevention
- **Turtle a single fortified city.** *Prevented by:* win requires **zero Breeders**, which sit
  at the map edges — you must leave. And `threat` climbs with `turn`, so corruption spread
  pressure eventually outpaces any fixed Purifier line (Escalation Tied to Progress). Waiting
  loses.
- **Awaken everyone immediately for max actions.** *Prevented by:* ration **upkeep** — over-wake
  and you starve (units lose hp / go dormant), and the **threat** spike from a large awake
  population draws a wave your thin early defenses can't hold (M4, §3).
- **Cleanse-blob: sprawl a huge clean zone fast.** *Prevented by:* a big blob has a huge
  corruption-facing **border**, every hex of which is a spread vector and an alien approach
  lane. Sprawl without Purifiers/Turrets/Walls collapses under M2's spread + Spitter re-seeding.
- **Ignore the economy, kite the captain forever.** *Prevented by:* Breeders regain hp / nodes
  intensify with threat; one blaster can't out-DPS the map. You *need* Soldiers, Turrets, and
  upgrades — all of which cost the economy you skipped.
- **Rush relics ignoring defense.** *Prevented by:* caches are in mountains ringed by
  corruption; reaching them is itself the mid-game fight. No free windfall.

### Cross-check (dead-mechanic / missing-rule audit)
- Every driver in §2 has ≥1 strategy that engages it. ✔
- Every mechanic M1–M6 appears in an arc or a tension. ✔
- Every anti-strategy names a *specific* preventing mechanic, not "it'd be boring." ✔
- No win/loss conflict: win (0 Breeders + 0 frozen) is reached by the same push-out the
  strategies demand; loss (Lander falls) is what turtling and over-sprawl both cause. ✔

---

## 10. Starting Values (first-playtest numbers — halve-and-double from here)

Concrete values for every knob in §3, chosen so the three arcs in §9 hold up under a napkin
trace (below). These are *starting points to be wrong about*, not balance.

### Setup
| Knob | Value | Note |
|---|---|---|
| Map | **40 × 26** | baseline was 60×40 — too big for this economy; shrink so "inch by inch" isn't a slog |
| Frozen colonists | **8** | win requires all 8 awake |
| Breeder nodes at start | **5** | seeded near edges/corners — the push-out targets |
| Lander clean pocket | radius **1** | corruption at the doorstep — Cleanse is usable turn 1 |
| Lander hp | **30** | the heartbeat — big enough to survive the early swarm while you build |
| Sight radius | **6** | every unit + the Lander reveal fog r6; fog shows darkened terrain, hides items/blight/enemies |

### Units
| Unit | hp | mp | weapon | exception |
|---|---|---|---|---|
| Captain | 10 | 5 | range 4, dmg 3 | ranged; respawns at Lander (5 rations, 2-turn delay) |
| Colonist | 6 | 4 | melee dmg 1 | the economy's hands |
| Soldier | 8 | 4 | range 2, dmg 2 | carries a blaster |
| Engineer | 6 | 4 | — | cleanses **2** levels/action |
| Scout | 6 | 6 | — | reveals fog r2 |
| Swarmling | 2+⌊T/22⌋ | 1d6→1-3/2/3 hexes | dmg 2 | targets nearest unit |
| Mauler | 6+⌊T/22⌋ | slow (1) | dmg 3 | targets structures/Lander |
| Spitter | 3+⌊T/22⌋ | 1 | +1 corruption r2 | re-seeds the blight |

*Every spawn also rolls **Melee** (attack range 1, rolled speed) or **Ranged** (~50%: attack
range **3** but **half speed**). Ranged skirmishers snipe units/structures/Lander from 3 hexes
and wear an orange reach-ring; Turrets (range 4) outrange them, so a turret line can pick them
off before they fire. Orthogonal to type — you can get a ranged swarmling or a melee mauler.*

### Economy (per turn)
- **Base recycler (Lander): +2 rations, +2 materials, flat** — keeps you alive turn 1 with no
  structures. *(This is the "trickle" M1 refers to; area gives you build slots and deposits,
  not raw income — that's what stops cleanse-blob from being an income engine.)*
- Optional area trickle: **+1 ration per 4 controlled clean hexes** (⌊·⌋) — small nod to
  accumulation; drop it if area farming feels too safe.
- **Farm** (Producer, biomass hex): +2 rations · **Extractor** (minerals deposit): +2 materials
- Colonist **upkeep: 1 ration/turn** each

### Costs
| Action / build | Cost |
|---|---|
| Cleanse (any level) | **free** — costs the unit's one action for the turn |
| Awaken colonist | 6 rations |
| Farm / Extractor / Beacon | 4 / 5 / 6 materials |
| Purifier / Turret / Wall | 6 / 6 / 3 materials |  (Turret: **range 4, dmg 4**, hp 12) |
| Influence radius | Lander **6**, Beacon **6** — measured as BFS steps through *clean* hexes (corruption walls control off) |

### Escalation engine (the one curve everything reads from)
```
threat T = 1 + 0.3*turn + 1*unitsAwake + 0.2*controlledHexes
spawn/Breeder/turn   = clamp(T/160, 0.04, 0.45)            // ×5 nodes = swarm rate
corruption spread/hex = clamp(0.10 + T/200, 0.10, 0.50)    // water blocks; Purifier −1 lvl/r2
alien hp bonus       = ⌊T/22⌋ ;  maxAliens 30
```
| Checkpoint | T | spawn ea. | ×5 nodes | reads as |
|---|---|---|---|---|
| turn 5, 2 awake, 12 held | ~7 | .04 | ~.2/t | quiet — foothold |
| turn 20, 5 awake, 30 held | ~18 | .11 | ~.6/t | biting — frontier war |
| turn 40, 8 awake, 60 held | ~33 | .21 | ~1/t + hp | outpaces a static line — the purge |

*(Tuned down from the original 2 + 0.5·turn / T÷100 / cap .60 after playtest — that crescendo
landed by turn ~15. This curve pushes it to turns ~40–60, giving room to build before the push.)*

### Napkin trace (does it deliver the arcs?)
- **Foothold is tight, not comfortable.** One captain = one cleanse/turn (actions, not money,
  are the throttle) → literal inch-by-inch. Materials go to the first Extractor/Turret; more
  cleansing hands means waking colonists (rations). Desperation intact. ✔
- **Waking is a real commitment.** 6 rations = 3 turns of base income, then +1/turn forever and
  +1 threat forever. It only pays off if the worker builds a Farm (+2/t, nets positive ~turn 5)
  or cleanses toward a deposit. Agency-vs-upkeep-vs-heat decision is live. ✔ (M4)
- **Anti-turtle holds arithmetically.** One Purifier neutralizes ~one front segment/turn; as T
  climbs the corrupted *source* count grows, so spread outruns any fixed purifier count your
  materials income can sustain. Nodes must be destroyed at the source — you must leave. ✔ (§9)
- **Windfall is earned.** A relic blaster upgrade (range 3→4 or +aoe) roughly doubles node-clear
  speed — the reward for the scout-and-fight investment, rare by design. ✔ (§7)

### Three knobs most likely wrong (halve/double these first)
1. **Threat coefficients** `k_t=0.3, k_u=1, k_c=0.2` — if late game feels unwinnable, halve
   `k_t`; if turtling survives, double it. This is the master difficulty dial.
2. **Spawn divisor 160 / cap 0.45** — controls how brutal the crescendo gets. Lower the divisor
   or raise the cap for more pressure.
3. **Base recycler +2/+2** — if turn-1 feels dead, double it; if the economy never bites,
   drop to +1/+1 and lean on structures.

---

## 11. Open Questions (living document — resolve through play)

- Two resources (materials/rations) or a third (energy for advanced structures/heavy blaster)?
  Start with two; the guns-vs-people tension is cleanest at two.
- Captain permadeath vs. respawn-at-Lander cost — respawn keeps agency alive (Never Let a
  Unit Feel Stuck) but must sting. Start with rationed respawn.
- Win by **all nodes destroyed + all colonists awake**, or by **% of map reclaimed**? Start
  with the former — it forces both the military and economic finish lines.
