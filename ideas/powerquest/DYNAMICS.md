# Power Quest — Dynamics

Why the game works. Rules will be specified in [ONTOLOGY.md](ONTOLOGY.md) once this is agreed;
numbers are named here, never quoted. (This replaces the base's movement-puzzle dynamics.)

## Theme

**A small person growing into borrowed god-power, while the people you love watch to see
whether it was a good idea.** Awe and fragility first (the armor is far bigger than you),
competence later (you are the thing monsters now fear), and the ongoing question of what
the power is *for*: the village, the next village, or glory.

## Drivers

Primary spine: **Accumulation and Windfall** (level-ups). Two thriving verbs braid in:
**hunting** and **crafting**. Guardianship and Escalating Commitment keep it from being a
treadmill.

1. **Level-ups (spine).** Two tracks that feed each other:
   - *Hero level*: XP from kills and first-time discoveries. Each level offers a pick-one
     perk from a small template set. The armor's socket count rises with level.
   - *Village tier*: raised by salvage you deposit. Tiers unlock bench recipes, healing,
     walls, and a bigger trust ceiling.
   Serves: accumulation and windfall (small steady gains, then a socket+recipe+perk click
   into one devastating turn), near-miss (one level short of the lair).
2. **Hunting.** Monsters and raiders are named individuals with a kind, a tier, and a lair.
   Kills pay XP and *parts* (salvage by monster kind). You choose whom to hunt by reading
   the fog-revealed board. Serves: revenge (the thing that shut you down is still out there),
   enemy identity, variable reinforcement (what drops).
3. **Crafting.** Parts + a blueprint (found in ruins, not bought) become modules at a
   village bench. Modules fit armor sockets. Serves: accumulation (blueprints and parts pile
   up), variable reinforcement (rare blueprints), readable consequences (the module list
   says what it does).
4. **Charge: MP's second axis.** Each turn you may spend Charge to buy extra MP, ranged
   shots, or module activations. Charge regenerates slowly in the wild and fast at villages
   and relic sites. Serves: scarcity of agency (burst now or sustain later), double-edged
   (the strongest turn leaves you dry in the open).
5. **Trust.** Every other village starts closed (trust below zero). Hunting what menaces it
   and delivering salvage raise trust. Trust above zero opens its bench, healing, and
   recruitment; high trust lets you found a daughter village nearby. Serves: guardianship
   (named villages you chose to help), loss aversion (neglected trust decays).
6. **Moving on.** Founding a new village leaves the old one standing as a trade partner
   with its own raid pressure. Serves: escalating commitment (a wider holding to defend),
   accumulation (a network of benches and trust).
7. **Fog.** Sight radius grows with level and modules; ruins, lairs, and villages are
   hidden until seen, terrain is revealed by walking. Serves: information as currency,
   exploration, scarcity of agency (scouting spends MP).

## Map

- ~80x60 pointy-top hexes. Terrain: **plains** (cheap), **jungle** (expensive, shortens sight,
  hides lairs and ambushers), **mesa** (elevated flat-topped hills: costly to climb, high ground
  extends sight and ranged reach, a favorite lair and ruin site), **water** (impassable; map
  edge is always water). Terrain carries the plan: mesas are fortresses, jungles are cover,
  plains are highways and killing floors.
- Ruins (blueprints, parts, relic charging sites), lairs, and villages are sites placed by
  the generator; the start village is always connected to at least one ruin.

## Turn structure

1. **Hero phase:** spend MP (and Charge) on moves, bump-melee, ranged shots, module
   activations, crafting/trading when at a trusted village. Turn ends at 0 MP or End Turn.
2. **World phase:** enemies move (variable speed per enemy), raiders path toward the
   nearest village they know, lairs may spawn, villages and Charge tick.
3. **Dawn bookkeeping:** trust decay for neglected villages, village tier effects, level-up
   prompts.

## Combat

- **Melee:** move into an enemy; costs MP, not Charge. Always available, so you never feel stuck.
- **Ranged:** pick a weapon module, pick a target in range and line of sight; costs Charge.
  High ground adds range.
- **Power-spend:** Charge converts to extra MP, damage, or shielding for the turn. One
  mechanic, one Charge pool.
- Enemies attack on the world phase. Death is an event: the enemy that drops you moves onto
  your hex on screen.

## Defeat is a cost, not an end

At 0 HP the armor shuts down; villagers carry you home. You lose unbanked salvage and some
XP toward the next level, a stretch of days passes (raids advance), and trust at the
nearest village dips. Levels and sockets are kept. The monster that got you is named and
remembered: *revenge as fuel*.

## Enemy ecology (no scripts)

- **Beasts:** roam, lair near mesas/jungle, speed rolled at spawn.
- **Raiders:** human bands that hunt villages and carry salvage; they flee low-HP and
  re-raid. They are the dominant "threat to a village" and the main source of trust.
- **Powered monsters:** relic-fueled; tier scales with distance from villages and with your
  hero level (**escalation tied to progress**). Deep ruins ring with the worst.
- Rates are tuned by play: halve and double first.

## Strategies

- **Early:** stay near home, hunt the weakest raiders, gather the first blueprint from the
  nearest ruin, craft one module. Cheap trust with the neighbor village.
- **Mid:** hero level carries you into jungle and mesa lairs; the question is which
  blueprints to chase, and when to bank salvage at a bench versus push on carrying it.
- **Late:** found a new village, or hunt the apex relic monsters for glory. Tier-1 villages
  start to feel small next to what the armor can do, which is exactly when you must leave.
- **Recurring tensions:** burn Charge for a kill now, or keep it for the walk home; carry
  salvage onward (risk of shutdown loss) or return to bank it; hunt for XP or hunt for the
  village's trust; level for sockets or tier the village first.

## Anti-strategies

| Anti-strategy | Prevention |
|---|---|
| Turtle at home farming weak raiders | Raid strength and XP per kill scale with distance; home-radius monsters give diminishing XP; neglected remote villages lose trust and tier |
| Kite a single beast forever with free melee | Melee always costs MP and ranged costs Charge; monster hp regeneration is open (RATIONALE Q-1) |
| Exploit shutdown as a free teleport home | Shutdown costs salvage, XP progress, days, and trust |
| Stack one perk until nothing can hurt you | Levels offer pick-one from a shuffled subset; escalating monster tier scales with level (no cap by design: RATIONALE D-9) |
| Buy trust with salvage only | Trust gain from gifts is capped per visit; kills of threats near that village pay more |

## Settled and open

- After a shutdown, charge and hp return depleted (hp 1, charge 0) and the village shelters you until you leave or heal to half (RATIONALE D-8).
- Perks have no rank cap; rising enemy tier is the counterweight (D-9).
- Open: monster hp regeneration, line of sight for shots, the real XP pace (RATIONALE Q-1, Q-2, Q-6).
