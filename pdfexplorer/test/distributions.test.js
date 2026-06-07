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
