# Game Dynamics

## Map

- Rectangular hex grid (60 columns x 40 rows), pointy-top hexes
- Generated via diamond-square heightmap, then terrain assigned by elevation percentile
- Terrain distribution: 25% water, 50% plains, 10% forest, 10% hills, 1% gold, 2% quarry, 5% mountains
- Edge hexes are always water

## Terrain Movement Costs

| Terrain  | Cost      |
|----------|-----------|
| Plains   | 1         |
| Forest   | 2         |
| Hills    | 2         |
| Gold     | 2         |
| Quarry   | 2         |
| Water    | Impassable|
| Mountain | Impassable|

## Player

- Starts on the left side of the map
- 5 Movement Points (MP) per turn
- Can spend MP across multiple moves within a single turn
- Cannot move onto hexes occupied by enemies

## Enemies

- 2-12 enemies (2d6 roll) placed randomly on passable terrain at game start
- Each enemy moves 1 hex randomly per turn
- Enemies cannot move onto water, mountains, the player's hex, or other enemies

## Turn Structure

1. **Player turn** — player spends MP to move (one or more moves)
2. **Enemy turn** — all enemies move 1 hex randomly

## Victory

- Player wins by reaching the target hex on the right side of the map

## Defeat

- There is no defeat condition
