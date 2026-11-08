# RADIO FREE SECTOR 9 — Architecture Log

Dated entries, newest first. This is the only doc that records what something used to be.

### 2026-11-08 — Code revised to the /coding conventions
No default or optional parameters: `newGame(seed)` now requires its seed (the UI rolls it,
so the engine never reads `Math.random`; R-26 and the determinism invariant say so),
`rigWakeSet(q, r, jam, range)` and `planBroadcast(without)` take every argument, and the
same goes for `spawnSweepers`, `addLog`, `drawCounter` and `GameSound.click`. Branches on a
kind became lookup tables: target validity, the fallback prey, event log lines, end cards
and Sweeper intent lines (`TARGET_LINE` in display artifacts). `walkSweeper` hands what a
step runs into to `enterHex`, and `render()` is split into one draw step per layer. No rule
or number changed.

### 2026-11-08 — ONTOLOGY and code reconciled
A side-by-side review found no rule disagreements, only drift. In the code, five comments
cited the wrong criteria IDs, and `GameEngine.jam()` was
renamed `sedate()` so it matches the Regime rule's sedate step and the `sedated` event,
which also keeps it apart from jamming at broadcast (`jammedKeys`, `JAM_RADIUS`). In
ONTOLOGY: the `rigWakeSet` pseudocode now shows its `jam` parameter, `newGame` notes the
uint32 seed coercion, spawn names what a free spot excludes (stations, Sweepers, @) and
that a station with no spot is skipped, plant/retrieve say `rig` is an id, and the events
table says which events are omitted when empty. No rule or number changed.

### 2026-11-08 — Rigs grow while on air; unheld blocks fade
Before: a rig's range was a fixed `TX_RANGE` and awake blocks stayed awake unless a Sweeper
stood on them, so after one broadcast a rig had nothing left to do and pulling it at once
was always right. Added D-15 (range grows +1 per unjammed broadcast to the new
`TX_RANGE_MAX`; plant and retrieve reset `Rig.airtime`) and D-16 (an awake block outside
every live rig's range with fewer than the new `FADE_THRESHOLD` awake neighbors falls
asleep). The broadcast decision moved into the `planBroadcast(without?)` query, which the
UI's new pull preview (U-13) also calls; new `faded` event. New rows R-31 (fading), R-32
(range growth), U-13, X-6; R-14, R-30, U-5, U-7, U-9, X-1 reworded. R-14 and R-16 now stage
with fading off (`NO_FADE` fixture) so each asserts one rule. Harness: `--maps` reports
three rig policies through the real growth/fade rule; the bot's spent test waits for full
range; new `--pull-early`. Bot results moved from 18 won / 12 captured / 10 stalled to 12
won / 8 captured / 10 dead air / 10 stalled; the controlled runs in D-16 separate the two
rules (fading alone 6 won; growth alone 16 won). Title card rules updated (v1.03).

### 2026-11-08 — Forked from Hex & Counters into RADIO FREE SECTOR 9
The movement puzzle (walk P to a target past wandering enemies) was replaced by an
insurrection game built on the same seam: the Wake (a rig-seeded threshold automaton over
tenement blocks) is the core; the Alert (Sweeper quota from the awake count) and the Rigs
(five named, finite transmitters) feed it. DYNAMICS, ONTOLOGY, CRITERIA and RATIONALE were
rewritten with a **fresh ID namespace** (D-14): the base's R-1–R-23, D-n and Q-n no longer
apply, and its `test/R-n/` directories were replaced by R-1–R-30 for this game.
Code: `Rig` and `Sweeper` subclass `Piece`; `GameState` swaps `target/enemies/gameWon` for
`stations/rigs/sweepers/outcome`; `hex.js` gained a heap Dijkstra with parents
(`dijkstraHexes`, `pathFromPrev`) for Sweeper global-vision pathing; `colortheory.js` was
removed (Sweepers are colored by kind). Commands now return an `events` list, which the UI
animates. The UI became a 1987 DOS release (EGA palette, VT323, boot screen, PC-speaker
cues). Added `test/sim.js`, the committed tuning harness, and a `GameArtifacts` override
hook in `test/helpers/load.js` for it.

Tuning during the fork, in order (each change measured with `test/sim.js`):
1. Density: smooth noise alone let one rig wake a median 77% of blocks (10 maps). Added
   `DENSITY_JITTER` 80 and lowered `BLOCK_FRAC` 0.5 → 0.45 → median 17% (D-3).
2. Jamming originally *sedated* every awake block within `JAM_RADIUS` and Wardens targeted
   the nearest awake block: 0 of 30 bot wins, the Wake ground to zero. The Alert also only
   ratcheted up. Added recall (`RECALL_PER_TURN`, D-8): still 0 of 30.
3. Jamming changed to block-only with own-hex sedation (D-5), and Wardens retargeted to the
   frontier (D-12). With bot fixes (no endless commit to an unsafe plant spot): 18 of 40
   bot wins, median peak 47%. Steps 2 and 3 changed rules and the bot together, so the
   attribution between the jam change and the bot fixes is confounded.

---

## Inherited from Hex & Counters

### 2026-10-15 — CSS cleanup and UI polish
`index.css` now uses `:root` tokens and shared `.panel`, `.btn` and `.hidden` classes
instead of duplicated per-id blocks. Text moved from monospace to the system UI font. The
intro card gained a title and a key legend, and End Turn is styled as the primary button.
On the canvas: a glow on the target, and a victory card in the
panel style that fixes the "1 turns" plural. New display constants `BG_COLOR`, `UI_FONT`
and `REACH_COLOR` mirror the CSS tokens. No rule changed; U-12 still holds.

### 2026-10-15 — X-5 retired
X-5 asked whether enemies force re-routes without locking the path. The designer ruled it
not worth a sim harness: worst case the player waits. Recorded in D-13 and under
RATIONALE's deliberately-left-out list.

### 2026-10-15 — Ontology doc set; questions Q-1–Q-6 settled; tests reorganized into R-n
Added ONTOLOGY.md, CRITERIA.md, RATIONALE.md, and this log. The open questions from
writing them were settled:
- **Q-1 → D-9.** `newGame` used to retry 20 times and then silently keep a map with no
  path. Now it retries `GEN_MAX_ATTEMPTS` (10) times, then falls back to `KNOWN_GOOD_SEED`.
- **Q-2 → D-13.** Enemies may stand on the target. This was already the behavior; it's
  now documented.
- **Q-3 → D-11, D-12.** Removed the inert hex fields `resource`, `units`, and
  `controlled`, and renamed terrain GOLD → SCRUB and QUARRY → ROUGH. Costs are unchanged.
- **Q-4 → D-5, D-7.** `newGame` and `endTurn` now return `{ ok }`. As a result, the UI no
  longer plays the end-turn cue when Space is pressed after a win. Events stay proposed.
- **Q-5.** Generation numbers that were bare literals in `gameengine.js` moved into
  `GameArtifacts` under names: heightmap size and roughness, elevation cuts, scatter
  fractions and minimums, placement slice, and enemy dice.
- **Q-6 → D-6.** `movePlayer` used to accept moves after a win if MP was left, walking the
  player off the target. Only the UI prevented it. Now the engine refuses.

Places the older docs disagreed with the code when this set was written:
- DYNAMICS.md listed 50% plains and 10% hills. Forest and scrub are carved out of plains
  and rough out of hills, so the realized mix is about 49% plains and 8% hills.
- CLAUDE.md listed the inert hex fields as part of the hex shape.

Tests: `test/smoke.js` was split into one directory per criterion (`test/R-1/` …
`test/R-23/`), a happy-path walkthrough in `test/integration/smoke.js`, and
`test/coverage.js`, which keeps CRITERIA.md and the directories in step. The test command
is now `node test/run.js`.

### Earlier history (from `git log`)
- `ce0491d` Introduced `Piece` and `Board`; each enemy's color moved onto its piece.
- `7024fc1` Player MP raised to 6.
- `f51faf3` Pan moved from right-drag to left-drag with a click threshold.
- `16481e1` HUD split into two bars; the MP readout became the progress-to-end meter.
- `db42ad0` Added audio cues.
- `b19b1ed` Factored into Artifacts/State/Engine/UI for server-readiness, and added
  seeded `Rando`.
- `5ce4e54` Adopted the `Hex` value class.
- `4cf3907` Adopted UI_CONTROLS.md as the layered controls reference.
