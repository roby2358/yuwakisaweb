# Thing Factory — Rationale

Why each current choice is what it is. Decisions are `D-n`, open questions are `Q-n`, and
neither is ever renumbered. Rules and constants are named as in ONTOLOGY.md. History is in
ARCHITECTURE_LOG.md.

---

## Shape of the game

### D-1 Place-then-tick: every command but turning a mover ticks the world once — *Decided*
- **Alternatives:** build-then-run (Incredible Machine: freeze, build, press GO); a
  per-turn parts budget with several placements per tick.
- **Why:** G-1. The contraption is running while you build it, so each placement is a
  repair or an extension of a live machine. It also reuses the base's turn engine.
- **Evidence:** R-9, R-11, R-29, R-34 (each of those commands runs exactly one tick); R-10
  (rotate runs none, D-19).

### D-2 Endless milestones (10, 20, 50, 100, 200, 500, 1000, …); no end, no time limit — *Decided*
- **Alternatives:** win at a fixed N crates; pick N at game start; deliver N before turn T;
  drown every gremlin.
- **Why:** the designer wanted the factory to keep going. The first milestone proves the
  line, and the later ones test whether it keeps working with gremlins wandering through,
  at scales where a small leak matters. The 1-2-5 series keeps milestones coming at a
  steady feel as the numbers grow. Leaving out a time limit and an end keeps the mood
  tinkery, not panicky; the score is the turn each milestone was reached.
- **Evidence:** R-16, R-30.

### D-13 Go/Pause runs the ticks for you — *Decided (Go), Proposed (gap, hold on pick)*
- **Alternatives:** Wait only; a fast-forward that skips animations.
- **Why:** with endless milestones, a working line needs hundreds of Waits. Go issues them,
  one animation after another, `RUN_GAP_MS` apart. It is pure client: every tick is still
  an ordinary `wait()`, so D-1 holds. Picking a card holds the run so you can aim and
  place without racing the clock; the placement ticks and the run resumes.
- **Evidence:** U-13 (manual); `uiboot.js` drives Go, the hold, and Pause.

### D-3 Four board sizes, picked at New Game: 16 × 10 (fits the screen), 20 × 20, 30 × 30, 60 × 60 (pan) — *Decided (sizes), Proposed (open on the source)*
- **Alternatives:** one small board that always fits (G-2: cause and effect never
  off-screen); the base's 60×40 with panning; a free-form width × height entry.
- **Why:** the designer asked for the choice. The small board keeps the whole contraption in
  view; the bigger ones trade that for longer lines, more terrain to route around, and a
  factory that sprawls. The sizes are rows of `MAP_SIZES`, so the engine has one generation
  path. A board too big for the window opens centered on the source, where building starts,
  and left-drag pans as it always has.
- **Evidence:** R-1, R-2, R-5, R-23 at every size; U-2, U-14 (manual).
  `Measured by: just cc-sim 200 <size>` → small 183/200 reach the first milestone, median 65
  turns (11.5 crates lost per game); medium 195/200, median 65 (5.0 lost); large 196/200,
  median 81 (2.4 lost); huge (50 games) 50/50, median 142 (1.6 lost). Gremlins stay at `GREMLIN_DICE_COUNT`d`GREMLIN_DICE_SIDES` on every size, so the big
  boards are much emptier of them (see Q-5).

### D-19 Turning a placed mover is free: it doesn't tick — *Decided*
- **Alternatives:** turning spends a turn like every other command (a stray click costs a
  tick); a separate key to turn so a click can't misfire.
- **Why:** the designer asked for it. Aiming a mover is fixing what you already built, not
  a new action, so it shouldn't cost a turn on the turn score. Nothing in the world moves
  while you turn, so you can try a facing, look, and turn again. Placing, removing and
  discarding still tick, so building and hand cycling keep their cost. The exploit it opens
  is narrow: you can re-aim freely between ticks, but each tick still runs the line as it
  stands, so timing a turn to catch one crate means ticking between turns.
- **Evidence:** R-10. `Measured by: just cc-sim 200 small` → identical to ticking turns
  (183/200, median 65): the bot lays belts already aimed, so this is a feel change for
  players, not a pacing change the bot can see.

### D-12 `D` removes a placed Thing; it ticks, and the card is spent — *Decided (remove), Proposed (tick, no refund)*
- **Alternatives:** no removal (permanence as the puzzle); undo of the last command;
  removal that returns the card to the hand; removal as a free action that doesn't tick.
- **Why:** the designer asked for it. A misplaced Wall or Bridge had no fix at all, and a
  stray Belt could only be turned. Ticking keeps D-1 whole: every command runs the world
  once, so a removal costs a turn like everything else. Spending the card keeps it from
  becoming a free way to cycle the hand. Removing a Bridge from under a piece drops it in
  the water. That's the step rule, and it's comedy.
- **Evidence:** R-29.

---

## Things

### D-4 Pushers act on the piece standing on them; the Puller acts two hexes ahead — *Proposed (pushers), Decided (Puller)*
- **Alternatives:** every Thing acts on the hex in front of it; Things are pieces that move
  themselves.
- **Why:** for Belt and Spring, the Thing under a crate is the whole explanation of why it
  moved (G-2), and a stranded crate can be rescued by building a mover under it. The Puller
  is the one exception, and it's deliberate: it moves pieces that have *no* Thing under them.
  Its glyph faces the hex it reaches toward, so the exception stays readable.
- **Evidence:** R-8 (movers may go under pieces), R-12, R-28.

### D-5 Seven kinds as rows of one template: Belt, Spring, Rocket, Puller, Wall, Trap, Bridge — *Decided (Puller, Rocket, Trap), Proposed (rest)*
- **Alternatives:** a bigger catalogue (splitters, grabbers); a single Belt; a Spinner
  (a belt that turns clockwise every tick).
- **Why:** templates over snowflakes. Every kind is a row of `THINGS` (`push`, `pull`,
  `splat`, `flies`, `skids`, `blocks`, `traps`, `on`, `weight`), so a new kind is usually a new row, not new code. Each
  kind breaks one rule. A Spring hops three hexes over lakes and skids on ice, a Rocket flies eight,
  a Puller acts at a distance without needing a Thing under the piece, a Wall shuts a hex, a
  Trap kills gremlins that come onto it, a Bridge opens water.
- **Why not the Spinner:** it pushed crates the opposite way on alternate arrivals. Crates
  arrive about every `SOURCE_INTERVAL` ticks, and with that at 3 the Spinner had turned
  halfway round each time. In the bot's lines it was mostly a hazard. The designer replaced
  it with the Puller.
- **What the Puller is for:** grabbing a piece off bare ground with no Thing under it, such
  as the end of an ice slide, a Spring landing, the source, or a stranded crate. It can also
  yank a gremlin off the line, into water if the near hex is water. Its catch is that it
  can't sit inside a belt line: a crate pulled onto the Puller's own hex just stays there.
- **Evidence:** R-12, R-17, R-7, R-15, R-32.

### D-17 Springs fly too: over lakes, and skid on landing on ice — *Decided*
- **Alternatives:** Springs on the ground rules (sink in any water, free ice hexes); flying
  Springs that land dead like a Rocket; Springs that jump over pieces as well.
- **Why:** the designer asked for it, after Rockets became airborne (D-15), and then for
  Springs to keep sliding on ice. A Spring is a throw: it clears a lake within its range and
  counts every hex in the air, then a crate that lands on ice skids on like any piece on ice.
  That keeps the ice windfall and the skid-into-the-sea joke for Springs, while a Rocket
  (no `skids`) lands dead so its range stays exact. `flies` and `skids` are template fields,
  so both throwers share one rule.
- **Evidence:** R-14, R-15. `Measured by: just cc-sim 200 small` (Bridge weight 1): 187/200
  reach the first milestone, median 51, p90 76, 0.17 lost per game, against 187/200, median
  51, p90 75, 0.14 lost with Springs that land dead. The bot places Springs only on straight
  land runs, so it rarely meets the difference.

### D-6 One `step` for everything; ice slides for free; open water sinks — *Proposed*
- **Alternatives:** separate handlers for springs, ice, and gremlins.
- **Why:** one code path means gremlins, springs, and slides can never disagree. Ice is the
  windfall terrain: a crate that skids across three ice hexes covers ground no belt paid
  for. Water is the cost of getting it wrong.
- **Evidence:** R-7, R-14, R-15.

### D-7 A random hand of `HAND_SIZE`, weighted toward belts — *Proposed, tuned by test/sim.js*
- **Alternatives:** choose any Thing freely; a fixed starting set.
- **Why:** scarcity of agency. You build with what you're dealt, so a Puller in hand
  invites a side-feed you wouldn't have planned. Belts are weighted heaviest so the plain
  solution is always reachable. Bridges are drawn at half the other specials' rate (the
  designer's call): most boards need few, and a hand clogged with them stalls building.
- **Evidence:** `Measured by: just cc-sim 200 small` → 183/200 reach the first milestone,
  median 65 turns, p90 247, 11.5 crates lost per game (nearly all wrecked by gremlins, D-8). The bot lays belts and Springs on
  straight runs and throws every other card away with `discard`, so this measures boards
  and hand pacing, not Puller, Rocket or Trap play. To be checked by playtest (X-2, X-4).

### D-8 Gremlins wander and ride movers, never push crates, and wreck a crate they step onto — *Proposed (wander, ride, no pushing), Decided (wrecking)*
- **Alternatives:** gremlins push crates; gremlins chase crates; no gremlins; gremlins that
  wreck crates however they arrive (pushed, pulled or flung too); wrecked crates not
  counted as lost.
- **Why:** comedy and stale routes. A gremlin in the way is a wall until it moves on. They
  avoid open water on their own, but ice and your belts can still drown them, and a Rocket
  splats them (D-15). The designer asked for them to be more pernicious: a gremlin's own
  step onto a crate destroys it, while being carried into one by a Thing only blocks, so
  the threat is the gremlin's choice, not your machine's. It's a piece template field
  (`wrecks`) on the shared push, the mirror of the Rocket's splat with cargo as the victim,
  so wanderers treat a crate's hex as open. A wrecked crate counts in `lost`: a crate the
  line didn't deliver. It makes a stalled crate (a jam, the end of a slide, the source) a
  target, which gives Walls, Traps and Rockets a job beside a line.
- **Evidence:** R-18, R-37; U-18 (manual). Wrecking was added as one change: `just cc-sim
  200 small` went from 187/200, median 53, p90 73, 0.15 lost per game to the figures in D-7.
- **Evidence:** R-18; X-1 shows the bot still finishes most boards with gremlins around
  (`just cc-sim 200 small` → 187/200 reach the first milestone).

---

### D-15 The Rocket: flies the piece on it up to 8 hexes, over inland water, and splats gremlins — *Decided (range 8, over inland water, splats both ways, splats re-emerge), Proposed (weight 1, lands on the splatted hex, sinks if it comes down on water, no ice slide)*
- **Alternatives:** unlimited range (until something stops it); a long Spring that sinks in
  any water; splat only the gremlin it hits; splat only a gremlin it launches; splatted
  gremlins gone for good.
- **Why:** the designer asked for it, splatting both ways, with splatted gremlins coming
  back like drowned ones (D-14), and flying over inland water so only the outer sea ends a
  flight early. An unlimited flight felt like cheating, so the designer capped its range at
  `THINGS.ROCKET.push`. It's `push` with `flies` on the shared push, so a flight obeys the
  step rule apart from that: blocked stops it, the outer sea sinks it, the target delivers
  it, movers and Bridges are just ground. Airborne, it counts every hex and ice doesn't slide
  it, so its range is exactly what the card says. A flight that ends over a lake comes down in
  it, since it has to land somewhere. A flier stopped by a gremlin lands on the gremlin's hex,
  since it squashed it; a gremlin riding a Rocket never survives the landing. Weight 1, half
  the other specials, because one Rocket changes a lot.
- **Evidence:** R-32, R-33, R-31 (splats re-emerge), R-26 (splat events). Unmeasured in
  play: the bot discards Rockets.

### D-18 The Trap: a gremlin that comes onto it dies, and a new one climbs out; Ex-gremlins counts them — *Decided (kills on arrival, re-emerge, weight as Rocket, the tally), Proposed (passing flights and building under a gremlin don't trigger; the count includes sinks and splats)*
- **Alternatives:** a Trap that catches crates too; one that holds a gremlin in place
  instead of killing it; one that's used up after a kill; gremlins that learn to wander
  around Traps; counting only trap kills.
- **Why:** the designer asked for a gremlin trap at the Rocket's frequency, killing on
  arrival with a respawn. It's a fixture row (`traps`) on the shared step: one check where a
  piece enters a hex, so every way of arriving (a wander, a belt, an ice slide, a Spring's
  skid) triggers it. A flight is airborne over a Trap the way it is over a lake, so only its
  landing hex counts; that keeps one rule for "what a flight ignores". Building one under a
  gremlin does nothing, because nothing arrived. Wandering gremlins don't avoid Traps (they
  only avoid water), so a Trap beside a line takes gremlins out over time without any
  pushing. The kill reuses `splat` (by null), so the client animates and sounds it like a
  Rocket's. Because gremlins re-emerge (D-14), a Trap thins traffic rather than clearing
  the board. `exGremlins` counts every gremlin gone however it went, as "ex-" reads; it
  sits in the top-right tally with deliveries, a score for comedy (G-1) beside the
  turn score.
- **Evidence:** R-35, R-36, R-31 (splats re-emerge); U-17 (manual). Unmeasured in play: the
  bot discards Traps.

### D-16 Discard: pick a card, then the Discard spot (or `X`); it ticks — *Decided (discard, ticks), Proposed (key X)*
- **Alternatives:** no discard (dump a card by building it somewhere harmless);
  free discards; discard the whole hand.
- **Why:** the designer asked for it. Building a card just to get rid of it cluttered the
  board and cost a hex as well as a turn. Ticking keeps D-1 whole and keeps hand cycling from
  being free: each throw is a turn, so waiting for a perfect hand still costs on the
  turn score.
- **Evidence:** R-34; U-15 (manual). `just cc-sim 200 small` with Rockets off: the old
  build-to-dump bot gave 187/200, median 50, p90 69; the discarding bot gives 187/200,
  median 51, p90 76.

### D-14 A drowned gremlin is replaced by a new one on the shore — *Decided*
- **Alternatives:** gremlins stay drowned; respawn on a timer; respawn where it sank.
- **Why:** the designer asked for it. Without it gremlins drown over a long game and the
  endless factory (D-2) goes quiet. Drowning one is still worth it: the newcomer turns
  up somewhere else, a fresh color, often far from your line. The shore (land next to the
  outer water) reads as "climbed out of the sea". A full or walled-off shore keeps it
  drowned, so fencing the coast is a real, if expensive, answer.
- **Evidence:** R-31. Measured when it was added (`just cc-sim 200 small`): 187/200 reach
  the first milestone, median 50, p90 69, against 191/200, median 49, p90 60 with gremlins
  staying drowned. Splatted gremlins (D-15) come back the same way.

---

## Platform (inherited from the Hex & Counters base)

### D-9 Five-module split, plain `<script>` globals, seeded `Rando` — *Decided*
- **Alternatives:** single file; ES modules.
- **Why:** G-3. The engine runs headless (R-24), every game reproduces from its seed
  (R-21, R-22), and the page runs on a double-click.

### D-10 Commands return `{ ok, events }`; the client animates from events only — *Proposed*
- **Alternatives:** re-render from state with no animation (the base's approach).
- **Why:** G-1. The tick is the payoff, and it has to be watchable. Diffing state can't
  show a slide path or a piece that sank, but events can. This is the network message
  shape too.
- **Evidence:** R-25, R-26.

### D-11 Retry generation, then fall back to the size's `knownGoodSeed` — *Decided*
- **Why:** every board must have a land path source→target; generation stays bounded.
- **Evidence:** R-5, R-23.

---

## Open questions

- **Q-1 Chain pushes?** A belt pushing a crate into another crate is blocked today.
  Sokoban-style chains would make jams clear themselves, and also make spectacular
  pile-ups. *Recommendation:* leave blocked until playtest shows jams are annoying.
- **Q-5 Gremlins on big boards.** The gremlin count doesn't scale with board size, so a
  60 × 60 board has the same one to four as the 16 × 10 one. Options: a gremlin count per
  `MAP_SIZES` row; a density (gremlins per land hex); leave it. *Recommendation:* a
  per-size dice count once you've played a big board and know how busy it should feel.

## Deliberately left out
- Undo, and getting a removed Thing's card back (D-12: removal costs the card and a turn).
- A defeat condition, a time limit, and an end (D-2).
