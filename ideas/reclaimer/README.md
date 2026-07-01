# Reclaimer

You are the captain of a colony ship sent to **evacuate** a world lost to an alien blight.
A systems failure forced you down instead. Now you're grounded, cornered, with a hull full
of frozen colonists and one trusty blaster — and the only way off this rock is *through* it.
Establish a settlement, cleanse the corrupted land, fight the swarm back to its nests, thaw
your people, and reclaim the planet **inch by inch**.

It's as much an **economy** game as a survival one. Every turn is one question wearing a
survival mask: **guns, ground, or people?**

- **Why it's fun and how the rules work:** [DYNAMICS.md](DYNAMICS.md) (design journal + the
  first-playtest numbers in §10).
- **The interaction model this UI implements:** [UI_CONTROLS.md](UI_CONTROLS.md) — Reclaimer
  is a full **Layers 1–5** game; sections below say which layer each control comes from.

## Running

No build step. Serve over HTTP so module/asset paths resolve, then open the page:

```bash
npx serve .
# or
python -m http.server 8000
```

*(If the project is converted to plain `<script>` includes for `file://` double-click use,
this note goes away — see the repo convention.)*

---

## The screen

```
┌───────────────────────────────────────────────────────────────┐
│ ⛏ Materials 12 (+2)   🍞 Rations 7 (−1)   Turn 14   ▓▓▓░░ Threat │  ← top bar
│ Colonists 3/8 awake        Breeders 4/5 left        Lander ██▉░ │  ← objective tracker
├───────────────────────────────────────────────────────────────┤
│                                                                 │
│                     [ hex map — pan, select, act ]              │
│                                                                 │
│  hovered: hills · corruption 2 · uncontrolled · minerals        │  ← hover readout (L1.3)
├───────────────────────────────────────────────────────────────┤
│ ▸ Captain   hp 10/10  mp 5    [C]leanse [B]uild [R] Fire        │  ← selected-unit action bar (L4)
└───────────────────────────────────────────────────────────────┘
```

- **Top bar** — the two economies with their **net/turn delta** (so you see starvation
  coming), the turn counter, and the **Threat meter** (the §3 escalation number, shown as a
  filling bar — the game's difficulty made visible).
- **Objective tracker** — the two win conditions counting down: **colonists awake X/8** and
  **Breeders left Y/5**. Plus the **Lander hp** bar — the heartbeat; at zero you lose.
- **Action bar** — the selected unit's verbs as slots, each with a hotkey (L2.3 twin
  activators). A verb is greyed out when it has no legal, affordable target (L4 refuses to
  arm — the bar *is* the affordability readout).

---

## Controls

Built on the counter UI (gold player counter, right-drag pan, select-then-act). Keys are
defaults; the structure is what matters.

### Select and move — Layer 1
- **Left-click a colony unit** → select it; **reachable** hexes tint **yellow**,
  **attackable** aliens tint **red** (both precomputed at select time — a click is a pure
  lookup, L1.2).
- **Left-click a yellow hex** → move there (cost from the reachable map). Movement
  **auto-ends the unit's turn at 0 MP** (L1.4).
- **Left-click the unit again / a dead hex** → deselect.
- **Right-drag** pans; **mouse-move** updates the hover readout (L1.3).

### Act on a hex — Layers 3 & 4
The frontier verbs. Each is a slot on the action bar and a hotkey, both routing through one
activator (L2.3). Aimed verbs drop into a **targeting** mode (L4): valid target hexes light
up, click one to execute, **Esc / right-click / invalid hex** cancels.

| Verb | Key | Targeting tint | Valid targets |
|---|---|---|---|
| **Fire** (captain/soldier) | `R` | red | aliens in weapon range (L3/L4) |
| **Cleanse** | `C` | teal | adjacent corrupted hexes you can afford in materials |
| **Build** | `B` | blue outline | controlled, clean, empty hexes in reach (opens a build palette first) |
| **Gather / Repair** | `G` | amber | adjacent damaged structure or unworked deposit |

Melee is **move-and-strike** (click a red hex adjacent to any reachable hex — L3). Ranged
**Fire** is aimed (L4). A verb that can't be afforded or has no target simply won't arm —
you learn the cost by what lights up, never by a popup (costs are baked into the legal-set
math, per the design).

### The Lander and locations — Layer 2.1
- **Space / Enter** (or the **End Turn** button) is the context-sensitive **primary action**:
  standing on / selecting the **Lander** (or a **Cryo-bay**) opens its panel — **Awaken a
  colonist** (rations), **respawn the captain**, spend **relics** on upgrades. Anywhere else,
  it **ends the turn**.
- **Esc** backs out one modal layer at a time (overlay → targeting → deselect), L2.2.

### Overlays — Layer 5
Full-screen, view-only, capture-the-next-input:
- **`M`** — map overview: a **corruption + threat heatmap** of the whole planet (where the
  blight is thickest, which nests remain).
- **`O`** — objectives / help: win conditions, legend, current threat breakdown.

---

## Reading the map (the color language)

Terrain communicates strategy at a glance — the blight *is* the level design.

| On the map | Means |
|---|---|
| **Sickly violet, 3 intensities** | corruption level 1–3; a **pulsing level-3 hex is a node** breeding a Breeder |
| **Soft blue-green tint / border** | your **controlled** territory (where you can build) |
| **Dark, featureless** | **fog** — unrevealed; scout or extend influence to light it |
| **Yellow** hexes | reachable movement for the selected unit |
| **Red** hexes | aliens you can attack this turn |
| **Teal / blue-outline / amber** | armed cleanse / build / gather targets |
| **Gold counter** | the Captain · settlement-palette counters | your colonists & structures |
| **Hostile-palette counters** | aliens — Swarmlings (fast), Maulers (siege), Spitters (re-seed the blight), Breeders (nests) |

Deposits are legible too: **minerals** in hills (→ Extractors), **biomass** in
forest/plains (→ Farms), **relics** in mountains you must fight the blight to reach.

---

## A turn, start to finish

1. **Your phase** — move and act with each unit: cleanse the frontier ring, build a Farm or
   Turret, fire on aliens, or return to the Lander to wake a colonist. Highlights recompute
   after every action so they never lie (L1.4).
2. **Economy resolves** — controlled ground and structures pay out; awake colonists eat their
   upkeep. Overspend on people and someone starves.
3. **The blight advances (animated)** — corruption spreads a hex, Purifiers push it back,
   nodes breed. Then the **alien phase plays out hop-by-hop**: the swarm paths toward your
   nearest asset at its rolled speed, turrets and the blaster flash, and **a breach is a death
   you watch happen** — the alien that did it stays on the board as your next target.

**Win** when every **Breeder is destroyed** *and* every **colonist is awake** — the planet is
yours. **Lose** if the **Lander falls** (or your last unit dies with no one left to thaw).
You cannot turtle to victory: the threat climbs with every turn, colonist, and hex you hold,
so the nests at the map's edge won't wait — sooner or later you have to march out and burn them.
