# Thing Factory

A thing that does a thing. Build a contraption on a small hex board, one Thing at a time,
while it runs. Crates come out of the source; get `DELIVER_GOAL` of them to the target.
Every Thing does exactly one thing, every tick.

Forked from the Hex & Counters base (`../hexandcounter`). See [DYNAMICS.md](DYNAMICS.md)
for why it works and [ONTOLOGY.md](ONTOLOGY.md) for the rules.

## The Things

| Thing | Does |
|---|---|
| Belt | moves what's on it 1 hex in its facing |
| Spring | flings what's on it 3 hexes |
| Puller | reaches across the hex in front and pulls whatever's beyond it into that hex |
| Wall | nothing gets in |
| Bridge | built on water; pieces cross instead of sinking |

Terrain: water sinks pieces, ice makes them slide, mountains block. Gremlins wander and
ride your belts.

## UI

- `1` `2` `3` or click a card to pick it; legal hexes tint yellow
- `R` / `Shift+R` / mouse wheel turn the Thing before placing
- Click a yellow hex to place it; the world ticks once and animates
- With no card picked, click a placed Belt/Spring/Puller to turn it clockwise (ticks)
- Space / Enter / Wait: let it run one tick
- Esc or right-click puts the card back; left-drag pans
