// skilllibrary.js — SkillLibrary: the single authority for how skills are
// discovered, so no skill can ever be awarded twice.
//
// Every learnable skill lives in exactly one channel:
//   - shop   : shopOnly skills (Magicsmith only) — never offered anywhere else.
//   - taken  : skills bound to a physical scroll this run (the config scrollOnly
//              utility scrolls plus the story/prize scrolls dealt at game start).
//              Removed from the dynamic pool, so leveling/huts can't duplicate them.
//   - pool   : everything else — the shared draw for level-up, skill_seek, and
//              the (non-binding) Wise Man's Hut assignment + reroll.
//
// `taken` is the only per-run state that must persist (the rest is derivable from
// the SKILLS table and the player's learned set), so it is the only thing saved.

import { SKILLS } from './config.js';
import { Rando } from './rando.js';

export class SkillLibrary {
    constructor() {
        this.taken = new Set();
    }

    // A skill is unavailable to the dynamic channels if it's shop-exclusive or
    // bound to a scroll (either flagged scrollOnly in config or dealt to a scroll
    // this run).
    isShop(id) { return !!SKILLS[id]?.shopOnly; }
    isTaken(id) { return !!SKILLS[id]?.scrollOnly || this.taken.has(id); }

    // Skills the dynamic channels (level-up, skill_seek, hut) may grant: not
    // shop-only, not scroll-taken, not already learned, and (optionally) within
    // the player's level.
    poolSkills(learned, level = Infinity) {
        return Object.values(SKILLS).filter(s =>
            !this.isShop(s.id) && !this.isTaken(s.id) &&
            !learned.has(s.id) && s.minLevel <= level);
    }

    // Shop-exclusive skills the player hasn't bought yet.
    shopSkills(learned) {
        return Object.values(SKILLS).filter(s => s.shopOnly && !learned.has(s.id));
    }

    // One-time partition at new game. `scrollPois` are SCROLL POIs still awaiting a
    // skill (poi.skill falsy); each gets a distinct pool skill, marked taken. When
    // the supply runs out, the leftover scrolls keep poi.skill === null and become
    // Skill-Point scrolls at pickup. `huts` then each get a non-binding display
    // skill from whatever remains in the pool (no level requirement, repeats OK).
    deal(scrollPois, huts, learned) {
        const givable = Object.values(SKILLS).filter(s =>
            !s.shopOnly && !s.scrollOnly && !learned.has(s.id));
        Rando.shuffle(givable);
        let i = 0;
        for (const poi of scrollPois) {
            if (i < givable.length) {
                poi.skill = givable[i++].id;
                this.taken.add(poi.skill);
            } else {
                poi.skill = null; // supply exhausted — Skill-Point scroll
            }
        }
        const pool = this.poolSkills(learned);
        for (const hut of huts) {
            hut.skill = pool.length ? Rando.choice(pool).id : null;
        }
    }

    // A fresh pool skill the player lacks, any level, or null. Used by the Wise
    // Man's hut when its assigned skill is already known.
    rerollHutSkill(learned) {
        const pool = this.poolSkills(learned);
        return pool.length ? Rando.choice(pool).id : null;
    }

    toJSON() { return { taken: [...this.taken] }; }

    static fromJSON(data) {
        const lib = new SkillLibrary();
        lib.taken = new Set(data?.taken || []);
        return lib;
    }
}
