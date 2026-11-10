# Thing Factory — Architecture Log

Dated entries, newest first. This is the only doc that records what something used to be.

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
