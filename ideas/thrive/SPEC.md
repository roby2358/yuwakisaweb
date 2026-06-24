# THRIVE — Slice 1 Specification

> Technical specification for **Slice 1** of *Thrive* (see `DYNAMICS.md` for the design
> rationale and the full multi-slice vision). Slice 1 delivers the complete emotional arc with
> the minimum systems: a hub, stamina-budgeted expeditions, three income streams, the
> carry/bank economy, flat upkeep, the Resbed (with Act-zero permadeath), Notoriety-driven
> enemy disposition, and both win and loss conditions. The map is fully revealed and combat is
> melee only. Mining, crafting, bounties, ranged weapons, gear tiers/durability, and fog are
> **out of scope** for this slice.

---

## 1. Purpose

*Thrive* is a single-player, turn-based, hex-and-counter survival/economy game that runs
entirely in the browser. The player is a stranded free agent on the wasteland planet Cinder who
must accumulate enough banked credits to buy a one-way ticket off-world at the Gate, while
surviving a world that grows hostile in proportion to how much the player takes and kills.

Slice 1 MUST be playable start-to-finish: the player can win (buy the ticket), lose by
permadeath (die before/without a Resbed charge), or lose by being stranded (run out of money to
pay upkeep). It establishes the core loop — leave the hub, work the wastes, return and bank —
on which later slices layer additional streams and depth.

---

## 2. UI Layout

The screen is divided into a full-height **map canvas** on the left and a fixed **right-side HUD
panel** spanning the full height on the right. A **status/info box** is anchored over the
lower-left corner of the canvas.

```
+--------------------------------------------------+------------------------+
|                                                  |  THRIVE                |
|        . . . . . . . . . . . . . . . . . .       |  Day 4                 |
|      . . [S] . . ~ ~ . . . . . . . (f) . .       |  ----------------------|
|    . . . . . . ~ ~ ~ . . [S] . . . . . . .       |  HP    78 / 100        |
|    . [HUB] . . . ~ . . . . . . . . (f) . .       |  STA    6 / 12         |
|    . . . @ . . . . . . . . . . . . . . . .       |  ----------------------|
|      . . . . . . . . . [S] . . . . . . .         |  Carry      40 c       |
|        . . . . . . . . . . . . . . . . .         |  Bank      312 c       |
|                                                  |  Notoriety  31         |
|                                                  |  Resbed   2 charges    |
|                                                  |  ----------------------|
|                                                  |  Ticket  [###----] 312 |
|                                                  |          / 1000        |
|  +-----------------------------+                 |  ----------------------|
|  | Plains (move 1)             |                 |  [ End Turn ]          |
|  | Salvage field — richness 3  |  <- status box  |  [ New Game ]          |
|  +-----------------------------+                 |                        |
+--------------------------------------------------+------------------------+

Legend: @ player   [HUB] Last Ditch   [S] salvage node   (f) fauna   ~ water

When the player is at the hub, a SERVICES panel overlays the canvas center:

        +-------------------------------+
        |          LAST DITCH           |
        | Bank: 312c   Carry: 40c       |
        +-------------------------------+
        | [Locker]  deposit / withdraw  |
        | [Market]  buy / sell          |
        | [Infirmary] heal / train      |
        | [Resbed]  secure / recharge   |
        | [Gate]    buy ticket (escape) |
        | [Rest]    end the day         |
        +-------------------------------+
```

- The HUD MUST be a fixed panel anchored to the **right edge**, spanning the full window height,
  and always visible during play.
- The HUD panel MUST present its readouts as a vertical stack (title, day, vitals, economy,
  ticket progress, then action buttons), grouped into labeled sections rather than a single
  horizontal strip.
- The ticket progress MUST be shown in the HUD panel as a labeled bar with the current/target
  amounts.
- The End Turn and New Game controls MUST live in the HUD panel.
- The map canvas MUST occupy the remaining area to the **left** of the HUD panel and resize to
  fill it.
- A **status/info box** MUST be anchored over the **lower-left** corner of the canvas, showing
  terrain/cost under the cursor and a description of the hovered node, enemy, or hex.
- The services panel MUST appear only while the player counter occupies the hub hex (stepping
  onto the hub opens it); it MUST overlay the canvas (not the HUD panel), and MUST be dismissible
  to return focus to the map.
- An intro/result panel MUST overlay the canvas center for the start screen, win screen, and the
  two loss screens.

---

## 3. Functional Requirements

### World & Map Generation

- The application MUST generate a hex map of terrain using the existing pointy-top axial grid,
  reusing the baseline terrain set (water, plains, hills, forest, mountain).
- Water and mountain hexes MUST be impassable; plains MUST cost 1 stamina to enter, hills and
  forest MUST cost 2.
- The map MUST contain exactly one **hub** region (Last Ditch) placed on passable terrain, near
  one edge or corner, drawn as a distinct landmark.
- The map MUST be fully revealed at all times in Slice 1 (no fog).
- The application MUST scatter **salvage nodes** and **fauna** across the wastes on passable
  hexes, with density and placement such that at least some nodes are reachable on an early
  round trip and others require resting in the field to reach.
- Node and fauna placement MUST be randomized per game while guaranteeing the player can reach
  at least one income source from the hub.
- Distance from the hub SHOULD correlate with node richness and danger (richer/deadlier farther
  out), establishing the risk gradient.

### Hub & Services

- The hub MUST expose six services: Locker, Market, Infirmary, Resbed, Gate, and Rest.
- The services panel MUST open when the player counter occupies the hub hex (stepping onto the
  hub opens it), not merely when adjacent, and MUST be reachable without spending a turn.
- Locker, Market, Infirmary, Resbed, and Gate actions MUST NOT cost stamina or advance the day.
- The Rest action MUST end the day (see Turn & Day Structure).

### Expedition & Movement (Stamina)

- The player MUST have a **stamina** pool that is the budget for an entire expedition; it MUST
  persist across turns and MUST refill only by resting (in the field for a ration, or fully at
  the hub).
- Selecting the player counter MUST highlight the hexes reachable with current stamina,
  accounting for terrain costs, computed once at select time.
- Moving into a hex MUST deduct that hex's terrain cost from stamina.
- Working a salvage node MUST cost a fixed amount of stamina; attacking MUST cost a fixed
  amount of stamina.
- Stepping into an adjacent passable hex MUST always be allowed even when stamina is
  insufficient: the stamina shortfall MUST be paid in HP (5 HP per missing stamina point,
  "exhaustion"), so the player is never fully stuck. Such hexes MUST be shown as reachable with a
  distinct (orange) tint to mark that the step costs blood.
- The player MUST be able to **rest in the field** (bound to the R key): resting MUST consume one
  ration, restore a portion of stamina, and trigger an ecology phase (advancing enemies) — i.e.,
  resting in the wastes is never free of danger.
- If the player rests in the field with zero rations, stamina MUST NOT recover and the player
  MUST take HP damage (starvation).
- The player MUST be able to **use a medkit** in the field (bound to the H key) to restore HP,
  consuming one carried medkit.

### Income Streams

The application MUST implement three income streams through a shared action model where
possible.

- **Scavenging** (Scavenge skill)
  - The player MUST be able to work a salvage node only while standing on the node's hex (by
    clicking that hex / the player counter on it after selecting), not from an adjacent hex.
  - Working a node MUST first roll `richness/10` to find salvage. A failed roll yields nothing
    and MUST leave richness unchanged. On a successful find, the dig yields salvage goods
    (scaled by richness and Scavenge skill, granting Scavenge XP and a small amount of
    Notoriety), and MUST then roll `richness/10` a second time to determine depletion: only on
    that second success does the node's richness drop by one.
  - A node whose richness reaches zero MUST be removed (picked clean), and a fresh node MUST be
    spawned on a random open hex with richness derived from its distance to town plus jitter.
- **Hunting** (Hunt skill)
  - The player MUST be able to attack adjacent fauna with the equipped melee weapon (see
    Combat).
  - Killing fauna MUST yield trophy/meat goods, grant Hunt XP, and add a larger amount of
    Notoriety than scavenging.
- **Trading** (Barter skill)
  - At the Market the player MUST be able to sell goods from inventory for credits at the
    current price, and buy consumables (at minimum: rations; SHOULD also: a medkit and a Resbed
    charge).
  - Sell prices MUST improve with Barter skill; selling MUST grant Barter XP.
  - Market prices for each good MUST vary over time (a bounded random walk updated per day), so
    timing sales matters.

### Economy (Carry / Bank / Upkeep)

- The player MUST hold credits in two pools: **carried** and **banked** (Locker). The pools
  differ only in safety: carried credits are at risk in the wastes; banked credits are not.
- In town (where the player is safe), every paid service — Market buying (rations, medkit,
  weapon, armor), Market amends, Infirmary healing and training, securing/recharging the Resbed,
  and daily upkeep — MUST draw from the player's combined funds, spending **carried first, then
  banked**, so the player never has to withdraw merely to make a purchase. Affordability for
  these services MUST be tested against the combined total.
- The **Gate ticket** is the sole exception: it MUST be purchasable only from **banked** credits,
  and only **banked** credits MUST count toward the ticket price. Because earnings arrive as
  carried credits, the player MUST deposit earnings at the Locker to progress toward the ticket.
- Selling goods MUST add to **carried** credits.
- Carried credits and droppable inventory MUST be lost on death (see Resbed & Death); banked
  credits MUST be safe — so the player SHOULD deposit before a risky run.
- At the Locker the player MUST be able to deposit all carried credits to the bank
  (carried→banked) and withdraw a fixed increment (50) from the bank (banked→carried), with no
  fee in Slice 1.
- The application MUST charge a flat daily **upkeep** from combined funds (carried first) when
  the day ends.

### Resbed & Death

- At game start the Resbed MUST be unsecured with zero charges; while unsecured, player death
  MUST be permanent (game over).
- The player MUST be able to **secure the Resbed** at the hub by paying a one-time credit cost
  (which SHOULD include its first charge).
- The player MUST be able to **recharge** the Resbed at the hub for credits, up to a maximum
  charge count.
- When the player's HP reaches zero in the field:
  - All carried credits and droppable inventory (goods) MUST be dropped as a cache on the death
    hex.
  - If the Resbed is secured and has at least one charge, the application MUST consume one
    charge, re-embody the player at the hub with full HP and empty inventory, and continue the
    game (a survivable setback).
  - Otherwise the application MUST trigger permadeath (game over).
- A death cache MUST be recoverable by stepping onto its hex, returning the dropped carried
  credits and goods to the player. Caches MUST persist on the map until picked up.

### Notoriety & Enemy Disposition

- The application MUST maintain a single **Notoriety** value in a bounded range (0–100).
- Taking (scavenging) MUST raise Notoriety slightly; killing MUST raise it substantially more.
- Each fauna kind MUST define a **wary threshold** and a **hostile threshold**. Each enemy's
  behavior each turn MUST be selected by comparing current Notoriety to its thresholds:
  - Below wary → **benign** (wanders/grazes, ignores or flees the player, does not attack).
  - At/above wary, below hostile → **wary** (actively avoids the player; will not be approached
    for trade).
  - At/above hostile → **hostile** (moves toward the player within aggro range and attacks when
    adjacent).
- Higher Notoriety MUST increase enemy spawn weighting and SHOULD increase aggro range.
- Notoriety MUST decay by a small fixed amount (3) each day on hub rest.
- The application MUST allow the player to pay (from combined funds) at the Market to reduce
  Notoriety by a fixed amount (5, "amends") as an additional, optional valve.

### Combat (melee only)

- An attack MUST be resolved when the player acts on an adjacent enemy hex.
- Damage dealt MUST be derived from the equipped melee weapon plus a Hunt-skill bonus, reduced
  by the target's toughness.
- A surviving enemy MUST retaliate, dealing damage reduced by the player's equipped armor (if
  any).
- During the ecology phase, a hostile enemy adjacent to the player MUST attack, dealing damage
  reduced by armor; this is the path by which the player can die.
- Combat outcomes (damage, death) MUST be surfaced visually so the player can read what happened
  and which enemy did it. In Slice 1 this MUST be satisfied by brief (~170ms) color flashes on
  the affected hex for hits, kills, exhaustion, and re-embody.
- Enemy movement MUST resolve instantly in Slice 1 (the whole enemy phase applies in one step).
  Per-hop enemy movement animation SHOULD be added in a later slice; it is deferred for now.

### Progression

- **Income skills** — Scavenge (working nodes), Hunt (melee/hunting kills), and Barter (selling)
  MUST each accumulate XP through use and level up on a diminishing-returns threshold curve;
  higher levels MUST improve their respective yields/prices.
- **Survival skills** — Toughness, Endurance, Foraging, and First Aid MUST be improvable by
  paying to train at the Infirmary; in Slice 1 they MUST NOT level through use. Their effects:
  - Toughness MUST raise the player's maximum HP.
  - Endurance MUST raise the player's maximum stamina.
  - Foraging MUST give a chance to recover a ration when resting in the field, on a curve
    that is 0% at level 0, 80% at level 10, and asymptotically approaches but never reaches 100%.
  - First Aid MUST increase overnight rest healing and MUST lower the Infirmary heal cost.
- **Equipment** — The player MUST start with a basic melee weapon. The player SHOULD be able to
  buy at least one better melee weapon and one armor item at the Market. Gear tiers, durability,
  and crafting are deferred to later slices.

### Turn & Day Structure

- A **turn** MUST consist of a player phase (spend stamina on moves/actions until the player
  ends the turn) followed by an **ecology phase** (enemies act per disposition rules), repeating
  while the player is in the wastes.
- Ending a turn MUST be available via the End Turn button and via Space/Enter.
- Enemy death and player death MUST resolve as visible events during the ecology phase, not as
  silent end-of-turn checks.
- A **day** ends either by resting at the hub (Rest service) or by camping in the wastes. On a
  **hub rest** the application MUST, in order: deduct upkeep from combined funds (carried first),
  heal a fraction of lost HP, decay Notoriety, restore stamina to full, increment the day
  counter, and refresh market prices.
- A **camp night** in the field MUST charge no upkeep and MUST NOT decay Notoriety, but MUST
  heal the same fraction of lost HP as a hub rest — so long field trips remain survivable.
- **Overnight rest healing** MUST restore `(lost HP) × (First Aid + 1) × 5%`, capped at max HP.
- If combined funds cannot cover upkeep at hub rest, the application MUST trigger the stranded
  loss (game over).

### Win / Loss

- **Win** — When banked credits are at least the ticket price, the Gate service MUST allow
  buying the ticket; doing so MUST trigger the win screen and end the game.
- **Loss (permadeath)** — Death without an available Resbed charge MUST trigger a permadeath
  game-over screen.
- **Loss (stranded)** — Inability to pay upkeep at day end MUST trigger a stranded game-over
  screen.
- Each end state MUST present a summary and an option to start a new game.

### User Interface Controls

- Left-click on the player counter MUST select it and highlight stamina-reachable hexes.
- Left-click on a highlighted hex MUST move the player there.
- Left-click on an adjacent enemy MUST attack it; left-click on the player's own hex while
  selected and standing on a salvage node MUST work that node. The exact dispatch MUST follow the
  priority order in `UI_CONTROLS.md` (overlay → targeting → selection).
- Left-click on the player counter again, or on a non-actionable hex, MUST deselect.
- Right-click drag MUST pan the map and MUST NOT open the browser context menu.
- Space or Enter MUST end the current turn.
- Stepping onto the hub hex MUST open the services panel; Esc MUST dismiss the panel / peel back
  one modal layer.
- The R key MUST rest in the field and the H key MUST use a medkit (both only while in the wastes
  with no overlay open).

### Persistence (optional)

- The application MAY persist a single saved game (the full state model from `DYNAMICS.md` §11)
  to local browser storage and restore it on load.
- If persistence is absent, starting the page MUST begin (or offer to begin) a fresh game.

---

## 4. Non-Functional Requirements

### Styling / Theming
- The UI MUST follow the baseline's dark, monospace, counter-piece aesthetic (rounded-square
  counters with depth lines; flat-color terrain hexes).
- Terrain, hub, nodes, fauna, and the player MUST be visually distinguishable at a glance.
- The right HUD panel MUST clearly distinguish carried vs. banked credits and show ticket
  progress as a labeled bar with current/target amounts.
- The lower-left status/info box MUST be visually distinct from the HUD panel and MUST NOT
  obscure the player counter or the hub during normal play.

### Performance
- The application MUST redraw immediately on input. Slice 1 conveys ecology outcomes with brief
  (~170ms) combat/death/exhaustion/re-embody flashes tuned for readability over spectacle; enemy
  movement resolves instantly. Per-hop enemy-movement animation is deferred to a later slice.
- Rendering MUST remain responsive on a commodity laptop for the full map size.

### Code Quality
- Content (streams, goods, prices, fauna kinds and thresholds, gear, skill curves, tuning
  constants) MUST be data-driven parameter tables, not per-item code paths.
- Income actions SHOULD share a single parameterized resolution path; enemy behavior MUST be
  driven by the disposition function rather than per-encounter scripting.

### Platform Compatibility
- The game MUST run in current desktop Chrome, Firefox, and Edge.
- The game SHOULD run by double-clicking `index.html` from the local filesystem (see
  Implementation Notes).

### Accessibility
- All actionable map elements MUST also be conveyed through the bottom status line text on
  hover, not by color alone.

---

## 5. Dependencies

- No external libraries, frameworks, build step, or package manager.
- HTML5 Canvas 2D rendering context.
- Existing project modules, reused as-is or extended:
  - `config.js` — terrain, movement cost, colors, map dimensions, and Slice-1 tuning constants.
  - `hex.js` — axial hex math, `hexKey`, reachability (`bfsHexes`), and path drawing; a global
    pathfinder (A*) is required for enemy movement (see Implementation Notes).
  - `rando.js` — seeded/static RNG helpers for generation, yields, prices, and spawns.
  - `colortheory.js` — per-counter color schemes.

---

## 6. Implementation Notes

- **Load mechanism.** Per project preference (and to allow double-click `file://` launching),
  the game SHOULD be loaded via plain `<script>` includes rather than ES module imports. If the
  baseline's `type="module"` setup is retained, the game MUST be served over HTTP. This decision
  affects only loading, not behavior.
- **Right-panel layout changes the canvas viewport.** The baseline styles `#hud` as a
  top-left floating bar over a full-window `#game` canvas. Slice 1 reserves a fixed-width column
  on the right for the HUD panel, so the canvas is no longer full-window-width: its drawable
  area MUST be reduced by the panel width (CSS layout plus the canvas-sizing/resize logic in the
  main script must subtract the panel width on init and on window resize). Screen↔hex coordinate
  conversion and pan bounds operate in this reduced canvas space; the panel's width is the only
  value that needs threading through. The status/info box and center overlays (services, intro,
  result) are positioned relative to the canvas, not the panel.
- **Stamina replaces MP.** The baseline's per-turn MP becomes the per-expedition stamina pool.
  Reachability highlighting reuses the existing Dijkstra reachability against the current
  stamina budget; the auto-end-turn-at-0 behavior does **not** apply (stamina spans turns).
- **Enemy pathfinding.** Hostile enemies MUST path toward the player with full A* to the target
  and walk the path within their movement allowance; local reachable-set heuristics MUST NOT be
  used (they create coastline/dead-end horizon bugs). `hex.js` provides Dijkstra reachability;
  an A* routine keyed by `hexKey` should be added alongside it.
- **Disposition function.** A single function maps (enemy kind thresholds, current Notoriety) to
  benign/wary/hostile; the ecology phase branches on that result. The same on-map counter
  changes behavior as Notoriety crosses thresholds — no separate "angry" entities.
- **Income action template.** Scavenge and Hunt resolve through one parameterized routine
  (cost → roll yield → grant XP → mutate node/enemy → add Notoriety → maybe trigger encounter);
  Trade is a hub menu over inventory and a price table. Adding a node/fauna type should be a
  data row.
- **Goods & prices.** Goods are items carrying a base value; the market maintains a current
  price per good that random-walks within bounds each day. Selling converts goods to carried
  credits at the Barter-adjusted price.
- **State model.** The authoritative runtime state is the struct in `DYNAMICS.md` §11
  (`player`, `resbed`, `node`, `enemy`, `world`); any optional save serializes this object.
- **Animation phasing.** Slice 1 keeps animation minimal: a single flash helper queues a colored
  hex overlay for ~170ms (combat hits white, damage/exhaustion red, re-embody gold), then
  re-renders when it clears. The ecology phase (enemy movement) applies in one synchronous step
  with no per-hop animation; deaths resolve inline as visible flashes. The baseline's multi-step
  phased turn resolution is the intended seam for a later slice but is not implemented here.
- **Hub affordability (known limitation).** The hub service buttons are rendered disabled when
  the player cannot afford an action; the action handlers themselves trust that disabled state
  and do **not** re-validate affordability or preconditions before applying the effect. If a hub
  action is ever invoked while it should be unaffordable, it will apply anyway (e.g. driving a
  balance negative). Re-validation in the handlers would harden this.
- **Extension points.** The inert combat/targeting/location hooks documented in the baseline
  (`computeAttackable`, `targeting` modal, `locationAt`) are the intended seams: Slice 1 fills
  `computeAttackable` (adjacent fauna) and `locationAt` (the hub); `targeting` remains inert
  until ranged weapons arrive in a later slice.

---

## 7. Error Handling

- **Insufficient stamina** — Hexes/actions the player cannot afford MUST NOT highlight and MUST
  NOT be performable; the player is never blocked from the guaranteed one-hex exhaustion move.
- **Insufficient credits** — Buying, securing/recharging the Resbed, training, paying amends, or
  buying the ticket MUST be unavailable (disabled) when the player cannot afford it, with a
  status message rather than a thrown error.
- **Depleted node** — A node thinned to zero richness MUST collapse and be replaced by a fresh
  node elsewhere, with a clear message rather than failing silently.
- **No rations on field rest** — MUST resolve as starvation HP loss with a clear message, not an
  error.
- **Death with no charge** — MUST cleanly transition to the permadeath end screen, preserving
  the final state for the summary.
- **Stranded at day end** — MUST cleanly transition to the stranded end screen; the day MUST NOT
  partially apply (upkeep deduction and the loss check are a single resolution).
- **Unreachable income on generation** — Map generation MUST retry (bounded attempts) until at
  least one income source is reachable from the hub; if generation repeatedly fails, the
  application MUST fall back to a guaranteed-valid simple layout rather than presenting an
  unplayable map.
- **No-op clicks** — Clicks on non-actionable hexes MUST deselect or do nothing gracefully; they
  MUST NOT raise errors.

---

## 8. Out of Scope (deferred to later slices)

- Mining stream, the Forge, crafting and repair, Resbed charges crafted from parts.
- Bounty stream, rival scum, robbery, revenge marks, named grudge-holders.
- Ranged weapons and ammo; gear tiers and durability.
- Variable enemy speed.
- Fog of war and prospecting.
- Per-faction grudges (Slice 1 uses a single global Notoriety).
- Resbed raids while the player is away.
```
