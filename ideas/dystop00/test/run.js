// test/run.js — the test command:  node test/run.js
//
// Runs every test file under test/R-n/, the integration walkthrough, and the coverage
// test, each in its own Node process (fresh vm context, fresh Rando). Exit 0 = all pass.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const here = __dirname;
const verbose = process.argv.includes('-v');

const files = [];
const rDirs = fs.readdirSync(here).filter(d => /^R-\d+$/.test(d))
    .sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));
for (const d of rDirs)
    for (const f of fs.readdirSync(path.join(here, d)).filter(f => f.endsWith('.js')).sort())
        files.push(path.join(d, f));
for (const f of fs.readdirSync(path.join(here, 'integration')).filter(f => f.endsWith('.js')).sort())
    files.push(path.join('integration', f));
files.push('coverage.js');

let failed = 0;
for (const f of files) {
    const res = spawnSync(process.execPath, [path.join(here, f)], { encoding: 'utf8' });
    const ok = res.status === 0;
    console.log((ok ? 'PASS ' : 'FAIL ') + f);
    if (!ok || verbose) process.stdout.write((res.stdout || '') + (res.stderr || ''));
    if (!ok) failed++;
}
console.log(failed === 0 ? `\nALL PASS (${files.length} files)` : `\n${failed} of ${files.length} FILE(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
