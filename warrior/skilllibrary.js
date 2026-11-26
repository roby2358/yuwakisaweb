'use strict';
// skilllibrary.js — SkillLibrary: the single authority for how skills are
// discovered, so no skill can ever be awarded twice.
//
// Skills fall into groups (flags in the SKILLS table):
//   - core     : core: true. Channel Aether, the crossing skills (Spirit Walk,
//                Mountain Skip, Water Skip) and the meta skills (Renew, Retrain).
//                Never held out or dealt; each rides exactly one scroll near the
//                start (placeCoreScrolls), and that scroll is the only way to get
//                it. Channel's scroll is always the nearest, within
//                CHANNEL_SCROLL_RADIUS; the rest (NEAR_CORE_SKILLS) lie past it,
//                within NEAR_CORE_SCROLL_RADIUS.
//   - fixed    : shopOnly (Magicsmith only), scrollOnly (RETURN, from the Maw's
//                dropped scroll), and the starting skill the player already knows.
//   - optional : every other skill. Each run deals them: SKILL_HELD_OUT_FRACTION
//                (rounded down) are held out and can't be obtained by any channel;
//                of the rest, FAR_SCROLL_SKILLS are bound to far story scrolls
//                (taken) and the remainder are learnable.
//
// The dynamic channel (Skill Seek) draws from poolSkills: the obtainable
// skills (optional, unlearned, not taken, not held out) within the player's
// level. Each Wise Man's Hut's standing assignment is dealt from the obtainable
// skills, and its HUT_REROLL_CHANCE rerolls draw from them too, any level, so
// huts and Skill Seek only ever give optional skills. taken and heldOut are the
// per-run state that persists; everything else derives from SKILLS and the
// learned set.

const SKILL_HELD_OUT_FRACTION = 0.5;
const FAR_SCROLL_SKILLS = 6;
const CHANNEL_SCROLL_RADIUS = 11;
const NEAR_CORE_SCROLL_RADIUS = 50;   // half the 100-wide map
// The core skills whose scrolls lie past Channel Aether's.
const NEAR_CORE_SKILLS = Object.values(SKILLS).filter(s => s.core && s.id !== 'channel').map(s => s.id);

class SkillLibrary {
    constructor() {
        this.taken = new Set();
        this.heldOut = new Set();
    }

    isHeldOut(id) { return this.heldOut.has(id); }
    isOptional(s) { return !s.core && !s.shopOnly && !s.scrollOnly; }

    // Optional skills appearing this run and not bound to a scroll or learned,
    // any level: what a Wise Man's Hut is dealt and rerolls, and (within level)
    // Skill Seek's pool. Never core (core skills come only from their scrolls).
    obtainable(learned) {
        return Object.values(SKILLS).filter(s =>
            this.isOptional(s) && !this.taken.has(s.id) && !this.isHeldOut(s.id) &&
            !learned.has(s.id));
    }

    // Skills Skill Seek may grant: the obtainable ones within the player's level.
    poolSkills(learned, level) {
        return this.obtainable(learned).filter(s => s.minLevel <= level);
    }

    // Shop-exclusive skills the player hasn't bought yet.
    shopSkills(learned) {
        return Object.values(SKILLS).filter(s => s.shopOnly && !learned.has(s.id));
    }

    // One-time partition at new game. Shuffles the optional skills the player
    // doesn't know yet: the back part is held out, the front part appears. The
    // first FAR_SCROLL_SKILLS appearing skills go to `farScrolls` (marked taken);
    // a scroll left unfilled (fewer appearing skills than scrolls) keeps
    // poi.skill === null, and the caller removes it. `huts` each get a
    // non-binding display skill from the learnable optional skills (repeats OK).
    deal(farScrolls, huts, learned) {
        const optional = Rando.shuffle(Object.values(SKILLS)
            .filter(s => this.isOptional(s) && !learned.has(s.id)).map(s => s.id));
        const appearing = optional.length - Math.floor(optional.length * SKILL_HELD_OUT_FRACTION);
        this.heldOut = new Set(optional.slice(appearing));
        const dealt = optional.slice(0, Math.min(FAR_SCROLL_SKILLS, appearing, farScrolls.length));
        this.taken = new Set(dealt);
        dealt.forEach((id, i) => { farScrolls[i].skill = id; });
        const pool = this.obtainable(learned);
        for (const hut of huts) hut.skill = pool.length ? Rando.choice(pool).id : null;
    }

    // Places one scroll per core skill, reachable on foot from (q, r): Channel
    // Aether within CHANNEL_SCROLL_RADIUS, each of NEAR_CORE_SKILLS farther than
    // that and within NEAR_CORE_SCROLL_RADIUS, so Channel's is always the nearest.
    // Returns the placed scroll POIs (a skill with nowhere to fit gets none).
    placeCoreScrolls(world, q, r) {
        const dist = h => hexDistance(h.q, h.r, q, r);
        const scrolls = [world.placeScroll('channel', q, r, h => dist(h) <= CHANNEL_SCROLL_RADIUS)];
        for (const id of NEAR_CORE_SKILLS)
            scrolls.push(world.placeScroll(id, q, r,
                h => dist(h) > CHANNEL_SCROLL_RADIUS && dist(h) <= NEAR_CORE_SCROLL_RADIUS));
        return scrolls.filter(s => s !== null);
    }

    // An obtainable skill, any level, or null. Used by the Wise Man's hut
    // when its assigned skill is already known.
    rerollHutSkill(learned) {
        const pool = this.obtainable(learned);
        return pool.length ? Rando.choice(pool).id : null;
    }

    toJSON() {
        return { taken: [...this.taken], heldOut: [...this.heldOut] };
    }

    static fromJSON(data) {
        const lib = new SkillLibrary();
        lib.taken = new Set(data.taken);
        lib.heldOut = new Set(data.heldOut);
        return lib;
    }
}
