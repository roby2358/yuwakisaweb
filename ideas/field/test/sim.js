// Headless verification for the field prototype: loads the DOM-free libs
// and checks the generated field and ball physics. Run from the project
// root:
//   node test/sim.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// The prototype uses plain script includes (no ES modules), so "importing"
// for tests = evaluate the files in one sandbox and pull out the globals.
function loadLibs(fileNames, exportNames) {
    const src = fileNames
        .map((name) => fs.readFileSync(path.join(ROOT, name), 'utf8'))
        .join('\n') + `\nmodule.exports = { ${exportNames.join(', ')} };`;
    const sandbox = { module: {} };
    vm.runInNewContext(src, sandbox);
    return sandbox.module.exports;
}

const { createFieldSampler, generateField, createRNG } = loadLibs(
    ['noise.js', 'field.js'],
    ['createFieldSampler', 'generateField', 'createRNG']
);
const { createBall, stepBall, clampBallPosition } = loadLibs(['balls.js'], [
    'createBall',
    'stepBall',
    'clampBallPosition',
]);

const BASE_PARAMS = {
    width: 1200,
    height: 700,
    spacing: 20,
    noiseScale: 0.0008,
    octaves: 3,
    lacunarity: 2,
    gain: 0.5,
};
const COLS = 60; // width / spacing points survive the edge clip per row
const ROWS = 35;

function paramsFor(mode, seed) {
    return Object.assign({}, BASE_PARAMS, { mode, seed });
}

function fieldFor(mode, seed) {
    const params = paramsFor(mode, seed);
    return generateField(createFieldSampler(params), params);
}

// Line orientations are symmetric under a half-turn, so fold angles into
// [0, pi) before comparing neighbors.
function orientationDelta(a, b) {
    const fold = (x) => ((x % Math.PI) + Math.PI) % Math.PI;
    const diff = Math.abs(fold(a) - fold(b));
    return Math.min(diff, Math.PI - diff);
}

function medianNeighborDelta(points, cols) {
    const deltas = [];
    for (let i = 1; i < points.length; i++) {
        if (i % cols === 0) continue; // row start has no left neighbor
        deltas.push(orientationDelta(points[i - 1].angle, points[i].angle));
    }
    deltas.sort((a, b) => a - b);
    return deltas[Math.floor(deltas.length / 2)];
}

const failures = [];

function check(label, fn) {
    try {
        fn();
        console.log(`PASS ${label}`);
    } catch (err) {
        failures.push(label);
        console.log(`FAIL ${label}: ${err.message}`);
    }
}

// --- field generation ---

for (const mode of ['angle', 'gradient', 'curl']) {
    const points = fieldFor(mode, 42);

    check(`${mode}: expected grid size`, () => {
        assert.strictEqual(points.length, COLS * ROWS);
    });

    check(`${mode}: deterministic for same seed`, () => {
        assert.deepStrictEqual(points, fieldFor(mode, 42));
    });

    check(`${mode}: different seed changes the field`, () => {
        assert.notDeepStrictEqual(points, fieldFor(mode, 7));
    });

    check(`${mode}: all angles and magnitudes finite`, () => {
        assert.ok(points.every((pt) => Number.isFinite(pt.angle) && Number.isFinite(pt.magnitude)));
    });

    check(`${mode}: neighboring orientations change gradually`, () => {
        const median = medianNeighborDelta(points, COLS);
        assert.ok(median < 0.4, `median neighbor delta ${median.toFixed(3)} >= 0.4`);
    });
}

// A ball's angleAt(x, y) must be the exact same query the rendered grid
// used, or the balls will visibly disagree with the arrows they fly over.
check('sampler.angleAt matches the rendered grid at grid points', () => {
    const params = paramsFor('curl', 42);
    const sampler = createFieldSampler(params);
    const points = generateField(sampler, params);
    const sample = points[Math.floor(points.length / 2)];
    assert.strictEqual(sampler.angleAt(sample.x, sample.y), sample.angle);
});

// --- ball physics ---

// A fixed randomFn (always 0.5) makes jitterX/jitterY collapse to 0 * jitter,
// so these tests can pass jitter=0 and stay exact/deterministic like before.
// Infinity stuck-radius/duration means the rectangle is never left in a way
// that matters and the timer never trips, i.e. the stuck-relocation check is
// effectively disabled so it doesn't interfere with unrelated assertions.
const NO_JITTER = 0;
const FIXED_RANDOM = () => 0.5;
const NO_STUCK_RADIUS = Infinity;
const NO_STUCK_DURATION = Infinity;

check('stepBall accelerates along the given angle from rest', () => {
    const ball = createBall(100, 100, '#fff', 6);
    const angleAt = () => 0; // pure rightward push
    const next = stepBall(ball, angleAt, 250, 0, NO_JITTER, FIXED_RANDOM, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, 1200, 700);
    assert.ok(next.vx > 0, 'expected rightward velocity');
    assert.strictEqual(next.vy, 0);
    assert.ok(next.x > ball.x, 'expected ball to move right');
});

check('stepBall bounces elastically off the right wall', () => {
    const width = 200;
    const ball = Object.assign(createBall(width - 3, 100, '#fff', 6), { vx: 500, vy: 0 });
    const next = stepBall(ball, () => 0, 0, 0, NO_JITTER, FIXED_RANDOM, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, width, 700);
    assert.ok(next.x <= width - ball.radius, 'ball should be clamped inside the wall');
    assert.ok(next.vx < 0, 'x-velocity should have flipped sign');
});

check('stepBall bounces elastically off the bottom wall', () => {
    const height = 200;
    const ball = Object.assign(createBall(100, height - 3, '#fff', 6), { vx: 0, vy: 500 });
    const next = stepBall(ball, () => 0, 0, 0, NO_JITTER, FIXED_RANDOM, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, 1200, height);
    assert.ok(next.y <= height - ball.radius, 'ball should be clamped inside the wall');
    assert.ok(next.vy < 0, 'y-velocity should have flipped sign');
});

check('stepBall drag slows a coasting ball toward rest', () => {
    let ball = Object.assign(createBall(100, 100, '#fff', 6), { vx: 300, vy: 0 });
    const angleAt = () => Math.PI; // push left, opposing the initial rightward coast
    for (let i = 0; i < 120; i++) {
        ball = stepBall(ball, angleAt, 0, 0.6, NO_JITTER, FIXED_RANDOM, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, 1200, 700);
    }
    assert.ok(Math.abs(ball.vx) < 300, `drag should have reduced speed, got vx=${ball.vx}`);
});

check('stepBall drag caps speed at a terminal velocity instead of growing forever', () => {
    // Arena far larger than the ball can travel in 10s at terminal speed, so
    // this isolates the accel/drag dynamic from wall bouncing (tested above).
    const ball = createBall(100, 100, '#fff', 6);
    const angleAt = () => 0; // constant rightward push
    const accel = 250;
    const drag = 0.6;
    let a = ball;
    let b = ball;
    for (let i = 0; i < 60; i++) a = stepBall(a, angleAt, accel, drag, NO_JITTER, FIXED_RANDOM, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, 1_000_000, 1_000_000);
    for (let i = 0; i < 600; i++) b = stepBall(b, angleAt, accel, drag, NO_JITTER, FIXED_RANDOM, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, 1_000_000, 1_000_000);
    const terminalSpeed = accel / drag;
    assert.ok(b.vx > a.vx, 'speed should still be rising early on');
    assert.ok(b.vx < terminalSpeed * 1.01, `speed exceeded terminal velocity: ${b.vx} vs ${terminalSpeed}`);
});

check('stepBall never produces NaN/Infinity over many steps in a real field', () => {
    const params = paramsFor('curl', 42);
    const sampler = createFieldSampler(params);
    let ball = createBall(600, 350, '#fff', 6);
    for (let i = 0; i < 2000; i++) {
        ball = stepBall(ball, sampler.angleAt, 250, 0.6, NO_JITTER, FIXED_RANDOM, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, params.width, params.height);
        assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y), `non-finite position at step ${i}`);
        assert.ok(Number.isFinite(ball.vx) && Number.isFinite(ball.vy), `non-finite velocity at step ${i}`);
    }
});

check('stepBall keeps the ball within canvas bounds over many steps', () => {
    const params = paramsFor('curl', 42);
    const sampler = createFieldSampler(params);
    let ball = createBall(50, 650, '#fff', 6);
    for (let i = 0; i < 2000; i++) {
        ball = stepBall(ball, sampler.angleAt, 250, 0.6, NO_JITTER, FIXED_RANDOM, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, params.width, params.height);
        assert.ok(ball.x >= 0 && ball.x <= params.width, `x out of bounds at step ${i}: ${ball.x}`);
        assert.ok(ball.y >= 0 && ball.y <= params.height, `y out of bounds at step ${i}: ${ball.y}`);
    }
});

// --- Brownian jitter ---

check('stepBall jitter nudges velocity even with zero acceleration and drag', () => {
    const ball = createBall(100, 100, '#fff', 6);
    const next = stepBall(ball, () => 0, 0, 0, 30, () => 1, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, 1200, 700);
    assert.ok(next.vx > 0, `expected jitter to push vx positive, got ${next.vx}`);
    assert.ok(next.vy > 0, `expected jitter to push vy positive, got ${next.vy}`);
});

check('stepBall jitter is deterministic given the same randomFn sequence', () => {
    const rngA = createRNG(99);
    const rngB = createRNG(99);
    let a = createBall(100, 100, '#fff', 6);
    let b = createBall(100, 100, '#fff', 6);
    for (let i = 0; i < 50; i++) {
        a = stepBall(a, () => 0, 250, 0.6, 30, rngA, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, 1200, 700);
        b = stepBall(b, () => 0, 250, 0.6, 30, rngB, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, 1200, 700);
    }
    assert.deepStrictEqual(a, b);
});

// --- stuck-in-place relocation ---

check('stepBall relocates a ball that stays within a small rectangle past the stuck duration', () => {
    const width = 400;
    const height = 300;
    const radius = 6;
    const stuckRadius = 5;
    const stuckDuration = 0.1; // seconds; short so the test runs fast
    let ball = createBall(100, 100, '#fff', radius);
    let relocated = null;
    // Zero accel/drag/jitter: the ball truly never moves under normal physics,
    // so any x change here is unambiguously the stuck-check firing. A
    // relocated ball is still motionless, so it'll start re-accumulating
    // stuckTime on the very next step — capture it the instant it happens.
    for (let i = 0; i < 20 && !relocated; i++) {
        ball = stepBall(ball, () => 0, 0, 0, 0, FIXED_RANDOM, stuckRadius, stuckDuration, 1 / 60, width, height);
        if (ball.x !== 100) relocated = ball;
    }
    assert.ok(relocated, 'ball should have relocated within 20 steps');
    const expectedX = radius + 0.5 * (width - 2 * radius);
    const expectedY = radius + 0.5 * (height - 2 * radius);
    assert.strictEqual(relocated.x, expectedX, `expected relocation to x=${expectedX}, got ${relocated.x}`);
    assert.strictEqual(relocated.y, expectedY, `expected relocation to y=${expectedY}, got ${relocated.y}`);
    assert.strictEqual(relocated.vx, 0, 'relocated ball should start at rest');
    assert.strictEqual(relocated.vy, 0, 'relocated ball should start at rest');
    assert.strictEqual(relocated.stuckTime, 0, 'stuckTime should reset after relocating');
    assert.strictEqual(relocated.anchorX, expectedX, 'anchor should follow the relocation');
    assert.strictEqual(relocated.anchorY, expectedY, 'anchor should follow the relocation');
});

check('stepBall does not relocate a ball while it is still within the stuck duration', () => {
    let ball = createBall(100, 100, '#fff', 6);
    for (let i = 0; i < 5; i++) { // 5/60s ~= 0.083s < stuckDuration
        ball = stepBall(ball, () => 0, 0, 0, 0, FIXED_RANDOM, 5, 0.1, 1 / 60, 400, 300);
    }
    assert.strictEqual(ball.x, 100, 'ball should not have relocated yet');
    assert.strictEqual(ball.y, 100, 'ball should not have relocated yet');
    assert.ok(ball.stuckTime > 0, 'stuckTime should be accumulating');
});

check('stepBall stays finite and in bounds with stuck-relocation enabled in a real field', () => {
    const params = paramsFor('curl', 42);
    const sampler = createFieldSampler(params);
    const rng = createRNG(11);
    let ball = createBall(600, 350, '#fff', 6);
    for (let i = 0; i < 2000; i++) {
        ball = stepBall(ball, sampler.angleAt, 250, 0.6, 30, rng, 15, 5, 1 / 60, params.width, params.height);
        assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y), `non-finite position at step ${i}`);
        assert.ok(ball.x >= 0 && ball.x <= params.width, `x out of bounds at step ${i}: ${ball.x}`);
        assert.ok(ball.y >= 0 && ball.y <= params.height, `y out of bounds at step ${i}: ${ball.y}`);
        assert.ok(ball.stuckTime <= 5, `stuckTime should never exceed the duration, got ${ball.stuckTime} at step ${i}`);
    }
});

check('stepBall stays finite and in bounds over many steps with jitter in a real field', () => {
    const params = paramsFor('curl', 42);
    const sampler = createFieldSampler(params);
    const rng = createRNG(7);
    let ball = createBall(600, 350, '#fff', 6);
    for (let i = 0; i < 2000; i++) {
        ball = stepBall(ball, sampler.angleAt, 250, 0.6, 30, rng, NO_STUCK_RADIUS, NO_STUCK_DURATION, 1 / 60, params.width, params.height);
        assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y), `non-finite position at step ${i}`);
        assert.ok(ball.x >= 0 && ball.x <= params.width, `x out of bounds at step ${i}: ${ball.x}`);
        assert.ok(ball.y >= 0 && ball.y <= params.height, `y out of bounds at step ${i}: ${ball.y}`);
    }
});

check('clampBallPosition pulls an out-of-bounds ball back inside', () => {
    const ball = createBall(-10, 900, '#fff', 6);
    const clamped = clampBallPosition(ball, 400, 300);
    assert.strictEqual(clamped.x, 6);
    assert.strictEqual(clamped.y, 294);
});

if (failures.length > 0) {
    console.log(`\n${failures.length} check(s) failed`);
    process.exitCode = 1;
} else {
    console.log('\nall checks passed');
}
