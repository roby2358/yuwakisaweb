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
  `Measured by: just cc-sim 200 <size>` (turn cap 400) → small 200/200 reach the first
  milestone, median 57 turns (3.2 crates lost per game); medium 200/200, median 73 (5.2
  lost); before gremlins died on targets (D-23): large 187/200, median 110 (14.4 lost); huge (50 games) 42/50, median 226 (30.6 lost).
  Gremlin density is the same on every size (D-20), so big boards are as busy as small.

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

### D-20 Gremlins scale with board area: one die per small board's worth of hexes — *Decided (scale with area, the small board's density), Proposed (rounded dice count)*
- **Alternatives:** the same 1d4 on every size; a hand-set count per `MAP_SIZES` row; a
  density per land hex (water and mountains vary by seed); multiplying one roll by the
  area ratio.
- **Why:** the designer likes the small board's gremlin density and asked for it to hold on
  every size. `gremlinDice(size)` rolls one d`GREMLIN_DICE_SIDES` per `GREMLIN_HEXES_PER_DIE`
  hexes of area (the small board's 16 × 10), rounded: 1, 3, 6 and 23 dice. Rolling more
  dice rather than scaling one roll keeps the big boards near the average density instead
  of swinging between empty and swarming. It counts the whole rectangle, not land, so it
  depends only on the size, not the seed. Small boards are unchanged, roll for roll.
- **Evidence:** R-6. `Measured by: just cc-sim 200 <size>`, one change at a time: medium
  went from 195/200, median 65, 5.0 lost to 183/200, median 84, 13.2 lost; large from
  196/200, median 81, 2.4 lost to 187/200, median 110, 14.4 lost; huge (50 games) from
  50/50, median 142, 1.6 lost to 42/50, median 226, 30.6 lost. The bot doesn't guard its
  line (it discards Walls, Traps and Rockets), and a huge board's line is long, so these
  are a floor on how a player fares, not a forecast.

### D-21 Milestones open more colors on bigger boards, each with its own target — *Decided (one color per milestone up to 1/2/3/4 by size, 50% from an existing source, own target per color, random color per spawn, wrong-color targets solid on the ground but flown over), Proposed (placement in the end slices on free hexes, a flight drops short of a wrong target, nothing opens when there's no free hex)*
- **Alternatives:** a second color on a timer instead of at milestones; every color with its
  own source (no shared source); a round-robin spawn order instead of a random color; a
  per-color spawn clock instead of one for the board; a wrong-color crate passing over a
  target, or being destroyed by it; a jammed color holding every spawn until it clears.
- **Why:** the designer asked for it. Opening a color at a milestone is escalation tied to
  progress: the factory you just got working has to share the board with a second line. A
  shared source (half the time) is the harder case, because one line has to split by color,
  which is what colored pushers (tracked separately) would be for. A random color keeps the
  stream lumpy; one board clock means the crate rate doesn't grow with colors, so each line
  gets slower as colors open. A wrong target is solid on the ground so a mis-sorted crate
  jams where you can see it (G-2), but a Rocket flies over it, so long shots stay
  possible. Rerolling at the next spawn chance means a jammed color mostly lets the others through (D-31).
  Small boards stay one color: the whole contraption still fits the screen.
- **Evidence:** R-38, R-39, R-19, U-19 (manual). The bot measures only the first milestone,
  which comes before any color opens, so `just cc-sim` can't see this yet:
  `Measured by: just cc-sim 200 small` → 185/200, median 65 (the spawn's extra reroll
  shifts the random stream; the bot plays the same way); medium 186/200, median 84.

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

### D-5 Eight kinds as rows of one template: Belt, Spring, Rocket, Pusher, Puller, Wall, Trap, Bridge — *Decided (Pusher, Puller, Rocket, Trap), Proposed (rest)*
- **Alternatives:** a bigger catalogue (splitters, grabbers); a single Belt; a Spinner
  (a belt that turns clockwise every tick).
- **Why:** templates over snowflakes. Every kind is a row of `THINGS` (`push`, `pull`,
  `shove`, `splat`, `flies`, `skids`, `blocks`, `traps`, `colored`, `on`, `weight`), so a new kind is usually a new row, not new code. Each
  kind breaks one rule. A Spring hops three hexes over lakes and skids on ice, a Rocket flies eight,
  a Pusher shoves the piece in front of it, a Puller acts at a distance without needing a Thing under the piece, a Wall shuts a hex, a
  Trap kills gremlins that come onto it, a Bridge opens water and carries what's on it (D-27).
- **Why not the Spinner:** it pushed crates the opposite way on alternate arrivals. Crates
  arrived about every 3 ticks (the spawn interval, now `SPAWN_INTERVAL`), and with that the Spinner had turned
  halfway round each time. In the bot's lines it was mostly a hazard. The designer replaced
  it with the Puller.
- **What the Puller is for:** grabbing a piece off bare ground with no Thing under it, such
  as the end of an ice slide, a Spring landing, the source, or a stranded crate. It can also
  yank a gremlin off the line, into water if the near hex is water. Its catch is that it
  can't sit inside a belt line: a crate pulled onto the Puller's own hex just stays there.
- **Evidence:** R-12, R-17, R-7, R-15, R-32, R-41.

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
  Since D-30 the deck before the first milestone is only Belt, Bridge, Wall and Trap, so the
  bot builds that milestone from Belts alone (numbers there).

### D-23 A gremlin that comes onto a target dies — *Decided (dies), Proposed (however it arrives but a flight passing over, like a Trap)*
- **Alternatives:** gremlins stay on a target and block it (the old rule); gremlins can't
  enter targets at all; a target pushes a gremlin off.
- **Why:** the designer found gremlins too easy to camp on the target. A gremlin sitting
  there jams the whole line until it wanders off, and with wrecking it also destroys the
  crates queued up behind it. Treating every target as a Trap for gremlins (the same
  `trapsPiece` check) adds no new code path: it splats, counts in Ex-gremlins, and a new one
  climbs out on the shore.
- **Evidence:** R-16. Measured as one change (the Pusher already in, kill toggled):
  `just cc-sim 200 small` → 184/200, median 70, p90 259, 12.4 lost per game without it;
  200/200, median 57, p90 70, 3.2 lost per game with it. Medium with both: 200/200, median 73,
  p90 89, 5.2 lost per game. Camped targets were most of the bot's stalls.

### D-22 The Pusher, and colored Pushers and Pullers — *Decided (Pusher shoves the piece in front 1 hex, always a crate color, acting on its color's crates and every gremlin, the color picked at placement (D-32), rare: weight 0.5 each, drawn only once two colors are open), Proposed (the ram glyph)*
- **Alternatives:** colored Belts, Springs and Rockets; an off-color crate on a colored
  Belt carrying straight on (a switch, which needs a heading on every crate); colored
  cards as their own deck rows with weights; white Pushers and Pullers alongside the
  colored ones; the old weight 2 each.
- **Why:** colors (D-21) need a way to split a mixed line. A Pusher acts from beside a
  line, on the hex it faces, so a colored one can knock just its color off a white Belt
  line, and a colored Puller can reach in and pull just its color out. Everything else is
  unchanged: only these two are selective. Gremlins are always affected, so a colored
  Thing is never a gremlin-safe gap. Which kinds are selective is a `colored` template
  field; the color itself is the player's pick when the Thing goes down (D-32), not rolled
  with the card. With one color open, a colored Thing would just act like white, and the
  splitting it exists for has nothing to split, so the colored kinds stay out of the deck
  until a second color opens (on a board with one color, never), on top of the unlock order
  (D-30), which also needs them unlocked. The designer found about one per color is all a factory needs, so
  they're rare: weight 0.5 each, about 1 card in 28 apiece.
- **Evidence:** R-40, R-41, R-27, R-50, R-10; U-20 (manual). The bot discards Pushers, so
  adding the kind only thins its Belt draws: `just cc-sim 200 small` 185/200, median 65 →
  184/200, median 70 (the Pusher alone, before D-23).

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

### D-18 The Trap: a gremlin that comes onto it dies, and a new one climbs out; Trapped counts them, Ex-gremlins counts the rest — *Decided (kills on arrival, re-emerge, weight as Rocket, the tally, Trapped apart from Ex-gremlins), Proposed (passing flights and building under a gremlin don't trigger; target kills count as Ex-gremlins)*
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
  the board. The designer asked for trap catches to be counted on their own: `trapped`
  counts gremlins a Trap caught, and `exGremlins` every other gremlin gone (sunk,
  splatted, killed on a target). Both sit in the top-right tally with deliveries, scores
  for comedy (G-1) beside the turn score. The `splat` event carries `trap` so the tick
  counts from events alone; a target kill isn't a catch the player built a Trap for, so it
  stays in Ex-gremlins.
- **Evidence:** R-35, R-36, R-42, R-31 (splats re-emerge); U-17 (manual). Unmeasured in play: the
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

### D-26 Ten idle ticks redraw one random card — *Decided (10 ticks, one random card), Proposed (discard counts as using a card; remove and blast don't)*
- **Alternatives:** redraw the whole hand; redraw the oldest card; a timer that runs
  regardless of play; only `wait` counting as idle.
- **Why:** the designer asked that every 10 ticks without using a card, one random card be
  redrawn, so a hand you can't use doesn't freeze while Go runs the line. "Using a card" is
  the two commands that spend one: `place` and `discard`. `remove` and `blast` spend no
  card, so they count as idle. It's a `first.usedCard` flag on the tick input, not a check
  per command.
- **Evidence:** R-45; U-22 (manual). Unmeasured in play: the sim stops at the first
  milestone, but the bot does play idle stretches.

### D-25 `blast` blows up a stuck crate: a free command, crates only, counts as lost — *Decided*
- **Alternatives:** a Bomb card (scarce, from the hand); a Crusher fixture that crushes a
  crate that sat still a tick; a bigger blast (neighbors, or the Thing too); blasting
  gremlins as well; a separate "blown up" tally.
- **Why:** the designer asked for a way to clear a crate jammed on the line, and picked a
  free command with these answers: one hex, crates only, counted as lost. It costs a tick
  and a crate, like `remove` costs a tick and a card, so it's a repair, not a free reset.
  The kill reuses `splat` (by null) so the client bursts it like any other.
- **Evidence:** R-44; U-21 (manual). Unmeasured in play: the bot never blasts.

### D-27 The Bridge is a Belt over water — *Decided (it pushes the piece on it along its facing), Proposed (unreviewed: the rest)*
- **Alternatives:** a plain deck (the old rule: a piece pushed onto it just stopped there);
  a Bridge that carries a piece onward in whatever direction it came on (no facing, but it
  needs to remember each piece's last move); a separate Belt-on-water kind.
- **Why:** the designer asked for it. A crate that reached a Bridge stopped dead, so every
  crossing needed a Belt line that couldn't be built on water: in practice a Bridge was
  only useful under a Spring's flight. Giving the row `push: 1` makes it a mover like any
  other: `aims` turns it, the ghost and the selection arrow show its facing, and the tick
  runs it through the same `push`/`step`. No engine code knows about Bridges.
- **Unreviewed calls:** (1) It pushes on the ground (`flies: false`), so a Bridge aimed at
  open water drops the crate in, like a Belt aimed there; a crossing is a line of Bridges.
  (2) It's white and acts on every piece, gremlins included: a gremlin that wanders onto a
  Bridge gets carried, and can be carried into the lake. (3) It stays in the second group of
  the tick (D-24), in placement order, and a piece pushed onto it this tick waits for the
  next (R-13), exactly as on a Belt. (4) Weight stays 1 (D-7). (5) The glyph keeps its
  planks, drawn faint, under a belt chevron, and the ink is darkened so the chevron reads
  on the wood; the hover line says it carries what's on it over water.
- **Evidence:** R-46, R-10, R-15, R-13. `Measured by: just cc-sim 200 small` and
  `just cc-sim 50 medium`: unchanged, since the bot plans land paths and discards Bridges.
  Unmeasured in play.

### D-28 Placing on a Thing replaces it — *Decided (replace in one command and one tick), Proposed (unreviewed: the rest)*
- **Alternatives:** keep occupied hexes illegal (the old rule: `D`, then place, two ticks);
  replace but refund the old Thing as a card; let the new Thing keep the old one's slot in
  placement order.
- **Why:** the designer asked for it. Rebuilding a hex cost a `remove` tick plus a `place`
  tick, and a crate on the hex could wander off or sink in between. `canPlace` simply stops
  looking for a Thing; `place` takes the old one out before it pushes the new one. No
  engine code knows which kinds are involved.
- **Unreviewed calls:** (1) `remove` stays its own command, for clearing a hex without
  spending a card. (2) The hex is judged as if bare, against its own terrain: a land kind
  can't replace a Bridge on water (a Bridge can, so a piece on a bridged hex never sinks
  from a replace and `place` needs no sink case), a Wall still can't go where a piece
  stands, and a Wall still can't go on a source. (3) The same kind over itself is legal; it
  costs a card and a tick, and is the only way to recolor a Pusher or Puller: a new card,
  placed over it, with a new pick (D-32). (4) The new Thing
  goes last in placement order, like any new Thing, so within its group (D-24) it acts after
  the others. (5) A piece standing there stays put and the new Thing acts on it that same
  tick. (6) The old Thing's card is spent, as with `remove`; nothing returns to the hand.
  (7) Replacing counts as using a card (D-26). (8) The UI rings replaceable hexes with a
  dashed yellow line, hides the old Thing under the ghost, and the hover bar says "click
  to replace".
- **Evidence:** R-47, R-8, R-9; U-3 (manual). `Measured by: just cc-sim 200 small` and
  `just cc-sim 50 medium`: unchanged, since the bot only rotates its own Things and never
  places over one. Unmeasured in play.

### D-29 The Slide is ice you can build — *Decided (a placeable Thing that slides like ice, buildable on water like a Bridge), Proposed (unreviewed: the rest)*
- **Alternatives:** a Slide with a facing that redirects what comes onto it (a turning ice
  hex); a land-only Slide plus a separate ice-bridge kind; a Slide that also pushes the piece
  standing on it, like a Belt.
- **Why:** the designer asked for it (pjpd slide-card-3um8). Ice was the one free-movement
  windfall you couldn't build. One new `THINGS` flag, `slides`, feeds the single slick test
  `isSlick(hex)` that `push` already ran for bare ice: a Thing on the hex decides by its
  `slides`, and with no Thing the hex slides if it's ICE. So terrain ice and Slides share one
  code path, and "ice under a Thing doesn't slide" (R-14) falls out of the same test. Over
  water it needs no code of its own either: `isOpenWater` already means water with no Thing
  over it, which is the Bridge's "not sunk" check.
- **Unreviewed calls:** (1) `on: 'both'`, a new `BUILDS_ON` entry: a Slide builds on plains,
  ice or water (never mountain), so it's the only kind that can replace a Bridge on water and
  also go on land. (2) No facing: it keeps a piece going whichever way it came on, so it
  doesn't `aim`, can't be turned, and moves nothing standing on it (a crate spawned or stopped
  on one stays put). (3) A Spring that comes down on a Slide skids on, as on bare ice (the
  `skids` loop reads `isSlick` too); a Rocket doesn't; Slides under a flight don't count as a
  shortcut. (4) It's white and slides gremlins too; gremlins may wander onto a water Slide
  (it's covered water) and then slide on, possibly into the lake. (5) Weight 1, as a Bridge.
  It unlocks after Pushers and Pullers (D-30). (6) A line of Slides across a lake carries a crate over in one tick, and a single
  water Slide whose far side is open water drops the crate in, like ice running into a lake.
  (7) Glyph: three white ice streaks on a pale-blue slab, no arrow.
- **Evidence:** R-48, R-8, R-14. `Measured by: just cc-sim 200 small` → 200/200, median 51
  (was 50), p90 62 (was 60), 2.61 lost per game (was 2.60); `just cc-sim 50 medium` → 50/50,
  median 63 (was 60), p90 77 (was 70), 4.26 lost (was 3.58). The bot discards Slides, so the
  shift is belts drawn slightly less often. Unmeasured in play.

### D-30 Cards unlock one step per milestone — *Decided (gradual unlock, order Belt/Bridge/Wall/Trap, then Pusher+Puller, Slide, Spring, Rocket last; hand kept), Proposed (unreviewed: the rest)*
- **Alternatives:** every kind from turn 1 (the old rule); unlock by turn count rather than
  milestones; a fixed per-board card list; redrawing the hand on an unlock so the new card
  shows up at once.
- **Why:** the designer asked for it (pjpd card-unlock-aszw). Nine kinds on the first board
  is a lot to read before you've delivered a crate; four plain ones (a Belt line, a Bridge
  over a lake, Walls and Traps against gremlins) are enough to build the first factory, and
  each milestone then hands you one new toy to learn while the machine runs. The order is
  data, `UNLOCKS` in artifacts.js: a list of steps, each a list of kinds. `drawableKinds()`
  filters `THINGS` to the open steps before weighting, so the weights keep their meaning
  among whatever is in the deck. The state keeps one integer, `unlocks` (how many steps are
  open), and the milestone loop (`reachMilestones`) calls `unlock()` once per milestone
  crossed, so a tick that crosses several unlocks several steps in order.
- **Unreviewed calls:** (1) Cards already in hand stay as they are (the designer's default);
  new kinds come through later draws, discards and idle redraws, so the first one can take a
  few turns to appear. (2) On a board that can never open a second color (small), a step made
  only of `colored` kinds is passed over: the milestone unlocks the next step instead, and
  the passed-over kinds count as unlocked but the D-22 gate still keeps them out of the deck.
  Announcing Pushers and Pullers there would promise cards that never come. The test is data
  (`everDealt`: not `colored`, or `MAP_SIZES.colors > 1`), not a kind check. On a bigger board
  the Pusher/Puller step lands on the same milestone that opens the second color, so they
  arrive when they become useful; if that color can't open for want of a free hex, they're
  announced but stay gated until it does. (3) The `unlock{kinds}` event follows its
  milestone's `open`. (4) The UI shows one panel for both, the old new-color panel grown into a
  news panel (overlay `news`): a swatch per color, a card picture per kind, and each kind's
  verb line; it holds play until a click or any key, like the color panel did. A small
  board's first milestone now opens it (for the Slide). (5) Past the last step (a small board
  at 50, a bigger one at 100) milestones unlock nothing.
- **Evidence:** R-49, R-27, R-6, R-26; U-23 (manual). `Measured by: just cc-sim 200 small` →
  200/200, median 49 (was 51), p90 57 (was 62), 2.08 lost per game (was 2.61);
  `just cc-sim 50 medium` → 50/50, median 61 (was 63), p90 69 (was 77), 3.42 lost (was 4.26).
  The bot only measures the first milestone, where the deck is now Belt-heavy (6 of 10
  weight, was 6 of 15): it never sees a Spring before then, but it gets more Belts, so it's a
  little faster. No numbers retuned. Unmeasured in play.

### D-31 Crates spawn up to a cap that scales with board area and grows by one per milestone — *Decided (a cap scaled by area, a chance every third tick, +1 per milestone reached), Proposed (unreviewed: the rest)*
- **Alternatives:** the fixed timer it replaced (`SOURCE_INTERVAL`: a crate every 3 ticks
  whenever the rolled source was clear, retried every tick while jammed); a cap per color or
  per source; a cap with a fixed base plus a per-area term; storing a bonus counter in state.
- **Why:** the designer asked for it (pjpd crate-cap-hybj). Under the timer a stalled line kept
  pouring crates onto the board until every source jammed; a cap makes a big factory's crate
  population follow the board and the player's progress instead. The cap is
  `crateCap(size)` = max(1, round(cols × rows / `CRATE_HEXES_PER_CAP`)), the same shape as
  `gremlinDice`, plus `milestonesReached(delivered)`: one more per milestone (10, 20, 50, …),
  so a tick that crosses several milestones (`reachMilestones`) raises it by each.
- **Unreviewed calls:** (1) The bonus is derived from `delivered`, not stored: the 1-2-5
  series already says how many milestones a count has reached, so state keeps only
  `spawnTimer`. (2) `spawnTimer` now resets on every chance, spawn or not; a jammed source (or
  a full board) waits for the next chance, three ticks on, rather than retrying the next tick
  as the old timer did. It keeps "every third tick" literal and makes the rhythm steady.
  (3) One cap for the whole board, counting every crate of every color, as one board clock
  already did (D-21); a chance rolls one open color and spawns nothing if that source is
  occupied (no reroll to another color). (4) Gremlins don't count toward the cap. (5)
  `CRATE_HEXES_PER_CAP` = 20 gives small 8, medium 20, large 45, huge 180. Before the first
  milestone the bot peaks at 8 / 14 / 21 / 45 crates on those boards, so only small's cap
  binds then, and at 20 it doesn't slow the bot (30 gave small a cap of 5 and median 56).
  The cap is meant to bite later, when several colors run and lines back up; huge's linear
  scaling makes it nearly uncapped, which may want a sqrt-of-area shape after playtest.
- **Evidence:** R-19. `Measured by: just cc-sim` (sim now also prints mean and peak crates on
  the board), before → after: small 200 games median 49 → 49 (p10 43 → 43, p90 57 → 58,
  2.08 lost/game both); medium 200 games median 60 → 61 (p90 71 → 70); large 100 games
  median 81 → 79 (p90 93 → 96); huge 50 games median 143 → 143 (p90 168 → 174). The bot
  stops at the first milestone, so the per-milestone growth is unmeasured; unmeasured in play.

### D-32 The player picks a Pusher or Puller's color when placing it — *Decided (cards drawn plain, color picked at placement and kept for good, one color skips the picker), Proposed (unreviewed: the rest)*
- **Alternatives:** the color rolled with the card at draw time (the old rule, D-22 before
  this); a separate free command to color a placed white Thing, like `rotate`; recoloring a
  placed Thing for free; a white Pusher or Puller that acts on everything until colored.
- **Why:** the designer asked for it (pjpd color-picker-8h4x). A random color made the rare
  sorter card a lottery: a red Pusher when the blue line is the one to split was as good as
  a discard. Picking at placement keeps the card rare and the decision the player's.
- **Unreviewed calls:** (1) The pick is part of the place command,
  `place(slot, q, r, facing, color)`: the UI asks first and sends one command, so placement
  stays one atomic command and one tick, the engine never holds a white Pusher or Puller, and
  the question "does an unpicked one act?" never comes up. (2) `color` is a required argument
  for every kind; the engine's one query `colorChoices(kind)` says what's legal (the open
  colors for a `colored` kind, `[WHITE]` for every other), and anything else is `ok:false`
  with nothing changed. The UI reads the same query, so it never branches on the kind: one
  choice places at once, more open the picker. (3) With one color open the picker is skipped
  and that color used. The draw gate (D-22) keeps colored cards out of a one-color deck, so
  in play the picker always shows two or more swatches; the skip covers a forced hand.
  (4) The picker is an L5 overlay (`color`): a small square of swatches beside the hex, one
  per open color in opening order, with the white ghost left standing on the hex. It holds
  Go like every overlay, and nothing ticks behind it because nothing has been sent. (5) A
  swatch click or its number key (`1`–`4`; the overlay takes keys before the hand's `1`–`3`,
  so there's no clash) places it. Esc, right-click or a click off the swatches closes the
  picker and leaves the card picked (back one layer, as Esc does elsewhere); a second Esc puts
  the card back. Other keys do nothing while it's open. (6) No recoloring: a placed Thing's
  color is fixed (R-50); replacing it with a new card (D-28) is how you change it. (7) Cards
  have no color field now (`{kind}`), and the hand draws Pushers and Pullers white, saying
  "you pick its crate color when you place it".
- **Evidence:** R-50, R-9, R-27; U-20, U-25 (manual); `test/integration/uiboot.js` drives the
  picker (open on a two-color board, pick by key and swatch, cancel by Esc, right-click and a
  click off, Go held). `Measured by: just cc-sim 200 small` and `just cc-sim 50 medium`:
  unchanged (small 200/200, median 49, p90 58, 2.08 lost; medium 50/50, median 61, p90 70,
  3.52 lost). Small never deals colored cards, and the bot stops at medium's first milestone,
  before the second color opens, so the dropped color roll never touches its `Rando` stream.
  Unmeasured in play.

### D-24 Pushers and Pullers act before the other Things in a tick — *Proposed*
- **Alternatives:** pure placement order (the old rule); letting a Pusher or Puller move a
  piece that already moved this tick; acting after the Belts.
- **Why:** in pure placement order a Pusher or Puller built after the Belt line beside it
  never fired: the Belt had already moved the crate in front, and each piece moves at most
  once (R-13). Players build the line first and the diverter second, so it read as broken.
  Reaching first makes it a diverter wherever it was built, keeps one move per piece, and is
  one partition of the loop, not a per-Thing priority.
- **Evidence:** R-43. Unmeasured in play: the bot discards Pushers and Pullers.
- **Open: first vs last (2026-11-11, pjpd push-order-ptbd)** *(unreviewed — recommendation
  only, order unchanged)*. "Last" means Belts, Bridges, Springs and Rockets go first, then
  Pushers and Pullers, each group still in placement order. R-13 holds either way: the
  `moved` set is checked before every action, and a piece whose push was *blocked* still
  counts as moved. That one fact decides most cases. The hope for "last" was "the belt
  brings it, the Pusher shoves it on" in a single tick, but a crate a Belt just carried has
  moved, so a last-acting Pusher skips it. Traced on `flatGame()` with the order line
  swapped in a throwaway copy (crate positions after each tick, a Belt line E along r=4):
  - *Pusher beside a running line* (Belts q=1…8, Pusher at (4,5) facing NE onto (5,4)).
    First: the crate gets to (5,4) on tick 4 and is shoved to (6,3) on tick 5. Last: tick 5's
    Belt carries it to (6,4) before the Pusher looks, and so on every tick: the Pusher never
    fires, which is exactly the bug D-24 fixed. A *Puller* whose far hex is on the line
    behaves the same way: first pulls the crate into its near hex, last never does. The same
    holds for a *Bridge* line (D-27), with one hazard in first order: a Pusher beside a
    Bridge line over water shoves the crate into the lake (sinks, `lost` +1) unless the
    side hex is bridged or Slid. Last order never fires there at all.
  - *Pusher at a belt corner.* Where the line just ends (Belts q=1…4, (5,4) bare, the Pusher
    as above), both orders match: the crate arrives on tick 4 and is shoved NE on tick 5,
    because a crate standing on bare ground has nothing else to move it. Where the corner is
    a turning Belt ((5,4) Belt facing SE), first lets the Pusher override the turn (crate to
    (6,3)) and last lets the Belt win (crate to (5,5), then (5,6)); the Pusher is dead weight.
  - *Puller reaching over a Belt onto it* (Puller at (2,4) facing E, a Belt on the near hex
    (3,4) facing W, a resting crate on the far hex (4,4)). Same in both orders: pulled onto
    the Belt on tick 1, carried on tick 2. A piece that lands on a mover waits a tick
    regardless.
  - *Pusher feeding a Spring* (line ends at (5,4), Pusher shoves it NE to (6,3), a Spring
    there facing E). Same in both: shoved on tick 5, thrown to (9,3) on tick 6. Aiming the
    Pusher *at the Spring's own hex* differs: first steals the crate off the Spring before
    the throw ((6,3)); last lets the Spring throw it ((8,4)) and the Pusher never acts.
  - *Slide* (D-29) doesn't act in the tick, so order never matters for it: Belts q=1…3 into
    Slides q=4…6 run the crate to (7,4) in one push, and a Pusher facing (7,4) shoves it on
    the next tick in both orders.
  - *Merging into a busy line* is the one place "last" does better. Belts q=1…8 with crates on
    (5,4) and (6,4), and a Pusher at (4,6) shoving a side crate from (5,5) NE onto (6,4).
    First: (6,4) is still occupied when the Pusher acts, so the shove is blocked and the side
    crate burns its move; with the Belts placed downstream-first it waits two ticks. Last:
    the Belts clear (6,4) first, and it merges on tick 1. The gain is a tick or two per
    merge, and it depends on Belt placement order anyway.
- **Recommendation:** keep *first*. With one move per piece, "last" doesn't buy "the belt
  brings it, the Pusher shoves it on". It makes a Pusher or Puller beside any moving line
  (Belt, Bridge, a turning corner, a Spring hex) never fire, and it changes nothing at line
  ends, where the crate stops anyway. Its only win is faster merges into a dense line. In
  "first", the Pusher overrides whatever the crate stands on, which is the whole point of a
  diverter. The costs of first are a Pusher aimed at a Spring stealing its crate and a
  Pusher beside a Bridge line drowning crates, and both are visible and fixable by aiming.
  Revisit only if playtest shows merges stalling.

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

## Deliberately left out
- Undo, and getting a removed Thing's card back (D-12: removal costs the card and a turn).
- A defeat condition, a time limit, and an end (D-2).
