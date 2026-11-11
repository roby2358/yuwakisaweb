// test/coverage.js — keeps CRITERIA.md and the test/R-n/ directories in step.
//
// Fails when: an Instrument cell isn't one of the four forms (automated, manual — …,
// not yet covered, retired); an `automated` R-row has no test/R-n/ with a .js file in it;
// or a test/R-n/ exists for a row that is missing or not `automated`.
'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT } = require('./helpers/load');
const { check, done } = require('./helpers/check');

const criteria = fs.readFileSync(path.join(ROOT, 'CRITERIA.md'), 'utf8');
const rows = new Map();   // id -> instrument
for (const line of criteria.split('\n')) {
    const m = line.match(/^\|\s*([RUX]-\d+)\s*\|/);
    if (!m) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    check(`${m[1]} appears once`, !rows.has(m[1]));
    rows.set(m[1], cells[cells.length - 1]);
}

const FORMS = [/^automated$/, /^manual — \S/, /^not yet covered$/, /^retired$/];
for (const [id, instrument] of rows) {
    // X-rows carry "<link> · <instrument>" in their last cell.
    const inst = id.startsWith('X-') ? instrument.split(' · ').pop() : instrument;
    check(`${id}: instrument "${inst}" is one of the four forms`, FORMS.some(f => f.test(inst)));
}

const testDir = __dirname;
const dirs = fs.readdirSync(testDir).filter(d => /^R-\d+$/.test(d));
for (const [id, instrument] of rows) {
    if (!id.startsWith('R-') || instrument !== 'automated') continue;
    const dir = path.join(testDir, id);
    const hasTest = fs.existsSync(dir) && fs.readdirSync(dir).some(f => f.endsWith('.js'));
    check(`${id} is automated and test/${id}/ has a test`, hasTest);
}
for (const d of dirs) {
    check(`test/${d}/ belongs to an automated row`, rows.get(d) === 'automated');
}
done();
