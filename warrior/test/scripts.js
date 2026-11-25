// Checks that index.html's plain <script> includes work as one shared scope:
// the page lists only files that exist, nothing is still an ES module, no two
// scripts declare the same top-level name, and the DOM-free scripts load in
// the listed order. Run: node test/scripts.js
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load } = require('./load.js');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert.ok(!/type="module"/.test(html), 'index.html still has a module script');

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
assert.ok(scripts.length > 0, 'no script includes found');

const sources = scripts.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'));
sources.forEach((src, i) => {
    assert.ok(!/^\s*(import|export)\s/m.test(src), scripts[i] + ' still uses import/export');
});

// Compiling everything as one script reports any top-level name declared twice.
new vm.Script(sources.join('\n;\n'), { filename: 'all-scripts.js' });

// Two function declarations of one name don't fail to compile; the later one
// silently wins. Catch those too.
const seen = new Map();
sources.forEach((src, i) => {
    for (const m of src.matchAll(/^(?:async\s+)?function\*?\s+(\w+)/gm)) {
        assert.ok(!seen.has(m[1]), `function ${m[1]} is declared in both ${seen.get(m[1])} and ${scripts[i]}`);
        seen.set(m[1], scripts[i]);
    }
});

// Everything before the browser-coupled scripts must load with no DOM at all.
const BROWSER_SCRIPTS = new Set(['index.js']);
const g = load(scripts.filter(f => !BROWSER_SCRIPTS.has(f)), ['Rando', 'Player', 'GameWorld', 'EnemyManager', 'Fx', 'SKILLS', 'runEnemyAiPhase']);
assert.equal(typeof g.runEnemyAiPhase, 'function');
assert.ok(Object.keys(g.SKILLS).length > 0);

console.log('scripts ok: ' + scripts.join(', '));
