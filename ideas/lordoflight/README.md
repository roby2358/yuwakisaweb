# The Great-Souled Sam

A single-player strategy game adapted from Roger Zelazny's *Lord of Light*.

**To play:** double-click `index.html`. No server, no build, no modules — plain
`<script>` tags.

You are Sam, preaching Acceleration against the gods of Heaven. Raise
**Enlightenment to 100** by converting cities before Heaven's hunters — Agni,
Kali, and Yama — run you out of karma and bodies.

- **Preach** to convert cities (3 sermons each). Converted cities tithe karma
  and enlightenment every turn — but each sermon reveals your location and
  raises Heaven's Wrath, which summons the gods at Wrath 20 / 45 / 70.
- **Travel** (click a glowing city) and **Meditate** to hide; the gods hunt the
  place you were *last seen*, not where you are.
- At **Hellwell**, bind Rakasha demons to harry a god — but demons break loose
  and possess your cities.
- In battle, **channel karma** for power, or flee. If you die, karma buys a new
  body (with a new random perk) — each rebirth costs more. Die broke, and the
  death is real.

## Files

- `index.html`, `style.css`, `ui.js` — presentation
- `engine.js` — pure game logic (also loadable in Node)
- `test/engine.test.js` — unit tests: `node test/engine.test.js`
- `DYNAMICS.md` — the design journal: why each mechanic exists
