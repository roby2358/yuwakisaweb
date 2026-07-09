# CHARTER

*A game of governance in the river-city of Lexden.*

You are Regent for 24 seasons. You govern by writing — edicts, rulings, answers to
petitions — and everything you write will be read back to you literally, by clerks,
courts, and opportunists. Ratify the Grand Charter (3 factions endorsed, legitimacy
50+, no contradictions in your own law book) before the heir comes of age.

Design rationale lives in [DYNAMICS.md](DYNAMICS.md) — read it to understand *why*
each mechanic exists before changing it.

## Play

Open `index.html` in a browser. No build step, no dependencies.
Reproduce a specific regency with `index.html?seed=12345`.

- Left pane: the realm — estates, Charter progress, law book, portents, actions.
- Right pane: the chronicle — events, petitions, and disputes scroll here; the
  interactive ones carry buttons until you answer them or they resolve themselves.
- 3 action points per season. Ignoring things is legal and always costs something.

## Test

```
node test/engine.test.js       # engine rules
node test/winnability.test.js  # a competent policy must win sometimes, late
node test/ui.smoke.test.js     # full UI render/dispatch cycle on a DOM stub
```

## Files

- `js/data.js` — all content: factions, events, petitions, interpretation
  scenarios, endorsement prices. One code path per kind; items are parameter sets.
- `js/engine.js` — pure game logic, deterministic per seed, no DOM.
- `js/ui.js` — rendering and the single delegated click dispatcher.
- `js/main.js` — bootstrap.
