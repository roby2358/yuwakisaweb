# Thing Factory

A thing that does a thing. Build a contraption on a hex board, one Thing at a time,
while it runs. Pick the board at New Game: 16 × 10 fits the screen; 20 × 20, 30 × 30 and
60 × 60 pan. Crates come out of the source; get them to the target. Milestones at 10, 20, 50, 100, 200,
500, 1000, and on; the factory never ends. On bigger boards each milestone opens a new
crate color (up to 2 on 20 × 20, 3 on 30 × 30, 4 on 60 × 60), with its own target: half the
time from a new source, half the time from one already running, so a line has to split. A
target takes only its color; other colors can't get onto it, though a Rocket flies over.
Crates keep coming every third tick, a random open color each time, until the board holds its
cap (more on bigger boards, one more per milestone).
Every Thing does exactly one thing, every tick.

Forked from the Hex & Counters base (`../ideas/hexandcounter`). See [DYNAMICS.md](DYNAMICS.md)
for why it works and [ONTOLOGY.md](ONTOLOGY.md) for the rules.

## The Things

| Thing | Does |
|---|---|
| Belt | moves what's on it 1 hex in its facing |
| Spring | flings what's on it 3 hexes, over lakes; it skids on if it lands on ice |
| Rocket | blasts what's on it up to 8 hexes, stopping early at something solid or the outer sea, and delivering if it crosses its color's target (it flies over lakes); splats any gremlin it hits, and any gremlin riding it |
| Pusher | pushes whatever is on the hex in front of it 1 hex on |
| Puller | reaches across the hex in front and pulls whatever's beyond it into that hex |
| Wall | nothing gets in (never on a source: the crates must flow) |
| Trap | a gremlin that comes onto it dies (a new one climbs out on the shore); crates are safe |
| Bridge | built on water; carries what's on it 1 hex in its facing, like a Belt over water |
| Slide | ice you can build, on land or water: what comes onto it keeps sliding the same way (a Spring that lands on it skids on) |

A new game deals only Belts, Bridges, Walls and Traps. Each milestone unlocks the next card
and a panel shows it: Pushers and Pullers (with the second color; a 16 × 10 board skips
them), then the Slide, the Spring, and the Rocket last. Cards already in your hand stay.

Pushers and Pullers always work in one crate color: a red one moves only red crates, and every
gremlin. That's how you split a mixed line, so they're only dealt once a second color opens.
The card comes plain; when you place it, a little square of swatches pops up beside the hex
and you pick its color (click a swatch or press its number). The color is for good: to change
it, place another one over it.
They're rare cards; about one per color is all a factory needs.

Terrain: water sinks pieces, ice makes them slide, mountains block. Gremlins wander and
ride your belts, and a gremlin that steps onto a crate wrecks it (one pushed into a crate
is just stopped). A gremlin
that comes onto a target dies there, so they can't camp it.

## UI

- `1` `2` `3` or click a card to pick it; legal hexes tint yellow
- `R` / `Shift+R` / mouse wheel turn the Thing before placing
- A Pusher or Puller asks for its crate color after you click its hex: click a swatch or press `1`–`4`; Esc, right-click or a click elsewhere backs out with the card still picked
- Click a yellow hex to place it; the world ticks once and animates. A yellow hex with a dashed ring holds a Thing: placing there replaces it (the old Thing's card is gone)
- With no card picked, click a hex to select it: it lights up, a mover shows a white arrow, and Go holds. Click it again to turn a Belt/Spring/Rocket/Pusher/Puller clockwise (free: no tick); click anywhere else (or Esc) to let go
- `D` removes the Thing under the cursor, leaving the hex bare; the card is gone and the world ticks once
- Ten ticks in a row without placing or discarding a card redraws one card at random (it glows)
- `B` blows up the crate under the cursor (a stuck line); it counts as lost and the world ticks once
- Pick a card, then click Discard (right of the cards) or press `X` to throw it away; the world ticks once
- Space: one tick, then stop. With Go running, Space finishes the tick in flight and turns Go off
- Wait: let it run one tick
- Enter / Go (top centre): keep ticking until Pause (Enter again finishes the tick in flight and stops); picking a card or selecting a hex holds the run
- Esc or right-click puts the card back; left-drag pans
- Top right: crates delivered toward the next milestone (and per color, once there are two), Ex-gremlins (gremlins done in), Trapped (gremlins a Trap caught), and crates lost
- Help (top left): the keys legend, also shown once when the first game opens; ticks hold while it's open
- New Game: pick a board size (click or `1`–`4`); Esc keeps the current game
