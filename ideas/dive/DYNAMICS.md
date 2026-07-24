# DIVE — Game Dynamics

*A design journal first, a rules reference second. This answers "why is this fun?"
before "what does the code do."*

## Theme

**Greed against breath in a beautiful, indifferent wilderness.**

You are a lone prospector working an alien ocean rift — the Chroma Deep — out of a
tiny anchored station. The ocean is gorgeous and does not care about you. Every dive
is the same bargain: one more node, one more hex, against the O₂ needle and the long
swim back. The feeling to protect in every tuning decision: *surfacing into the
airlock with 1 O₂ and a full bag.*

This is a **thriving** game, not a survival game. There is no defeat, only setbacks —
but the setbacks take things you had already wrapped your hands around.

## Key Drivers

1. **Loss aversion over reward-seeking** — material is *unbanked* while the diver
   carries it, *banked-ish* in the sub's hold, and only truly safe once sold or crafted
   at base. Every predator and the O₂ clock threaten the unbanked layer, never your
   crafted upgrades or credits.
2. **Variable reinforcement on a competence backbone** — node richness, pearl finds,
   and predator positions are rolled per game; where to park, which band to work, and
   when to turn back are pure player judgment.
3. **Accumulation and windfall** — the sell/craft loop compounds: more O₂ → deeper
   bands → richer materials → better gear. Windfalls are pearl beds, fat vents, and
   recovering a dropped bag or a sunken hold.

Near-miss architecture is the tuning target that sits over all three: the numbers
below are chosen so a well-planned dive *barely* works.

## Key Mechanics (one per driver)

1. **The Airline** — outside the sub, O₂ drains every turn (faster in deeper bands);
   at 0 you black out, your bag drops on that hex as a recoverable **cache**, and you
   wake in the sub minus a rescue-drone fee.
2. **Bands and nodes** — material nodes spawn by terrain band, and deeper/riskier
   bands hold strictly more valuable materials; each node's yield is rolled at
   generation.
3. **Dock, sell, craft** — docking at Berth Station converts hold cargo into credits
   or upgrades; every upgrade is a single parameter bump (O₂ max, fins MP, bag, hold,
   hull, sonar) so gains compound without new rules.

## The World

Top-down hex map of a rift shelf. Terrain is *depth*, and depth is the game's
language: safety, value, and O₂ cost all read off the map at a glance.

| Band | Elevation | Sub cost | Diver O₂/turn | Holds | Notes |
|---|---|---|---|---|---|
| Rock | spires + map edge | — | — | — | impassable walls for everything |
| Shallows | highest | 1 | 1 | rare Drift Pearls | **leviathan-proof** safe lanes |
| Reef | high fringe | 2 | 1 | Prismshard, Drift Pearls | tight piloting slows the sub |
| Kelp | mid fringe | 2 | 1 | Glowfiber (every hex) | **hides the diver** while fiber remains |
| Deep | low | 1 | 2 | little | fast transit — and leviathan water |
| Vent | scattered in deep/trench | 1 | 2 | Emberglass (every hex) | rich, out in the open |
| Trench | lowest | 1 | 3 | Void Amber | richest, worst air, leviathan home |

The diver swims any passable hex at cost 1 (MP 4 base); depth taxes the diver in O₂,
not MP. Base sits on shallows near one end; trench runs far from it, so the safe coast
road is long and the direct route crosses leviathan water. *Terrain as language.*

**Murk:** node contents are visible only within sight range of the sub (sonar tier:
4/6/9) or diver (4); once seen, remembered. Terrain itself is always charted. Eels
render only inside current sight; a leviathan is always visible once it exists — you
track the vast shadow, it ambushes no one. *Information as currency; sonar is a real
purchase.*

## Materials

| Material | Band | Sell | Role |
|---|---|---|---|
| Glowfiber | kelp | 2 | starter income; harvesting it strips your own cover |
| Prismshard | reef | 4 | early-mid income, mid crafting |
| Drift Pearl | reef/shallows, rare | 12 | pure windfall money + beacon garnish |
| Emberglass | vents | 8 | mid income, late crafting |
| Void Amber | trench | 15 | endgame crafting core |

Gathering: stand on a node hex, spend **2 MP** per unit extracted (needs bag space);
nodes deplete permanently. A depleted kelp hex keeps its terrain but loses its cover —
strip-mining your hiding spots is a real cost. *Double-edged mechanics.*

## Two Counters, One Player

You are either **aboard the sub** or **out as the diver** — one active counter, the
other inert.

- **Sub** — MP 8, unlimited range, immune to eels, carries the hold, refills O₂ on
  boarding. Cannot gather. Its engine wake is what leviathans hunt.
- **Diver** — MP 4 (fins tiers 5/6), O₂-bound, the only gatherer. Silent: leviathans
  ignore the diver entirely.

Swapping modes is swapping which predator matters — the asymmetry is the readable
core of threat play. Boarding auto-transfers the bag into the hold (overflow stays in
the bag). *Gut check: the big thing hunts the big loud thing, the small things hunt
the soft small thing, tangles hide you until you cut them down — all learnable in one
encounter each; the intro states them in one line each.*

## Predators (minimal combat = fleeing only)

Ecology, not choreography: a few probabilistic rules, no scripts, no player attacks.

- **Lantern eels** — hunt the diver, ignore the sub. Sense radius 5 (blind to a diver
  in standing kelp); speed rolled at spawn (1d6 → 1,1,1,2,2,3 — *variable speed
  creates dread*). In sense range they path toward the diver (full A*, no horizon
  stalls); otherwise they drift 1 random hex. An eel reaching the diver **mauls**:
  bag drops as a cache on that hex, the diver is dragged off and kicks free back to
  the sub (O₂ refilled), rescue fee 15cr. The eel stays put — *your bag is guarded by
  the exact eel that took it.* Revenge has an address.
- **Leviathans** — named (Old Chorus, The Pale Ribbon, Mother Sieve, Saint Undertow…),
  hunt the sub, ignore the diver. Swim only deep/vent/trench; speed 3; sense the sub's
  engine wake at radius 8 **only on turns the sub moved** — a parked sub is silent.
  But a leviathan that wanders adjacent always bites: hull −1. At hull 0 the sub goes
  down: the hold spills as a **wreck cache** on that hex, the tender drags you and the
  refloated sub back to base (hull restored, hold empty). The wreck is out there,
  marked, recoverable, probably in awful water. *Guardianship + revenge + windfall in
  one event.*

Caches (dropped bags, wrecks) persist on the map; the diver standing on one scoops as
much as fits in the bag. Recovery runs are the game's best stories.

**Escalation is tied to progress, not time:** Attention = total upgrade tiers crafted.
Eel population target = 5 + 2×Attention (respawn checks each predator phase, spawned
in reef/kelp ≥ 8 hexes from you). The first leviathan wakes at Attention 2, a second
at 5, a third at 8. The Deep notices industry. Turtling at base is perfectly safe and
earns exactly nothing.

## Economy and Upgrades

All upgrades are one template: **credits + materials → tier++ in a stat table.**
No bespoke effects. (*Template, don't snowflake.*)

| Upgrade | Values (T0→T2) | Tier 1 | Tier 2 |
|---|---|---|---|
| O₂ Recycler | 10 / 14 / 18 | 20cr + 4 glowfiber | 60cr + 5 prismshard + 2 emberglass |
| Thrustfins (diver MP) | 4 / 5 / 6 | 25cr + 3 prismshard | 70cr + 4 emberglass |
| Cargo Sling (bag) | 6 / 9 / 12 | 20cr + 5 glowfiber | 55cr + 4 prismshard + 1 void amber |
| Hold | 20 / 32 / 48 | 30cr + 6 glowfiber | 80cr + 3 emberglass |
| Hull Plating | 3 / 4 / 6 | 40cr + 6 prismshard | 90cr + 5 emberglass |
| Sonar (sub sight) | 4 / 6 / 9 | 30cr + 2 glowfiber + 2 prismshard | 75cr + 2 emberglass + 1 void amber |

**Win:** craft the **Deepwave Beacon** — 250cr + 6 void amber + 6 emberglass +
3 drift pearls — and the tender ship comes for you. O₂ tiers gate trench *penetration* mechanically: at O₂ 10
only edge-of-trench bites fit (park in leviathan water, grab, run); interior trench
nodes need O₂ 14+. *Near-miss by construction.* Docking repairs the hull free.

## Turn Structure

1. **Player phase** — spend the active counter's MP on moves/gathers; context actions:
   Dive (exit sub, O₂ full), Board (enter sub, bag → hold), Dock (open market at
   base), Gather, End Turn.
2. **Predator phase** — (a) O₂ drain by band, blackout check; (b) eels move/maul;
   (c) leviathans move/bite; (d) spawn checks. Then turn++, MP refills.

Drain resolves before predators so an overdrawn diver blacks out on their own math,
not on an eel's.

## State Model (fits in a struct)

```
seed, turn, mp, phase, gameWon
hexes: Map<"q,r", { q,r,col,row,elevation,isEdge,terrain, node:{material,amount}|null }>
base:{q,r}, sub:{q,r}, diver:{q,r}|null, diverOut, subMoved
o2, hull, credits
bag:{material:count}, hold:{material:count}
upgrades:{o2,fins,bag,hold,hull,sonar}      // tier ints; Attention = sum (derived)
eels:[{q,r,speed}], leviathans:[{q,r,name}]
caches:[{q,r,contents:{material:count}}]
seen: Set<"q,r">
```

## Strategies (reviewed against the mechanics)

- **Kelp-line opener** — strip the kelp fringe nearest base for fiber; every harvested
  hex is cover you no longer have on your busiest commute. (Double-edge confirmed:
  cover = node.amount > 0.)
- **Park-and-spoke** — park the sub central to several nodes, dive short spokes,
  board to refill. The parked sub is silent, so spoke dives are calm; the transit
  between parks is where the leviathan lives.
- **The greed margin** — every turn out, recompute (O₂ left) vs (drain-weighted turns
  back to the sub). The game never shows this number; learning to feel it *is* the
  competence backbone.
- **Coast road vs. the drop** — perimeter shallows are leviathan-proof but long;
  the direct route is deep water. Time vs. hull, every trip.
- **Recovery runs** — a cache under an eel, a wreck in the trench: high-stakes dives
  for loot you already counted as yours. (Loss aversion converts to revenge fuel.)
- **Pearl luck** — rare pearl nodes are pure money spikes; they fund an off-schedule
  upgrade. (Variable reinforcement.)

Anti-strategies and their mechanical prevention:

- **Suicide-swim scouting** (black out on purpose to teleport home): costs the bag
  *and* a 15cr rescue fee; scouting is what sonar tiers are for.
- **Bait-mauling eels away from a field**: a maul relocates the *diver*, not the eel —
  the eel ends standing on your cache. Nothing is cleared, and it cost 15cr.
- **Sub-kiting a leviathan forever**: intended fantasy, not an exploit — fleeing *is*
  the combat. Disengage (stop moving / break line) is always available; the
  wander-adjacent bite keeps deep parking from being absolutely safe.
- **Turtle at base**: safe, legal, and produces nothing; escalation is tied to
  progress, so the game simply waits for you.

Every mechanic above names a strategy that uses it; hold capacity drives the
mid-game base-trip rhythm, kelp cover drives the opener, sonar drives scouting,
hull drives route choice. No dead mechanics found; pearls are deliberately
sell-only (windfall, plus 3 for the beacon).

## Deferred (deliberately)

- Enemy-phase animation (hop-by-hop) — v1 uses event toasts + sound cues; revisit if
  mauls/bites read as unfair.
- Deliberate bag-drop / player-placed caches.
- GameState (de)serialization and any save-compat (no migrations while prototyping).
- Combat of any kind. `computeAttackable` stays empty on purpose.
