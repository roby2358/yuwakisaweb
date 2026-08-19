# Game Dynamics

## Map

- Square hex grid (60 columns x 60 rows), pointy-top hexes
- Generated via diamond-square heightmap, then terrain assigned by elevation percentile
- Terrain distribution: 25% water, 50% plains, 10% forest, 10% hills, 1% gold, 2% quarry, 5% mountains
- Edge hexes are always water
- After choosing the central city, a breadth-first flood fill sinks every disconnected passable island to water. All remaining land is reachable from home.

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

## Intended Experience

Gemrace is a tense expedition and return journey. Readable monster pursuit creates near misses; a changing sample of temporary rule effects creates competence-shaped variety; collecting three Sunstones creates escalating commitment because success still requires the dangerous trip home.

## Player

- Starts at a city near the center; all six surrounding hexes are guaranteed passable
- 6 Movement Points (MP) per turn
- Can spend MP across multiple moves within a single turn
- Cannot move onto hexes occupied by monsters

## Gems

- Exactly 3 Sunstones and 45 ordinary gems are distributed across passable terrain.
- Entering a gem hex collects it and immediately spawns an ordinary replacement elsewhere. Sunstones never respawn.
- The golden Sunstone is permanent objective progress. Collect 3 and return to the starting hex.
- The six other palettes are inventory consumables. Clicking one activates its rule and replaces any active effect.
- Each game assigns the six palettes a random sample from a pool of 12 effects, so the available rules vary by run.
- Effects last a displayed number of turns. Terrain-dependent relative spawn weights remain internal tuning data.

## Monsters

- 2-12 monsters (2d6 roll) placed randomly on passable terrain at game start
- Each monster moves 2 hexes per turn and pursues the player within a 6-hex aggro range.
- Outside aggro range monsters wander. Effects can freeze, misdirect, repel, or hide the player from them.
- Monsters cannot be killed. A monster entering the player's hex ends the game unless a Ward effect absorbs the collision.

## Turn Structure

1. **Player turn** — player spends MP to move (one or more moves)
2. **Monster turn** — all monsters move 2 hexes, pursuing or wandering according to aggro

## Victory

- Collect 3 Sunstones and return to the marked starting hex.

## Defeat

- A monster reaches the player without an active Ward.
