# LAURELS

*Rest on them and be forgotten.*

A persistent hex-and-counter game of **acquisition, prestige, and destruction**.
You are a hero whose legend must be fed: every dawn your renown melts by a
tenth, and rank, title, and privilege go with it. The only fuel is deeds —
hauls dragged home through hostile country, and great names struck from the
world. You cannot lose. You can only be forgotten.

## Run

Double-click `index.html`. No build, no server, no modules — plain script
includes, works from `file://`. The world autosaves to localStorage every turn
and resumes where you left it.

## The loop

- **Acquire.** Harvest forage ❀, ore ◆, and relics ✦ (the outer rings pay
  best), hunt beasts, and carry it all home. Nothing counts until it's banked
  at the Hall ⌂ or a holding — falling in the field scatters half your pack.
- **Rise.** Banked hauls mint wealth and renown. Climb the ladder — Unsung,
  Whispered, Known, Honored, Famed, Exalted, Legendary, Mythic — each title a
  cumulative privilege, none of them owned: the dawn tax never stops. The nine
  thriving skills (Gathering, Delving, Hunting, Combat, Warding, Crafting,
  Trading, Building, Presence) level by use, uncapped. Raise the six works,
  Cairn through Colossus, for renown every dawn.
- **Destroy.** Topple named dooms ✸ for windfalls of relics and glory — or
  sack a holding, if you can bear the name. The Reckoning keeps score, and it
  answers: new dooms rise, raiders press, and named champions ride out to tear
  down what you built. Intercept them on the march, or mourn, rebuild, avenge.

## Controls

Click **@** to select · yellow moves, red attacks · **G** harvest · **B** bank
· **C** craft (at the Hall) · **M** build monument · **T** skills & ladder ·
**Space/Enter** ends the turn · right-drag pans · Sack button appears at
holdings (it asks first).

## Design

See `DYNAMICS.md` for why it's fun before what it does — the drivers, the
mechanics woven into them, strategies, and the anti-strategies the sim runs
killed (treasure recursion, monument-idle Mythic, champion extermination
sweeps).
