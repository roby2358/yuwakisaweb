# TRAINING.md

A recommendation for learned AI in Hex & Counters, scoped to a small **12×12 arena
with two teams of 4**. This is the tractable testbed, not the full 60×40 game — see
*Sim-to-real* under Risks for why that distinction matters.

This is a design recommendation, not a spec. It answers *what to build and in what order*,
and *why this shape over the obvious one*.

---

## TL;DR

- **Don't** train a net to pick movement hex-by-hex. Train it to pick an **intent**
  (engage-whom / advance / hold / retreat) and let the existing `Movement` + A* layer execute.
  Small action space, reuses proven code, stays readable.
- **Don't** start with a neural net. Start with a **linear policy over hand features**
  trained by **cross-entropy method (CEM)** — it validates the whole pipeline (env, reward,
  self-play, integration) at ~dozens of weights before you risk a net.
- **Don't** reach for PPO/autodiff. Use **gradient-free Evolution Strategies** — pure JS,
  ~150 lines, no Python, no build step, runs as `node train.js`. Matches the project ethos.
- The hard, valuable prerequisite is a **headless rules core** (`step(state, actions)` with
  no canvas/DOM). Everything else depends on it; it's also independently worth having.

---

## Why this shape

Three forces drive every decision below:

1. **Pure-JS, no-build constraint.** The game runs from `file://` with plain `<script>`
   includes. Anything that needs npm, a bundler, or Python-in-the-loop fights the project.
   Gradient-free training and a few hand-written matrix multiplies stay inside the tent.
2. **Readable Consequences (DYNAMICS driver).** A black-box net that occasionally suicides a
   hero the player is *guarding* reads as a bug, not as AI. An intent-level policy keeps the
   decision legible ("it chose to retreat") and keeps the tested pathing intact.
3. **The existing AI is already a clean seam.** `PartyAI.goal/budget` and `EnemyAI.target/budget`
   answer "where does this unit want to go, how far." A learned policy can slot *behind that
   exact contract*. We are replacing the hand-tuned heuristic that fills those methods, not
   rewriting the turn loop.

---

## The arena environment

A self-contained training scenario, deliberately smaller and faster than the real map.

- **Board:** 12×12 hex arena, same axial/pointy-top model and `Hex` math as the game. Outer
  ring is impassable wall. Interior terrain randomized per episode (plains/hills/forest/mountain
  mix) so policies generalize instead of memorizing one map.
- **Teams:** 4 units per side, spawned clustered on opposite edges. Mixed classes drawn from
  the real roster (melee/tank, archer, and the enemy classes). Self-play: both sides run the
  policy under training.
- **Episode:** alternating team turns, reusing the real movement + combat resolution. Ends when
  one team is eliminated or at a **turn cap (~40)**. The cap prevents stalemates from running
  forever and is the main lever against passive turtling.
- **Reset:** new random terrain, spawns, and class composition each episode — variance is what
  forces a robust policy rather than an opening-book.

Episodes on a 12×12 board are cheap (tens of units, dozens of turns, no rendering). That cheapness
is exactly what makes gradient-free training viable — sample-inefficiency stops mattering when a
million episodes is minutes, not days.

---

## Observation (per unit, egocentric)

Each unit sees the world from *its own* hex, so one policy generalizes across board positions
and across the 4 interchangeable units in a team.

- **Local window:** a radius-3 disk (37 hexes) centered on the unit, as a few feature planes:
  terrain move-cost, ally presence, enemy presence, enemy threat (damage), danger heat
  (reuse `buildDangerMap`).
- **Self scalars:** HP fraction, armor, MP/budget, attack range.
- **Bearings:** relative distance + direction to nearest enemy, nearest ally, and the objective.

Flattened, that's roughly a **60–120 element vector** — small enough for a tiny net and for ES.
Keep it egocentric and *relative*; never feed absolute (q, r) or the policy overfits to map
coordinates.

---

## Action space — intent, not hexes

**This is the central recommendation.** The policy outputs a score over a small fixed set of
**intents**, not movement directions:

- **Engage** nearest / weakest / most-dangerous enemy (a few variants)
- **Advance** toward the objective
- **Hold** position
- **Retreat** to safety (away from threat / behind the tank)
- **Regroup** on the team's center of mass

~6–8 discrete intents. The chosen intent resolves to a goal hex, then the **existing
`Movement.walkToward` + A*** walks it within budget, and the **existing combat code** auto-resolves
an attack if a target lands in range.

Why intent-level wins over hex-level:

- **Tiny, fixed action head** (6–8 logits) regardless of board size or reachable-set size.
- **Reuses global-vision pathing.** A per-step direction policy throws away A* and tends to learn
  dumb coastline-hugging; here the proven layer handles execution.
- **Readable.** The net's output maps to a word you can show or log. Debugging is "why did it pick
  Retreat" not "why did it emit direction 4."
- **What it learns is exactly what's currently hand-coded** — target selection and stance — which
  is the genuinely hard part of `PartyAI`/`EnemyAI`. We're learning the decision, not the geometry.

(Target *selection within* an intent — which enemy to engage — can start as a rule, e.g. lowest HP
in range, and be promoted to a second small head later if it matters.)

---

## Policy

- **Phase 1 — linear.** Score each intent as a linear function of the feature vector. A few dozen
  weights. Trivial to train, trivial to read, and it proves the pipeline end-to-end before any net
  exists. If a linear policy already beats the hand-coded AI, you may be done.
- **Phase 2 — small MLP.** input (~80) → hidden (~48, ReLU) → intent logits (~8). A few thousand
  parameters. Softmax-sample while training (exploration), argmax in the live game. Forward pass is
  three loops of multiply-accumulate — pure JS, no library.
- **Parameter sharing:** one policy per **role** (e.g. melee / ranged / enemy), shared across the
  4 units of that role. Faster learning, and it matches the real game where units of a class are
  interchangeable.

Trained weights export as a plain JSON array and load via a normal `<script>`/`fetch` — no build.

---

## Training algorithm — Evolution Strategies, self-play

Gradient-free, so there is no autodiff to implement and nothing to port to Python.

- **Linear policy → CEM (cross-entropy method).** Sample a population of weight vectors from a
  Gaussian, score each by average fitness over K episodes, refit the Gaussian to the top elites,
  repeat. Dead simple, ideal for low dimensions.
- **MLP → OpenAI-style ES.** Antithetic Gaussian perturbations of the mean weights, rank-normalize
  the returns, update the mean by the reward-weighted sum of perturbations. Scales to thousands of
  parameters where CEM stalls.

Self-play stability:

- Keep a **champion pool** (a handful of past-best policies) and sample opponents from it, not just
  the current best. This is lightweight **league play** — it stops the two sides from chasing each
  other in circles (rock-paper-scissors cycling) and produces robust rather than brittle policies.
- ES is **embarrassingly parallel**: each population member is an independent batch of episodes.
  Web Workers in-browser, or just multiple node processes. No shared state during rollout.

Sketch of one ES generation (pseudocode, not final):

```
for gen in generations:
    pop = mean + sigma * gaussian(N, dim)          # antithetic: also use -gaussian
    fitness[i] = avg over K episodes of rollout(pop[i] vs sampled champion)
    mean += lr * weighted_sum(rank_normalize(fitness), perturbations)
    if best(pop) beats current champion: add to champion pool
```

---

## Reward

Terminal outcome dominates; shaping only nudges. Per **team** (win/loss) with light per-unit
shaping for credit assignment.

- **Terminal:** large + for wiping the enemy team / surviving to the cap with more units; large −
  for being wiped. The objective (reach/return treasure) adds a terminal bonus on the party side.
- **Shaping (small):** + damage dealt, + enemy kills, − damage taken, − own deaths. Just enough to
  give signal before the sparse terminal reward arrives.
- **Anti-turtle:** the turn cap plus a small per-turn time penalty on the side that *should* be
  pushing (the party). Without it, "stand still and win on the cap" is a real degenerate policy —
  verify it isn't being learned (see Risks).

Keep shaping coefficients small relative to the terminal reward. Heavy shaping is the classic way
to learn a policy that maximizes the proxy (poke-and-retreat for chip damage) instead of winning.

---

## Integration with the live game

The payoff of the intent-level design: integration is a drop-in.

- A new strategy — call it `NeuralAI` — implements the **same contract** as `PartyAI` / `EnemyAI`:
  given a unit and live state, return its goal (and budget). Internally it builds the observation,
  runs the forward pass, picks the top intent, and resolves it to a goal hex. `Movement` and the
  turn loop are untouched.
- Swap is a one-line strategy selection in the party/enemy phase (ideally a config flag, so
  hand-coded vs. learned AI is A/B-testable in playtests — keep the heuristic AI as the baseline
  to beat).
- Weights ship as a JSON file loaded at startup.

---

## Risks & caveats

- **Sim-to-real gap.** A policy trained on a 12×12 4v4 arena is deployed on a 60×40 map with
  warband-scale dynamics, a leash, a non-combatant healer, and an objective rush. Egocentric +
  relative observations and intent-level actions are *chosen specifically* to narrow this gap, but
  expect to retrain with scenarios closer to the real game (bigger boards, uneven team sizes,
  objective pressure) before it transfers. Treat the arena as a **bring-up environment**, not the
  final curriculum.
- **The healer is out of scope here.** It's a long-horizon support role (sparse reward: did the
  party survive?), it's the *player's* unit, and it doesn't fit a 4v4 combat arena. Tackle it only
  after combat policies work, as its own problem.
- **Self-play cycling.** Without the champion pool, policies oscillate and "improvement" is illusory.
  Always evaluate against a *fixed* benchmark (the current hand-coded AI) to measure real progress.
- **Reward hacking.** Watch for poke-and-retreat (shaping too heavy) and cap-stalling (no time
  pressure). If you see either, the reward is wrong, not the algorithm.
- **Readability cost.** Even intent-level, a learned policy is less inspectable than the documented
  heuristics. Log the chosen intent per unit per turn so playtest oddities stay traceable.

---

## Build plan

0. **Headless core.** Extract a pure rules engine from `index.js`: `step(state, actions) → state,
   events`, no canvas/DOM. Prerequisite for everything; independently valuable (scriptable, testable).
1. **Arena env.** 12×12 random-terrain scenario, 4v4 spawns, turn cap, reset. Run random-vs-random
   to confirm episodes terminate and rewards compute.
2. **Intent action space.** Define the ~8 intents and their goal-hex resolution, wired through the
   existing `Movement`. Verify a hand-set intent policy plays sensibly.
3. **Linear policy + CEM.** Smallest end-to-end loop. Goal: beat random, then approach the hand-coded
   AI. This validates env + reward + self-play + integration cheaply.
4. **MLP + ES + champion pool.** Upgrade the policy class once the pipeline is trusted.
5. **Wire `NeuralAI` into the live game** behind a config flag; A/B against the heuristic baseline in
   real playtests.

**Stretch:** healer policy; a per-step low-level movement head (only if intent-level proves too
coarse); PPO-in-Python with exported weights (only if ES plateaus — it adds a toolchain the rest of
the project deliberately avoids).
