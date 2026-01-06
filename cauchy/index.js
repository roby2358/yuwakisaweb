// Cauchy-All-The-Way-Down Heat Map Visualizer
// Generates a 2D heat map where Cauchy distributions control everything

// Utility functions
function clipValue(value, minVal, maxVal) {
    return Math.max(minVal, Math.min(maxVal, value));
}

function clampColorComponent(value) {
    return Math.max(0, Math.min(1, value));
}

function clampRgb(r, g, b) {
    return {
        r: clampColorComponent(r),
        g: clampColorComponent(g),
        b: clampColorComponent(b)
    };
}

function createSeededRandom(seed) {
    let value = seed;
    return () => {
        value = (value * 9301 + 49297) % 233280;
        return value / 233280;
    };
}

function sampleCauchy(location, scale, randomFn) {
    const u = randomFn() - 0.5;
    return location + scale * Math.tan(Math.PI * u);
}

function calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function findFieldMinMax(field) {
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

function parseSeed(seedValue) {
    if (seedValue === '' || seedValue === null || seedValue === undefined) {
        return null;
    }
    return parseInt(seedValue);
}

class CauchyHeatMap {
    constructor(canvas, width = 500, height = 500) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        this.rng = null;
    }

    setSeed(seed) {
        if (seed === null || seed === undefined || seed === '') {
            this.rng = null;
        } else {
            this.rng = createSeededRandom(seed);
        }
    }

    random() {
        if (this.rng) {
            return this.rng();
        }
        return Math.random();
    }

    sampleCauchy(location, scale) {
        return sampleCauchy(location, scale, () => this.random());
    }

    drawPointCount(location = 15.0, scale = 5.0, minPoints = 3, maxPoints = 50, densityMultiplier = 1.0) {
        const value = this.sampleCauchy(location, scale);
        const baseCount = Math.floor(clipValue(value, minPoints, maxPoints));
        return Math.floor(baseCount * densityMultiplier);
    }

    drawPointPlacement(gridWidth, gridHeight, locationX = null, locationY = null, scale = 0.3) {
        if (locationX === null) locationX = gridWidth / 2.0;
        if (locationY === null) locationY = gridHeight / 2.0;

        const x = this.sampleCauchy(locationX, scale * gridWidth);
        const y = this.sampleCauchy(locationY, scale * gridHeight);

        return {
            x: clipValue(x, 0, gridWidth - 1),
            y: clipValue(y, 0, gridHeight - 1)
        };
    }

    drawHeatIntensity(location = 1.0, scale = 0.5, minStrength = 0.1, maxStrength = 10000.0) {
        const value = this.sampleCauchy(location, scale);
        return clipValue(value, minStrength, maxStrength);
    }

    drawScaleParameter(location = 20.0, scale = 10.0, minScale = 5.0, maxScale = 50.0) {
        const value = this.sampleCauchy(location, scale);
        return clipValue(value, minScale, maxScale);
    }

    cauchyPdfContribution(distance, strength, scale) {
        if (scale <= 0) return 0.0;
        return strength / (1.0 + Math.pow(distance / scale, 2));
    }

    generateHeatSources(pointCount, allowNegative = false) {
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
        
        for (let i = 0; i < pointCount; i++) {
            const pos = this.drawPointPlacement(this.width, this.height);
            let strength = this.drawHeatIntensity();
            if (allowNegative) {
                strength *= signs[i];
            }
            const scale = this.drawScaleParameter();
            sources.push({
                x: pos.x,
                y: pos.y,
                strength: strength,
                scale: scale
            });
        }
        return sources;
    }

    calculateHeatField(sources) {
        const field = new Array(this.height);
        for (let y = 0; y < this.height; y++) {
            field[y] = new Array(this.width);
            for (let x = 0; x < this.width; x++) {
                let value = 0.0;
                for (const source of sources) {
                    const distance = calculateDistance(x, y, source.x, source.y);
                    value += this.cauchyPdfContribution(distance, source.strength, source.scale);
                }
                field[y][x] = value;
            }
        }
        return field;
    }

    normalizeField(field) {
        const { min, max } = findFieldMinMax(field);
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

    getColormap(name) {
        const colormaps = {
            viridis: (t) => {
                const r = t < 0.5 
                    ? 0.267 + 0.005 * (t * 2)
                    : 0.272 + 0.728 * ((t - 0.5) * 2);
                const g = t < 0.5
                    ? 0.005 + 0.995 * (t * 2)
                    : 1.0;
                const b = t < 0.5
                    ? 0.329 + 0.671 * (t * 2)
                    : 1.0 - 1.0 * ((t - 0.5) * 2);
                return clampRgb(r, g, b);
            },
            plasma: (t) => {
                const r = t < 0.5
                    ? 0.941 + 0.059 * (t * 2)
                    : 1.0;
                const g = t < 0.5
                    ? 0.0 + 0.859 * (t * 2)
                    : 0.859 + 0.141 * ((t - 0.5) * 2);
                const b = t < 0.5
                    ? 0.502 + 0.498 * (t * 2)
                    : 1.0 - 0.5 * ((t - 0.5) * 2);
                return clampRgb(r, g, b);
            },
            inferno: (t) => {
                const r = Math.min(1, t * 1.2);
                const g = t < 0.5 ? 0.0 : Math.min(1, (t - 0.5) * 2);
                const b = t < 0.5 ? 0.0 : Math.min(1, (t - 0.5) * 1.5);
                return clampRgb(r, g, b);
            },
            magma: (t) => {
                const r = Math.min(1, t * 1.1);
                const g = t < 0.5 ? 0.0 : Math.min(1, (t - 0.5) * 1.8);
                const b = t < 0.5 ? 0.0 : Math.min(1, (t - 0.5) * 1.2);
                return clampRgb(r, g, b);
            },
            turbo: (t) => {
                const r = t < 0.25
                    ? 0.0
                    : t < 0.5
                        ? (t - 0.25) * 4
                        : t < 0.75
                            ? 1.0
                            : 1.0 - (t - 0.75) * 4;
                const g = t < 0.25
                    ? (t * 4)
                    : t < 0.75
                        ? 1.0
                        : 1.0 - (t - 0.75) * 4;
                const b = t < 0.25
                    ? 0.5 + (t * 2)
                    : t < 0.5
                        ? 1.0 - ((t - 0.25) * 2)
                        : t < 0.75
                            ? (t - 0.5) * 4
                            : 1.0;
                return clampRgb(r, g, b);
            }
        };

        return colormaps[name] || colormaps.viridis;
    }

    setPixel(imageData, x, y, r, g, b) {
        const index = (y * this.width + x) * 4;
        imageData.data[index] = Math.floor(r * 255);
        imageData.data[index + 1] = Math.floor(g * 255);
        imageData.data[index + 2] = Math.floor(b * 255);
        imageData.data[index + 3] = 255;
    }

    render(field, colormapName = 'viridis') {
        const { normalized } = this.normalizeField(field);
        const colormap = this.getColormap(colormapName);
        const imageData = this.ctx.createImageData(this.width, this.height);

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const t = Math.max(0, normalized[y][x]);
                const color = colormap(t);
                this.setPixel(imageData, x, y, color.r, color.g, color.b);
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    generate(seed = null, colormapName = 'viridis', densityMultiplier = 1.0, allowNegative = false) {
        this.setSeed(seed);

        const pointCount = this.drawPointCount(15.0, 5.0, 3, 50, densityMultiplier);
        const sources = this.generateHeatSources(pointCount, allowNegative);
        const field = this.calculateHeatField(sources);
        this.render(field, colormapName);

        return {
            sources: sources,
            field: field,
            pointCount: pointCount
        };
    }

    renderField(field, colormapName = 'viridis') {
        this.render(field, colormapName);
    }
}

// Main application
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('visualization-container');
    const canvas = document.getElementById('heatmap-canvas');
    const generateBtn = document.getElementById('generate-btn');
    const colormapSelect = document.getElementById('colormap-select');
    const seedInput = document.getElementById('seed-input');
    const densitySlider = document.getElementById('density-slider');
    const densityValue = document.getElementById('density-value');
    const positiveNegativeCheckbox = document.getElementById('positive-negative-checkbox');

    function getCanvasSize() {
        const containerRect = container.getBoundingClientRect();
        const width = Math.floor(containerRect.width);
        const height = Math.floor(containerRect.height);
        return { width, height };
    }

    function initializeHeatmap() {
        const { width, height } = getCanvasSize();
        return new CauchyHeatMap(canvas, width, height);
    }

    let heatmap = initializeHeatmap();
    let currentField = null;

    function getInputSeed() {
        return parseSeed(seedInput.value);
    }

    function logGenerationResult(result) {
        console.log(`Generated ${result.pointCount} heat sources`);
        const flatField = result.field.flat();
        const min = Math.min(...flatField);
        const max = Math.max(...flatField);
        console.log(`Field range: [${min.toFixed(4)}, ${max.toFixed(4)}]`);
    }

    function getDensityMultiplier() {
        return parseFloat(densitySlider.value);
    }

    function updateDensityDisplay() {
        densityValue.textContent = `${getDensityMultiplier()}x`;
    }

    function getAllowNegative() {
        return positiveNegativeCheckbox.checked;
    }

    function generate() {
        const { width, height } = getCanvasSize();
        if (heatmap.width !== width || heatmap.height !== height) {
            heatmap = new CauchyHeatMap(canvas, width, height);
            currentField = null;
        }

        const seed = getInputSeed();
        const colormap = colormapSelect.value;
        const density = getDensityMultiplier();
        const allowNegative = getAllowNegative();
        
        console.log('Generating heat map...');
        const result = heatmap.generate(seed, colormap, density, allowNegative);
        currentField = result.field;
        logGenerationResult(result);
    }

    function redrawWithColormap() {
        if (currentField === null) {
            generate();
            return;
        }

        const { width, height } = getCanvasSize();
        if (heatmap.width !== width || heatmap.height !== height) {
            generate();
            return;
        }

        const colormap = colormapSelect.value;
        heatmap.renderField(currentField, colormap);
    }

    generateBtn.addEventListener('click', generate);
    colormapSelect.addEventListener('change', redrawWithColormap);
    densitySlider.addEventListener('input', () => {
        updateDensityDisplay();
        generate();
    });
    positiveNegativeCheckbox.addEventListener('change', generate);

    window.addEventListener('resize', () => {
        generate();
    });

    updateDensityDisplay();
    generate();
});
