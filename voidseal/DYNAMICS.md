# Waowisha — Game Dynamics

This document is the authoritative reference for all game mechanics and numeric values.

## Setting

The Membrane between dimensions has ruptured. Void Rifts tear open at the edges of the world, pouring out creatures of anti-reality — the Hollowed. The terrain itself is consumed, transformed into Void. An alliance of sorcerers and rogue technologists, the **Warband of the Last Coherence**, must seal every rift before the world unravels.

## Turn Structure

Each game turn proceeds through three phases in order:

### 1. Player Phase
- All units have their `moved` flag reset
- Player units heal (see Healing)
- The player may select and act with each unit once (move, attack, or seal a rift)
- Clicking "End Turn" (or pressing Space/Enter) advances to the next phase
- Pressing Escape deselects the current unit

### 2. Enemy Phase
- Each enemy unit acts in sequence:
  - Find the nearest player unit (by hex distance)
  - If adjacent (distance 1): attack that player unit
  - Otherwise: move toward the nearest player unit using BFS pathfinding
- Enemies can move onto any terrain, including Void (using the same 1-step minimum rule as players)
- If all player units are destroyed during this phase, the game ends in defeat

### 3. Void Phase (The Unraveling)
- **Corruption spread**: Each existing Void hex rolls per adjacent non-water, non-void hex to convert it. Chance depends on the target terrain (see The Unraveling)
- **Rift spawning**: Each active Void Rift decrements its spawn countdown. When it reaches 0, a new enemy spawns on an adjacent passable hex. The countdown resets based on rift strength
- **Rift hexes** become Void if not already (original terrain is preserved for movement cost calculation)
- **Void damage**: All units (player and enemy) standing on Void hexes take 1 damage
- **Center check**: If the center hex (0,0) becomes Void, the game ends in defeat

After the Void phase, the turn counter increments and a new Player Phase begins.

## Map

- Hex grid using axial coordinates (q, r), pointy-top orientation
- Map radius: 8 (roughly 217 hexes)
- Generated via diamond-square heightmap algorithm
- Camera pans by click-dragging

### Terrain Types

| Terrain  | Movement Cost | Defense Bonus | Notes |
|----------|:---:|:---:|---|
| Plains   | 1 | 0 | Default passable terrain |
| Hills    | 2 | +1 | Resists void spread |
| Mountain | Impassable* | +2 | Strongly resists void spread |
| Water    | Impassable* | 0 | Map border and interior lakes; void cannot spread across water |
| Void     | 2x original | 0 | Costs 2x the underlying terrain's movement cost; damages units 1 HP/turn |

**Void movement examples**: voided plains = 2, voided hills = 4, voided mountains = 2 (impassable falls back to cost 2).

*All units can always move exactly 1 hex regardless of terrain cost. A unit can step onto a mountain, water, or deep void, but cannot move further that turn.

### Resources

Resources (forests, quarries, gold deposits) are placed on the map by the terrain generator. Standing on a resource hex provides +1 healing per turn.

## Units

### Player Units — The Warband of the Last Coherence

| Unit | Symbol | ATK | DEF | HP | SPD | Role |
|------|:---:|:---:|:---:|:---:|:---:|------|
| Hexblade | ⚔ | 5 | 3 | 8 | 2 | Melee striker — crystallized-algorithm sword |
| Glitch Mage | ✧ | 4 | 1 | 5 | 2 | Glass cannon — exploits bugs in reality |
| Spore Marine | ⛨ | 3 | 4 | 10 | 2 | Tank and healer — power-armored, bonded with sentient fungus |
| Phase Monk | ◇ | 3 | 2 | 6 | 4 | Scout — exists partially in multiple dimensions |

All four units are placed near the map center at game start.

### Enemy Units — The Hollowed

| Unit | Symbol | ATK | DEF | HP | SPD | Spawn Weight |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Void Thrall | ▲ | 3 | 1 | 4 | 2 | 5 (common) |
| Reality Eater | ◈ | 5 | 2 | 7 | 1 | 2 (uncommon) |
| Hollow Knight | ♛ | 4 | 3 | 6 | 2 | 1 (rare) |

One enemy spawns adjacent to each Void Rift at game start. Additional enemies spawn from rifts on a countdown timer during the Void phase.

### Unit Display

- Player units: blue circle with symbol, solid border when ready, dashed when moved
- Enemy units: red circle with symbol
- HP bar below each unit (green > 50%, yellow > 25%, red below)

## Combat

### Attack Resolution

Attacks are one-directional — only the attacker deals damage. There is no counter-attack.

```
damage = max(1, attacker.ATK - defender.DEF - terrain_defense_bonus)
```

- Minimum damage is always 1
- Terrain defense bonus comes from the *defender's* hex
- If the defender's HP drops to 0 or below, the defender is destroyed and the attacker moves onto the defender's hex

### Attack Mechanics

- **Player attacking**: Click a selected unit, then click a red-highlighted enemy hex. The attack consumes the unit's action for the turn
- **Enemy attacking**: Enemies attack adjacent player units automatically during the Enemy Phase
- **No counter-attack**: Only the initiating unit deals damage

### Sealing Rifts

- Moving a player unit onto a Void Rift hex seals it immediately
- Killing an enemy standing on a rift hex, then occupying it, also seals it
- Sealing a rift removes it permanently (no more spawns, stops being a corruption source)
- Sealed rift hexes remain Void terrain

## Void Rifts

Rifts are the primary threat and objective. They are generated at the map edges by the terrain system's danger-point placement (3–6 rifts, distributed around the map periphery).

### Rift Properties

- **Strength**: 1–4 (assigned by terrain generator, total strength across all rifts sums to 10)
- **Spawn countdown**: Decrements each turn during the Void phase. When it hits 0, a new enemy spawns adjacent to the rift and the countdown resets

### Spawn Rate by Rift Strength

| Strength | Turns Between Spawns |
|:---:|:---:|
| 1 | 5 |
| 2 | 4 |
| 3 | 3 |
| 4 | 3 |

Initial countdown is randomized (1 to max spawn time) so rifts don't all spawn simultaneously.

## The Unraveling

The Unraveling is the existential threat — the world itself being consumed.

- **Source**: Void Rifts. Each rift hex becomes Void, and corruption spreads outward from all Void hexes
- **Spread rate**: Terrain-dependent, averaging ~33% per adjacent hex per turn:
  - Plains: 45% (falls quickly)
  - Hills: 25% (resists)
  - Mountains: 12% (strongly resists)
- **Original terrain preserved**: When a hex becomes Void, its original terrain type is stored. This determines void movement cost (2x original) and creates uneven spread patterns
- **Effect on units**: 1 damage per turn to any unit (player or enemy) standing on Void
- **Water blocks spread**: Void does not spread across water hexes
- **Escalation**: As more hexes become Void, the frontier grows, accelerating spread — but hills and mountains create natural breakwaters
- **Sealing rifts does not reverse existing Void** — corrupted hexes stay corrupted. Sealing only stops new enemy spawns and removes one source of spread

## Interaction Flow

1. Click a friendly unit to select it
2. Yellow-highlighted hexes show valid movement destinations
3. Red-highlighted hexes show attackable enemies
4. Click yellow hex to move, red hex to attack
5. Click another friendly unmoved unit to switch selection
6. Click empty space or press Escape to deselect
7. Click any unit (including moved/enemy) to inspect its stats in the side panel

## Victory and Defeat

- **Victory**: Seal all Void Rifts. The number of rifts remaining is shown in the Objective panel
- **Defeat** (any of):
  - All player units are destroyed
  - The center hex (0,0) is consumed by the Void

## Healing

All healing occurs at the start of the Player Phase, capped at max HP. Sources stack:

| Source | Amount | Condition |
|--------|:---:|---|
| Passive regen | +1 | Unit is on any non-Void terrain |
| Resource hex | +1 | Unit is on a forest, quarry, or gold deposit |
| Rest | +1 | Unit did not move or attack last turn |
| Spore Marine aura | +1 | Adjacent to a friendly Spore Marine (not self) |

Maximum possible healing per turn: 4 HP (resting on a resource hex next to a Spore Marine).

## Strategic Considerations

- **Speed vs. Void**: The Unraveling accelerates over time. Delaying to fight enemies means more terrain lost. Plains fall fast; hills and mountains buy time
- **Phase Monk**: With 4 speed, the Phase Monk can push through voided plains (cost 2 each) to reach distant rifts, but is fragile
- **Hexblade**: Highest damage dealer — send it against tough enemies like Reality Eaters
- **Glitch Mage**: High attack but very low HP/DEF — keep it behind the Spore Marine
- **Spore Marine**: Keep near wounded allies for aura healing; double duty as a tank and support. Resting on a resource hex with aura gives allies 4 HP/turn
- **Resource hexes**: Provide +1 healing on top of passive regen — good fallback positions
- **1-step rule**: Any unit can always step onto any adjacent hex, even mountains or water. Use this to cross otherwise impassable terrain one hex at a time in emergencies
- **Rift priority**: Higher-strength rifts spawn enemies faster and should generally be sealed first
- **Void traversal**: Voided plains are cheaper to cross (cost 2) than voided hills (cost 4). Plan routes through corrupted flatlands rather than corrupted highlands
- **Void damage applies to enemies too**: Lure enemies onto Void hexes to soften them up before engaging
