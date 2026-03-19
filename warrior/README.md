The purpose of this project is to define a game to form a basis for future hex-and-counter games, like the old board wargames.

I've pulled in resources from some other different projects, but they contain some artifacts of the other games, like danger points, that we want to clean up so we don't influence new games.

See [DYNAMICS.md](DYNAMICS.md) for game mechanics.

## UI

- The map is scrolled by right-click drag. The right click must not pull up the context menu
- Space or Enter ends the turn
- Click a friendly counter to select it, showing BFS-reachable hexes highlighted in yellow
- Click a highlighted hex to move there
- Click the selected counter again or click a non-highlighted hex to deselect
- All units are rendered as counter-like pieces with a rounded square and 2px gray lines under and to the right to give a sense of depth
- Player counter is gold; enemy counters use a randomly generated ColorTheory palette
