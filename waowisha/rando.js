// Random Number Utilities

export class Rando {
    // Seeded PRNG (mulberry32)
    static seeded(seed) {
        let s = seed | 0;
        const rng = () => {
            s = s + 0x6D2B79F5 | 0;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
        rng.getState = () => s;
        rng.setState = (v) => { s = v; };
        return rng;
    }

    static shuffle(array, rng) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    static choice(array, rng) {
        return array[Math.floor(rng() * array.length)];
    }

    static int(min, max, rng) {
        return min + Math.floor(rng() * (max - min + 1));
    }

    static bool(probability, rng) {
        return rng() < probability;
    }
}
