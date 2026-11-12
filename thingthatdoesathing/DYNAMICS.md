# Thing Factory — Dynamics

Why it's fun. Rules are in [ONTOLOGY.md](ONTOLOGY.md); numbers are named here, never quoted.

## Theme

**A tinkerer's delight.** You set something up, let it go, and watch it do the thing.
Then a gremlin rides your belt into the sea, and you laugh and fix it.

## Drivers

1. **Accumulation and windfall.** Every Thing you place stays. The first crate takes a
   dozen turns of building; once the line works, crates arrive on Wait. An ice patch or a
   Spring hopping a lake is a shortcut you didn't pay belts for.
2. **Comedy.** Overlapping Things do silly things. A Puller next to the sea yanks a passing
   gremlin into it, a gremlin stands on a belt and gets delivered to nowhere, a Spring
   flings a crate onto ice and it skids straight into the water, and a Rocket squashes the gremlin
   that wandered into its flight path.
3. **Readable consequences.** Every Thing does one visible thing, and the tick is animated
   hop by hop, so you can point at the hex where your plan broke.

## Key mechanics (one per driver)

- **Things are permanent, and every command ticks** (accumulation). Placing is investing.
- **One shared `step` for every movement**, with ice and water (comedy). A gremlin, a crate,
  a Spring, and a slide all obey the same rule, so they collide in ways nobody scripted.
- **Each Thing does one thing, drawn with a facing arrow** (readable). A Belt or Spring
  moves what's on it; a Pusher shoves the hex in front; a Puller reaches two hexes ahead. You can always point at the Thing
  that moved a piece.

## Secondary mechanics, woven in

- **Random hand of `HAND_SIZE`** → feeds accumulation: you build with what you're dealt,
  and a Puller in hand asks where it can reach from. Sit on a hand for
  `IDLE_REDRAW_TICKS` ticks without playing or discarding and one card turns over on its own,
  so waiting out a line still slowly refreshes your options.
- **Cards unlock by milestone** (D-30) → feeds escalating commitment and readability: the
  first board deals only Belt, Bridge, Wall and Trap, and each milestone adds the next card
  (Pushers and Pullers with the second color, then the Slide, the Spring, and the Rocket
  last), so there's one new toy to learn each time the factory pays off. The hand you hold
  isn't touched; the new card turns up in later draws.
- **Gremlins** → feed comedy and keep routes from going stale. A drowned one climbs back
  out somewhere on the shore as a new gremlin. They ride movers and block
  without malice, until one steps onto a crate and wrecks it: a crate sitting still near a
  gremlin is a crate at risk, which is what Walls and Traps beside a line are for.
- **Rocket** → feeds windfall and comedy at once: eight hexes in one tick, over lakes, is a
  shortcut no belt paid for, but a crate that comes down in a lake or flies off the coast is
  gone. It splats gremlins it
  hits and gremlins that ride it, but they climb back out on the shore.
- **Trap** → feeds comedy and gives gremlins a cost: a gremlin that wanders, rides or slides
  onto it is done for, and the Trapped count climbs. A new one climbs out on the shore,
  so a Trap thins traffic beside your line rather than clearing it.
- **Discard (`X`)** → feeds scarcity of agency: a card you can't use costs a turn to throw
  away, so the choice between building the odd card and binning it stays real.
- **Rotate** → makes a misplaced mover fixable without undo, and costs nothing: no tick,
  so you can try a facing, look, and turn again.
- **Remove (`D`)** → makes any misplacement fixable at the price of the card and a turn,
  so building stays an investment. Pulling a Bridge out from under a gremlin is a joke
  you can set up on purpose.
- **`SPAWN_INTERVAL` and the crate cap** → pace the factory. Every third tick a source may
  spawn, but only while the board holds fewer crates than its cap (bigger boards hold more,
  and each milestone adds one). A jammed source just waits for the next chance, and while
  other colors are open, the crates go to them instead. A line full of stuck crates throttles
  itself, so a jam shows up as a quiet source rather than a flood; clearing it (or blasting
  a crate) lets the stream start again.
- **Colored Pushers and Pullers** → feed readable consequences and accumulation: a red
  Pusher beside a mixed line knocks off only the red crates, and a
  red Puller reaches in for them. Gremlins are moved by every color, so a sorter is never a
  gremlin-safe gap. They're dealt only once a second color opens, when there's a line to split,
  and you pick the color as you place one, so the rare card always sorts the line you need.
- **Targets kill gremlins** → keep the payoff flowing: a gremlin that wanders or rides onto a
  target dies there, so it can't camp the end of your line.
- **Colors** (bigger boards) → feed escalating commitment and comedy: each milestone can open
  a new color with its own target, sometimes out of the source your line already runs
  from. The working factory now has to share the board, and a shared source has to be
  split. A crate at the wrong target just sits there, jamming, which you can read at a glance.
- **Endless milestones** (10, 20, 50, 100, …) → feed accumulation: the machine keeps paying
  off, and each milestone asks whether it still holds up with gremlins wandering through.
- **Big crates** (D-34) → feed accumulation and give the payoff weight: past the first
  milestone some crates come out big, worth 10, and each milestone makes them commoner, so
  the growing gaps of the 1-2-5 series fill at a steady pace. Losing one costs 10, so a big
  crate drifting toward a lake or sitting beside a gremlin is the one you guard.
- **Go/Pause** → lets the payoff run by itself; you watch, then pick a card to step in.

## Turn structure

1. You **place** a card (on a bare hex or over a Thing, which it replaces), **discard** one, **remove** a Thing, or **wait**. You may also
   **rotate** movers first, as many as you like: turning doesn't tick.
2. **Tick:** Pushers and Pullers act first, then the other Things, each in placement order (Belts, Springs and Rockets on the piece on them, Pushers on the piece in front, Pullers on the
   piece two hexes ahead), each piece moving at most once.
   A Rocket's piece flies up to its range, over lakes. Unmoved gremlins wander. Every third
   tick a source may spawn a crate, if the board is under its crate cap.

## Strategies

- **Opening:** build the spine. Lay belts from the source toward the target (Bridges where a
  lake is in the way); Walls and Traps keep gremlins off it. Discard cards you can't use, or
  park them where they'll help later.
- **Midgame:** patch around gremlins and jams. Fence the line with Walls where gremlins
  keep wandering on, and put a line of Bridges where water forced a detour, or a run of
  Slides that shoots a crate across the lake in one tick.
- **New color:** a milestone opens a second target. If it comes out of a new source, build a
  second line; if it shares your source, the crates of both colors ride the same belt, so
  you have to split them by color before the targets.
- **Ice tricks:** a crate stalled on ice isn't a jam: the next one along shoves it, and every
  crate queued behind it, two hexes on, and takes the spot right behind them (D-33). Each bump
  moves the queue a little, so a backed-up line on an ice patch creeps forward instead of
  setting hard. A Spring or Rocket that hits a crate on ice does the same and stops there, so
  a throw aimed into a stalled queue becomes a short, sure shove. Park a Wall where the line
  should stop, or a Trap where a gremlin in the line will be pushed.
- **Long game:** press Go and watch. Once the line works, every tick is a crate closer to
  the next milestone; step in when a gremlin or a jam starts leaking crates.
- **Recurring tension:** use the odd card now (a Spring on a straight run, a Puller to
  catch crates at the end of an ice slide or to clear gremlins off the line, a Rocket with a
  clear shot at the target) or discard it and wait for belts. A Puller can't sit in the line, so it always costs a side hex.

### Anti-strategies

| Anti-strategy | Prevention |
|---|---|
| Fill the board with Walls to cage gremlins | Each card is one turn; turns are the score |
| Stack two pieces on one hex to "store" crates | One piece per hex (R-7) |
| Ride a crate down a belt line twice in one tick | Each piece moves once per tick (R-13) |
| Build on the target to block gremlins | Nothing may be built on a target (R-8) |
| Ignore new colors and keep feeding one line | The rate is shared: each open color takes its share of spawns, and an unrouted color's crates jam its source or wander into the sea (R-19) |
| Spam Wait forever for a perfect hand | Waiting also counts on the turn score; the hand never changes on Wait |
| Discard until the hand is all Belts | Each discard is a tick (D-16), so cycling the hand costs turns |

### Strategy ↔ mechanic cross-check

Every Thing kind is used by some strategy above (Belt: spine; Wall: fencing; Bridge:
water detours; Slide: free fast runs, one-tick lake crossings, and bumping crates on; Spring: straight runs and lake hops; Rocket: long shots at the target, gremlin squashing; Pusher: side-feed and knocking a color off the line (colored); Puller: side-feed, slide catcher, gremlin drowner). Discard is the opening's way to skip cards. Rotate and Remove
are used to fix misplacements. Gremlins create the midgame.
