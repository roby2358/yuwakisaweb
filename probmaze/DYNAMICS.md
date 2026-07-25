# Probability Maze — DYNAMICS

## Theme

**Reading the odds.** Every path is visible from the first second — the maze is not
hidden, it's *unreliable*. The die decides which edges exist this turn. The feeling is
picking your way across a river on stepping stones that only sometimes surface: you
plan the whole crossing up front, then negotiate with luck one step at a time.

## Key Drivers

1. **Variable Reinforcement on a Competence Backbone** — the die is pure luck, but the
   *route* is pure decision. Red edges resolve in ~1.5 rolls, green in 2, blue in 3.
   Choosing which region of the graph to travel through is the game.
2. **Readable Consequences** — the entire graph, every edge color, and the full die
   face list are on screen at all times. When a run goes long, the player can point at
   the exact blue edge that ate four rolls.
3. **Near-Miss Architecture** — par (expected rolls along the cheapest route:
   Dijkstra with red 1.5 / green 2 / blue 3 per edge) and best-this-maze sit next to
   the roll counter. Par is *beatable* — good routing plus average luck lands near it,
   good luck beats it. "Par 19, took 23, best 20" is the one-more-try hook.

## Key Mechanics

- **Colored Delaunay graph** — random points, Delaunay edges, each edge uniformly
  red / green / blue. Terrain as language: a red-dense corridor *reads* as a highway,
  a blue bottleneck reads as a gamble. *(Driver: readable consequences)*
- **Weighted paired die** — six faces: R, R+B, R+G, R+G, G, B. A frequency spectrum:
  red usable 4/6 turns, green 3/6, blue 2/6. A paired face lets you cross an edge of
  either color — and every paired face includes red. Half the faces are single-color:
  narrow rolls where you take what you're given, including a pure-blue face that's a
  1-in-6 grenade. *(Driver: variable reinforcement)*
- **Dead rolls cost the turn** — no matching edge at your node, the roll still counts.
  Camping in a green/blue pocket has a real price. *(Driver: near-miss)*
- **Lakes** — three unmarked void regions carved from the point field; routes must
  wind around them while the graph stays locally dense. The lakes are invisible:
  the player reads them as gaps in the web, terrain implied rather than drawn.
  *(Principle: terrain as language; driver: readable consequences)*
- **Variable density** — each node claims a random-size exclusion circle (x1-x3
  of the base spacing), so the map grows dense webs in some places and sparse
  straits in others. Webs are safe hubs with color choice; straits are corridor
  gambles. *(Driver: variable reinforcement; principle: terrain as language)*

  Why lakes and not coloring: the die caps the cost spread at 2x (blue 3 vs red
  1.5), so no coloring scheme can bend the optimal route — measured flat 1.03
  twist across uniform, axis-bias, and hidden-vein colorings (test/twistlab.js).
  Deleting edges twists routes (sinuosity 1.46) but collapses the naive-vs-smart
  routing gap to ~1.0 — one path, pure dice. Lakes get sinuosity ~1.28 while
  keeping the gap at ~1.1-1.2: twisty AND choiceful.
- **Thinned web (dormant)** — EDGE_KEEP can drop loop-making extras beyond a
  random spanning tree; playtest verdict at 0.5 was "too weird," so it sits at
  1.0 (full pruned web). Lesson kept for posterity: the fraction must apply to
  the extras, NOT the total — a pruned planar web holds ~2n edges, so keeping
  half the total leaves ~n-1, exactly a spanning tree ("the maze turned into a
  tree"). *(Driver when active: scarcity of agency)*
- **The blue road** — the shortest-hop path from start to exit is painted solid
  blue after coloring. The "favor": the best route is traceable at a glance — and
  it's a toll road in the rarest color. On the thinned web some of it is usually
  unavoidable, so the real game is choosing which stretches to pay for and which
  to detour around. Par is computed after the repaint, so it prices the taunt
  honestly. *(Drivers: comedy, readable consequences, near-miss)*
- **Forced marches** — a usable roll MUST be spent, even when every lit edge points
  backward. The dice can push you off your route, and standing on the wrong node is
  a liability, not a shelter. (This knowingly bends "never let a unit feel stuck" —
  there is always *a* move; it just might hurt. That sting is the game.)
  *(Driver: scarcity of agency, near-miss)*
- **Fewest rolls, per-maze best** — Retry replays the same maze; New Maze rerolls
  everything and resets best. *(Driver: near-miss)*
- **Expected-rolls par** — par is the minimum expected roll count over fixed routes,
  not the hop count. The number embodies the red-artery insight without revealing
  the route: beating par means you found (or bettered) the cheap path *and* rolled
  well. *(Driver: near-miss, variable reinforcement)*

## Strategies

- **Red arteries** — a longer path through red-dense edges beats a shorter mixed one
  (expected rolls: red 1.5/edge vs blue 3/edge). The core skill is seeing this.
- **The blue gamble** — a blue edge that saves 3+ hops is worth the expected 3-roll
  wait; one that saves 1 hop is a trap. R+B is the windfall roll; a bare B at the
  wrong node is the punishment.
- **Road running** — the blue road is the shortest way and the map shows it. Ride
  it opportunistically when B or R+B comes up, bail to red/green side paths when
  it stalls. Knowing which road segments have no detour (pay up) and which do
  (never pay) is the maze's core read.
- **Hub camping** — high-degree nodes with all three colors on offer almost never
  waste a roll; low-degree single-color nodes are where dead rolls live.
- **Shore hugging** — lake shores are forced corridors: fewer alternative edges,
  so a blue shore edge is a real toll booth. Reading which shore of a lake is
  red-friendly before committing to a side is the new macro decision.
- **Exposure management** — since you must move when you can, a node's *bad* edges
  matter as much as its good ones. A hub whose red edges all point backward is a
  trap dressed as a haven; a two-edge strait where both edges point forward is
  safer than it looks. Reading a node means reading where its colors can throw you.

**Anti-strategy check:** there is no fail state, so nothing to degenerate into — the
only pressure is the roll counter vs. par and best. Acceptable for a puzzle-toy.

## Deferred

- Expected-cost *overlay* (highlight the cheapest route on the board) — par now uses
  this math invisibly; drawing the route itself stays deferred because discovering
  the red-artery insight unaided is the fun.
- Roll budget mode (fixed rolls, win/lose) if the toy wants stakes later.
- **Force-field maps** (next big direction, 2026-07-25): the map as a field of
  probabilistic swirls and eddies that push you along — currents composing with
  forced marches, so the map itself has agency. Likely not purely random
  generation: a coherent noise field (curl noise) could assign edge colors or
  directional traversal bias by alignment with the local flow vector — swirls,
  conveyor corridors, dead-water pockets; structured but still procedural.
  Mechanically spiciest form: direction-dependent edge costs (cheap with the
  current, dear against it), turning the maze into a river system read like
  weather.
- Par's math assumes you can hold position on a bad roll — forced marches broke
  that assumption, so real play runs ~1.2x par (cost-aware bot: 30 rolls vs
  par 25 with the blue road priced in). Par is a stretch goal.
  Recalibrate after playtest if chasing it stings instead of tempts.
