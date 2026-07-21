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

const { createFieldSampler, generateField } = loadLibs(
    ['noise.js', 'field.js'],
    ['createFieldSampler', 'generateField']
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

check('stepBall accelerates along the given angle from rest', () => {
    const ball = createBall(100, 100, '#fff', 6);
    const angleAt = () => 0; // pure rightward push
    const next = stepBall(ball, angleAt, 250, 0, 1 / 60, 1200, 700);
    assert.ok(next.vx > 0, 'expected rightward velocity');
    assert.strictEqual(next.vy, 0);
    assert.ok(next.x > ball.x, 'expected ball to move right');
});

check('stepBall bounces elastically off the right wall', () => {
    const width = 200;
    const ball = Object.assign(createBall(width - 3, 100, '#fff', 6), { vx: 500, vy: 0 });
    const next = stepBall(ball, () => 0, 0, 0, 1 / 60, width, 700);
    assert.ok(next.x <= width - ball.radius, 'ball should be clamped inside the wall');
    assert.ok(next.vx < 0, 'x-velocity should have flipped sign');
});

check('stepBall bounces elastically off the bottom wall', () => {
    const height = 200;
    const ball = Object.assign(createBall(100, height - 3, '#fff', 6), { vx: 0, vy: 500 });
    const next = stepBall(ball, () => 0, 0, 0, 1 / 60, 1200, height);
    assert.ok(next.y <= height - ball.radius, 'ball should be clamped inside the wall');
    assert.ok(next.vy < 0, 'y-velocity should have flipped sign');
});

check('stepBall drag slows a coasting ball toward rest', () => {
    let ball = Object.assign(createBall(100, 100, '#fff', 6), { vx: 300, vy: 0 });
    const angleAt = () => Math.PI; // push left, opposing the initial rightward coast
    for (let i = 0; i < 120; i++) {
        ball = stepBall(ball, angleAt, 0, 0.6, 1 / 60, 1200, 700);
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
    for (let i = 0; i < 60; i++) a = stepBall(a, angleAt, accel, drag, 1 / 60, 1_000_000, 1_000_000);
    for (let i = 0; i < 600; i++) b = stepBall(b, angleAt, accel, drag, 1 / 60, 1_000_000, 1_000_000);
    const terminalSpeed = accel / drag;
    assert.ok(b.vx > a.vx, 'speed should still be rising early on');
    assert.ok(b.vx < terminalSpeed * 1.01, `speed exceeded terminal velocity: ${b.vx} vs ${terminalSpeed}`);
});

check('stepBall never produces NaN/Infinity over many steps in a real field', () => {
    const params = paramsFor('curl', 42);
    const sampler = createFieldSampler(params);
    let ball = createBall(600, 350, '#fff', 6);
    for (let i = 0; i < 2000; i++) {
        ball = stepBall(ball, sampler.angleAt, 250, 0.6, 1 / 60, params.width, params.height);
        assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y), `non-finite position at step ${i}`);
        assert.ok(Number.isFinite(ball.vx) && Number.isFinite(ball.vy), `non-finite velocity at step ${i}`);
    }
});

check('stepBall keeps the ball within canvas bounds over many steps', () => {
    const params = paramsFor('curl', 42);
    const sampler = createFieldSampler(params);
    let ball = createBall(50, 650, '#fff', 6);
    for (let i = 0; i < 2000; i++) {
        ball = stepBall(ball, sampler.angleAt, 250, 0.6, 1 / 60, params.width, params.height);
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
