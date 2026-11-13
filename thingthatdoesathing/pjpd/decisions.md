# Decisions log (pjpd loop, for review)

Calls made while working through the pjpd tasks unattended. Each line names the task, the
decision, and where the full reasoning lives (a RATIONALE `D-n` tagged *unreviewed*).
**[user]** = you settled it; **[agent]** = made during the loop, needs your review.


## Lockstep (2026-11-12)

- [user] lockstep-ritf: every moving piece advances one hex per hop, all together; engine hop k = animation hop k (D-38).
- [user] lockstep-ritf: a blocked piece stops for the rest of the tick (no retry when the hex frees up) (D-38, R-59).
- [user] lockstep-ritf: a 2-piece head-on swap fails; both stay (R-58).
- [user] lockstep-ritf: a cycle of 3+ pieces all move and rotate (R-57).
- [user] lockstep-ritf: two pieces after one hex on one hop: the piece moved by the earlier-placed Thing wins (R-59).
- [user] lockstep-ritf: Pushers/Pullers keep priority: they claim first and win hex ties (D-24, R-59).
- [user] lockstep-ritf: mid-air collision: only two AIRBORNE pieces entering the same hex on the same hop (or swapping, per the task text) are both destroyed (lost, a splat each naming the other); a flight meeting a piece on the ground is stopped (comes down) and the ground piece stays; a Rocket still splats gremlins; a still piece on slick ground is still bumped (D-33) (D-38, R-60).
- [user] lockstep-ritf: a flight's landing spot is trimmed at launch for static terrain/targets (mountains, other colors' targets, Walls, the edge) (D-35).
- [user] lockstep-ritf: bumps start mid-tick (line from the contact hop, bumper follows from the next); skids go hop by hop; every landing still slides except after a gremlin splat; gremlins pick their direction at hop 1 (D-33, D-37).
- [agent] lockstep-ritf: claims are made from the board as the tick starts; a piece carried onto a Thing mid-tick waits for the next tick (as before). D-38 call 1.
- [agent] lockstep-ritf: a Rocket splatting a gremlin, or a gremlin wrecking a crate, takes the victim's hex on the contact hop (victim fades that hop); other freed hexes (sink, delivery, Trap) open on the next hop. D-38 call 2.
- [agent] lockstep-ritf: a flight stopped by a piece while over a mountain or another color's target drops back on the NEXT hop to the last landable hex it flew over (or its start); if that hex is taken by then, the piece crashes (lost). Old rule did it instantly. D-38 call 3, D-35.
- [agent] lockstep-ritf: Cannon: its 4 cleared hexes are unseen (pieces move under it, no crash with flights); fire/no-fire still judged at launch incl. the 4th-hex groundTakes piece check (board as the tick starts); if the 5th is then piece-blocked and the 4th holds a piece when it comes down, the shot crashes (lost); open water on the 4th then sinks it. D-38 call 4, D-36.
- [user, confirmed 2026-11-12] lockstep-ritf: swap clause: kept the task's "(or swapping)" for two airborne pieces even though the follow-up message said "only ... entering the same hex"; read "only" as airborne-vs-ground. A flight/ground swap is just blocked both ways. D-38 calls 5, 9.
- [agent] lockstep-ritf: ranks: wanderers rank after every Thing (creation order); a bumped line takes its bumper's rank; ties within a rank go to the earlier motion. D-38 call 6.
- [agent] lockstep-ritf: a gremlin with no wander direction has no motion, so a bump can push it (before, every wanderer counted as moved). D-38 call 7.
- [agent] lockstep-ritf: a hop a motion sits out (bumper on its contact hop, a flight about to drop back) repeats its hex in the move path, so paths are one entry per hop; moves carry `over` (a shot's cleared hexes) so overlap checks skip them. D-38 call 8.
- [agent] lockstep-ritf: R-52's "two big crates in one tick" test now feeds them a hop apart (one over ice), since one hex takes one piece per hop; several R-33/R-51/R-32 tests box gremlins with a lake so they can't wander off on hop 1.

## delete-sel (2026-11-12)

- [agent] delete-sel-rcax: B (blast) stays on the hovered crate; crates move, so a selected hex would often be empty by the time you press B. Noted as a follow-up in D-39.
- [agent] delete-sel-rcax: D on a selected bare hex does nothing and keeps the selection; only a successful remove clears it (D-39 call 1).
- [agent] delete-sel-rcax: no fallback to the hovered hex when nothing is selected (that would bring back the slip) (D-39).
- [agent] delete-sel-rcax: hover-bar hint reworded: "click to select, then D to remove" over an unselected Thing, "D to remove" over the selected one, no D hint while a card is picked (picking clears the selection) (D-39 call 2).
- [agent] delete-sel-rcax: U-12 (manual CRITERIA row) rewritten for select-then-D; `commit()` now returns true/false so the UI knows the remove succeeded.

## slide-no-ice (2026-11-12)
- [agent] Renamed `BUILDS_ON.both` to `unslick` (plains or water) instead of adding a fourth entry: the Slide was `both`'s only user, so no dead entry is left. Data-driven via `THINGS.SLIDE.on`, no kind check.
- [agent] Dropped R-48's "a Slide on ice still slides" clause/check: a Slide can no longer stand on ice (no command changes terrain under a Thing), so it's unreachable; `isSlick` still lets the Thing decide. Replaced with the illegal-on-ice placement checks.
- [agent] Updated the Slide's hover verb line (displayartifacts.js) and README from "land or water" to "plains or water" so the UI doesn't promise ice.

## map-zoom (2026-11-12)
- [agent] map-zoom-8cwk: one canvas transform (`setTransform(scale, 0, 0, scale, panX, panY)`) for all board drawing; draw helpers now take world px (`hexToWorld`). Line widths scale too (hairlines at 1/4), no minimum width held (D-40 call 1).
- [agent] map-zoom-8cwk: `MIN_TEXT_PX` = 8: at 1/2 the source "IN" (11px) hides, the ★ (16px) and gremlin labels stay; at 1/4 all on-map text hides. `readable(px)` is the single gate a later detail switch can hang on (D-40 call 1).
- [agent] map-zoom-8cwk: ∞ centers the board rather than keeping the old center, fits the whole canvas (not the area between HUD panels), and stays lit after (D-40 call 2).
- [agent] map-zoom-8cwk: pan clamp = the canvas center stays inside the box of hex centers; applied during drags, after zooms and in centerMap (D-40 call 3).
- [agent] map-zoom-8cwk: buttons are a third HUD-stack row "Map 1 2 4 ∞" under the Turn/Wait/New Game/Help line; narrow-screen (<1000px) Go moves 96→108px and the banner 150→162px to clear it. Not browser-measured (D-40 call 4).
- [agent] map-zoom-8cwk: kept the existing window-resize handler (canvas size + re-center via centerMap, now at the current scale); "resizes ignored" read as "the scale never reacts to a resize" (D-40 call 5).
- [agent] map-zoom-8cwk: UI_CONTROLS.md left unchanged (shared family spec, already says zoom is optional); gameui cites L1.3 at the view helpers (D-40 call 6).
- [agent] map-zoom-8cwk: help legend gets a "Map 1 2 4 ∞ — buttons" line; README and CLAUDE.md input section updated; U-27 added.
- [user] map-zoom after a look: buttons are 1, 2, ∞ (1/4 dropped, smaller than the fit); ∞ fits from the window top to the top of the hand, or across, whichever is tighter, centered in that space; the hand sits flush on the bottom edge.

## mobile-lock (2026-11-13)
- [agent] mobile-lock-twxz: no user-agent fallback; the pointer/hover media query alone decides, and a missing `matchMedia` counts as a desktop (D-41 call 1).
- [agent] mobile-lock-twxz: no "play anyway" link; without touch controls it would only open a board that ignores taps (D-41 call 2).
- [agent] mobile-lock-twxz: checked once at boot in `index.js` before state/engine/UI are built; no live re-check if a mouse is plugged in later (D-41 call 3).
- [agent] mobile-lock-twxz: the page is a hidden `#sorry-panel` in index.html shown by a static `GameUI.showSorry()`; body class `touch-only` hides every other panel and the canvas (D-41 call 4).
- [agent] mobile-lock-twxz: the picture is one Belt from the card art (`cardPicture`, `SORRY_PICTURE_PX` 64) (D-41 call 5).
- [agent] mobile-lock-twxz: viewport meta was already `width=device-width, initial-scale=1.0`, left as is; the card scrolls inside a 16px gutter on a short landscape phone (D-41 call 6).
- [agent] mobile-lock-twxz: `TOUCH_ONLY_QUERY` lives in displayartifacts.js (client-only); README says who can play, CLAUDE.md gets a Boot bullet, ONTOLOGY's overlay row a one-line note; U-28 added.

## port-look (2026-11-13)
- [agent] port-look-jtj4: light shade = the crate's mid (`left`) face mixed 60% toward white (`lighten`, `PORT_MARK_LIGHTEN` 0.6) as `CRATE_SHADES[c].light`; yellow's marks are the faintest (~1.4:1 on its fill), a look-check watch point (D-42 call 1).
- [agent] port-look-jtj4: a dark outline (2px, 70% black) on every source and target, all colors: measured contrast against neighboring terrain is as low as 1.04:1 (green on plains), 1.07 (red on mountain), 1.15 (red on water), 1.34 (blue on water), 1.37 (yellow on ice) (D-42 call 2).
- [agent] port-look-jtj4: plus = vertex to vertex vertically, edge to edge across, arms at 86% to the rim; rings at 68% and 34% of the inner radius; marks 4.5 world px (D-42 call 3).
- [agent] port-look-jtj4: wedges start at the top and go clockwise; neutral plus #f2f2f2 (`PORT_NEUTRAL_MARK`); a source with no colors falls back to `SOURCE_COLOR` with the neutral plus (D-42 call 4).
- [agent] port-look-jtj4: dropped the ★ from the intro's "★ target"; U-19 trimmed to the tally/hover parts and points at the new U-29; D-40 call 1's IN/★ example annotated as removed (D-42 call 5).

## spawn-cycle (2026-11-13)
- [agent] spawn-cycle-jisb: the starting color stays `Rando.choice(CRATE_COLORS)`, independent of the cycle; the shuffle draws right after it, so every seed's game past map generation differs from before (D-43 call 1).
- [agent] spawn-cycle-jisb: `spawnSlot` is the slot the next tick takes, so the first tick takes slot 0 (D-43 call 2).
- [agent] spawn-cycle-jisb: skip, not retry; a retry variant tied on small (fifth milestone 238 vs 236) and lost on medium (14 vs 17 of 50 reached the third, 18.5 vs 7.6 crates lost) since one jammed color stalls the rest (D-43 call 3).
- [agent] spawn-cycle-jisb: checks run open color, cap, clear source; the big-crate roll only on an actual spawn, so a skipped slot doesn't touch `Rando` (D-43 call 4).
- [agent] spawn-cycle-jisb: `flatGame()` holds spawns off with a one-slot `[null]` cycle instead of the old negative timer; spawn tests set their own cycle (D-43 call 5).
- [agent] spawn-cycle-jisb: `test/sim.js` prints `at cap` (share of ticks at `crateMax()`) to answer whether the cap binds; the cap binds 54-63% of ticks on medium/large/huge past the first milestone (44-69% before), 0% before it, not retuned (D-43 call 6).
- [agent] spawn-cycle-jisb: no number retuned; small's first milestone slows from median 45 to 53, left for the designer (D-43 call 7).

## port-clears (2026-11-13)
- [agent] port-clears-kh58: a cleared Thing emits a new `clear{kind, q, r}` (not `remove`, a command name); a cleared piece reuses `splat{by: null, trap: false}`, so the UI plays it with no client change (D-44 call 1).
- [agent] port-clears-kh58: clear events follow their `open`, new source's hex before the target's, each hex's Thing before its piece (D-44 call 2).
- [agent] port-clears-kh58: the clear's splat `hop` is the tick's last hop, so a piece that moved onto the hex this tick arrives, then fades (D-44 call 3).
- [agent] port-clears-kh58: a cleared gremlin re-emerges like any splatted gremlin; the tick now runs milestones before its tally/emerge but still emits their events last (after the spawns), keeping R-31's order; an emerged gremlin can never be the one cleared (D-44 call 4).
- [agent] port-clears-kh58: emerge's Rando draws now follow openColor's, so a game that opens a color diverges from that tick (D-44 call 5).
- [user, changed 2026-11-13] port-clears-kh58: a crate on its own color's new target is delivered, not destroyed (D-46, superseding D-44 call 6).
- [agent] port-clears-kh58: `freeEndHexes` → `openEndHexes`; `openColor(hop)` returns a list; `reachMilestones(before, after, hop)`; R-62 is a new row for the clears, R-38 keeps placement (D-44 call 7).
- [agent] port-clears-kh58: `test/sim.js` with a milestone count prints colors opened and endpoint clears per game; medium to 5: colors opened 1.00/game, 0.19 clears/game, fewer games reach #2 (50 → 45), likely the bot's belts under a new wrong-color target (D-44 call 8).

## bigcrate-odd (2026-11-13)
- [agent] bigcrate-odd-755q: straight line between the designer's two early points, 1% + 0.8%·m (1, 1.8, 2.6, 3.4, 4.2, 5%), the task's default (D-45 call 1).
- [agent] bigcrate-odd-755q: past the fifth, 1 − 0.95·r^(m−5) with r = 0.85; sim to the 8th milestone on small keeps the gaps after the 5th roughly flat (~800 turns each), 0.9 stretches them (no game reaches the 8th in 3200 turns), 0.8/0.75 shorten them a little (D-45 call 2).
- [agent] bigcrate-odd-755q: added `BIG_CRATE_KNEE` = 5 beside `BIG_CRATE_START`, `BIG_CRATE_AT_FIFTH`, `BIG_CRATE_EASE`, so the formula has no bare 5; `BIG_CRATE_HALF` removed (D-45 call 3).
- [agent] bigcrate-odd-755q: the chance is never 0 now, so `spawnKind()` drops the "no roll while p is 0" guard and rolls on every spawn; first-milestone baselines shift a little (small 53 → 52, medium 60 → 58) (D-45 call 4).
- [agent] bigcrate-odd-755q: R-52 checks strict rise and < 1 over m = 0…30; the float reaches exactly 1 near m = 230, unreachable, so no clamp (D-45 call 5).
- [agent] bigcrate-odd-755q: milestone gaps balloon as the task expected (small to the 5th: 236 → 649, near the old big-crates-off 662); not retuned, flagged for the separate big-crate-advancement idea.
