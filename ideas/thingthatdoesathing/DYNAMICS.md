# Thing Factory — Dynamics

Why it's fun. Rules are in [ONTOLOGY.md](ONTOLOGY.md); numbers are named here, never quoted.

## Theme

**A tinkerer's delight.** You set something up, let it go, and watch it do the thing.
Then a gremlin rides your belt into the sea, and you laugh and fix it.

## Drivers

1. **Accumulation and windfall.** Every Thing you place stays. The first crate takes a
   dozen turns of building; once the line works, crates arrive on Wait. An ice patch or a
   well-aimed Spring is a shortcut you didn't pay belts for.
2. **Comedy.** Overlapping Things do silly things. A Puller next to the sea yanks a passing
   gremlin into it, a gremlin stands on a belt and gets delivered to nowhere, and a Spring
   flings a crate across ice straight into the water.
3. **Readable consequences.** Every Thing does one visible thing, and the tick is animated
   hop by hop, so you can point at the hex where your plan broke.

## Key mechanics (one per driver)

- **Things are permanent, and every command ticks** (accumulation). Placing is investing.
- **One shared `step` for every movement**, with ice and water (comedy). A gremlin, a crate,
  a Spring, and a slide all obey the same rule, so they collide in ways nobody scripted.
- **Each Thing does one thing, drawn with a facing arrow** (readable). A Belt or Spring
  moves what's on it; a Puller reaches two hexes ahead. You can always point at the Thing
  that moved a piece.

## Secondary mechanics, woven in

- **Random hand of `HAND_SIZE`** → feeds accumulation: you build with what you're dealt,
  and a Puller in hand asks where it can reach from.
- **Gremlins** → feed comedy and keep routes from going stale. They ride movers and block
  without malice.
- **Rotate** → makes a misplaced mover fixable without undo.
- **`SOURCE_INTERVAL`** → paces the factory; a jammed source just waits.

## Turn structure

1. You **place** a card, **rotate** a mover, or **wait**.
2. **Tick:** Things act in placement order (pushers on the piece on them, Pullers on the
   piece two hexes ahead), each piece moving at most once.
   Unmoved gremlins wander. The source may spawn a crate.

## Strategies

- **Opening:** build the spine. Lay belts from the source toward the target; dump cards
  you can't use somewhere harmless.
- **Midgame:** patch around gremlins and jams. Fence the line with Walls where gremlins
  keep wandering on, and put Bridges where water forced a detour.
- **Endgame:** Wait and watch. Once the line works, every tick is a crate closer.
- **Recurring tension:** use the odd card now (a Spring on a straight run, a Puller to
  catch crates at the end of an ice slide or to clear gremlins off the line) or dump it and
  wait for belts. A Puller can't sit in the line, so it always costs a side hex.

### Anti-strategies

| Anti-strategy | Prevention |
|---|---|
| Fill the board with Walls to cage gremlins | Each card is one turn; turns are the score |
| Stack two pieces on one hex to "store" crates | One piece per hex (R-7) |
| Ride a crate down a belt line twice in one tick | Each piece moves once per tick (R-13) |
| Build on the target to block gremlins | Nothing may be built on the target (R-8) |
| Spam Wait forever for a perfect hand | Waiting also counts on the turn score; the hand never changes on Wait |

### Strategy ↔ mechanic cross-check

Every Thing kind is used by some strategy above (Belt: spine; Wall: fencing; Bridge:
water detours; Spring: straight runs; Puller: side-feed, slide catcher, gremlin drowner). Rotate is used to
fix misplacements. Gremlins create the midgame.
