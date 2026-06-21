# Healer

The theme of this game is that you are the healer for a team of adventurers. Your job is to keep them alive as they explore the map. If we can include a map of connected underground rooms (like a cave complex or dungeon) that's OK, but for v1 an overland adventure is fine too.
The party AI will be pretty simple. There will be stereotypical classes and personalities. A team leader the others (mostly) follow. The leader (mostly) stays close to the healer (the player).
The healer has an almost baroque list of skills that tier by ability, with complicated interactions between turns for a silly level of management.
The enemy AI will be pretty simple, but the enemy list should be really, really large. They should group into classes with tiered members.
The objective for the party is the usual. Treature, magic items.
An important objective for the healer (the player) is reputation.

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
