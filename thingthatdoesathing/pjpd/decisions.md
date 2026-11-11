# Decisions log (pjpd loop, for review)

Calls made while working through the pjpd tasks unattended. Each line names the task, the
decision, and where the full reasoning lives (a RATIONALE `D-n` tagged *unreviewed*).
**[user]** = you settled it; **[agent]** = made during the loop, needs your review.

## Settled up front (2026-11-11)
- crate-cap-hybj: the crate max rises by one per milestone reached (not per delivery). [user]
- card-unlock-aszw: start with Belt, Bridge, Wall, Trap; then Pushers+Pullers, then Slide, then the rest (Spring, Rocket). [user]
- push-order-ptbd: RATIONALE note with both options and a recommendation only; no code change. [user]
- color-picker-8h4x: build it (reverses D-22). [user]
- Loop order: bridge-belt, replace, slide, card-unlock, crate-cap, push-order, color-picker, bump, big-crate. Slide moved ahead of card-unlock so the unlock list can include it. [agent]

## Made during the loop
- bridge-belt-zguc (D-27): Bridge push is on the ground, so a Bridge aimed at open water sinks the crate (crossings need a line of Bridges); Bridges stay white and carry gremlins too; draw weight stays 1; glyph = faint planks under a belt chevron. [agent]
- replace-es7n (D-28): D/remove stays; the new card must be legal on the bare terrain (only a Bridge replaces a water Bridge, so a replace never sinks anything); same-kind replace is legal (the way to recolor); new Thing goes last in placement order; a piece on the hex stays and the new Thing acts on it that tick; the old card is spent; a replace counts as card use for idle redraw; UI shows a dashed ring and hides the old Thing under the ghost. [agent]
