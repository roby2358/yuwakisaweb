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
- Equal attack/defense → expected damage = attack/2
- Attack >> defense → expected damage approaches attack
- Attack << defense → expected damage approaches 0

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

Killing an enemy grants:
- 1-4 gold (random)
- 1-4 materials (random)
- Unit advances into the vacated hex (if empty)

### Combat Actions

- Attacking consumes all remaining movement
- Sets `movesLeft = 0`

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
- Forest: 1 → 2 materials
- Quarry: 2 → 4 materials
- Gold Deposit: 2 → 4 gold

Note: Mountain gold deposits cannot benefit from workers since mountains are impassable terrain. They still produce gold when controlled (via settlement influence or adjacent units).

### Cavalry Charge

Cavalry has a special rule: when **attacking**, they use **5 defense** against counter-attacks instead of their normal 1. This represents their strong charging ability. However, when defending against enemy attacks, they use their normal 1 defense - cavalry needs infantry support to hold ground.

### Unit Selection Priority

When clicking a hex with multiple units, priority order for auto-selection:
1. Cavalry (fastest)
2. Infantry
3. Heavy Infantry (slowest)

Workers are not auto-selected and must be manually selected via action buttons.

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

| Level | Name        | Gold | Materials | Influence Radius | Influence Strength | Population |
|-------|-------------|------|-----------|------------------|-------------------|------------|
| 1     | Camp        | 1    | 1         | 1 (7 hexes)      | 1                 | 1          |
| 2     | Hamlet      | 2    | 2         | 1 (7 hexes)      | 2                 | 2          |
| 3     | Village     | 4    | 3         | 2 (19 hexes)     | 3                 | 3          |
| 4     | Town        | 7    | 5         | 2 (19 hexes)     | 4                 | 4          |
| 5     | Large Town  | 12   | 8         | 2 (19 hexes)     | 5                 | 5          |
| 6     | Small City  | 20   | 12        | 3 (37 hexes)     | 6                 | 6          |
| 7     | City        | 35   | 18        | 3 (37 hexes)     | 8                 | 8          |
| 8     | Large City  | 55   | 25        | 3 (37 hexes)     | 10                | 10         |
| 9     | Metropolis  | 80   | 35        | 4 (61 hexes)     | 12                | 12         |
| 10    | Capital     | 120  | 50        | 4 (61 hexes)     | 15                | 15         |

Total population is the sum of all settlement population values.

### Building Settlements

Requirements:
- Plains or Hills terrain
- No existing settlement or danger point
- Hex must be controlled
- **Friendly unit must be present**
- Influence at location >= 1.0
- At least one existing settlement
- Cost: 20 gold, 30 materials

**Expansion Cost:**
Building a new settlement reduces the tier of your **largest settlement** by 1:
- If multiple settlements tie for largest, one is chosen randomly
- The affected settlement's growth points reset to 50
- If the largest settlement is a Camp (tier 0), it will be **destroyed**
- A confirmation dialog appears before destroying a settlement

### Growth System

Settlements grow automatically each turn using **polynomial growth** against **exponential thresholds**:

**Growth per turn:** `1 + tier` (scales with settlement size)
- **Exception:** Tier 0 (Camp) gets a **4x bonus** (4 growth/turn) - hearty settlers!

**Growth threshold:** `floor(50 × 1.5^tier)` (exponential)

| Tier | Growth/turn | Threshold | ~Turns to level |
|------|-------------|-----------|-----------------|
| 0    | 4 (bonus)   | 50        | 13              |
| 1    | 2           | 75        | 38              |
| 2    | 3           | 113       | 38              |
| 3    | 4           | 169       | 42              |
| 4    | 5           | 253       | 51              |
| 5    | 6           | 380       | 63              |
| 6    | 7           | 570       | 81              |
| 7    | 8           | 855       | 107             |
| 8    | 9           | 1282      | 142             |

- When growth points reach the threshold, settlement advances one tier
- Growth points carry over (excess counts toward next level)

### Manual Upgrade Thresholds

Certain levels require **manual upgrade** (cannot auto-advance past):
- Level 6 (Small City) → Level 7 (City): 100 gold, 150 materials
- Level 9 (Metropolis) → Level 10 (Capital): 300 gold, 400 materials

At these thresholds, growth points cap at 50 and overflow to nearby settlements.

### Dominance Shadow

Larger settlements cap the growth of nearby smaller ones:
- Settlements within the influence radius of a larger settlement
- Capped at (larger settlement tier - 1)
- Prevents clustering of large settlements

### Spontaneous Settlement Spawning

Each turn, there's a 10% chance to spawn a new Camp:
- Hex must be controlled, not have settlement/danger point
- Must be plains or hills
- Influence >= 3.0 required
- Weighted by influence (higher = more likely)

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
- Increases unrest slightly each turn (+0.01 per population)

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
- No friendly units, settlements, or installations

### Enemy Stats

All spawned enemies have identical stats:
- Attack: 5
- Defense: 1
- Health: 8

### Enemy AI Behavior

Each turn, enemies act in this order:

**1. Attack (priority):**
- If adjacent to friendly unit, attack it
- Target priority: Heavy Infantry > Infantry > Cavalry
- If no units, attack adjacent settlements
- If no settlements, attack undefended installations

**2. Movement (if no attack):**

Enemies always move 1 space per turn:
| Roll | Action |
|------|--------|
| 0-33% | Move toward nearest resource |
| 33-67% | Move toward nearest settlement |
| 67-100% | Random movement |

### Enemy Movement Restrictions

- Move exactly 1 hex per turn
- Can traverse plains and hills
- Cannot enter water or mountains
- Cannot stack with other enemies
- Cannot enter hexes with units, settlements, or installations

### Removing Danger Points

**Method 1: Military occupation**
- Keep a unit on the danger point
- Each turn, roll 1d6
- If roll > strength, reduce strength by 1
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

- **Increases:** +0.01 per gold income, +0.1 per settlement per turn
- **Effect:** Reduces gold income by (corruption/4)% (e.g., 100% corruption = 25% reduction)
- **Decay:** None

### Unrest

- **Increases:**
  - +0.01 per population per turn
  - +2 when friendly unit killed in combat
  - +3 when unit killed by enemy attack
  - +5 when settlement attacked
  - +10 when settlement destroyed
- **Effect:** At >75%, 5% chance per settlement to revolt (destroyed)
- **Decay:** -1 per turn

### Decadence

- **Increases:** +0.5 per turn (Empire era only)
- **Effect:** Reduces all production by (decadence/2)%
- **Decay:** None

### Overextension

- **Calculation:** Based on (controlled hexes) vs (settlements * 20)
- **Increases:** +0.1 per excess hex per turn
- **Decay:** -1 per turn when under limit
- **Effect:** Contributes to collapse

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
- **+20%** means multiply the current value by 1.2 (e.g., 50 → 60)
- **-30%** means multiply the current value by 0.7 (e.g., 50 → 35)

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

| Era       | Population | Controlled Hexes | Special |
|-----------|------------|------------------|---------|
| Barbarian | -          | -                | No decadence |
| Kingdom   | 50+        | 30+              | No decadence |
| Empire    | 200+       | 60+              | Decadence accumulates |

Era transitions are automatic when thresholds are met. Population is the sum of all settlement population values (see Settlement Tiers table).

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
   - All other settlements become danger points
   - Danger strength = floor(tier/2) + 1

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
9. **Society update:** Adjust corruption, unrest, decadence, overextension
10. **Era check:** Verify era transition thresholds
11. **Collapse check:** Check for civilization collapse
12. **Unit deselection:** Clear selected unit
13. **Society options shuffle:** Randomize available management actions for next turn
14. **Select largest settlement:** Auto-select the highest tier settlement (random if tied)
15. **Turn increment**

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

### Unit Selection

When multiple units occupy a hex, action buttons allow switching between them.
