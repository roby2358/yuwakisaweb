// Random Number Utilities

export class Rando {
    // Seeded PRNG (mulberry32)
    static seeded(seed) {
        let s = seed | 0;
        return () => {
            s = s + 0x6D2B79F5 | 0;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    static shuffle(array, rng = Math.random) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    static choice(array, rng = Math.random) {
        if (array.length === 0) return null;
        return array[Math.floor(rng() * array.length)];
    }

    static int(min, max, rng = Math.random) {
        return min + Math.floor(rng() * (max - min + 1));
    }

    static float(min, max, rng = Math.random) {
        return min + rng() * (max - min);
    }

    static bool(probability = 0.5, rng = Math.random) {
        return rng() < probability;
    }

    static weighted(weighted, rng = Math.random) {
        if (weighted.length === 0) return null;
        const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
        let roll = rng() * totalWeight;
        for (const { item, weight } of weighted) {
            roll -= weight;
            if (roll <= 0) return item;
        }
        return weighted[weighted.length - 1].item;
    }
}
