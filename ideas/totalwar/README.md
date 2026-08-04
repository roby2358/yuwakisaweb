# Total War

A browser hex-and-counter grand strategy game: Avalon Hill's *Third Reich* as the
skeleton, in a WWII-shaped world where dieselpunk industry, high fantasy, low fantasy,
and retro-futurist sci-fi field armies side by side. Built on the Hex & Counters
baseline (plain scripts, no build step — double-click `index.html` to play).

See [DYNAMICS.md](DYNAMICS.md) for the design and rules.

## The game in one paragraph

Four powers fight over 24 cities. Cities pay Command Points; every stack you activate
costs CP — cheap inside your command web (capital/HQ radius), double beyond it — and CP
also buys new units, so operations, occupation, and production compete for one budget.
Conquered cities revolt unless someone stays behind to hold them. Combat is an
odds-based CRT with zones of control; emptying a defended hex lets Armor (and Dragons)
exploit through the gap, and a defender with no retreat path is destroyed — pockets
kill. Hold 5 of the 9 victory cities for 3 consecutive turns to win, while every rival
dogpiles whoever is closest to winning.

## UI

- Pick a faction on the intro screen; each has one unique unit that breaks a core rule
- The map is scrolled by right-click drag (no context menu)
- Click a friendly stack to select it: yellow = moves, red = attacks (hover for the
  odds preview), orange = rocket bombardment targets
- Click the selected stack again to split it: each click cycles the selection through
  the stack — whole stack (solid ring) → each unit in turn (dashed ring) → deselected.
  A single unit moves alone and leaves the rest behind; attacks always pool the whole
  hex, so they're offered only on the whole-stack selection
- Click a friendly city to open the build panel (one build per city per turn)
- Space or Enter (or the End Turn button) ends your turn; the opponents' round plays
  out action by action on screen
- Esc deselects
- Counters are rounded squares with depth lines and NATO-style unit symbols — APP-6
  classics (infantry ✕, armor ellipse, artillery ●, fixed-wing bowtie, HQ flag,
  rocket arrow, barred-✕ garrison, half-✕ militia) plus invented symbols in the same
  language for the uniques (dragon wings, warden sword, colossus walker); stacks draw
  offset; entrenched units show an inner ring; spent stacks dim; gold rings mark
  victory cities, ★ marks capitals, red `!` marks your conquests at risk of revolt
