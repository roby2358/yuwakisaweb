// Checks text.js: every entry has a known kind and a non-empty array of string
// variants, every variant of an entry uses the same placeholders, the keys are
// unique, and say() fails fast on a missing key, an unfilled placeholder or an
// unused var, and that every item special's line fills from the item. Also
// checks that every say('key') named in index.js / actions.js / enemy_ai.js
// exists, that every key-shaped literal there is a TEXT key, and that every
// TEXT key is reachable. Run: node test/text.js
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load.js');
const { TEXT, TEXT_RENDER, say, sayCount, textVarsFrom, itemSpecialText, ALL_EQUIPMENT, rollMagicItem,
    SKILLS, NON_MAGICAL_ITEMS, MELEE_EFFECTS, RANGED_EFFECTS, ARMOR_EFFECTS, PASSIVE_EFFECTS } = load(
    ['rando.js', 'colortheory.js', 'config.js', 'text.js'],
    ['TEXT', 'TEXT_RENDER', 'say', 'sayCount', 'textVarsFrom', 'itemSpecialText', 'ALL_EQUIPMENT', 'rollMagicItem',
        'SKILLS', 'NON_MAGICAL_ITEMS', 'MELEE_EFFECTS', 'RANGED_EFFECTS', 'ARMOR_EFFECTS', 'PASSIVE_EFFECTS']);

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

// sayCount picks none / one / many and hands {n} only to a line that shows it.
const counts = { none: 'log_prospect_none', one: 'log_prospect_one', many: 'log_prospect_many' };
assert.equal(sayCount(0, counts, {}), say('log_prospect_none', {}));
assert.equal(sayCount(1, counts, {}), say('log_prospect_one', {}));
assert.equal(sayCount(3, counts, {}), say('log_prospect_many', { n: 3 }));
assert.equal(sayCount(2, { one: 'word_hex', many: 'word_hexes' }, {}), say('word_hexes', {}));
assert.throws(() => sayCount(0, { one: 'word_hex', many: 'word_hexes' }, {}), /no key for n=0/);
assert.throws(() => sayCount(2, counts, { extra: 1 }), /has no \{extra\}/);

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
for (const file of ['index.js', 'actions.js', 'enemy_ai.js']) {
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of code.matchAll(/say\(([^()]*?),/g)) {
        for (const k of m[1].matchAll(/(?<!=== ?)'(\w+)'(?! *\+)/g)) assert.ok(k[1] in TEXT, file + ': say() names missing key ' + k[1]);
    }
}

// Every key-shaped literal in the game code is a TEXT key. Key-shaped: a quoted
// word whose prefix (text before the first _) some TEXT key also has. This
// catches keys held in tables (SMITHS, MELEE_AFFIX_LABEL, SETTLEMENTS, ...), not
// just the ones passed straight to say(). Item specials, item ids and skill ids
// share some prefixes but are not text; a literal ending in _ is the stem of a
// dynamic key and must be listed in DYNAMIC_STEMS.
const GAME_FILES = ['index.js', 'actions.js', 'enemy_ai.js'];
const DYNAMIC_STEMS = new Set(['stat_']);   // say('stat_' + s) over the four stats (index.js)
const itemSpecials = new Set([...NON_MAGICAL_ITEMS, ...MELEE_EFFECTS, ...RANGED_EFFECTS, ...ARMOR_EFFECTS, ...PASSIVE_EFFECTS]
    .map(i => i.special).filter(Boolean));
const keyPrefix = k => k.split('_')[0];
const textPrefixes = new Set(Object.keys(TEXT).filter(k => k.includes('_')).map(keyPrefix));
const literals = new Set();
for (const file of GAME_FILES) {
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of code.matchAll(/'(\w+)'/g)) literals.add(m[1]);
}
for (const lit of literals) {
    if (!lit.includes('_') || !textPrefixes.has(keyPrefix(lit))) continue;
    if (itemSpecials.has(lit) || lit in ALL_EQUIPMENT || lit in SKILLS) continue;
    if (lit.endsWith('_')) { assert.ok(DYNAMIC_STEMS.has(lit), 'unlisted dynamic key stem ' + lit); continue; }
    assert.ok(lit in TEXT, 'key-shaped literal is not a text key: ' + lit);
}

// And the reverse: every TEXT key is reachable. Either it is a literal in the
// game code, or the line of an item special some loaded item has (fixed gear
// and the rolled-magic effect tables), or one of the documented dynamic keys.
const DYNAMIC_KEYS = {
    stat_might: "say('stat_' + s) over the four stats (index.js)",
    stat_reflex: "say('stat_' + s) over the four stats (index.js)",
    stat_warding: "say('stat_' + s) over the four stats (index.js)",
    stat_vigor: "say('stat_' + s) over the four stats (index.js)",
    spec_charge_mult: 'itemSpecialText (text.js) for a charge item with chargeMultiplier',
};
assert.ok(MELEE_EFFECTS.some(e => e.special === 'charge' && e.chargeMultiplier), 'spec_charge_mult: no charge effect has chargeMultiplier');
for (const key of Object.keys(TEXT)) {
    if (literals.has(key) || key in DYNAMIC_KEYS) continue;
    if (key.startsWith('spec_') && itemSpecials.has(key.slice('spec_'.length))) continue;
    assert.fail('unreachable text key ' + key);
}

console.log('text ok: ' + Object.keys(TEXT).length + ' entries');
