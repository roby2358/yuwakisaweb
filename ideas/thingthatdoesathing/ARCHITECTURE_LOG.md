# Thing Factory — Architecture Log

Dated entries, newest first. This is the only doc that records what something used to be.

### 2026-11-10 — Turning a mover no longer ticks (Q-2 settled by D-19)
`rotate` used to turn the facing and then run a tick like every other command; now it
returns `{ok: true, events: []}` and changes nothing else. Q-2 ("clicking a mover spends the
turn") is settled by D-19, and D-1 now reads "every command but turning a mover". The UI's
`rotate` no longer goes through `commit()` (no snapshot, no animation): it plays the cue
and re-renders. R-10 rewritten (no tick, Rocket added), the smoke test expects no turn
change for rotate, and the ONTOLOGY invariant, rotate rule and commands table, DYNAMICS
turn structure, README, intro keys and CLAUDE.md updated. `just cc-sim 200 small` is
identical (183/200, median 65).

### 2026-11-10 — Gremlins wreck crates they step onto
New piece template field `wrecks` (gremlin yes, crate no) and a `wrecks` field on the push's
`how` (false for every Thing; the piece's own value for a wander, so the shared `WANDER`
constant became `wanderOf(piece)`). A wandering step blocked by cargo removes it (`lost` +1)
and takes the hex, emitting `splat{id: crate, by: gremlin}`; `splatVictim` became
`victim(piece, dir, isVictim)` for both. `wanderDirs` treats a crate's hex as open. The
client colors a splat by kind (`SPLAT_COLOR`), and the tally's lost line now reads "N crates
lost" since not all of them sank. D-8 rewritten; R-37 and U-18 added; R-18 reworded;
R-16's blocking test now checks events, since its pinned gremlin wanders back onto the crate.
One change, measured alone: `just cc-sim 200 small` went from 187/200, median 53, p90 73,
0.15 lost per game to 183/200, median 65, p90 247, 11.5 lost; medium 195/200, median 65
(was 196, 57); large 196/200, median 81 (was 198, 76); huge 50/50, median 142 (was 132).

### 2026-11-10 — The Trap, the ex-gremlin count, and a top-right tally
New Thing `TRAP` (weight 1, as ROCKET) with a new template field `traps` on every row: a
piece that splats dies when it comes onto the hex (`step` returns `'trapped'`; a flight
checks only its landing hex) and the kill is a `splat` with `by` null, so it re-emerges
through the existing Emerge rule. New state field `exGremlins`, counted in the tick from the
same gone kinds that feed `emerge`. The Delivered meter and lost count moved out of the
top-left HUD into a new `#tally` panel at the top right, with Ex-gremlins; the lost line now
reads "N crates lost at sea" and hides at 0. D-5 grew to seven kinds; D-18, R-35, R-36,
U-17 added; U-9 and U-10 reworded. Adding a kind changes the draw table, so a seed now
deals different hands than before. `just cc-sim 200 small` went from 187/200, median 51, p90 76, 0.17
lost to 187/200, median 53, p90 73, 0.15 lost: the bot throws Traps away, so a Belt is a
slightly smaller share of each draw (D-7 evidence updated).

### 2026-11-10 — History and rationale swept out of code comments and ONTOLOGY
Provenance and "why" notes moved here or to their decision. `sound.js` is adapted from
`../../warrior/sound.js` (its 12.5% pulse wave and pentatonic cues). `Piece`, `Board`, the
UI's hover/pan/drag fields, and the board-wargame look came with the Hex & Counters fork;
ONTOLOGY now defines them directly instead of saying "from the base", and `board.js` no longer
describes other games extending it. Module comments that argued for the server-portable split
or the double-click rule (`index.js`, `gamestate.js`, `gameengine.js`, `index.html`) now cite
D-9, and `RUN_GAP_MS` no longer explains itself (D-13 does). Stale base-game wording was
fixed along the way: the CSS meter comment described the base's "progress to end" for the
player counter, the accent was the base's reachable-hex yellow, and the sound cues named
footsteps, end of turn, and victory (now: turning a mover, Wait, game start and milestones).
The shared libraries carried history too: `colortheory.js` is ported from a Scala
ColorWheel/Schemes/Colors library, and `hex.js`'s `Hex` class replaced the base's free
`hex*(q, r)` functions; their comments now just describe them.

### 2026-11-10 — Review against the ontology: remove's emerge moved into the tick
A code-vs-ONTOLOGY review found one behavior mismatch. `remove` sank a piece left on a removed
Bridge, ticked, then ran a second `emerge` for it, so its newcomer's `spawn` came after the
tick's `milestone` (the events table says milestones come last) and after the tick's own
emerges. Now `tick(first)` takes what the command did first (`NOTHING_FIRST`, or remove's
sink and its kind): the sink leads the events and its kind joins the tick's one `emerge`,
first. Added `test/R-31/remove_emerge_order.js` (fails on the old code); R-31 and the
Emerge/Commands rules reworded. The sim is unchanged (the bot never removes). Also fixed
stale comments (`piece.js` still described the base's player and enemies; `index.js` said four
modules) and ONTOLOGY's view-state table (`picked` has no `facing`; the ghost's facing is its
own field) and terrain table (flying over water).

### 2026-11-10 — Spring landings skid on ice again
The designer wanted flying Springs to keep sliding on ice. `THINGS` gained `skids` (Spring
yes, Rocket no): a flying push that runs its full range onto bare ice slides on, on the
ground (so a skid into a lake sinks). Ice under the flight still counts toward the range.
D-17 rewritten, R-14 updated; `isBareIce` factored out of the push. Small boards: 187/200,
median 51, p90 76, 0.17 lost (was p90 75, 0.14 lost with dead landings).

### 2026-11-10 — Springs fly; Bridges drawn half as often
At the designer's request `SPRING` got `flies: true` (**D-17**): a Spring's throw now
clears inland water, counts ice hexes, and doesn't skid on landing (it used to sink in any
water, get free ice hexes, and slide on landing). Bridge weight went from 2 to 1 (D-7).
R-14 and R-15 updated (R-15 gained `flying_over_water.js`). Controlled steps on small
boards: before 187/200, median 52, p90 73, 0.17 lost; flying Springs 186/200, median 53,
p90 74, 0.12 lost; plus Bridge weight 1, 187/200, median 51, p90 75, 0.14 lost. Other sizes
in RATIONALE D-3.

### 2026-11-10 — Rocket range capped at 8
The designer found unlimited flight felt like cheating: `THINGS.ROCKET.push` went from
`Infinity` to 8. A flying push now counts every hex and doesn't slide on ice (with a finite
range, free ice hexes would have stretched it). D-15 and R-32 updated. The sim is unchanged,
since the bot discards Rockets.

### 2026-11-10 — Rocket flights cross inland water
At the designer's request only the outer sea stops a Rocket's flight; it used to sink in any
open water. `THINGS` gained `flies` (Rocket only). `step` takes `flies` and lets a flying
piece over inland open water; `push(piece, dir, n, splat)` became `push(piece, dir, how)`
with `how = {n, splat, flies}` (gremlin wandering uses a `WANDER` constant). A flight stopped
above inland water comes down and sinks. D-15 and R-32 updated. The sim is unchanged, since
the bot discards Rockets.

### 2026-11-10 — The Rocket (with splats) and a Discard spot
The designer asked for a Rocket card that blasts a crate as far as it will go and splats
gremlins, choosing splats both ways (the gremlin a flier hits, and a gremlin it launches)
and re-emergence for splatted gremlins (**D-15**). `THINGS` gained `splat` and the
`ROCKET` row (`push: Infinity`, weight 1); `PIECES` gained `splats` (gremlin yes).
`push(piece, dir, n)` became `push(piece, dir, n, splat)`, and a new `splat{id, by}` event
feeds `emerge` alongside `sink`. The designer also asked for a Discard spot that throws away
the picked card and ticks (**D-16**, settling **Q-3**): new `discard(slot)` command, a
Discard button after the cards, and `X`. Added R-32 (flight), R-33 (splats), R-34
(discard), U-15, U-16; R-31 now covers splats; R-25, R-26 and the smoke walkthrough cover
the new command and event.
`test/sim.js` now throws unusable cards away with `discard` instead of building them
somewhere harmless. Controlled steps on small boards: Rockets off, old bot 187/200, median
50, p90 69 (unchanged); discarding bot 187/200, median 51, p90 76; with Rockets (weight 1)
187/200, median 52, p90 73. Other sizes moved too (RATIONALE D-3).

### 2026-11-10 — Board size picked at New Game: 16×10, 20×20, 30×30, 60×60
The designer asked for a size panel on New Game. `MAP_COLS`/`MAP_ROWS`, `HEIGHTMAP_SIZE` and
`KNOWN_GOOD_SEED` were replaced by `MAP_SIZES` rows (`cols`, `rows`, `heightmap`,
`knownGoodSeed`); 60 × 60 samples a 65 heightmap and the others keep 33. `newGame(seed)`
became `newGame(seed, size)`, recording `state.size`; an unknown size is `ok:false`. D-3
rewritten (it was one small board that always fits); D-11 now falls back per size.
R-1, R-2, R-5 and R-23 now run at every size; R-25 checks the size argument; U-2 updated,
U-14 added. On the client the intro's Begin button became the size picker, New Game opens
a second picker that Esc closes, and a board too big for the window opens centered on the
source. `test/sim.js` and `just cc-sim` take the size; the small board reproduces its
figures exactly (187/200, median 50). Opened Q-5 (gremlins don't scale with size).

### 2026-11-10 — Drowned gremlins re-emerge on the shore
The designer asked that a gremlin falling into the ocean be replaced by a new one on an
edge hex. This settles **Q-4** as **D-14**. `PIECES` gained `reemerges` (gremlin yes,
crate no). The new `emerge(sunkKinds)` puts a fresh gremlin (new id, palette color) on a
random shore hex, meaning land next to an edge hex that is free and isn't the source or
target, and emits `spawn`. It runs at the end of each tick and after `remove` sinks a
piece. Added **R-31**; R-15's gremlin case now checks that gremlin is gone rather than
that the board is empty. The sim moved from 191/200, median 49, p90 60 to 187/200,
median 50, p90 69, the only change being gremlins that no longer thin out.

### 2026-11-10 — Endless milestones replace the win; Go/Pause button
The designer asked for goals of 10, 20, 50, 100, "and keep going from there, 200, 500,
1000". The win at `DELIVER_GOAL` (5) is gone, along with `gameWon`, the `won` result flag,
the "after a win" refusals and the victory card. `FIRST_MILESTONE` (10) and
`nextMilestone(n)` (the 1-2-5 series, no last one) replace them, and a tick that reaches a
milestone emits `milestone{count}` (D-2 rewritten). The client shows a banner that hides on
its own. **R-20 retired**, **R-30** added, R-9/R-10/R-11/R-29 lose their won cases, U-8/U-10/
U-11 updated.
The designer also asked for a green Go/Pause button in the top centre (D-13, U-13). It
calls `wait()` `RUN_GAP_MS` after each animation and holds while a card is picked; picking
now works mid-animation so you can step in. `uiboot.js` got a fake `setTimeout` and drives
it. The sim now measures turns to the first milestone, which is twice the old goal, so its
numbers aren't comparable to before: 191/200, median 49, p90 60.

### 2026-11-10 — Colored isometric crates; gremlin counters show 👹
At the designer's request, with colored crates in mind for later, each crate now gets a
`color` from `CRATE_COLORS` (red, green, blue, yellow) when it spawns, through the new
`spawnCrate()` (`Rando.choice`). No rule reads it yet. The client draws crates as a
shaded isometric box from `CRATE_SHADES` and dispatches piece drawing via `PIECE_DRAW`;
`PIECE_LOOK.crate.color` is gone. The gremlin label changed from `'G'` to `'👹'` (the
crate's `'C'` became `'📦'`, which nothing draws now). R-19 now checks the crate color.
The extra `Rando` draw shifts every later roll, so the sim's boards differ:
`just cc-sim 200` gives 192/200, median 38 (was 189/200, median 36 on the old stream).
This isn't a balance change.

### 2026-11-10 — `D` removes a placed Thing
The designer asked for a way to delete a placed item. That replaces the left-out rule that
Things are permanent once placed. The new `remove(q, r)` command takes any Thing off the
board and ticks once, and the card isn't refunded (D-12). A piece left on open water by a
removed Bridge sinks before the tick, so its `sink` event has no `move` before it, and the
client fades it where it stood. Added R-29 and U-12; R-25 now covers `remove`. The smoke
walkthrough also plays random removes now. Q-3 (discarding hand cards) is still open,
since removal spends a placed Thing, not a card in hand.

### 2026-11-10 — Coding-conventions pass: templates for pieces, no default parameters
A review against the coding conventions found kind checks scattered through the code,
default parameters, and duplicated helpers. This was a refactor with no rule changes:
`just cc-sim 200` gives the same 189/200 and median 36 as before.
- **Pieces became templates.** `GameArtifacts.PIECES` (`label`, `cargo`, `wanders`)
  replaced the `kind === 'crate'` checks in `addPiece`, `step`, and the tick's wander loop.
  On the client, `GameDisplayArtifacts.PIECE_LOOK` (hover name, display color) replaced
  `CRATE_COLOR`.
- **Thing glyphs are a dispatch table.** `GLYPHS[kind]` in `gameui.js` replaced the
  `if/else` chain in `drawThing`, and the Wall's full-size tile is now `THING_LOOK.inset`.
- **`newGame(seed)` requires its seed.** It used to roll one with `Math.random` when the
  seed was missing; now that's `{ok:false}`, and the UI rolls the seed. R-22 now says the
  engine never calls `Math.random`, and R-25 checks the seedless call.
- **One placement rule.** `canPlace(kind, hex)` is used by both `place` and
  `legalPlacements`.
- **Events are returned, not collected.** `push()` returns its events and `tick()` gathers
  them, so `engine.events` is gone.
- **Shared helpers.** `aims` moved to `GameArtifacts`. `clockwise`, `counterClockwise`,
  `opposite`, and `same` became static on `Hex`. The neighbour lookup became
  `neighborHex`, and the gremlin-direction scan became `wanderDirs`. An unreachable guard
  in the wander loop was removed.
- **Client:** `render()` reads the clock itself. `drawThing` and `drawCounter` no longer
  take default arguments. `renderHand` redraws only when the hand, the picked card, the
  facing, or the won state changes.
- **Tests and tools:** `uiboot.js` seeds the page's `Math.random`. Its whole-game check had
  been failing on about one board in eight; it now plays the same boards every run. Added
  the `just cc-test` / `just cc-sim N` recipes and the project-local `thingfactory-tools`
  skill.

### 2026-11-10 — Spinner replaced by the Puller
The Spinner (a belt that turned clockwise every tick) was mostly a hazard. Crates arrive
about every `SOURCE_INTERVAL` (3) ticks, so it pushed every other crate backwards. The
designer replaced it with the **Puller**: it reaches across the near hex and pulls the piece
on the far hex into the near hex.
- `THINGS`: the `spin` field became `pull`; `SPINNER` became `PULLER` with the same weight.
- The engine's tick loop now goes through `actionOf(thing)`, which picks which piece a Thing
  moves, which way, and how far. Pushers and pullers share the one `push`/`step` path.
  Rotate works on any Thing with a facing. The `spin` event is gone.
- **R-17 retired** (Spinner); **R-28** added (Puller); R-10 and R-26 updated.
- `test/sim.js`: the bot no longer uses Spinners as belts. It discards Pullers facing away
  from its path, and `NOSPIN` is gone. `node test/sim.js 200` → 189/200 won, median 36.
  The earlier 192/200 was the `NOSPIN=1` run with different draws, so the two can't be
  compared directly.

### 2026-11-10 — Forked from Hex & Counters; became Thing Factory
Copied from `ideas/hexandcounter` (the base platform) and turned into a different game.
The designer chose **Thing Factory** over three other pitches, then settled three forks:
place-then-tick (D-1), deliver N crates with no time limit (D-2), and a board that fits on
one screen (D-3).

What changed from the base:
- **Removed:** the player counter, MP, reachability, `movePlayer`/`endTurn`, the progress
  meter, and the forest/scrub/hills/rough terrains.
- **Added:** Things (`THINGS` templates in `GameArtifacts`), crates, a source, the hand,
  the tick, and the `place`/`rotate`/`wait` commands, which return events. Added ICE
  terrain and gremlins (the base's enemies, now pushable and drownable).
- **Map:** 60×40 → 16×10; the heightmap shrank from 129 to 33.
- **Client:** animates each tick from events (the base re-rendered from state), adds a
  hand of cards, and new sound cues (place, deliver, sink).
- **Docs:** a fresh ID namespace. These IDs don't map to the base's R-/D-numbers.
- **Tests:** every `test/R-n/` was rewritten for the new rules (R-1…R-27). Added
  `test/sim.js`, a greedy builder bot used as the tuning harness.
