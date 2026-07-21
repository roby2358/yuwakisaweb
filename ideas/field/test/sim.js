// Headless verification for the field prototype: loads the DOM-free libs
// and checks the generated field. Run from the project root:
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

const { generateField } = loadLibs(['noise.js', 'field.js'], ['generateField']);

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

for (const mode of ['angle', 'gradient', 'curl']) {
    const points = generateField(paramsFor(mode, 42));

    check(`${mode}: expected grid size`, () => {
        assert.strictEqual(points.length, COLS * ROWS);
    });

    check(`${mode}: deterministic for same seed`, () => {
        assert.deepStrictEqual(points, generateField(paramsFor(mode, 42)));
    });

    check(`${mode}: different seed changes the field`, () => {
        assert.notDeepStrictEqual(points, generateField(paramsFor(mode, 7)));
    });

    check(`${mode}: all angles and magnitudes finite`, () => {
        assert.ok(points.every((pt) => Number.isFinite(pt.angle) && Number.isFinite(pt.magnitude)));
    });

    check(`${mode}: neighboring orientations change gradually`, () => {
        const median = medianNeighborDelta(points, COLS);
        assert.ok(median < 0.4, `median neighbor delta ${median.toFixed(3)} >= 0.4`);
    });
}

if (failures.length > 0) {
    console.log(`\n${failures.length} check(s) failed`);
    process.exitCode = 1;
} else {
    console.log('\nall checks passed');
}
