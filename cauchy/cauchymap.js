// CauchyMap - Pure field math: sources in, heat field out
//
// const map = new CauchyMap(width, height);
// const field = map.calculateHeatField(sources);  // sources: [{x, y, strength, scale}, ...]
// const clamped = map.clampFieldToZero(field);
// const { normalized, min, max } = map.normalizeField(clamped);

class CauchyMap {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }

    static calculateDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static findFieldMinMax(field) {
        let min = Infinity;
        let max = -Infinity;

        for (let y = 0; y < field.length; y++) {
            for (let x = 0; x < field[y].length; x++) {
                const value = field[y][x];
                if (value < min) min = value;
                if (value > max) max = value;
            }
        }

        return { min, max };
    }

    cauchyPdfContribution(distance, strength, scale) {
        if (scale <= 0) return 0.0;
        return strength / (1.0 + Math.pow(distance / scale, 2));
    }

    calculateHeatField(sources) {
        const field = new Array(this.height);
        for (let y = 0; y < this.height; y++) {
            field[y] = new Array(this.width);
            for (let x = 0; x < this.width; x++) {
                let value = 0.0;
                for (const source of sources) {
                    const distance = CauchyMap.calculateDistance(x, y, source.x, source.y);
                    value += this.cauchyPdfContribution(distance, source.strength, source.scale);
                }
                field[y][x] = value;
            }
        }
        return field;
    }

    normalizeField(field) {
        const { min, max } = CauchyMap.findFieldMinMax(field);
        const range = max - min;

        if (range === 0) {
            return { normalized: field, min, max };
        }

        const normalized = new Array(this.height);
        for (let y = 0; y < this.height; y++) {
            normalized[y] = new Array(this.width);
            for (let x = 0; x < this.width; x++) {
                normalized[y][x] = (field[y][x] - min) / range;
            }
        }

        return { normalized, min, max };
    }

    clampFieldToZero(field) {
        return field.map(row => row.map(val => Math.max(0, val)));
    }
}
