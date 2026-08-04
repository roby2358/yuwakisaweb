#!/usr/bin/env node
// tools/headless.js — headless engine test runner
//
// The game ships as plain-script globals (no modules), so tests run by concatenating
// the engine-side sources with a test body and evaluating them as one program — the
// same scope the browser would build, minus the DOM. gameui/sound/colortheory are
// excluded: the engine never touches them.
//
// Usage: node tools/headless.js tests/<file>.js
// Exit code is non-zero if the test body sets process.exitCode (see tests/*.js).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCES = ['artifacts.js', 'displayartifacts.js', 'rando.js', 'hex.js',
    'gamestate.js', 'gameengine.js'];

const testFile = process.argv[2];
if (!testFile) {
    console.error('usage: node tools/headless.js tests/<file>.js');
    process.exit(2);
}

const program = SOURCES
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .concat(fs.readFileSync(testFile, 'utf8'))
    .join('\n');
eval(program);
