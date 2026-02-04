// MIT License

// Copyright (c) 2025

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Cauchy-All-The-Way-Down Heat Map Visualizer
// Generates a 2D heat map where Cauchy distributions control everything

const COLOR_MAP_SIZE = 1024;

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

function sampleGaussian(mean, stdDev, randomFn) {
    let u1 = 0;
    let u2 = 0;
    while (u1 === 0) {
        u1 = randomFn();
    }
    u2 = randomFn();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
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

    sampleGaussian(location, scale) {
        return sampleGaussian(location, scale, () => this.random());
    }

    drawPointCount(location = 15.0, scale = 5.0, minPoints = 3, maxPoints = 50, densityMultiplier = 1.0) {
        const value = this.sampleCauchy(location, scale);
        const baseCount = Math.floor(clipValue(value, minPoints, maxPoints));
        return Math.floor(baseCount * densityMultiplier);
    }

    drawPointPlacement(gridWidth, gridHeight, locationX = null, locationY = null, scale = 0.08) {
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

    generateColorScheme(schemeName) {
        const randomFn = () => this.random();
        const radial = { a: randomFn(), r: randomR(randomFn) };
        
        if (schemeName === 'random') {
            return randomScheme(randomFn);
        }
        
        const generator = SchemeGenerators[schemeName];
        if (!generator) {
            return randomScheme(randomFn);
        }
        
        return generator(radial, randomFn);
    }

    getColormapFromScheme(colors) {
        const colorsObj = new Colors(COLOR_MAP_SIZE, colors);
        return (t) => colorsObj.apply(t);
    }

    setPixel(imageData, x, y, r, g, b) {
        const index = (y * this.width + x) * 4;
        imageData.data[index] = Math.floor(r * 255);
        imageData.data[index + 1] = Math.floor(g * 255);
        imageData.data[index + 2] = Math.floor(b * 255);
        imageData.data[index + 3] = 255;
    }

    clampFieldToZero(field) {
        return field.map(row => row.map(val => Math.max(0, val)));
    }

    render(field, schemeName = 'monochromatic', schemeColors = null) {
        const clampedField = this.clampFieldToZero(field);
        const { normalized } = this.normalizeField(clampedField);
        
        let colormap;
        if (schemeColors && schemeColors.length > 0) {
            colormap = this.getColormapFromScheme(schemeColors);
        } else {
            const colors = this.generateColorScheme(schemeName);
            colormap = this.getColormapFromScheme(colors);
        }
        
        const imageData = this.ctx.createImageData(this.width, this.height);

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const t = normalized[y][x];
                const color = colormap(t);
                this.setPixel(imageData, x, y, color.r, color.g, color.b);
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    generate(seed = null, schemeName = 'monochromatic', densityMultiplier = 1.0, allowNegative = false) {
        this.setSeed(seed);

        const pointCount = this.drawPointCount(15.0, 5.0, 3, 50, densityMultiplier);
        const sources = this.generateHeatSources(pointCount, allowNegative);
        const field = this.calculateHeatField(sources);
        const colors = this.generateColorScheme(schemeName);
        this.render(field, schemeName, colors);

        return {
            sources: sources,
            field: field,
            pointCount: pointCount,
            colors: colors
        };
    }

    renderField(field, schemeName = 'monochromatic', colors = null) {
        this.render(field, schemeName, colors);
    }
}

// Main application
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('visualization-container');
    const canvas = document.getElementById('heatmap-canvas');
    const generateBtn = document.getElementById('generate-btn');
    const schemeSelect = document.getElementById('scheme-select');
    const seedInput = document.getElementById('seed-input');
    const densitySlider = document.getElementById('density-slider');
    const densityValue = document.getElementById('density-value');
    const positiveNegativeCheckbox = document.getElementById('positive-negative-checkbox');
    const gradientColorsEl = document.getElementById('gradient-colors');
    const copyColorsBtn = document.getElementById('copy-colors-btn');

    function rgbToHex(r, g, b) {
        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }

    function updateGradientPanel(colors) {
        if (!colors || colors.length === 0) {
            gradientColorsEl.innerHTML = '';
            return;
        }

        gradientColorsEl.innerHTML = colors.map(([r, g, b]) => {
            const hex = rgbToHex(r, g, b);
            return `<span class="color-swatch">
                <span class="color-swatch-box" style="background-color: ${hex}"></span>
                <span class="color-swatch-hex">${hex}</span>
            </span>`;
        }).join('');
    }

    function copyColorsToClipboard() {
        if (!currentColors || currentColors.length === 0) return;

        const hexCodes = currentColors.map(([r, g, b]) => rgbToHex(r, g, b)).join(' ');
        navigator.clipboard.writeText(hexCodes).then(() => {
            copyColorsBtn.textContent = 'Copied!';
            copyColorsBtn.classList.add('copied');
            setTimeout(() => {
                copyColorsBtn.textContent = 'Copy';
                copyColorsBtn.classList.remove('copied');
            }, 1500);
        });
    }

    copyColorsBtn.addEventListener('click', copyColorsToClipboard);

    function getCanvasSize() {
        const containerRect = container.getBoundingClientRect();
        const size = Math.floor(Math.min(containerRect.width, containerRect.height));
        return { width: size, height: size };
    }

    function initializeHeatmap() {
        const { width, height } = getCanvasSize();
        return new CauchyHeatMap(canvas, width, height);
    }

    let heatmap = initializeHeatmap();
    let currentField = null;
    let currentSources = null;
    let currentColors = null;
    let currentScheme = null;

    function getInputSeed() {
        return parseSeed(seedInput.value);
    }

    function logGenerationResult(result) {
        console.log(`Generated ${result.pointCount} heat sources`);
        const flatField = result.field.flat();
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < flatField.length; i++) {
            const value = flatField[i];
            if (value < min) min = value;
            if (value > max) max = value;
        }
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
            currentSources = null;
            currentColors = null;
            currentScheme = null;
        }

        const seed = getInputSeed();
        const scheme = schemeSelect.value;
        const density = getDensityMultiplier();
        const allowNegative = getAllowNegative();
        
        console.log('Generating heat map...');
        const result = heatmap.generate(seed, scheme, density, allowNegative);
        currentField = result.field;
        currentSources = result.sources;
        currentColors = result.colors;
        currentScheme = scheme;
        logGenerationResult(result);
        updateGradientPanel(currentColors);
    }

    function redrawWithScheme() {
        if (currentField === null) {
            generate();
            return;
        }

        const { width, height } = getCanvasSize();
        if (heatmap.width !== width || heatmap.height !== height) {
            generate();
            return;
        }

        const scheme = schemeSelect.value;
        const colors = heatmap.generateColorScheme(scheme);
        currentColors = colors;
        currentScheme = scheme;
        heatmap.renderField(currentField, scheme, colors);
        updateGradientPanel(currentColors);
    }

    function getCanvasCoordinates(event) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        return { x, y };
    }

    function moveRandomSourceToClick(clickX, clickY) {
        if (!currentSources || currentSources.length === 0) {
            return;
        }

        const randomIndex = Math.floor(Math.random() * currentSources.length);
        currentSources[randomIndex].x = clickX;
        currentSources[randomIndex].y = clickY;

        const field = heatmap.calculateHeatField(currentSources);
        currentField = field;
        console.log('Using saved colors:', currentColors);
        console.log('Using saved scheme:', currentScheme);
        heatmap.render(field, currentScheme, currentColors);

        console.log(`Moved source ${randomIndex} to (${clickX.toFixed(2)}, ${clickY.toFixed(2)})`);
    }

    canvas.addEventListener('click', (event) => {
        const coords = getCanvasCoordinates(event);
        moveRandomSourceToClick(coords.x, coords.y);
    });

    generateBtn.addEventListener('click', generate);
    schemeSelect.addEventListener('change', redrawWithScheme);
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
