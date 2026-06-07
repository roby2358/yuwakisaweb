import test from 'node:test';
import assert from 'node:assert/strict';

import '../src/mathfns.js';

const { logGamma, logBeta, regularizedIncompleteBeta, inverseCdf } = globalThis.PDF;

const close = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} ≈ ${expected}`);

test('logGamma matches factorials: Γ(n) = (n-1)!', () => {
  close(Math.exp(logGamma(5)), 24); // 4!
  close(Math.exp(logGamma(6)), 120); // 5!
});

test('logGamma(0.5) = ln(√π)', () => {
  close(logGamma(0.5), Math.log(Math.sqrt(Math.PI)));
});

test('logBeta is symmetric and matches B(2,3) = 1/12', () => {
  close(Math.exp(logBeta(2, 3)), 1 / 12);
  close(logBeta(2, 3), logBeta(3, 2));
});

test('regularizedIncompleteBeta clamps outside [0, 1]', () => {
  assert.equal(regularizedIncompleteBeta(-0.5, 2, 3), 0);
  assert.equal(regularizedIncompleteBeta(1.5, 2, 3), 1);
});

test('I_x(1,1) is the uniform CDF (= x)', () => {
  close(regularizedIncompleteBeta(0.25, 1, 1), 0.25);
  close(regularizedIncompleteBeta(0.5, 1, 1), 0.5);
  close(regularizedIncompleteBeta(0.9, 1, 1), 0.9);
});

test('I_x(2,2) closed form 3x² - 2x³', () => {
  const expected = (x) => 3 * x * x - 2 * x * x * x;
  close(regularizedIncompleteBeta(0.3, 2, 2), expected(0.3));
  close(regularizedIncompleteBeta(0.7, 2, 2), expected(0.7));
});

test('inverseCdf clamps probabilities at or beyond the tails', () => {
  const cdf = (x) => x;
  assert.equal(inverseCdf(cdf, 0, 0, 1), 0);
  assert.equal(inverseCdf(cdf, 1, 0, 1), 1);
});

test('inverseCdf inverts the uniform CDF (cdf(x) = x)', () => {
  const cdf = (x) => x;
  close(inverseCdf(cdf, 0.3, 0, 1), 0.3, 1e-9);
  close(inverseCdf(cdf, 0.975, 0, 1), 0.975, 1e-9);
});

test('inverseCdf recovers Beta(2,2) quantiles (round-trips the CDF)', () => {
  const cdf = (x) => regularizedIncompleteBeta(x, 2, 2);
  for (const p of [0.025, 0.5, 0.975]) {
    const x = inverseCdf(cdf, p, 0, 1);
    close(cdf(x), p, 1e-9);
  }
  // Beta(2,2) is symmetric, so its median is exactly 0.5.
  close(inverseCdf(cdf, 0.5, 0, 1), 0.5, 1e-9);
});

test('CDF is monotonically increasing', () => {
  let prev = 0;
  for (let i = 1; i < 50; i++) {
    const x = i / 50;
    const c = regularizedIncompleteBeta(x, 2.5, 4);
    assert.ok(c >= prev, `non-decreasing at x=${x}`);
    prev = c;
  }
});
