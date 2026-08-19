---
name: game-design
description: Design and evaluate tactics or strategy game mechanics, balance, units, terrain, pacing, combat, spawning, objectives, difficulty, and game-state UI. Use for game-design decisions; do not invoke for implementation-only work with no design choice.
---

# Tactics and Strategy Game Design

Make recommendations that create meaningful player decisions and can be implemented as coherent systems. Treat the principles below as design lenses, not universal requirements. Preserve the user's theme, constraints, and existing rules unless the task explicitly calls for changing them.

## Start from dynamics

For a new game or major system, create or update `DYNAMICS.md` when the user wants durable design documentation. It is a design journal explaining why the game is fun, not a feature specification.

Capture:

1. The intended emotional experience.
2. Two or three load-bearing psychological drivers.
3. One clear key mechanic per driver.
4. How secondary mechanics reinforce those key mechanics.
5. The strategies, recurring trade-offs, and degenerate strategies the rules should support or prevent.
6. The state and algorithms needed to implement the mechanics.

Do not create `DYNAMICS.md` for a small tuning question unless updating it is useful to the requested work.

## Evaluate every mechanic

For each proposed or changed mechanic, ask:

- What player decision does it create?
- Which driver does it serve?
- What does it cost, and when is it a good or bad choice?
- Are its consequences readable before and after the decision?
- Does it connect to an existing system, or is it isolated bloat?
- Does it behave intuitively? If not, can the game communicate its logic immediately?
- Can it be expressed as explicit state and a short algorithm?
- What strategy uses it, and what degenerate strategy might exploit it?

Prefer a small set of reusable mechanical templates with parameterized content over bespoke code paths for every unit, item, or encounter.

## Core drivers

Choose only the drivers that fit the game:

- **Scarcity of agency:** limited actions force triage and opportunity cost.
- **Readable consequences:** players can form plans and understand why they succeeded or failed.
- **Near misses:** failure feels close enough to inspire a better attempt.
- **Competence-shaped variance:** decisions dominate outcomes while randomness shapes their edges.
- **Guardianship and loss aversion:** specific units, places, or relationships make preservation matter.
- **Revenge:** identifiable threats turn loss into a concrete target and forward momentum.
- **Escalating commitment:** progress creates pressure and prevents indefinite turtling.
- **Accumulation and windfall:** small investments can converge into a rare, earned payoff.
- **Comedy:** interacting systems leave room for surprising, retellable outcomes.

## System principles

- Use asymmetry to give actors different relationships with shared systems.
- Give units identity through clear interactions with core rules, not only stat differences.
- Collapse abstractions whose only meaningful effect is another existing resource or rule.
- Tie escalation to player progress when that better supports the intended crescendo.
- Make terrain and landmarks communicate tactics at a glance.
- Make important enemies identifiable and their behavior predictable enough to counter.
- Give rival NPCs information limits, movement constraints, commitments, and costly counterplay. If the player must complete a return trip, normally require comparable rivals to do so too.
- Model every persistent fact as named game state. If a mechanic has no clear state representation, refine it before implementation.
- Preserve at least one meaningful action when costs or hazards would otherwise leave a unit helpless.
- Surface ranges, costs, threats, and predicted consequences in the UI at the moment of decision.
- Prefer system-level costs over detached checks when the underlying model can express them cleanly.
- For multi-turn pathfinding, plan to the actual target and then consume the path within the current movement budget; avoid short-horizon choices that cannot see necessary detours.

## Tuning and validation

- Test uncertain numeric relationships with large changes first—often halving or doubling—then refine.
- Check easy, typical, and adversarial scenarios rather than balancing from averages alone.
- Verify that intended anti-strategies are prevented by actual rules, not merely discouraged by boredom.
- Look for double-edged actions: choices with situational upside and downside create better decisions than automatic rewards or unavoidable punishment.
- Prefer simple behavioral ecologies over scripted choreography when emergent play is part of the intended experience.
- Make decisive events visible. Movement, attacks, deaths, and other consequences should occur in a readable sequence rather than appearing only as an end-state notification.

When proposing a design, state the relevant driver, expected player behavior, main trade-off, likely exploit, and the smallest practical way to test it.
