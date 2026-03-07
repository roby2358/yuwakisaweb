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
// Presentation layer: canvas rendering, color schemes, DOM wiring

const COLOR_MAP_SIZE = 1024;

function parseSeed(seedValue) {
    if (seedValue === '' || seedValue === null || seedValue === undefined) {
        return null;
    }
    return parseInt(seedValue);
}

// Main application
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('visualization-container');
    const canvas = document.getElementById('heatmap-canvas');
    const ctx = canvas.getContext('2d');
    const generateBtn = document.getElementById('generate-btn');
    const schemeSelect = document.getElementById('scheme-select');
    const seedInput = document.getElementById('seed-input');
    const densitySlider = document.getElementById('density-slider');
    const densityValue = document.getElementById('density-value');
    const positiveNegativeCheckbox = document.getElementById('positive-negative-checkbox');
    const gradientColorsEl = document.getElementById('gradient-colors');
    const copyColorsBtn = document.getElementById('copy-colors-btn');

    function updateGradientPanel(colors) {
        if (!colors || colors.length === 0) {
            gradientColorsEl.innerHTML = '';
            return;
        }

        gradientColorsEl.innerHTML = colors.map(([r, g, b]) => {
            const hex = ColorTheory.rgbToHex(r, g, b);
            return `<span class="color-swatch">
                <span class="color-swatch-box" style="background-color: ${hex}"></span>
                <span class="color-swatch-hex">${hex}</span>
            </span>`;
        }).join('');
    }

    function copyColorsToClipboard() {
        if (!currentColors || currentColors.length === 0) return;

        const hexCodes = currentColors.map(([r, g, b]) => ColorTheory.rgbToHex(r, g, b)).join(' ');
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

    function generateColorScheme(schemeName) {
        const randomFn = () => Math.random();
        const radial = { a: randomFn(), r: ColorTheory.randomR(randomFn) };

        if (schemeName === 'random') {
            return ColorTheory.randomScheme(randomFn);
        }

        const generator = ColorTheory.SchemeGenerators[schemeName];
        if (!generator) {
            return ColorTheory.randomScheme(randomFn);
        }

        return generator(radial, randomFn);
    }

    function getColormapFromScheme(colors) {
        const colorsObj = new ColorTheory(COLOR_MAP_SIZE, colors);
        return (t) => colorsObj.apply(t);
    }

    function renderField(field, schemeColors) {
        const width = heatmap.width;
        const height = heatmap.height;
        const clamped = heatmap.map.clampFieldToZero(field);
        const { normalized } = heatmap.map.normalizeField(clamped);
        const colormap = getColormapFromScheme(schemeColors);

        const imageData = ctx.createImageData(width, height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const t = normalized[y][x];
                const color = colormap(t);
                const index = (y * width + x) * 4;
                imageData.data[index] = Math.floor(color.r * 255);
                imageData.data[index + 1] = Math.floor(color.g * 255);
                imageData.data[index + 2] = Math.floor(color.b * 255);
                imageData.data[index + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    function initializeHeatmap() {
        const { width, height } = getCanvasSize();
        canvas.width = width;
        canvas.height = height;
        return new CauchyHeatMap(width, height);
    }

    let heatmap = initializeHeatmap();
    let currentField = null;
    let currentSources = null;
    let currentColors = null;

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
            canvas.width = width;
            canvas.height = height;
            heatmap = new CauchyHeatMap(width, height);
            currentField = null;
            currentSources = null;
            currentColors = null;
        }

        const seed = getInputSeed();
        const scheme = schemeSelect.value;
        const density = getDensityMultiplier();
        const allowNegative = getAllowNegative();

        console.log('Generating heat map...');
        const result = heatmap.generate(seed, density, allowNegative);
        currentField = result.field;
        currentSources = result.sources;
        currentColors = generateColorScheme(scheme);
        renderField(currentField, currentColors);
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
        currentColors = generateColorScheme(scheme);
        renderField(currentField, currentColors);
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

        currentField = heatmap.map.calculateHeatField(currentSources);
        renderField(currentField, currentColors);

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
