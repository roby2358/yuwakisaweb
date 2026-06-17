# Super — Technical Specification

## Purpose

Super is a solo, turn-based, browser-based tactical superhero game. The player controls a single superhero (and optionally allies) through a campaign of discrete map-based encounters set in a perilous world. Gameplay centers on the creative use of a procedurally selected set of superpowers, while a parallel meta-layer advances the hero across multiple non-power dimensions of influence (popularity, science, government, economic, mystical, and others).

The game emphasizes:

- Tactical decisions on a hex grid driven by a unified Action Point economy
- Bell-curve resolution that rewards specialization without removing uncertainty
- A campaign arc combining per-map objectives with long-term character goals
- Replayability through randomized power selection and orthogonal advancement tracks

## UI Layout

```
+-------------------------------------------------------------+
|  [Hero Name] [HP] [AP] [Status Effects]      [Turn / Phase] |
+-------------------------------------------------------------+
|                                                  +--------+ |
|                                                  | Power  | |
|                                                  | List   | |
|                                                  |        | |
|              [ 30 x 30 Hex Map Canvas ]          | (click | |
|                                                  |  to    | |
|                                                  |  use)  | |
|                                                  |        | |
|                                                  +--------+ |
|                                                             |
|                                                  +--------+ |
|                                                  | Target | |
|                                                  | Info   | |
|                                                  +--------+ |
+-------------------------------------------------------------+
|  [Log: recent actions, rolls, narrative events]             |
+-------------------------------------------------------------+
|  [End Turn]  [Inventory]  [Character Sheet]  [Map Goals]    |
+-------------------------------------------------------------+
```

The Character Sheet opens a modal containing power list, advancement tracks, campaign goals, and biography.

## Functional Requirements

### Core Game Loop

- The game MUST present discrete encounters ("missions") on hex maps, connected by a campaign meta-layer.
- The player MUST be able to start a new campaign, continue a campaign, or replay a single mission.
- Each mission MUST define one or more victory conditions and one or more failure conditions.
- The game MUST return the player to the campaign meta-layer upon mission resolution (victory, failure, or retreat).

### Map and Movement

- Each tactical map MUST be a 30x30 hex grid.
- Hexes MUST have a terrain type that affects movement cost, line of sight, and cover.
- The game MUST support a defined set of map archetypes. MVP scope ships three archetypes: City Block, Grassy Field, and Evil Lair. Additional archetypes (Bank Interior, Mad Scientist's Lab, Alien Spaceship, Ritual Cult Site) are deferred.
- Each map archetype MUST define its own terrain palette and prop set. Ambient hazards are deferred.
- Movement MUST consume Action Points (AP) proportional to the terrain cost of each entered hex.
- The game MUST support blocking terrain. Elevation, destructible terrain, and interactive props (doors, switches, hostages) are deferred.
- Line of sight MUST be computed per hex pair and MUST account for blocking terrain. In MVP scope, LOS is sampled along the straight line between hex centers and blocked only by wall hexes; elevation is not considered.

### Turn Structure and Action Economy

- The game MUST be solo and turn-based, alternating between a Player Phase and an Enemy Phase.
- On the Player Phase the player MUST receive a budget of Action Points determined by the hero's Speed attribute and active effects.
- All actions — movement, attacks, power use, interaction, reload, dash, defend — MUST consume AP from this single shared budget.
- Powers MUST declare an AP cost; some powers MAY also declare a per-mission or per-encounter use limit (charges).
- The player MUST be able to end their turn voluntarily; unspent AP MUST NOT carry over by default, though specific powers MAY allow banking.
- The Enemy Phase MUST resolve enemy actions sequentially according to enemy AI priorities.

### Resolution and Bell Curve

- All contested checks (attacks, saves, skill tests, damage) MUST resolve against a bell-curve distribution rather than a flat random roll.
- The resolution system MUST produce outcomes that cluster around the expected value, with rare critical successes and critical failures in the tails.
- The resolution system MUST use a single integer score per test. The score's expected value MUST sit at the center of the curve, and the probability of higher or lower scores MUST fall off smoothly toward the tails.
- The system MUST NOT use a fixed "roll N dice of size M" method (e.g., 3d6) whose probabilities are easily memorized. Instead, the underlying distribution MUST be a continuous or fine-grained curve sampled to an integer score.
- Modifiers MUST shift the center of the curve up or down rather than adding flat bonuses to a die roll.
- Each test MUST compare an attacker score (curve center plus modifiers) against a defender score (curve center plus modifiers); the difference MUST map to a graded outcome (critical failure, failure, partial, success, critical success).
- Damage MUST be derived from the same bell-curve mechanism, scaled by the power or weapon's damage profile.
- Cover, elevation, status effects, and power synergies MUST contribute as modifiers to either side of the test.

### Superpowers

- The hero MUST possess a set of superpowers selected at character creation.
- Powers MUST be drawn from the catalog defined in `superpower.txt`, weighted by the listed frequency values.
- Each power MUST have a Power Level (Near Human, Superhuman, Planetary, Galactic, Cosmic) that scales its effect magnitude and AP cost.
- The game MUST support at least the following power categories: Body, Sensory, Flight, Mental, Energy, Matter, Mystical, Technological, and Temporal.
- Powers MUST define: AP cost, range (in hexes), area of effect, targeting rules (self, ally, enemy, hex, line, cone, burst), effect, and any charges or cooldowns.
- The game SHOULD provide a power roller that generates a thematically coherent power set for a new hero, respecting frequency weights.
- Typical ranged power range MUST fall in the 5–8 hex band unless the power explicitly overrides it.
- Typical movement allowance MUST fall in the 4–6 hex band, with movement-themed powers (super speed, flight, teleport) overriding it.

### Enemies

- The game MUST support enemy tiers. MVP scope ships Minion and Lieutenant only; Low-Grade Super, Supervillain, and Epic Threat tiers are deferred.
- Minions MUST be deployed in groups and have 0–1 powers each.
- Lieutenants MUST possess a small AP pool and at least one signature action.
- Enemy AI MUST select actions based on current mission state. Role-based utility scoring (striker, controller, tank, support) and squad-level coordination are deferred.

### Characters

- The hero MUST have core attributes including Health, Action Points, Speed, Toughness, Willpower, and Focus.
- The player MUST control exactly one hero on the tactical map. The game is solo in both campaign structure and unit count.
- The hero MUST NOT permadie. When the hero's Health reaches zero, the mission MUST end and the hero MUST recover off-screen, waking in a hospital, super-base, or other narratively appropriate location with consequences (lost time, lost track progress, injury status, etc.) but a continuing campaign.
- NPC contacts and supporting cast MAY be referenced through advancement tracks and campaign events but MUST NOT appear as controllable units on the tactical map.

### Advancement Tracks

- The game MUST provide twelve advancement tracks orthogonal to power growth. The tracks are:
  - Popularity
  - Science
  - Government
  - Economic
  - Mystical
  - Underworld
  - Media
  - Military
  - Academic
  - Religious
  - Cosmic
  - Personal (relationships, mental health, identity)
- Each track MUST have discrete ranks; advancing a rank MUST unlock track-specific perks, contacts, resources, or mission options.
- Mission outcomes, dialogue choices, and downtime activities MUST be the primary sources of track progression.
- Tracks MUST be able to decrease as well as increase based on player choices and events.
- Track ranks MUST influence both narrative options and tactical capabilities (e.g., Government rank may grant air support; Mystical rank may grant ritual abilities).
- The hero MUST also be able to improve existing powers (raising Power Level) and gain new powers, on a path independent of the twelve tracks.

### Between-Mission Phase

- After every mission resolution the game MUST present a Between-Mission phase before the next mission begins.
- The Between-Mission phase MUST allow the player to spend a budget of downtime actions on activities that advance one or more of the twelve advancement tracks.
- Downtime activities MUST include at least: training (improve a power or attribute), networking (advance a social-flavored track), research (advance Science/Academic), patrol (gain reputation, risk a random encounter), and rest (recover injuries and lingering status effects).
- The Between-Mission phase MUST surface available story beats, arc-goal progress, and any consequences from the previous mission.
- The Between-Mission phase MUST be where the player selects the next mission from one or more offered options, where applicable.
- Injuries or status effects carried out of a mission MUST be resolved or carried forward in this phase, not silently cleared.

### Mission Objectives and Campaign Arc

- Each mission MUST present at least one primary objective and MAY present optional secondary objectives.
- Primary objectives MUST be drawn from a defined set. MVP scope ships Defeat All Enemies and Reach Location; Protect Target, Hold Location, Recover Item, Investigate, and Escape are deferred.
- The campaign MUST track long-term character arc goals that span multiple missions (e.g., "Expose the Mayor", "Master the Crimson Flame", "Save your mentor").
- Arc goals MUST update based on mission outcomes and advancement track progress.
- Failure of a mission MUST NOT necessarily end the campaign; consequences MAY include lost reputation, injured allies, or hardened enemies.

### Persistence

- The game MUST persist campaign state to local browser storage between sessions.
- MVP scope maintains a single active campaign save. Multiple named saves and export/import are deferred.

### User Interface Controls

- The player MUST be able to select a hex by clicking it.
- The player MUST be able to select a power from the power list and then target it via the map.
- The player MUST be able to preview the AP cost, range, area, and predicted outcome of an action before committing.
- The player MUST be able to end the turn from a clearly visible control.
- The player MUST be able to open the Character Sheet, Map Goals, and Log at any time.

### Status and Feedback

- The game MUST display the active hero's HP, AP, and status effects at all times during a mission.
- The game MUST log every action, roll outcome, and significant event to a scrolling log.
- The game MUST visually highlight valid targets, movement range, and area of effect during targeting.
- Critical successes and failures MUST be visually distinct from ordinary outcomes.

## Non-Functional Requirements

### Styling and Theming

- The visual style SHOULD evoke a comic-book superhero aesthetic.
- The map MUST be rendered to an HTML canvas.
- UI panels MUST be responsive to common desktop window sizes (minimum 1280x800).

### Code Quality

- The codebase MUST be plain ES modules with no build step.
- The codebase MUST follow the project's existing conventions established by the hex-and-counter implementation in the parent project.
- The codebase MUST NOT introduce a package manager or bundler.

### Performance

- A full map render at 30x30 hexes MUST complete within one animation frame on a typical desktop browser.
- Pathfinding for any single unit on a 30x30 map MUST complete in under 50 ms.

### Browser Compatibility

- The game MUST run in current versions of Chrome, Firefox, and Edge.
- The game SHOULD degrade gracefully on Safari.

### Accessibility

- Color MUST NOT be the sole channel for conveying critical information; icons or text MUST accompany color cues.
- Full keyboard reachability of interactive controls is deferred.

## Dependencies

- No third-party runtime dependencies. The game MUST be implemented in vanilla HTML, CSS, and JavaScript (ES modules).
- The hex math, A*, and BFS utilities SHOULD be reused or adapted from the existing `hex.js` in the parent project.
- Random number generation SHOULD reuse the `Rando` utility from the parent project.

## Implementation Notes

- The bell curve is implemented by sampling a Gaussian via the Rando utility's gaussian helper with standard deviation of approximately three. Modifiers shift the center of the curve rather than adding flat bonuses. Each contested test computes an attacker score and a defender score from shifted centers, and the resulting delta is bucketed through an outcome band table mapping to critical failure, failure, partial, success, and critical success. Damage is derived from the same sampler scaled by the power's damage profile.
- Map generation is procedural per archetype and uses a seeded mulberry32 pseudorandom stream so a given mission seed is reproducible.
- Powers are data-driven in `powers.js`. The shipped MVP catalog comprises twelve starter powers: Super Punch, Chi Fist, Energy Bolt, Focus Beam, Flame Burst (AOE), Psi Blast, Stunning Gaze, Super Speed, Flight, Inner Focus, Regeneration (charge-based), and Shockwave. The full `superpower.txt` catalog is a design reference and is not yet wired through the engine.
- Downtime activities shipped in MVP: train, network, research, patrol, and rest.
- Map archetypes shipped in MVP: City Block, Grassy Field, and Evil Lair.
- Advancement tracks are stored as a single object on the campaign save, with each track holding a current rank and an XP value toward the next rank.
- Save data is stored in `localStorage` under the key `super.campaign.v1`, serialized as JSON.
- The files `renderer.js` and `colortheory.js` remain in the directory as unused legacy carryover and SHOULD NOT be referenced by new code. They are candidates for removal.

## Deferred / Future Work

The following items are specified above as long-term intent but are explicitly out of MVP scope. They are tracked here so they are not mistaken for shipped functionality.

- Destructible terrain, elevation, and interactive props (doors, switches, hostages).
- Line-of-sight that accounts for elevation or partial cover geometry beyond wall-hex sampling.
- Additional map archetypes: Bank Interior, Mad Scientist's Lab, Alien Spaceship, Ritual Cult Site.
- Ambient hazards per archetype.
- Enemy tiers beyond Minion and Lieutenant: Low-Grade Super, Supervillain, and Epic Threat, along with multi-phase boss behavior and squad-level coordination.
- Role-based utility-scored AI behaviors (striker, controller, tank, support).
- Objective types beyond Defeat All Enemies and Reach Location: Protect Target, Hold Location, Recover Item, Investigate, Escape.
- Save export and import, and multiple named campaign saves.
- Undo of movement steps within a turn.
- Full keyboard reachability of interactive controls.
- Wiring the full `superpower.txt` catalog and frequency-weighted power roller through the engine.

## Error Handling

- If save data fails to load or is corrupted, the game MUST present a clear error to the player and offer to start a new campaign without overwriting the existing save.
- Invalid player actions (insufficient AP, out-of-range target, blocked line of sight) MUST be rejected with a visible explanation rather than silently ignored.
- If a mission enters an unrecoverable state (e.g., all player units defeated with no retreat possible), the game MUST resolve the mission as a failure and return cleanly to the campaign layer.
- Unexpected runtime errors during a mission SHOULD be caught at the top of the game loop, logged to the console, and surfaced to the player as a non-fatal notification where possible.
