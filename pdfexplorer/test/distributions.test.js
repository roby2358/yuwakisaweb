import test from 'node:test';
import assert from 'node:assert/strict';

import '../src/mathfns.js';
import '../src/distributions.js';

const { distributions } = globalThis.PDF;

const beta = distributions.beta;
const close = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} ≈ ${expected}`);

test('beta registry entry is well-formed', () => {
  assert.equal(beta.key, 'beta');
  assert.deepEqual(
    beta.params.map((p) => p.key),
    ['alpha', 'beta'],
  );
  assert.deepEqual(beta.support(), { min: 0, max: 1 });
});

test('uniform Beta(1,1) has density 1 everywhere inside support', () => {
  const p = { alpha: 1, beta: 1 };
  close(beta.pdf(0.2, p), 1);
  close(beta.pdf(0.8, p), 1);
});

test('Beta(2,2) peaks at 1.5 in the middle', () => {
  close(beta.pdf(0.5, { alpha: 2, beta: 2 }), 1.5);
});

test('pdf is zero outside [0, 1]', () => {
  const p = { alpha: 2, beta: 3 };
  assert.equal(beta.pdf(-0.1, p), 0);
  assert.equal(beta.pdf(1.1, p), 0);
});

test('endpoint densities: U-shaped Beta(0.5,0.5) diverges at edges', () => {
  const p = { alpha: 0.5, beta: 0.5 };
  assert.equal(beta.pdf(0, p), Infinity);
  assert.equal(beta.pdf(1, p), Infinity);
});

test('cdf reaches the support endpoints', () => {
  const p = { alpha: 2, beta: 5 };
  assert.equal(beta.cdf(0, p), 0);
  assert.equal(beta.cdf(1, p), 1);
});

test('stats for Beta(2,3): mean 0.4, mode 1/3, variance 0.04', () => {
  const s = beta.stats({ alpha: 2, beta: 3 });
  close(s.mean, 0.4);
  close(s.mode, 1 / 3);
  close(s.variance, 0.04);
});

test('mode is undefined (NaN) when a shape ≤ 1', () => {
  const s = beta.stats({ alpha: 0.5, beta: 2 });
  assert.ok(Number.isNaN(s.mode));
});

const gamma = distributions.gamma;

test('gamma registry entry is well-formed', () => {
  assert.equal(gamma.key, 'gamma');
  assert.deepEqual(
    gamma.params.map((p) => p.key),
    ['shape', 'scale'],
  );
  // Support starts at 0 and extends to a finite plotting window.
  const sup = gamma.support({ shape: 2, scale: 1 });
  assert.equal(sup.min, 0);
  assert.ok(sup.max > 0 && Number.isFinite(sup.max));
});

test('Gamma(1, θ) is the exponential density (1/θ)·e^(−x/θ)', () => {
  const p = { shape: 1, scale: 2 };
  close(gamma.pdf(0, p), 0.5);
  close(gamma.pdf(2, p), 0.5 * Math.exp(-1));
});

test('gamma pdf is zero below 0 and spikes at 0 when shape < 1', () => {
  assert.equal(gamma.pdf(-0.1, { shape: 2, scale: 1 }), 0);
  assert.equal(gamma.pdf(0, { shape: 0.5, scale: 1 }), Infinity);
  assert.equal(gamma.pdf(0, { shape: 3, scale: 1 }), 0);
});

test('Gamma(1, θ) cdf is the exponential 1 − e^(−x/θ)', () => {
  const p = { shape: 1, scale: 2 };
  assert.equal(gamma.cdf(0, p), 0);
  close(gamma.cdf(2, p), 1 - Math.exp(-1));
  close(gamma.cdf(6, p), 1 - Math.exp(-3));
});

test('gamma cdf is monotone and approaches 1 far out', () => {
  const p = { shape: 2.5, scale: 1.3 };
  let prev = 0;
  for (let i = 1; i <= 40; i++) {
    const c = gamma.cdf(i / 2, p);
    assert.ok(c >= prev, `non-decreasing at x=${i / 2}`);
    prev = c;
  }
  close(gamma.cdf(50, p), 1, 1e-6);
});

test('stats for Gamma(k, θ): mean kθ, mode (k−1)θ, variance kθ²', () => {
  const s = gamma.stats({ shape: 3, scale: 2 });
  close(s.mean, 6);
  close(s.mode, 4);
  close(s.variance, 12);
});

test('gamma mode is NaN when shape < 1', () => {
  assert.ok(Number.isNaN(gamma.stats({ shape: 0.5, scale: 1 }).mode));
});
