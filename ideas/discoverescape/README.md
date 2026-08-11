# The Waking Isle

A discover-and-escape hex-and-counter game built on the Hex & Counters base. Land on a
fog-shrouded island, explore for relic tombs, and take what you find — but every relic
you take wakes hunters, and the only way out is back the way you came, to the boat.

See [DYNAMICS.md](DYNAMICS.md) for the design (theme, drivers, mechanics, strategies)
and tuning knobs. Run by double-clicking `index.html` — no build step.

## UI

- The map is scrolled by left-click drag; a press that doesn't move is a click (select/move),
  a drag pans. Right-click must not pull up the context menu
- Space or Enter ends the turn
- Click your counter (P, gold) to select it, showing BFS-reachable hexes highlighted in
  yellow — the fog is a wall: only explored hexes are reachable
- Click a highlighted hex to move there; click the counter again or a non-highlighted hex
  to deselect
- Unexplored hexes render as dark fog; the hover readout calls them "Unexplored".
  Distant hexes in line of sight (up to 8, blocked by hills/forest/mountain) render
  faded — terrain shape only, no markers, hover says "(distant)" — and stay faded
  until you walk close enough to reveal them properly
- The boat is a cyan-ringed ⛵, relic tombs are gold-ringed ✦ (once seen), standing
  stones are ▲, hunters are red H counters — the brighter the red, the faster the hunter
- HUD shows the turn (and night countdown), a relic meter, and the hunter count

## Verify

`node test/sim.js` runs a headless greedy bot through whole games (no DOM) and checks
rule invariants; `node test/sim.js <seed>` replays one game verbosely.
