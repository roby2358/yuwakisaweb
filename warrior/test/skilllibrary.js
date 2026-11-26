// Checks SkillLibrary's per-run skill groups: core, fixed, held-out and dealt
// optional skills (distinct hut skills while they last), the core and story
// scrolls placed on generated worlds (none blank, story scrolls anywhere on the
// map), HUT_COUNT huts per world, and that generation itself places no scrolls.
// Run: node test/skilllibrary.js
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load.js');

// Load index.html's scripts in order, up to and including skilllibrary.js
// (world.js loads before it).
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const g = load(scripts.slice(0, scripts.indexOf('skilllibrary.js') + 1),
    ['SKILLS', 'SkillLibrary', 'Rando', 'STORY_SCROLL_SKILLS', 'SKILL_HELD_OUT_FRACTION', 'GameWorld', 'POI', 'HUT_COUNT',
        'hexDistance', 'hexKey', 'CHANNEL_SCROLL_RADIUS', 'NEAR_CORE_SCROLL_RADIUS', 'NEAR_CORE_SKILLS', 'SPECIAL_TERRAINS']);
const { SKILLS, SkillLibrary, Rando, STORY_SCROLL_SKILLS, SKILL_HELD_OUT_FRACTION, GameWorld, POI, HUT_COUNT,
    hexDistance, hexKey, CHANNEL_SCROLL_RADIUS, NEAR_CORE_SCROLL_RADIUS, NEAR_CORE_SKILLS, SPECIAL_TERRAINS } = g;

const all = Object.values(SKILLS);
const CORE = new Set(['channel', 'spirit_walk', 'mountain_skip', 'water_skip', 'respec', 'retrain']);
assert.deepEqual(new Set(all.filter(s => s.core).map(s => s.id)), CORE);
for (const id of CORE) assert.ok(!SKILLS[id].scrollOnly && !SKILLS[id].shopOnly, 'core skill also fixed: ' + id);
assert.deepEqual(new Set(NEAR_CORE_SKILLS), new Set([...CORE].filter(id => id !== 'channel')));
assert.equal(NEAR_CORE_SKILLS.length, CORE.size - 1);
// The skill a new Player already knows: an inline literal in the Player
// constructor (player.js, learnedSkills), so keep this in step with it.
const STARTING = 'restore';
const fixed = new Set(all.filter(s => s.shopOnly || s.scrollOnly).map(s => s.id).concat([STARTING]));
const optional = all.filter(s => !s.core && !fixed.has(s.id)).map(s => s.id);
const DEALS = 2000;
// The main deals assume at least one learnable skill per hut (exactly one with
// the current table).
const learnableCount = optional.length - Math.floor(optional.length * SKILL_HELD_OUT_FRACTION) - STORY_SCROLL_SKILLS;
assert.ok(learnableCount >= HUT_COUNT, 'fewer learnable skills (' + learnableCount + ') than huts (' + HUT_COUNT + ')');

for (let n = 0; n < DEALS; n++) {
    const lib = new SkillLibrary();
    const learned = new Set([STARTING]);
    const scrolls = Array.from({ length: STORY_SCROLL_SKILLS }, () => ({ skill: null }));
    const huts = Array.from({ length: HUT_COUNT }, () => ({ skill: null }));
    lib.deal(scrolls, huts, learned);
    // Every message names the failing deal, so a random failure can be read back.
    const deal = ' [heldOut ' + [...lib.heldOut].join(',') + ']';
    const why = msg => msg + deal;

    for (const id of CORE) {
        assert.ok(!lib.taken.has(id), why('core taken: ' + id));
        assert.ok(!lib.heldOut.has(id), why('core held out: ' + id));
    }
    assert.equal(lib.heldOut.size, Math.floor(optional.length * SKILL_HELD_OUT_FRACTION), why('held-out count'));
    for (const id of lib.heldOut) assert.ok(optional.includes(id), why('non-optional held out: ' + id));

    const dealt = scrolls.filter(p => p.skill !== null).map(p => p.skill);
    assert.equal(dealt.length, STORY_SCROLL_SKILLS, why('story scroll count'));
    assert.equal(new Set(dealt).size, STORY_SCROLL_SKILLS, why('story scroll skills not distinct'));
    assert.equal(scrolls.filter(p => p.skill === null).length, 0, why('blank story scroll'));
    for (const id of dealt) {
        assert.ok(optional.includes(id) && !lib.heldOut.has(id), why('bad story scroll skill: ' + id));
        assert.ok(lib.taken.has(id), why('story scroll skill not taken: ' + id));
    }
    assert.equal(lib.taken.size, STORY_SCROLL_SKILLS, why('taken count'));

    // Huts: learnable optional skills only, all different when there are enough.
    const hutBad = id => !optional.includes(id) || lib.heldOut.has(id) || lib.taken.has(id);
    for (const h of huts) assert.ok(h.skill !== null && !hutBad(h.skill), why('bad hut skill: ' + h.skill));
    assert.equal(new Set(huts.map(h => h.skill)).size, HUT_COUNT, why('hut skills not distinct'));

    // poolSkills and hut rerolls with a random learned set and level.
    const someLearned = new Set([STARTING, ...all.filter(() => Rando.bool(0.3)).map(s => s.id)]);
    const level = Rando.int(0, 12);
    const pool = lib.poolSkills(someLearned, level).map(s => s.id);
    for (const id of pool) {
        assert.ok(!lib.heldOut.has(id) && !fixed.has(id) && !lib.taken.has(id), why('bad pool skill: ' + id));
        assert.ok(!someLearned.has(id) && SKILLS[id].minLevel <= level, why('pool skill learned or over level: ' + id));
    }
    for (const id of CORE) assert.ok(!pool.includes(id), why('core in pool: ' + id));
    const reroll = lib.rerollHutSkill(someLearned);
    const rerollBad = id => !optional.includes(id) || lib.heldOut.has(id) || lib.taken.has(id) || someLearned.has(id);
    if (reroll !== null) assert.ok(!rerollBad(reroll), why('bad hut reroll: ' + reroll));
    const rerollPool = lib.obtainable(someLearned).map(s => s.id);
    for (const id of rerollPool) assert.ok(!rerollBad(id), why('bad obtainable skill: ' + id));
    // Even with nothing learned, no core skill is obtainable.
    const freshPool = lib.obtainable(new Set()).map(s => s.id);
    for (const id of CORE) assert.ok(!freshPool.includes(id), why('core obtainable: ' + id));

    // Save round-trip.
    const back = SkillLibrary.fromJSON(JSON.parse(JSON.stringify(lib.toJSON())));
    assert.deepEqual(back.taken, lib.taken, why('round-trip taken'));
    assert.deepEqual(back.heldOut, lib.heldOut, why('round-trip heldOut'));
    assert.deepEqual(back.poolSkills(someLearned, level), lib.poolSkills(someLearned, level), why('round-trip poolSkills'));
}

// More huts than learnable skills: every learnable skill sits in a hut and the
// spare huts repeat one; with nothing learnable the huts stay empty.
for (let n = 0; n < 200; n++) {
    const lib = new SkillLibrary();
    const learned = new Set([STARTING]);
    const huts = Array.from({ length: learnableCount + 5 }, () => ({ skill: null }));
    lib.deal(Array.from({ length: STORY_SCROLL_SKILLS }, () => ({ skill: null })), huts, learned);
    const learnable = lib.obtainable(learned).map(s => s.id);
    assert.deepEqual(new Set(huts.map(h => h.skill)), new Set(learnable), 'spare huts: deal ' + n);
}
const allKnown = new Set([STARTING, ...optional]);
const emptyHuts = Array.from({ length: HUT_COUNT }, () => ({ skill: null }));
new SkillLibrary().deal([], emptyHuts, allKnown);
assert.ok(emptyHuts.every(h => h.skill === null), 'hut skill with nothing learnable');

// Core scrolls on generated worlds: exactly one scroll per core skill, Channel
// Aether's the nearest and within CHANNEL_SCROLL_RADIUS, the rest past it and
// within NEAR_CORE_SCROLL_RADIUS.
const WORLDS = 10;
let nearMawStory = 0;   // story scrolls in the half of the map near the Maw
for (let n = 0; n < WORLDS; n++) {
    const world = new GameWorld();
    world.generate();
    // Generation places no scrolls (prizes are gold, gems and magic items), and
    // magic-item prizes sit only on prize hexes.
    assert.equal(world.pois.filter(p => p.type === POI.SCROLL).length, 0, 'generation placed a scroll');
    for (const h of world.hexes.values())
        if (h.magicItem) assert.ok(SPECIAL_TERRAINS.has(h.terrain) && !h.poi, 'magic item off a prize hex');
    const start = world.pois.find(p => p.type === POI.HAVEN);
    const placed = new SkillLibrary().placeCoreScrolls(world, start.q, start.r);
    const scrolls = world.pois.filter(p => p.type === POI.SCROLL);
    assert.deepEqual(new Set(placed), new Set(scrolls), 'placed scrolls are the core scrolls');
    for (const id of CORE)
        assert.equal(scrolls.filter(p => p.skill === id).length, 1, 'one scroll for ' + id);
    const dist = p => hexDistance(p.q, p.r, start.q, start.r);
    const channel = scrolls.find(p => p.skill === 'channel');
    assert.ok(dist(channel) <= CHANNEL_SCROLL_RADIUS, 'channel scroll within ' + CHANNEL_SCROLL_RADIUS);
    for (const p of scrolls.filter(p => p !== channel)) {
        assert.ok(dist(p) > dist(channel), 'channel scroll not nearest: ' + p.skill);
        assert.ok(dist(p) <= NEAR_CORE_SCROLL_RADIUS, 'core scroll past ' + NEAR_CORE_SCROLL_RADIUS + ': ' + p.skill);
    }
    // Story scrolls and huts as new-game setup deals them: STORY_SCROLL_SKILLS
    // scrolls anywhere reachable, each dealt a skill, and HUT_COUNT huts with
    // HUT_COUNT different skills.
    const story = [];
    for (let i = 0; i < STORY_SCROLL_SKILLS; i++) story.push(world.placeScroll(null, start.q, start.r, () => true));
    const huts = world.pois.filter(p => p.type === POI.HUT);
    assert.equal(huts.length, HUT_COUNT, 'hut count');
    new SkillLibrary().deal(story, huts, new Set([STARTING]));
    assert.ok(story.every(p => p !== null && p.skill !== null), 'blank story scroll on a generated world');
    assert.equal(new Set(huts.map(h => h.skill)).size, HUT_COUNT, 'hut skills not distinct on a generated world');
    const mawDists = world.mawDistanceMap();
    let mawMax = 1;
    for (const c of mawDists.values()) if (c > mawMax) mawMax = c;
    for (const p of story) if ((mawDists.get(hexKey(p.q, p.r)) ?? 0) <= mawMax * 0.5) nearMawStory++;
    assert.equal(world.pois.filter(p => p.type === POI.SCROLL).length, CORE.size + STORY_SCROLL_SKILLS, 'scroll count');
}

// Story scrolls are spread over the whole map, not only the far-from-Maw half.
assert.ok(nearMawStory > 0, 'no story scroll near the Maw in ' + WORLDS + ' worlds');
console.log('skilllibrary ok: ' + optional.length + ' optional, ' + DEALS + ' deals, ' + WORLDS + ' worlds');
