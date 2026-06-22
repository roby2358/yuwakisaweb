# TRAINING.md

A recommendation for learned AI in Hex & Counters, scoped to a **24×24 training vignette**:
the unit being trained sits at the center, its allies form up around it, and a single enemy
warband spawns one aggro-range (8 hexes) out. This is the tractable testbed, not the full
60×40 game — see *Sim-to-real* under Risks for why that distinction matters.

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
- The gating prerequisite — a **headless rules core** with no canvas/DOM — **now largely
  exists**: the `GameState` / `GameEngine` split (see CLAUDE.md) makes `engine.resolveTurn()` a
  synchronous, UI-free step. Training mainly needs an entry point that applies *chosen intents*
  instead of the built-in AI.

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

A self-contained training vignette, deliberately smaller and faster than the real map, built
around the **one unit being trained** (the *focal unit*).

- **Board:** 24×24 hex arena, same axial/pointy-top model and `Hex` math as the game. Outer
  ring is impassable wall. Interior terrain randomized per episode (plains/hills/forest/mountain
  mix) so policies generalize instead of memorizing one map. The board is large enough that a
  centered unit and a warband one aggro-range out both sit well clear of the walls.
- **Layout:** the focal unit spawns at the **center**; its **allies form up around it** (the
  party — ~4 units including the focal one); a single **enemy warband** (1–4, per the game's
  group sizes) spawns at distance `AGGRO_RANGE` (8) in a **random direction**. Distance 8 puts
  the encounter right on the aggro threshold — the warband wakes and commits as the episode
  opens, so the focal unit must position *now*, not wander to find a fight.
- **Episode:** alternating turns, reusing the real movement + combat resolution. Ends when the
  warband is cleared, the focal unit's party is wiped, or a **turn cap (~40)** hits (the lever
  against stalemates / passive turtling).
- **Reset:** new random terrain, a new warband bearing / size / composition, and a new ally
  composition each episode — that variance, plus rotating *which role is the focal unit*, is
  what forces a robust policy rather than an opening-book for one fixed picture.

Who controls the others? Train **one role at a time**: the focal unit runs the policy under
training while its allies and the warband run the current hand-coded AI (or frozen past
champions — that's where self-play re-enters, below). Rotate the focal role across runs so
every class gets trained in its own vignette. Episodes on a 24×24 board with a handful of units
are cheap (dozens of turns, no rendering) — that cheapness is what makes gradient-free training
viable: sample-inefficiency stops mattering when a million episodes is minutes, not days.

---

## Observation (per unit, egocentric)

Each unit sees the world from *its own* hex, so one policy generalizes across board positions
and across the interchangeable units of a given role.

- **Local window:** a radius-3 disk (37 hexes) centered on the unit, as a few feature planes:
  terrain move-cost, ally presence, enemy presence, enemy threat (damage), danger heat
  (reuse `buildDangerMap`).
- **Self scalars:** HP fraction, armor, MP/budget, attack range.
- **Bearings:** relative distance + direction to nearest enemy, nearest ally, and the objective.

Note the warband starts a full aggro-range (8) out — *beyond* a radius-3 window — so at the
opening of an episode the focal unit perceives it through the nearest-enemy **bearing** scalars
and the **danger heat** plane, not the local patch. That's by design (it must learn to react to
a threat it can't yet see in detail); widen the window toward the aggro radius only if those
coarse signals prove insufficient.

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
  units of that role. Faster learning, and it matches the real game where units of a class are
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

- Start with **scripted others** (the hand-coded AI drives allies and the warband) so the focal
  policy has a fixed target to climb against. Then, to harden it, replace those scripts with
  **frozen past champions** drawn from a **champion pool** rather than always the latest — this
  lightweight **league play** stops policies chasing each other in circles (rock-paper-scissors
  cycling) and produces robust rather than brittle behavior.
- ES is **embarrassingly parallel**: each population member is an independent batch of episodes.
  Web Workers in-browser, or just multiple node processes. No shared state during rollout.

Sketch of one ES generation (pseudocode, not final):

```
for gen in generations:
    pop = mean + sigma * gaussian(N, dim)          # antithetic: also use -gaussian
    # focal unit runs pop[i]; allies + warband run scripted AI or a sampled champion
    fitness[i] = avg over K episodes of rollout(focal=pop[i], others=opponent)
    mean += lr * weighted_sum(rank_normalize(fitness), perturbations)
    if best(pop) beats current champion: add to champion pool
```

---

## Reward

Terminal outcome dominates; shaping only nudges. Scored from the **focal unit's** side (it and
its allies), with light per-unit shaping for credit assignment.

- **Terminal:** large + for clearing the warband with the focal unit (ideally its allies too)
  still standing; large − if the focal unit or its party is wiped.
- **Shaping (small):** + damage dealt, + enemy kills, − damage taken, − allies lost. Just enough
  to give signal before the sparse terminal reward arrives.
- **Anti-turtle:** the turn cap plus a small per-turn time penalty, so "kite forever and survive
  on the cap" isn't a winning policy — verify it isn't being learned (see Risks).

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

- **Sim-to-real gap.** A policy trained on a 24×24 single-warband vignette is deployed on a 60×40
  map with *multiple* warbands, a leash, a non-combatant healer, and an objective rush. Egocentric
  + relative observations and intent-level actions are *chosen specifically* to narrow this gap, but
  expect to retrain with scenarios closer to the real game (bigger boards, several warbands at once,
  objective pressure) before it transfers. Treat the vignette as a **bring-up environment**, not the
  final curriculum.
- **The healer is out of scope here.** It's a long-horizon support role (sparse reward: did the
  party survive?), it's the *player's* unit, and it doesn't fit a single-warband combat vignette.
  Tackle it only after combat policies work, as its own problem.
- **Self-play cycling.** Without the champion pool, policies oscillate and "improvement" is illusory.
  Always evaluate against a *fixed* benchmark (the current hand-coded AI) to measure real progress.
- **Reward hacking.** Watch for poke-and-retreat (shaping too heavy) and cap-stalling (no time
  pressure). If you see either, the reward is wrong, not the algorithm.
- **Readability cost.** Even intent-level, a learned policy is less inspectable than the documented
  heuristics. Log the chosen intent per unit per turn so playtest oddities stay traceable.

---

## Build plan

0. **Headless core.** *Largely done* — the `GameState` / `GameEngine` split already gives a
   UI-free rules core: `engine.resolveTurn()` mutates state and returns event frames with no
   canvas/DOM. What's left for training is a `step`-style entry that applies *chosen intents* for
   the focal unit instead of running the built-in AI.
1. **Vignette env.** 24×24 random-terrain scenario: focal unit centered, allies around it, one
   warband at aggro range in a random direction; turn cap; reset. Run scripted-vs-scripted to
   confirm episodes terminate and rewards compute.
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
