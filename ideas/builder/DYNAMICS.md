# Founders' Road — Game Dynamics

A frontier-building game grown from the Hex & Counters movement base. You lead a
small crew of workers into a big wilderness, convert terrain into a producing
economy, lace it together with roads, and raise a three-stage Monument on the
far side of the map — while the wilds push back.

## Theme

**Carving a living network out of an indifferent wilderness.** The feeling is
quiet frontier industry: every sawmill, road hex, and outpost is a mark you made
on a huge empty map, and by the endgame the map *is* yours — dotted with
counters you placed one decision at a time. The wilds don't hate you; they just
trample what you don't guard.

## Key Drivers

1. **Accumulation and Windfall** — buildings add per-turn income forever, roads
   permanently shrink the map, and each Monument stage is a big earned payoff.
2. **Guardianship / Loss Aversion** — every building is a hand-placed investment
   a beast can smash; watchtowers and shooing are how you protect what you made.
3. **Escalating Commitment** — beast spawn pressure scales with how much you've
   built, and the Monument forces you to expand far from home.

## Key Mechanics (one per driver)

1. **Build**: a worker standing on a matching hex converts stockpile into a
   building that produces resources every turn forever.
2. **Beasts**: wild beasts wander the map and destroy any building they step on;
   watchtowers make hexes within 2 impassable to beasts, and a worker may spend
   2 MP to shoo an adjacent beast away.
3. **Escalation**: the per-turn beast spawn chance grows with the number of
   buildings you own — your own success wakes the wilds.

## Map

- Rectangular hex grid (96 columns × 64 rows), pointy-top hexes — a big map you
  pan across; the Monument site starts a long journey away.
- Diamond-square heightmap, terrain by elevation percentile: 25% water,
  ~50% plains, 10% forest, ~8% hills, ~1% gold veins, ~2% quarries, 5% mountains.
  Edges are always water. Terrain hexes shade by elevation for readability.
- Regenerated (up to 20 tries) until a path exists from the Hall to the
  Monument site. Reproducible from `state.seed`.

## Terrain Movement Costs

| Terrain  | Cost      |
|----------|-----------|
| Plains   | 2         |
| Forest   | 3         |
| Hills    | 3         |
| Gold     | 3         |
| Quarry   | 3         |
| Water    | Impassable|
| Mountain | Impassable|

A hex with a **road** or a **building** always costs 1 to enter, whatever its
terrain. (Cost baked into the movement BFS — no special cases downstream.)
Wilderness is deliberately slow — 6 MP is only ~3 raw plains hexes — so the
road network isn't a convenience, it's how the map shrinks (Accumulation:
every stone spent on road pays out in MP every turn after).

## Resources

Single global stockpile: **wood**, **stone**, **gold**. Start: 10 wood, 4 stone,
0 gold. Production ticks at end of turn from every surviving building.

## Workers (the player's counters)

- Start with 3 workers at the Hall; 6 MP each per turn, spendable across moves.
- Workers cannot stack, cannot enter beast hexes; may stand on building hexes.
- Recruit a new worker at the newest Hall for `2 + 2 × (current workers)` wood —
  escalating cost keeps the crew scarce (scarcity of agency).
- Workers cannot be killed — beasts trample structures, not people. Loss lands
  on buildings (guardianship), never on agency.

## Buildings (counters you place)

Built by a selected worker on its current hex, spending stockpile + 2 MP
(roads: 1 MP). One building per hex; never on the Monument hex.

| Building   | On terrain            | Cost         | Effect                    |
|------------|-----------------------|--------------|---------------------------|
| Sawmill    | Forest                | 4w           | +2 wood / turn            |
| Stoneworks | Quarry                | 6w           | +2 stone / turn           |
| Mine       | Gold vein             | 4w 4s        | +1 gold / turn            |
| Hall       | Plains                | 8w 4s        | Recruit point (newest)    |
| Watchtower | Any passable land     | 2w 3s        | Beasts can't enter r ≤ 2  |
| Road       | Any passable, no bldg | 1s           | Hex move cost becomes 1   |

Roads are hex flags, not counters; they render as a connected road network.

## Beasts

- 2d6 roam the map at start; each rolls speed at spawn (1–4 → 1 hex/turn,
  5–6 → 2 hexes/turn — variable speed creates dread).
- Pure random wander (ecology over choreography). A beast that steps onto a
  building hex destroys the building and stops (an event, reported in the HUD).
- Beasts never enter: water/mountain, worker or beast hexes, the Monument hex,
  or any hex within 2 of a watchtower (unless already inside — no trapping).
- Spawn each end-of-turn with chance `min(0.08 + 0.02 × buildings, 0.5)`, on a
  passable hex ≥ 8 from every worker/building, never in tower cover; hard cap 12.
- **Shoo** (fills the L3 attackable extension point): a selected worker with
  ≥ 2 MP highlights adjacent beasts red; clicking one relocates it 4–7 hexes
  away at random and costs 2 MP. Counterplay without combat.

## The Monument (win condition)

At the far site. A worker standing on the Monument hex builds stages from the
stockpile (2 MP each), **but only once the Monument is connected to every Hall
by an unbroken chain of adjacent road/building hexes** (the supply line —
checked by `monumentConnected()`; the build button explains itself when grayed).
The rule makes the road network the spine of the game (Escalating Commitment:
you must push a physical line of infrastructure across the whole map, and every
hex of it is exposed frontier). And because *every* Hall counts, founding one
is itself a commitment: a forward Hall speeds recruiting but adds a settlement
the network must eventually absorb (chains may pass through buildings, so a
Hall built on the trunk line connects for free):

1. **Foundation** — 12 stone
2. **Frame** — 20 wood
3. **Crown** — 6 gold

Completing the Crown wins the game. The HUD progress bar shows
`(stages done + fraction of next stage's cost stockpiled) / 3`, so every log and
block visibly moves the needle. There is no defeat condition — smashed buildings
are setbacks, not game over.

## Turn Structure

1. **Player phase** — each worker spends its MP: move, build, shoo, in any order
   across any workers. Recruit any time if affordable. Space/Enter ends the turn.
2. **End of turn** — beasts move (and smash), a beast may spawn, then surviving
   buildings produce; MP resets and the next turn begins.

Destruction resolves before production: a mill smashed this turn pays nothing.

## Color Palettes

Each game seeds two ColorTheory schemes: one colors the worker crew (numbered
square counters), one the beasts (round counters) — piece identity for both
sides. Terrain shades by elevation, so every seed also has its own look.

## Strategies

- **Early**: 1–2 sawmills in the nearest forest, road toward the nearest quarry.
  Wood income compounds into everything else.
- **Mid**: a second Hall as a frontier recruit point, stoneworks running,
  watchtowers over the production cluster as beast pressure rises.
- **Late**: mine a gold vein, complete the supply line — a forward Hall *on the
  trunk route* is the strong move: it recruits at the frontier and joins the
  network for free — and shuttle workers to the Monument for the stage payments.
- **Recurring tensions**: stone on roads vs. saving for the Foundation; another
  producer (more income, more beast pressure) vs. a tower (safety, no income);
  expand reach vs. tower coverage; shoo a beast now (2 MP) vs. keep walking.
- **Anti-strategies**:
  - *Turtle forever* — prevented mechanically: with few buildings you can never
    stockpile 12 stone/20 wood/6 gold; growth is mandatory, and growth spawns beasts.
  - *Monument rush from starting stock* — impossible: Foundation needs 12 stone
    vs. 4 at start; an economy must exist first.
  - *Sprint a lone worker to the Monument* — the supply-line rule means a body
    on the hex is worthless without a road home; the network has to get there too.
  - *Hall-spam for recruit convenience* — every Hall founded must join the
    supply line before the Monument can rise; an off-network Hall is debt.
  - *Worker spam* — recruit cost escalates by +2 wood per existing worker.
  - *Tower-wall the whole map* — towers cost stone, the same resource the
    Foundation and roads want; blanket coverage starves the win condition.

## Deferred

- Animated enemy phase (hop-by-hop beast movement, destruction flash).
- Beast attraction toward buildings (currently pure wander).
- Repairable (2-HP) buildings instead of one-hit destruction.
- Interactive locations via `locationAt` (still inert); modal targeting (L4) unused.
