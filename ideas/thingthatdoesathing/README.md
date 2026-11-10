# Thing Factory

A thing that does a thing. Build a contraption on a hex board, one Thing at a time,
while it runs. Pick the board at New Game: 16 × 10 fits the screen; 20 × 20, 30 × 30 and
60 × 60 pan. Crates come out of the source; get them to the target. Milestones at 10, 20, 50, 100, 200,
500, 1000, and on; the factory never ends. On bigger boards each milestone opens a new
crate color (up to 2 on 20 × 20, 3 on 30 × 30, 4 on 60 × 60), with its own target: half the
time from a new source, half the time from one already running, so a line has to split. A
target takes only its color; other colors can't get onto it, though a Rocket flies over.
Crates keep coming at the same rate, a random open color each time.
Every Thing does exactly one thing, every tick.

Forked from the Hex & Counters base (`../hexandcounter`). See [DYNAMICS.md](DYNAMICS.md)
for why it works and [ONTOLOGY.md](ONTOLOGY.md) for the rules.

## The Things

| Thing | Does |
|---|---|
| Belt | moves what's on it 1 hex in its facing |
| Spring | flings what's on it 3 hexes, over lakes; it skids on if it lands on ice |
| Rocket | blasts what's on it up to 8 hexes, stopping early at something solid or the outer sea, and delivering if it crosses its color's target (it flies over lakes); splats any gremlin it hits, and any gremlin riding it |
| Puller | reaches across the hex in front and pulls whatever's beyond it into that hex |
| Wall | nothing gets in |
| Trap | a gremlin that comes onto it dies (a new one climbs out on the shore); crates are safe |
| Bridge | built on water; pieces cross instead of sinking |

Terrain: water sinks pieces, ice makes them slide, mountains block. Gremlins wander and
ride your belts, and a gremlin that steps onto a crate wrecks it (one pushed into a crate
is just stopped).

## UI

- `1` `2` `3` or click a card to pick it; legal hexes tint yellow
- `R` / `Shift+R` / mouse wheel turn the Thing before placing
- Click a yellow hex to place it; the world ticks once and animates
- With no card picked, click a placed Belt/Spring/Rocket/Puller to turn it clockwise (free: no tick)
- `D` removes the Thing under the cursor; the card is gone and the world ticks once
- Pick a card, then click Discard (right of the cards) or press `X` to throw it away; the world ticks once
- Space / Enter / Wait: let it run one tick
- Go (top centre): keep ticking until Pause; picking a card holds the run
- Esc or right-click puts the card back; left-drag pans
- Top right: crates delivered toward the next milestone (and per color, once there are two), Ex-gremlins (gremlins done in), and crates lost
- New Game: pick a board size (click or `1`–`4`); Esc keeps the current game
