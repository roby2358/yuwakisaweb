# Thing Factory — Architecture Log

Dated entries, newest first. This is the only doc that records what something used to be.

### 2026-11-11 — Crate spawning caps by board area
`SOURCE_INTERVAL` (a crate every 3 ticks whenever the rolled source was clear, retried each
tick while jammed) became `SPAWN_INTERVAL` (a spawn chance every 3 ticks) plus a crate cap:
`crateCap(size)` = max(1, round(area / `CRATE_HEXES_PER_CAP` = 20)) plus
`milestonesReached(delivered)`, both new in artifacts.js. The engine gained `crateCount()` and
`crateMax()`; `spawnTimer` now resets on every chance. No new state field. `test/sim.js`
also prints mean and peak crates on the board. D-31 added, D-21 touched; R-19 updated.

### 2026-11-11 — Cards unlock one step per milestone
Every kind used to be in the deck from turn 1. A new `UNLOCKS` list in artifacts.js orders the
kinds in steps (Belt/Bridge/Wall/Trap, then Pusher+Puller, Slide, Spring, Rocket); a new game
opens the first step (`GameState.unlocks = 1`) and each milestone opens the next with an
`unlock{kinds}` event, passing over an all-colored step on a one-color board.
`drawableKinds()` filters to the open steps before the D-22 color gate and the weights. The
milestone loop moved into `reachMilestones(before, after)`. The UI's new-color panel became
the news panel (overlay `news`, `#news-panel`), which also names unlocked cards. D-30 added,
D-7, D-22 and D-29 touched; R-49 added, R-6, R-26, R-27 and U-23 updated.

### 2026-11-11 — The Slide card: ice you can build
A new Thing, `SLIDE`, with a new `THINGS` flag `slides` and a new `on` value `'both'` (land
or water). The engine's `isBareIce(hex)` became `isSlick(hex)`: a Thing on the hex decides by
its `slides` flag, otherwise the hex is slick if it's ICE, so terrain ice and Slides go
through the one slide path in `push` (and the Spring's skid). Over water a Slide keeps the
piece from sinking through the existing open-water check. Weight 1; no facing. Added a
glyph and `THING_LOOK`; the sim bot discards Slides. D-29 added; R-48 added, R-7, R-8 and
R-14 updated.

### 2026-11-11 — Placing on a Thing replaces it
A hex holding a Thing used to be illegal for every card: rebuilding it took `D` (remove,
one tick) and then a place (another tick). `canPlace` no longer checks for a Thing, so
`legalPlacements` includes occupied hexes, and `place` takes the old Thing out before
appending the new one, in one tick. The terrain, target, source and blocking checks still
apply as if the hex were bare, so a Bridge on water can only be replaced by a Bridge.
`remove` stays. The UI rings replaceable hexes with a dashed yellow line, hides the Thing
under the ghost, and the hover bar says "click to replace". D-28 added; R-47 added, R-8,
R-9 and U-3 updated.

### 2026-11-11 — The Bridge carries what's on it
A Bridge used to be a facing-less fixture: water a piece could stand on, where a pushed crate
stopped. It's now a mover with `push: 1`, a Belt built on water: it turns on click, places
with a facing, shows the selection arrow, and pushes the piece on it each tick through the
usual `step` (so one aimed at open water sinks the crate). Only the `THINGS.BRIDGE` row
changed in the engine; the glyph gained a chevron over faint planks, darker ink, and a new
hover line. D-27 added, D-5 touched; R-46 added, R-10 and R-15 updated, U-9 updated.

### 2026-11-11 — Pushers and Pullers only once two colors are open
Pushers and Pullers used to be drawn from the start, in the one open color, where they
only acted like white Things. They now stay out of the deck until a second color opens,
so a board with one color (small) never deals them; the other kinds' shares grow to fill.
`draw()` picks from `drawableKinds()`. D-22 and R-27 updated.

The new draws sent the smoke test down a path that turned up an old bug: a Wall could be
built on a source (Things may sit on one), and the source still spawned a crate inside it.
Walls can no longer be built on a source (the crates must flow); other Things still can.
`canPlace` checks it; R-8 updated and covers it.

### 2026-11-11 — Enter toggles Go
Enter used to be a Wait, the same as the Wait button. It now calls `toggleRun()`, like the
Go button: it starts Go, and pressed again it turns Go off, letting the tick already
animating finish. The Wait button still does one tick; Space is unchanged. U-8 and U-13
updated; uiboot covers it.

### 2026-11-11 — Intro and keys legend are two panels; Help button
The intro used to carry the story, the full key list and the size picker in one card. Now
the intro is the story and the sizes; picking a size from it opens the keys legend (new
`help` overlay, closes on a click or any key). A Help button in the HUD shows the same
legend any time; like every overlay it holds Go, which picks up when it closes. The legend
now lists select/turn, Space and Enter as they work today. U-24 added; uiboot covers both.

### 2026-11-11 — Space is "one tick, then stop"
Space used to be the same Wait as Enter, which did nothing useful while Go ran. It is now
`GameUI.oneTick()`: with Go off it's a Wait; with Go running it turns Go off and the tick
already animating finishes. Enter and the Wait button are unchanged. U-8 updated; uiboot
covers it.

### 2026-11-11 — Click selects a hex before it turns
Clicking a moving board to turn a Belt was confusing, since the tick could shift things
under the cursor. A bare click now selects a hex (`GameUI.selected`): a white outline, a
white arrow along a mover's facing, and Go holds while it's selected. A second click on it
turns the mover (`rotate`, still no tick, D-19); a click elsewhere or Esc deselects and Go
resumes. Selecting and turning are allowed mid-animation. U-6, U-8, U-13 updated; uiboot
covers it.

### 2026-11-11 — Pushers and Pullers only in crate colors, and rare (D-22)
`cardColor()` no longer offers white: a colored kind takes one of the open colors (the only
one on a single-color board). `PUSHER` and `PULLER` weights went from 2 to 0.5 each, since
about one per color is enough. R-27, U-20, D-22, ONTOLOGY Draw rule and Numbers updated.
`just cc-sim 200 small`: 200/200, median 58 → 51, 2.60 lost/game. The bot discards
Pushers and Pullers, so this mostly measures more Belt draws (R-6 updated for colored cards).

### 2026-11-11 — A new color opens a panel that waits for the player
The milestone banner no longer lists opened colors; an `open` event now shows the `color`
overlay (swatch, name, "click or press any key to continue"), which holds Go until dismissed.
Overlay keys dispatch through `OVERLAY_KEYS`. U-19 trimmed, U-23 added; uiboot covers it.

### 2026-11-11 — Idle ticks redraw a card (D-26)
New state field `idleTicks` and constant `IDLE_REDRAW_TICKS`. The tick's `first` input gained
`usedCard` (`CARD_FIRST` for place and discard, `NOTHING_FIRST` and the remove/blast inputs
false); at the threshold the tick redraws one random slot and emits `redraw{slot}`. The UI
flashes that card. R-45 and U-22 added.

### 2026-11-11 — `blast` command blows up a crate (D-25)
New engine command `blast(q, r)`: removes the crate there, `lost` +1, then ticks with its
`splat` first. The UI binds `B` to the hovered hex, and the help lists it. R-44 and U-21 added.

### 2026-11-11 — Pushers and Pullers act first in the tick (D-24)
The tick loop used to run every Thing in placement order, so a Pusher or Puller placed after
the Belt line beside it never acted (the Belt moved the crate first, R-13). Now Things with
`shove` or `pull` run first, then the rest, each in placement order. R-43 added.

### 2026-11-11 — Trapped gremlins counted apart from Ex-gremlins (D-18)
New state field `trapped`; `exGremlins` no longer includes Trap kills (it still counts sinks,
Rocket splats and target kills). Every `splat` event gained `trap` (true only for a Trap
kill), and the tick counts both from events; new query `isTrap(hex)`, which `trapsPiece` now
uses. The tally has a Trapped row. R-36 reworded, R-42 added; U-10 and U-17 name Trapped.

### 2026-11-11 — The Pusher, colored Pushers and Pullers, gremlins die on targets (D-22, D-23)
New kind `PUSHER` and two new template fields on every `THINGS` row: `shove` (hexes it pushes
the piece on the hex it faces, in its facing) and `colored` (Pusher, Puller). Things gained
`color` (`WHITE` or a crate color, new constant `WHITE`), and the hand changed from kinds to
`{kind, color}` cards: `draw()` now returns a card, `drawKind()` is the old weighted pick,
and `cardColor()` rolls a colored kind's color once 2+ colors are open. The tick skips a
Thing's piece when `affects(thing, piece)` is false. `actionOf` builds `how` once and has a
shove branch. `trapsPiece` now also kills a splatting piece on any target, which replaces
"a gremlin on the target stays and blocks crates". UI: Pusher glyph (a ram), colored kinds
draw their accent from `COLOR_INK` (the Puller's teal became white), and card names read
"Red Pusher". The pjpd task colorthings-3nq7 is done. Measured one change at a time: the
Pusher alone took `just cc-sim 200 small` from 185/200, median 65 to 184/200, median 70; then
the target kill took it to 200/200, median 57, 3.2 lost per game (medium 200/200, median 73).
New R-40, R-41, U-20; R-10, R-16, R-27 reworded.

### 2026-11-10 — Colors: each milestone opens a new crate color with its own target (D-21)
`GameState.source`/`target` became `sources` (`{q, r, colors}`) and `targets`
(`{q, r, color, delivered}`). `MAP_SIZES` rows gained `colors` (1/2/3/4) and GameArtifacts
gained `ENHANCE_CHANCE` (0.5). `CRATE_COLORS` used to be cosmetic; now the first color is
rolled at New Game (the same random call that used to color the first crate), and each
milestone runs `openColor()`, emitting the new `open` event. A spawn rolls an open color
every ready tick (it used to roll only when the source was clear), so the random stream
after a jam differs from before. `step` blocks a crate at another color's target on the ground
and delivers only at its own; `push` drops a flight one hex short of a wrong target.
`placeSourceAndTarget` returns the hexes and `endSlice`/`freeEndHexes` share the slice
logic with `openColor`. UI: targets ringed in their color (`TARGET_COLOR` removed), source
pips, `#color-info` per-color tally, the banner names opened colors. New R-38, R-39, U-19;
R-4, R-5, R-6, R-8, R-16, R-19, R-26, R-30, R-32 reworded. `just cc-sim 200 small` 183 →
185/200, median 65 unchanged (the random stream moved; the bot stops at the first milestone,
before any color opens).

### 2026-11-10 — Gremlins scale with board area (Q-5 settled by D-20)
`GREMLIN_DICE_COUNT` (1 on every size) became `GREMLIN_HEXES_PER_DIE` (160, the small
board's area) and `gremlinDice(size)` in GameArtifacts, which rolls one die per that many
hexes, rounded: 1, 3, 6, 23 dice for small, medium, large, huge. `MAP_SIZES` moved out of
the GameArtifacts return literal into a const so `gremlinDice` can read it. Small boards are
unchanged roll for roll (the sim matches exactly). R-6 now checks every size. Measured one
change at a time with `just cc-sim`: medium 195/200, median 65 → 183/200, median 84;
large 196/200, median 81 → 187/200, median 110; huge 50/50, median 142 → 42/50, median
226 (lost per game 5.0 → 13.2, 2.4 → 14.4, 1.6 → 30.6).

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
