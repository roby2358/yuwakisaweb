# TIGER! TIGER!

A turn-based revenge hunt adapted from Alfred Bester's *The Stars My Destination*
(*Tiger! Tiger!*). Plain HTML/CSS/JS with classic script tags — no build, no
modules, no server.

## Play

Double-click `index.html`.

You are Gully Foyle. Five crewmen of the Vorga — the ship that left you to die —
are hiding on the map. Find them, make them talk, learn who gave the order, and
reach the citadel. Dagenham's hunters are looking for you the whole time.

- **Walk**: arrow keys / WASD / click an adjacent tile. Every tile you walk is
  *memorized*.
- **Jaunte**: click any memorized tile to teleport there — but the jaunte-shock
  alerts every hunter within 7 tiles of your arrival.
- **Rage**: wounds and confessions stoke it. At full rage the tiger stigmata
  blazes for 5 turns: 3 actions per turn, jaunte to anything you can *see*,
  PyrE becomes detonable — and every hunter knows exactly where you are.
- **Terrain**: radiation ☢ burns you but hunters won't enter; the Nomad wreck ⌂
  heals 1 per turn; informants ? each sell one crewman's location; jaunte
  stages ◎ are where new hunters arrive.
- **PyrE** ✶: one use. Detonable only while the tiger burns. Vaporizes every
  hunter within 5 tiles and levels the ruins.

## Files

- `index.html`, `css/style.css` — page and styling
- `js/artifacts.js` — static content and all tuning constants
- `js/state.js` — seeded RNG, map generation, state struct
- `js/engine.js` — rules engine (DOM-free; actions return event lists)
- `js/ui.js` — canvas rendering, animation, input
- `DYNAMICS.md` — design journal: why the mechanics are what they are

## Tests

Open `test/tests.html` in a browser, or run headless:

```
node test/run-node.js      # engine unit tests
node test/run-ui-smoke.js  # UI wiring smoke test under a DOM shim
```
