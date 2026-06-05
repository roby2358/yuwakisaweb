# COMMENTARY: The Search & Optimization Approach

A reading of what `essence.js` actually does as an optimizer, why it behaves the
way it does, and how the approach holds up as the dimensionality of the search
space grows. This is commentary on the *implemented* algorithm — where it
diverges from `README.md`'s aspirational design, that is noted.

## What is being optimized

Two layers share one coordinate space:

- **The objective `f(x, y)`** — the target. It is a sum of `cauchy`-shaped heat
  bumps (heavier tails than a Gaussian) centered on the points in `maxima`,
  clamped to `[0, 1]`. With three bumps of unequal weight (`(i + 1) * 0.3333`),
  the landscape is *multimodal*: three local maxima of differing height, with
  broad overlapping basins. This is the honest test case — a single-peak field
  would hide the algorithm's main failure mode.
- **The population `points`** — candidate solutions hunting for the field's
  peaks. Each carries `{x, y, score}` with `score = f(x, y)` cached.

`f` is treated as a black box: the optimizer only ever *evaluates* it, never
differentiates it or inspects its structure. This is a zeroth-order
(derivative-free) method, which is the right framing for the generalization
discussion later.

## The core loop

Each `cycle()` does the following (see `essence.js:177`):

1. Draw one fresh uniform-random candidate `r` (a *random immigrant*).
2. Breed `r` against **every** current point via `merge(p, r)`, producing one
   child per existing point.
3. Form the next generation as `old points ∪ children ∪ {r}` — up to
   `2 * numPoints + 1` candidates.
4. `trim()`: sort by score descending, keep the top `numPoints` (10).

In evolutionary-computation terms this is a **steady-state, elitist (μ+λ)
evolution strategy** with a single immigrant per generation and truncation
survivor selection. There is no separate mutation operator; all variation comes
from recombination and from the random immigrant.

## The `merge` operator: interpolate or extrapolate

`merge(a, b)` (`essence.js:150`) is where the search character lives. It first
builds *noisy* score weights:

```
aa = a.score + random()/10   // noise ∈ [0, 0.1)
bb = b.score + random()/10
ab = aa / (aa + bb),  ba = bb / (aa + bb)
```

Adding uniform noise to each score before normalizing is deliberate: it means a
zero-scoring parent still pulls with a small nonzero weight, and the blend ratio
stays stochastic rather than a fixed function of fitness. This is a cheap,
built-in source of diversity that keeps the operator from being purely greedy.

The *scale* of that noise is the tuning knob. Scores are clamped to `[0, 1]`
(`essence.js:31`), so the `/10` divisor puts the noise in `[0, 0.1)` — the same
order as the score *gaps* between survivors near convergence (~0.1), but small
next to the large gaps early in the search. The effect is a soft, roughly
rank-ish bias:

- **Large score gap (early, immigrant vs. straggler)** → fitness leads; children
  are pulled firmly toward the better parent.
- **Small score gap (early ties, or late when all survivors cluster high)** →
  noise becomes the tie-breaker and the blend is effectively randomized between
  two already-good points, which is exactly what you want there.

(An earlier version used un-divided `random()` ∈ `[0,1)` — noise the size of the
*entire* score range. That swamped the score: weighting was near-uniform even
when one parent was clearly better. The `/10` scaling lets the score actually
lead while keeping noise relevant where it helps.)

Then it picks one of two moves with equal probability:

- **Case 0 — convex combination (interpolation):**
  `x = a.x*ab + b.x*ba`. The child lands *between* the two parents, biased toward
  the higher-scoring/luckier one. This always stays inside the convex hull of
  the population — it is the *exploitation* / contraction move.
- **Case 1 — affine extrapolation:**
  `x = a.x + (a.x - b.x)*ba`. The child is pushed *past* `a`, away from `b`,
  by a fraction set by `b`'s weight. This can leave the convex hull — it is the
  *exploration* / expansion move, and it is the only way the population can reach
  regions outside the span of its current members.

(There is a stray duplicate `break;` at `essence.js:165`; it is dead but
harmless — both `case 0` and `case 1` already break.)

## Why it works — and the implicit annealing

The interplay of the two moves produces a self-scaling search:

- When the population is spread out, extrapolation and wide interpolations make
  large jumps — coarse exploration.
- As survivors converge toward a peak, the pairwise distances shrink, so *both*
  operators produce smaller and smaller steps. **Step size is emergent from
  population spread, not a tuned schedule.** This gives a free annealing-like
  behavior: big moves early, fine moves late, with no explicit temperature.

The random immigrant `r` is the counterweight. Elitist truncation on a fixed
population of 10 converges fast but would otherwise collapse onto a single basin
(premature convergence). Injecting one fresh uniform sample per cycle
continuously re-seeds exploration and gives the method a restart/escape
mechanism for a multimodal field.

## Honest weaknesses

- **Diversity collapse / peak abandonment.** With `numPoints = 10` and an
  elitist sort, the population tends to pile onto the single tallest peak. The
  three-bump field has secondary maxima that the algorithm will typically
  *abandon* once the leader is found. There is no niching, crowding, or
  speciation to maintain coverage of multiple peaks. The immigrant is the only
  thing keeping secondary basins alive, and it is a weak force (one sample per
  cycle).
- **No bounds handling.** `merge` produces real-valued, possibly fractional and
  out-of-range coordinates; extrapolation can fling a child off the grid. `f`
  tolerates any input (off-field points just score low and get trimmed), so this
  is self-correcting but wasteful — some evaluations are spent on candidates that
  can never survive.
- **Fixed, tiny population.** Ten survivors and ~11 evaluations per cycle is
  cheap but gives little parallel coverage of a landscape.
- **No stopping criteria.** The README lists target-score / max-iterations /
  stall-detection stopping rules; the code implements none. It runs forever on a
  `setInterval`, which is correct for a *visualization* but means it is not a
  solver you would call and wait on.
- **README ≠ code.** The README's quadtree-guided exploration (bias sampling
  toward under-sampled hyper-rectangles) is *not* implemented. Sampling is plain
  uniform. Treat the quadtree as a design note, not current behavior.

## The non-stationary variant

When the **move** toggle is on, `driftMaxima()` walks each peak toward a random
destination and the whole population is rescored every frame
(`essence.js:178`). This turns the problem into *tracking a moving optimum*
rather than finding a static one. The steady immigrant + small steps make the
method reasonably good at this: it is already structured to chase a target that
drifts slowly relative to its convergence rate. Click-to-relocate
(`essence.js:200`) is the discrete version — it teleports one peak and forces a
rescore, letting you watch the population re-home.

---

## Higher-dimensional searches

The README frames this as an *n*-dimensional algorithm, and the operators are
genuinely dimension-agnostic: `merge`'s interpolation and extrapolation are
per-coordinate linear operations that generalize to a vector of any length with
no change in form. Only the 2D *rendering* (the HSV heatmap, `plot*`) is
intrinsically planar. So "does it generalize?" splits into two questions:
*mechanically* (yes, trivially) and *effectively* (this is where it gets hard).

### What breaks as dimension grows

1. **The random immigrant stops finding anything (curse of dimensionality).**
   The single uniform sample per cycle is the engine of exploration. The volume
   of the search box grows as `size^d`, so the chance that one uniform draw lands
   anywhere near a peak's basin falls off exponentially. In 2D it works because a
   handful of immigrants tile the space adequately; in 20D a million immigrants
   would still leave essentially all of the volume untouched. Exploration becomes
   the bottleneck and the method degrades to "polish whatever the first lucky
   sample happened near."

2. **Convex combinations concentrate toward the mean.** By concentration of
   measure, in high dimensions pairwise distances bunch up and weighted averages
   of random points collapse toward the population centroid. The interpolation
   move loses its discriminating power — most blends look alike and sit near the
   middle, which is rarely where a peak is.

3. **The quadtree idea is exponential.** The README's "divide space into a
   quadtree of hyper-rectangles" needs `2^d` children per split. That is fine at
   d=2 (4) and tolerable at d=3 (8), but hopeless past ~10 dimensions. Grid- or
   tree-based space partitioning for exploration does not survive the jump.

4. **Evaluation budget explodes.** Each cycle costs `O(numPoints)` evaluations.
   To cover a high-dimensional space you need both a larger population (rules of
   thumb scale it roughly linearly with `d`) and many more cycles, while `f` in
   real problems is often expensive. Cost compounds from both directions.

5. **Visualization stops being possible.** Everything past 3D needs a different
   view: dimensionality-reduction projections (PCA/t-SNE/UMAP), 2D slices through
   the best point, or parallel-coordinates plots of the population. The current
   heatmap pipeline does not extend.

### What still works

- The **operator forms** carry over unchanged.
- The **implicit step-size annealing** (steps shrink as the population
  converges) still holds, and is arguably *more* valuable in high dimensions
  where a fixed step size is hard to choose.
- The **noisy-weight diversity trick** is dimension-independent and remains a
  cheap hedge against greedy collapse.

### What you'd change to make it scale

The honest answer is that black-box methods purpose-built for high-D already
exist, and the natural evolution of this code is toward one of them:

- **Replace the uniform immigrant with structured mutation.** A Gaussian
  perturbation around existing points (rather than a uniform draw over the whole
  box) keeps proposals near the current front, which is the only tractable place
  to search in high-D.
- **Adopt differential-evolution recombination.** DE/rand/1,
  `child = x_r1 + F*(x_r2 - x_r3)`, is the battle-tested cousin of this code's
  extrapolation move: it derives both direction *and* scale from the population's
  own spread, automatically adapting per-dimension. It is essentially the
  "right" version of what `merge`'s `case 1` is reaching for.
- **Or go to CMA-ES** when the budget allows — it learns a full covariance of
  the search distribution, capturing correlations between dimensions that this
  axis-wise method cannot.
- **Add niching / crowding** if multiple optima must be retained, since
  diversity collapse only gets worse with dimension.
- **Add a surrogate model** (Gaussian-process / Bayesian optimization) when `f`
  is expensive, so evaluations are spent where an estimated value *and its
  uncertainty* are highest, rather than on uniform guesses.

In short: as a 2D visualization the design is well-matched to its job — the
emergent step-size annealing and the immigrant-driven exploration are elegant
and cheap. As a literal *n*-dimensional optimizer, its exploration mechanism
(one uniform immigrant) and its axis-wise blends are exactly the parts that the
curse of dimensionality attacks first, and the path to scaling it is the path
toward differential evolution or CMA-ES.

---

## `f` as cosine similarity

A useful special case, because it inverts several of the high-dimensional
conclusions above. Take the objective to be the cosine similarity to a fixed
target vector `t`, **scaled into `[0, 1]`**:

```
f(x) = (1 + cos)/2,     cos = (x · t) / (|x| |t|)
```

The `[0, 1]` scaling is not a patch — it is the same contract every `f` in this
code already honors (the field is `Math.min(1, value)` at `essence.js:31`), and
the weighting in `merge` *assumes* non-negative scores. Raw cosine lives in
`[-1, 1]` and would violate that contract; folding the remap into the definition
of `f` makes the cosine case obey the precondition by construction, so it can be
treated as a plain constraint on `f` rather than special-cased downstream. With
this constraint, anti-aligned vectors score 0, orthogonal ones 0.5, and aligned
ones 1.

The lesson is that the *structure* of the objective matters more than the
dimension count — and cosine similarity has unusually friendly structure. What
the `[0, 1]` constraint does **not** fix are the two facts that come from
cosine's geometry rather than its range: contrast decay and the free magnitude
dimension, both below.

### The landscape changes shape

- **The optimum is a ray, not a point.** `f` is scale-invariant
  (`f(x) = f(αx)` for `α > 0`), so every positive multiple of `t` scores 1. All
  the structure lives on the unit sphere `S^{d-1}`, where `f` is **smooth and
  unimodal**: one max at `t/|t|`, one min antipodal, monotone in between.
- **No localized basins, no flat dead zones.** Every point carries a real signal
  toward `t`. This is the opposite of the Cauchy bumps, where nearly all of the
  volume is flat ≈0 and the peaks are tiny needles.

That single difference removes the biggest curse-of-dimensionality problem from
the section above — *"the random immigrant stops finding anything."* There is no
needle to miss; the whole space slopes toward the answer.

### "Concentration toward the mean" flips from bug to feature

Above, the convex-combination move was called a liability in high-D because
blends collapse toward the centroid. For cosine similarity that is exactly the
desired behavior. Decompose each vector into a target component plus orthogonal
noise:

```
x_i = (cos θ_i)·t̂  +  (sin θ_i)·n_i        // n_i ⊥ t̂, roughly independent
```

Averaging several such vectors **preserves the `t̂` component but cancels the
orthogonal noise** (it shrinks like `1/√k`), so the average aligns *better* with
`t` than any of its parents. The interpolation operator (`merge` case 0) is doing
signal averaging — a maximum-likelihood estimate of a direction from noisy
observations.

Combined with sort-and-trim selection, the loop becomes, in effect, a
**cross-entropy / estimation-of-distribution method**: keep the immigrants that
align above-average with `t`, average them to cancel noise and sharpen the
estimate, repeat. That is a textbook-good algorithm for a smooth
unimodal-on-sphere objective. Cosine similarity is a *favorable* case here, not a
hostile one.

### The new high-D problem: score contrast vanishes as `1/√d`

The price is that selection gets quieter. A uniform random vector's raw cosine
with `t` has mean 0 and standard deviation **`1/√d`** (random vectors are nearly
orthogonal in high dimensions). The `[0, 1]` constraint is an affine remap
`(1 + cos)/2`, so scaled scores cluster at **`0.5 ± 1/(2√d)`** — the constraint
that fixed the sign problem also *halves* what little contrast there was. Every
immigrant scores ≈ 0.5, they are nearly indistinguishable, and the *contrast*
selection runs on — the score gap between candidates — compresses as `1/√d`.
Convergence slows accordingly.

This ties directly back to the noise scaling in `merge`. The `/10` divisor
(noise range `[0, 0.1)`) assumes score gaps of order 0.1, which for scaled cosine
holds only around **d ≈ 25** (`1/(2√d) ≈ 0.1`). Past that, the gaps shrink below
the noise and the `/10` term swamps the real signal again — the same failure as
the original un-divided `[0,1)`, just at higher dimension. For large `d`, scale
the selection noise to ≈`1/(2√d)`, or — more robustly — switch to **rank-based
selection** so contrast no longer depends on the absolute score scale.

### The one remaining gotcha

The `[0, 1]` constraint disposes of the sign problem (negative scores would break
the convex-combination weights). What it cannot dispose of, because it is
intrinsic to cosine rather than to the range, is the **free magnitude
dimension**: `f` ignores `|x|`, so nothing selects against growing norms. The
extrapolation move (`merge` case 1) can inflate magnitudes with zero fitness
penalty, and averaging vectors of very different magnitudes gets dominated by the
largest. Normalize candidates onto the sphere after each merge so the search runs
in the space that actually matters — direction. (Note that the `(1 + cos)/2`
remap chosen for the constraint is also the *right* one: it is linear and
preserves the full gradient, unlike `max(0, cos)` (ReLU), which would discard the
anti-aligned hemisphere and reintroduce a flat dead zone.)

### In this visualization (the **Cosine** radio)

The app implements this mode for real: the field-mode radio dispatches `f` to
`fCosine`, which scores each cell by its cosine similarity (scaled to `[0, 1]`)
to the **best-aligned maximum** — the max of the per-maximum cosines, each
measured from the grid center. Taking the max means each cell aligns to the
angularly-closest target, so every maximum owns a directional wedge rather than
only `maxima[0]` mattering. Consequences to expect on screen, all the theory
above made visible:

- **The field is a fan of wedges, not a set of bumps.** Within a wedge `f` is
  constant along every ray from the center (a smooth angular gradient, brightest
  along that wedge's target direction); the wedges meet at angular ridges where
  two maxima are equally aligned — a directional Voronoi partition.
- **The population converges to a direction, bounded near center.** Plain cosine
  would let survivors smear all the way out along the ray (the free magnitude
  dimension scoring 1 everywhere along it) and fly off the display. `fCosine`
  multiplies the score by a Gaussian radial envelope (`gaussian(size*2/3, r)`), so
  distance from center is honestly penalized: the points settle into a cluster
  near the center, offset toward the best-aligned maximum's direction, rather
  than running away. With multiple wedges the herd can still stampede between
  competing directions — the multimodal-on-the-circle analogue of the Cauchy
  three-bump field.
- This is the deliberate-`f`-constraint answer to "the one remaining gotcha":
  rather than trim runaway stragglers after the fact, the field itself declares
  that far-from-center is worse, so the search bounds the magnitude dimension for
  the right reason instead of being clipped.

(The field is radial by construction — cosine depends only on angle, never on
distance from center — so it always looks like color shooting out of the center;
the max just gives up to one bright spoke per maximum, separated by faint ridge
lines. The wedge structure is only visible when the maxima differ in angle; it is
clearest with **Move** on, which drifts the maxima and sweeps the spokes
independently.)

**Bottom line:** cosine similarity makes the *finding* problem easy (signal
everywhere, and the averaging operator is ideal for it) but makes the *selecting*
problem subtle (contrast decays as `1/√d`). The algorithm's character shifts from
"needle hunt" to "noisy direction estimation," and the right adaptations are
rank-based or `1/√d`-scaled selection noise, a `[0, 1]` remap, and sphere
normalization — not the quadtree or surrogate machinery the generic high-D case
calls for.

---

## Training a neural network

The hostile-`f` counterpart to the cosine section. If cosine similarity is the
friendliest objective this method can face, a neural network's loss-over-weights
is close to the most hostile — and seeing *why* ties every earlier thread
together. Using this loop to train a NN is not a novelty; it has a name,
**neuroevolution / Evolution Strategies (ES)**, and the `essence.js` loop (random
immigrant + score-weighted recombination + truncation selection) is a crude
estimation-of-distribution cousin of OpenAI-ES and CMA-ES.

### The mapping

- **`x` = the weight vector.** So `d` = parameter count: thousands for a toy,
  millions-to-billions for anything real. This sits at the far end of the
  high-dimensional discussion, where every curse-of-dimensionality warning bites
  hardest.
- **`f` = fitness** = a scalar score of the network (negative loss, accuracy, RL
  return). Unlike cosine similarity, this `f` is the *composition*
  `weights → network → predictions → loss`: a true black box w.r.t. the weights,
  expensive (a forward pass over data per evaluation), non-convex, and
  multimodal.

### The objection that dominates everything: it throws away the gradient

A neural network is *differentiable*. Backprop returns the exact gradient w.r.t.
**all `d` weights** in one backward pass — `d` numbers of information at roughly
forward-pass cost. This loop extracts only a **single scalar** (the fitness) per
evaluation, and recovering directional information by sampling in `d` dimensions
takes on the order of `d` samples. So ES is roughly **`d`× less sample-efficient**
at obtaining the one thing SGD gets for free. For `d` in the millions that gap is
decisive — it is *the* reason backprop, not evolution, trains neural networks.

### The operators misbehave — and one inverts the cosine result exactly

- **The uniform immigrant is useless.** A uniform random weight vector is an
  untrained network scoring at chance, and in `d` = millions it never stumbles
  onto anything better. Real ES replaces it with **Gaussian perturbations around
  the current best** (often antithetic/mirrored pairs) — the "structured
  mutation" fix from the high-D section.
- **Averaging weights is now *destructive* — the opposite of the cosine case.**
  For cosine similarity the convex-combination move (`merge` case 0) was the hero:
  averaging cancels orthogonal noise and sharpens the direction estimate. For NN
  weights it is harmful, because of **permutation symmetry** — you can permute
  hidden units to get a *different* weight vector computing the *identical*
  function. Two independently-good networks usually sit in different permutation
  basins, so averaging their weights interpolates through garbage and yields a
  worse network. (This is the "linear mode connectivity / Git Re-Basin" line of
  work: averaging helps only *after* the permutations are aligned.) The single
  operator that made cosine similarity the friendliest possible `f` makes
  NN-weight-space among the most hostile.
- **Contrast collapses again.** If fitness is accuracy, early random nets all
  score ≈ chance (0.1 for 10 classes), so the gaps are tiny and the `/10`
  selection noise swamps them — the same failure mode as scaled cosine at high
  `d`. And minibatching makes fitness *noisy*, scrambling the ranking selection
  depends on and forcing expensive large/full batches.

### When it is actually the right tool

ES earns its place where backprop cannot go:

- **Non-differentiable or sparse objectives** — RL with reward you cannot backprop
  through the environment (the original OpenAI-ES use case).
- **Small policies** — control nets with thousands of params, where `d` is small
  enough that the `d`× penalty is affordable.
- **Massive parallelism** — ES is embarrassingly parallel and communicates only
  *scalars* (each worker reports a fitness), while distributed SGD must sync full
  `d`-dimensional gradients. That communication asymmetry is ES's real edge at
  scale.
- **Exploration / non-smooth landscapes** where a population escapes traps SGD
  slides into.

**Bottom line:** pointed at a standard differentiable network on supervised data,
this loop trains slowly, plateaus early, and loses to SGD handily — and the moment
you fix it (Gaussian mutations, rank-based fitness shaping, large populations,
covariance/sphere handling) you have reinvented OpenAI-ES or CMA-ES, only worse
than the off-the-shelf versions. The arc across these two sections is the whole
point: the *same* operators are ideal for cosine similarity and counterproductive
for NN weights, for two independent reasons — enormous `d`, and permutation
symmetry turning the averaging move from asset to liability. Use this family for
the non-differentiable / RL / tiny-policy / massively-parallel niche; use backprop
for everything else.
