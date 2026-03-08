# Void Seal — Game Dynamics

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
- **Rift spawning**: Each active rift has a random chance per turn to spawn an enemy on an adjacent hex. The chance scales with the number of rifts already sealed (see Void Rifts)
- **Rift hexes** become Void if not already (original terrain is preserved for movement cost calculation)
- **Void damage**: Player units standing on Void hexes take 1 damage per turn (exception: Glitch Mage is immune). Enemy units take 1 damage per turn on *non-Void* hexes — they are creatures of the void and are harmed by reality
- **Center check**: If the center hex (0,0) becomes Void, the game ends in defeat

After the Void phase, the turn counter increments and a new Player Phase begins.

## Map

- Hex grid using axial coordinates (q, r), pointy-top orientation
- Map radius: 16 (large hex grid)
- Generated via diamond-square heightmap algorithm
- Camera pans by left-click or right-click dragging

### The Seal Spire

The center hex (0,0) features the **Seal Spire** — a white tower with a pulsing beacon. It is the strategic anchor of the map:

- All hexes within 2 hexes of the Spire are cleared to plains or forest terrain at map generation
- Player units within 2 hexes of the Spire gain +1 regen per turn
- If the center hex is consumed by Void, the game is lost
- All player units start at or adjacent to the Spire (Phase Monk on the tower, others surrounding it)

### Terrain Types

| Terrain  | Movement Cost | Defense Bonus | Notes |
|----------|:---:|:---:|---|
| Plains   | 1 | 0 | Default passable terrain |
| Forest   | 1 | 0 | Plains variant; grants +1 healing |
| Hills    | 2 | +1 | Resists void spread |
| Gold     | 2 | +1 | Hills variant; grants +1 healing |
| Mountain | Impassable* | +2 | Strongly resists void spread |
| Water    | Impassable* | 0 | Map border and interior lakes; void cannot spread across water |
| Void     | 2x original | 0 | Costs 2x the underlying terrain's movement cost |

**Void movement examples**: voided plains = 2, voided hills = 4, voided mountains = 2 (impassable falls back to cost 2).

*All units can always move exactly 1 hex regardless of terrain cost. A unit can step onto a mountain, water, or deep void, but cannot move further that turn.

## Units

### Player Units — The Warband of the Last Coherence

| Unit | Symbol | ATK | DEF | HP | SPD | Special |
|------|:---:|:---:|:---:|:---:|:---:|------|
| Hexblade | ⚔ | 5 | 3 | 9 | 2 | Advances onto enemy hex after a kill |
| Glitch Mage | ✧ | 4 | 1 | 6 | 3 | Immune to void damage. Does not advance on kill |
| Spore Marine | ⛨ | 3 | 4 | 11 | 2 | Heals self and adjacent allies +1 HP per turn |
| Phase Monk | ◇ | 3 | 2 | 7 | 4 | Fastest unit — can cross voided terrain quickly |

All four units start at the Seal Spire: Phase Monk on the tower (0,0), the other three on adjacent hexes.

**Reinforcements**: Each turn there is a 10% chance a random player unit spawns on the tower (if the hex is unoccupied).

### Enemy Units — The Hollowed

| Unit | Symbol | ATK | DEF | HP | SPD | Spawn Weight |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Void Thrall | ▲ | 3 | 1 | 4 | 2 | 5 (common) |
| Reality Eater | ◈ | 5 | 2 | 5 | 1 | 2 (uncommon) |
| Hollow Knight | ♛ | 4 | 3 | 6 | 1 | 1 (rare) |

All enemies take 1 damage per turn when standing on non-Void terrain (reality damages them). They are safe on Void hexes.

One enemy spawns adjacent to each Void Rift at game start. Additional enemies spawn from rifts during the Void phase.

### Unit Display

- Player units: blue circle with symbol, solid border when ready, dashed when moved
- Enemy units: red circle with symbol
- HP bar below each unit (green > 50%, yellow > 25%, red below)
- Clicking any unit shows an info panel (lower-right of canvas) with name, description, special ability, and stats

## Combat

### Attack Resolution

Attacks are one-directional — only the attacker deals damage. There is no counter-attack.

```
damage = max(1, attacker.ATK - defender.DEF - terrain_defense_bonus)
```

- Minimum damage is always 1
- Terrain defense bonus comes from the *defender's* hex
- If the defender's HP drops to 0 or below, the defender is destroyed and the attacker moves onto the defender's hex (exception: Glitch Mage stays put)

### Attack Mechanics

- **Player attacking**: Click a selected unit, then click a red-highlighted enemy hex. The attack consumes the unit's action for the turn
- **Enemy attacking**: Enemies attack adjacent player units automatically during the Enemy Phase
- **No counter-attack**: Only the initiating unit deals damage

### Sealing Rifts

- Moving a player unit onto a Void Rift hex seals it immediately
- Killing an enemy standing on a rift hex, then occupying it, also seals it (does not apply to Glitch Mage, who does not advance on kill)
- Sealing a rift removes it permanently (no more spawns, stops being a corruption source)
- Sealed rift hexes remain Void terrain

## Void Rifts

Rifts are the primary threat and objective. 6 rifts are generated at the map edges, distributed around the map periphery.

### Rift Properties

- All rifts are equal — there is no strength system
- Each rift has a random chance per turn to spawn an enemy on an adjacent hex (including void hexes)
- Spawn chance scales based on how many rifts have been sealed:

```
spawnChance = 10% + (sealed / (initial - 1)) * 20%
```

| Rifts Sealed | Spawn Chance per Rift per Turn |
|:---:|:---:|
| None | 10% |
| Half | ~20% |
| All but one | 30% |

This creates escalating pressure — each rift you seal makes the remaining rifts spawn faster.

## The Unraveling

The Unraveling is the existential threat — the world itself being consumed.

- **Source**: Void Rifts. Each rift hex becomes Void, and corruption spreads outward from all Void hexes
- **Spread rate**: Terrain-dependent:
  - Plains / Forest: 11%
  - Hills / Gold: 6%
  - Mountains: 3%
- **Original terrain preserved**: When a hex becomes Void, its original terrain type is stored. This determines void movement cost (2x original) and creates uneven spread patterns
- **Effect on player units**: 1 damage per turn standing on Void (Glitch Mage is immune)
- **Effect on enemy units**: 1 damage per turn standing on *non-Void* terrain (they are creatures of the void)
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
7. Click any unit (including moved/enemy) to inspect its stats in the info panel (lower-right overlay on canvas)
8. Left-click drag or right-click drag to pan the camera

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
| Healing terrain | +1 | Unit is on a forest or gold hex |
| Seal Spire proximity | +1 | Unit is within 2 hexes of the center tower |
| Rest | +1 | Unit did not move or attack last turn |
| Spore Marine aura | +1 | Adjacent to a friendly Spore Marine (not self) |

Maximum possible healing per turn: 5 HP (resting on a healing terrain hex within 2 of the Spire, next to a Spore Marine).

## Strategic Considerations

- **Speed vs. Void**: The Unraveling accelerates over time. Delaying to fight enemies means more terrain lost. Plains fall fast; hills and mountains buy time
- **Seal Spire**: The area around the Spire is a natural safe zone — healing terrain and proximity regen make it a strong fallback position
- **Escalating spawns**: Sealing rifts increases spawn rate at remaining rifts (10% → 30%). Plan to hit the last rifts quickly before they overwhelm you
- **Enemy vulnerability**: Enemies take damage on non-void terrain, so intercepting them early (before void reaches your position) means they arrive weakened
- **Phase Monk**: With 4 speed, the Phase Monk can push through voided plains (cost 2 each) to reach distant rifts, but is fragile
- **Hexblade**: Highest damage dealer — send it against tough enemies. Advances on kill, making it ideal for clearing a path to a rift
- **Glitch Mage**: High attack and void-immune with 3 speed, but very low HP/DEF. Does not advance on kill, so cannot seal rifts by combat alone — pair with another unit for rift assault
- **Spore Marine**: Keep near wounded allies for aura healing; double duty as a tank and support. Resting on a healing terrain hex with aura gives allies up to 5 HP/turn near the Spire
- **Healing terrain**: Forest and gold hexes provide +1 healing on top of passive regen — good fallback positions
- **1-step rule**: Any unit can always step onto any adjacent hex, even mountains or water. Use this to cross otherwise impassable terrain one hex at a time in emergencies
- **Void traversal**: Voided plains are cheaper to cross (cost 2) than voided hills (cost 4). Plan routes through corrupted flatlands rather than corrupted highlands
- **Lure enemies off void**: Enemies take damage on non-void terrain. Drawing them away from the void frontier weakens them before combat
