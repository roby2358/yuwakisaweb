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
        ballAccel: document.getElementById('ctl-ball-accel'),
    };

    const BACKGROUND_COLOR = '#33291d';
    const LINE_COLOR = '#f4f1ea';
    const BALL_RADIUS = 6;
    const BALL_DRAG = 0.6; // per-second linear drag; keeps speed from growing unbounded
    const BALL_JITTER = 30; // per-axis random accel magnitude; slight Brownian-like wobble
    const MAX_DT = 1 / 20; // clamp large gaps (e.g. backgrounded tab)
    const HIGHLIGHT_RADIUS_RATIO = 0.55;
    const HIGHLIGHT_OFFSET_RATIO = 0.35;
    const HIGHLIGHT_LIGHTEN = 0.6; // fraction of the way toward white

    // Live view state: the field the balls fly over, plus the balls
    // themselves. Rebuilt by draw(); balls persist across it.
    let fieldParams = null;
    let fieldSampler = null;
    let fieldPoints = null;
    let palette = [LINE_COLOR];
    let balls = [];
    let animating = false;
    let lastTimestamp = null;

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

    // One-off render used for PNG export: size a fresh canvas, generate its
    // own field at the given (possibly scaled) params, paint it. No balls —
    // export is the static artwork, not the live toy.
    function renderToCanvas(target, params) {
        target.width = params.width;
        target.height = params.height;
        const sampler = createFieldSampler(params);
        renderField(target.getContext('2d'), generateField(sampler, params), params);
    }

    // Mixes a #rrggbb color toward white by `amount` (0-1), for a highlight
    // tint that reads as a light source rather than a flat recolor.
    function lightenHex(hex, amount) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const mix = (c) => Math.round(c + (255 - c) * amount);
        return ColorTheory.rgbToHex(mix(r) / 255, mix(g) / 255, mix(b) / 255);
    }

    // Paints the cached field grid plus every current ball on top of it. Each
    // ball is drawn as a base circle plus a smaller, lighter circle offset
    // toward the upper-left, suggesting a light source for a faint 3D look.
    // Called every animation frame, so it never recomputes the noise grid.
    function renderFrame() {
        const ctx = canvas.getContext('2d');
        renderField(ctx, fieldPoints, fieldParams);
        for (const ball of balls) {
            ctx.beginPath();
            ctx.fillStyle = ball.color;
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();

            const offset = ball.radius * HIGHLIGHT_OFFSET_RATIO;
            ctx.beginPath();
            ctx.fillStyle = lightenHex(ball.color, HIGHLIGHT_LIGHTEN);
            ctx.arc(ball.x - offset, ball.y - offset, ball.radius * HIGHLIGHT_RADIUS_RATIO, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function randomPaletteHex() {
        return ColorTheory.randomScheme(Math.random).map(([r, g, b]) => ColorTheory.rgbToHex(r, g, b));
    }

    // Regenerates the field (new params, new noise, new palette) and keeps
    // any balls in flight, clamped inside the possibly-resized canvas so
    // they keep reacting to the field live instead of resetting.
    function draw() {
        fieldParams = readParams();
        canvas.width = fieldParams.width;
        canvas.height = fieldParams.height;
        fieldSampler = createFieldSampler(fieldParams);
        fieldPoints = generateField(fieldSampler, fieldParams);
        palette = randomPaletteHex();
        balls = balls.map((ball) => clampBallPosition(ball, fieldParams.width, fieldParams.height));
        renderFrame();
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

    function tick(timestamp) {
        if (balls.length === 0) {
            animating = false;
            lastTimestamp = null;
            return;
        }
        if (lastTimestamp === null) lastTimestamp = timestamp;
        const dt = Math.min((timestamp - lastTimestamp) / 1000, MAX_DT);
        lastTimestamp = timestamp;

        const accel = parseFloat(controls.ballAccel.value);
        balls = balls.map((ball) =>
            stepBall(ball, fieldSampler.angleAt, accel, BALL_DRAG, BALL_JITTER, Math.random, dt, fieldParams.width, fieldParams.height)
        );
        renderFrame();
        requestAnimationFrame(tick);
    }

    function startAnimating() {
        if (animating) return;
        animating = true;
        lastTimestamp = null;
        requestAnimationFrame(tick);
    }

    function dropBall() {
        const radius = BALL_RADIUS;
        const x = radius + Math.random() * (fieldParams.width - 2 * radius);
        const y = radius + Math.random() * (fieldParams.height - 2 * radius);
        const color = palette[Math.floor(Math.random() * palette.length)];
        balls.push(createBall(x, y, color, radius));
        startAnimating();
    }

    function removeAllBalls() {
        balls = [];
        renderFrame();
    }

    document.getElementById('btn-regenerate').addEventListener('click', draw);
    document.getElementById('btn-randomize').addEventListener('click', randomizeSeed);
    document.getElementById('btn-export').addEventListener('click', exportPNG);
    document.getElementById('btn-drop-ball').addEventListener('click', dropBall);
    document.getElementById('btn-remove-all').addEventListener('click', removeAllBalls);

    // Exposed so test/screenshot.js drives the real render/export/ball code
    // instead of duplicating it.
    window.fieldApp = {
        readParams,
        scaleParams,
        renderToCanvas,
        dropBall,
        removeAllBalls,
        getBalls: () => balls,
    };

    draw();
})();
