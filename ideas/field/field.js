// Turns a scalar noise function into a per-point orientation angle. Kept
// separate from noise.js (the generator) and render.js (the drawing) so any
// of the three can be swapped independently.

// Local gradient of the noise via central differences — shared by the
// gradient and curl samplers.
function gradientAt(noiseFn, x, y, eps) {
    const gx = (noiseFn(x + eps, y) - noiseFn(x - eps, y)) / (2 * eps);
    const gy = (noiseFn(x, y + eps) - noiseFn(x, y - eps)) / (2 * eps);
    return { gx, gy };
}

// Dispatch table: field mode -> angle sampler. Adding a new field mode is
// one entry here plus an <option> in index.html.
const ANGLE_SAMPLERS = {
    angle(noiseFn, x, y, eps) {
        return noiseFn(x, y) * Math.PI * 2;
    },
    gradient(noiseFn, x, y, eps) {
        const { gx, gy } = gradientAt(noiseFn, x, y, eps);
        return Math.atan2(gy, gx);
    },
    // curl: rotate the gradient of a scalar potential 90° to get a
    // divergence-free (swirling, incompressible-looking) vector field.
    curl(noiseFn, x, y, eps) {
        const { gx, gy } = gradientAt(noiseFn, x, y, eps);
        return Math.atan2(gx, -gy);
    },
};

// Builds the grid of { x, y, angle, magnitude } points that render.js draws.
// `params` is the single source of truth for every adjustable knob.
function generateField(params) {
    const noise = new PerlinNoise(params.seed);
    const noiseFn = (x, y) => noise.fbm(x, y, params.octaves, params.lacunarity, params.gain);
    const sampleAngle = ANGLE_SAMPLERS[params.mode];

    const cols = Math.floor(params.width / params.spacing);
    const rows = Math.floor(params.height / params.spacing);
    const eps = params.noiseScale * 0.5;

    const points = [];
    for (let j = 0; j <= rows; j++) {
        const py = j * params.spacing + params.spacing / 2;
        if (py > params.height) continue;
        for (let i = 0; i <= cols; i++) {
            const px = i * params.spacing + params.spacing / 2;
            if (px > params.width) continue;

            const nx = px * params.noiseScale;
            const ny = py * params.noiseScale;

            points.push({
                x: px,
                y: py,
                angle: sampleAngle(noiseFn, nx, ny, eps),
                magnitude: noiseFn(nx, ny),
            });
        }
    }
    return points;
}
