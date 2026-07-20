# Laurels — project notes

Persistent hex-and-counter prototype (acquisition / prestige / destruction).
`DYNAMICS.md` is the design authority — read it before touching mechanics, and
update it when mechanics change.

## Files & load order

Plain `<script>` globals, NOT ES modules — the game must run from `file://` on
a double-click. `index.html` lists scripts in dependency order:
`artifacts → displayartifacts → rando → namegen → hex → gamestate → gameengine → gameui → index`.
Each module is an IIFE returning one global.

| Module | Global | Holds |
|---|---|---|
| `artifacts.js` | `GameArtifacts` | rules-data: terrain, nodes, foes, skills, ranks, RULES constants. No colors, no pixels. |
| `displayartifacts.js` | `GameDisplayArtifacts` | client-only display attrs (colors, sizes, glyphs) |
| `gamestate.js` | `GameState` | serializable data bag only; toJSON/loadJSON seam |
| `gameengine.js` | `GameEngine` | rules + world gen; DOM-free; actions return outcome objects |
| `gameui.js` | `GameUI` | canvas render, HUD, input, overlays, localStorage persistence |
| `hex.js` / `rando.js` / `namegen.js` | shared libs (hex math, seeded RNG, phoneme names) |

Invariants: the engine never reads `GameDisplayArtifacts`, never touches the
DOM, and re-derives legality itself (UI highlight sets are hints). All
randomness flows through `Rando`, seeded from `state.seed`. Every payout rolls
gaussian (`roll()`); costs never roll.

## Verify (no tests — this is a playtest-driven prototype)

Do NOT add a test framework or .test.js files. Verify headless with Node:
concatenate `artifacts rando namegen hex gamestate gameengine` plus a sim
harness (bot plays hundreds of turns, asserts invariants), and boot the UI
under DOM stubs. Then browser-playtest — canvas behavior can't be checked
headless. No save-game migration while prototyping: stale saves break into a
fresh world by design (`GameUI.start`).
