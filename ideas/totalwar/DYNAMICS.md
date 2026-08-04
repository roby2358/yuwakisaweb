# Total War — Game Dynamics

Working title: **TOTALWAR**. Avalon Hill's *Third Reich* as the skeleton; a WWII-shaped
world where high fantasy, low fantasy, and retro-futurist sci-fi field armies side by
side. This document is the design journal: it records *why* the game is fun, then what
the rules are. It supersedes the baseline movement-puzzle dynamics (map generation and
hex movement carry over as substrate).

## Theme

**The crest of empire.** Conquest feels unstoppable in the moment and doomed in the
aggregate. Every province you take makes you mightier and more brittle; every province
you *don't* take is a rival growing. The player should feel two emotions in alternation:
the blitzkrieg thrill of a front collapsing before them, and the creeping dread of a
map too big to hold. Played small, the theme inverts into the defiant hedgehog: you
cannot match their numbers, but everything you have is *here*, dug in, ten minutes
from home.

Not "WWII with elves" as set dressing — the genres exist to make the factions feel like
different civilizations wielding the same war.

## Key Drivers

1. **Escalating Commitment** — your own conquests generate the crisis. Holding territory
   costs units and attention; the closer you get to victory, the more strained you are.
2. **Scarcity of Agency** — Command Points. You can never afford to activate every front,
   so each turn is triage: which front acts, which front waits.
3. **Accumulation & Windfall** — breakthroughs and pockets. Turns of grinding buildup
   collapse into one exploited gap that nets three cities in a single operation.

Woven throughout: **Guardianship** (capital, HQs, irreplaceable unique units) and
**Loss Aversion** (one-step units; every counter lost is permanent).

## Key Mechanics (one per driver)

1. **Occupation Strain** *(escalating commitment)* — every conquered city you hold rolls
   for revolt at your turn end unless a Garrison sits in it; a revolted city flips to
   hostile Partisans.
2. **Command Points** *(scarcity of agency)* — cities produce CP each turn; moving a stack
   costs 1 CP inside your command web (capital/HQ radius) and 2 CP outside it, and CP also
   buys new units, so operations, occupation, and production compete for one budget.
3. **Breakthrough** *(accumulation & windfall)* — when a defending hex is emptied by
   combat, adjacent units with *Exploit* immediately advance through the gap up to 2 hexes
   at no CP cost.

The size asymmetry from the brief falls out of mechanics 1 and 2 rather than a special
rule: a three-city nation runs every operation at 1 CP with no revolt checks (its whole
country is homeland and command web), while a ten-city empire has more raw CP and more
units, but pays double for frontier operations and bleeds units into garrison duty.
**Concentration is what small nations get for free; cohesion is what empires pay for.**

## Map

Carries over the baseline substrate:

- Rectangular hex grid, 60×40, pointy-top, axial coordinates
- Diamond-square heightmap → terrain by elevation percentile
- Terrain: water / plains / forest / hills / mountain; edges forced to water
- Seeded RNG (`Rando`), whole world reproducible from `state.seed`

New on top:

- **Cities** (~24, placed on passable land, minimum spacing 4 hexes). Each faction starts
  with a **capital** plus 3–4 **homeland cities** clustered near it; the rest begin
  **neutral** with a Partisan militia defending. "Homeland" is the set of cities a faction
  owns at game start — an immutable label; everything else it ever owns is "conquered."
- **Victory Cities**: the 4 capitals plus the 5 largest neutrals are marked. *(Terrain as
  Language: the map itself states the war's objectives.)*
- **Hex control**: each hex has an `owner`, flipped when a unit passes through or ends on
  it. Control paints the map so fronts, pockets, and revolts are visible at a glance.
  *(Readable Consequences.)*

Water and mountains stay impassable (two exceptions below). No navy in the core game —
seas are barriers, so a peninsula or island start is a natural hedgehog position.

## Units

Seven types per faction: **six shared + one faction-unique**. Every unit is one counter
with one step — no hit points; an eliminated unit is gone. *(Loss Aversion: each counter
is a permanent piece of your agency.)*

All units are parameter sets for one template — `{atk, def, mp, cost, cap, exceptions}` —
with identity coming from the rules they break, not stat spreads. *(Roles Through
Mechanical Exceptions; Template, Don't Snowflake.)*

| Unit | Atk-Def-MP | Cost | Exception (the rule it breaks) |
|---|---|---|---|
| **Infantry** | 2-3-3 | 3 | None — the baseline line-holder. Cheap defense. |
| **Armor** | 4-3-6 | 6 | *Exploit* — participates in Breakthrough advances. |
| **Artillery** | 3-1-2 | 4 | *Support* — adds attack from 2 hexes away and never advances into the target hex (safe damage, can't take ground). |
| **Air Wing** | 3-1-— | 6 | *Strike* — based in a friendly city; adds its attack to any one combat within 6 hexes per turn; only attackable by assaulting its base city. |
| **Garrison** | 0-2-2 | 2 | *Occupier* — suppresses revolt in its city; cannot attack and cannot leave friendly-controlled territory. |
| **HQ** | 0-1-3 | 8 (cap 2) | *Command* — projects a radius-4 command web (1-CP activations); no combat value. The empire's answer to distance — and a high-value target. |

MP spends against the baseline terrain costs (plains 1, forest/hills 2). A city or
capital hex replaces whatever terrain generated there and costs 2 MP to enter — 1 MP
for the faction that owns it, so your own supply lines move at speed while an invader's
push into your territory drags. Movement, reachability, and ZOC all resolve through the
existing BFS — costs are baked into the graph, not bolted on as checks.

### Shared unit mechanics

- **Infantry** — no exception; the stat and cost floor everything else is priced
  against. Cheap enough to hold a line, unremarkable everywhere else.
- **Armor** — *Exploit*: when a defending hex empties out from combat, Armor stacked
  adjacent immediately advances through the gap and gets a free follow-up move, at no
  CP cost. The blitz unit; see Breakthrough below.
- **Artillery** — *Support, range 2*: joins one declared attack against a hex within 2
  of it without moving into the fight. Can't take ground, and the combat's outcome
  never touches it.
- **Air Wing** — *Strike, range 6*: based in a friendly city (0 MP, never rebases);
  adds its attack to one declared combat per turn anywhere within 6 hexes of its base.
  Killing it means taking the city it's sitting in.
- **Garrison** — *Occupier*: sits in a conquered city and suppresses its revolt roll;
  cannot attack, cannot leave friendly-controlled territory. The cheapest way to hold
  ground you've already taken.
- **HQ** — *Command, radius 4*: projects a command web around itself, like a mobile
  extension of the capital — stack activations inside it cost 1 CP instead of 2. No
  combat value of its own; a logistics unit and a high-value target.
- **Partisan Militia** (2-2-2, cost 0) — no exception; spawned automatically defending
  neutral cities at game start and again whenever a conquered city revolts. Hostile to
  all four factions, including whoever it revolted from.

### Faction-unique units

Each unique breaks one *core* system, giving its faction a different relationship with
the shared rules. *(Asymmetry Over Symmetry.)* All are capped, so each is a named,
mournable piece. *(Guardianship; Enemy Identity — you know exactly whose Dragon burned
your artillery, and where it is.)*

| Faction | Milieu | Unique | Stats | The rule it breaks |
|---|---|---|---|---|
| **The Iron Concord** | Dieselpunk industrial WWII | **Rocket Battery** | 0-1-2, cost 7, cap 2 | Breaks *range*: Bombard a city or stack within 8 hexes — destroy 1 stockpiled CP or strip Entrenchment. War against the enemy's economy and preparation, not their line. |
| **The Thornwood Compact** | High fantasy — elder-forest realms with rifles and wyrms | **Dragon** | 5-4-8, cost 10, cap 1 | Breaks *terrain and ZOC*: flies over everything, has Exploit. Rebuild cost rises +3 each time it dies — grief made mechanical. |
| **The Grey Marches** | Low fantasy — trench-and-pike grimdark men | **Wardens** | 3-3-4, cost 5, cap 3 | Breaks *cohesion*: a stack containing Wardens always activates for 1 CP, and a city they sit in never revolts. Empire glue as a unit — hard men holding hard ground. |
| **The Vault Ascendancy** | Retro-futurist bunker technocracy | **Colossus** | 5-4-4, cost 10, cap 1 | Breaks *terrain as defense*: all terrain costs 1 (mountains passable), and defenders it attacks cap their terrain multiplier at ×1.5. The siege-breaker. |

Four factions on the map; the player picks one, the AI runs the rest.

## Turn Structure

Factions take turns in fixed order (player first). Each faction turn:

1. **Income** — gain CP: capital 5, homeland city 3, conquered city 2 (a conquered city
   pays nothing until held for one full turn). Unspent CP stockpiles (Rocket Batteries
   burn stockpile, so hoarding is a visible target).
2. **Build** — spend CP on new units, placed in any friendly city (one build per city
   per turn).
3. **Operations** — activate stacks one at a time: pay 1 CP (in command web) or 2 CP
   (outside it), move up to MP, declare attacks. Resolve each combat, then Breakthrough
   advances. Repeat until CP or patience runs out.
4. **Strain** — each conquered city without a Garrison (or Wardens) rolls d6: on 5–6 it
   revolts — flips to Partisans and spawns a Partisan militia (2-2-2) hostile to
   *everyone*.
5. **Victory check** — see below.

A stack activation always allows at least a 1-hex move even if terrain costs would
forbid it. *(Never Let a Unit Feel Stuck.)*

## Movement, ZOC & Ranged Attacks

**Movement.** Each unit spends MP through a BFS-computed reachable set — the same cost
function runs client-side (`computeStackReachable`) and engine-side (`unitMoveCost`/
`stackMoveCost`), so the UI never offers a move the engine would reject. Terrain costs:
plains 1, forest/hills 2, water/mountain impassable. A city or capital hex costs 2 MP to
enter — 1 MP for the faction that owns it, so supply lines run at speed inside your own
territory and drag for an invader. Dragon (`flies`) pays 1 MP everywhere, water and
mountains included, and ignores ZOC; Colossus (`allTerrain`) pays 1 MP on any land
terrain, mountains included, but water stays impassable. A stack activation always
allows at least one hex of movement even if the cheapest adjacent hex would otherwise
cost more than its remaining MP.

**Zones of Control.** Entering a hex adjacent to an enemy unit ends that stack's
movement immediately — baked into the BFS edge costs, not a separate check. This is what
turns ordinary maneuver into encirclement: a unit that steps next to an enemy stack
can't then step past it, so pockets form from movement alone, with no dedicated
"encircle" action.

**Ranged attacks.** Three ways to project force without standing adjacent to the target:

- *Support* (Artillery, range 2) — adds its attack to one declared combat within 2
  hexes; never advances into the target hex, never becomes a target itself.
- *Strike* (Air Wing, range 6 from its base city) — adds its attack to one declared
  combat per turn anywhere within 6 hexes; the only way to kill it is to take the city
  it's based in.
- *Bombard* (Rocket Battery, range 8) — a standalone action against a city or stack,
  outside the CRT: destroys one stockpiled CP or strips Entrenchment. War on the enemy's
  economy and preparation, not their line.

## Combat

Odds-based CRT, the *Third Reich* homage, kept to one d6 table:

- Attacker declares one or more adjacent stacks (plus Artillery at range 2, plus one Air
  strike) against one defending hex.
- **Odds** = ⌊total attack / total modified defense⌋. Defense modifiers multiply:
  forest/hills ×1.5, city ×2, Entrenched ×1.5. Below 1:1 the attack cannot be declared —
  the UI simply doesn't offer it. *(Bake Costs Into Systems.)*
- Roll d6:

| d6 | 1:1 | 2:1 | 3:1 | 4:1+ |
|---|---|---|---|---|
| 1 | AR | AR | EX | DR |
| 2 | AR | EX | DR | DR |
| 3 | EX | DR | DR | DE |
| 4 | EX | DR | DE | DE |
| 5 | DR | DE | DE | DE |
| 6 | DR | DE | DE | DE |

- **AR**: attacking stacks retreat 1 hex. **EX**: each side eliminates its most expensive
  unit. **DR**: defender retreats 2 hexes — *if no legal retreat path exists (ZOC,
  impassable, occupied), the defender is eliminated instead.* **DE**: defender eliminated.
DR-into-nothing is the pocket rule, and it is where the windfall lives: encirclement
converts mere retreats into annihilations, so three turns of maneuver can erase a front
in one combat phase. The player can trace exactly which pincer sealed the pocket.
*(Accumulation & Windfall; Readable Consequences.)*

- **Entrenchment**: a stack that neither moves nor attacks for one full turn becomes
  Entrenched (×1.5 defense) until it moves. This is the small nation's concentration
  bonus expressed spatially — you get it by standing your ground, which only works when
  your ground is small.

## Victory & Defeat

- **Win**: control 5 of the 9 Victory Cities simultaneously at the end of your turn for
  3 consecutive turns. The countdown is public.
- **Faction death**: a faction with no cities is eliminated; its units evaporate.
  Losing your **capital** doesn't eliminate you, but every conquered city you own
  immediately revolts and homeland cities pay 1 CP until it's retaken — a death spiral
  you can visibly fight your way out of. *(Guardianship; Revenge as Fuel — the capital's
  captor is a known enemy in a known place.)*
- **Player defeat**: elimination, or any AI faction completing the victory countdown.

The victory shape *is* the near-miss architecture: holding 5 victory cities means
maximum strain — garrisons everywhere, fronts outside the command web, three turns of
revolt rolls while every rival dogpiles you. Most losses happen at 5-of-9 with one turn
left on the countdown, and the player can name the garrison they skipped. *(Near-Miss
Architecture; Escalation Tied to Progress — the countdown, not a clock, triggers the
crescendo.)*

## AI Factions

Constraints, so rivals are opponents rather than timers *(Rival NPCs Need Constraints)*:

- Same rules: CP economy, command web, strain rolls, CRT, ZOC. No free knowledge — an AI
  evaluates only hexes its units or cities can see (radius 3).
- **Balance of power**: each AI targets the faction currently holding the most Victory
  Cities. A leader — usually the player, late game — gets dogpiled; the runt gets left
  alone to recover. This is the third anti-snowball mechanic and it is symmetrical.
- **Commitment**: an AI picks one offensive front per turn-cycle and sticks with it until
  it takes a city or loses a third of the committed force — no omniscient front-switching.
- Pathfinding is full A* to the objective, walked within MP — no one-turn-horizon BFS.

Partisans are simpler: they hold their city and attack any adjacent stack at ≥1:1. They
are hostile to all four factions, so an enemy's revolt is your opportunity and your own
rear areas can catch fire mid-offensive. *(Shared Obstacles Create Emergent Alliances;
Comedy — the Concord's push stalls because the city they staged in revolted behind them.)*

## Strategies

### Playing small (the hedgehog)

- Sit on homeland cities, entrench everything, let terrain multipliers make each hex cost
  the attacker 3:1 odds they can't afford across a narrow front.
- Full CP efficiency: every activation is 1 CP, zero garrisons needed. Spend surplus on
  Artillery and an Air Wing — defense that doesn't need to advance.
- Wait for a neighboring empire to overextend, then bite off its strained frontier:
  conquered cities defended by lone garrisons are 4:1 targets, and each one you take is
  a revolt *he* was suppressing.

### Playing wide (the empire)

- Blitz doctrine: Infantry pins, Artillery softens, Armor kills and Exploits. Aim
  attacks to create DR results against units with no retreat path.
- The garrison budget is the real front: each conquest permanently converts ~2 CP of
  build budget into an Occupier. Expand in pulses — conquer, consolidate, entrench the
  new perimeter, *then* push again.
- HQ placement is the empire's tempo: a forward HQ turns a 2-CP front into a 1-CP front.
  Guard it — its loss halves your operational tempo overnight. *(Guardianship.)*

### Recurring tensions (every game, every faction)

- Garrison a city or field a fighting unit — cohesion vs. might, purchased in the same
  currency.
- Push now at 2 CP per activation, or spend a turn walking the HQ forward.
- Entrench (defense, but frozen) or stay mobile (tempo, but ×1 defense).
- Grab the 5th Victory City and start the public countdown — painting the target on
  yourself — or hold at 4 and build.

### Anti-strategies (and the specific mechanic that kills each)

- **Turtle to victory** — impossible: victory requires 5 Victory Cities and a small
  homeland holds at most 1–2; meanwhile the AI victory countdown is a live loss clock,
  so passivity is a losing line, not a safe one.
- **Conquer-abandon-reconquer income farming** — dead: a conquered city pays 0 CP until
  held a full turn, and abandoning it spawns a Partisan militia that must be re-fought
  at city-doubled defense. The farm costs more than it yields.
- **Unique-unit solo rampage** — dead: the CRT forbids attacks below 1:1, and a lone
  Dragon (atk 5) against an entrenched city stack (def 3 × 2 × 1.5 = 9) can't declare
  the attack. Uniques break rules; they don't replace armies.
- **HQ-chain the whole map into command web** — capped: 2 HQs at 8 CP each, radius 4.
  An empire spanning 30 hexes still runs most fronts at 2 CP.
- **Corner-camp while rivals fight** — the balance-of-power targeting rule redirects
  aggression at whoever leads; if that's not you, the AI winner's countdown forces you
  out of the corner anyway.

Strategy review notes: every mechanic above appears in at least one strategy (Garrison →
empire pulses; Entrenchment → hedgehog; stockpile → Rocket counterplay; retreat-denial →
blitz doctrine), and every anti-strategy names its preventing rule. No dead mechanics,
no unpriced degenerate lines found.

## State Model

Everything serializable, engine-side, no view state — extends the existing split.
*(State Must Fit in a Struct.)*

```javascript
state = {
  seed,
  hexes,            // Map "q,r" -> { q, r, col, row, elevation, terrain,
                    //   owner,          // faction id | 'partisan' | null
                    //   city,           // null | { name, victory, homelandOf, heldTurns } }
  factions,         // [{ id, name, uniqueType, capital, cp, eliminated,
                    //    victoryStreak,  // consecutive turns at >=5 VCs
                    //    aiTarget, aiFront }]
  units,            // [{ id, type, faction, q, r, entrenched, movedThisTurn,
                    //    baseCity }]    // Air only
  dragonRebuildCost,// per-faction escalator for capped uniques
  turn, activeFaction, phase,
}
```

Every mechanic reads or writes a named field here; nothing tracks state outside the
struct. All randomness (map, revolt rolls, CRT, AI) draws from the seeded `Rando`
stream, so a full game replays from `seed` + the command log — preserving the baseline's
server-readiness seam.

## UI Notes

Follows `UI_CONTROLS.md`; this game finally fills the inert extension points:
`computeAttackable` returns hexes where odds ≥ 1:1 (red highlights), `locationAt`
returns cities (inspect panel). Additions the drivers demand *(UI Reveals Mechanics)*:

- Odds preview on hover over an attackable hex ("3:1") — the CRT is visible before
  commitment.
- Command web tint (subtle) so the 1-CP/2-CP boundary is readable at a glance.
- Revolt-risk pips on ungarrisoned conquered cities during the player's turn.
- Animated enemy phase: activation-by-activation movement hops, combat flash, retreat
  slides — consequences land on screen, not in a log. *(Animate the Enemy Phase.)*
- Victory countdown banner, public for all factions.

## Long, Repeated Play

- One game ≈ 40–80 turns. Procedural map + 4 faction choices + seeded reproducibility
  ("share this seed") is the replay engine; the balance-of-power AI makes the endgame
  shape different depending on who surges first.
- Variance sits on a competence backbone: map gen, revolt rolls, and the CRT are the
  luck; CP triage, garrison budgeting, HQ placement, and pocket-building are the skill.
  *(Variable Reinforcement on a Competence Backbone.)*

## Tuning Notes

- All numbers above are first-guess; tune by halve-and-double before fine-tuning
  (revolt chance 2-in-6, command radius 4, garrison cost 2, CP incomes are the
  sensitive ones).
- The concentration/cohesion balance point is the design's heart: a small faction should
  win ~as often as a sprawling one in AI-vs-AI runs. If empires always win, raise revolt
  odds or frontier activation cost; if hedgehogs always win, raise Victory City count
  needed or lower entrenchment to ×1.25.
- Watch EX results: with one-step units, exchanges may bleed attackers too fast at 2:1.
  If offense stalls league-wide, shift the 2:1 column toward DR.

## Implementation Notes (v1)

Where the running build deliberately diverges from or refines the text above:

- **Multi-hex assaults are automatic.** A declared attack pools every ready friendly
  stack adjacent to the target (plus artillery/air support in range); only the
  initiating stack pays the activation, but every joining unit spends its action.
  Necessary: a fully-stacked entrenched city (defense 27) is unassailable from one hex.
- **Any unit suppresses revolt.** A conquered city rolls for revolt only when its hex
  is empty; the Garrison is simply the cheapest thing to leave behind. (Avoids
  partisans spawning under standing armies; opportunity cost still does the balancing.)
- **Attacker retreats hold instead of dying.** An AR result with no legal retreat hex
  leaves the attacker in place — only defenders get pocket-killed.
- **Air Wings don't rebase.** MP 0: they strike within 6 of wherever they were built.
  Rebasing is deferred with the rest of the air war.
- **Immobile units stay behind.** Moving a stack carries only its mobile members — an
  Air Wing on a city doesn't pin the infantry stacked with it.
- **Stacks split by clicking.** Repeat clicks on a selected stack cycle whole → each
  unit → deselected; a sub-selection moves alone (each split move is its own paid
  activation, so the CP economy prices the maneuver — watch balance-watch for 1-unit
  ZOC-screen abuse). Splits are movement-only: declared attacks pool the whole hex.
- **Partisan militia never entrench**, and a fallen capital's revolt cascade spares
  cities that have units standing in them.
- **Command web is hex-radius**, not path-distance, from the held capital and HQs.
- **AI temperament** lives in `GameArtifacts.AI` (stacks operated per turn, CP reserve,
  army cap per city, objective commitment timeout, 1:1 grind threshold) — the tuning
  knobs for the balance points below.

## Deferred (explicitly out of the core game)

- Navies and sea movement (seas stay barriers; an island start is meant to be strong)
- Formal diplomacy (alliances, NAPs) — the balance-of-power rule stands in
- Tech/research trees — faction identity lives in the unique units instead
- Multi-step units and replacements
