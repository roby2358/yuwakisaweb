# DUSTRUNNER

A long-playing, recurring hex game in an alien badlands. You're stranded in the Vesk
Barrens with a gravbike and 40 credits; an offworld ticket costs 4,000. Ride out, park,
harvest what the waste grows, and haul it home past bandit gangs and the two things big
enough to eat your ride — then sell it at drifting markets or craft it into permanent
upgrades at the starport workshop. The world persists in localStorage; there is no game
over, only corpse runs.

Built on the [Hex & Counters](../hexandcounter/) baseline. See
[DYNAMICS.md](DYNAMICS.md) for the design journal and full rules, and
[UI_CONTROLS.md](UI_CONTROLS.md) for the controls spec this UI implements.

## Running

No build step. Double-click `index.html` (runs from `file://`), or `npx serve .`.

## UI

- Right-drag pans; hover shows terrain (and node yield) in the HUD
- Click P to select — yellow hexes are reachable, red hexes are attackable (on foot)
- M mounts/dismounts the gravbike (mounted: fast, crosses acid flats, can't act)
- Space/Enter is the context action: enter a location, raid a camp, harvest a node,
  else end the day; E always ends the day
- Entering a settlement opens its panel: sell cargo, repair the bike; the starport adds
  the workshop, replacement bikes, and the ticket
- Esc closes panels / deselects; New World abandons the save and rerolls

## Verification (headless harnesses in `test/`)

```bash
node test/sim.js         # invariants: generation, 150-day random sim, save/load, determinism
node test/econbot.js     # pacing: greedy prospector bot, reports ticket day per seed
node test/screenshot.js  # browser smoke via puppeteer (npm install puppeteer --no-save)
```
