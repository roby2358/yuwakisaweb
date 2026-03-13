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

**60x60 hex grid, point-top, axial coordinates.** Procedurally generated via diamond-square fractal heightmap.

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
- Elevation assigned via diamond-square (129×129 grid, roughness 0.55), mapped to terrain by percentile: bottom 15% Deep, top 5% Crag, rest Pale
- Edge hexes forced to Deep (impassable border)
- Resource clusters placed on Pale hexes: Vein (7 clusters, 5-8 hex), Grove (8, 5-8), Mire (6, 4-7), Scarp (7, 4-7)
- Starter veins: one small cluster (3-5 hex) of each resource type placed at distance 5 from settlement
- Settlement spawns near center on Pale terrain, favoring hexes with many passable neighbors

**Driver: Terrain as Language.** The player reads the map for strategy: Mire clusters near the edge are both valuable and dangerous. A river of Deep between you and a Vein cluster means a long detour. Chokepoints between Crags are natural tower sites.

---

## Units

All units are hex counters. Click to select, click a reachable hex to move. Classic wargame interaction.

### Base Unit Types

| Unit | Symbol | MP | Strength | Abilities | Cost |
|------|--------|----|----------|-----------|------|
| **Warden** | W | 4 | 2 | Gather(range 1), Build(1) | Starting unit |
| **Gatherer** | G | 5 | 0 | Gather(range 1) | 3 R0d |
| **Mason** | M | 3 | 1 | Build(2) | 2 R0d, 1 R0c |
| **Sentinel** | S | 3 | 3 | Melee | 2 R0d, 2 R0a |
| **Longbow** | L | 4 | 1 | Ranged (range 8, power 2, targets weakest) | 2 R0c, 1 R0a |
| **Seeker** | K | 6 | 1 | Reveal(3) | 1 R0b, 1 R0a |
| **Catapult** | T | 2 | 1 | AoE ranged (range 10, power 2) | 2 R0a, 2 R0c |

Unit type names (Warden, Gatherer, etc.) are fixed — they're roles, not substances.

### Unit Upgrade Lines

Four combat lines, each with 4 tiers plus a unique tier-5 pinnacle. Only **one pinnacle** may exist across all lines at any time. Upgrades are paid from the stockpile and consume the unit's turn.

**Sentinel line** (melee — close combat, risk of attacker death):

| Tier | Unit | MP | Str | Upgrade Cost |
|------|------|----|-----|-------------|
| 1 | Sentinel | 3 | 3 | (recruited) |
| 2 | Bulwark | 3 | 4 | 3 P1d |
| 3 | Ironclad | 4 | 6 | 2 P2b |
| 4 | Aegis | 4 | 8 | 1 P3a |
| 5 | **Titan** ★ | 6 | 12 | 1 each P3a-P3d |

**Longbow line** (ranged — attack from distance, no risk to attacker):

| Tier | Unit | MP | Range | Power | Upgrade Cost |
|------|------|----|-------|-------|-------------|
| 1 | Longbow | 4 | 8 | 2 | (recruited) |
| 2 | Arbalest | 4 | 8 | 3 | 3 P1a |
| 3 | Culverin | 5 | 9 | 4 | 2 P2c |
| 4 | Lancet | 5 | 10 | 6 | 1 P3c |
| 5 | **Devastator** ★ | 3 | 14 | 8 | 1 each P3a-P3d |

**Seeker line** (scout → develops ranged attack at tier 3):

| Tier | Unit | MP | Reveal | Range | Power | Upgrade Cost |
|------|------|----|--------|-------|-------|-------------|
| 1 | Seeker | 6 | 3 | — | — | (recruited) |
| 2 | Ranger | 7 | 4 | — | — | 3 P1b |
| 3 | Farseer | 7 | 5 | 4 | 1 | 2 P2a |
| 4 | Oracle | 7 | 7 | 6 | 2 | 1 P3b |
| 5 | **Prophet** ★ | 8 | 10 | 8 | 4 | 1 each P3a-P3d |

**Siege line** (AoE ranged — slow, long range, hits target hex + all neighbors):

| Tier | Unit | MP | Range | Power | Upgrade Cost |
|------|------|----|-------|-------|-------------|
| 1 | Catapult | 2 | 10 | 2 | (recruited) |
| 2 | Trebuchet | 2 | 12 | 3 | 3 P1c |
| 3 | Bombard | 2 | 14 | 5 | 2 P2d |
| 4 | Leviathan | 2 | 16 | 7 | 1 P3d |
| 5 | **Worldbreaker** ★ | 3 | 18 | 10 | 1 each P3a-P3d |

**Upgrade cost pattern:** Tier 1→2 costs 3 of a P1 product, 2→3 costs 2 of a P2 product, 3→4 costs 1 P3 product, 4→5 (pinnacle) costs 1 each of all four P3 products. Each line draws from a different resource chain (Sentinel: P1d/P2b/P3a, Longbow: P1a/P2c/P3c, Seeker: P1b/P2a/P3b, Siege: P1c/P2d/P3d).

### Abilities

- **Gather (range N):** At end of turn, all resource hexes within range N of the unit contribute 1 resource each to the global stockpile. Warden and Gatherer both have gather range 1. **Driver: Accumulation.**
- **Build(N):** Can construct structures. When a build starts, the structure's build time is divided by N to determine actual turns. Builder must remain on the hex; construction advances 1 step per turn while the builder is present. **Driver: Scarcity of Agency** (building locks a unit in place).
- **Reveal(N):** Adds N to the unit's base visibility range of 4. **Driver: Information as Currency.**
- **Melee:** Unit attacks by moving onto an enemy hex. Must be adjacent to the target and have at least half its max MP remaining. Uses the CRT (attacker can die). Adjacent friendly units contribute their strength to the attack.
- **Ranged (range, power):** Unit fires at any visible enemy within range without moving. Uses the Ranged CRT (attacker is safe — misses instead of dying). Consumes all remaining MP.
- **AoE (range, power):** Like ranged, but the attack hits the target hex and all 6 adjacent hexes. Destroys any enemy in the blast zone with strength ≤ power.

### Harvester Plant (Gatherer Upgrade)

A Gatherer standing on a Pale hex can be permanently converted into a **Harvester Plant** structure. The Harvester Plant automatically gathers all resource hexes within range 3 every turn — replacing a fragile mobile unit with a durable static gatherer. The Gatherer is consumed.

The cost is randomized per game: one random R0 resource (7-10 units) plus one random P1 product (2-3 units). This makes the timing and decision unique each playthrough.

### Recruitment

Units are recruited at the Settlement hex. Pay the resource cost; the unit appears on an adjacent passable hex immediately. **Driver: Scarcity of Agency.**

### Movement

Standard hex wargame. Select unit, see highlighted reachable hexes (Dijkstra within MP budget accounting for terrain costs). Click to move. Each unit can move once per turn, spending MP equal to terrain cost for each hex entered. **Minimum 1-hex movement:** a unit can always move to any adjacent non-impassable, non-friendly-occupied hex regardless of remaining MP.

**No stacking:** Only one friendly unit per hex. Friendly units block movement (can't pass through). Entering an enemy hex initiates combat.

### Tower Bonus

A unit standing on a completed defensive structure gains +2 strength (for melee combat support) and +3 visibility range.

---

## Combat

### Melee Combat (CRT)

When a melee unit moves onto an enemy hex, calculate odds ratio: `attacker_strength : defender_strength`. Adjacent friendly units contribute their strength (units on towers get +2). Round to nearest column.

| d6 | 1:2 | 1:1 | 2:1 | 3:1 | 4:1+ |
|----|-----|-----|-----|-----|------|
| 1 | AE | AE | EX | DE | DE |
| 2 | AE | AE | DE | DE | DE |
| 3 | AE | EX | DE | DE | DE |
| 4 | EX | DE | DE | DE | DE |
| 5 | EX | DE | DE | DE | DE |
| 6 | DE | DE | DE | DE | DE |

- **AE** = Attacker Eliminated
- **DE** = Defender Eliminated (attacker advances onto hex)
- **EX** = Exchange (both eliminated)

**Ratio breakpoints:** <0.75 → 1:2, <1.5 → 1:1, <2.5 → 2:1, <3.5 → 3:1, ≥3.5 → 4:1.

**Driver: Old-school wargame feel.** The CRT rewards concentration of force. A lone Sentinel (str 3) vs. a Brood Mother (str 4) is 1:1 — risky. Two Sentinels adjacent make it 6:4 → 2:1 — much better. Positioning matters.

### Ranged Combat (Ranged CRT)

Ranged and AoE units use a separate table. The attacker is never at risk — misses replace AE results.

| d6 | 1:2 | 1:1 | 2:1 | 3:1 | 4:1+ |
|----|-----|-----|-----|-----|------|
| 1 | -- | -- | -- | DE | DE |
| 2 | -- | -- | -- | DE | DE |
| 3 | -- | -- | DE | DE | DE |
| 4 | -- | DE | DE | DE | DE |
| 5 | DE | DE | DE | DE | DE |
| 6 | DE | DE | DE | DE | DE |

For AoE attacks, if the primary target is destroyed, splash damage also destroys all enemies on adjacent hexes with strength ≤ power.

### Enemy-on-Unit Combat (Drift Phase)

When an enemy moves onto a hex containing a player unit during the Drift Phase:
- If enemy strength > unit strength: unit is destroyed
- If enemy strength = unit strength: both destroyed (exchange)
- If enemy strength < unit strength: enemy is destroyed

**No dice for enemy-on-unit combat.** Enemies are numerous enough that individual randomness isn't needed — the randomness is in where they are and how fast they move.

### Enemy-on-Structure Combat

When an enemy moves onto a structure's hex:
- If enemy strength > structure power: structure is destroyed, enemy survives
- Otherwise: enemy is destroyed

### Spoils

When an enemy is destroyed (by any means), it drops resources into the global stockpile:

| Enemy | Strength | Drop |
|-------|----------|------|
| **E0** | 1 | 1 random R0 |
| **E2** | 1 | 1 random R0 |
| **E1** | 2 | 2 random R0 (rolled independently) |
| **Brood Mother** | 4 | 2 random R0 + 1 random P1 |

**Driver: Revenge as Fuel.** Hunting the E1 that killed your Gatherer isn't just catharsis — it pays. Brood Mothers are worth hunting proactively: the P1 drop skips a Refinery cycle. **Driver: Double-Edged Mechanics** — engaging enemies yields resources but risks units.

---

## Manufacturing Chains

Four raw resources feed into a 4-tier production chain. **All resource and product names are generated per game** via the phoneme system. The chain *structure* (which inputs combine) is fixed — only the names change.

**Recipe rates** are randomized per game: each recipe has a multiplier (Tier 1: 7-12, Tier 2: 3-6, Tier 3: 2-3) that scales the base input quantities. This means the economy feels different each playthrough.

### Tier 0 — Raw Resources (gathered from terrain)

| Slot | Source Terrain | Example Name |
|------|---------------|-------------|
| **R0a** | Vein | "Dravik" |
| **R0b** | Grove | "Solvane" |
| **R0c** | Mire | "Quelith" |
| **R0d** | Scarp | "Ferrox" |

### Tier 1 — Refined Goods (require Refinery)

Base recipe: 1 raw → 1 refined (scaled by per-game rate).

| Slot | Base Input | Example Name |
|------|-----------|-------------|
| **P1a** | 1 R0a | "Thassium" |
| **P1b** | 1 R0b | "Lumenol" |
| **P1c** | 1 R0c | "Mirevite" |
| **P1d** | 1 R0d | "Ashlar" |

### Tier 2 — Compounds (require Foundry)

| Slot | Base Inputs | Example Name |
|------|------------|-------------|
| **P2a** | 1 P1a + 1 P1b | "Vorithane" |
| **P2b** | 1 P1a + 1 P1c | "Gallerite" |
| **P2c** | 1 P1d + 1 P1b | "Heliodex" |
| **P2d** | 1 P1c + 1 P1d | "Cinderite" |

### Tier 3 — Masterworks (require Atelier)

| Slot | Base Inputs | Example Name |
|------|------------|-------------|
| **P3a** | 1 P2a + 1 P2d | "Beacon Core" |
| **P3b** | 1 P2b | "Ward Shell" |
| **P3c** | 1 P2c + 1 P2a | "Resonance Lens" |
| **P3d** | 1 P2d + 1 P2b | "Drift Charge" |

**Tier 2 and 3 names are two-word compounds** — both words generated. E.g., "Vorithal Spenk" instead of "Beacon Core."

### Consumables

P3d is unique among Tier 3 products — it's a **one-use area weapon** rather than a building material.

**P3d — Drift Charge:** Any unit can carry and deploy it. Target any visible hex within range 3 of the carrying unit. All enemies within radius 2 of the target hex are destroyed, regardless of strength. The P3d is consumed.

- Drift Charges are produced by the Atelier like any Tier 3 product and stored in the global stockpile.
- A unit "picks up" a charge from the stockpile (one charge per unit).
- **The Mandate tension:** The Mandate may require "Produce 3 P3d." Every charge detonated is one you'll need to produce again. Use it now to survive, or hoard it for the goal? **Driver: Double-Edged Mechanics Are Gold.**

### Production Buildings

Structures built on hexes by units with Build ability. Each processes one recipe per turn automatically if scaled inputs are available in the global stockpile.

| Structure | Build Cost | Build Time (Mason) | Processes |
|-----------|-----------|-------------------|-----------|
| **Refinery** | 3 R0d | 1 turn | Tier 0 → Tier 1 |
| **Foundry** | 2 P1d, 1 P1a | 2 turns | Tier 1 → Tier 2 |
| **Atelier** | 2 P2c, 1 P2a | 3 turns | Tier 2 → Tier 3 |

**Production rule:** Each building has a single active recipe. Player assigns which recipe the building produces. One output per turn, consuming scaled inputs from global stockpile. If inputs unavailable, building idles. **Driver: Accumulation** (chains take many turns to establish, then produce steadily).

**Global stockpile:** All resources are pooled. Gatherers deposit automatically at end of turn. Buildings draw from and deposit to the stockpile. No transport logistics — the settlement "just knows."

---

## Defensive Structures

Static defenses that auto-fire during the defense phase. Built by units with Build ability. All defensive structures (and ranged units) **ignore Brood Mothers** when selecting targets — Brood Mothers must be dealt with by melee units or Drift Charges.

| Structure | Build Cost | Build Time (Mason) | Range | Power | Targeting |
|-----------|-----------|-------------------|-------|-------|-----------|
| **Spike** | 1 R0c | 1 turn | 3 | 1 | Weakest in range |
| **Watch Post** | 2 R0a, 1 R0c | 1 turn | 3 | 2 | Strongest in range |
| **Beacon Tower** | 1 P3a | 2 turns | 3 | 3 | Strongest in range |
| **Ward Pylon** | 1 P3b | 2 turns | 3 | 4 | ALL enemies in range |

**Spacing rule:** All structures (except Spikes) must be at least 3 hexes from any other structure and from The Loom. Spikes can be placed on any unoccupied hex.

**Auto-fire rule:** During the defense phase, each defensive structure fires once at a visible enemy in range (excluding Brood Mothers). If structure power ≥ enemy strength, enemy is destroyed.

**Ranged units also auto-fire** during the defense phase, following the same rules as structures.

**Structure durability:** When an enemy moves onto a structure's hex during the Drift Phase, compare enemy strength vs. structure power. If enemy strength > structure power, the structure is destroyed (and the enemy survives). Otherwise the enemy is destroyed.

**Demolition:** A unit with Build ability standing on a structure can demolish it, removing the structure.

**Driver: Tower Defense + Guardianship.** Placing defenses is an investment that pays off passively — but only if enemies come through that chokepoint. Misplaced towers are wasted resources. Spikes are sandbags — cheap to place, expect to lose them. High-tier towers are worth protecting with Sentinels.

---

## The Drift (Enemies)

Enemies spawn from map edges and roam inward. They are the pressure that makes resource management urgent.

### Enemy Types

Low-level enemy type names (E0, E1, E2) are **generated per game** via the phoneme system. The Brood Mother is a fixed name. Enemy colors are generated from a random hue each game.

| Slot | Symbol | Speed | Strength | Behavior | Example Name |
|------|--------|-------|----------|----------|-------------|
| **E0** | m | 1 | 1 | Wanders randomly; **stampedes** when 5+ allies within 2 hexes | "Murk" |
| **E1** | h | 1-3 (rolled at spawn) | 2 | Seeks nearest player unit or structure | "Hollow" |
| **E2** | t | 2 | 1 | Seeks settlement | "Thrall" |
| **Brood Mother** | B | 1 | 4 | Spawns 1 E0 per turn on adjacent hex. Seeks nearest resource hex | (fixed name) |

**Stampede:** E0s are normally harmless wanderers, but when 5 or more other enemies cluster within range 2, the E0 switches behavior to seek the nearest player unit or structure. This creates emergent swarm behavior — a mob of E0s near your perimeter suddenly becomes directed.

**Driver: Variable Speed Creates Dread.** E1s roll speed at spawn. A speed-3 E1 closing from 5 hexes is a crisis. A speed-1 E1 is manageable.

**Driver: Enemy Identity.** Each enemy is a persistent counter on the board. The E1 that killed your Gatherer is trackable. You can hunt it.

### Spawn Mechanics

**Base spawn:** Each turn, 1/3 chance of spawning 1 E0 on a random passable edge hex (or near-edge hex if all edges are impassable).

**Surge:** Every 10 turns, a Surge occurs. Surge strength follows a sinusoidal wave pattern:
- `phase = turn / 10`
- `min = min(phase × 3, 30)`, `max = min(phase × 10, 100)`
- `wave = 0.5 + 0.5 × sin(phase × π/3)`
- `strength = floor(min + (max - min) × wave)`

This creates peaks and valleys rather than pure quadratic growth, giving the player breathing room between crisis points while still escalating overall.

Surge composition: 60% E0s, 25% E2s, 10% E1s, 5% Brood Mothers. Spawned on random edge hexes.

**Brood Mother multiplication:** Each surviving Brood Mother spawns 1 E0 per turn at the start of the Drift Phase. This is the compounding danger: ignore a Brood Mother for 10 turns and she's produced 10 E0s.

**Driver: Parabolically Increasing Danger.** Surges grow with escalating waves. Brood Mothers grow linearly but compound. A player who neglects defense faces a board full of Drift. A player who over-invests in defense can't manufacture. This is the core tension.

### Enemy Movement

During the Drift Phase, each enemy moves up to its speed in hexes per turn:
- **E0:** Random valid adjacent hex (avoid Deep/Crag). If stampeding (5+ allies within 2): A* toward nearest player unit or structure.
- **E1:** A* toward nearest player unit or structure, walk up to speed hexes along path
- **E2:** A* toward settlement hex, walk up to speed hexes along path
- **Brood Mother:** A* toward nearest resource terrain hex, walk 1 hex along path

All directed enemies use full A* pathfinding with global vision.

---

## The Mandate (Win Condition)

At game start, the Mandate is generated: a list of 6 manufacturing goals. The first 2 goals are revealed; completing a revealed goal reveals the next unrevealed one.

### Goal Generation

Always 3 Tier 2 goals + 3 Tier 3 goals, shuffled from the available products:
- Tier 2 goals: produce 2-4 of a random T2 product
- Tier 3 goals: produce 1-3 of a random T3 product

Tier 2 goals come first, Tier 3 goals follow. Production toward goals is tracked automatically as buildings output products.

Completing all 6 goals wins the game. Turn count serves as score (lower is better).

**Driver: Accumulation and Windfall.** Each goal completed feels like a milestone. When a chain finally produces its first Tier 3 product after 30+ turns of setup, that's the windfall.

---

## Windfalls (Random Positive Events)

Each turn, 5% chance of a windfall. Roll d6:

| Roll | Event | Effect |
|------|-------|--------|
| 1 | **Rich Vein** | A random Pale hex adjacent to an existing Vein cluster becomes Vein |
| 2 | **Wandering Sentinel** | A free Sentinel spawns adjacent to The Loom |
| 3 | **Cache** | Gain 3 of a random R0 resource |
| 4 | **Calm** | No Drift spawns next turn (including Surge if applicable) |
| 5 | **Resonance** | All production buildings run their recipes a second time this turn |
| 6 | **Harvest** | All gathering (units and Harvester Plants) runs a second time this turn |

**Driver: Variable Reinforcement on a Competence Backbone.** Windfalls don't win the game, but they create relief and opportunity. A Wandering Sentinel arriving when your defenses are stretched feels like a gift.

---

## Turn Structure

1. **Player Phase**
   - Move units (each unit moves once per turn)
   - Initiate melee attacks (move onto adjacent enemy hex)
   - Fire ranged attacks (target visible enemy in range)
   - Deploy Drift Charges
   - Assign production recipes to buildings
   - Begin construction (unit with Build on valid hex)
   - Recruit units (at settlement, pay cost)
   - Upgrade units (pay upgrade cost)
   - Upgrade Gatherer to Harvester Plant
   - Demolish structures
2. **Production Phase** (automatic)
   - Gatherers and Harvester Plants collect resources from hexes in range
   - Construction progresses (1 step per turn while builder is present)
   - Production buildings process one recipe each
3. **Defense Phase** (automatic)
   - Each defensive structure fires at one visible enemy in range (excluding Brood Mothers)
   - Each ranged unit fires at one visible enemy in range (excluding Brood Mothers)
4. **Drift Phase** (automatic)
   - Brood Mothers spawn E0s
   - All enemies move according to behavior
   - Enemy-on-unit combat resolved on contact
   - Enemy-on-structure combat resolved
   - Settlement breach check (game over if enemy on The Loom with no defender)
5. **Spawn & Windfall Phase** (automatic)
   - Base spawn roll (skipped if Calm active)
   - Surge check (every 10 turns, skipped if Calm active)
   - Windfall check (5% chance)
6. **End Turn**
   - Check Mandate completion
   - Increment turn counter
   - Reset unit MP
   - Recompute visibility

---

## Fog of War

Hexes beyond range 4 of any player unit, structure, or the settlement are fogged (terrain visible but enemies hidden). Seekers add their Reveal value to this base range. Units on towers gain +3 visibility.

**Towers and ranged units respect fog.** They can only fire at enemies within the combined visibility of all friendly sources. A Longbow has range 8 but only fires at visible targets — without a Seeker or forward structure extending visibility, most of that range is wasted. This creates the **Seeker + Longbow combo:** a Seeker pushed forward extends visibility, letting a Longbow behind the lines snipe from distance.

**Driver: Information as Currency.** You know the map layout, but not where the Drift is gathering. Sending a Seeker out is risky but reveals threats before they arrive. A Brood Mother spawning in fog is producing E0s you can't see.

---

## The Settlement

The player's home base. Near center of the map. A named hex: **"The Loom"** (because everything threads through it).

- Recruitment happens here (unit appears on adjacent hex)
- Starting Warden spawns here
- If an enemy reaches The Loom and no unit defends it, **game over**

### Supply Crate

The Loom starts with a **supply crate** — a small cache of materials left from whoever was here before. Contents: **4 R0d, 2 R0a, 2 R0b, 2 R0c.** Added to the stockpile at game start.

This lets the player recruit a Gatherer on turn 1 (costs 3 R0d) and still have 1 R0d + some of everything else to work with. The Warden can immediately head out to scout while the Gatherer starts harvesting. Eliminates the "10 turns of walking before anything happens" dead zone.

**Driver: Accumulation and Windfall.** The crate is a small windfall at the start — just enough to feel like you have options, not enough to skip the early grind entirely.

**Driver: Guardianship.** The Loom is the thing you protect. Losing it isn't just a loss condition — it's a failure of stewardship.

---

## Strategies

### Early Game (Turns 1-20)
**Pattern:** Supply crate gives you 4 R0d — recruit a Gatherer immediately (3 R0d) and send the Warden out to scout. Gatherer starts harvesting the nearest Scarp cluster (within gather range 1). The starter veins at distance 5 guarantee nearby resources. Build first Refinery around turn 12-15 once R0d is flowing. Recruit a Longbow or Sentinel for early defense.

**Tension:** Where to send the Warden first? Scout toward Veins (R0a, needed for combat units) or toward the map edge (spot threats early)? The Gatherer is defenseless (str 0) — how far from The Loom do you dare send it?

### Mid Game (Turns 20-50)
**Pattern:** 2-3 Gatherers working resource clusters (or first Harvester Plant online). First Refinery producing Tier 1 goods. Combat units recruited and beginning upgrades. Mason recruited to build Foundry and Watch Posts at chokepoints. Send a Seeker toward fog-covered map edges to spot Brood Mothers before they nest.

**Tension:** Surges are growing. Brood Mothers may have appeared. Splitting workforce between gathering, building, and defense. First Mandate goals should be completing. Begin upgrading combat units — Bulwarks and Arbalests change the defensive calculus.

### Late Game (Turns 50-100+)
**Pattern:** Multiple production buildings running. Atelier online for Tier 3. Upgraded units (Ironclads, Culverins, Oracles) holding the perimeter. Siege units bombarding clusters. Considering pinnacle upgrades. Drift Charges held in reserve for emergencies. Racing to complete final Mandate goals.

**Tension:** Surges hit massive peaks. Brood Mother nests in fog producing swarms. Every unit matters. The pinnacle decision is agonizing — Titan for melee dominance, Devastator for ranged control, Prophet for intelligence, or Worldbreaker for area denial? Each costs all four P3 products.

### Recurring Tensions
- **Gather vs. Defend:** Every Gatherer is a unit that isn't a Sentinel.
- **Build vs. Produce:** A Mason building a new Foundry isn't building a Watch Post.
- **Expand vs. Consolidate:** Resource clusters far from The Loom are valuable but hard to defend.
- **Upgrade vs. Recruit:** Spending P1 on upgrades is P1 not spent on production chains.
- **Which chain first?** The Mandate forces prioritization. Two goals needing P1a means R0a is the bottleneck.
- **Spike vs. Save:** Spikes are cheap (1 R0c), but R0c is also needed for Watch Posts and Longbows. Opportunity cost compounds.
- **Scout vs. Shelter:** Seekers reveal Brood Mothers in fog, but they're fragile (str 1). Losing a Seeker to an unseen E1 is a painful irony.

---

## Phoneme Name Generator

**Runs once at game start.** Generates names for all resource/product slots and low-level enemy types. Names are stored in GameState and used everywhere.

### Phoneme Tables

**Onset:** b, d, f, g, h, k, l, m, n, p, r, s, t, v, w, z, th, dr, gr, qu, sh, vr
**Nucleus:** a, e, i, o, u, ae, ei, ou, ai
**Coda:** k, l, m, n, r, s, t, x, th, ne, te, re, se
**Suffix (optional, for flavor):** -ium, -ane, -ite, -ol, -ox, -ik, -ar, -ene, -ese, -ith

### Generation Rules

1. **Single-word name (Tier 0, Tier 1, enemies):** Onset + Nucleus + Coda + optional Suffix. 1-2 syllables. Max length 4-12 characters.
2. **Two-word name (Tier 2, Tier 3):** Two independently generated single words.
3. **No two names may share the same first 3 characters** (prevents confusion)
4. **19 names total per game:** 4 R0 + 4 P1 + 4 P2 (two-word) + 4 P3 (two-word) + 3 enemies

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

### Driver

**Comedy + Variable Reinforcement.** Discovering that your critical Tier 3 product is called "Thoulox Brine" this game — and that you need 3 of them — gives each playthrough its own personality. Players will tell stories about "that game where the E1s were called Vreshk and they kept spawning speed-3."

---

## State Model

```
GameState {
  seed: number
  rng: seeded PRNG instance
  names: { slot → string }        // R0a→"Dravik", E0→"Murk", P3a→"Vorithal Spenk", etc.
  turn: number
  map: Map<hexKey, Hex>
  units: Unit[]
  enemies: Enemy[]
  structures: Structure[]
  stockpile: { slot → number }    // keyed by slot (R0a, P1a, etc.)
  recipeRates: { recipe → number } // per-game multiplier for each recipe's inputs
  harvesterCost: { slot → number } // per-game cost for Gatherer→Harvester Plant
  enemyColors: { type → hex }     // per-game generated enemy colors
  mandate: Goal[]
  settlement: hexKey
  visible: Set<hexKey>
  calmNextTurn: boolean
  gameOver: boolean
  victory: boolean
}

Hex {
  q, r: number
  col, row: number                // grid position for heightmap lookup
  elevation: number
  isEdge: boolean
  terrain: TerrainType
}

Unit {
  id: number
  type: string                    // warden, gatherer, sentinel, bulwark, longbow, etc.
  q, r: number
  mp: number
  carrying: slot | null           // P3d if carrying a Drift Charge
}

Enemy {
  id: number
  type: string                    // E0, E1, E2, broodMother
  q, r: number
  speed: number
  strength: number
}

Structure {
  id: number
  type: string                    // refinery, foundry, atelier, spike, watchPost, etc.
  q, r: number
  recipe: string | null           // for production buildings
  buildProgress: number           // turns remaining, 0 = complete
  builderId: number | null        // unit responsible for construction
}

Goal {
  product: string
  quantity: number
  produced: number
  revealed: boolean
}
```
