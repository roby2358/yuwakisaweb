// Random Number Utilities

export class Rando {
    static shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    static choice(array) {
        if (array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    }

    static int(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    static gaussian() {
        const u1 = Math.random();
        const u2 = Math.random();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    static float(min, max) {
        return min + Math.random() * (max - min);
    }

    static bool(probability = 0.5) {
        return Math.random() < probability;
    }

    static bellCurve(strength) {
        const cap = strength * 2;
        const roll = Rando.int(1, cap) + Rando.int(1, cap) + Rando.int(1, cap);
        return Math.round(roll / 3);
    }

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
