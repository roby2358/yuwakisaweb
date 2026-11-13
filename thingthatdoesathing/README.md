# Thing Factory

A thing that does a thing. Build a contraption on a hex board, one Thing at a time,
while it runs. Pick the board at New Game: 16 × 10 fits the screen; 20 × 20, 30 × 30 and
60 × 60 pan. Crates come out of the source; get them to the target. Milestones at 10, 20, 50, 100, 200,
500, 1000, and on; the factory never ends. On bigger boards each milestone opens a new
crate color (up to 2 on 20 × 20, 3 on 30 × 30, 4 on 60 × 60), with its own target: half the
time from a new source, half the time from one already running, so a line has to split. A
target takes only its color; other colors can't get onto it, though a Rocket flies over.
Crates keep coming every third tick, a random open color each time, until the board holds its
cap (more on bigger boards, one more per milestone). After the first milestone some come out
as big crates, drawn bigger and worth 10 delivered (or 10 lost), and each milestone makes them
commoner.
Every Thing does exactly one thing, every tick.

It needs a mouse and a keyboard (hover, right-click, the wheel, a few letter keys), so it plays
on a computer, touchscreen laptops included. A phone or tablet gets a short sorry page instead
of the game.

Forked from the Hex & Counters base (`../ideas/hexandcounter`). See [DYNAMICS.md](DYNAMICS.md)
for why it works and [ONTOLOGY.md](ONTOLOGY.md) for the rules.

## The Things

| Thing | Does |
|---|---|
| Belt | moves what's on it 1 hex in its facing |
| Spring | flings what's on it 3 hexes, over lakes and up to 2 mountains (it can't land on a mountain, so it comes down short of one); it skids on if it lands on ice |
| Rocket | blasts what's on it up to 8 hexes, stopping early at something solid or the outer sea, and delivering if it crosses its color's target (it flies over lakes); a crate that lands on ice skids on (unless it splatted a gremlin, then it stops there); splats any gremlin it hits, and any gremlin riding it |
| Cannon | lobs what's on it over the next 4 hexes, whatever is on them (water, mountains, Walls, crates, gremlins: it touches none of them), then moves it into the 5th like a Belt would (it can sink, deliver, slide on ice or bump a line there); if the 5th is blocked it comes down on the 4th, and if the 4th can't take it either the Cannon doesn't fire |
| Pusher | pushes whatever is on the hex in front of it 1 hex on |
| Puller | reaches across the hex in front and pulls whatever's beyond it into that hex |
| Wall | nothing gets in (never on a source: the crates must flow) |
| Trap | a gremlin that comes onto it dies (a new one climbs out on the shore); crates are safe |
| Bridge | built on water; carries what's on it 1 hex in its facing, like a Belt over water |
| Slide | ice you can build, on plains or water (not on ice, which already slides): what comes onto it keeps sliding the same way (a Spring or Rocket that lands on it skids on) |

A new game deals only Belts, Bridges, Walls and Traps. Each milestone unlocks the next card
and the milestone banner shows it: Pushers and Pullers (with the second color; a 16 × 10 board skips
them), then the Slide, the Spring, the Rocket, and the Cannon last. Cards already in your hand stay.

Pushers and Pullers always work in one crate color: a red one moves only red crates, and every
gremlin. That's how you split a mixed line, so they're only dealt once a second color opens.
The card comes plain; when you place it, a little square of swatches pops up beside the hex
and you pick its color (click a swatch or press its number). The color is for good: to change
it, place another one over it.
They're rare cards; about one per color is all a factory needs.

Terrain: water sinks pieces, ice makes them slide, mountains block. A piece that runs into
another standing on ice (or a Slide), on the ground or out of the air, shoves it and the
pieces right behind it two hexes on, and comes to rest right behind them. Gremlins wander and
ride your belts, and a gremlin that steps onto a crate wrecks it (one pushed into a crate
is just stopped, or bumps it on if the crate is on ice). A gremlin
that comes onto a target dies there, so they can't camp it.

## UI

- `1` `2` `3` or click a card to pick it; legal hexes tint yellow
- `R` / `Shift+R` / mouse wheel turn the Thing before placing
- A Pusher or Puller asks for its crate color after you click its hex: click a swatch or press `1`–`4`; Esc, right-click or a click elsewhere backs out with the card still picked
- Click a yellow hex to place it; the world ticks once and animates. A yellow hex with a dashed ring holds a Thing: placing there replaces it (the old Thing's card is gone)
- With no card picked, click a hex to select it: it lights up, a mover shows a white arrow, and Go holds. Click it again to turn a Belt/Spring/Rocket/Cannon/Pusher/Puller clockwise (free: no tick); click anywhere else (or Esc) to let go
- `D` removes the Thing on the selected hex (click it first), leaving the hex bare and letting go of it; the card is gone and the world ticks once. With nothing selected, `D` does nothing
- Ten ticks in a row without placing or discarding a card redraws one card at random (it glows)
- `B` blows up the crate under the cursor (a stuck line); it counts as lost and the world ticks once
- Pick a card, then click Discard (right of the cards) or press `X` to throw it away; the world ticks once
- Space: one tick, then stop. With Go running, Space finishes the tick in flight and turns Go off
- Wait: let it run one tick
- Enter / Go (top centre): keep ticking until Pause (Enter again finishes the tick in flight and stops); picking a card or selecting a hex holds the run
- Esc or right-click puts the card back; left-drag pans (the board can't be dragged off the screen)
- Map `1` `2` `∞` (buttons under the top-left bar): the board at full or half size, or the whole board in the space above the hand; zooming keeps the middle of the screen where it is, and every new game starts at `1`. Buttons only: the number keys pick cards and the wheel turns the Thing
- Top right: crates delivered toward the next milestone (and per color, once there are two), Ex-gremlins (gremlins done in), Trapped (gremlins a Trap caught), and crates lost
- Help (top left): the keys legend, also shown once when the first game opens; ticks hold while it's open
- New Game: pick a board size (click or `1`–`4`); Esc keeps the current game
