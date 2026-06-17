// powers.js — Data-driven power catalog for Super.
// Weights are rough echoes of superpower.txt frequency bands
// (Body/Energy common, Mystical/Temporal rarer).

export const POWERS = {
    punch: {
        name: 'Super Punch',
        category: 'Body',
        apCost: 2,
        range: 1,
        area: 0,
        targeting: 'enemy',
        damage: 6,
        accuracy: 2,
        weight: 10,
        desc: 'Melee strike. High accuracy, solid damage.'
    },
    claws: {
        name: 'Chi-Enhanced Fist',
        category: 'Body',
        apCost: 3,
        range: 1,
        area: 0,
        targeting: 'enemy',
        damage: 9,
        accuracy: 1,
        weight: 6,
        desc: 'Bigger hit but costlier.'
    },
    energyBolt: {
        name: 'Energy Bolt',
        category: 'Energy',
        apCost: 2,
        range: 6,
        area: 0,
        targeting: 'enemy',
        damage: 5,
        accuracy: 1,
        weight: 10,
        desc: 'Ranged single-target blast.'
    },
    beam: {
        name: 'Focus Beam',
        category: 'Energy',
        apCost: 3,
        range: 8,
        area: 0,
        targeting: 'enemy',
        damage: 7,
        accuracy: 2,
        weight: 6,
        desc: 'Longer range, higher accuracy.'
    },
    flameBurst: {
        name: 'Flame Burst',
        category: 'Energy',
        apCost: 4,
        range: 5,
        area: 1,
        targeting: 'hex',
        damage: 5,
        accuracy: 0,
        weight: 6,
        desc: 'AOE at target hex (radius 1).'
    },
    psiBlast: {
        name: 'Psi Blast',
        category: 'Mental',
        apCost: 3,
        range: 6,
        area: 0,
        targeting: 'enemy',
        damage: 4,
        accuracy: 3,
        weight: 5,
        desc: 'Bypasses toughness (mental).',
        mental: true
    },
    stun: {
        name: 'Stunning Gaze',
        category: 'Mental',
        apCost: 3,
        range: 5,
        area: 0,
        targeting: 'enemy',
        damage: 0,
        accuracy: 2,
        weight: 4,
        desc: 'Stuns target (skip next turn) on success.',
        effect: 'stun'
    },
    superSpeed: {
        name: 'Super Speed',
        category: 'Body',
        apCost: 2,
        range: 8,
        area: 0,
        targeting: 'self-move',
        weight: 6,
        desc: 'Teleport-dash up to 8 hexes, ignoring rough terrain.'
    },
    flight: {
        name: 'Flight',
        category: 'Flight',
        apCost: 3,
        range: 10,
        area: 0,
        targeting: 'self-move',
        weight: 5,
        desc: 'Fly to any visible hex within 10, ignoring walls.'
    },
    focusUp: {
        name: 'Inner Focus',
        category: 'Mental',
        apCost: 2,
        range: 0,
        area: 0,
        targeting: 'self',
        weight: 4,
        desc: 'Buff: +2 accuracy next 2 actions.',
        effect: 'focused'
    },
    heal: {
        name: 'Regeneration',
        category: 'Body',
        apCost: 3,
        range: 0,
        area: 0,
        targeting: 'self',
        weight: 3,
        desc: 'Restore 8 HP. 2 charges per mission.',
        charges: 2,
        heal: 8
    },
    shockwave: {
        name: 'Shockwave',
        category: 'Matter',
        apCost: 4,
        range: 0,
        area: 2,
        targeting: 'self-aoe',
        damage: 4,
        accuracy: 1,
        weight: 4,
        desc: 'Radius-2 burst around self.'
    }
};

// Build a starter set of 5 powers using weights.
export const rollStarterPowers = (rnd = Math.random) => {
    const entries = Object.entries(POWERS);
    const picked = [];
    const pool = entries.slice();
    // Force at least one melee + one ranged for playability.
    const melee = pool.filter(([, p]) => p.range === 1 && p.damage);
    const ranged = pool.filter(([, p]) => p.range >= 4 && p.damage);
    const movement = pool.filter(([, p]) => p.targeting === 'self-move');
    const utility = pool.filter(([, p]) => p.targeting === 'self' || p.effect === 'stun');

    const pickOne = (list) => {
        if (!list.length) return null;
        const total = list.reduce((s, [, p]) => s + p.weight, 0);
        let roll = rnd() * total;
        for (const entry of list) {
            roll -= entry[1].weight;
            if (roll <= 0) return entry;
        }
        return list[list.length - 1];
    };

    const take = (entry) => {
        if (!entry) return;
        if (picked.find(e => e[0] === entry[0])) return;
        picked.push(entry);
    };

    take(pickOne(melee));
    take(pickOne(ranged));
    take(pickOne(movement));
    take(pickOne(utility));

    // Fill to 5 with weighted picks from remaining.
    while (picked.length < 5) {
        const remaining = pool.filter(([k]) => !picked.find(e => e[0] === k));
        if (!remaining.length) break;
        take(pickOne(remaining));
    }

    const set = {};
    for (const [key, power] of picked) {
        set[key] = { key, charges: power.charges ?? null };
    }
    return set;
};
