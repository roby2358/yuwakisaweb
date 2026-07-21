(function () {
    const canvas = document.getElementById('field-canvas');

    const controls = {
        width: document.getElementById('ctl-width'),
        height: document.getElementById('ctl-height'),
        spacing: document.getElementById('ctl-spacing'),
        lineLength: document.getElementById('ctl-line-length'),
        lineThickness: document.getElementById('ctl-line-thickness'),
        noiseScale: document.getElementById('ctl-noise-scale'),
        octaves: document.getElementById('ctl-octaves'),
        lacunarity: document.getElementById('ctl-lacunarity'),
        gain: document.getElementById('ctl-gain'),
        seed: document.getElementById('ctl-seed'),
        mode: document.getElementById('ctl-mode'),
        colorMode: document.getElementById('ctl-color-mode'),
        exportScale: document.getElementById('ctl-export-scale'),
    };

    const BACKGROUND_COLOR = '#33291d';
    const LINE_COLOR = '#f4f1ea';

    function readParams() {
        return {
            width: parseInt(controls.width.value, 10),
            height: parseInt(controls.height.value, 10),
            spacing: parseFloat(controls.spacing.value),
            lineLength: parseFloat(controls.lineLength.value),
            lineThickness: parseFloat(controls.lineThickness.value),
            noiseScale: parseFloat(controls.noiseScale.value),
            octaves: parseInt(controls.octaves.value, 10),
            lacunarity: parseFloat(controls.lacunarity.value),
            gain: parseFloat(controls.gain.value),
            seed: parseInt(controls.seed.value, 10),
            mode: controls.mode.value,
            colorMode: controls.colorMode.value,
            backgroundColor: BACKGROUND_COLOR,
            lineColor: LINE_COLOR,
        };
    }

    // Scale every pixel-space knob so the export reproduces the same field
    // at higher resolution instead of upscaling pixels. noiseScale divides
    // because noise coordinates are pixels * noiseScale — the field pattern
    // must stay identical while the pixels multiply.
    function scaleParams(params, scale) {
        return Object.assign({}, params, {
            width: Math.round(params.width * scale),
            height: Math.round(params.height * scale),
            spacing: params.spacing * scale,
            lineLength: params.lineLength * scale,
            lineThickness: params.lineThickness * scale,
            noiseScale: params.noiseScale / scale,
        });
    }

    // Shared by on-screen drawing and PNG export: size the canvas, generate
    // the field, paint it.
    function renderToCanvas(target, params) {
        target.width = params.width;
        target.height = params.height;
        renderField(target.getContext('2d'), generateField(params), params);
    }

    function draw() {
        renderToCanvas(canvas, readParams());
    }

    function exportPNG() {
        const params = readParams();
        const scale = parseFloat(controls.exportScale.value);

        const offscreen = document.createElement('canvas');
        renderToCanvas(offscreen, scaleParams(params, scale));

        const link = document.createElement('a');
        link.download = `flow-field-seed${params.seed}.png`;
        link.href = offscreen.toDataURL('image/png');
        link.click();
    }

    function randomizeSeed() {
        controls.seed.value = Math.floor(Math.random() * 1_000_000);
        draw();
    }

    document.getElementById('btn-regenerate').addEventListener('click', draw);
    document.getElementById('btn-randomize').addEventListener('click', randomizeSeed);
    document.getElementById('btn-export').addEventListener('click', exportPNG);

    // Exposed so test/screenshot.js drives the real render/export code
    // instead of duplicating it.
    window.fieldApp = { readParams, scaleParams, renderToCanvas };

    draw();
})();
