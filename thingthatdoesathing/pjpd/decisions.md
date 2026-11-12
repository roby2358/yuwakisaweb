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
- [agent] lockstep-ritf: swap clause: kept the task's "(or swapping)" for two airborne pieces even though the follow-up message said "only ... entering the same hex"; read "only" as airborne-vs-ground. A flight/ground swap is just blocked both ways. D-38 calls 5, 9.
- [agent] lockstep-ritf: ranks: wanderers rank after every Thing (creation order); a bumped line takes its bumper's rank; ties within a rank go to the earlier motion. D-38 call 6.
- [agent] lockstep-ritf: a gremlin with no wander direction has no motion, so a bump can push it (before, every wanderer counted as moved). D-38 call 7.
- [agent] lockstep-ritf: a hop a motion sits out (bumper on its contact hop, a flight about to drop back) repeats its hex in the move path, so paths are one entry per hop; moves carry `over` (a shot's cleared hexes) so overlap checks skip them. D-38 call 8.
- [agent] lockstep-ritf: R-52's "two big crates in one tick" test now feeds them a hop apart (one over ice), since one hex takes one piece per hop; several R-33/R-51/R-32 tests box gremlins with a lake so they can't wander off on hop 1.
