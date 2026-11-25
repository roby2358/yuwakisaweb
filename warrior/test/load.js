// test/load.js — run DOM-free game scripts in a fresh vm context, the way the
// browser's classic <script> tags do: one shared top-level scope. Returns the
// named globals.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function load(files, names) {
    const combined = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
    const bridge = '\n;Object.assign(__exports, { ' + names.join(', ') + ' });';
    const ctx = vm.createContext({ console, __exports: {} });
    vm.runInContext(combined + bridge, ctx, { filename: 'combined.js' });
    return ctx.__exports;
}

module.exports = { load };
