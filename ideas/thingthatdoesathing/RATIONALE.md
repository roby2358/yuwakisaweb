# Thing Factory — Rationale

Why each current choice is what it is. Decisions are `D-n`, open questions are `Q-n`, and
neither is ever renumbered. Rules and constants are named as in ONTOLOGY.md. History is in
ARCHITECTURE_LOG.md.

---

## Shape of the game

### D-1 Place-then-tick: every command ticks the world once — *Decided*
- **Alternatives:** build-then-run (Incredible Machine: freeze, build, press GO); a
  per-turn parts budget with several placements per tick.
- **Why:** G-1. The contraption is running while you build it, so each placement is a
  repair or an extension of a live machine. It also reuses the base's turn engine.
- **Evidence:** R-9, R-10, R-11 (each command runs exactly one tick).

### D-2 Win by delivering `DELIVER_GOAL` crates; no time limit; score is turns — *Decided*
- **Alternatives:** deliver one crate; deliver N before turn T; drown every gremlin.
- **Why:** N crates turns the puzzle into a factory: the first crate proves the line, the
  rest test whether it keeps working with gremlins wandering through. Leaving out a time
  limit keeps the mood tinkery, not panicky.
- **Evidence:** R-16, R-20.

### D-3 Small board, `MAP_COLS × MAP_ROWS`, fits one screen — *Decided*
- **Alternatives:** the base's 60×40; a medium board with panning.
- **Why:** G-2. The whole contraption is visible at once, so cause and effect are never
  off-screen.
- **Evidence:** U-2 (manual).

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

### D-5 Five kinds as rows of one template: Belt, Spring, Puller, Wall, Bridge — *Decided (Puller), Proposed (rest)*
- **Alternatives:** a bigger catalogue (splitters, grabbers); a single Belt; a Spinner
  (a belt that turns clockwise every tick).
- **Why:** templates over snowflakes. Every kind is a row of `THINGS` (`push`, `pull`,
  `blocks`, `on`, `weight`), so a new kind is usually a new row, not new code. Each kind
  breaks one rule. A Spring skips ahead, a Puller acts at a distance without needing a Thing
  under the piece, a Wall shuts a hex, a Bridge opens water.
- **Why not the Spinner:** it pushed crates the opposite way on alternate arrivals. Crates
  arrive about every `SOURCE_INTERVAL` ticks, and with that at 3 the Spinner had turned
  halfway round each time. In the bot's lines it was mostly a hazard. The designer replaced
  it with the Puller.
- **What the Puller is for:** grabbing a piece off bare ground with no Thing under it, such
  as the end of an ice slide, a Spring landing, the source, or a stranded crate. It can also
  yank a gremlin off the line, into water if the near hex is water. Its catch is that it
  can't sit inside a belt line: a crate pulled onto the Puller's own hex just stays there.
- **Evidence:** R-12, R-17, R-7, R-15.

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
  solution is always reachable.
- **Evidence:** `Measured by: node test/sim.js 200` → 189/200 won, median 36 turns, p90
  52, 0.14 crates lost per game. The bot lays belts and Springs and discards Pullers facing
  away from its path, so this measures boards and hand pacing, not Puller play. To be
  checked by playtest (X-2, X-4).

### D-8 Gremlins wander and ride movers, but never push crates — *Proposed*
- **Alternatives:** gremlins push crates; gremlins chase crates; no gremlins.
- **Why:** comedy and stale routes, without the machine being sabotaged on purpose. A
  gremlin in the way is a wall until it moves on. They avoid open water on their own, but
  ice and your belts can still drown them.
- **Evidence:** R-18; X-1 shows the bot still finishes most boards with gremlins around
  (`node test/sim.js 200` → 189/200; the misses include the bot walling gremlins in on its
  own path).

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

### D-11 Retry generation, then fall back to `KNOWN_GOOD_SEED` — *Decided*
- **Why:** every board must have a land path source→target; generation stays bounded.
- **Evidence:** R-5, R-23.

---

## Open questions

- **Q-1 Chain pushes?** A belt pushing a crate into another crate is blocked today.
  Sokoban-style chains would make jams clear themselves, and also make spectacular
  pile-ups. *Recommendation:* leave blocked until playtest shows jams are annoying.
- **Q-2 Clicking a placed mover turns it and spends the turn.** That's fast, but a stray
  click costs a tick. *Recommendation:* keep it; a tick is cheap with no time limit.
- **Q-3 Discarding.** An unwanted card can only be dumped by building it somewhere
  harmless. *Recommendation:* keep it until it feels bad; an explicit discard is easy to add.
- **Q-4 Should gremlins respawn?** They drown over a game, so late game gets quiet.
  *Recommendation:* playtest first.

## Deliberately left out
- Undo and picking a Thing back up (non-goal; permanence is part of the puzzle).
- A defeat condition and a time limit (D-2).
