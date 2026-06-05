# UI Controls — Interaction Patterns

A reusable description of the control scheme that drives Warrior, written so the
*patterns* can be lifted into other tactical/grid games regardless of engine.
Warrior is the reference implementation (canvas + DOM, mouse + keyboard, no
gamepad, no touch), but nothing here is specific to its rendering stack.

The whole scheme is built from a small number of composable patterns:

1. Phase-gated input
2. Two-step "select, then act" on the map
3. Modal targeting for ranged/skills
4. A single context-sensitive primary action
5. Auto-advance when the turn is spent
6. Camera pan decoupled from logic
7. Full-screen overlays that capture the next input
8. Twin activators: every HUD button has a hotkey, both enter the same state
9. Universal cancel/back

---

## 0. Input map (quick reference)

| Input | Action                                                       |
|---|--------------------------------------------------------------|
| **Left-click own unit** | Select it (compute & show move/attack range)                 |
| **Left-click reachable hex** | Move there                                                   |
| **Left-click attackable hex** | Attack (melee = move-and-strike, ranged = fire)              |
| **Left-click elsewhere** | Deselect                                                     |
| **Left-click while targeting** | Fire skill/attack at hex (if valid), else cancel             |
| **Right-drag** | Pan the camera                                               |
| **Right-click / mouse-move-out** | Cancel targeting / stop panning                              |
| **Mouse move** | Update hovered-hex readout in the HUD                        |
| **Space / E** | Primary action: interact with current location, else end turn |
| **1 … N** | Activate skill slot N (enter targeting)                      |
| **R** | Activate ranged weapon (enter targeting)                     |
| **A** | Activate melee attack (enter targeting)                      |
| **M** | Toggle full-map overview                                     |
| **C / S / I** | Toggle information panel                                     |
| **Esc** | Cancel targeting → else deselect + close panels/overlays     |

These are *defaults to copy*, not sacred bindings. The structure below is what
matters; the exact keys are swappable.

---

## 1. Phase-gated input

The single most important rule: **input is only live during the player's turn.**

The game holds one `phase` value. Map clicks and most hotkeys are ignored unless
`phase === 'player'`. While the AI resolves (an async loop with animation delays
between actions) the phase is something else, and the input handlers early-return.
A few non-gameplay keys (toggle map, dismiss an overlay) still work, because they
touch only the view, not game state.

**Why replicate it:** it removes a whole class of bugs (clicking mid-animation,
queuing moves during the enemy turn) with one guard at the top of every handler.
The handler's first lines are always the same shape:

```
if (gameOver) return;
if (phase !== 'player') return;   // or: only allow view-only keys
```

**Pattern:** a single authoritative input-phase flag, checked at the entry of
every handler, is cheaper and more reliable than disabling/enabling individual
widgets.

---

## 2. Two-step "select, then act" on the map

Map interaction is a **two-click affordance**, not click-to-move:

**First click — select.** Clicking your own unit selects it. On selection the
game *precomputes two highlight sets* from the current position and resources:

- **Reachable** — a map of `hex → movement cost`, found by a cost-limited flood
  fill (BFS/Dijkstra) bounded by remaining movement points. Enemy-occupied hexes
  are walls. The unit's own hex is removed from the set.
- **Attackable** — a set of hexes that can be struck *this turn*. For melee this
  is "enemies adjacent to the unit or to any reachable hex" (i.e. move-and-strike
  destinations). For ranged it's "visible enemies within weapon range and line of
  sight." Special gear can extend this set (e.g. a blink that adds far enemies).

Both sets are computed once at selection and cached, then drawn as overlays
(movement tint + attack tint). They are *the* source of truth for what the next
click means.

**Second click — act, dispatched by which set the target is in:**

```
clicked own hex      → deselect
clicked attackable   → attack (ranged: fire in place; melee: move adjacent + strike)
clicked reachable    → move (cost looked up from the reachable map)
clicked anything else → deselect
```

**Why replicate it:** all legality is decided *before* the second click by what's
highlighted. The click handler never re-validates geometry — it just asks "is this
key in `attackable`? in `reachable`?" This keeps the highlight the player sees and
the action they get perfectly in sync, and makes misclicks harmless (they
deselect rather than doing something surprising).

**Pattern:** compute the legal-move and legal-target sets at selection time, draw
them, and make the action handler a pure lookup against those sets.

---

## 3. Modal targeting for ranged attacks and skills

Anything that needs the player to *pick a target hex* — ranged weapon, melee
attack invoked from the HUD, or an offensive skill — enters a **modal targeting
state** rather than reusing normal selection.

The targeting state is a tiny record: `{ what, validHexes }` where `validHexes`
is the precomputed set of legal target keys for that specific action. While it is
active:

- Normal unit-selection is suppressed (the selection box is hidden), so the only
  thing a map click can do is choose a target.
- Clicking a **valid** hex executes that action at that hex and exits targeting.
- Clicking an **invalid** hex, **right-clicking**, or pressing **Esc** cancels
  targeting with no effect.

**Self-targeted abilities skip the mode entirely** — a buff or self-AoE fires
immediately on activation, because there is nothing to point at.

The activator does the up-front legality work and refuses to enter the mode if
there is nothing to do: not enough resource (aether/ammo), no enemy in range, no
line of sight → it logs a reason and stays in the normal state. So entering
targeting is itself a guarantee that at least one valid target exists.

**Why replicate it:** it cleanly separates "I'm browsing the board" from "I've
committed to an action and now I'm aiming." The same map surface serves both
without ambiguity, because the modal flag changes what a click means. The
`validHexes` set is the same precompute-and-lookup idea as §2, reused.

**Pattern:** a nullable "targeting" record (action + valid-target set) layered on
top of the normal selection state. Click-on-valid commits, anything else cancels.

---

## 4. One context-sensitive primary action

There is a single **primary action** input (Space, E, or the on-screen
"end turn" button — all three call the same function). What it does depends on
*where the unit stands*:

```
on an interactive location (town, ruin, shrine…) → open that location's dialog
otherwise                                          → end the turn
```

So the most-used button is overloaded by context instead of forcing the player to
hunt for a separate "interact" vs "end turn" control. The location dialog is its
own modal (its buttons drive sub-choices); ending the turn deselects the unit and
hands control to the AI phase.

**Pattern:** collapse "interact here" and "advance the game" into one primary
key whose behavior is chosen by the unit's current tile. Fewer controls, and the
right thing is almost always one button away.

---

## 5. Auto-advance when the turn is spent

After every action that consumes movement, the game checks: **if movement points
hit zero, end the turn automatically.** The player never has to manually end a
turn they've fully used; the manual primary action (§4) exists for ending a turn
*early* or interacting.

This pairs with a turn-economy rule worth noting because it's surfaced through the
controls: when the new turn begins, movement is refilled — but if the unit is
engaged (enemy adjacent) it refills to only half, which immediately shrinks the
reachable set the player sees next selection. The control surface (smaller
highlighted range) communicates the rule without a separate prompt.

**Pattern:** auto-advance when the turn's resource is exhausted; reserve the
manual "end" control for ending early. Let the recomputed highlight sets
communicate resource changes visually.

---

## 6. Camera pan decoupled from logic

Panning is **right-button drag**: on right-press, record the pointer position and
the current camera offset; on move-while-held, set `offset = origin + (pointer −
start)`. Release ends the pan. There is no edge-scroll, no momentum, and (in the
reference) no zoom.

The camera is a pure render offset. Every screen→world hit-test subtracts the pan
offset before converting pixels to grid coordinates:

```
worldHex = pixelToHex(screenX − panX, screenY − panY)
```

Game logic only ever sees world/grid coordinates; the camera never leaks into it.
Independently, **plain mouse-move (no button) updates a "hovered hex"** that the
HUD reads to show info about whatever is under the cursor — hover and pan are
separate concerns on the same surface.

**Pattern:** keep the camera as an additive offset applied at draw time and undone
at hit-test time; never let it touch game-state math. Track hover separately from
drag so the two don't interfere.

---

## 7. Full-screen overlays capture the next input

Some views are full-screen overlays — a zoomed-out **map overview** and a
**threat/heat overlay**. These follow a "capture the next input" rule:

- While an overlay is up, the *next* relevant input dismisses it and is
  **consumed** (the handler returns without doing anything else). A left-click
  anywhere closes the map overview; Space or Esc closes the threat overlay;
  pressing the toggle key again also closes it.
- Overlays are checked **before** normal input, in priority order (map overview
  first, then threat overlay, then ordinary play). This guarantees the player
  can't accidentally move a unit "through" an overlay with the click that was
  meant to dismiss it.

**Pattern:** treat transient overlays as input-capturing layers checked ahead of
gameplay handlers; the dismissing input is swallowed, never passed through.

---

## 8. Twin activators — every HUD control has a hotkey

The action bar (skill slots, a ranged-weapon button, a melee button) is fully
mirrored by keys:

- Skill slots **1…N** ↔ clicking the corresponding slot.
- **R** ↔ the ranged-weapon button.
- **A** ↔ the melee button.

Crucially, **both paths call the exact same activator function.** The hotkey is
not a parallel code path — it's a synonym for the click. Each activator runs the
same legality checks (§3) and, on success, drops into the same modal targeting
state. This means keyboard and mouse can be freely interleaved (press `R`, then
click the target; or click the slot, then press Esc) with no special cases.

**Pattern:** route every HUD button and its hotkey through one shared activator.
The input device chooses *how* you start an action; it must never change *what*
the action is or how it resolves.

---

## 9. Universal cancel / back (Esc)

Escape is a single **layered back-out**, resolved most-modal-first:

```
if an overlay is up      → close it           (handled in §7, before this)
else if targeting        → cancel targeting
else                     → deselect unit + close all side panels
```

So one key always means "back out of the most specific thing I'm in," and the
player never has to remember a different escape per context. Right-click is a
narrower synonym (cancel targeting / stop panning) for the same instinct on the
mouse.

**Pattern:** a single cancel control that peels back exactly one layer of modal
state per press, deepest first.

---

## Putting it together — the player-turn loop

1. **Phase gate** (§1): handlers run only on the player's turn.
2. **Select** a unit (§2): flood-fill reachable + compute attackable, draw both.
3. Either:
   - **Click reachable/attackable** (§2) to move or strike, **or**
   - **Activate** a skill/ranged/melee via HUD or hotkey (§8) → **target** a hex
     in the modal state (§3).
4. After each action, recompute the highlight sets so they stay truthful; if
   resources are exhausted, **auto-end** the turn (§5).
5. Use the **primary action** (§4) to interact with a location or end the turn
   early; **Esc/right-click** (§9) to back out of anything.
6. **Pan** (§6) and **overlays** (§7) are view-only and never block the above.

The throughline: *legality is computed up front into highlighted sets, input
handlers are thin lookups against those sets, and a small stack of modal flags
(selection → targeting → overlay) decides what any given click or key means.*
Replicate that structure and the specific keys, ranges, and costs can be anything
your game needs.
