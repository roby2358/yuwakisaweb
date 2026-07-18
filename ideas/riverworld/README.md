# RIVERWORLD — Up the River

A turn-based expedition game based on Philip José Farmer's *Riverworld*.
You wake on the bank of a million-mile river and give the River your name —
whoever you were in life (leave it blank and you wake as Richard Burton).
Somewhere at the headwaters stands a Tower. Walk there — at your own pace.
The River is patient: **your game saves itself every turn** and waits for you
to come back, tomorrow or next month. Nothing can end the run but the Tower.

## Play

Double-click `index.html`. No build, no server, no modules — plain script tags.

- **Click** one of your people, then a lit hex to move. Click an adjacent red-ringed enemy to attack.
- **Space / End Turn** ends the turn. **Tab** cycles your band. **Mouse wheel / arrows** scroll the valley.
- **The Gong** fires every 12 turns: anyone within 1 hex of a grailstone (the gray mushrooms) is fed
  and draws a random grail item. Miss two gongs and you go **famished** — slow, feeble, HP pinned
  low — until the next meal. Hunger never kills; it only humbles.
- Stones held by **grail-slavers** yield double goods — if you can take them. Kill the captain and
  the stone is free, its hoard is yours, and its captive may join you.
- **Recruit** wanderers at free stones (walk beside them): Alice, Kazz, Cyrano, Joe Miller,
  Sam Clemens — each breaks a different rule. A companion who dies wakes far downriver…
  but the River sometimes gives back.
- Camp as long as you like — but eating too often in one stretch attracts **press-gangs**.
  Camping is never quiet; it is also never fatal to the run.
- Cut 4 **bamboo** to build a raft. The river is fast, but it feeds no one, and the current
  drags you downriver unless Sam is aboard.
- If your leader dies — by blade or by choice (the **Suicide Express**) — they *always* wake
  again, at a random stone in the stretch, half the hoard left behind. Death is a toll, not an
  ending.
- **Win:** reach the Tower past the polar ice — where there are no stones at all.
  Hoard rations, or crawl the last leagues famished. Both make a story.
- **⚓ New River** (bottom of the panel) erases the save and starts over.

## Design

See `DYNAMICS.md` — the design journal: theme, psychological drivers, and why each mechanic exists.

## Tests

```
node --test test/*.test.js
```

The pure-logic files (`js/hex.js`, `js/data.js`, `js/map.js`, `js/game.js`) load into a Node `vm`
context exactly as script tags would; `test/ui-boot.test.js` boots the full stack against a DOM shim.
