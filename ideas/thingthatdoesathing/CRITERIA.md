# Thing Factory — Criteria

How we know the build is right. Each row has a stable ID that is never reused. Rules are in
ONTOLOGY.md, cited by name. Constants are cited by name, never by value.

**Instrument** is the row's status. It takes one of four forms: `automated`, `manual — <what
a human checks>`, `not yet covered`, or `retired`. An `automated` R-row owns `test/R-n/`. Each
test there asserts that one rule, with its cases commented in the test itself.

**Test command:** `just cc-test`, which runs `node test/run.js` (add `-v` for every check). It runs each `test/R-n/`
file, the integration tests (`smoke.js`: random legal play with invariant checks;
`uiboot.js`: the real UI booted on a stub DOM, played to the first milestone by simulated clicks, plus Go/Pause), and
`test/coverage.js`. **Tuning harness:**
`node test/sim.js <games> <size>` (a greedy builder bot; not pass/fail).

---

## R — Rules (automated)

| ID | Given | Expect | Instrument |
|---|---|---|---|
| R-1 | `newGame(seed, size)`, every size | `cols × rows` hexes of `MAP_SIZES[size]`, each `(col,row)` once, keyed `"q,r"` with `q = col - floor(row/2)`; `state.size` recorded | automated |
| R-2 | any generated map, every size | `isEdge` exactly on the outer ring, and every edge hex is `WATER` | automated |
| R-3 | any generated map | inner hexes ranked by elevation split at `WATER_PCT`/`MOUNTAIN_PCT`; ICE only in the plains band, `round(ICE_FRAC × inner)` of it | automated |
| R-4 | any generated map | the first source in the leftmost placement slice, its target in the rightmost (Place source and target rule) | automated |
| R-5 | many seeds at every size | a land path from the first source to its target | automated |
| R-6 | `newGame(seed, size)` | one source and one target sharing a `CRATE_COLORS` color, and one crate of that color on the source; gremlin count in `gremlinDice(size)`d`GREMLIN_DICE_SIDES` (one die per `GREMLIN_HEXES_PER_DIE` hexes of area, rounded, at least 1) on distinct passable inner hexes off the source and target, each colored; no Things; `HAND_SIZE` cards; counters reset; unique ids | automated |
| R-7 | a step | blocked (piece stays) into off-map, mountain, Wall, or another piece; accepted onto plains, ice, a bridge, or a mover | automated |
| R-8 | `legalPlacements(kind)` | exactly the Placement legality rule: no Thing, not a target, right ground, no piece under a blocking kind | automated |
| R-9 | `place(slot, q, r, facing)` | legal: Thing appended (fixture facing null), slot redrawn, hand stays `HAND_SIZE`, one tick. Illegal (slot, facing, hex): `{ok:false}`, state and `Rando` unchanged | automated |
| R-10 | `rotate(q, r)` | on a Belt, Spring, Rocket, Pusher, or Puller: facing turns clockwise and nothing else changes (no tick: `events` empty, turn, pieces, hand untouched). On a fixture or empty hex: `{ok:false}`, unchanged | automated |
| R-11 | `wait()` | one tick, hand and Things untouched | automated |
| R-12 | a piece on a mover during a tick | pushed `THINGS[kind].push` hexes in the facing, stopping before a blocked hex | automated |
| R-13 | a tick | each piece moves at most once (a line of belts advances a crate one hex per tick; a carried gremlin doesn't also wander) | automated |
| R-14 | a piece entering bare ICE | keeps going the same way, free, until non-ice or blocked; ice under a Thing doesn't slide; a flying push (Spring, Rocket) counts ice under its flight; a Spring that lands on bare ice skids on (on the ground), a Rocket doesn't | automated |
| R-15 | a piece entering water | removed if no Thing is there (crate: `lost` +1); a bridge carries it; a flying push (Spring, Rocket) passes over inland water and sinks only if it comes down on it, but the outer sea always takes it | automated |
| R-16 | a piece entering a target | a crate of its color is removed and `delivered` +1; a gremlin that comes onto any target dies (`splat`, `by` null, after its `move`; `exGremlins` +1, a new one climbs out), but not when a flight carries it over | automated |
| R-17 | a spinner during a tick | the Spinner was replaced by the Puller (R-28) | retired |
| R-18 | gremlins in a tick | each unmoved gremlin steps to a random enterable (or crate-holding) non-water neighbor or stays; boxed in → stays; never walks into open water; pieces never share a hex | automated |
| R-19 | ticks | `spawnTimer` counts up; at `SOURCE_INTERVAL` the tick rolls an open color, and if that color's source is empty a crate of that color spawns there and the timer resets; if it's occupied nothing spawns and the next tick rolls again | automated |
| R-20 | (a final win at `DELIVER_GOAL`) | — | retired |
| R-21 | two games, same seed | identical terrain, source, target, pieces, hand; different seeds differ | automated |
| R-22 | two engines, same seed and commands | identical state and events after every command; the engine never calls `Math.random` | automated |
| R-23 | `GEN_MAX_ATTEMPTS` pathless maps, every size | falls back to that size's `knownGoodSeed`, records it, equals `newGame(knownGoodSeed, size)`; that seed has a path on attempt 1 | automated |
| R-24 | the engine-side modules | load and play with no DOM, canvas, or `GameDisplayArtifacts`, and never reference them | automated |
| R-25 | any command | a boolean `ok`; `newGame` without a non-negative integer seed or a `MAP_SIZES` key is `ok:false`; `ok:true` from place/rotate/remove/discard/wait carries `events[]`; `ok:false` carries nothing else | automated |
| R-26 | a tick's events | `move` paths list every hex entered and end where the piece is or vanished; `sink`/`deliver`/`splat` follow their `move`; `spawn` reports the new crate; `open` follows its `milestone`; replaying events reproduces every position | automated |
| R-27 | many draws | each card's kind comes from `THINGS` by weight (only known kinds, every kind, shares near weight / total); its color is `WHITE` unless the kind is `colored` and 2+ colors are open, then `WHITE` or an open color, equally likely | automated |
| R-28 | a Puller during a tick | the piece on the far hex (two ahead) is pulled one step back into the near hex by the ordinary step rule (blocked → stays, water → sinks, ice → slides onto the Puller); pieces on the Puller or the near hex are left alone; a piece already moved this tick isn't pulled | automated |
| R-29 | `remove(q, r)` | the Thing at (q,r) is gone, one tick, hand unchanged; a piece left on open water by a removed Bridge sinks (lost if cargo) with its `sink` event first. Empty hex: `{ok:false}`, unchanged | automated |
| R-30 | milestones | `nextMilestone` gives 10, 20, 50, 100, 200, 500, 1000, … with no last one; the tick whose deliveries reach one emits one `milestone{count}` (deliveries of every color count); other ticks emit none; commands keep working past any milestone | automated |
| R-31 | a gremlin sinks or splats | at the end of that command a new gremlin (new id, palette color) appears on a random shore hex (land next to an edge hex, free, not source or target), its `spawn` after the `sink`/`splat` and before any `milestone` (a piece sunk by `remove` before the tick included); a sunk crate brings nothing back; a full shore brings nothing back | automated |
| R-32 | a Rocket during a tick | the piece on it flies up to `THINGS.ROCKET.push` hexes in the facing, or until stopped: before a blocker, sunk in the outer sea (crate: `lost` +1), delivered crossing its color's target; it flies over inland open water, Bridges and ice (every hex counts, no slide), and sinks if it comes down on water; one `move` for the whole flight; Belts still sink in inland water | automated |
| R-33 | a Rocket's flight and gremlins | a flier stopped by a gremlin splats it (`splat{id, by}`) and lands on its hex; a launched gremlin splats where it lands (`splat`, `by` null) unless it sank; splats aren't `lost`; other pushers never splat | automated |
| R-34 | `discard(slot)` | the slot gets a fresh draw, one tick, Things and other cards untouched. Bad slot: `{ok:false}`, unchanged | automated |
| R-35 | a gremlin comes onto a Trap | it dies (`splat`, `by` null, after its `move`) whether it wandered, was pushed, slid on ice, or came down from a flight (a Spring's skid included); a flight passing over a Trap doesn't trigger it; a Trap built under a gremlin doesn't kill it; crates cross Traps safely | automated |
| R-36 | gremlins gone | `exGremlins` goes up by one for every gremlin sunk, splatted by a Rocket, killed on a target, or sunk by removing its Bridge, but not one a Trap caught (R-42); crates never count; a new game starts it at 0 | automated |
| R-37 | a gremlin's own step into a crate | the crate is wrecked (`splat{id: crate, by: gremlin}` after the gremlin's `move`), `lost` +1, nothing re-emerges, and the gremlin takes the hex; a gremlin pushed, pulled or flung into a crate is only blocked | automated |
| R-38 | a milestone | opens the next color until `MAP_SIZES[size].colors`: a color not open yet, from an existing source (`ENHANCE_CHANCE`; both outcomes happen) or a new source in the left slice, with its target in the right slice on a free hex its source has a land path to; `open{color, source, target}` right after the `milestone`; nothing past the cap or with no free hex (the next milestone tries again); small never opens one | automated |
| R-39 | a crate meets a target | its own color's target delivers it (walking, pushed, or crossing it in flight) and counts it in that target's `delivered` and the board's; another color's target is solid on the ground; a flight passes over it but drops one hex short rather than come down on it | automated |
| R-40 | a colored Pusher or Puller | acts only on crates of its color and on every gremlin, leaving other crates where they are; a white one acts on every piece | automated |
| R-41 | a Pusher during a tick | pushes the piece on the hex it faces `THINGS.PUSHER.shove` hexes on in its facing, through the same `step` (blocked, sinks, slides on ice); ignores a piece on its own hex; turns like any mover | automated |
| R-42 | a gremlin caught by a Trap | `trapped` goes up by one (and `exGremlins` doesn't), whether it was pushed or came down from a flight; its `splat` carries `trap: true`, every other splat `trap: false`; a new game starts it at 0 | automated |
| R-43 | the order Things act in a tick | Pushers and Pullers act before every other Thing, each group in placement order, so one built beside a running Belt line catches the crate in front of it whichever was placed first | automated |
| R-44 | `blast(q, r)` | on a crate: the crate is gone, `lost` +1, its `splat` (`by` null) leads the events, Things untouched, one tick. On a gremlin or an empty hex: `{ok:false}`, state and `Rando` unchanged | automated |
| R-45 | ticks with no card used | after `IDLE_REDRAW_TICKS` ticks in a row of `wait`, `remove` or `blast`, one random slot is redrawn (`redraw{slot}`) and the count starts over; `place` and `discard` reset it; `rotate` doesn't tick or count | automated |

---

## U — UI / readability

| ID | Criterion | Instrument |
|---|---|---|
| U-1 | Double-clicking `index.html` runs from `file://` with no console errors | manual — open from the file manager, check the console |
| U-2 | The small board fits a desktop window without panning, centered; a board too big for the window opens centered on the source and left-drag pans it | manual — open small and huge at 1280×720 |
| U-3 | Picking a card (click or `1`–`3`) lifts it and tints exactly `legalPlacements` yellow; a ghost with a facing arrow follows the cursor over legal hexes | manual — pick each kind |
| U-4 | `R`, `Shift+R`, and the wheel turn the ghost; the card's picture turns with it | manual — pick a Belt, turn it all three ways |
| U-5 | Clicking a yellow hex places the Thing and the tick plays: pieces hop along their paths, sinking/delivered pieces fade | manual — build a belt into water and one into the target |
| U-6 | With no card picked, hovering a mover outlines it and the hover bar says "click to turn"; clicking turns it and ticks | manual — hover and click a placed Belt |
| U-7 | Esc and right-click put the card back; a click on a non-yellow hex also does | manual — try all three with a card picked |
| U-8 | Space, Enter, and Wait all tick; none of them, nor clicks, act during the animation or an overlay | manual — mash Space mid-animation |
| U-9 | Each Thing is recognizable by look alone: belt chevrons, spring coil, rocket, puller magnet, wall bricks, trap jaws, bridge planks | manual — glance test |
| U-10 | The HUD (top left) shows Turn; the tally (top right) shows Delivered k / next milestone with a bar, Ex-gremlins, Trapped, and crates lost (only once one is lost); the hover bar names terrain, Thing (with its verb), and piece | manual — hover a crate on a belt, then lose one at sea and trap a gremlin |
| U-11 | Reaching a milestone shows a banner ("IT DOES THE THING" for the first, "N crates!" after) with crates, turns, the next milestone, and crates lost; it hides on its own and play never stops | manual — run a line past 10 and 20 |
| U-12 | With no card picked or with one picked, `D` over a placed Thing removes it and ticks; the hover bar says "D to remove"; a crate on a removed Bridge fades where it stood | manual — remove a Belt, then a Bridge with a crate on it |
| U-13 | A green Go button sits top centre; Go ticks on its own until Pause, picking a card holds it so you can place, and the button reads Pause while running | manual — press Go, pick and place a card mid-run, press Pause |
| U-14 | The intro and New Game both show the four board sizes (click or `1`–`4`); nothing else closes the intro; Esc or Keep playing closes New Game and the game goes on | manual — open the page, press Space, then pick; press New Game, then Esc |
| U-15 | A Discard spot sits right of the cards; it lights up while a card is picked, and clicking it (or `X`) throws that card away and ticks; with no card picked it does nothing | manual — pick a card, click Discard; click it with nothing picked |
| U-16 | A Rocket's flight is one long hop-by-hop slide; a gremlin it hits bursts in its own color when the flier lands, with a splat sound; a launched gremlin bursts where it lands | manual — rocket a crate into a gremlin, then a gremlin into a Wall |
| U-17 | A gremlin that walks or is pushed onto a Trap bursts there with a splat sound, Trapped goes up, and a new gremlin appears on the shore | manual — belt a gremlin onto a Trap |
| U-18 | A gremlin that steps onto a crate: the crate bursts in its color as the gremlin arrives, and the lost count goes up | manual — watch a gremlin beside a stalled crate |
| U-19 | Each target is ringed in its color, with a black line just inside, and a ★; a source shows one pip per color it makes; once a second color opens, the tally shows a count per color; the milestone banner names a color it opened; the hover bar names a source's colors and a target's color | manual — reach 10 on a medium board |
| U-20 | A Pusher shows a ram with a chevron; Pushers and Pullers draw their glyph in white or their color, on the board, the ghost and the card; a colored card reads e.g. "Red Pusher" and says "only red crates, and gremlins" | manual — reach 10 on a medium board and draw a colored card |
| U-21 | `B` over a crate bursts it in its color and the lost count goes up; over a gremlin or empty hex nothing happens | manual — jam a line and press B on a crate |
| U-22 | A card the idle rule redrew glows once in the hand | manual — press Go and watch the hand |

---

## X — Experience / outcomes

| ID | Criterion | Link · Instrument |
|---|---|---|
| X-1 | Every board works as a factory: the greedy bot reaches the first milestone on at least 90% of 200 boards at each size | D-8 · manual — `node test/sim.js 200 <size>` |
| X-2 | A first-time player gets their first crate delivered within about 25 turns | D-7 · not yet covered |
| X-3 | Players laugh at least once a game (a gremlin rides a belt into the sea, an ice skid lands a crate) | G-1 · not yet covered |
| X-4 | The machine keeps running without the player once it's built: after the first delivery, the rest arrive mostly on Wait | D-7 · not yet covered |

---

## Status (2026-11-10)

- **Manual only:** U-1…U-20, X-1.
- **Retired:** R-17 (Spinner), R-20 (final win).
- **Not yet covered:** X-2, X-3, X-4 (need playtests).
- **Partial coverage:** R-18 checks that wandering gremlins land on land and never step into
  water on purpose, but not that the direction choice is uniform. R-22 drives a scripted
  command mix rather than every command shape.
