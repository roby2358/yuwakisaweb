# PowerRange

A hex-and-counter game of warfare between warring city-states — that is secretly an
**economics simulation**. Warfare has evolved into an arms race of massive cannon platforms
(plasma, laser, kinetic, incendiary) whose only counter is shields (physical, energy). The
twin dimensions that decide everything are **power** and **range**. Into the stalemate come
the **shield knights**: cheap, fast, man-mobile units that walk through the kill zone under a
regenerating shield to disable and capture machines worth ten times their cost.

You don't win battles — you win balance sheets. Every shot, shield, and idle machine is a
line item drawn from one Treasury. Bankrupt the enemy or take their Foundry.

See [DYNAMICS.md](DYNAMICS.md) for the full design and rules.

## The shape of it

- **Economy at every level.** Control territory → earn income → spend on building units,
  firing ammunition, and paying upkeep. Idle expensive platforms bleed you dry.
- **Power vs Range vs Shield vs Mobility.** Every unit is a point in a priced design space;
  one budget can't max all four. Range is priced super-linearly — area is expensive.
- **Damage/shield matchup.** Kinetic, laser, plasma, and incendiary each beat or bounce off
  physical vs energy shields differently, so a cheap monoculture army is exploitable.
- **Occupy to earn, shell to deny.** Firepower suppresses enemy income; only bodies on the
  ground collect it — so you must advance into harm's way.
- **The shield-knight gambit.** The titular asymmetric counter: cheap, fast, all-absorbing
  one-shot shield. Reach an enemy platform and disable it; hold it and capture it.

## Win / Lose

- **Win:** capture the enemy Foundry, or force their economic collapse.
- **Lose:** the same, done to you.

## UI (inherited baseline)

- Right-click drag pans the map; the context menu is suppressed.
- Space or Enter ends the turn.
- Click a friendly counter to select it; reachable hexes highlight in yellow.
- Click a highlighted hex to move; click the counter again or empty space to deselect.
- Counters are rounded squares with a 2px gray depth shadow; your faction is gold.

## Running

No build step. Serve over HTTP so ES6 module imports resolve:

```bash
npx serve .
# or
python -m http.server 8000
```
