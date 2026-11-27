// test/skillformulas.js — SKILL_FORMULAS (actions.js) is the one damage/heal
// formula per skill, shared by the execute*() handlers and the skill previews.
// Checks that every formula belongs to a real skill with a handler, gives a
// whole number at every rank, and that index.js's SKILL_POWER (the previews'
// factors text) covers the same skills, plus scoreless Restore, and takes only the
// skill (no stats or weapon to compute a score from). Run: node test/skillformulas.js
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const { SKILLS, SKILL_FORMULAS, SKILL_HANDLERS, STARTING_STATS, effectiveSkill } = load(
    scripts.slice(0, scripts.indexOf('actions.js') + 1),
    ['SKILLS', 'SKILL_FORMULAS', 'SKILL_HANDLERS', 'STARTING_STATS', 'effectiveSkill']);

const WEAPON_DAMAGE = 4;
for (const [id, formula] of Object.entries(SKILL_FORMULAS)) {
    const def = SKILLS[id];
    assert.ok(def, 'formula for an unknown skill: ' + id);
    assert.ok(SKILL_HANDLERS[id], 'formula without a handler: ' + id);
    const ranks = def.tiers ? def.tiers.length : 1;
    for (let rank = 1; rank <= ranks; rank++) {
        const amount = formula(effectiveSkill(def, rank), STARTING_STATS, WEAPON_DAMAGE);
        assert.ok(Number.isInteger(amount) && amount > 0, id + ' rank ' + rank + ' gives ' + amount);
    }
}

// index.js needs a DOM, so read SKILL_POWER's keys from its source.
const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const table = indexSrc.match(/^const SKILL_POWER = \{\n([\s\S]*?)^\};/m);
assert.ok(table, 'SKILL_POWER table not found in index.js');
const powerKeys = [...table[1].matchAll(/^\s+(\w+)\s*:/gm)].map(m => m[1]);
const SCORELESS = ['restore'];
assert.deepEqual(powerKeys.filter(id => !SCORELESS.includes(id)).sort(), Object.keys(SKILL_FORMULAS).sort());
for (const id of SCORELESS) assert.ok(powerKeys.includes(id) && !SKILL_FORMULAS[id], id + ' should have factors text and no formula');
const entries = table[1].split('\n').filter(line => /^\s+\w+\s*:/.test(line));
for (const line of entries) assert.match(line, /:\s*(e|\(\)) => say\(/, 'SKILL_POWER entry is more than factors text: ' + line.trim());

console.log('skillformulas ok: ' + powerKeys.length + ' previews, ' + Object.keys(SKILL_FORMULAS).length + ' formulas');
