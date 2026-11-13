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

### D-21 Milestones open more colors on bigger boards, each with its own target — *Decided (one color per milestone up to 1/2/3/4 by size, 50% from an existing source, own target per color, random color per spawn, wrong-color targets solid on the ground but flown over), Proposed (placement in the end slices on free hexes, a flight drops short of a wrong target, nothing opens when there's no free hex; free-hex placement superseded 2026-11-13 by D-44)*
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
  *(2026-11-13: the random color per spawn is superseded by D-43's fixed color cycle; a jammed
  color's slot is skipped, so the others still come through.)*
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

### D-39 `D` removes the Thing on the selected hex, never the hovered one — *Decided 2026-11-12 (pjpd delete-sel-rcax: D acts on the bare-click selection only; no selection or a bare hex does nothing; a remove clears the selection), Proposed (*unreviewed*: the rest)*
- **Alternatives:** keep D on the hovered hex (the old rule); D on the selected hex, falling
  back to the hovered one when nothing is selected; a confirm step.
- **Why:** with Go running, the mouse drifts while you reach for the key, and D took out
  whatever Thing happened to be under the cursor by then. Selecting first is a deliberate
  two-step act: the outlined hex is exactly what goes, and selecting already holds Go, so the
  board stands still while you decide. No fallback to the hover, since that would bring back
  the slip the change is for. Clearing the selection after the remove lets Go resume and
  leaves no outline over a bare hex.
- **Unreviewed calls:** (1) A D on a selected bare hex (or one whose Thing is gone) keeps the
  selection; only a successful remove clears it. (2) The hover bar now says how: "click to
  select, then D to remove" over an unselected Thing, "D to remove" over the selected one, and
  no D hint while a card is picked (picking clears the selection, so D can't act then).
- **Possible follow-up:** `B` (blast) still hits the crate under the cursor. Crates move, so
  selecting a hex to blast what stands on it would often miss by the time you press B; it
  stays on the hover until playtest says the same slip happens there.
- **Evidence:** `uiboot.js` (select a Thing, hover another, D removes only the selected one;
  D with no selection removes nothing); U-12.

### D-40 Map scale: buttons 1, 2 and ∞ — *Decided 2026-11-12 (pjpd map-zoom-8cwk, then the designer after a look: three buttons, 1x / 1/2 / fit capped at 1x (1/4 dropped: it came out smaller than the fit); the fit uses the space from the window top to the top of the hand, or the canvas width, whichever is tighter; the hand sits flush on the bottom edge; fit computed once on the press; window resizes ignored for the scale; every new game at 1x; text below a readable size hidden, no other simplified art; zoom keeps the canvas center fixed; pan clamped so the board can't leave the screen; buttons only, no keys or wheel; active button lit), Proposed (*unreviewed*: the rest)*
- **Alternatives:** wheel zoom (the wheel already turns the ghost); number-key zoom (`1`–`3`
  pick cards); continuous zoom; level-of-detail art at small scales (a later idea, zoom-lod,
  after playtest).
- **Why:** the 30×30 and 60×60 boards took a lot of dragging to see where crates were going.
  A few fixed steps are enough to get the whole factory in view and back, and buttons don't
  fight the keys and wheel that placement already uses. The engine never sees the scale.
- **Unreviewed calls:** (1) Drawing goes through one canvas transform (`scale` then pan), so
  art, line widths and fonts all scale together; at small fits the hex borders and outlines come out
  hairline-thin rather than being held at a minimum width. Text is the only thing gated
  (`readable(px)`, `MIN_TEXT_PX` 8): at 1/2 11px text hides and 16px stays (written for the source's "IN" and the target's ★, which D-42 removed);
  at a small fit all on-map text hides. That gate is where a detail switch would hang later. (2) ∞
  centers the board in the space above the hand (it doesn't keep the old center), ignores the
  top-left HUD panels, and stays lit afterwards. (3) The clamp keeps the canvas center
  inside the box of hex centers, during drags and after every zoom. (4) The buttons sit in a
  third row under the HUD line ("Map 1 2 ∞"); on narrow screens Go and the banner drop a
  little further to clear it. (5) A window resize still re-centers the board as before
  (`centerMap`, now at the current scale) but never changes the scale. (6) `UI_CONTROLS.md`
  is the shared family spec and already calls zoom optional, so it's unchanged.
- **Evidence:** `uiboot.js` (each button sets its scale and lights; the center stays put;
  `screenToHex(hexToScreen(h))` round-trips at every scale; at 1/2 a click selects and places
  on the right hex and a tick animates; a drag can't push the board off; ∞ fits a 60×60 board
  above the hand;
  a new game resets to 1x); U-27.

### D-41 Phones and tablets get a sorry page instead of the game — *Decided 2026-11-13 (pjpd mobile-lock-twxz: detect at boot with `matchMedia('(pointer: coarse) and (hover: none)')`, not the user agent, so a touchscreen laptop with a mouse still plays; the sorry page replaces the intro, with no board, engine or input; the game's name, what it is, and a kind "needs a mouse and keyboard, try it on a computer"; no bypass by default), Proposed (*unreviewed*: the rest)*
- **Alternatives:** user-agent sniffing (misreads iPads that report as desktop Safari, and
  touchscreen laptops); `'ontouchstart' in window` (true on touchscreen laptops, which have a
  mouse); a touch control scheme (a real project of its own: hover, right-click, the wheel and
  R/D/B/X all need stand-ins); letting a phone load the game and fail quietly.
- **Why:** the game leans on hover (the hover bar, the ghost), right-click, the wheel and
  four letter keys. On a phone none of that exists, so the intro would offer a game that
  can't be played. A gentle page that says so, and where it does work, is kinder than a
  board that ignores taps.
- **Unreviewed calls:** (1) No user-agent fallback: every current mobile browser answers the
  pointer/hover media query, and a browser without `matchMedia` at all is treated as a
  desktop (the tests' stub DOM relies on that). (2) No "play anyway" link: with no touch
  controls behind it, it would only lead to a board that doesn't answer taps; easy to add if
  a stylus-and-keyboard tablet player asks. (3) The check runs once in `index.js`, before
  `GameState`/`GameEngine`/`GameUI` are built, and the page stays as it booted (no live
  re-check if a mouse is plugged in; reload to play). (4) The page is a hidden
  `#sorry-panel` in `index.html`; `GameUI.showSorry()` (a static, so no `GameUI` is
  constructed) shows it and adds `touch-only` to the body, which hides every other panel and
  the canvas. (5) Its picture is a Belt drawn by the card art (`cardPicture`), the first
  Thing a player meets. (6) The card scrolls inside a 16px gutter if a landscape phone is
  too short for it; the existing viewport meta (`width=device-width, initial-scale=1.0`)
  already lays it out at phone width.
- **Evidence:** `uiboot.js` (a coarse/no-hover `matchMedia` shows the sorry page, hides the
  rest, builds no game and wires no input; a fine pointer and a missing `matchMedia` both boot
  to the intro); U-28.

### D-42 Sources and targets fill their hex: a plus for a source, two rings for a target — *Decided 2026-11-13 (pjpd port-look-jtj4: each fills its whole hex with its color, no terrain showing; a target gets two concentric rings, a source a plus spanning the hex, both in a lighter shade of that color; the glow ring, IN and ★ labels, the target's black inner line and the source's color pips go; the lighter shade is derived in one place, not picked per color; a source making several colors splits its fill into equal wedges, one per color in `colors` order, under a neutral light plus), Proposed (*unreviewed*: the rest)*
- **Alternatives:** keep the glowing ring with labels (the old look); a colored ring over the
  terrain with the pips; stripes instead of wedges for a shared source; hand-picked light
  shades per color.
- **Why:** a ring over the terrain read as a decoration on a hex rather than a place, and the
  labels vanished at small scales (D-40). A solid hex in the crate's own color says "red goes
  here" at a glance and at every scale, since shapes need no text gate. The plus and the rings
  tell a source from a target without words, and wedges show every color a shared source
  makes in the same language as the fill.
- **Unreviewed calls:** (1) The light shade is the crate's mid (`left`) face mixed 60% toward
  white (`PORT_MARK_LIGHTEN` 0.6, by `lighten` in `displayartifacts.js`, stored as
  `CRATE_SHADES[c].light`). Yellow's marks are the faintest (about 1.4:1 against its fill,
  against 1.7 to 2.5 for the others); a watch point for the look check. (2) Every source and
  target keeps a dark outline (`PORT_OUTLINE`, 2px at 70% black), not just the pale colors:
  measured against the terrain beside them, green on plains is 1.04:1, red on mountain 1.07,
  red on water 1.15, blue on water 1.34 and yellow on ice 1.37, so no color is safe
  everywhere. (3) The plus runs vertex to vertex up and down and edge to edge across, its
  arms 86% of the way to the rim; the rings sit at 68% and 34% of the inner radius; marks are
  4.5 world px (2.25 on screen at 1/2). (4) Wedges start at the top and go clockwise; the
  neutral plus is `PORT_NEUTRAL_MARK` (#f2f2f2). A source with no open color (none today)
  falls back to `SOURCE_COLOR` with the neutral plus. (5) The intro's "★ target" lost its ★.
- **Evidence:** `uiboot.js` (every crate color has a `light` shade lighter than its fill; a
  source of none, one and every color renders); U-29.

### D-43 Crates come from a fixed, seeded cycle of the four colors, one slot a tick — *Decided 2026-11-13 (pjpd spawn-cycle-jisb: all of `CRATE_COLORS` shuffled once with `Rando` at `newGame` into `spawnCycle`, never reshuffled; every tick takes the next slot; an open color's slot makes its crate if the board is under the cap and the source is clear, a closed color's slot is a tick with no crate; a blocked or capped slot is skipped, not retried; `SPAWN_INTERVAL` removed; the cycle's length is `CRATE_COLORS.length`, no per-size cases; the big-crate roll stays per spawn), Proposed (*unreviewed*: the rest)*
- **Supersedes** D-31's spawn timing (a chance every `SPAWN_INTERVAL` = 3 ticks, rolling one
  open color) and D-21's random color per spawn. D-31's cap (`crateCap(size)` plus one per
  milestone) stays as it was.
- **Alternatives:** the shared board clock it replaces (D-31); a cycle of only the open colors
  (a 1-color board would spawn every tick); reshuffling at each milestone or each round;
  holding a blocked slot until it can spawn (retry).
- **Why:** the designer asked for it. The rate now follows the colors that are open: one color
  gets a crate every 4 ticks, four colors a crate every tick, one of each per round, so a new
  color adds work instead of splitting the old line's crates. The order is fixed for the game,
  so the stream has a rhythm a player can learn and plan around, and it's seeded, so a game
  still reproduces (R-21, R-22).
- **Unreviewed calls:** (1) The starting color is still `Rando.choice(CRATE_COLORS)`,
  independent of the cycle; the shuffle draws from `Rando` right after it, so every seed's
  game after map generation differs from before (maps and `knownGoodSeed` don't change). The
  starting color's next crate comes when its slot comes round, 1 to 4 ticks in. (2)
  `spawnSlot` is the slot the *next* tick takes, so the first tick takes slot 0. (3) Skip, not
  retry, as the task suggested: a retry variant (hold the slot while its open color is capped
  or blocked) measured the same on small (first milestone median 52, fifth 238) and worse on
  medium (`cc-sim-to 50 medium 3`: 14 of 50 reached the third against 17, 18.5 crates lost
  against 7.6), because one jammed color stalls every other color behind it. (4) The checks
  run open color, then the cap, then a clear source; the big-crate roll happens only when a
  crate spawns, so `Rando` isn't touched on a skipped slot. (5) Test fixture: `flatGame()`
  holds spawns off with a one-slot cycle `[null]` (never an open color) in place of the old
  far-negative timer; spawn tests set their own cycle. (6) `test/sim.js` now prints `at cap`,
  the share of ticks the board sat at `crateMax()`. (7) No number retuned: the first
  milestone on small comes later (median 45 → 53), and `FIRST_MILESTONE`, the cap and the
  deck are left for the designer.
- **Is the cap binding constantly on big boards?** Not constantly, but most of the time once a
  second color opens: 54-63% of ticks on medium, large and huge past the first milestone
  (44-69% before), 0% before the first milestone on every size (one color now spawns less
  often than the old clock). The bot routes only the first color, so on bigger boards the
  unrouted colors' crates fill the board up to the cap whatever the spawn rule; it says more
  about the bot than about play. Not retuned here.
- **Evidence:** R-19 (shuffle, one slot a tick, closed slot, skip on cap or blocked source,
  every color open = a crate a tick), R-6, R-26, R-52. `Measured by: just cc-sim` and
  `just cc-sim-to`, before → after (seeds 5000+):
  - `cc-sim 200 small`: median 45 → 53 (p10 41 → 48, p90 51 → 58), lost/game 0.61 → 0.63,
    crates on board mean 4.5 → 3.6, peak 8 both.
  - `cc-sim-to 100 small 5`: all 100 reach the fifth both ways; median 183 → 236 (p10 157 →
    207, p90 210 → 262); milestones 44 / 67 / 90 / 127 / 183 → 53 / 79 / 112 / 159 / 236;
    big crates/game 18.8 → 18.4; lost 3.14 → 3.84; at cap 1% → 0%.
  - `cc-sim 100 medium`: median 51 → 60 (p10 46 → 53, p90 57 → 69), lost 0.93 → 0.95, mean
    6.0 → 4.9 crates.
  - `cc-sim-to 50 medium 3`: reached the third 25 → 17 of 50; milestones 50 / 87 / 137 (50 /
    36 / 25 games) → 60 / 88 / 126 (50 / 23 / 17); lost 8.28 → 7.56; mean 11.4 → 11.9, peak
    14 both; at cap 44% → 62%.
  - `cc-sim-to 30 large 3`: reached the third 11 → 9 of 30; milestones 66 / 98 / 160 (30 / 27
    / 11) → 75 / 115 / 148 (30 / 15 / 9); lost 19.6 → 14.4; mean 17.7 → 17.2, peak 20 both;
    at cap 69% → 63%.
  - `cc-sim-to 20 huge 3`: reached the third 11 → 9 of 20; milestones 118 / 132 / 206 → 124
    / 153 / 213; lost 40.2 → 46.1; mean 31.3 → 31.8, peak 38 both; at cap 54% both.
  Past the first milestone the bot ignores new colors, and they now flood faster (a second
  color gets a crate every 4 ticks, against every 6), so fewer bot games reach the later
  milestones on medium and up. Unmeasured in play.

### D-44 A new source or target takes its hex, clearing whatever stands there — *Decided 2026-11-13 (pjpd port-clears-kh58: candidates for a new source (left slice) or target (right slice) no longer exclude hexes with a Thing or a piece, only existing sources and targets; the target still needs a land path from its source; the pick is uniform, no preference for empty hexes; on reveal a Thing is removed with no card back, a gremlin is destroyed and counts as an ex-gremlin (not trapped), a crate of any color is destroyed and counts as lost, on a source or a target; an enhanced source changes nothing on the board; `open{color, source, target}` unchanged, no new overlay), Proposed (*unreviewed*: the rest)*
- **Supersedes** D-21's Proposed placement on free hexes and "nothing opens when there's no
  free hex": a color now fails to open only past the cap or when no right-slice hex is
  reachable by land from its source.
- **Alternatives:** the free-hex rule it replaces (a built-up or crowded end slice could leave
  no spot, and the color, with its unlock-gated cards, waited for the next milestone);
  preferring empty hexes and clearing only when none is left; pushing what's there aside.
- **Why:** the designer asked for it. A color always opens when the milestone says it does,
  however much the player has built in the end slices, and the new endpoint is a small
  disaster where it lands, which suits the game's comedy (G-2): a belt line or a crate in
  transit can be wiped by the factory's own growth.
- **Unreviewed calls:** (1) Events: a Thing's removal is a new `clear{kind, q, r}` event (not
  `remove`, which is a command's name); a destroyed piece reuses `splat{id, by: null, trap:
  false, hop}`, so the UI's existing fade and splat sound play it with no client change (Things
  are drawn from state, so the cleared Thing and the new endpoint simply appear at the start of
  the animation). (2) Order: the clears follow their `open`, the new source's hex first, then
  the target's, each hex's Thing before its piece.
  (3) The splat's `hop` is the tick's last hop, so a piece that moved onto the hex this tick
  arrives first, then fades. (4) A cleared gremlin re-emerges on the shore like every other
  gremlin that splats (D-14's steady population). To make that and the tally work, the tick
  now runs milestones before its tally and emerge (state order), while their events still come
  last, after the emerge's spawns, so R-31's "spawn before the milestone" holds; a cleared
  gremlin's own `spawn` therefore comes before the `splat` that caused it, which the client
  doesn't care about. Running emerge after openColor also means a gremlin that climbs out this
  tick can never be the one a new endpoint clears (it isn't in the client's pre-tick snapshot),
  and the shore it climbs out on already excludes the new endpoints. (5) The emerge's `Rando`
  draws now come after openColor's, so a game that opens a color plays differently from that
  tick on. (6) A crate on its own color's new target is destroyed and lost, not delivered, as
  the spec says ("whatever its color"). (7) `freeEndHexes` renamed `openEndHexes`; `openColor`
  and `reachMilestones` take the splat `hop`; `openColor` returns a list (`[]` when nothing
  opens). (8) `test/sim.js` with a milestone count prints colors opened and endpoint clears per
  game.
- **Evidence:** R-38 (opens with every right-slice hex built on; nothing opens only with no
  reachable hex), R-62 (Thing removed with no card back, gremlin +1 ex-gremlin and re-emerges,
  crate and big crate lost, enhanced source untouched), R-36, R-31. `Measured by:
  just cc-sim-to 100 medium 5`, before → after (seeds 5000+): milestones 60 / 90 / 122 / 172 /
  254 (100 / 50 / 38 / 38 / 38 games) → 60 / 91 / 123 / 172 / 249 (100 / 45 / 34 / 34 / 34);
  lost/game 12.54 → 15.19; mean 11.8 crates both, peak 14, at cap 57% → 56%; big crates
  9.8 → 9.4; colors opened 1.00 per game (every game opens medium's second color);
  0.19 clears per game. `just cc-sim 200 small` is unchanged (median 53; small never opens a
  color). The bot builds only the first color's line, and a new target can now land on one of
  its belts, where it stands as a wrong-color target the bot never routes around; that, and
  the shifted random stream, likely account for fewer games reaching the second milestone.
  Unmeasured in play.

### D-45 Big crates: 1% at the start, 5% by the fifth milestone, then easing toward 1 — *Decided 2026-11-13 (pjpd bigcrate-odd-755q: 1% with no milestones reached, 5% at the fifth, asymptotic to 100% after that, never reaching it; one function of m in artifacts.js with named tunables; `BIG_CRATE_HALF` removed; the per-spawn roll and the value 10 unchanged), Proposed (*unreviewed*: the rest)*
- **Supersedes** D-34's curve, call (2) (p = m / (m + `BIG_CRATE_HALF`): 0, 20%, 33%, 43%,
  50% at m = 0…4) and call (3) (no roll while p is 0). The rest of D-34 stands.
- **Alternatives:** keep m / (m + 4) (20% after the first milestone, 56% by the fifth); a
  logistic through the three points; a slower or faster ratio past the fifth.
- **Why:** the designer found the old curve far too generous early: big crates carried most of
  the advancement from the first milestone on. Now they're a rare treat through the fifth
  milestone and become the main currency only after it, where the 1-2-5 gaps get long.
- **Unreviewed calls:** (1) A straight line between the two early points, 1% + 0.8%·m
  (1, 1.8, 2.6, 3.4, 4.2, 5%), the task's default. (2) Past the fifth, 1 − 0.95·r^(m − 5),
  continuous at 5%, with r = `BIG_CRATE_EASE` = 0.85 (19% at 6, 31% at 7, 42% at 8, 58% at
  10, 81% at 15). Picked by `node test/sim.js 30 small 8` across r: past the fifth milestone
  the gaps run #5→#6 821, #6→#7 798, #7→#8 815 turns at 0.85, roughly flat; at 0.9 the
  seventh comes at 2415 and no game reaches the eighth inside the sim's 3200-turn cap; at 0.8
  and 0.75 the seventh comes at 2146 and 2068. 0.85 holds the gaps steady with no reason yet
  to go faster. (3) A fourth name, `BIG_CRATE_KNEE` = 5, for where the line hands over to the
  easing, so the formula has no bare 5. (4) Every spawn now rolls `Rando`, from the first
  tick: the chance is never 0, so the "no roll while p is 0" guard is gone, and every seed's
  game diverges from its first spawn (the D-3/D-7/D-43 first-milestone baselines shift a
  little: small median 53 → 52, medium 60 → 58). (5) R-52 checks the two end points, strict
  rise and < 1 over m = 0…30 (10^10 crates); in floats the formula reaches exactly 1 near
  m = 230, far past any game, so no clamp.
- **Milestone gaps balloon.** As the task expected, the bot's pace to the fifth milestone
  falls back to about where it was with big crates off (D-34's 49 / 82 / 180 / 342 / 662):
  gaps on small now roughly double each milestone (40, 94, 158, 305 turns) where they held
  near 30. Not retuned here; it bears on the separate idea about how big crates drive
  advancement.
- **Evidence:** R-52. `Measured by:` before → after (seeds 5000+):
  - `cc-sim-to 100 small 5`: all 100 reach the fifth both ways; median 236 → 649 (p10 207 →
    567, p90 262 → 731); milestones 53 / 79 / 112 / 159 / 236 → 52 / 92 / 186 / 344 / 649; big
    crates/game 18.4 → 5.0; lost 3.84 → 3.11.
  - `cc-sim-to 50 medium 5`: reached the fifth 15 → 22 of 50; milestones 60 / 87 / 118 / 178 /
    248 (50 / 21 / 15 / 15 / 15 games) → 57 / 96 / 216 / 365 / 685 (50 / 25 / 22 / 22 / 22);
    big crates/game 8.7 → 2.8; lost 14.84 → 14.08; at cap 57% → 43%. (More games get through
    with fewer big crates, likely the shifted stream and fewer 10-crate losses; the bot still
    routes only the first color.)
  - `cc-sim 200 small`: median 53 → 52; `cc-sim 100 medium`: median 60 → 58.
  - `node test/sim.js 30 small 8` (r = 0.85): 51 / 91 / 189 / 356 / 668 / 1489 / 2287 / 3102
    (6 of 30 reach the eighth inside the 3200-turn cap), 121 big crates/game.
  Unmeasured in play.

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
  `shove`, `splat`, `flies`, `overMountains`, `clears`, `blocks`, `traps`, `colored`, `on`, `weight`), so a new kind is usually a new row, not new code. Each
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
  landed dead so its range stayed exact; since 2026-11-12 every landing skids, the Rocket's and
  the Cannon's too, short ones included, and there's no `skids` flag (D-37). `flies` is a
  template field, so both throwers share one rule. Since 2026-11-12 a Spring also clears mountains
  (`overMountains`, D-35); a Rocket doesn't.
- **Evidence:** R-14, R-15. `Measured by: just cc-sim 200 small` (Bridge weight 1): 187/200
  reach the first milestone, median 51, p90 76, 0.17 lost per game, against 187/200, median
  51, p90 75, 0.14 lost with Springs that land dead. The bot places Springs only on straight
  land runs, so it rarely meets the difference.

### D-6 One `step` for everything; ice slides for free; open water sinks — *Proposed*
- **Alternatives:** separate handlers for springs, ice, and gremlins.
- **Why:** one code path means gremlins, springs, and slides can never disagree. Ice is the
  windfall terrain: a crate that skids across three ice hexes covers ground no belt paid
  for. Water is the cost of getting it wrong. *(2026-11-12, D-38, *unreviewed*)* `step` is gone; the one
  code path is now the lockstep hop loop, where each phase of a motion arrives and stops by one
  dispatch table, so the rule holds in a new form.
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

### D-15 The Rocket: flies the piece on it up to 8 hexes, over inland water, and splats gremlins — *Decided (range 8, over inland water, splats both ways, splats re-emerge), Proposed (weight 1, lands on the splatted hex, sinks if it comes down on water); ice skid on landing Decided 2026-11-12 (D-37)*
- **Alternatives:** unlimited range (until something stops it); a long Spring that sinks in
  any water; splat only the gremlin it hits; splat only a gremlin it launches; splatted
  gremlins gone for good.
- **Why:** the designer asked for it, splatting both ways, with splatted gremlins coming
  back like drowned ones (D-14), and flying over inland water so only the outer sea ends a
  flight early. An unlimited flight felt like cheating, so the designer capped its range at
  `THINGS.ROCKET.push`. It's `push` with `flies` on the shared push, so a flight obeys the
  step rule apart from that: blocked stops it, the outer sea sinks it, the target delivers
  it, movers and Bridges are just ground. Airborne, it counts every hex and ice doesn't slide
  it, so its range is exactly what the card says. *(2026-11-12)* Once it comes down on ice or
  a Slide it skids on, like a Spring's throw, even from a short landing, unless it splatted a gremlin (D-37); the 8 hexes in the air are still exact. A flight that ends over a lake comes down in
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

### D-27 The Bridge is a Belt over water — *Decided (it pushes the piece on it along its facing), Proposed (the rest; reviewed and accepted 2026-11-12)*
- **Alternatives:** a plain deck (the old rule: a piece pushed onto it just stopped there);
  a Bridge that carries a piece onward in whatever direction it came on (no facing, but it
  needs to remember each piece's last move); a separate Belt-on-water kind.
- **Why:** the designer asked for it. A crate that reached a Bridge stopped dead, so every
  crossing needed a Belt line that couldn't be built on water: in practice a Bridge was
  only useful under a Spring's flight. Giving the row `push: 1` makes it a mover like any
  other: `aims` turns it, the ghost and the selection arrow show its facing, and the tick
  runs it through the same `push`/`step`. No engine code knows about Bridges.
- **Calls (reviewed 2026-11-12):** (1) It pushes on the ground (`flies: false`), so a Bridge aimed at
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

### D-28 Placing on a Thing replaces it — *Decided (replace in one command and one tick), Proposed (the rest; reviewed and accepted 2026-11-12)*
- **Alternatives:** keep occupied hexes illegal (the old rule: `D`, then place, two ticks);
  replace but refund the old Thing as a card; let the new Thing keep the old one's slot in
  placement order.
- **Why:** the designer asked for it. Rebuilding a hex cost a `remove` tick plus a `place`
  tick, and a crate on the hex could wander off or sink in between. `canPlace` simply stops
  looking for a Thing; `place` takes the old one out before it pushes the new one. No
  engine code knows which kinds are involved.
- **Calls (reviewed 2026-11-12):** (1) `remove` stays its own command, for clearing a hex without
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

### D-29 The Slide is ice you can build — *Decided (a placeable Thing that slides like ice, buildable on water like a Bridge), Proposed (the rest; reviewed and accepted 2026-11-12)*
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
- **Calls (reviewed 2026-11-12):** (1) A Slide builds on land or water (never mountain), so it's the only
  kind that can replace a Bridge on water and also go on land. *(Added later 2026-11-12,
  pjpd slide-no-ice-nrq5; decided: never on bare ice; the rest of this addition is *unreviewed*.)*
  Its `BUILDS_ON` entry is now `on: 'unslick'` (plains or water). Ice
  already slides, so a Slide there would do nothing, and a card spent on it is a wasted turn;
  leaving ice out of the highlight tells the player that up front. It's the terrain rule, not a
  kind check, so it also stops a Slide replacing a Thing standing on ice (the hex is judged as
  bare, D-28). It was `on: 'both'` (plains, ice or water) before. (2) No facing: it keeps a piece going whichever way it came on, so it
  doesn't `aim`, can't be turned, and moves nothing standing on it (a crate spawned or stopped
  on one stays put). (3) A Spring that comes down on a Slide skids on, as on bare ice (the
  landing skid reads `isSlick` too); since 2026-11-12 a Rocket does too (D-37); Slides under a
  flight don't count as a shortcut. (4) It's white and slides gremlins too; gremlins may wander onto a water Slide
  (it's covered water) and then slide on, possibly into the lake. (5) Weight 2, as a Wall or Spring
  (decided: the designer raised it from 1, pjpd slide-weight-6ibn, 2026-11-12; at weight 1, as a
  Bridge, Slides felt rare, since they only join the deck after Pushers and Pullers, D-30). (6) A line of Slides across a lake carries a crate over in one tick, and a single
  water Slide whose far side is open water drops the crate in, like ice running into a lake.
  (7) Glyph: three white ice streaks on a pale-blue slab, no arrow.
- **Evidence:** R-48, R-8, R-14. `Measured by: just cc-sim 200 small` → 200/200, median 51
  (was 50), p90 62 (was 60), 2.61 lost per game (was 2.60); `just cc-sim 50 medium` → 50/50,
  median 63 (was 60), p90 77 (was 70), 4.26 lost (was 3.58). The bot discards Slides, so the
  shift is belts drawn slightly less often. Weight 2 (2026-11-12): `just cc-sim 200 small` →
  200/200, median 49, p90 58, 2.08 lost; `just cc-sim 50 medium` → 50/50, median 61, p90 70,
  3.50 lost, both unchanged, since the Slide isn't in the deck before the first milestone.
  No Slide on ice (2026-11-12): `just cc-sim 200 small` → 200/200, median 45, p90 51, 0.61
  lost, unchanged for the same reason. Unmeasured in play.

### D-30 Cards unlock one step per milestone — *Decided (gradual unlock, order Belt/Bridge/Wall/Trap, then Pusher+Puller, Slide, Spring, Rocket, then the Cannon last (added 2026-11-12, D-36); hand kept), Proposed (the rest; reviewed and accepted 2026-11-12)*
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
- **Calls (reviewed 2026-11-12):** (1) Cards already in hand stay as they are (the designer's default);
  new kinds come through later draws, discards and idle redraws, so the first one can take a
  few turns to appear. (2) On a board that can never open a second color (small), a step made
  only of `colored` kinds is passed over: the milestone unlocks the next step instead, and
  the passed-over kinds count as unlocked but the D-22 gate still keeps them out of the deck.
  Announcing Pushers and Pullers there would promise cards that never come. The test is data
  (`everDealt`: not `colored`, or `MAP_SIZES.colors > 1`), not a kind check. On a bigger board
  the Pusher/Puller step lands on the same milestone that opens the second color, so they
  arrive when they become useful; if that color can't open (for want of a free hex, since D-44 only of a reachable one), they're
  announced but stay gated until it does. (3) The `unlock{kinds}` event follows its
  milestone's `open`. (4) The UI shows one panel for both, the old new-color panel grown into a
  news panel (overlay `news`): a swatch per color, a card picture per kind, and each kind's
  verb line; it holds play until a click or any key, like the color panel did. A small
  board's first milestone now opens it (for the Slide). (5) Past the last step (a small board
  at 100, a bigger one at 200, since the Cannon joined, D-36) milestones unlock nothing. (6) *(2026-11-12, reviewed 2026-11-12)* The
  designer asked for the milestone report to show the cards it unlocked, so the milestone
  banner now carries a small picture and name per card, and a tick that crosses several
  milestones (big crates, D-34) shows one banner for the last one ("passed 50 and 100")
  naming every card unlocked. The news panel now opens only when a color opens; it still
  lists that tick's cards with their verb lines, since play has stopped anyway and the verb
  line teaches the card. A cards-only milestone (every small-board milestone, and the later
  ones on bigger boards) no longer stops play: the banner already says it, and the card's
  verb line is on its hover and in the hand. Alternatives: keep the panel for cards too
  (two reports of one fact, and Go stops for news the banner already gave); drop cards from
  the panel even with a color (the color panel would then hide the only place the verb
  lines appear at unlock time). This partly reverses (4)'s "a small board's first milestone
  now opens it".
- **Evidence:** R-49, R-27, R-6, R-26; U-11, U-23 (manual); `test/integration/uiboot.js`
  checks the first-milestone banner names the Slide with no panel, and a two-milestone tick
  names both cards on one banner. `Measured by: just cc-sim 200 small` →
  200/200, median 49 (was 51), p90 57 (was 62), 2.08 lost per game (was 2.61);
  `just cc-sim 50 medium` → 50/50, median 61 (was 63), p90 69 (was 77), 3.42 lost (was 4.26).
  The bot only measures the first milestone, where the deck is now Belt-heavy (6 of 10
  weight, was 6 of 15): it never sees a Spring before then, but it gets more Belts, so it's a
  little faster. No numbers retuned. Unmeasured in play.

### D-31 Crates spawn up to a cap that grows with the square root of board area and by one per milestone — *Spawn timing superseded 2026-11-13 by D-43 (a fixed color cycle, one slot a tick; the cap stands); Decided (a cap growing with √area, settled 2026-11-12; a chance every third tick, +1 per milestone reached), Proposed (the rest; reviewed and accepted 2026-11-12)*
- **Alternatives:** the fixed timer it replaced (`SOURCE_INTERVAL`: a crate every 3 ticks
  whenever the rolled source was clear, retried every tick while jammed); a cap per color or
  per source; a cap with a fixed base plus a per-area term; storing a bonus counter in state;
  a cap linear in area (the first version, now history; see ARCHITECTURE_LOG.md).
- **Why:** the designer asked for it (pjpd crate-cap-hybj). Under the timer a stalled line kept
  pouring crates onto the board until every source jammed; a cap makes a big factory's crate
  population follow the board and the player's progress instead. The cap is
  `crateCap(size)` = max(1, round(`CRATE_CAP_PER_ROOT` × √(cols × rows))), plus
  `milestonesReached(delivered)`: one more per milestone (10, 20, 50, …), so a tick that
  crosses several milestones (`reachMilestones`) raises it by each.
- **Why square root (settled by the designer 2026-11-12):** a linear cap was tried first,
  max(1, round(area / `CRATE_HEXES_PER_CAP` = 20)): small 8, medium 20, large 45, huge 180.
  Before the first milestone the bot peaked at 8 / 14 / 20 / 42 crates on those boards, so
  only small's cap ever bound and large and huge were effectively uncapped. A √area cap grows
  with the board's width (roughly how long a line is) rather than its area, so a big board
  holds more crates but still meters them.
- **Calls (reviewed 2026-11-12):** (1) The bonus is derived from `delivered`, not stored: the 1-2-5
  series already says how many milestones a count has reached, so state keeps only
  `spawnTimer`. (2) `spawnTimer` now resets on every chance, spawn or not; a jammed source (or
  a full board) waits for the next chance, three ticks on, rather than retrying the next tick
  as the old timer did. It keeps "every third tick" literal and makes the rhythm steady.
  (3) One cap for the whole board, counting every crate of every color, as one board clock
  already did (D-21); a chance rolls one open color and spawns nothing if that source is
  occupied (no reroll to another color). (4) Gremlins don't count toward the cap. (5)
  `CRATE_CAP_PER_ROOT` = 0.6 keeps small at 8 (0.6 × √160 = 7.6) and gives medium 12, large
  18, huge 36. These now bind on every board (the bot's peaks before the first milestone
  drop to the caps), yet the first milestone comes no slower on any size; the cap is still
  meant to bite most later, when several colors run and lines back up.
- **Evidence:** R-19. `Measured by: just cc-sim` (sim prints mean and peak crates on the
  board). Linear cap (vs the old timer), before → after: small 200 games median 49 → 49
  (p10 43 → 43, p90 57 → 58, 2.08 lost/game both); medium 200 games median 60 → 61 (p90 71 →
  70); large 100 games median 81 → 79 (p90 93 → 96); huge 50 games median 143 → 143 (p90 168
  → 174). Linear → √area (2026-11-12), first milestone: small 200 games median 49 → 49, peak
  8 → 8; medium 200 median 61 → 61, peak 14 → 12; large 100 median 79 → 79 (p90 96 both),
  peak 20 → 18; huge 30 median 143 → 143 (p90 163 → 166), peak 42 → 36. `just cc-sim-to 30
  SIZE 5`: small unchanged (milestones at 51 / 75 / 107 / 147 / 209); medium 61 / 91 / 124 /
  196 / 346 → 61 / 91 / 147 / 205 / 357, peak 20 → 14, with 18 → 19 of 30 games reaching the
  fifth (the bot builds only the first color's line). Unmeasured in play.

### D-32 The player picks a Pusher or Puller's color when placing it — *Decided (cards drawn plain, color picked at placement and kept for good, one color skips the picker), Proposed (the rest; reviewed and accepted 2026-11-12)*
- **Alternatives:** the color rolled with the card at draw time (the old rule, D-22 before
  this); a separate free command to color a placed white Thing, like `rotate`; recoloring a
  placed Thing for free; a white Pusher or Puller that acts on everything until colored.
- **Why:** the designer asked for it (pjpd color-picker-8h4x). A random color made the rare
  sorter card a lottery: a red Pusher when the blue line is the one to split was as good as
  a discard. Picking at placement keeps the card rare and the decision the player's.
- **Calls (reviewed 2026-11-12):** (1) The pick is part of the place command,
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

### D-33 A bump on ice advances the line two and the bumper follows — *Decided 2026-11-11 (a piece standing on slick ground passes the motion on); Decided 2026-11-12 (flights bump too; the line advances 2 and the bumper ends one past the bumped hex, for every mover); Proposed (the rest; reviewed and accepted 2026-11-12)*
- **Alternatives:** keep every piece a plain blocker (the original rule); the 2026-11-11 rule
  (the bumper stops dead, the bumped piece goes one hex and slides on, chains allowed); the
  bumper stops in place while the line advances; the bumper takes the bumped hex (the line
  advances 1); bump on any ground, not just slick; flights come down short instead of bumping.
- **Why:** the designer asked for the bump (pjpd bump-6nee) so ice feels like ice, and on
  2026-11-12 settled its outcome, for every mover (Belt, Bridge, Pusher, Puller, Spring,
  Rocket, ice slides, gremlins): the line starting at the bumped piece advances 2 hexes, and
  the bumper ends 1 hex past the bumped hex, right behind it, so the bumped hex is left empty.
  In the designer's words: "if the crate stopped in place the line would slowly back up. If it
  replaced the item it hit, it would form a lasting barrier. Having the line advance 2 and the
  item move 1 past the bump slowly moves things along." Springs and Rockets bump too (designer,
  2026-11-12): a flight that runs into a piece on slick ground bumps it like any other mover.
  It's one helper, `bump(piece, dir, moved, byAt)`, called wherever `push` gets a `'blocked'`
  that didn't hit anything, in the air or on the ground; the line and the bumper move with the
  same `step` as everything else, so water, targets, Traps and Walls work on them unchanged,
  and no kind is special-cased. The advance is `BUMP_ADVANCE` in `artifacts.js`.
- **Calls (reviewed 2026-11-12):** (1) The advance is a fixed 2 hexes with no ice slide afterward ("advances
  2"). Each step still resolves terrain: open water sinks (`lost` += value), its color's target
  delivers, a gremlin dies on a Trap or a target, and a Wall, mountain, other color's target or
  the map edge stops it. (2) A line blocked part way moves as far as it can: the far end steps
  first each hex, so the pieces compress behind the blocker, each stopping behind the one
  ahead. The bumper follows as far as the bumped piece went (0, 1 or 2 hexes), through `step`,
  so it ends right behind it, never moves backward, and stays put if the line couldn't move.
  If the bumped piece sank or was delivered, the bumper still stops where it would have stood
  behind it, short of the water. (3) Only the bumped hex needs to be slick: the trigger is "a
  puck on the ice", and the queue behind it moves whatever its ground, so a backed-up line
  that spills off the ice still creeps along. Requiring every hex to be slick would let one
  plains hex anywhere in the queue turn the bump back into a dead stop. (4) The line runs from
  the bumped piece through each piece right behind it in the bump's direction, and ends at a
  gap or at a piece that already moved this tick (that one is just a blocker, so nothing moves
  twice). Every piece in the line counts as moved, even one that couldn't budge, and the
  bumper already has (R-13). Line pieces step plainly and don't bump on, so the old chain
  reaction is gone; a line replaces it. (5) Precedence is unchanged: a gremlin's own step into
  cargo wrecks it, and a Rocket splats a gremlin in its path, before any bump. A carried
  gremlin bumps; a gremlin in a line is pushed along like a crate (onto a Trap, into a lake).
  (6) A flight that bumps follows the same way, on the ground, and the bump ends it: whatever
  range is left is spent. The follow hexes are ones the bumped piece just crossed (or the
  bumped hex itself), so the landing rules have nothing left to catch; a flight whose line
  couldn't move comes down short, where it was stopped, as before. A Spring's skid bumps the
  same way. (7) Events: line moves carried `by` (the bumper) and `byAt` (how many hexes of its
  own path the bumper had entered at contact); both were null on every other move
  (*superseded 2026-11-12, D-38, *unreviewed*: moves carry a start `hop` instead*). The bumper's
  `move` comes first and includes its follow hexes. The client holds each line piece until the
  bumper reaches the contact hex, then the line and the bumper go on together, the bumper one
  hex behind, which reads as a shove.
- **Evidence:** R-51, R-12, R-26, R-32. 2026-11-12 rule: `just cc-sim 200 small` → unchanged
  (200/200, median 49, p90 58, 2.08 lost); `just cc-sim 50 medium` → 50/50, median 61, p90 70
  (was 72), 3.50 lost (was 3.60); `just cc-sim-to 30 small 5` → milestone 5 at median 208
  (was 209), 24.83 lost per game (was 26.40). The bot builds belts and springs in a straight
  line, so bumps only come up where a crate stalls on ice in it. Unmeasured in play.
- **In lockstep (2026-11-12, D-38; settled by the designer: bumps start mid-tick; the rest *unreviewed*).** A bump is
  motion that starts on the contact hop: the line (the bumped piece and the pieces right behind
  it that have had no motion this tick) starts advancing `BUMP_ADVANCE` hexes that hop, all
  together, and the bumper waits that hop and follows from the next, ending right behind it.
  The line compresses against a blocker by the usual hop resolution (the far end is blocked,
  the piece behind finds it staying). Only a piece with no motion this tick can be bumped: one
  that moved, or was blocked, is just a blocker; a gremlin boxed in (no wander) can be bumped.
  The client no longer needs `by`/`byAt` to hold the line: each move's `hop` says when it
  starts. `bump`/`advance`/`follow` are gone; the line and follow are phases of the one motion.

### D-34 Big crates, worth 10, grow more likely with each milestone — *Decided (a crate worth 10 deliveries whose share of spawns rises toward 1), Proposed (the rest; reviewed and accepted 2026-11-12)*
- **Curve superseded by D-45** (2026-11-13): calls (2) and (3) below are history; the chance is now 1% at the start, 5% at the fifth milestone, then easing toward 1, with a roll on every spawn.
- **Alternatives:** a `value` field on each crate piece instead of a kind; p = 1 − (1 −
  base)^m; make later milestones closer together; spawn faster per milestone.
- **Why:** the designer asked for it (pjpd big-crate-jat8). The milestones run on the 1-2-5
  series, so the gap between them grows about tenfold per three milestones while a line
  carries crates at a steady rate: without help, milestone 5 (100) takes the bot ~660 turns on
  small, and each one roughly doubles the wait. Big crates raise what a crate is worth as the
  factory matures, so the payoffs keep coming without changing the series. It's data, not a
  code path: a new `PIECES` row `bigcrate` with `value: 10` (crate 1, gremlin 0), read by the
  one place each count changes (`step`'s delivery, the new `loseValue(piece)` for sinks,
  wrecks and blasts). Everything else keys on `cargo`, so a big crate is a crate.
- **Calls (reviewed 2026-11-12):** (1) A kind, not a per-piece field: templates already carry the
  per-kind numbers, the client's draw and hover tables dispatch on `kind`, and saves need no
  new field. (2) The formula is p = m / (m + `BIG_CRATE_HALF`) with `BIG_CRATE_HALF` = 4,
  read as "half the spawns are big at the fourth milestone (100)": 0 before the first, 1 in 5
  after it (10), 1 in 3 after 20, 3 in 7 after 50, and 9 in 13 by 5000. The exponential
  candidate gets to 1 faster than this one, and this one's constant is easier to read. At
  m = 1 big crates are uncommon (a few per milestone), and they're the norm past m = 4.
  (3) No roll while p is 0: before the first milestone `spawnKind()` doesn't touch `Rando`,
  so early games (and the first-milestone sim baselines in D-3, D-7) are unchanged. (4) A big
  crate counts as one toward the cap (D-31): the cap meters congestion, and a big crate takes
  one hex like any crate. (5) It behaves as a crate everywhere else: Belts, Springs (3) and
  Rockets (8) move it as far, it isn't splatted, it slides and is bumped (D-29, D-33), only
  its color's target takes it, and a gremlin's step wrecks it. Losing one costs its full value
  (sunk, wrecked or blasted: `lost` += 10), so a big crate near a gremlin or a lake is worth
  guarding, and blasting one to clear a jam is an expensive call. (6) `delivered` and each
  target's count add the value, so the tally, progress bar and per-color counts read in crate
  units with no UI change; `lost` too. (7) A delivery can cross several milestones (two big
  crates from 9 crosses 10 and 20): `reachMilestones` already handles each in turn, and R-52
  checks the order. (8) The client draws it as the same isometric box at `BIG_CRATE_SCALE`
  (1.5) times the size, and names it "Big crate — worth 10" on hover.
- **Evidence:** R-52, R-19, R-16. `Measured by: just cc-sim 200 small` → unchanged (200/200,
  median 49, p90 58, 2.08 lost); `just cc-sim 50 medium` → unchanged (50/50, median 61, p90
  72, 3.66 lost). On to the fifth milestone, `just cc-sim-to 100 small 5` → median turn per
  milestone 49 / 76 / 104 / 139 / 199, ~20 big crates spawned per game (with big crates off:
  49 / 82 / 180 / 342 / 662); `just cc-sim-to 30 medium 5` → 61 / 91 / 124 / 196 / 346 (off:
  61 / 103 / 320 / 669 / 1332; the bot builds only the first color's line, so some medium
  games stall). Gaps between milestones stay near 30 turns on small instead of doubling.
  Unmeasured in play.

### D-35 A Spring's throw clears mountains: over two, landing on the third — *Decided 2026-11-12 (a Spring can cross 2 mountain hexes, landing on the third), Proposed (the rest; reviewed and accepted 2026-11-12)*
- **Alternatives:** a kind check on `SPRING` in `step`; a per-terrain "flight clears" set
  on each template; mountains clearing every flight, the Rocket's too; a throw that ends over
  a mountain bouncing back to the Spring (no throw) instead of landing short.
- **Why:** the designer asked for it: "Make it so a Spring can cross 2 mountain hexes,
  landing on the third." Before, a mountain stopped every flight like a Wall (`canEnter`), so
  a Spring facing a ridge came down short of it. Its range is 3, so it can now fly over up to
  two mountains and land on the third hex, which makes the Spring the one card that crosses a
  ridge, as the Bridge is the one that crosses a lake.
- **Calls (reviewed 2026-11-12):** (1) Data, not a kind check: a new template flag `overMountains`
  (true only for the Spring), carried in the push's `how` like `flies`. `step`
  takes `air` = `{flies, overMountains}` (the `how`, or a frozen `GROUND` for skids, bumped
  lines and followers) and lets a mountain through when `overMountains` is set. A per-terrain
  set would be more general than the one terrain asked for. (2) The Rocket is unchanged
  (still stopped by mountains): the designer named only the Spring, and an 8-hex flight that
  clears ridges would make mountains meaningless to it. Flip its flag to try it. (3) Landing:
  a flight can't come down on a mountain. One that ends over a mountain (full range, or
  stopped there by a Wall or a piece) comes down on the last hex short of it that it flew
  over, or doesn't leave the Spring if there's none (mountains on all three hexes: no throw,
  no `move`). That generalizes the old "a flight can't come down on another color's target:
  one hex short" rule into one loop over `canLand(piece, hex)` (not a mountain, not another
  color's target), backing up along the path. That matches the short-landing the old code
  did when a mountain stopped the throw: mountain on the 3rd hex, it lands on the 2nd, as
  before. Then the usual landing checks run on the hex it came down on (sinks on inland
  water, dies on a Trap); a short landing doesn't skid, like a blocked throw today (*superseded 2026-11-12, settled by the designer: every landing skids, short ones too, D-37*). *(2026-11-12)* The loop is now `comeDown`, shared with the Cannon's landing (D-36). (4) Walls
  still stop a Spring's flight, mid-air or not, as before (a Wall is a built obstacle, a
  mountain is terrain it's thrown over). (5) Pieces in the path are unchanged: a piece on
  plains stops the flight, one on slick ground is bumped (D-33); a bumper stopped over a
  mountain whose line can't move comes down short of the mountain. (6) The invariant "no
  piece on a mountain" holds between commands; mid-push a flying piece's position may be a
  mountain hex, and its `move` path never ends on one. (7) The bot (`test/sim.js`) is
  unchanged: it lays Belts along a land-only shortest path and uses a Spring only as a
  stand-in on a straight land run, and Springs aren't dealt until a few milestones in
  (D-30), so planning mountain hops would need a new planner for little measured effect.
- **Evidence:** R-53, R-7. `Measured by: just cc-sim 200 small` → unchanged (200/200, median
  49, p90 58, 2.08 lost); `just cc-sim 50 medium` → unchanged (50/50, median 61, p90 70,
  3.50 lost); `just cc-sim-to 30 small 5` → unchanged (51 / 75 / 105 / 147 / 208). The bot
  never throws toward a mountain. Unmeasured in play.
- **In lockstep (2026-11-12, D-38; settled by the designer: landing trimmed at launch; the rest
  *unreviewed*).**
  Mountains and targets don't move, so a flight's length is fixed at launch: up to its range,
  stopping before the map's edge, a Wall or a mountain (unless `overMountains`), then trimmed
  back off a trailing mountain or other color's target (`flightLength`). The flight then spends
  one hop per hex. A flight stopped mid-air by a piece while over a mountain or another color's
  target drops back on the next hop to the last hex it may land on (*unreviewed*: the old rule
  did it instantly; D-38 call 3).

### D-36 The Cannon: over 4 hexes of anything, then a ground step into the 5th — *Decided 2026-11-12 (a facing mover, range 5; the first 4 hexes ignore all terrain and items: water, mountains, Walls, pieces, gremlins, no splat; the 5th an ordinary ground step that can be blocked, bump, sink, deliver, be stopped by another color's target or trigger a Trap; blocked there, down on the 4th if that's a legal landing, else no fire; the last unlock, after the Rocket; low weight like the Rocket's; data-driven, sharing the flight code), Proposed (the rest; reviewed and accepted 2026-11-12)*
- **Alternatives:** a kind check on `CANNON` in `push`; extending `step`'s `air` with a
  "clear everything" flag (every caller would carry it); a Cannon that `flies` for its whole
  range (it would cross inland water on the 5th and never bump as a ground mover); a blocked
  5th hex backing up to any earlier hex, as a Spring's throw does (D-35).
- **Why:** the designer asked for it (pjpd cannon-card-93j7) and set the rule on 2026-11-12.
  The Spring hops lakes and ridges and the Rocket shoots far, but nothing jumps the things a
  player builds or the pieces jammed on a line. The Cannon jumps all of it for a fixed 4
  hexes and then behaves like a Belt on the 5th, so it lands where you can read it.
  Data, not a kind check: a template field `clears` (4 for the Cannon, 0 for every other
  kind) says how many hexes at the start of the push go through `passOver` (only the map's
  edge stops it; nothing on the hex is consulted or touched) before the rest goes through
  `step` with the template's own `how` (`flies` false: the ground). The landing reuses the
  Spring's D-35 path: `comeDown` backs a flight up to the last hex it may land on, and for a
  shot only the last cleared hex counts. One loop sets down a Spring short of a ridge, a
  Rocket short of a wrong target and a Cannon on its 4th hex.
- **Calls (reviewed 2026-11-12):** (1) *Off the map:* a shot whose 4 cleared hexes run off the board
  doesn't fire (the step-back rule's "else no fire", applied to a path with no 4th hex). The
  outer sea is on the map, so it's passed over like any water; a 5th hex in the sea sinks it,
  a 5th hex off the map is a block (down on the 4th, which in the sea can't take it: no fire).
  (2) *A target on the 4th hex:* coming down there on its color's target delivers it, as every
  other arrival on its own target does (a flight crossing it mid-air, a ground step); another
  color's target can't be landed on, as for every flight (D-21), so the Cannon doesn't fire.
  Targets under hexes 1–3 are passed over unchecked, own color included: "ignores all terrain
  and items". (3) *The legal 4th:* `canLand` on a cleared hex also wants no blocking Thing, no
  other piece and no open water (a Bridge or a Slide covers it); bare ice or a Slide there
  takes it, and skids on from there (*settled 2026-11-12: every landing skids, D-37*; the 5th hex that blocked it stops the skid at once); a Trap there catches a
  gremlin, and a gremlin coming down on a target dies, like any landing (D-18, D-23). (4) *The
  5th hex onto slick ground slides on:* "an ordinary ground step" is a Belt's, and a Belt's push
  onto bare ice or a Slide keeps going. Since 2026-11-12 every landing skids (D-37); that
  ground slide is its skid, and it happens once (past its cleared stretch the shot isn't aloft, so
  no landing skid follows). (5) *A bump at the 5th:* contact is at `byAt` 4; the
  shot follows its line on the ground (D-33). If the line can't move, the shot is stopped
  after its cleared stretch and the 4th-hex rule applies. (6) *Pieces passed over* aren't
  moved and aren't marked as moved, so a Belt under one still carries it that tick (R-13 holds:
  only the shot piece moved). (7) *Weight 1*, the Rocket's: both are late, powerful,
  situational cards, and at weight 1 of 17 in the full deck a Cannon is about one draw in 17,
  often enough to plan around once it's unlocked, rare enough that a Belt line stays the
  spine. (8) *Animation:* the `move` path lists all 5 hexes (and any slide or follow), so the
  client hops it like a Spring's or Rocket's flight, one hex per `HOP_MS`; no new event.
  (9) *Look:* a gunmetal tile with a pale barrel on a wheel and a dotted arc from the muzzle;
  verb line "lobs what is on it over 4 hexes of anything, down on the 5th" ("(slides on ice)"
  added 2026-11-12, D-37). (10) The bot
  (`test/sim.js`) discards Cannons: it never sees one before the fifth milestone.
- **Evidence:** R-54, R-49, R-7, R-10; `test/integration/uiboot.js` checks the banner and the
  news panel name the Cannon. `Measured by: just cc-sim 200 small` → unchanged (200/200,
  median 49, p90 58, 2.08 lost); `just cc-sim 50 medium` → unchanged (50/50, median 61, p90
  70, 3.50 lost); `just cc-sim-to 30 small 5` → unchanged (51 / 75 / 105 / 147 / 208). The
  Cannon unlocks at 100 on small (the fifth milestone) and later on bigger boards, past what
  the sims measure. Unmeasured in play.
- **In lockstep (2026-11-12, D-38; *unreviewed*).** The shot spends hops 1–4 over its cleared hexes, unseen:
  pieces move under it and it crashes into no flight. Its ground step into the 5th is hop 5;
  a bump there starts the line on hop 5 (call 5's `byAt` 4 is now that hop). Whether it fires is
  still judged at launch from the board as it stands (*unreviewed*: the 4th-hex `groundTakes`
  check reads pieces as the tick starts). If the 5th is then blocked by a piece and the 4th
  holds a piece by the time it comes down, it crashes (lost); open water there sinks it.

### D-37 Anything that lands, slides: every flight and shot skids on landing — *Decided 2026-11-12 (Rockets and Cannons skid like Springs; settled 2026-11-12: "Basically anything that lands, slides, anywhere. The only exception is hitting a gremlin stops it in that hex", short Rocket landings included; drop the `skids` flag, every Thing that `flies` or `clears` skids), Proposed (the rest; reviewed and accepted 2026-11-12)*
- **Alternatives:** keep the Rocket landing dead (D-15, D-17) so its range is exact; a kind
  check on `ROCKET` in `push`; a Rocket that slides mid-flight on ice (its range would stop
  meaning anything); skidding only from a full-range landing (the first version of this
  decision, superseded); a per-Thing `skids` flag set on all three throwers (dropped: it would
  always equal `flies || clears > 0`).
- **Why:** the designer asked for it twice. First (pjpd rocket-skid-v7ky): "Pieces thrown by a
  Rocket or a Cannon should slide on when they land on ice, the way a Spring's landing skids
  today." Then, settling the exceptions on 2026-11-12: "Basically anything that lands, slides,
  anywhere. The only exception is hitting a gremlin stops it in that hex", and short Rocket
  landings keep pushing too. One rule, no list of exceptions to remember. The skid is a ground
  move after landing (`skid`: `step` with `GROUND`), so it sinks in open water, delivers on its
  color's target, stops at a Wall, a mountain or another color's target, kills a gremlin on a
  Trap, and bumps a line on slick ground per D-33 (the line advances 2, the skidder ends 1 past
  the hit hex). The designer also dropped the `skids` flag (settled 2026-11-12): every Thing
  whose push `flies` or `clears` lands, so every one skids, and the data says so by not having
  a field that could disagree.
- **How:** `push` runs the flight, then `comeDown` (D-35) sets the piece on the hex it may land
  on, then the landing checks (`landingResult`: delivered, sunk, trapped), then `skid` if the
  hex it's on is slick. Because `comeDown` runs first, the piece only ever skids from a hex it
  could legally come down on (the `canLand` guard of the first version is now just the order):
  a flight ending over another color's target on ice comes down short of it, and its skid meets
  that target and stops. The Cannon's slide still happens once: its 5th hex is a ground step
  that slides on in the main loop, and a shot that went past its cleared stretch isn't aloft, so
  `skid` never runs for it; only its 4th-hex fallback (still aloft) skids.
- **Calls (reviewed 2026-11-12):** (1) *Short landings change nothing on the board today.* The hex past a
  short landing is what made it short: the Wall, mountain or piece that blocked the flight, the
  mountain or other color's target it backed off, the Cannon's blocked 5th hex. So a short
  landing's skid stops at once against it; the tests pin that the rule runs and the piece stays
  on the landing hex with each hex once in its `move`. The rule is still worth having as one
  line instead of a list of exceptions, and it will matter if a slide ever turns. (2) *A bumper
  doesn't skid:* a flight stopped by a piece on slick ground bumps it, and the bump ends the
  bumper's motion right behind the line (D-33); skidding on would only meet the line again.
  (3) *A gremlin riding a Rocket* still splats where it comes down instead of skidding first
  ("never survives the landing", D-15); so a Rocket's skid only ever carries a crate. (4) Verb
  lines unchanged: the Rocket's reads "blasts what is on it up to 8 hexes, over lakes, skidding
  on ice; splats gremlins", the Cannon's ends "(slides on ice)"; neither mentioned the old
  exceptions.
- **Evidence:** R-32 (`test/R-32/rocket_skid.js`: a blocked flight onto ice skids into the Wall
  that stopped it; a flight that splats a gremlin stops on its hex), R-53 (a Spring stepped back
  off a mountain onto ice skids into it), R-54 (the 4th-hex fallback onto bare ice or a Slide
  skids into what blocked the 5th; the 5th-hex slide happens once), R-14, R-48. `Measured by:
  just cc-sim 200 small` → unchanged (200/200, median 49, p90 58, 2.08 lost); `just cc-sim 50
  medium` → unchanged (50/50, median 61, p90 70, 3.50 lost). The bot discards Rockets
  and Cannons, neither is dealt before the first milestone, and short landings move nothing
  further. Unmeasured in play.
- **In lockstep (2026-11-12, D-38; settled by the designer: skids hop by hop, every landing still
  slides except after a gremlin splat; the rest *unreviewed*).** A landing becomes a `skid` phase that continues one hex
  per hop from the hop after it lands. Call (1) no longer always holds: a flight stopped by a
  *piece* comes down, and if that piece moves off on a later hop, the skid goes on through the
  hex it left (R-56) instead of stopping at once.

### D-38 Lockstep movement: every moving piece advances one hex per hop, together — *Decided 2026-11-12 (pjpd lockstep-ritf: hop-by-hop lockstep; chains resolve, 3+-cycles rotate, swaps fail, same-hex ties to the earlier Thing; a blocked piece stops for the tick; Pushers/Pullers first and win claims; bumps start mid-tick; skids and flights hop by hop; two airborne pieces meeting in one hex (or swapping) both crash, a flight meeting a ground piece is only stopped; flight landings trimmed at launch; gremlins pick at hop 1; moves carry a start hop and the UI plays by hop), Proposed (*unreviewed*: the rest)*
- **Alternatives:** keep acting one Thing at a time in placement order (the old rule); resolve
  in dependency order (front of each line first) without hops; let a blocked piece wait and
  retry on a later hop; let a 2-swap succeed (pieces pass through each other); random tie
  breaks; blow up a flight that meets anything, ground pieces included.
- **Why:** with Things acting one at a time, results depended on placement order and the
  animation couldn't replay them. (a) A Rocket crate landing on ice skidded into a crate a Belt
  carried away later the same tick and was left on bare ice for good. (b) Two crates nose to
  tail on a Belt line built back-to-front (the natural build order): the back crate stalled a
  tick, so packed trains spread out to every other hex. (c) A packed ring of Belts never moved.
  (d) The UI could draw two crates on one hex when a bumped piece left late and another mover
  entered its hex early. In lockstep each hop resolves all proposals at once: a hex whose
  occupant leaves this hop is open, so trains move as one and the Rocket's skid finds the hex
  empty; a cycle of 3+ rotates; and the engine's hop k is the animation's hop k, so what you
  see is what happened. The designer settled the rule (pjpd lockstep-ritf).
- **How:** each claimed piece gets a *motion* in one phase (`over`, `air`, `ground`, `skid`,
  `line`, `follow`, `drop`; the `PHASES` table and the `ARRIVED`/`STOPPED` dispatch in
  `gameengine.js`). Each hop: proposals (terrain and Things checked per phase), same-hex ties,
  then chains of occupants resolved front to back with cycle detection; a bump starts its line
  this hop and the hop is resolved again; then victims go, movers move together, arrivals and
  stops run by phase. A blocked piece stops for the tick. Events: one `move` per piece with
  `path` (one hex per hop), `hop` (start) and `over` (a shot's cleared hexes), replacing
  `by`/`byAt`; ends carry `hop`. `startAnim` builds each track as `pts[k]` = hex after hop k.
- **Unreviewed calls:** (1) *Claims are made as the tick starts.* Each Thing acts on the piece
  on its hex (or in front, or two ahead) when the tick begins; a piece carried onto a Belt
  mid-tick waits for the next tick, as before (R-13, R-46, R-28). (2) *A splatter or wrecker
  takes its victim's hex on the contact hop* (the victim fades that hop), rather than waiting a
  hop for it to free up; every other freed hex (a sink, delivery, Trap) opens on the next hop.
  (3) *A flight blocked by a piece while over a mountain or another color's target drops back
  on the next hop* to the last hex it flew over that it may land on, or its start, as a landing
  move; if that hex is taken by then, the piece crashes (lost). The old rule backed it up in the
  same instant; lockstep can't undo hops already shown, so it hovers a hop and drops back. (4)
  *The Cannon in lockstep:* its 4 cleared hexes are unseen (no claims, no occupancy, no crash
  with flights); whether it fires is still judged at launch (off the map, or the 5th closed by
  terrain/Things/another color's target and the 4th unable to take it, pieces included, as the
  board stands); if the 5th is then blocked by a piece and the 4th holds a piece by the time it
  comes down, the shot crashes (lost); on open water there it sinks. (5) *Mid-air crash scope* (designer-confirmed 2026-11-12: on the ground they bump, in the
  air they explode): only `air` motions (Spring and Rocket flights) crash; two in one hex on one hop, or swapping
  hexes, both go (splat, `by` the other, value lost). An air and a ground claimant on one hex
  tie by rank with no crash; a flight meeting a piece standing on a hex is stopped (it comes
  down; a Rocket still splats a gremlin; a still piece on slick ground is bumped). (6) *Ranks:*
  a motion's rank is its Thing's place in the tick's order (Pushers/Pullers first, D-24, then
  placement order); wanderers rank after every Thing, in creation order; a bumped line takes
  its bumper's rank; ties within a rank go to the earlier motion. (7) *A gremlin with nowhere
  to wander has no motion*, so it can be bumped into a line (before, every wanderer was marked
  moved). A gremlin's direction is picked from the board as the tick starts, so it may step
  into a hex a crate is leaving, or lose a tie for a hex a crate is entering. (8) *Waiting hops
  repeat a hex in the path* (a bumper on its contact hop, a flight about to drop back), so
  every path is one entry per hop from its start and the client needs no gaps. (9) A 2-cycle of
  one flight and one ground piece is just blocked both ways (no crash). (10) `MAX_HOPS` (1000)
  is a guard in the engine, not a tunable; every motion ends in a few dozen hops.
- **Evidence:** R-55 (train), R-56 (Rocket skid past a crate carried off), R-57 (ring), R-58
  (swap), R-59 (tie, Pusher priority, no retry), R-60 (mid-air crash), R-61 (no two pieces on
  one hex at any hop; also `smoke.js` and `uiboot.js`); R-51, R-32, R-54, R-26 updated.
  `Measured by:` before → after. `just cc-sim 200 small`: 200/200, median 49 → 45, p10 43 → 41,
  p90 58 → 51, lost/game 2.08 → 0.61. `just cc-sim-to 100 small 5`: median turn per milestone
  49 / 75 / 103 / 139 / 199 → 44 / 67 / 90 / 127 / 183, lost/game 20.13 → 3.14, big crates/game
  19.9 → 18.8. Trains no longer stall (faster milestones), and far fewer crates are lost: a
  crate jammed behind a stalled one used to sit where gremlins wreck it; now the line keeps
  moving. Unmeasured in play.

### D-24 Pushers and Pullers act before the other Things in a tick — *Decided*
- **Alternatives:** pure placement order (the old rule); letting a Pusher or Puller move a
  piece that already moved this tick; acting after the Belts.
- **Why:** in pure placement order a Pusher or Puller built after the Belt line beside it
  never fired: the Belt had already moved the crate in front, and each piece moves at most
  once (R-13). Players build the line first and the diverter second, so it read as broken.
  Reaching first makes it a diverter wherever it was built, keeps one move per piece, and is
  one partition of the loop, not a per-Thing priority.
- **Evidence:** R-43. Unmeasured in play: the bot discards Pushers and Pullers.
- **First vs last (2026-11-11, pjpd push-order-ptbd; settled 2026-11-12: the designer agreed,
  keep first; reviewed and accepted 2026-11-12).** The traces below are why. "Last" means Belts, Bridges, Springs and Rockets go first, then
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
- **Decision (settled 2026-11-12):** keep *first*. With one move per piece, "last" doesn't buy "the belt
  brings it, the Pusher shoves it on". It makes a Pusher or Puller beside any moving line
  (Belt, Bridge, a turning corner, a Spring hex) never fire, and it changes nothing at line
  ends, where the crate stops anyway. Its only win is faster merges into a dense line. In
  "first", the Pusher overrides whatever the crate stands on, which is the whole point of a
  diverter. The costs of first are a Pusher aimed at a Spring stealing its crate and a
  Pusher beside a Bridge line drowning crates, and both are visible and fixable by aiming.
- **In lockstep (2026-11-12, D-38; settled by the designer: Pushers and Pullers keep
  priority; the rest *unreviewed*).** "Act first" now means *claim first*: as the tick starts, Pushers and Pullers
  claim their pieces before any other Thing, and their motions outrank every other Thing's
  when two pieces want one hex on one hop (R-59). The traces above still hold, since claims
  are made from the board as the tick starts. The merge case improves a little: a Pusher's
  shove into a line hex whose crate a Belt moves out on the same hop now succeeds (the hex is
  free that hop), so merging into a moving line no longer burns the side crate's move.

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

- **Q-1 Chain pushes?** *Partly answered by D-33 (2026-11-12):* on slick ground a push now
  moves the whole line ahead two hexes. On plains a belt pushing a crate into another crate
  is still blocked. Open: whether that's annoying in playtest. *Recommendation:* leave plains
  blocking; ice and Slides are now the place to build a line that clears itself. *(2026-11-12, D-38, *unreviewed*)* In lockstep a packed train on plains moves as
  one when its front is free (the hex ahead empties on the same hop), so only a train whose
  front is truly stuck blocks.

## Deliberately left out
- Undo, and getting a removed Thing's card back (D-12: removal costs the card and a turn).
- A defeat condition, a time limit, and an end (D-2).
