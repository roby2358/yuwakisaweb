// Distribution registry. Each entry is self-contained: its parameter specs,
// support, pdf/cdf, and summary stats. The app code stays generic — adding a
// new distribution is a new entry here plus nothing else.

(function (ns) {
  const { logBeta, regularizedIncompleteBeta } = ns;

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
      { key: 'alpha', label: 'α (shape 1)', min: 0.1, max: 10, step: 0.1, value: 2 },
      { key: 'beta', label: 'β (shape 2)', min: 0.1, max: 10, step: 0.1, value: 2 },
    ],
    support: () => ({ min: 0, max: 1 }),
    pdf: (x, p) => betaPdf(x, p.alpha, p.beta),
    cdf: (x, p) => regularizedIncompleteBeta(x, p.alpha, p.beta),
    stats: betaStats,
  };

  ns.distributions = { beta };
  ns.distributionOrder = ['beta'];
})((globalThis.PDF = globalThis.PDF || {}));
