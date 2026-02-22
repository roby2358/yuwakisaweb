# Realm - Technical Specification

A browser-based realm management simulation game spanning the cycle from barbarian tribes to kingdom to empire and eventual collapse back to barbarians.

## Purpose

Realm is a strategic management game where players guide a civilization through growth phases—expanding through autonomous settlement spawning, raising armies, and defending against threats—while managing the inevitable decline and rebirth of their realm.

## UI Layout

```
+---------------------------------------------------------------+
|  [Resource Bar: Gold | Food | Population | Building Material] |
+---------------------------------------------------------------+
|                                                               |
|  +---------------------------------------------+  +---------+ |
|  |                                             |  |         | |
|  |                                             |  | Info    | |
|  |              Hex Grid Map                   |  | Panel   | |
|  |                                             |  |         | |
|  |                                             |  +---------+ |
|  |                                             |  +---------+ |
|  |                                             |  |         | |
|  |                                             |  | Actions | |
|  |                                             |  | Panel   | |
|  +---------------------------------------------+  +---------+ |
|                                                               |
|  [Status Bar: Turn | Era | Notifications]                     |
+---------------------------------------------------------------+
```

## Functional Requirements

### Game Mode

- The game MUST be single-player
- The game MUST be turn-based
- Each turn MUST process: player actions, enemy spawning, enemy movement, combat resolution, resource production

### Map and Grid

- The application MUST render a hex grid map sized to fit within the browser viewport
- The application MUST support click selection of hexes
- The application MUST support click-and-drop movement of units between hexes
- The application MUST display four terrain types:
  - Plains (elevation 0-40%): Movement cost 1, no combat modifier
  - Hills (elevation 40-70%): Movement cost 2, +1 defense bonus
  - Mountain (elevation 70-100%): Impassable
  - Water (lowest elevations, separate from land): Impassable
- Terrain MUST be generated using a fractal plasma algorithm based on elevation
- The map MUST contain resource cells that provide bonus production when controlled:
  - Forest: +1 building material per turn
  - Quarry: +2 building materials per turn
  - Gold Deposit: +2 gold per turn
- Resource cells MUST be visually distinguishable from regular terrain
- Resource cells SHOULD be distributed randomly across valid terrain during map generation
- The application MAY support zooming and panning on larger maps

### Resources

- The game MUST track four resource types:
  - Gold
  - Food
  - Population
  - Building Material
- Resources MUST be displayed in the resource bar
- Resources MUST be consumed when producing units or upgrading settlements

### Settlements

- The application MUST support three settlement tiers with the following production:
  - Settlement: +1 gold, +2 food, +1 materials per turn
  - Town: +10 gold, +5 food, +3 materials per turn
  - City: +100 gold, +10 food, +6 materials per turn
- Upgrade costs:
  - Settlement → Town: 50 gold, 80 materials
  - Town → City: 150 gold, 200 materials
- Settlements MUST be represented as counters on the hex grid

#### Population Spread and Organic Growth

- Each settlement MUST project population influence using Gaussian falloff based on distance
- Influence radius and strength MUST scale with settlement tier:
  - Settlement: Influence 1, radius 2 hexes
  - Town: Influence 3, radius 4 hexes
  - City: Influence 10, radius 6 hexes
- Population influence at any hex is the sum of all overlapping settlement influences
- New settlements MAY spontaneously appear on hexes where population influence exceeds a spawn threshold

#### Growth Drivers and Caps

- Settlement growth MUST be both driven and capped by nearby population:
  - **Driver**: Population overflow from larger settlements provides growth fuel
  - **Cap**: Proximity to larger settlements suppresses maximum size (dominance shadow)
- Each settlement projects a dominance shadow that limits nearby settlements:
  - A settlement within a city's shadow MUST NOT grow beyond Town tier
  - A settlement within a town's shadow MUST NOT grow beyond Settlement tier
  - Dominance shadow radius equals the dominant settlement's influence radius
- Settlements outside all dominance shadows MAY grow to any tier if they receive sufficient overflow
- This creates natural urban hierarchy:
  - Near a city: receives abundant overflow but capped as satellite town
  - Mid-distance: moderate overflow, can grow to town
  - Distant frontier: little overflow initially, but no cap—can eventually become a new city

#### Population Overflow and Migration

- When a settlement reaches its tier cap (due to dominance shadow or max tier), excess growth MUST overflow
- Overflow propagates outward, prioritizing settlements with the most growth capacity
- Distant settlements receive overflow later but have higher growth ceilings
- This creates expansion waves: core fills → satellites fill → overflow reaches frontier → new regional centers emerge far from the original core
- The player MAY manually place settlements at a cost of 20 gold, 30 materials on any controlled hex with sufficient influence

### Military Units

- Settlements MUST be able to produce military units
- Military units MUST be movable between hexes via click-and-drop
- Military units MUST be represented as counters on the hex grid
- The application MUST support three unit types with the following stats:
  - Infantry: Attack 2, Defense 2, Speed 2, Cost 10 gold + 5 materials
  - Heavy Infantry: Attack 3, Defense 4, Speed 1, Cost 20 gold + 15 materials
  - Cavalry: Attack 4, Defense 1, Speed 3, Cost 30 gold + 10 materials
- Speed indicates maximum hexes moved per turn
- Units MUST be able to engage enemies in combat
- Combat MUST apply terrain defense bonuses to the defending unit

### Danger Points

- The map MUST contain danger points that spawn enemies periodically
- Danger points MUST be visually distinguishable on the map
- Danger points MUST be eliminable through military action
- Danger points MUST be occupiable with military installations:
  - Outpost: Cost 15 gold, 20 materials. Defense bonus +1
  - Fort: Cost 40 gold, 60 materials. Defense bonus +2
  - Garrison: Cost 100 gold, 150 materials. Defense bonus +3
- Occupied danger points MUST cease spawning enemies
- Military installations MUST provide defense bonuses to units stationed there

### Era Progression

- The game MUST track civilization progression through eras:
  - Barbarian: Starting era
  - Kingdom: Requires 50 population and 10 controlled hexes
  - Empire: Requires 200 population and 30 controlled hexes
- The game MUST track four societal parameters (each ranging 0-100):
  - Corruption: Increases with gold income and number of settlements. Reduces gold production by its percentage
  - Unrest: Increases with population size and military losses. Above 75, settlements may revolt and become neutral
  - Decadence: Increases each turn during Empire era. Reduces all production efficiency by half its percentage
  - Overextension: Increases with territory beyond sustainable limits. Increases unit maintenance costs
- Collapse MUST occur when any two societal parameters reach 100 simultaneously
- Upon collapse, the civilization resets to Barbarian era with a single settlement

### Enemy Behavior

- Enemies MUST spawn from active danger points at regular intervals
- Enemies MUST move toward player settlements
- Enemies MUST engage player units and settlements in combat
- The application SHOULD implement basic AI pathfinding for enemy movement

### Combat Reporting

- After end-of-turn processing, the application MUST display attack markers on every hex where an enemy attack occurred during that turn
- Attack markers MUST be spiky, irregular "bang" shapes rendered in yellow
- If the attack resulted in a friendly unit being killed, the marker MUST be rendered in red instead of yellow
- The application MUST pre-generate 5 distinct bang shape variants and select randomly among them for each marker
- While attack markers are displayed:
  - The "End Turn" button MUST change its label to "Continue"
  - Player interaction with the game MUST be suspended (no hex selection, unit movement, or other actions)
- The markers MUST be cleared and normal play MUST resume when the player clicks anywhere on the screen or presses any key
- If no enemy attacks occurred during the turn, the application MUST NOT pause for marker display and play MUST continue normally

## Non-Functional Requirements

### Technology

- The application MUST run in modern web browsers
- The application MUST be implemented using JavaScript, CSS, and dynamic HTML
- The application MUST NOT require server-side processing for gameplay

### Styling

- The UI MUST clearly distinguish between different counter types
- Selected hexes and units MUST have clear visual indication
- The application SHOULD use consistent visual theming across all eras

### Performance

- The application SHOULD maintain smooth performance with the intended map size
- Click-and-drop interactions MUST feel responsive

### Code Quality

- The application SHOULD separate game logic from rendering
- The application SHOULD use modular code organization

## Dependencies

**Libraries:**
- To be determined based on implementation approach

## Implementation Notes

### Hex Grid

Hex grids require specialized coordinate systems. Common approaches include offset coordinates, cube coordinates, or axial coordinates. The choice affects pathfinding and neighbor calculations.

### Click and Drop

Click-and-drop uses a two-step interaction: click to select a unit, then click a destination hex to move. This approach is more accessible than drag-and-drop and works well on touch devices. Visual feedback should highlight valid move destinations after selection.

### Turn Processing

Each turn processes in sequence: player actions, enemy spawning, enemy movement, combat resolution, resource production. Clear phase separation simplifies debugging and allows for undo functionality.

### Terrain Generation

The map uses a fractal plasma (diamond-square) algorithm to generate elevation values. Elevation is normalized to 0-100%, then mapped to terrain types: water fills the lowest connected regions, plains cover 0-40% elevation, hills cover 40-70%, and mountains cover 70-100%. This produces natural-looking landmasses with logical terrain distribution.

### Combat Resolution

Combat compares attacker's attack value against defender's defense value plus terrain bonuses. A simple formula: damage = attacker's attack - (defender's defense + terrain bonus), minimum 0. Units have health pools; when health reaches 0, the unit is destroyed.

### Population Spread Calculation

Population influence uses Gaussian falloff: `influence = base_influence * e^(-distance² / (2 * sigma²))` where sigma is proportional to the settlement's radius. At each hex, sum the contributions from all settlements. For spontaneous settlement spawning, check each turn if any unoccupied hex exceeds the influence threshold; if multiple candidates exist, select randomly weighted by influence strength.

### Dominance Shadow

To calculate a settlement's tier cap: find all larger settlements within their influence radius. The largest nearby settlement's tier determines the cap (city caps at town, town caps at settlement). If no larger settlement is in range, the settlement has no cap. This creates natural spacing—new cities can only emerge far from existing ones.

### Population Overflow

Each settlement accumulates growth points from food surplus. When a settlement hits its tier cap (from dominance shadow or being a city), growth points overflow to the nearest settlement with available capacity, preferring those with higher caps. Overflow propagates outward in waves, eventually reaching frontier settlements that have no dominance shadow—these can grow into new regional centers.

## Error Handling

The application MUST handle these conditions:
- Invalid move attempts (occupied hexes, out of range)
- Insufficient resources for building/production
- Click-and-drop selection state management

## Future Considerations

- Save/load game state to browser local storage
- Multiple difficulty levels affecting enemy spawn rates and societal parameter growth
- Additional unit types in later eras (archers, siege weapons)
- Trade routes between settlements
- Diplomacy with neutral settlements