// Random Number Utilities

/**
 * Rando - A collection of random number generation utilities.
 * All methods are static for easy use without instantiation.
 */
export class Rando {
    /**
     * Fisher-Yates shuffle - mutates array in place.
     * @param {Array} array - Array to shuffle
     * @returns {Array} The same array, shuffled
     */
    static shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Pick a random element from an array.
     * @param {Array} array
     * @returns {*} Random element, or null if empty
     */
    static choice(array) {
        if (array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Random integer in range [min, max] (inclusive).
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static int(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    /**
     * Gaussian random using Box-Muller transform (mean=0, stddev=1).
     * @returns {number}
     */
    static gaussian() {
        const u1 = Math.random();
        const u2 = Math.random();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    /**
     * Random float in range [min, max).
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static float(min, max) {
        return min + Math.random() * (max - min);
    }

    /**
     * Random boolean with optional probability of true.
     * @param {number} probability - Chance of returning true (0-1), default 0.5
     * @returns {boolean}
     */
    static bool(probability) {
        return Math.random() < probability;
    }

    /**
     * Weighted random selection from an array of { item, weight } objects.
     * @param {Array<{item: *, weight: number}>} weighted - Array of items with weights
     * @returns {*} Selected item, or null if empty
     */
    static weighted(weighted) {
        if (weighted.length === 0) return null;

        const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
        let roll = Math.random() * totalWeight;

        for (const { item, weight } of weighted) {
            roll -= weight;
            if (roll <= 0) return item;
        }

        return weighted[weighted.length - 1].item;
    }
}
