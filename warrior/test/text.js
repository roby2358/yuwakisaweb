// Checks text.js: every entry has a known kind and a non-empty array of string
// variants, every variant of an entry uses the same placeholders, the keys are
// unique, and say() fails fast on a missing key, an unfilled placeholder or an
// unused var, and that every item special's line fills from the item. Also checks that every say('key') named in index.js / actions.js
// exists. Run: node test/text.js
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load.js');
const { TEXT, TEXT_RENDER, say, textVarsFrom, itemSpecialText, ALL_EQUIPMENT, rollMagicItem } = load(
    ['rando.js', 'colortheory.js', 'config.js', 'text.js'],
    ['TEXT', 'TEXT_RENDER', 'say', 'textVarsFrom', 'itemSpecialText', 'ALL_EQUIPMENT', 'rollMagicItem']);

const ROOT = path.join(__dirname, '..');
const placeholders = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

for (const [key, entry] of Object.entries(TEXT)) {
    assert.ok(entry.kind in TEXT_RENDER, key + ': unknown kind ' + entry.kind);
    assert.ok(Array.isArray(entry.variants) && entry.variants.length > 0, key + ': no variants');
    entry.variants.forEach(v => assert.equal(typeof v, 'string', key + ': variant is not a string'));
    const want = placeholders(entry.variants[0]);
    entry.variants.forEach(v => assert.equal(placeholders(v), want, key + ': variants disagree on placeholders'));
}

// An object literal keeps the last of two equal keys without complaint.
const src = fs.readFileSync(path.join(ROOT, 'text.js'), 'utf8');
const seen = new Set();
for (const m of src.matchAll(/^ {8}(\w+): (?:label|log|narration|stage|speech)\(/gm)) {
    assert.ok(!seen.has(m[1]), 'duplicate text key ' + m[1]);
    seen.add(m[1]);
}
assert.equal(seen.size, Object.keys(TEXT).length, 'text.js entries not all in the one-per-line form');

// Fail fast.
assert.throws(() => say('no_such_key', {}), /no entry/);
assert.throws(() => say('log_xp', {}), /needs \{n\}/);
assert.throws(() => say('log_xp', { n: undefined }), /needs \{n\}/);
assert.throws(() => say('log_xp', { n: 1, extra: 2 }), /has no \{extra\}/);
assert.equal(say('log_xp', { n: 5 }), '+5 XP');

assert.throws(() => textVarsFrom('no_such_key', {}), /no entry/);
assert.equal(JSON.stringify(textVarsFrom('spec_chain', { chainCount: 3, damage: 9 })), '{"chainCount":3}');

// Every item special's stat line fills from the item's own fields (say throws
// otherwise), across the fixed gear and a spread of rolled magic items.
for (let i = 0; i < 300; i++) rollMagicItem();
for (const item of Object.values(ALL_EQUIPMENT)) {
    if (item.special) itemSpecialText(item);
}

// Rendering by kind, checked on every variant (flavor entries have many).
TEXT.sage_teach.variants.forEach(v =>
    assert.match(TEXT_RENDER.speech(v), /^<p>"[^"<]*<b>\{skill\}<\/b>[^"<]*"<\/p>$/, 'sage_teach: ' + v));
TEXT.sage_peers.variants.forEach(v =>
    assert.match(TEXT_RENDER.stage(v), /^<p><i>[^<]+<\/i><\/p>$/, 'sage_peers: ' + v));
assert.match(say('sage_teach', { skill: 'Sprint' }), /<b>Sprint<\/b>/);

// Speech is wrapped in quotes, so a variant must not carry its own.
for (const [key, entry] of Object.entries(TEXT)) {
    if (entry.kind !== 'speech') continue;
    entry.variants.forEach(v => assert.ok(!v.includes('"'), key + ': speech variant has its own quotes: ' + v));
}
assert.equal((say('maw_hungers', {}).match(/<p>/g) || []).length, 2);

// Every literal key the game passes to say() exists.
for (const file of ['index.js', 'actions.js']) {
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of code.matchAll(/say\(([^()]*?),/g)) {
        for (const k of m[1].matchAll(/(?<!=== ?)'(\w+)'(?! *\+)/g)) assert.ok(k[1] in TEXT, file + ': say() names missing key ' + k[1]);
    }
}

console.log('text ok: ' + Object.keys(TEXT).length + ' entries');
