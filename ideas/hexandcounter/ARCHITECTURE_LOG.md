# Hex & Counters — Architecture Log

Dated entries, newest first. This is the only doc that records what something used to be.

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
