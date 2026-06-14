// Distribution registry. Each entry is self-contained: its parameter specs,
// support, pdf/cdf, and summary stats. The app code stays generic — adding a
// new distribution is a new entry here plus nothing else.

(function (ns) {
  const { logBeta, regularizedIncompleteBeta, logGamma, regularizedLowerGamma } = ns;

  function betaPdf(x, alpha, beta) {
    if (x < 0 || x > 1) return 0;
    if (x === 0) {
      if (alpha < 1) return Infinity;
      if (alpha === 1) return Math.exp(-logBeta(alpha, beta));
      return 0;
    }
    if (x === 1) {
      if (beta < 1) return Infinity;
      if (beta === 1) return Math.exp(-logBeta(alpha, beta));
      return 0;
    }
    const logDensity =
      (alpha - 1) * Math.log(x) +
      (beta - 1) * Math.log(1 - x) -
      logBeta(alpha, beta);
    return Math.exp(logDensity);
  }

  function betaStats(p) {
    const { alpha, beta } = p;
    const sum = alpha + beta;
    const mean = alpha / sum;
    const variance = (alpha * beta) / (sum * sum * (sum + 1));
    const mode = alpha > 1 && beta > 1 ? (alpha - 1) / (sum - 2) : NaN;
    return { mean, mode, variance };
  }

  const beta = {
    key: 'beta',
    label: 'Beta',
    note:
      'α and β count evidence for two opposing outcomes — think successes vs. failures. ' +
      'α pulls the mass toward 1, β toward 0, and their sum (α + β) is how confident you are: ' +
      'bigger sum, sharper peak. Drop either below 1 and the hill becomes a valley, with the ' +
      'mass piling up at the edges.',
    applications: [
      'Estimating a coin’s bias or a click-through rate from a run of successes and failures.',
      'A/B testing: the posterior belief about each variant’s conversion rate.',
      'Modeling a proportion or percentage that must stay between 0 and 1.',
      'A prior for any unknown probability in Bayesian inference (it pairs cleanly with the binomial).',
      'Project scheduling (PERT): a bounded estimate of how long a task will take.',
    ],
    params: [
      { key: 'alpha', label: 'α (shape 1)', min: 0.1, max: 100, step: 0.1, value: 2 },
      { key: 'beta', label: 'β (shape 2)', min: 0.1, max: 100, step: 0.1, value: 2 },
    ],
    support: () => ({ min: 0, max: 1 }),
    pdf: (x, p) => betaPdf(x, p.alpha, p.beta),
    cdf: (x, p) => regularizedIncompleteBeta(x, p.alpha, p.beta),
    stats: betaStats,
  };

  // --- gamma --------------------------------------------------------------

  function gammaPdf(x, shape, scale) {
    if (x < 0) return 0;
    if (x === 0) {
      if (shape < 1) return Infinity;
      if (shape === 1) return 1 / scale;
      return 0;
    }
    const logDensity =
      (shape - 1) * Math.log(x) -
      x / scale -
      shape * Math.log(scale) -
      logGamma(shape);
    return Math.exp(logDensity);
  }

  function gammaStats(p) {
    const { shape, scale } = p;
    const mean = shape * scale;
    const variance = shape * scale * scale;
    const mode = shape >= 1 ? (shape - 1) * scale : NaN;
    return { mean, mode, variance };
  }

  // Gamma is unbounded above, so plot/quantile out to a finite window of this
  // many standard deviations past the mean — wide enough to contain the 99%
  // interval the confidence slider can ask for.
  const GAMMA_TAIL_SIGMAS = 8;

  function gammaSupport(p) {
    const { shape, scale } = p;
    const sd = Math.sqrt(shape) * scale;
    return { min: 0, max: shape * scale + GAMMA_TAIL_SIGMAS * sd };
  }

  const gamma = {
    key: 'gamma',
    label: 'Gamma',
    note:
      'Gamma models a positive amount with no upper bound — a total wait, a size, a magnitude. ' +
      'The shape k sets the silhouette (k below 1 spikes at 0, k = 1 is a memoryless exponential, ' +
      'large k rounds into a bell), while the scale θ simply stretches the x-axis without changing ' +
      'that shape. Mean is k·θ, so shape and scale split the work: k decides the form, θ the units.',
    applications: [
      'Total time until the k-th event in a Poisson process (queue waits, equipment lifetimes).',
      'Rainfall amounts, insurance claim sizes, and other positive, right-skewed quantities.',
      'A prior for a rate or precision in Bayesian inference (it pairs cleanly with the Poisson).',
      'Aggregating many small positive contributions into a total load or demand.',
      'Service and inter-arrival times in reliability and queueing models.',
    ],
    params: [
      { key: 'shape', label: 'k (shape)', min: 0.5, max: 20, step: 0.1, value: 2 },
      { key: 'scale', label: 'θ (scale)', min: 0.1, max: 100, step: 0.1, value: 1 },
    ],
    support: gammaSupport,
    pdf: (x, p) => gammaPdf(x, p.shape, p.scale),
    cdf: (x, p) => regularizedLowerGamma(x / p.scale, p.shape),
    stats: gammaStats,
  };

  ns.distributions = { beta, gamma };
  ns.distributionOrder = ['beta', 'gamma'];
})((globalThis.PDF = globalThis.PDF || {}));
