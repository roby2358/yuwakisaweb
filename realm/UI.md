# Realm - UI Dynamics

This document describes the user interface behavior, visual feedback, and input handling for Realm. For game mechanics and formulas, see [DYNAMICS.md](DYNAMICS.md).

---

## Controls

### Mouse

- **Click hex:** Select hex, auto-select unit with moves remaining (see Unit Selection)
- **Click selected unit's hex:** Deselect unit
- **Click valid move hex:** Move selected unit (deselects if moves exhausted)
- **Click enemy hex:** Attack with selected unit
- **Click Society panel:** Open realm management interface
- **Click Era button:** View era information and advancement requirements

### Keyboard

- **Escape:** Close modal or clear selection
- **Enter/Space:** End turn (if no modal open)
- **Any key:** Dismiss combat report (during reporting mode)

---

## Unit Selection

### Selection Priority

When clicking a hex with units, the first unit with moves remaining is auto-selected. Since units are sorted each turn (see Stacking Order in DYNAMICS.md), the selection priority follows the same order:
1. Cavalry
2. Heavy Infantry
3. Infantry
4. Worker

When multiple units occupy a hex, action buttons allow switching between them.

### Deselection

Units are automatically deselected when:
- Movement is exhausted (movesLeft reaches 0)
- The turn ends

**Units with 0 movement are never selected.** If a unit runs out of moves after moving or attacking, it is immediately deselected. Clicking a hex will only auto-select units that have moves remaining.

At the start of a new turn, the **largest settlement** is automatically selected (random if tied for largest tier). If there are units with moves at that settlement, one will be auto-selected.

---

## Combat Reporting

After end-of-turn processing, the game pauses to display visual feedback if any notable events occurred:

- **Yellow bang markers** appear on hexes where enemies attacked (units, settlements, or installations)
- **Red bang markers** appear on hexes where a friendly unit was killed or an enemy was killed by counter-attack
- **Yellow exclamation marks** appear on hexes where a monster spawned
- The "End Turn" button changes to "Continue"
- All game interactions are blocked during this display
- Clicking anywhere or pressing any key dismisses the markers and resumes play
- Turns with no events proceed without pausing

---

## Society Panel

The society panel displays four bars that transition from **yellow (0%) to red (100%)** to indicate severity.

Click the **Society panel** to open the realm management interface. This displays:
1. A narrative description of the realm's current state
2. Current effects of each society parameter
3. Three available actions to manage the realm

For action mechanics and costs, see [DYNAMICS.md](DYNAMICS.md).
