# Healer — Technical Specification

## Purpose

**Healer** is a single-player, browser-based hex-and-counter tactics game in which the player
controls a single support unit — the healer — embedded in an AI-driven party of adventurers. The
player does not command the party; they keep it alive. The party explores an overland hex map in
pursuit of objectives (treasure, then an exit) while enemies attack it. The player wins by getting
the party to its objective and is rewarded — through reputation — for how many heroes survive.

The design rationale (theme, drivers, and why each mechanic exists) lives in `DYNAMICS.md`. This
document specifies **what** the system does; `DYNAMICS.md` explains **why**.

The game runs entirely client-side with no build step, no server, and no persistence beyond the
current session.

## UI Layout

```
+-------------------------------------------------------------+
|  Turn: N   |  Aether: a/A   |  Rep: R   |  [End Turn] [New]  |  <- HUD bar
+-------------------------------------------------------------+
|                                                             |
|                                                             |
|                   [ Hex map canvas ]                        |
|                                                             |
|     - terrain hexes (flat color)                            |
|     - healer counter (player)                               |
|     - party-member counters (AI)                            |
|     - enemy counters (AI) with target telegraph lines       |
|     - reachable/range highlights when something is selected  |
|                                                             |
+-------------------------------------------------------------+
|  [ Skill bar: available skills, cost + cooldown shown ]     |  <- action panel
+-------------------------------------------------------------+
|  [ Inspect panel: selected unit's HP, statuses, intent ]    |  <- contextual
+-------------------------------------------------------------+

   [ Intro overlay ]   shown at start; dismissed to begin a run
   [ End overlay ]     shown on win/loss with reputation summary
```

The map canvas MUST fill the available viewport. The HUD, skill bar, and inspect panel MAY be
rendered as DOM overlays on top of the canvas.

## Functional Requirements

### Map Generation

- The application MUST procedurally generate a rectangular hex map for each new run.
- The application MUST assign terrain types that vary movement cost; some terrain MUST be impassable.
- The application MUST place the healer and the party near a shared entry point and place at least
  one objective elsewhere on the map.
- The application MUST guarantee that a traversable path exists from the party's start to the
  objective; if generation fails to produce one, it MUST regenerate.
- The application MUST NOT carry over inert artifacts from prior projects (danger points, resource
  nodes, installations) into game logic.

### The Healer (Player Unit)

- The player MUST control exactly one unit, the healer.
- The healer MUST have a movement budget that is spent to move between hexes and refreshes each turn.
- The healer MUST have a regenerating Aether pool that is spent to cast skills.
- The healer's Aether MUST regenerate each turn; it SHOULD regenerate more when the healer casts less
  or stays away from combat.
- The healer MUST be killable; its death MUST end the run as a loss.
- The healer MUST always be able to take at least one action on its turn, even when costs would
  otherwise block every option.

### Skills

- The healer MUST have access to a set of support skills built from a small number of reusable
  templates (instant heal, heal-over-time, ward/absorb, cleanse/dispel, buff, area/group effect,
  revive, passive).
- Each skill MUST have an Aether cost and a range; some skills MAY also have a cooldown.
- A skill MUST be castable only when the player can afford its Aether cost, its cooldown is ready,
  and a valid target is within range.
- Targeted skills MUST require a valid target (an ally, or a downed ally for revive) within range.
- Area skills MUST affect all valid units within their radius of the target point.
- Higher skill tiers MUST be locked initially and unlock as the player's reputation rises during a
  run.
- Applying a skill MUST add, refresh, or remove status effects on the target as appropriate to its
  template.

### Status Effects

- The application MUST represent heals-over-time, wards/shields, buffs, poisons/damage-over-time, and
  debuffs as status effects carried by units.
- The application MUST resolve all active status effects on a uniform per-turn tick (apply
  heal-over-time, apply damage-over-time, decay durations, remove expired effects).
- Wards/shields MUST absorb incoming damage before it reduces a unit's health.
- Cleanse skills MUST remove damage-over-time effects; dispel skills MUST remove debuff effects.

### The Party (AI Allies)

- The party MUST consist of named members with distinct classes, and the player MUST NOT be able to
  issue movement or attack orders to them.
- One party member MUST be the leader; the leader MUST pursue the current objective, and the other
  members MUST follow the leader.
- The leader's movement MUST be constrained so the party does not outrun the healer's ability to
  follow (a leash that biases the leader toward staying near the healer and slows it when the healer
  falls too far behind).
- Party members MUST attack adjacent enemies on their turn.
- A party member reduced to zero health MUST become downed rather than removed immediately.
- A downed party member MUST be permanently lost if not revived within a fixed number of turns.
- The loss of party members MUST weaken the remaining party (less collective offense, fewer units
  shielding the healer).

### Enemies (AI Threats)

- The application MUST spawn enemies that group into a small number of classes, each with a distinct
  damage profile (e.g. burst, spread, damage-over-time, debuff, ranged).
- Enemy classes MUST have tiered members whose strength scales with the run's progress and the
  player's reputation.
- Each enemy MUST commit to a single party member as its target and MUST telegraph that target so the
  player can anticipate incoming damage.
- Each enemy MUST have a movement speed determined at spawn, and speeds MUST vary between enemies.
- Enemies MUST move toward their target each turn and attack when adjacent.
- An enemy that lands a killing blow MUST remain identifiable on the board afterward.
- Tougher enemy tiers MUST appear as the player's reputation rises and the party nears its objective,
  rather than purely as a function of elapsed time.

### Movement & Pathfinding

- The application MUST move units only onto passable terrain and MUST NOT allow two units to occupy
  the same hex.
- AI units (party and enemies) MUST use full-map pathfinding toward their goals rather than only
  considering hexes reachable within a single turn's movement.

### Reputation & Objectives

- The application MUST track a reputation score that increases as heroes are kept alive and the party
  claims objectives.
- Reputation MUST gate the unlocking of higher skill tiers during a run.
- Claiming the final objective MUST require the party (not the healer alone) to reach it.

### Turn Structure

- The game MUST proceed in distinct phases each turn: healer phase, party phase, enemy phase, and a
  resolution tick.
- The healer phase MUST accept player input (movement and/or skill casts) and MUST end only when the
  player chooses to end the turn or runs out of available actions.
- The party and enemy phases MUST execute their AI automatically.
- The resolution tick MUST apply status effects, age downed units toward permanent death, and update
  reputation, tier unlocks, and escalation.

### Win / Loss

- The application MUST end the run as a **win** when the party reaches the final objective.
- A win in which some party members have been lost MUST still count as a win but MUST yield lower
  reputation than a full-party win.
- The application MUST end the run as a **loss** when the healer dies or the entire party is lost.
- On run end, the application MUST present a summary including the outcome and final reputation, and
  MUST offer to start a new run.

### User Interface & Controls

- The application MUST render all units as counter-like pieces distinguishable by side (healer, party,
  enemy).
- Clicking the healer MUST select it and highlight its reachable hexes; clicking a highlighted hex
  MUST move it there.
- Clicking the selected healer again, or a non-highlighted hex, MUST deselect it.
- Selecting a skill MUST display its valid targets or range; confirming a target MUST cast it and
  consume its cost.
- Clicking a party member or enemy MUST display that unit's status (health, active effects, and —
  for AI units — current intent/target) without granting control over it.
- The application MUST visually telegraph each enemy's committed target.
- Space or Enter MUST end the current turn.
- Right-click drag MUST pan the map and MUST NOT open the browser context menu.
- The application MUST surface every meaningful mechanic at the moment of decision through highlights,
  range overlays, and the inspect panel.

### Feedback & Animation

- The party and enemy phases MUST be animated step-by-step so the player can follow each unit's
  movement.
- Damage, kills, and heals MUST be shown as discrete on-screen events during the relevant phase
  rather than as silent state changes.
- A unit's death MUST occur as a visible event during the enemy or resolution phase, traceable to the
  responsible enemy.

## Non-Functional Requirements

### Styling / Theming

- The application MUST render the map and counters on an HTML canvas using flat terrain colors.
- Counters MUST read clearly at a glance, with the healer, party, and enemies visually distinct.
- Animations SHOULD be brief (favoring readability over spectacle).

### Code Quality

- The application MUST be implemented as client-side ES6 modules with no build step, bundler, or
  Node runtime dependency.
- Content that varies (skills, enemies) MUST be expressed as data over shared templates rather than
  bespoke code paths per item.
- All game state MUST be representable as named fields in well-defined data structures.

### Performance

- Rendering MUST remain responsive on a full-size map with the full set of party members and enemies
  active.
- AI pathfinding MUST complete within a single turn transition without perceptible stalling.

### Platform Compatibility

- The application MUST run in current desktop browsers that support ES6 modules and the Canvas API.
- The application MUST be served over HTTP so module imports resolve.

### Accessibility

- Interactive controls SHOULD be reachable and operable, and important state SHOULD be conveyed by
  more than color alone where practical.

## Dependencies

- No external runtime libraries, frameworks, or package managers.
- A static HTTP file server is required for development (for example `npx serve` or
  `python -m http.server`), because ES6 module imports do not resolve from the `file://` protocol.
- Browser platform APIs only: Canvas 2D and standard DOM events.

## Implementation Notes

- Coordinates use an axial `(q, r)` system with pointy-top hexes stored in a map keyed by coordinate.
  Movement and pathfinding operate over this grid; panning is a render-only screen-space offset.
- The map canvas redraws the full scene each frame (immediate-mode rendering); there is no
  retained sprite/scene graph.
- Skills SHOULD be implemented as parameter sets over a small fixed set of effect functions (one per
  template) rather than one function per skill. The same applies to enemy classes.
- Status effects SHOULD share a single uniform representation and a single tick loop so that
  interacting effects (e.g. a regeneration and a poison on the same unit) compose without special
  cases.
- Action costs SHOULD be baked into the systems that govern those actions (e.g. range and
  affordability gating which targets highlight) rather than enforced by separate post-action checks.
- The turn resolution SHOULD be split into phases connected by animation callbacks so each phase can
  render, animate, then invoke the next.
- This game inherits a hex-and-counter baseline and a layered input model (see `UI_CONTROLS.md`).
  Extension points for combat, targeted skills, and interactive locations exist in the baseline and
  are to be filled in rather than rebuilt.

## Error Handling

- If map generation cannot produce a valid path from start to objective within a bounded number of
  attempts, the application MUST retry generation rather than start an unwinnable run.
- The application MUST reject invalid player actions silently at the input layer (an unaffordable or
  out-of-range skill simply does not become castable / its targets do not highlight) rather than
  raising errors mid-turn.
- The application MUST prevent illegal moves (onto impassable terrain or an occupied hex) by not
  offering them as options.
- The application MUST ensure the healer always has at least one legal action so the player is never
  presented with a turn in which nothing can be done.
- If served from the `file://` protocol such that module imports fail, the application is expected not
  to load; it MUST be served over HTTP.
- Run-ending conditions (win or loss) MUST be detected and resolved exactly once, transitioning to the
  end overlay without further turn processing.
</content>
