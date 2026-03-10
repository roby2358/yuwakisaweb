# DYNAMICS.md — Waowisha

## Emotional Theme

**The quiet weight of tending something vast.** You are a steward of a settlement in a world that forgot whether its wonders are magic or machine. The land hums with resources nobody fully understands. You gather, refine, build — and all the while, things stir at the edges. Neglect breeds danger. Attention is your scarcest resource.

The feeling is: a long exhale punctuated by sharp inhales. Methodical work interrupted by crisis. The satisfaction of a chain clicking into place. The dread of seeing three E0s become twelve while you were busy elsewhere.

---

## Key Drivers

1. **Scarcity of Agency** — You have units, but never enough. Every turn is triage: gather here, defend there, build this, ignore that. The map is 60x60 and your workforce is a handful of dots.
2. **Accumulation and Windfall** — Slow, patient investment in manufacturing chains. Then a chain completes and suddenly you're producing Tier 2 compounds and the board shifts. Random windfalls (resource veins discovered, wandering allies) punctuate the grind.
3. **Guardianship** — Your settlement, your workers, your production buildings. Each one built with turns you can't get back. Losing a Gatherer to an E1 hurts not because of stats, but because of the 8 turns of resource collection that vanishes with them.

Secondary drivers: **Escalating Commitment** (goals pull you further from safety), **Loss Aversion** (every structure and unit represents sunk turns), **Revenge** (the E1 that killed your Gatherer is still on the board).

---

## Setting

The world doesn't know it's sci-fi. Crystal-powered forges are called workshops. Luminous sap is just "what the groves give." Ore glows faintly and nobody asks why. Defensive towers hum at a frequency that repels the Drift — this is called "warding" and it's as mundane as putting up a fence.

The Drift is what comes from the edges. Nobody knows what it is. The things that coalesce from neglected terrain — they don't even have stable names. Each settlement invents its own words for the resources it finds, the compounds it discovers, the creatures it fears. This is reflected mechanically: **every game generates new names** for resources, products, and low-level enemies via the phoneme system. The world is too fractured to agree on terminology.

The steward's job is to keep the settlement alive long enough to fulfill the Mandate: a series of manufacturing objectives that arrive like half-remembered prophecies. Complete the Mandate and... something happens. Nobody remembers what, but it feels important.

---

## The Map

**60x60 hex grid, point-top, axial coordinates.** Procedurally generated via fractal heightmap.

### Terrain Types

Each terrain type corresponds to a raw resource and has a movement cost.

| Terrain | Color | Move Cost | Raw Resource | Description |
|---------|-------|-----------|-------------|-------------|
| **Pale** | #c8b87a | 1 | — | Open ground. Fast to cross, nothing to harvest. |
| **Vein** | #8a5cc4 | 2 | Resource A (generated name) | Crystalline deposits. Faint purple glow. |
| **Grove** | #3d8a4e | 2 | Resource B (generated name) | Dense luminous trees. Sap collects in pools. |
| **Mire** | #6a7a3d | 2 | Resource C (generated name) | Bubbling marshland. Volatile and useful. |
| **Scarp** | #7a6a5a | 2 | Resource D (generated name) | Exposed cliff faces. Hard stone, harder to work. |
| **Deep** | #2a4a7a | ∞ | — | Water. Impassable. Natural barriers. |
| **Crag** | #5a5a5a | ∞ | — | Mountains. Impassable. Funnels movement. |

**Note:** Terrain type names (Pale, Vein, Grove, etc.) are fixed — they describe the land. The *resources harvested from them* get generated names each game.

**Generation rules:**
- Deep and Crag form natural barriers and chokepoints (elevation extremes)
- Vein, Grove, Mire, Scarp distributed in clusters (3-8 hexes each)
- Pale fills everything else
- Settlement spawns near center on Pale terrain
- Ensure pathfinding connectivity to at least one cluster of each resource type

**Driver: Terrain as Language.** The player reads the map for strategy: Mire clusters near the edge are both valuable and dangerous. A river of Deep between you and a Vein cluster means a long detour. Chokepoints between Crags are natural tower sites.

---

## Units

All units are hex counters. Click to select, click a reachable hex to move. Classic wargame interaction.

### Unit Types

Units are defined by a template: `{ name, symbol, color, mp, strength, abilities[] }`.

| Unit | Symbol | MP | Strength | Abilities | Cost |
|------|--------|----|----------|-----------|------|
| **Warden** | W | 4 | 2 | Gather(1), Build(1) | Starting unit |
| **Gatherer** | G | 5 | 0 | Gather(2) | 3 R0d |
| **Sentinel** | S | 4 | 3 | — | 2 R0d, 2 R0a |
| **Mason** | M | 3 | 1 | Build(2) | 2 R0d, 1 R0c |
| **Seeker** | K | 6 | 1 | Reveal(3) | 1 R0b, 1 R0a |

Unit type names (Warden, Gatherer, etc.) are fixed — they're roles, not substances.

**Ability templates:**
- **Gather(N):** When on a resource hex at end of turn, collect N units of that resource. Resource hex has a capacity (8-12, set at generation); when depleted, terrain becomes Pale. **Driver: Accumulation.**
- **Build(N):** Can construct structures. N is build speed — structures take `cost / N` turns to complete. Unit must remain on hex while building. **Driver: Scarcity of Agency** (building locks a unit in place).
- **Reveal(N):** At end of turn, reveals fog of war in radius N (if fog is implemented; otherwise, reveals hidden resource capacity of hexes in radius). **Driver: Information as Currency.**

**Recruitment:** Units are recruited at the Settlement hex. Pay the resource cost, unit appears next turn. Only one unit can be recruited per turn. **Driver: Scarcity of Agency.**

**Movement:** Standard hex wargame. Select unit, see highlighted reachable hexes (BFS within MP budget accounting for terrain costs). Click to move. Each unit moves once per turn. **Driver: Never Let a Unit Feel Stuck** — minimum 1 hex movement onto any non-impassable adjacent hex regardless of MP remaining.

**No stacking:** Only one friendly unit per hex. Friendly units block movement (can't pass through). Entering an enemy hex initiates combat.

---

## Manufacturing Chains

Four raw resources feed into a 4-tier production chain. **All resource and product names are generated per game** via the phoneme system. The chain *structure* (inputs, outputs, ratios) is fixed — only the names change. This means each game the player discovers "what things are called here."

The tables below use slot names (R0a, P1a, etc.) to define the fixed structure. At game start, each slot gets a generated phoneme name.

### Tier 0 — Raw Resources (gathered from terrain)

| Slot | Source Terrain | Symbol | Example Name |
|------|---------------|--------|-------------|
| **R0a** | Vein | ◆ | "Dravik" |
| **R0b** | Grove | ◈ | "Solvane" |
| **R0c** | Mire | ◇ | "Quelith" |
| **R0d** | Scarp | ◉ | "Ferrox" |

### Tier 1 — Refined Goods (require Refinery)

| Slot | Inputs | Example Name |
|------|--------|-------------|
| **P1a** | 2 R0a | "Thassium" |
| **P1b** | 2 R0b | "Lumenol" |
| **P1c** | 2 R0c | "Mirevite" |
| **P1d** | 2 R0d | "Ashlar" |

### Tier 2 — Compounds (require Foundry)

| Slot | Inputs | Example Name |
|------|--------|-------------|
| **P2a** | 1 P1a + 1 P1b | "Vorithane" |
| **P2b** | 1 P1a + 1 P1c | "Gallerite" |
| **P2c** | 1 P1d + 1 P1b | "Heliodex" |
| **P2d** | 1 P1c + 1 P1d | "Cinderite" |

### Tier 3 — Masterworks (require Atelier)

| Slot | Inputs | Example Name |
|------|--------|-------------|
| **P3a** | 1 P2a + 1 P1d | "Beacon Core" |
| **P3b** | 1 P2b + 1 P1b | "Ward Shell" |
| **P3c** | 1 P2c + 1 P1a | "Resonance Lens" |
| **P3d** | 1 P2d + 1 R0b | "Drift Charge" |

**Tier 3 names are two-word compounds** — both words generated. E.g., "Vorithal Spenk" instead of "Beacon Core."

### Consumables

P3d is unique among Tier 3 products — it's a **one-use area weapon** rather than a building material.

**P3d — Drift Charge:** Any unit can carry and deploy it. During the Player Phase, select a unit carrying a P3d, then target any visible hex within range 3 of that unit. All enemies within radius 2 of the target hex are destroyed, regardless of strength. The P3d is consumed.

- Drift Charges are produced by the Atelier like any Tier 3 product and stored in the global stockpile.
- A unit "picks up" a charge by being assigned one from the stockpile (a player action during the Player Phase, like assigning a recipe). The unit can then deploy it on a later turn. One charge per unit.
- **The Mandate tension:** The Mandate may require "Produce 3 P3d." Every charge detonated is one you'll need to produce again. Use it now to survive, or hoard it for the goal? **Driver: Double-Edged Mechanics Are Gold.**

### Production Buildings

Structures built on hexes by units with Build ability. Each processes one recipe per turn automatically if inputs are available in the global stockpile.

| Structure | Build Cost | Build Time (Mason) | Processes |
|-----------|-----------|-------------------|-----------|
| **Refinery** | 3 R0d | 2 turns | Tier 0 → Tier 1 |
| **Foundry** | 2 P1d, 1 P1a | 3 turns | Tier 1 → Tier 2 |
| **Atelier** | 2 P2c, 1 P2a | 5 turns | Tier 2 → Tier 3 |

**Production rule:** Each building has a recipe queue. Player assigns which recipe the building produces. One output per turn, consuming inputs from global stockpile. If inputs unavailable, building idles. **Driver: Accumulation** (chains take many turns to establish, then produce steadily).

**Recipe assignment:** Click a production building to open its panel. Select from available recipes. Building produces that recipe each turn until changed or starved of inputs.

**Global stockpile:** All resources are pooled. Gatherers deposit automatically at end of turn. Buildings draw from and deposit to the stockpile. No transport logistics — the settlement "just knows." (Simplify Until It Hurts: transport would add complexity without adding decisions.)

---

## Defensive Structures

Static defenses that auto-fire during the enemy phase. Built by units with Build ability.

| Structure | Build Cost | Build Time (Mason) | Range | Power | Notes |
|-----------|-----------|-------------------|-------|-------|-------|
| **Spike** | 1 R0d | 1 turn | 3 | 1 | Dirt cheap, disposable. Targets weakest. |
| **Watch Post** | 2 R0d, 1 R0c | 2 turns | 3 | 2 | Workhorse defense. Targets strongest. |
| **Beacon Tower** | 1 P3a | 3 turns | 3 | 3 | Heavy hitter. Targets strongest. |
| **Ward Pylon** | 1 P3b | 3 turns | 3 | 4 | Hits ALL enemies in range. |
| **Longbow** | 1 P3c | 3 turns | 8 | 2 | Long-range chaff sweeper. Targets weakest. |

Structure type names (Watch Post, etc.) are fixed — they're architectural roles.

**Auto-fire rule:** During enemy phase, before enemy movement, each defensive structure fires once at a **visible** (non-fogged) enemy in range. Targeting depends on structure type:
- **Spike, Longbow:** Target the *weakest* enemy in range (lowest strength, ties broken by closest). Picks off E0/E2 chaff so stronger towers aren't wasted on them.
- **Watch Post, Beacon Tower:** Target the *strongest* enemy in range (highest strength, ties broken by closest).
- **Ward Pylon:** Hits ALL visible enemies in range simultaneously.

If structure power ≥ enemy strength, enemy is destroyed. If structure power < enemy strength, no effect.

**Structure durability:** When an enemy moves onto a structure's hex during the Drift Phase, compare enemy strength vs. structure power. If enemy strength > structure power, the structure is destroyed (and the enemy survives). Otherwise the enemy is destroyed. This means:
- **Spikes** (power 1) are crushed by anything str 2+ (E1s, Brood Mothers). Disposable by design.
- **Watch Posts** (power 2) hold against E0s and E2s, but fall to Brood Mothers.
- **Beacon Towers** (power 3) resist everything except Brood Mothers.
- **Ward Pylons** (power 4) match Brood Mothers — exchange (both destroyed).
- **Longbows** (power 2) are fragile for their cost — protect them behind other defenses.

**Driver: Tower Defense + Guardianship.** Placing defenses is an investment that pays off passively — but only if enemies come through that chokepoint. Misplaced towers are wasted resources. Spikes are sandbags — cheap to place, expect to lose them. High-tier towers are worth protecting with Sentinels.

---

## The Drift (Enemies)

Enemies spawn from map edges and roam inward. They are the pressure that makes resource management urgent.

### Enemy Types

Low-level enemy type names (Tier E0 and E1) are **generated per game** via the phoneme system — each settlement has its own words for the things that crawl out of the edges. The Brood Mother is a fixed name — she's rare enough and terrifying enough to be universal.

| Slot | Symbol | Speed | Strength | Behavior | Example Name |
|------|--------|-------|----------|----------|-------------|
| **E0** | m | 1 | 1 | Wanders randomly. Harmless alone, dangerous in numbers. | "Murk" |
| **E1** | h | 1-3 (rolled at spawn) | 2 | Moves toward nearest player unit or structure. | "Hollow" |
| **E2** | t | 2 | 1 | Spawns in packs of 2-3. Moves toward settlement. | "Thrall" |
| **Brood Mother** | B | 1 | 4 | Spawns 1 E0 per turn on an adjacent hex. Moves toward nearest resource cluster. | (fixed name) |

**Driver: Variable Speed Creates Dread.** E1s roll speed at spawn. A speed-3 E1 closing from 5 hexes is a crisis. A speed-1 E1 is manageable. You can't tell until it moves.

**Driver: Enemy Identity.** Each enemy is a persistent counter on the board. The E1 that killed your Gatherer is trackable. You can hunt it.

### Spawn Mechanics

**Base spawn:** Each turn, roll d6. On 5-6, spawn 1 E0 on a random edge hex.

**Surge:** Every 10 turns, a Surge occurs. Surge strength = `(turn / 10)²`. So:
- Turn 10: 1 enemy
- Turn 20: 4 enemies
- Turn 30: 9 enemies
- Turn 50: 25 enemies
- Turn 100: 100 enemies

Surge composition: 60% E0s, 25% E2s (in packs), 10% E1s, 5% Brood Mothers. Spawned on random edge hexes.

**Brood Mother multiplication:** Each surviving Brood Mother spawns 1 E0 per turn. This is the parabolic danger: ignore a Brood Mother for 10 turns and she's produced 10 E0s. Ignore two and you have 20 plus the originals.

**Driver: Parabolically Increasing Danger.** Surges grow quadratically. Brood Mothers grow linearly but compound. A player who neglects defense for 30 turns faces a board full of Drift. A player who over-invests in defense can't manufacture. This is the core tension.

### Enemy Movement

During the enemy phase, each enemy moves according to its behavior:
- **E0:** Random valid adjacent hex (avoid Deep/Crag)
- **E1:** A* toward nearest player unit or structure, walk up to Speed hexes along path
- **E2:** A* toward settlement hex, walk up to Speed hexes along path
- **Brood Mother:** A* toward nearest resource terrain cluster, walk 1 hex along path

**Driver: Pathfinding Needs Global Vision.** All directed enemies use full A* to target, then walk the path within their speed budget. No horizon problem.

### Enemy Combat

When an enemy moves onto a hex containing a player unit:
- Compare enemy strength vs. unit strength
- If enemy strength > unit strength: unit is destroyed
- If enemy strength ≤ unit strength: enemy is destroyed
- If equal: both destroyed (exchange)

**No dice for enemy-on-unit combat.** Enemies are numerous enough that individual randomness isn't needed — the randomness is in where they are and how fast they move.

### Spoils

When an enemy is destroyed (by unit combat, tower fire, or Drift Charge), it drops resources into the global stockpile based on its strength:

| Enemy | Strength | Drop |
|-------|----------|------|
| **E0** | 1 | 1 random R0 |
| **E2** | 1 | 1 random R0 |
| **E1** | 2 | 2 random R0 (rolled independently) |
| **Brood Mother** | 4 | 1 random P1 + 2 random R0 |

The drop is a random R0 resource (R0a-R0d, equal probability) or for Brood Mothers, a random refined product (P1a-P1d) plus raw materials — as if the Drift had been absorbing the land's resources and you're reclaiming them.

**Driver: Revenge as Fuel.** Hunting the E1 that killed your Gatherer isn't just catharsis — it pays. Brood Mothers are worth hunting proactively: the P1 drop skips a Refinery cycle. This also softens the defense-vs-economy tension slightly: fighting IS gathering, just less efficient and riskier. **Driver: Double-Edged Mechanics** — engaging enemies yields resources but risks units.

When a player unit moves onto an enemy hex (player-initiated attack), use the **CRT:**

### Combat Results Table (Player attacks enemy)

Calculate odds ratio: `attacker_strength : defender_strength`. Round to nearest column.

| d6 | 1:2 | 1:1 | 2:1 | 3:1 | 4:1+ |
|----|-----|-----|-----|-----|------|
| 1 | AE | AE | EX | DE | DE |
| 2 | AE | AE | DE | DE | DE |
| 3 | AE | EX | DE | DE | DE |
| 4 | EX | DE | DE | DE | DE |
| 5 | EX | DE | DE | DE | DE |
| 6 | DE | DE | DE | DE | DE |

- **AE** = Attacker Eliminated
- **DE** = Defender Eliminated
- **EX** = Exchange (both eliminated)

**Multi-unit attacks:** If multiple player units are adjacent to an enemy, their strengths combine for the odds ratio. Only the unit that initiated the attack occupies the hex if the enemy is destroyed.

**Driver: Old-school wargame feel.** The CRT rewards concentration of force. A lone Sentinel (str 3) vs. a Blight Mother (str 4) is 1:1 — risky. Two Sentinels adjacent make it 6:4 → 3:2, rounds to 2:1 — much better. Positioning matters.

---

## The Mandate (Win Condition)

At game start, the Mandate is generated: a list of 5-7 manufacturing goals. Goals are revealed 2-3 at a time. Completing a goal reveals the next one.

### Goal Generation

Each goal is: **"Produce N [Tier 2 or Tier 3 product]"**

**Pool of goal templates:**
- Produce 2-4 of a Tier 2 product
- Produce 1-3 of a Tier 3 product

**Chain rule:** At least 2 goals must share an input dependency (e.g., both require P1a, forcing the player to prioritize R0a gathering and Refinery throughput).

**Escalation rule:** Later goals in the sequence require higher-tier products or larger quantities than earlier ones. **Driver: Escalating Commitment.**

**Example Mandate** (using one game's generated names):
1. Produce 3 "Vorithal Spenk" [P2a] *(establishes R0a + R0b chains)*
2. Produce 3 "Gallerite Hexa" [P2b] *(establishes R0c chain, shares P1a with goal 1)*
3. Produce 2 "Thoune Dravek" [P3a] *(uses P2a + P1d, pulls toward R0d)*
4. Produce 4 "Heliodex Fane" [P2c] *(heavy P1d + P1b demand)*
5. Produce 2 "Reshol Thane" [P3c] *(uses P2c from goal 4 + P1a)*
6. Produce 1 "Quelithane Bron" [P3b] *(uses P2b from goal 2 + P1b)*

Completing all goals wins the game. Display turn count as score (lower is better).

**Driver: Accumulation and Windfall.** Each goal completed feels like a milestone. When a chain finally produces its first Tier 3 product after 30+ turns of setup, that's the windfall.

---

## Windfalls (Random Positive Events)

Each turn, 5% chance of a windfall. Roll from pool:

| Roll | Event | Effect |
|------|-------|--------|
| 1 | **Rich Vein** | A random Pale hex near a Vein cluster becomes Vein (extra capacity 12) |
| 2 | **Wandering Sentinel** | A free Sentinel spawns at The Loom |
| 3 | **Cache** | Gain 3 of a random R0 resource |
| 4 | **Calm** | No Drift spawns next turn (including Surge if applicable) |
| 5 | **Resonance** | All production buildings produce double this turn |
| 6 | **Harvest** | All Gatherers collect double this turn |

**Driver: Variable Reinforcement on a Competence Backbone.** Windfalls don't win the game, but they create relief and opportunity. A Wandering Sentinel arriving when your defenses are stretched feels like a gift.

---

## Turn Structure

1. **Player Phase**
   - Move units (click-and-move, one at a time, each unit moves once)
   - Initiate attacks (move onto enemy hex)
   - Assign production recipes (click buildings)
   - Begin construction (unit with Build on empty hex)
   - Recruit units (at settlement, pay cost)
2. **Production Phase** (automatic)
   - Gatherers on resource hexes collect resources
   - Production buildings process one recipe each
   - Construction progresses (reduce remaining turns by Build value)
3. **Defense Phase** (automatic, animated)
   - Each defensive structure fires at one visible enemy in range (targeting per structure type)
   - Destruction animations for killed enemies
4. **Drift Phase** (automatic, animated)
   - Brood Mothers spawn E0s
   - All enemies move according to behavior (hop-by-hop animation)
   - Enemy-on-unit combat resolved on contact
   - Enemy-on-structure combat: if enemy strength > structure power, structure destroyed; otherwise enemy destroyed
5. **Spawn Phase** (automatic)
   - Base spawn roll
   - Surge check (every 10 turns)
   - Windfall check (5% chance)
6. **End Turn**
   - Check Mandate completion
   - Increment turn counter
   - Update HUD

**Driver: Animate the Enemy Phase.** Steps 3-4 are visible. The player watches towers fire, enemies advance hex-by-hex, and consequences land. This is where tension lives.

---

## Fog of War

Hexes beyond range 4 of any player unit or structure are fogged (terrain visible but enemies hidden). Seekers reveal range 7 (their position + Reveal(3) radius on top of base 4).

**Towers respect fog.** A tower can only fire at enemies it can see (within the visibility radius of any friendly unit or structure). A Longbow has range 8 but only fires at visible targets — without a Seeker or forward structure extending visibility, most of that range is wasted. This creates the **Seeker + Longbow combo:** a Seeker pushed forward extends visibility, letting a Longbow behind the lines snipe E0s from 8 hexes away.

**Driver: Information as Currency.** You know the map layout, but not where the Drift is gathering. Sending a Seeker out is risky but reveals threats before they arrive. A Brood Mother spawning in fog is producing E0s you can't see.

---

## The Settlement

The player's home base. Center of the map. A named hex: **"The Loom"** (because everything threads through it).

- Recruitment happens here (unit appears adjacent next turn)
- Starting Warden spawns here
- If an enemy reaches The Loom and no unit defends it, **game over**

### Supply Crate

The Loom starts with a **supply crate** — a small cache of materials left from whoever was here before. Contents: **4 R0d, 2 R0a, 2 R0b, 2 R0c.** Added to the stockpile at game start.

This lets the player recruit a Gatherer on turn 1 (costs 3 R0d) and still have 1 R0d + some of everything else to work with. The Warden can immediately head out to scout while the Gatherer starts harvesting. Eliminates the "10 turns of walking before anything happens" dead zone.

**Driver: Accumulation and Windfall.** The crate is a small windfall at the start — just enough to feel like you have options, not enough to skip the early grind entirely.

**Driver: Home Bases Give the Map Emotional Weight.** The Loom is home. Everything you build radiates outward from it. Defending it is non-negotiable. Venturing far from it is brave.

**Driver: Guardianship.** The Loom is the thing you protect. Losing it isn't just a loss condition — it's a failure of stewardship.

---

## Strategies

### Early Game (Turns 1-20)
**Pattern:** Supply crate gives you 4 R0d — recruit a Gatherer immediately (3 R0d) and send the Warden out to scout. Gatherer starts harvesting the nearest Scarp cluster. Warden identifies resource clusters and drops a Spike at a natural chokepoint (1 R0d from the crate). Build first Refinery around turn 12-15 once R0d is flowing.

**Tension:** The supply crate jumpstarts things but runs out fast. Where to send the Warden first? Scout toward Veins (R0a, needed for Sentinels) or toward the map edge (spot threats early)? The Gatherer is alone and defenseless (str 0) — how far from The Loom do you dare send it?

### Mid Game (Turns 20-50)
**Pattern:** 2-3 Gatherers working resource clusters. First Refinery producing Tier 1 goods. First Sentinel recruited for defense. Mason recruited to build Foundry and Watch Posts at chokepoints. Send a Seeker toward fog-covered map edges to spot Brood Mothers before they nest. Watch Posts at chokepoints near distant resource clusters protect Gatherers.

**Tension:** Surges are growing (turn 30 = 9 enemies). Brood Mothers may have appeared. Splitting workforce between gathering, building, and defense. First Mandate goals should be completing. Spikes start crumbling to E1s — upgrade to Watch Posts at critical chokepoints.

### Late Game (Turns 50-100+)
**Pattern:** Multiple production buildings running. Atelier online for Tier 3. Beacon Towers and Longbows at key positions — Longbows behind defended lines to sweep E0 swarms before they reach inner defenses. Sentinels patrolling perimeter, hunting Brood Mothers before they nest. Drift Charges held in reserve for emergencies — or spent to crack a Brood Mother nest that's gotten out of hand (but every charge detonated is one more to produce for the Mandate). Racing to complete final Mandate goals.

**Tension:** Surges are massive (turn 80 = 64 enemies). Brood Mother nests in fog producing swarms. Every unit matters. A Gatherer lost to a surprise E1 sets production back 5+ turns. Longbows are expensive (P3c each) and fragile (power 2) — losing one to an E1 that slipped through is devastating. Seekers become critical for fog intelligence.

### Recurring Tensions
- **Gather vs. Defend:** Every Gatherer is a unit that isn't a Sentinel.
- **Build vs. Produce:** A Mason building a new Foundry isn't building a Watch Post.
- **Expand vs. Consolidate:** Resource clusters far from The Loom are valuable but hard to defend.
- **Which chain first?** The Mandate forces prioritization. Two goals needing P1a means R0a is the bottleneck.
- **Spike vs. Save:** Spikes are cheap and fast, but R0d is also the raw material for Gatherers, Sentinels, Masons, Refineries, and Watch Posts. Every Spike built is R0d not spent on economy or better defenses.
- **Scout vs. Shelter:** Seekers reveal Brood Mothers in fog, but they're fragile (str 1). Losing a Seeker to an unseen E1 is a painful irony.

### Anti-Strategies (degenerate patterns the design must prevent)

**Turtle at The Loom:**
- *Prevention:* Resource hexes are distributed across the map, not near center. You MUST venture out to gather. Mandate goals require diverse resources from different terrain types.

**Ignore defense entirely, rush manufacturing:**
- *Prevention:* Surges grow quadratically. By turn 30, undefended workers die. Brood Mothers compound. The math is punishing.

**Ignore manufacturing, build army:**
- *Prevention:* Combat units cost resources. Sentinels cost R0a (from Veins) and R0d (from Scarps). You need manufacturing just to recruit. Also: no Mandate progress means no win.

**Stack all units on one hex:**
- *Prevention:* Max 2 units per hex. Gatherers must be on resource hexes to gather. Production buildings must be staffed for construction. The game mechanically forces spread.

**Spam Spikes everywhere:**
- *Prevention:* Spikes have power 1 — E1s (str 2) and Brood Mothers (str 4) walk right through them and destroy them. Spikes only stop E0s and E2s. A Spike-only defense collapses the moment E1s appear in surges (turn 20+). Also, every R0d spent on Spikes is R0d not spent on Gatherers, Sentinels, Refineries, and Watch Posts — the opportunity cost compounds. Finally, each Spike takes a builder 1 turn to place — a Mason spamming Spikes isn't building production structures.

**Wall of Watch Posts:**
- *Prevention:* Watch Posts cost 2 R0d + 1 R0c each and take 2 Mason-turns to build. Full perimeter coverage on a 60x60 map would require ~40+ towers = 80+ R0d, 40+ R0c, and 80+ Mason-turns. That's the entire game's R0d budget. More practically: Watch Posts (power 2) can't kill Brood Mothers (str 4), who destroy them on contact. A Watch Post line without mobile Sentinels to intercept Brood Mothers will eventually be breached and dismantled.

---

## State Model

```
GameState {
  seed: number              // determines all generated names
  names: Map<slot, string>  // R0a→"Dravik", E0→"Murk", P3a→"Vorithal Spenk", etc.
  turn: number
  map: Map<hexKey, Hex>
  units: Unit[]
  enemies: Enemy[]
  structures: Structure[]
  stockpile: Map<slot, number>  // keyed by slot (R0a, P1a, etc.), displayed by names[slot]
  mandate: Goal[]
  mandateIndex: number  // how many goals revealed
  settlement: hexKey
  fog: Set<hexKey>
  gameOver: boolean
  victory: boolean
}

Hex {
  q, r: number
  terrain: TerrainType
  resourceCapacity: number  // remaining gathers before depletion
}

Unit {
  id: number
  type: UnitType  // warden, gatherer, sentinel, mason, seeker
  q, r: number
  mp: number
  mpBudget: number
  strength: number
  abilities: Ability[]
  moved: boolean  // has moved this turn
  carrying: slot | null  // P3d if carrying a Drift Charge
}

Enemy {
  id: number
  type: EnemyType  // murk, hollow, thrall, blightMother
  q, r: number
  speed: number
  strength: number
  behavior: BehaviorType  // random, seekUnit, seekSettlement, seekResource
}

Structure {
  id: number
  type: StructureType  // refinery, foundry, atelier, watchPost, beaconTower, wardPylon
  q, r: number
  recipe: RecipeName | null  // for production buildings
  buildProgress: number  // turns remaining, 0 = complete
}

Goal {
  product: ProductName
  quantity: number
  produced: number  // progress toward goal
  revealed: boolean
}
```

**Driver: State Must Fit in a Struct.** Every piece of game state has a home. No hidden variables, no implicit state.

---

## Phoneme Name Generator

**Runs once at game start.** Generates names for all resource/product slots and low-level enemy types. Names are stored in GameState and used everywhere (HUD, tooltips, Mandate goals, stockpile display).

### Phoneme Tables

**Onset:** b, d, f, g, h, k, l, m, n, p, r, s, t, v, w, z, th, dr, gr, qu, sh, vr
**Nucleus:** a, e, i, o, u, ae, ei, ou, ai
**Coda:** k, l, m, n, r, s, t, x, th, ne, te, re, se
**Suffix (optional, for flavor):** -ium, -ane, -ite, -ol, -ox, -ik, -ar, -ene, -ese, -ith

### Generation Rules

1. **Single-word name (Tier 0, Tier 1, enemies):** Onset + Nucleus + Coda + optional Suffix. 1-3 syllables. Examples: "Dravik", "Quelith", "Thassium", "Lumenol"
2. **Two-word name (Tier 2, Tier 3):** Generate two single words. Examples: "Vorithal Spenk", "Gallerite Hexa"
3. **No two names may share the same first 3 characters** (prevents confusion)
4. **All names must be 4-10 characters per word** (readable on hex counters and in HUD)
5. **Generate 19 names total per game:**
   - 4 for Tier 0 resources (R0a-R0d)
   - 4 for Tier 1 products (P1a-P1d)
   - 4 for Tier 2 compounds (P2a-P2d) — two-word
   - 4 for Tier 3 masterworks (P3a-P3d) — two-word
   - 3 for enemy types (E0, E1, E2)

### What Gets Generated Names vs. Fixed Names

| Category | Named How | Rationale |
|----------|-----------|-----------|
| Raw resources (R0a-d) | Generated | "What the land gives" — each settlement names it differently |
| Refined products (P1a-d) | Generated | Recipes are discovered, not known |
| Compounds (P2a-d) | Generated (two-word) | Higher tier = more exotic |
| Masterworks (P3a-d) | Generated (two-word) | The most alien products |
| Enemy E0, E1, E2 | Generated | Local names for local fears |
| Brood Mother | **Fixed** | Universally recognized, rare, terrifying |
| Terrain types | **Fixed** | Map features, not inventory items |
| Unit types | **Fixed** | Roles, not substances |
| Structure types | **Fixed** | Architectural roles |
| The Loom, The Drift, The Mandate | **Fixed** | Setting concepts |

### Pseudocode

```
function generateName(rng, syllables = 1or2, suffix = maybe):
  name = ""
  for i in range(syllables):
    name += pick(rng, ONSETS) + pick(rng, NUCLEI) + pick(rng, CODAS)
  if suffix:
    name += pick(rng, SUFFIXES)
  return capitalize(name)

function generateGameNames(seed):
  rng = seededRandom(seed)
  names = {}
  used = []
  for each slot in [R0a..R0d, P1a..P1d, E0..E2]:
    repeat:
      name = generateName(rng, randInt(1,2), 50% chance suffix)
    until name.slice(0,3) not in used and name.length in [4,10]
    names[slot] = name
    used.push(name.slice(0,3))
  for each slot in [P2a..P2d, P3a..P3d]:
    word1 = generateName(rng, 1, 50% chance suffix)
    word2 = generateName(rng, 1, no suffix)
    names[slot] = word1 + " " + word2
  return names
```

### Driver

**Comedy + Variable Reinforcement.** Discovering that your critical Tier 3 product is called "Thoulox Brine" this game — and that you need 3 of them — gives each playthrough its own personality. Players will tell stories about "that game where the E1s were called Vreshk and they kept spawning speed-3."
