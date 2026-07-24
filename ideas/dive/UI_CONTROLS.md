# UI Controls — Interaction Patterns

A control scheme for a **family of hex-and-counter games** — anything built on a hex
grid where you select counters/tokens and act on the map (board-wargame descendants,
tactics games, movement puzzles).

It is written as **layers**. The early layers are the core every such game needs;
later layers are increasingly optional and only matter once a game grows combat,
abilities, locations, or extra views. Build them in order: each layer assumes the ones
above it and adds without rewriting them.

- **`hexandcounter` is the reference implementation of Layers 1–2** (the core loop). Its
  `index.js` also contains the wiring and inert extension points for the optional layers,
  so the later layers describe how to fill those in rather than how to bolt them on.
- The scheme is engine-agnostic (the reference is canvas + DOM, mouse + keyboard — no
  gamepad, no touch), and the exact key bindings are *defaults to copy, not sacred*. The
  structure is what matters; remap freely.

The throughline across every layer:

> Legality is computed **up front** into highlighted sets; input handlers are **thin
> lookups** against those sets; and a small **stack of modal flags** (overlay → targeting
> → selection) decides what any given click or key means.

---

## The modal-flag stack

One idea underlies the whole scheme. At any moment the game is in some combination of
modal states, and **every input handler resolves them in a fixed priority order, deepest
(most modal) first.** In the reference implementation those flags are:

```
overlay     (Layer 5) — a full-screen view is up; it captures the next input
targeting   (Layer 4) — an action is armed and waiting for a target hex
selection   (Layer 1) — a counter is selected; its legal moves/targets are cached
phase       (Layer 1) — whose turn it is; map input is live only on the player's
```

A handler checks `overlay`, then `targeting`, then falls through to ordinary
selection — and `phase` gates the whole thing. A game that only implements Layer 1 has
just `selection` and `phase`; the higher flags are simply always null/absent. Adding a
layer means giving its flag a value and teaching the dispatch to check it — the lower
layers are untouched.

---

# Layer 1 — The core loop (required)

Everything a minimal hex-and-counter game needs. `hexandcounter` implements exactly this
layer and nothing below it.

## 1.1 Phase-gated input

The single most important rule: **map input is only live during the player's turn.**

The game holds one `phase` value. Map clicks and gameplay hotkeys early-return unless
`phase === 'player'`. While the opposing side resolves — whether that is instantaneous or
an async, animated AI loop — the phase is something else and the handlers do nothing. A
few view-only keys may still work (see Layer 5), because they touch the camera/overlays,
not game state.

```
if (gameOver) return;
if (phase !== 'player') return;
```

**Why:** one guard at the top of every handler removes a whole class of bugs — clicking
mid-animation, queuing moves during the enemy turn — more reliably than enabling and
disabling individual widgets. Even when the opposing turn is instantaneous, keep the flag:
it is the seam an animated AI phase later slots into without touching input code.

## 1.2 Select, then act

Map interaction is a **two-step affordance**, not click-to-move.

**First click — select.** Clicking a friendly counter selects it and *precomputes the
legal-action sets from its current position and resources*, cached on the selection:

- **Reachable** — a map of `hex → movement cost`, from a cost-limited flood fill
  (BFS/Dijkstra) bounded by remaining movement points. Other counters (friendly and
  enemy) are walls. The unit's own hex is removed.
- **Attackable** — the hexes it can strike this turn (Layer 3; an **empty set** in a
  move-only game).

These sets are computed once at selection, drawn as map tints, and become *the* source of
truth for what the next click means.

**Second click — act, dispatched by which set the target falls in:**

```
clicked the selected counter's hex → deselect
clicked an attackable hex          → attack          (Layer 3)
clicked a reachable hex            → move            (cost looked up from the reachable map)
clicked anything else              → deselect
```

**Why:** all legality is decided *before* the second click, by what is highlighted. The
handler never re-validates geometry — it just asks "is this key in `attackable`? in
`reachable`?" The highlight the player sees and the action they get stay perfectly in
sync, and misclicks are harmless (they deselect rather than doing something surprising).

Generalize freely: with multiple friendly counters, "select" means *whichever* friendly
counter was clicked; selecting a different one recomputes the sets for it.

## 1.3 Camera decoupled from logic

The camera is a **pure render offset**, never part of game-state math.

- **Pan** by right-button drag: on right-press record the pointer position and current
  offset; on move-while-held set `offset = origin + (pointer − start)`; release ends it.
  (No edge-scroll or momentum in the reference; zoom is optional.)
- Every screen→world hit-test undoes the offset before converting pixels to hexes:
  `worldHex = pixelToHex(screenX − panX, screenY − panY)`.
- **Hover is separate from drag.** Plain mouse-move (no button) updates a "hovered hex"
  that the HUD reads to show what is under the cursor. Hover and pan share the surface but
  never interfere.

**Why:** keeping the camera additive-at-draw / undone-at-hit-test means game logic only
ever sees world coordinates, and tracking hover independently keeps the readout alive
during ordinary mouse movement.

## 1.4 Auto-advance when the turn is spent

After every action that consumes movement, check: **if movement hits zero, end the turn
automatically.** The player never manually ends a turn they have fully used.

After each action, **recompute the highlight sets** so they stay truthful (and so any
turn-economy rule — e.g. reduced movement when engaged — shows up immediately as a smaller
highlighted range, communicating the rule without a prompt).

> Layers 1.1–1.4 are the complete core. A game can ship here: select a counter, see its
> range, move, turns advance. The reference implementation does exactly this.

---

# Layer 2 — Standard conveniences (recommended)

Cheap, broadly useful additions that don't require new game mechanics — just a little more
input wiring. `hexandcounter` includes these.

## 2.1 One context-sensitive primary action

A single **primary action** input (Space, Enter, and an on-screen "End Turn" button — all
calling the same function). What it does depends on context, typically the selected/active
unit's tile:

```
on an interactive location (town, ruin, shrine, objective…) → open that location
otherwise                                                    → end the turn
```

Overloading the most-used control by context beats forcing the player to hunt for separate
"interact" vs "end turn" buttons. In a game with no interactive locations the branch is
inert and it simply ends the turn (the reference's `locationAt()` always returns null).

## 2.2 Universal cancel / back

One key (Esc) is a **layered back-out**, resolved most-modal-first — the same priority
order as the modal-flag stack:

```
if an overlay is up   → close it            (Layer 5)
else if targeting     → cancel targeting    (Layer 4)
else                  → deselect + close any side panels
```

So one key always means "back out of the most specific thing I'm in," with no per-context
escape to memorize. **Right-click is the narrower mouse synonym** (cancel targeting / stop
panning) for the same instinct. In a Layer-1/2 game the only live branch is "deselect," and
it grows automatically as higher layers add flags.

## 2.3 Twin activators

Every HUD control has a hotkey, and **both paths call the exact same function.** The hotkey
is a *synonym* for the click, never a parallel code path. At this layer that is just the
primary action (button ⇄ Space/Enter); it becomes more valuable once there is an action bar
(Layer 4).

**Why:** routing both the device and its hotkey through one activator means keyboard and
mouse interleave freely with no special cases, and there is one place where each action's
legality and effect live.

---

# Layer 3 — Combat alongside movement (optional)

The first layer that needs real game mechanics. It fills in the **attackable** half of
the select-then-act dispatch (1.2) that a move-only game leaves empty.

At selection, alongside `reachable`, compute **attackable**: the hexes this counter can
strike this turn.

- **Melee** is typically *move-and-strike*: enemies adjacent to the unit **or to any
  reachable hex**. Acting on one moves the unit adjacent and resolves the attack.
- **Fixed/ranged-on-the-board** attacks: enemies within range (and line of sight, if the
  game models it).

Draw `attackable` as a distinct tint (e.g. red) over the movement tint, and the existing
dispatch routes a click on an attackable hex to the attack instead of a move. Combat
introduces its own rules — damage, removal, retreat, a defeat condition — but the *control
surface* is just this one added set and one added branch.

> In the reference implementation this is the `computeAttackable()` extension point. It
> returns an empty set today; filling it in lights up the attack branch and the red tint
> already wired into selection and rendering.

---

# Layer 4 — Aimed actions: ranged & skills (optional)

For actions where the player must *point at a target hex* — a ranged weapon, an aimed
melee strike invoked from the HUD, or an offensive ability — use a **modal targeting
state** rather than overloading normal selection.

The state is a tiny record: `targeting = { what, validHexes }`, where `validHexes` is the
precomputed set of legal target keys for that specific action (same precompute-and-lookup
idea as 1.2). While it is active:

- Normal counter-selection is suppressed (the selection box is hidden), so the only thing a
  map click can do is choose a target.
- Clicking a **valid** hex executes the action there and exits targeting.
- Clicking an **invalid** hex, **right-clicking**, or **Esc** cancels with no effect.

**Self-targeted actions skip the mode** — a self-buff or self-centered effect fires
immediately on activation, because there is nothing to point at.

The **activator does the legality work up front and refuses to enter the mode if there is
nothing to do** (insufficient resource, no target in range, no line of sight) — it reports a
reason and stays put. So *entering* targeting is itself a guarantee that at least one valid
target exists.

This layer pairs naturally with an **action bar** and Layer 2.3's twin activators: skill
slots `1…N`, a ranged key, a melee key — each mirrored by an on-screen button, each routing
through one shared activator that runs the legality check and drops into the same targeting
state. Keyboard and mouse interleave (press the key, then click the hex; or click the slot,
then Esc) with no special cases.

> In the reference implementation this is the `targeting` flag plus `cancelTargeting()` and
> the targeting branch already present in the click/Esc/right-click dispatch — inert until a
> game gives an activator something to arm.

---

# Layer 5 — Full-screen overlays (optional)

Whole-screen views — a zoomed-out **map overview**, a **threat/heat** display, a help or
objectives screen — follow a **capture-the-next-input** rule:

- While an overlay is up, the *next* relevant input dismisses it and is **consumed** (the
  handler returns without doing anything else), so the dismissing click can't "fall
  through" and move a counter underneath.
- Overlays are checked **before** all gameplay handlers, in their own priority order. This
  is the top of the modal-flag stack.

Even a Layer-1 game usually has at least one trivial overlay (an intro/victory screen); the
same rule applies, which is why `hexandcounter` routes its intro and victory screens through
the `overlay` flag and `dismissOverlay()` rather than handling them ad hoc.

---

## Quick reference — input map

Bindings are grouped by the layer that introduces them. Lower layers can ship without the
rows below them. Keys are swappable defaults.

| Layer | Input | Action |
|---|---|---|
| 1 | **Left-click friendly counter** | Select it (compute & show reachable / attackable) |
| 1 | **Left-click reachable hex** | Move there |
| 1 | **Left-click the selected hex / elsewhere** | Deselect |
| 1 | **Right-drag** | Pan the camera |
| 1 | **Mouse move** | Update hovered-hex readout in the HUD |
| 2 | **Space / Enter / "End Turn"** | Primary action: interact with location, else end turn |
| 2 | **Esc** | Back out one modal layer (overlay → targeting → deselect) |
| 2 | **Right-click** | Narrow cancel: cancel targeting / stop panning |
| 3 | **Left-click attackable hex** | Attack (melee = move-and-strike, ranged = fire) |
| 4 | **1 … N / R / A** | Activate skill slot / ranged / melee (enter targeting) |
| 4 | **Left-click while targeting** | Fire at the hex if valid, else cancel |
| 5 | **M / C / S / I, etc.** | Toggle a full-screen overlay |

---

## Putting it together — the player-turn loop

The core loop (Layers 1–2), with the optional layers shown where they extend it:

1. **Phase gate** (1.1): handlers run only on the player's turn.
2. **Select** a counter (1.2): flood-fill `reachable` (+ `attackable`, Layer 3), draw both.
3. Either:
   - **Click reachable / attackable** (1.2 / Layer 3) to move or strike, **or**
   - **Activate** a skill/ranged/melee via HUD or hotkey (Layer 4) → **target** a hex in
     the modal state.
4. After each action, recompute the highlight sets so they stay truthful; if movement is
   exhausted, **auto-end** the turn (1.4).
5. Use the **primary action** (2.1) to interact with a location or end the turn early;
   **Esc / right-click** (2.2) to back out of anything.
6. **Pan** (1.3) and **overlays** (Layer 5) are view-only and never block the above.

Replicate the structure — the modal-flag stack, up-front legality, thin-lookup handlers —
and the specific keys, ranges, terrain costs, and which layers you implement can be anything
your game needs.
