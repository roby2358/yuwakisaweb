# Founders' Road

A frontier-building hex-and-counter game, extended from the Hex & Counters
movement base. Lead a crew of workers into a big procedurally generated
wilderness: harvest terrain with sawmills, stoneworks, and mines; lace the map
with roads (the wilderness is slow — roads are how the map shrinks); recruit at
Halls; guard your works with watchtowers against wandering beasts — and win by
raising the three-stage Monument (▲) on the far side of the map, which must
first be connected to every Hall you've founded by an unbroken supply line of
roads and buildings.

Double-click `index.html` to play (plain script globals, no build step).

See [DYNAMICS.md](DYNAMICS.md) for the full design — theme, drivers, mechanics,
and strategies.

## UI

- Left-click-drag pans the big map; a press that doesn't move is a click.
  Right-click never opens the context menu
- Click a worker counter to select it: BFS-reachable hexes highlight yellow,
  shooable adjacent beasts highlight red
- Click a yellow hex to move, a red beast to shoo it (2 MP)
- The build panel (below the HUD) lists what the selected worker can construct
  on its current hex, with costs; grayed out when unaffordable
- Recruit (top bar) adds a worker at the newest Hall; cost rises with crew size
- Tab cycles workers with MP remaining; Space/Enter ends the turn
- All units are counter-like pieces: square counters for the crew (numbered) and
  buildings (lettered), round counters for beasts. Worker and beast colors come
  from per-game ColorTheory palettes; terrain shades by elevation
- Watchtower coverage is outlined in white: the boundary of the beast-free
  zone, drawn around the outside of overlapping tower zones
- The orange HUD meter tracks Monument progress, including the stockpiled
  fraction of the next stage

## Verifying

`node test/sim.js [seed ...]` runs the DOM-free engine headless: an A*-driven
bot plays whole games while invariants are asserted every turn (non-negative
stockpile, no stacked workers, beast cap, legal building terrain, map stays
traversable). All default seeds should win in ~50-70 turns.
