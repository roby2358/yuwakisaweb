---
name: playtest
description: Drive the En Garde! browser game headless from the CLI — boot, chargen, plan months, resolve, campaign, screenshot. Use to verify changes at the real UI (not just the headless Node sim) or to actually play the game. Covers setup, the play.js driver commands, and the gotchas that cost time to rediscover.
---

# Playtest En Garde! in a real (headless) browser

The game runs on file:// with no server. This skill drives it through the
actual UI — planner selects, buttons, gazette — via Playwright, one command
per invocation, with the save persisting in a browser profile between runs.
Use it after the `node --check` + headless-sim loop (CLAUDE.md) when a change
deserves eyes on the real surface, or when asked to play.

## One-time setup (per machine)

Chromium is already cached by Playwright; it needs system libs that WSL
images lack. If launch fails with `libglib-2.0.so.0: cannot open shared
object file`:

```bash
sudo apt-get update -qq   # package lists are often stale — search fails without this
sudo apt-get install -y -qq libglib2.0-0 libnss3 libnspr4 libatk1.0-0 \
  libatk-bridge2.0-0 libdbus-1-3 libx11-6 libxcomposite1 libxdamage1 \
  libxext6 libxfixes3 libxrandr2 libgbm1 libxcb1 libxkbcommon0 libasound2 \
  libcups2 libcairo2 libpango-1.0-0 libexpat1
```

Per session, in a scratch directory:

```bash
cp <this skill dir>/play.js <scratch>/ && cd <scratch>
npm install playwright-core --no-audit --no-fund --silent
node play.js boot
```

The driver expects the headless shell at
`~/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell`
and the game at `file:///work/yuwakisaweb/ideas/engarde/index.html` — edit the
constants at the top of play.js if either moves. The browser profile (and so
the game save) lives in `<scratch>/profile/`; delete it or `node play.js boot`
to start over.

## Commands

```
node play.js boot                    # clear save, fresh chargen; prints build tag + candidate
node play.js reroll                  # another birth
node play.js begin [name]            # to Paris! (candidate re-rolls between invocations — begin
                                     #   takes whoever is on screen NOW, not who boot printed)
node play.js look                    # full page text
node play.js shot <file.png>         # full-page screenshot into the scratch dir
node play.js advice                  # ask the knowing friend, print the gazette entry
node play.js join-club <id>          # ids: bothwells hunters horseguards bluegables frogpeach redphillips
node play.js join-regiment <id> <rankIndex>   # ids as in core.js REGIMENTS (pm, rfg, frontier, ...)
node play.js month <w0> <w1> <w2> <w3>        # plan all four weeks AND resolve, one invocation
node play.js volunteer               # summer campaign (resolves whole season, auto-returns)
node play.js affair <i> <response>   # answer a pending affair of honour button
node play.js js '<expr>'             # evaluate in page context; full game state and functions
```

Week specs for `month`: `idle` `duty` `carouse` `bawdy` `petition`,
`gamble:STAKExBETS` (e.g. `gamble:20x5`), `court:ladyN`, `toady:npcN`,
`pref:kind:index` (e.g. `pref:title:0`, `pref:appointment:3`).

## Gotchas (each of these cost real time)

- **Every invocation reloads the page.** Planner selections are DOM state,
  not save state — plan and resolve in the SAME invocation (`month` with
  args). A bare `plan`-style command followed by a separate resolve does
  nothing.
- **Chargen re-rolls on reload** for the same reason. `begin` immediately
  after `boot` gets a different character than boot printed. Roll with it or
  read the overlay text that `begin` echoes back.
- **confirm() dialogs are auto-accepted** by the driver (resignations, new
  game over a live character). Don't rely on a dialog to stop you.
- **Gazette is newest-first**; `month` prints the top two entries.
- **Check the build tag** (`boot` prints it) against BUILD in index.js —
  if they differ the profile cached stale scripts; bump `?v=` per CLAUDE.md.
- Lady/NPC ids don't match display order — list them from state:
  `node play.js js "courtableLadies(game).map(l=>l.id+' '+l.name+' SL'+l.sl)"`.
- Plan validation errors (e.g. a Private owes 2 duty weeks) print after the
  gazette as `--- errors:` — a month that "did nothing" usually failed
  validation and did not resolve.
- To craft a scenario (cooldowns, wealth, rank), build it with the page's own
  functions and save, then reload:
  `node play.js js "const s=newGame(generateCharacter()); /* tweak */ saveGame(s)"` —
  next invocation boots from that save through the real loadGame() shims.
