// CauchyHeatMap - Sampling engine: seeded RNG and Cauchy-driven source generation

class CauchyHeatMap {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.map = new CauchyMap(width, height);
        this.rng = null;
    }

    static clipValue(value, minVal, maxVal) {
        return Math.max(minVal, Math.min(maxVal, value));
    }

    static createSeededRandom(seed) {
        let value = seed;
        return () => {
            value = (value * 9301 + 49297) % 233280;
            return value / 233280;
        };
    }

    setSeed(seed) {
        if (seed === null || seed === undefined || seed === '') {
            this.rng = null;
        } else {
            this.rng = CauchyHeatMap.createSeededRandom(seed);
        }
    }

    random() {
        if (this.rng) {
            return this.rng();
        }
        return Math.random();
    }

    sampleCauchy(location, scale) {
        const u = this.random() - 0.5;
        return location + scale * Math.tan(Math.PI * u);
    }

    drawPointCount(location, scale, minPoints, maxPoints, densityMultiplier) {
        const value = this.sampleCauchy(location, scale);
        const baseCount = Math.floor(CauchyHeatMap.clipValue(value, minPoints, maxPoints));
        return Math.floor(baseCount * densityMultiplier);
    }

    drawPointPlacement(locationX, locationY, scale) {
        const x = this.sampleCauchy(locationX, scale * this.width);
        const y = this.sampleCauchy(locationY, scale * this.height);

        return {
            x: CauchyHeatMap.clipValue(x, 0, this.width - 1),
            y: CauchyHeatMap.clipValue(y, 0, this.height - 1)
        };
    }

    drawHeatIntensity(location, scale, minStrength, maxStrength) {
        const value = this.sampleCauchy(location, scale);
        return CauchyHeatMap.clipValue(value, minStrength, maxStrength);
    }

    drawScaleParameter(location, scale, minScale, maxScale) {
        const value = this.sampleCauchy(location, scale);
        return CauchyHeatMap.clipValue(value, minScale, maxScale);
    }

    generateHeatSources(pointCount, allowNegative) {
        const sources = [];
        const signs = [];

        if (allowNegative) {
            for (let i = 0; i < pointCount; i++) {
                signs.push(i < pointCount / 2 ? 1 : -1);
            }
            for (let i = signs.length - 1; i > 0; i--) {
                const j = Math.floor(this.random() * (i + 1));
                [signs[i], signs[j]] = [signs[j], signs[i]];
            }
        }

        const centerX = this.width / 2.0;
        const centerY = this.height / 2.0;

        for (let i = 0; i < pointCount; i++) {
            const pos = this.drawPointPlacement(centerX, centerY, 0.08);
            let strength = this.drawHeatIntensity(1.0, 0.5, 0.1, 10000.0);
            if (allowNegative) {
                strength *= signs[i];
            }
            const scale = this.drawScaleParameter(20.0, 10.0, 5.0, 50.0);
            sources.push({
                x: pos.x,
                y: pos.y,
                strength: strength,
                scale: scale
            });
        }
        return sources;
    }

    generate(seed, densityMultiplier, allowNegative) {
        this.setSeed(seed);

        const pointCount = this.drawPointCount(15.0, 5.0, 3, 50, densityMultiplier);
        const sources = this.generateHeatSources(pointCount, allowNegative);
        const field = this.map.calculateHeatField(sources);

        return {
            sources: sources,
            field: field,
            pointCount: pointCount
        };
    }
}
