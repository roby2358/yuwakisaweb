// Seeded PRNG (mulberry32) — deterministic given the same integer seed.
function createRNG(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Classic Perlin noise in 2D, with a seeded permutation table so the same
// seed always produces the same field.
class PerlinNoise {
    constructor(seed) {
        const rng = createRNG(seed);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
        }
        this.perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }

    static fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    static lerp(a, b, t) { return a + t * (b - a); }

    static grad(hash, x, y) {
        const g = PerlinNoise.GRADIENTS[hash & 7];
        return g[0] * x + g[1] * y;
    }

    // Raw Perlin noise, range approximately [-1, 1].
    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const u = PerlinNoise.fade(xf);
        const v = PerlinNoise.fade(yf);
        const perm = this.perm;
        const aa = perm[perm[X] + Y];
        const ab = perm[perm[X] + Y + 1];
        const ba = perm[perm[X + 1] + Y];
        const bb = perm[perm[X + 1] + Y + 1];
        const x1 = PerlinNoise.lerp(
            PerlinNoise.grad(aa, xf, yf),
            PerlinNoise.grad(ba, xf - 1, yf),
            u
        );
        const x2 = PerlinNoise.lerp(
            PerlinNoise.grad(ab, xf, yf - 1),
            PerlinNoise.grad(bb, xf - 1, yf - 1),
            u
        );
        return PerlinNoise.lerp(x1, x2, v);
    }

    // Fractal Brownian motion: sum of octaves at increasing frequency and
    // decreasing amplitude. Normalized back to roughly [-1, 1].
    fbm(x, y, octaves, lacunarity, gain) {
        let total = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= gain;
            frequency *= lacunarity;
        }
        return total / maxValue;
    }
}

PerlinNoise.GRADIENTS = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1]
];
