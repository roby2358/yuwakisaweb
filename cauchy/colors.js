// Colors - Port from Scala
// Color mapping and gradient functions

function gradient(colors) {
    return (v) => {
        const lo = Math.floor(v * colors.length);
        const hi = Math.floor(v * colors.length) + 1;
        const mid = (v * colors.length - lo) / (hi - lo);
        const [lor, log, lob] = colors[Math.min(colors.length - 1, lo)];
        const [hir, hig, hib] = colors[Math.min(colors.length - 1, hi)];
        const r = lor * (1 - mid) + hir * mid;
        const g = log * (1 - mid) + hig * mid;
        const b = lob * (1 - mid) + hib * mid;
        return { r, g, b };
    };
}

function bands(colors) {
    return (v) => {
        const i = Math.min(colors.length - 1, Math.floor(v * colors.length));
        const [r, g, b] = colors[i];
        return { r, g, b };
    };
}

class Colors {
    constructor(n, palette) {
        this.n = n;
        this.palette = palette;
        this.f = gradient(palette);
        this.cache = [];
        for (let i = 0; i <= n; i++) {
            this.cache.push(this.f(i / n));
        }
    }

    apply(v) {
        const index = Math.max(0, Math.min(this.cache.length - 1, Math.floor(v * this.n)));
        return this.cache[index];
    }
}
