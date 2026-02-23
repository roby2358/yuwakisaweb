# Realm - Game Dynamics

This document describes the mechanics and systems that govern gameplay in Realm.

---

## Map Generation

### Terrain Generation

The map uses the **Diamond-Square (Fractal Plasma) algorithm** to generate realistic elevation-based terrain.

- Map is a hex grid with configurable radius (default: 12, creating ~469 hexes)
- Heightmap size: 129x129 (2^7 + 1) for smooth interpolation
- Roughness factor: 0.55

**Terrain Distribution (percentile-based):**
| Terrain   | Percentage | Movement Cost | Defense Bonus |
|-----------|------------|---------------|---------------|
| Water     | 20%        | Impassable    | 0             |
| Plains    | 73%        | 1             | 0             |
| Hills     | 5%         | 2             | +1            |
| Mountain  | 2%         | Impassable    | +2            |

- Edge hexes (distance >= mapRadius - 1) are always water, creating an ocean border


### Starting Location

The starting settlement is placed:
- On plains terrain
- Within 40% of map radius from center
- Scored by: proximity to center, adjacent plains

### Accessibility System

After determining the starting location, a **BFS flood fill** computes all accessible hexes:

1. Start from the settlement location
2. Traverse through all connected plains and hills
3. Mark mountains adjacent to accessible hexes (for gold placement only)

This accessible set is used to ensure:
- All resources are reachable from the starting position
- All danger points have a valid path to the player's territory

### Resource Placement

Fixed resource counts distributed on **accessible hexes only**:
| Resource     | Count | Valid Terrain          | Production         |
|--------------|-------|------------------------|-------------------|
| Forest       | 8     | Plains                 | +1 materials      |
| Quarry       | 3     | Hills                  | +2 materials      |
| Gold Deposit | 3     | Plains, Hills, or Mountain* | +2 gold      |

*Gold can spawn on mountains that are adjacent to accessible plains/hills.

### Danger Point Placement

- 3-6 danger points placed on outer ring (distance >= mapRadius - 2)
- Total strength distributed = 15 (split among all danger points)
- Only placed on **accessible** plains or hills (not mountains)
- Accessibility guarantees a traversable path to the starting settlement

---

## Hex Grid System

### Coordinate System

Uses **axial coordinates (q, r)** with pointy-top hexes.

**Pixel Conversion:**
```
x = HEX_SIZE * (sqrt(3) * q + sqrt(3)/2 * r)
y = HEX_SIZE * (3/2 * r)
```

### Distance Calculation

Hex distance between two points:
```
distance = (|q1 - q2| + |q1 + r1 - q2 - r2| + |r1 - r2|) / 2
```

### Pathfinding

A* algorithm used for:
- Validating danger point placement (BFS variant)
- Finding movement paths

Passability check considers terrain movement cost (Infinity = impassable).

---

## Movement

### Unit Movement

- Units have a **speed** stat determining moves per turn
- Moving costs terrain movement points:
  - Plains: 1 movement point
  - Hills: 2 movement points
  - Water/Mountain: Impassable
- Movement is **adjacent only** (1 hex at a time)
- Cannot move onto hexes with enemies (must attack instead)

### Stacking Limit

- Maximum **2 friendly units per hex**
- Cannot move into a hex at stacking limit

### Stacking Order

Units within a hex are sorted at the start of each turn:
1. **Type priority:** Cavalry > Heavy Infantry > Infantry > Worker
2. **HP (descending):** Higher health units first within same type

This order determines which unit is auto-selected when clicking the hex and the display order in the UI. The order is fixed for the turn and doesn't change as units take damage.

### Movement Reset

- All units reset to full movement at turn end
- Movement points not carried over

---

## Combat

### Attack Requirements

- Unit must not have acted this turn
- Target must be in adjacent hex
- Target hex must contain enemies

### Damage Calculation

Uses a **scaled damage formula with Gaussian randomization**:

```
expectedDamage = attack² / (attack + defense)
stddev = max(1, expectedDamage * 0.25)
damage = floor(max(0, expectedDamage + gaussian() * stddev))
```

This means:
- Equal attack/defense -> expected damage = attack/2
- Attack >> defense -> expected damage approaches attack
- Attack << defense -> expected damage approaches 0

### Defense Bonuses

Defense is modified by:
- **Terrain defense:** Hills +1, Mountain +2
- **Settlement defense:** +2 to +4 (scales with tier: 2 + tier * 2/9)
- **Installation defense:** Outpost +1, Fort +2, Garrison +3

### Counter-Attacks

Combat is always mutual - both sides deal damage:

**When player attacks enemy:**
1. Player unit deals damage to enemy
2. If enemy survives, enemy counter-attacks
3. Attacker receives structure defense bonuses
4. **Cavalry special:** Uses 5 defense against counter-attacks (strong charge)
5. If attacker dies, +2 unrest

**When enemy attacks player unit:**
1. Enemy deals damage to player unit (defender gets structure bonuses)
2. Player unit counter-attacks the enemy
3. If enemy dies from counter-attack, it's removed
4. If defender dies, +3 unrest

**When enemy attacks undefended settlement:**
1. +5 unrest
2. 30% chance to damage settlement:
   - If settlement tier > 0: reduce tier by 1
   - If settlement is a Camp (tier 0) and not the last settlement: destroyed (+10 unrest)

### Kill Rewards

Killing an enemy grants loot (2d6 per resource):
- 2-12 gold
- 2-12 materials
- Unit advances into the vacated hex (if empty)

### Combat Actions

- Attacking consumes all remaining movement
- Sets `movesLeft = 0`

### Combat Reporting

After end-of-turn processing, the game pauses to display visual feedback if any notable events occurred:

- **Yellow bang markers** appear on hexes where enemies attacked (units, settlements, or installations)
- **Red bang markers** appear on hexes where a friendly unit was killed or an enemy was killed by counter-attack
- **Yellow exclamation marks** appear on hexes where a monster spawned
- The "End Turn" button changes to "Continue"
- All game interactions are blocked during this display
- Clicking anywhere or pressing any key dismisses the markers and resumes play
- Turns with no events proceed without pausing

---

## Unit Types

| Type           | Attack | Defense | Speed | Health | Cost (g/m) |
|----------------|--------|---------|-------|--------|------------|
| Worker         | 1      | 1       | 2     | 10     | 5/5        |
| Infantry       | 2      | 2       | 2     | 10     | 5/2        |
| Heavy Infantry | 3      | 4       | 1     | 15     | 10/7       |
| Cavalry        | 4      | 1       | 3     | 8      | 15/5       |

### Worker Special Ability

Workers **double resource output** when stationed on a resource hex:
- Forest: 1 -> 2 materials
- Quarry: 2 -> 4 materials
- Gold Deposit: 2 -> 4 gold

Note: Mountain gold deposits cannot benefit from workers since mountains are impassable terrain. They still produce gold when controlled (via settlement influence or adjacent units).

### Cavalry Charge

Cavalry has a special rule: when **attacking**, they use **5 defense** against counter-attacks instead of their normal 1. This represents their strong charging ability. However, when defending against enemy attacks, they use their normal 1 defense - cavalry needs infantry support to hold ground.

### Unit Selection Priority

When clicking a hex with units, the first unit with moves remaining is auto-selected. Since units are sorted each turn (see Stacking Order), the selection priority follows the same order:
1. Cavalry
2. Heavy Infantry
3. Infantry
4. Worker

### Unit Deselection

Units are automatically deselected when:
- Movement is exhausted (movesLeft reaches 0)
- The turn ends

**Units with 0 movement are never selected.** If a unit runs out of moves after moving or attacking, it is immediately deselected. Clicking a hex will only auto-select units that have moves remaining.

At the start of a new turn, the **largest settlement** is automatically selected (random if tied for largest tier). If there are units with moves at that settlement, one will be auto-selected.

---

## Healing

Units heal at turn end based on their activity:

| Condition                        | Healing Rate |
|----------------------------------|--------------|
| Used all movement or attacked    | 0%           |
| Has moves left, in open          | 20%          |
| Has moves left, in settlement/installation | 30%          |

Healing formula: `ceil(maxHealth * healPercent)`

---

## Settlement System

### Settlement Tiers

| Tier | Name        | Gold | Materials | Influence Radius | Influence Strength | Population |
|------|-------------|------|-----------|------------------|-------------------|------------|
| 0    | Camp        | 1    | 1         | 1 (7 hexes)      | 1                 | 1          |
| 1    | Hamlet      | 2    | 2         | 1 (7 hexes)      | 2                 | 2          |
| 2    | Village     | 4    | 3         | 2 (19 hexes)     | 3                 | 3          |
| 3    | Town        | 7    | 5         | 2 (19 hexes)     | 4                 | 4          |
| 4    | Large Town  | 12   | 8         | 2 (19 hexes)     | 5                 | 5          |
| 5    | Small City  | 20   | 12        | 3 (37 hexes)     | 6                 | 6          |
| 6    | City        | 35   | 18        | 3 (37 hexes)     | 8                 | 8          |
| 7    | Large City  | 55   | 25        | 3 (37 hexes)     | 10                | 10         |
| 8    | Metropolis  | 80   | 35        | 4 (61 hexes)     | 12                | 12         |
| 9    | Capital     | 120  | 50        | 4 (61 hexes)     | 15                | 15         |

Total population is the sum of all settlement population values.

### Growth System

Settlements grow automatically each turn using **polynomial growth** against **exponential thresholds**:

**Growth per turn:** `floor(base × gaussian × decadenceMult)`
- Base: `10 × (1 + tier)^1.5` (polynomial)
- Gaussian multiplier: mean 1.0, stddev ±33%, min 0.1
- Decadence bonus: `1 + (decadence/100) × 0.25` (up to 25% boost at 100 decadence)

**Growth threshold:** `floor(50 × 2.1^tier)` (exponential)

| Tier | Growth/turn | Threshold | ~Turns to level |
|------|-------------|-----------|-----------------|
| 0    | 10          | 50        | 5               |
| 1    | 28          | 105       | 4               |
| 2    | 51          | 220       | 4               |
| 3    | 80          | 463       | 6               |
| 4    | 111         | 972       | 9               |
| 5    | 146         | 2041      | 14              |
| 6    | 185         | 4286      | 23              |
| 7    | 226         | 9001      | 40              |
| 8    | 270         | 18902     | 70              |
| 9    | —           | —         | (max tier)      |

**Total time to tier 8:** ~105 turns (early game quick, late game slow)

- When growth points reach the threshold, settlement advances one tier
- Growth points carry over (excess counts toward next level)

### Manual Upgrade Thresholds

Certain tiers require **manual upgrade** (cannot auto-advance past):
- Tier 5 (Small City) -> Tier 6 (City): 100 gold, 150 materials
- Tier 8 (Metropolis) -> Tier 9 (Capital): 300 gold, 400 materials

At these thresholds, growth points cap at 50 and overflow to nearby settlements.

### Dominance Shadow

Larger settlements cap the growth of nearby smaller ones:
- Settlements within the influence radius of a larger settlement
- Capped at (larger settlement tier - 1)
- Prevents clustering of large settlements

### Autonomous Settlement Spawning

Settlements spawn autonomously based on social pressure (unrest):

**Spawn Chance:** `10% + (unrest / 200)`

| Unrest | Spawn Chance |
|--------|--------------|
| 0      | 10%          |
| 20     | 20%          |
| 50     | 35%          |
| 80     | 50%          |

**On Successful Spawn:**
- Unrest is halved (pressure released as people leave)
- Overextension increases by 25% (more territory to manage)

**Hex Scoring:**

Each eligible hex is scored based on attraction (pull toward civilization) and repulsion (push away from crowding), using Gaussian functions:

```
attraction = Σ (strength × gaussian(dist, σ_attract))
repulsion  = Σ (strength × repelStrength × gaussian(dist, σ_repel))
score = attraction × max(0, 1 - repulsion) × e^(-minDist / λ_decay)
```

Where:
- `gaussian(d, σ) = e^(-(d² / (2 × σ²)))` (Gaussian falloff)
- `σ_attract = 4` (attraction standard deviation)
- `σ_repel = 1.1` (repulsion standard deviation - tight crowding zone)
- `repelStrength = 5` (repulsion multiplier for stronger dead zones)
- `strength = tier + 1` for each settlement
- `minDist` = distance to nearest settlement
- `λ_decay` = era-dependent expansion reach:
  - Barbarian: 0.5 (settlements cluster tightly)
  - Kingdom: 1 (moderate expansion)
  - Empire: 4 (distant expansion possible)

**Resource Adjacency Bonus:** 8x multiplier per adjacent resource (stacks multiplicatively: 8x, 64x, 512x)

This creates a "donut" of optimal placement: not too close (crowded), not too far (isolated). The era-dependent decay controls how far from existing settlements new ones can spawn.

**Hex Requirements:**
- Plains or hills terrain
- Must be on an accessible hex (reachable from starting location via BFS)
- No existing settlement, danger point, or resource
- Must have minimum score (0.001) after all calculations

### Manual Settlement Founding

Settlements can manually found new settlements, with costs scaling by era:

| Era       | Gold Cost | Materials Cost |
|-----------|-----------|----------------|
| Barbarian | 50        | 50             |
| Kingdom   | 100       | 100            |
| Empire    | 200       | 200            |

**Requirements:**
- Source settlement must be at least tier 1
- Must afford the era-based cost
- Valid target location must exist

**Effects:**
- Source settlement tier decreases by 1
- Source settlement growth points reset to 0
- New Camp (tier 0) settlement created at optimal location
- Target location uses same scoring as autonomous spawning

---

## Territory Control

### Controlled Territory

Hexes become controlled through:

1. **Settlement influence radius:**
   - All non-water hexes within settlement's influence radius

2. **Unit presence:**
   - Hex containing a friendly unit
   - All adjacent non-water hexes

### Influence Calculation

Total influence at a hex is the sum from all settlements:

```
For each settlement within range:
  sigma = radius / 2
  influence += strength * e^(-(distance² / (2 * sigma²)))
```

This creates a **Gaussian falloff** - influence is strongest at the settlement and decreases smoothly with distance.

---

## Resource Production

### Per-Turn Income

**From Settlements:**
- Gold and materials based on tier (see Settlement Tiers table)

**From Resource Hexes:**
- Only produces if hex is controlled
- Worker bonus: 2x output if a friendly worker is present

### Modifiers

1. **Corruption:** Reduces gold income by (corruption/4)%
2. **Decadence:** Reduces all production by (decadence/2)%

---

## Population

Population is **derived from settlements** rather than tracked as a separate resource.

**Total Population** = Sum of population values from all settlements (see Settlement Tiers table)

### Population Effects

- Contributes to era advancement thresholds
- Increases unrest slightly each turn (population × 0.02 added to random variance)

---

## Enemy System

### Danger Points

Danger points are threat generators on the map edge:

| Strength | Spawn Rate (turns) | Removal Difficulty |
|----------|-------------------|-------------------|
| 1        | 4                 | 83% per turn      |
| 2        | 3                 | 67% per turn      |
| 3        | 3                 | 50% per turn      |
| 4        | 2                 | 33% per turn      |
| 5        | 2                 | 17% per turn      |
| 6        | 1                 | 0% (installation only) |

### Enemy Spawning

Each turn, for each danger point:
1. Decrement spawn countdown
2. When countdown reaches 0:
   - Spawn **1 enemy** on a random valid adjacent hex
   - Reset countdown to spawn rate for this strength

Valid spawn hexes:
- Not water or mountain
- No other enemies present
- No settlements or installations
- **May contain friendly units** (see Spawn Attack below)

**Spawn Attack:** When a spawn targets a hex with a friendly unit, the spawning enemy attacks it before materializing:
1. Enemy rolls damage against the unit (attack vs defense + structure defense)
2. Unit counter-attacks the spawning enemy
3. If the unit is killed **and** the attacker survives the counter-attack, the enemy spawns (with reduced health from counter-damage)
4. If the unit survives, or the counter-attack would kill the spawning enemy, the spawn fails (unit still takes damage)
5. Units blocking spawn hexes are not safe — they will be attacked each time the spawn timer fires

### Enemy Types

Enemies spawn in four size categories with different stats:

| Type    | Attack | Defense | Speed | Health | Spawn Frequency |
|---------|--------|---------|-------|--------|-----------------|
| Small   | 2      | 1       | 2     | 4      | 20%             |
| Medium  | 4      | 1       | 1     | 6      | 30%             |
| Large   | 5      | 1       | 1     | 8      | 40%             |
| Monster | 6      | 3       | 1     | 12     | 10%             |

### Wild Spawning

As danger points are destroyed and decadence rises, threats emerge organically across the map. Two independent rolls occur each turn:

**Base probability:** `(15 - totalDangerStrength) × 0.001 × (decadence / 30)`

At full danger strength (15) or zero decadence, probability is 0%.

**1. Random Enemy + Danger Point (10x base chance):**
- Spawns a random enemy (using standard type weights) on a weighted hex
- Creates a new danger point at the same location with strength 1-5
- Represents new threats emerging from the wilderness

**2. Monster Spawn (1x base chance):**
- Spawns a monster on a weighted hex
- No danger point created

Both use the same weighted hex selection as settlement spawning (attraction/repulsion scoring). Both trigger a yellow exclamation mark in combat reporting.

### Enemy Purpose

Each enemy is assigned a permanent purpose at spawn that determines its movement behavior:

| Purpose    | Frequency | Movement                    |
|------------|----------|-----------------------------|
| Random     | 50%      | Wander randomly             |
| Resource   | 30%      | Move toward nearest resource |
| Settlement | 20%      | Move toward nearest settlement |

The purpose is fixed for the unit's lifetime and does not change.

### Enemy AI Behavior

Each turn, enemies act in this order:

**1. Attack (priority):**
- If adjacent to friendly unit, attack it
- Target priority: Heavy Infantry > Infantry > Cavalry > Worker
- If no units, attack adjacent settlements
- If no settlements, attack undefended installations

**2. Movement (if no attack):**

Enemies always move 1 space per turn, directed by their purpose (see Enemy Purpose above). If an enemy with a resource or settlement purpose cannot move closer to its target (blocked or no valid target exists), it falls back to random movement. If no adjacent hex is available at all, the enemy stands still.

### Enemy Movement Restrictions

- Move exactly 1 hex per turn
- Can traverse plains and hills
- Cannot enter water or mountains
- Cannot stack with other enemies
- Cannot enter hexes with units, settlements, or installations

### Removing Danger Points

**Method 1: Military occupation**
- Keep a unit on the danger point
- Each turn, the danger point attacks the occupying unit with ENEMY_LARGE stats (attack 5, defense 1)
- If the unit survives, roll 1d6
- If roll > strength, reduce strength by 1
  - Reward for reducing strength: 2d6 × (strength before reduction) gold and materials
  - Reward for destroying (strength reaches 0): 2d6 × 10 gold and materials (20-120 each)
- If the unit is killed, no reduction roll occurs (+3 unrest)
- Strength 6 cannot be removed this way

**Method 2: Build installation**
- Requires friendly unit present, no enemies
- Building any installation neutralizes the danger point

### Installation Attack

When an enemy attacks an undefended installation:
- Both the installation and enemy are destroyed
- A new danger point spawns at that location with random strength 1-6
- Spawn countdown is randomized within the normal range for that strength
- +5 unrest

---

## Installations

Installations can only be built on danger points:

| Type     | Defense | Cost (g/m) |
|----------|---------|------------|
| Outpost  | +1      | 15/20      |
| Fort     | +2      | 40/60      |
| Garrison | +3      | 100/150    |

Requirements:
- Hex must have a danger point
- No existing installation
- Friendly unit must be present
- No enemies in the hex

Building an installation **permanently neutralizes** the danger point.

---

## Society Parameters

Four parameters track civilization health (0-100%). The society panel displays bars that transition from **yellow (0%) to red (100%)** to indicate severity.

### Corruption

- **Increases:** +0.01 per settlement gold production, +0.1 per settlement per turn
- **Effect:** Reduces gold income by (corruption/4)% (e.g., 100% corruption = 25% reduction)
- **Decay:** None

### Unrest

- **Base Change:** (Random(-1 to +2) + population × 0.02) × era multiplier per turn
  - Varies each turn, sometimes increasing, sometimes decreasing
  - Trends slightly positive over time
  - **Era multiplier:** Barbarian x1, Kingdom x2, Empire x4
- **Combat Increases:**
  - +2 when friendly unit killed in combat
  - +3 when unit killed by enemy attack
  - +5 when settlement attacked or installation destroyed
  - +10 when settlement destroyed
- **Effect:** At >75%, 5% chance per settlement to revolt (destroyed)
- **Decay:** Can decrease naturally due to random variance
- **Special:** Triggers autonomous settlement spawning (see Settlement Spawning)

### Decadence

- **Increases:** Scales with era (ratio 1:2:4)
  - Barbarian: +0.5 per turn
  - Kingdom: +1.0 per turn
  - Empire: +2.0 per turn
- **Effect:** Reduces all production by (decadence/2)%
- **Decay:** None

### Overextension

- **Increases:** +0.025 per influenced hex per turn (rounded up)
- **Effect:** Contributes to collapse
- **Decay:** None
- **Special:** Increases by 25% when a new settlement spawns

Influenced hexes are hexes within the influence radius of any settlement (not including unit adjacency).

---

## Society Management

Click the **Society panel** to open the realm management interface. This displays:
1. A narrative description of the realm's current state
2. Current effects of each society parameter
3. Three available actions to manage the realm

### Action Selection

At the start of each turn, all 80 society actions are **shuffled** into a randomized list. When the panel is opened, the first 3 **valid** actions from this list are displayed. This means:
- Opening/closing the panel shows the same options (no gaming the system)
- Taking an action removes it from the list, so reopening shows fresh options
- All options reset and reshuffle at the start of the next turn

### Percentage-Based Effects

All society effects are **percentage multipliers**, not flat changes:
- **+20%** means multiply the current value by 1.2 (e.g., 50 -> 60)
- **-30%** means multiply the current value by 0.7 (e.g., 50 -> 35)

This makes:
- Low values easy to manage (small absolute changes)
- High values difficult to reduce (diminishing returns)
- Runaway problems increasingly hard to control

### Action Categories

#### 1. Trade Actions (No Resource Cost)
Swap one society problem for another. Good for rebalancing without spending resources.

Examples:
- "Royal Guards Crack Down": -20% Corruption, +30% Unrest
- "Host a Bacchanalia": -20% Unrest, +30% Decadence
- "Consolidate Borders": -25% Overextension, +15% Unrest

#### 2. Pay Actions (Gold Cost)
Spend gold to reduce one problem, with a smaller side effect.

Examples:
- "Hire Civil Administrators": -5 gold, -10% Overextension, +5% Corruption
- "Establish Courts": -10 gold, -20% Corruption, +10% Unrest
- "Secret Police": -10 gold, -20% Unrest, +15% Corruption

#### 3. Public Works Actions (Gold + Materials Cost)
Build structures that address society problems.

Examples:
- "Build a Temple": -2 gold, -10 materials, -20% Decadence, +10% Unrest
- "Build a Courthouse": -4 gold, -20 materials, -25% Corruption, +10% Unrest
- "Build City Walls": -8 gold, -30 materials, -20% Overextension, +5% Unrest

#### 4. Cash In Actions (Gain Resources)
**Requires:** Related society parameter > 20%

Accept resources in exchange for increasing society problems. Only available when you already have significant issues.

Examples:
- "Accept Gift from Wealthy Merchant": +5 gold, +20% Corruption (requires Corruption > 20)
- "Confiscate Rebel Properties": +10 gold, +30% Unrest (requires Unrest > 20)
- "Strip Frontier Fortifications": +30 materials, +40% Overextension (requires Overextension > 20)

| Resource Gains | Typical Effect Increase |
|----------------|------------------------|
| +5 gold        | +20-25%                |
| +10 gold       | +30-35%                |
| +20 gold       | +45-50%                |
| +10 materials  | +20-25%                |
| +20 materials  | +30-35%                |
| +30 materials  | +40-45%                |

---

## Eras

### Era Progression

| Era       | Settlements | Decadence Rate | Unrest Multiplier |
|-----------|-------------|----------------|-------------------|
| Barbarian | -           | +0.5/turn      | x1                |
| Kingdom   | 4+          | +1.0/turn      | x2                |
| Empire    | 7+          | +2.0/turn      | x4                |

Era transitions are automatic when settlement thresholds are met. Both decadence and unrest scale with era at ratio 1:2:4.

---

## Collapse

### Trigger

Collapse occurs when **any two society parameters reach 100%**.

### Consequences

1. Era resets to Barbarian
2. All society parameters reset to 0
3. All units are disbanded
4. Resources reset to starting values (100 gold, 50 materials)
5. **Settlement conversion:**
   - One settlement survives (smallest tier, random if tied)
   - Surviving settlement resets to Camp (tier 0)
   - All other settlements become danger points with strength 0
   - 15 strength points are randomly distributed among the danger points
   - Any danger points still at strength 0 are removed
   - This creates varied threat levels: some settlements disappear, others become strong danger points

---

## Turn Order

Each turn processes in this order:

1. **Unit refresh:** Heal units, reset movement and action flags
2. **Unit sorting:** Sort units within each hex by type priority (cavalry > heavy infantry > infantry > worker), then by HP descending
3. **Danger point occupation:** Check for strength reduction from military units
4. **Enemy spawning:** Process all danger point spawn timers
5. **Enemy turn:** Enemy attacks and movement
6. **Resource production:** Collect gold and materials
7. **Settlement growth:** Add growth points, check for tier advancement
8. **Settlement spawning:** Check for spontaneous settlement creation
9. **Wild spawning:** Check for random enemy + danger point spawn (10x base) and monster spawn (1x base)
10. **Society update:** Adjust corruption, unrest, decadence, overextension
11. **Era check:** Verify era transition thresholds
12. **Collapse check:** Check for civilization collapse
13. **Unit deselection:** Clear selected unit
14. **Society options shuffle:** Randomize available management actions for next turn
15. **Select largest settlement:** Auto-select the highest tier settlement (random if tied)
16. **Turn increment**
17. **Combat reporting pause:** If notable events occurred during steps 5 or 9, display markers and wait for player input before resuming (see Combat Reporting)

---

## Controls

### Mouse

- **Click hex:** Select hex, auto-select unit with moves remaining (see priority order)
- **Click selected unit's hex:** Deselect unit
- **Click valid move hex:** Move selected unit (deselects if moves exhausted)
- **Click enemy hex:** Attack with selected unit
- **Click Society panel:** Open realm management interface
- **Click Era button:** View era information and advancement requirements

### Keyboard

- **Escape:** Close modal or clear selection
- **Enter/Space:** End turn (if no modal open)
- **Any key:** Dismiss combat report (during reporting mode)

### Unit Selection

When multiple units occupy a hex, action buttons allow switching between them.
