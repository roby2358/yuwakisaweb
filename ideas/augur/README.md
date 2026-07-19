# AUGUR

You are the village augur. Your visions are always true and never complete — the
future arrives in facets (*what · where · when · who · how hard*), and every day is
triage: divine another facet and carry the weight of knowing, raise a ward where you
dare to guess, or warn the village and spend its patience. Fame finds the augur who
is seen to be right — and fame draws grander dooms.

No ending, no defeat. Dooms land, stones are raised by the chapel, the vale endures,
and so do you. Autosaves at dawn; meant to be picked up and put down over days and
weeks.

## Run

Double-click `index.html`. Plain script includes, no build step, runs from `file://`.

## Controls

- Click the gold **✶** to select the augur; click a yellow hex to move. Right-drag pans.
- **W** work a field or the mill for supplies · **P** raise wards at the building
  underfoot · **F** festival at the Wan Hart · **Space/Enter** ends the day.
- Divine at **the Shrine** (or the **Standing Stones**, for half the Madness) via the
  vision cards on the right. Warn at **the Chapel** or **the Wan Hart** once you know
  *what* and *where*.
- Purple diamonds on the map are dooms whose place you know; the number is days left.
  An orange ring means the village keeps vigil there.

## The shape of a day

1. Dawn: maybe a vision. Read what's revealed; the riddles on veiled facets are
   drawn from fixed pools — a devoted augur learns to read them for free.
2. Spend actions (3, fewer under heavy Madness) and 6 movement.
3. End the day: dooms whose day has come land visibly — damage rolls gaussian, wards
   and vigil-aid subtract, the matching ward is consumed. Wrong wards remain, forever,
   as monuments to your reasoning.

See `DYNAMICS.md` for why each mechanic exists.

## Files

Biomewars-style split: `artifacts.js` (rules data) → `displayartifacts.js` →
`rando.js` / `hex.js` (shared libs) / `namegen.js` → `gamestate.js` → `gameengine.js`
(DOM-free, runs headless) → `gameui.js` → `index.js`.

Headless verify: concat `artifacts displayartifacts rando hex namegen gamestate
gameengine` + a driver script, run with node (the engine has no DOM dependencies).
