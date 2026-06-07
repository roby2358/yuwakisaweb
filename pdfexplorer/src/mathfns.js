// Numerical helpers shared across distributions.
// No import/export: this same file loads as a browser <script> and as a node
// side-effect import, attaching its exports to the shared PDF namespace.

(function (ns) {
  // Lanczos approximation coefficients (g = 7, n = 9).
  const LANCZOS = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  // Natural log of the gamma function.
  function logGamma(z) {
    if (z < 0.5) {
      // Reflection formula keeps the series in its convergent range.
      return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    }
    z -= 1;
    let x = 0.99999999999980993;
    for (let i = 0; i < LANCZOS.length; i++) {
      x += LANCZOS[i] / (z + i + 1);
    }
    const t = z + LANCZOS.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  // Natural log of the beta function B(a, b).
  function logBeta(a, b) {
    return logGamma(a) + logGamma(b) - logGamma(a + b);
  }

  // Lentz continued fraction for the incomplete beta (Numerical Recipes betacf).
  function betaContinuedFraction(a, b, x) {
    const TINY = 1e-300;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let num = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + num * d;
      if (Math.abs(d) < TINY) d = TINY;
      c = 1 + num / c;
      if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      h *= d * c;
      num = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + num * d;
      if (Math.abs(d) < TINY) d = TINY;
      c = 1 + num / c;
      if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-12) break;
    }
    return h;
  }

  // Regularized incomplete beta I_x(a, b) — the beta CDF.
  function regularizedIncompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const front = Math.exp(
      a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b),
    );
    // Pick the faster-converging side of I_x(a,b) = 1 - I_{1-x}(b,a).
    if (x < (a + 1) / (a + b + 2)) {
      return (front * betaContinuedFraction(a, b, x)) / a;
    }
    return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
  }

  // Series expansion of the lower incomplete gamma (Numerical Recipes gser),
  // convergent and used where x < s + 1.
  function lowerGammaSeries(s, x) {
    let term = 1 / s;
    let sum = term;
    for (let n = 1; n <= 200; n++) {
      term *= x / (s + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + s * Math.log(x) - logGamma(s));
  }

  // Continued fraction for the upper incomplete gamma (Numerical Recipes gcf),
  // used where x >= s + 1.
  function upperGammaContinuedFraction(s, x) {
    const TINY = 1e-300;
    let b = x + 1 - s;
    let c = 1 / TINY;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - s);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < TINY) d = TINY;
      c = b + an / c;
      if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-15) break;
    }
    return Math.exp(-x + s * Math.log(x) - logGamma(s)) * h;
  }

  // Regularized lower incomplete gamma P(s, x) — the gamma CDF building block.
  function regularizedLowerGamma(x, s) {
    if (x <= 0) return 0;
    // Pick whichever expansion converges in this region.
    if (x < s + 1) return lowerGammaSeries(s, x);
    return 1 - upperGammaContinuedFraction(s, x);
  }

  // Invert a monotonically increasing cdf on [lo, hi] by bisection: returns x
  // with cdf(x) ≈ p. Generic, so any distribution exposing a cdf and finite
  // support gets a quantile function for free.
  function inverseCdf(cdf, p, lo, hi) {
    if (p <= 0) return lo;
    if (p >= 1) return hi;
    let a = lo;
    let b = hi;
    for (let i = 0; i < 80; i++) {
      const mid = (a + b) / 2;
      if (cdf(mid) < p) a = mid;
      else b = mid;
      if (b - a < 1e-12) break;
    }
    return (a + b) / 2;
  }

  ns.logGamma = logGamma;
  ns.logBeta = logBeta;
  ns.regularizedIncompleteBeta = regularizedIncompleteBeta;
  ns.regularizedLowerGamma = regularizedLowerGamma;
  ns.inverseCdf = inverseCdf;
})((globalThis.PDF = globalThis.PDF || {}));
