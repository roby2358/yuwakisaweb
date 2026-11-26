// Checks SkillLibrary's per-run skill groups: core, fixed, held-out and dealt
// optional skills. Run: node test/skilllibrary.js
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load.js');

// Load index.html's scripts in order, up to and including skilllibrary.js.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const g = load(scripts.slice(0, scripts.indexOf('skilllibrary.js') + 1),
    ['SKILLS', 'SkillLibrary', 'Rando', 'FAR_SCROLL_SKILLS', 'NEAR_CORE_SCROLLS', 'SKILL_HELD_OUT_FRACTION']);
const { SKILLS, SkillLibrary, Rando, FAR_SCROLL_SKILLS, NEAR_CORE_SCROLLS, SKILL_HELD_OUT_FRACTION } = g;

const all = Object.values(SKILLS);
const CORE = new Set(['spirit_walk', 'mountain_skip', 'water_skip', 'respec', 'retrain']);
assert.deepEqual(new Set(all.filter(s => s.core).map(s => s.id)), CORE);
const STARTING = 'restore';
const fixed = new Set(all.filter(s => s.shopOnly || s.scrollOnly).map(s => s.id).concat([STARTING]));
const optional = all.filter(s => !s.core && !fixed.has(s.id)).map(s => s.id);
const FAR_SCROLLS = 10, HUTS = 12, DEALS = 2000;

for (let n = 0; n < DEALS; n++) {
    const lib = new SkillLibrary();
    const learned = new Set([STARTING]);
    const scrolls = Array.from({ length: FAR_SCROLLS }, () => ({ skill: null }));
    const huts = Array.from({ length: HUTS }, () => ({ skill: null }));
    lib.deal(scrolls, huts, learned);

    for (const id of CORE) {
        assert.ok(!lib.taken.has(id), 'core taken: ' + id);
        assert.ok(!lib.heldOut.has(id), 'core held out: ' + id);
    }
    assert.equal(lib.heldOut.size, Math.floor(optional.length * SKILL_HELD_OUT_FRACTION));
    for (const id of lib.heldOut) assert.ok(optional.includes(id), 'non-optional held out: ' + id);

    const dealt = scrolls.filter(p => p.skill !== null).map(p => p.skill);
    assert.equal(dealt.length, FAR_SCROLL_SKILLS);
    assert.equal(new Set(dealt).size, FAR_SCROLL_SKILLS, 'far scroll skills not distinct');
    assert.equal(scrolls.filter(p => p.skill === null).length, FAR_SCROLLS - FAR_SCROLL_SKILLS);
    for (const id of dealt) {
        assert.ok(optional.includes(id) && !lib.heldOut.has(id), 'bad far scroll skill: ' + id);
        assert.ok(lib.taken.has(id));
    }
    assert.equal(lib.taken.size, FAR_SCROLL_SKILLS);

    assert.deepEqual(new Set(lib.coreOrder), CORE);
    assert.equal(lib.coreOrder.length, CORE.size);
    assert.deepEqual(lib.nearCoreSkills(), lib.coreOrder.slice(-NEAR_CORE_SCROLLS));

    // Huts: learnable optional skills only.
    const hutBad = id => !optional.includes(id) || lib.heldOut.has(id) || lib.taken.has(id);
    for (const h of huts) assert.ok(h.skill !== null && !hutBad(h.skill), 'bad hut skill: ' + h.skill);
    for (const h of huts) assert.equal(h.coreTaught, false);

    // Core lessons: coreOrder's first unlearned skill, null once all five are known.
    const coreLearned = new Set([STARTING]);
    for (const id of lib.coreOrder) {
        assert.equal(lib.firstUnlearnedCore(coreLearned), id);
        coreLearned.add(id);
    }
    assert.equal(lib.firstUnlearnedCore(coreLearned), null);
    const skipFirst = new Set([STARTING, lib.coreOrder[0], lib.coreOrder[2]]);
    assert.equal(lib.firstUnlearnedCore(skipFirst), lib.coreOrder[1]);

    // poolSkills and hut rerolls with a random learned set and level.
    const someLearned = new Set([STARTING, ...all.filter(() => Rando.bool(0.3)).map(s => s.id)]);
    const level = Rando.int(0, 12);
    const pool = lib.poolSkills(someLearned, level).map(s => s.id);
    for (const id of pool) {
        assert.ok(!lib.heldOut.has(id) && !fixed.has(id) && !lib.taken.has(id), 'bad pool skill: ' + id);
        assert.ok(!someLearned.has(id) && SKILLS[id].minLevel <= level);
    }
    for (const id of CORE)
        if (!someLearned.has(id) && SKILLS[id].minLevel <= level) assert.ok(pool.includes(id), 'core missing from pool: ' + id);
    const reroll = lib.rerollHutSkill(someLearned);
    const rerollBad = id => !(CORE.has(id) || optional.includes(id)) || lib.heldOut.has(id) || lib.taken.has(id) || someLearned.has(id);
    if (reroll !== null) assert.ok(!rerollBad(reroll), 'bad hut reroll: ' + reroll);
    const rerollPool = lib.hutRerollPool(someLearned).map(s => s.id);
    for (const id of rerollPool) assert.ok(!rerollBad(id), 'bad reroll pool skill: ' + id);
    for (const id of CORE)
        if (!someLearned.has(id)) assert.ok(rerollPool.includes(id), 'core missing from reroll pool: ' + id);

    // Save round-trip.
    const back = SkillLibrary.fromJSON(JSON.parse(JSON.stringify(lib.toJSON())));
    assert.deepEqual(back.taken, lib.taken);
    assert.deepEqual(back.heldOut, lib.heldOut);
    assert.deepEqual(back.coreOrder, lib.coreOrder);
    assert.deepEqual(back.poolSkills(someLearned, level), lib.poolSkills(someLearned, level));
}

console.log('skilllibrary ok: ' + optional.length + ' optional, ' + DEALS + ' deals');
