# DIVE

A hex-and-counter prospecting game set in the Chroma Deep — a colorful alien ocean
rift. You operate out of Berth Station with a submarine of unlimited range and a
dive suit of very limited air. Pilot the sub anywhere; dive to gather materials;
sell and craft at the station; build the Deepwave Beacon to call the tender ship
home and win. There is no combat and no defeat — only predators to flee and hauls
to lose.

Built on the [Hex & Counters](../hexandcounter/) baseline (plain-script canvas
client with a server-portable engine). See [DYNAMICS.md](DYNAMICS.md) for the design
journal and rules — the *why* as well as the *what*.

## Running

No build step. Double-click `index.html`, or `npx serve .` if you prefer HTTP.

Verification (no browser needed):

```bash
node test/sim.js       # engine rules: generation, dive loop, predators, economy
node test/uismoke.js   # UI paths against a stubbed DOM/canvas
```

## UI

- Right-click drag scrolls the map. Right click never opens the context menu
- Click your counter (S sub / D diver) to select it; BFS-reachable hexes highlight
  yellow; click one to move. Click the counter again or elsewhere to deselect
- Context buttons appear in the HUD as they apply: Dive, Board, Gather, Scoop
  Cache, Market. Space/Enter triggers the highlighted one (never Dive; falls back
  to End Turn)
- O₂ shows in the HUD while diving and turns red when low. Hover a hex for its
  terrain, O₂ tax, and known contents
- Node dots are colored by material and sized by remaining yield; ◆ marks a dropped
  bag or wreck; eels are visible only inside sight range, leviathans always
- All units render as counter-like pieces with the baseline's depth-shadow style
