The purpose of this project is to define a game to form a basis for future hex-and-counter
games, like the old board wargames.

The current game is a **living world with no end**: villages grow farmland, prosperity
draws raiders from the wilds, and the player earns prestige defending what grows. Prestige
climbs a status ladder whose ranks grant privileges — and fades if not renewed. There is no
victory condition and no game over; the game is geared toward long-term improvement.

I've pulled in resources from some other different projects, but they contain some
artifacts of the other games that we want to clean up so we don't influence new games.

See [DYNAMICS.md](DYNAMICS.md) for the design (theme, drivers, mechanics, strategies).

## UI

- The map is scrolled by right-click drag. The right click must not pull up the context menu
- Space or Enter ends the turn
- Click a friendly counter to select it, showing BFS-reachable hexes highlighted in yellow
  and attackable raiders highlighted in red
- Click a yellow hex to move there; click a red hex to attack (costs MP)
- Click the selected counter again or click a non-highlighted hex to deselect
- The enemy phase plays back animated, hop by hop; click or Space fast-forwards it
- All units are rendered as counter-like pieces with a rounded square and 2px gray lines
  under and to the right to give a sense of depth
- Player counter is gold; raider counters use randomly generated ColorTheory colors, and a
  gold pip marks a raider carrying plunder
- The HUD shows turn, MP, HP, prestige, and status title; a message bar narrates events
- Hovering a village shows its name, farm count, and HP
