'use strict';
// skilllibrary.js — SkillLibrary: the single authority for how skills are
// discovered, so no skill can ever be awarded twice.
//
// Skills fall into groups (flags in the SKILLS table):
//   - core     : core: true. Crossing skills (Spirit Walk, Mountain Skip, Water
//                Skip) and the meta skills (Renew, Retrain). Always obtainable,
//                never taken or held out; three of them also ride non-binding
//                scrolls near the start (the last NEAR_CORE_SCROLLS of coreOrder).
//   - fixed    : shopOnly (Magicsmith only), scrollOnly (their own placed or
//                dropped scroll), and the starting skill the player already knows.
//   - optional : every other skill. Each run deals them: SKILL_HELD_OUT_FRACTION
//                (rounded down) are held out and can't be obtained by any channel;
//                of the rest, FAR_SCROLL_SKILLS are bound to far story scrolls
//                (taken) and the remainder are learnable.
//
// The dynamic channels (level-up, Skill Seek) draw from poolSkills: unlearned
// skills that are not shop, not taken, not held out. Each Wise Man's Hut gives
// one core lesson (firstUnlearnedCore, front of coreOrder); its standing
// assignment is dealt from the learnable optional skills, and its 5% rerolls
// also reach unlearned core skills (hutRerollPool). taken, heldOut and
// coreOrder are the per-run state that persists; everything else derives from SKILLS and the learned set.

const SKILL_HELD_OUT_FRACTION = 0.5;
const FAR_SCROLL_SKILLS = 6;
const NEAR_CORE_SCROLLS = 3;
const NEAR_CORE_SCROLL_RADIUS = 25;   // a quarter of the 100-wide map

class SkillLibrary {
    constructor() {
        this.taken = new Set();
        this.heldOut = new Set();
        this.coreOrder = [];
    }

    isShop(id) { return !!SKILLS[id]?.shopOnly; }
    isTaken(id) { return !!SKILLS[id]?.scrollOnly || this.taken.has(id); }
    isHeldOut(id) { return this.heldOut.has(id); }
    isOptional(s) { return !s.core && !s.shopOnly && !s.scrollOnly; }

    // Skills level-up and Skill Seek may grant: not shop-only, not scroll-taken,
    // not held out, not learned, and within the player's level. Includes
    // unlearned core skills.
    poolSkills(learned, level) {
        return Object.values(SKILLS).filter(s =>
            !this.isShop(s.id) && !this.isTaken(s.id) && !this.isHeldOut(s.id) &&
            !learned.has(s.id) && s.minLevel <= level);
    }

    // Optional skills appearing this run and not bound to a scroll or learned,
    // any level. The skills a Wise Man's Hut is dealt at new game.
    learnableOptional(learned) {
        return Object.values(SKILLS).filter(s =>
            this.isOptional(s) && !this.taken.has(s.id) && !this.isHeldOut(s.id) &&
            !learned.has(s.id));
    }

    // Shop-exclusive skills the player hasn't bought yet.
    shopSkills(learned) {
        return Object.values(SKILLS).filter(s => s.shopOnly && !learned.has(s.id));
    }

    // One-time partition at new game. Shuffles the core order and the optional
    // skills the player doesn't know yet: the back part is held out, the front
    // part appears. The first FAR_SCROLL_SKILLS appearing skills go to
    // `farScrolls` (marked taken); leftover scrolls keep poi.skill === null and
    // become Skill-Point scrolls at pickup. `huts` each get a non-binding display
    // skill from the learnable optional skills (repeats OK) and owes its one
    // core lesson (coreTaught false).
    deal(farScrolls, huts, learned) {
        this.coreOrder = Rando.shuffle(Object.values(SKILLS).filter(s => s.core).map(s => s.id));
        const optional = Rando.shuffle(Object.values(SKILLS)
            .filter(s => this.isOptional(s) && !learned.has(s.id)).map(s => s.id));
        const appearing = optional.length - Math.floor(optional.length * SKILL_HELD_OUT_FRACTION);
        this.heldOut = new Set(optional.slice(appearing));
        const dealt = optional.slice(0, Math.min(FAR_SCROLL_SKILLS, appearing, farScrolls.length));
        this.taken = new Set(dealt);
        farScrolls.forEach((poi, i) => { poi.skill = dealt[i] ?? null; });
        const pool = this.learnableOptional(learned);
        for (const hut of huts) {
            hut.skill = pool.length ? Rando.choice(pool).id : null;
            hut.coreTaught = false;
        }
    }

    // The core skills that ride the non-binding scrolls near the start.
    nearCoreSkills() { return this.coreOrder.slice(-NEAR_CORE_SCROLLS); }

    // The first core skill in this run's coreOrder the player hasn't learned, or
    // null. A Wise Man's Hut's one guaranteed core lesson.
    firstUnlearnedCore(learned) {
        return this.coreOrder.find(id => !learned.has(id)) ?? null;
    }

    // Learnable optional skills plus unlearned core skills: what a hut's 5%
    // reroll may dig up. Never held out, shop or scroll-taken.
    hutRerollPool(learned) {
        return this.learnableOptional(learned)
            .concat(this.coreOrder.filter(id => !learned.has(id)).map(id => SKILLS[id]));
    }

    // A skill from hutRerollPool, any level, or null. Used by the Wise Man's hut
    // when its assigned skill is already known.
    rerollHutSkill(learned) {
        const pool = this.hutRerollPool(learned);
        return pool.length ? Rando.choice(pool).id : null;
    }

    toJSON() {
        return { taken: [...this.taken], heldOut: [...this.heldOut], coreOrder: [...this.coreOrder] };
    }

    static fromJSON(data) {
        const lib = new SkillLibrary();
        lib.taken = new Set(data.taken);
        lib.heldOut = new Set(data.heldOut);
        lib.coreOrder = [...data.coreOrder];
        return lib;
    }
}
