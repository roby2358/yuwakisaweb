# Game Dynamics

Why the movement puzzle works. Rules are specified in [ONTOLOGY.md](ONTOLOGY.md). Numbers
are named here, never quoted; their values are in ONTOLOGY's Numbers table.

## Drivers

1. **Route-finding under a budget.** Each turn you have `PLAYER_MP` to spend across as many
   moves as you like. Slow terrain (forest, hills, scrub, rough) costs more than plains, and
   water and mountains are impassable. The map is a crossing from the left edge to the
   right, and the question every turn is which ground to pay for.
2. **Routes go stale.** `ENEMY_DICE_COUNT`d`ENEMY_DICE_SIDES` enemies wander one random hex
   per turn. You can't enter their hexes, so the path you planned last turn may be shut
   this turn.

## Map

- A `MAP_COLS × MAP_ROWS` rectangle of pointy-top hexes, with edges always water.
- A diamond-square heightmap ranks every hex by elevation. The lowest band is water, then
  plains, hills, and mountains (cuts `WATER_PCT`, `HILLS_PCT`, `MOUNTAIN_PCT`). Forest and
  scrub are then scattered onto plains, and rough onto hills.
- The player starts in the leftmost slice of passable hexes and the target is in the
  rightmost. Every map has a path between them, falling back to `KNOWN_GOOD_SEED` if needed.

## Turn structure

1. **Player turn:** spend MP over one or more moves. The turn ends at 0 MP, or with End Turn.
2. **Enemy turn:** every enemy steps to one random free passable neighbor, or stays put.

## Victory and defeat

- You win by entering the target hex. An enemy may wander onto the target and block it
  until it moves on.
- There is no defeat and no combat.

## Anti-strategies

| Anti-strategy | Prevention |
|---|---|
| Walk through an enemy | Enemy hexes are impassable in reachability (R-8) |
| Wait for a clear straight line | Enemies keep moving, and turns only count up: the victory screen shows the turn count |
| Keep moving after winning | The engine refuses moves once won (R-21) |
