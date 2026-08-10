// ColorTheory - Combined color utilities
// Ported from Scala ColorWheel, Schemes, and Colors
//
// Scheme generation:
//   const randomFn = () => Math.random();
//   const colors = ColorTheory.randomScheme(randomFn);                     // random 5-color palette
//   const colors = ColorTheory.SchemeGenerators.triad(radial, randomFn);   // specific scheme
//
// Colormap (cached gradient for fast per-pixel lookup):
//   const colormap = new ColorTheory(1024, colors);
//   const { r, g, b } = colormap.apply(t);   // t in [0, 1]
//
// Conversions:
//   const [r, g, b] = ColorTheory.hslToRgb(h, s, l);
//   const hex = ColorTheory.rgbToHex(r, g, b);

class ColorTheory {
    // --- ColorWheel ---

    static mod1(a) {
        if (a < 0.0) return a + 1.0;
        if (a > 1.0) return a - 1.0;
        return a;
    }

    static sqr(x) {
        return x * x;
    }

    static hslToRgb(h, s, l) {
        const chroma = (1 - Math.abs(2 * l - 1)) * s;
        const hp = h * 6;
        const x = chroma * (1 - Math.abs((hp % 2) - 1));

        let r1, g1, b1;
        const sector = Math.floor(hp);
        switch (sector) {
            case 0:
                [r1, g1, b1] = [chroma, x, 0];
                break;
            case 1:
                [r1, g1, b1] = [x, chroma, 0];
                break;
            case 2:
                [r1, g1, b1] = [0, chroma, x];
                break;
            case 3:
                [r1, g1, b1] = [0, x, chroma];
                break;
            case 4:
                [r1, g1, b1] = [x, 0, chroma];
                break;
            case 5:
                [r1, g1, b1] = [chroma, 0, x];
                break;
            default:
                [r1, g1, b1] = [chroma, 0, x];
        }
        const m = l - chroma / 2;
        return [r1 + m, g1 + m, b1 + m];
    }

    static rgbToHsl(r, g, b) {
        const cmax = Math.max(r, Math.max(g, b));
        const cmin = Math.min(r, Math.min(g, b));
        const d = cmax - cmin;

        const l = (cmax + cmin) / 2;

        const s = (d === 0) ? 0 : d / (1 - Math.abs(2 * l - 1));

        let h;
        if (d === 0) {
            h = 0;
        } else if (cmax === r) {
            h = (g - b) / d;
        } else if (cmax === g) {
            h = (b - r) / d + 2;
        } else {
            h = (r - g) / d + 4;
        }

        return [ColorTheory.mod1(h / 6), s, l];
    }

    static pixToRGBLuminosity(radial) {
        return ColorTheory.hslToRgb(radial.a, 1, ColorTheory.sqr(1 - radial.r));
    }

    static pixToRGBSaturation(radial) {
        return ColorTheory.hslToRgb(radial.a, radial.r, 0.5);
    }

    // --- Schemes ---

    static OneSpoke = 1.0 / 12.0;

    static randomR(randomFn) {
        return 0.8 - randomFn() * 0.8;
    }

    static rgbLuminance(color) {
        const [r, g, b] = color;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    static sortPaletteByLuminance(colors) {
        return [...colors].sort((a, b) => ColorTheory.rgbLuminance(a) - ColorTheory.rgbLuminance(b));
    }

    static monochromatic(radial, randomFn) {
        const radials = [];
        for (let i = 0; i < 5; i++) {
            radials.push(ColorTheory.randomR(randomFn));
        }
        radials.sort((a, b) => a - b);
        const palette = radials.map(r => ColorTheory.pixToRGBLuminosity({ a: radial.a, r: r }));
        return ColorTheory.sortPaletteByLuminance(palette);
    }

    static analogous(radial, randomFn) {
        const palette = [
            { a: radial.a, r: radial.r },
            { a: radial.a, r: ColorTheory.randomR(randomFn) },
            { a: ColorTheory.mod1(radial.a + ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a + ColorTheory.OneSpoke), r: ColorTheory.randomR(randomFn) },
            { a: ColorTheory.mod1(radial.a - ColorTheory.OneSpoke), r: radial.r }
        ].map(rd => ColorTheory.pixToRGBLuminosity(rd));
        return ColorTheory.sortPaletteByLuminance(palette);
    }

    static triad(radial, randomFn) {
        const palette = [
            { a: radial.a, r: radial.r },
            { a: radial.a, r: ColorTheory.randomR(randomFn) },
            { a: ColorTheory.mod1(radial.a + 4 * ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a + 4 * ColorTheory.OneSpoke), r: ColorTheory.randomR(randomFn) },
            { a: ColorTheory.mod1(radial.a - 4 * ColorTheory.OneSpoke), r: radial.r }
        ].map(rd => ColorTheory.pixToRGBLuminosity(rd));
        return ColorTheory.sortPaletteByLuminance(palette);
    }

    static complementary(radial, randomFn) {
        const palette = [
            { a: radial.a, r: radial.r },
            { a: radial.a, r: ColorTheory.mod1(radial.r - 0.1) },
            { a: radial.a, r: ColorTheory.mod1(radial.r + 0.1) },
            { a: ColorTheory.mod1(radial.a + 6 * ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a + 6 * ColorTheory.OneSpoke), r: ColorTheory.randomR(randomFn) }
        ].map(rd => ColorTheory.pixToRGBLuminosity(rd));
        return ColorTheory.sortPaletteByLuminance(palette);
    }

    static splitComplementary(radial, randomFn) {
        const palette = [
            { a: radial.a, r: radial.r },
            { a: ColorTheory.mod1(radial.a + 5 * ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a + 5 * ColorTheory.OneSpoke), r: ColorTheory.randomR(randomFn) },
            { a: ColorTheory.mod1(radial.a - 5 * ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a - 5 * ColorTheory.OneSpoke), r: ColorTheory.randomR(randomFn) }
        ].map(rd => ColorTheory.pixToRGBLuminosity(rd));
        return ColorTheory.sortPaletteByLuminance(palette);
    }

    static doubleSplitComplementary(radial, randomFn) {
        const palette = [
            { a: radial.a, r: radial.r },
            { a: ColorTheory.mod1(radial.a + 1 * ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a - 1 * ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a + 5 * ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a - 5 * ColorTheory.OneSpoke), r: radial.r }
        ].map(rd => ColorTheory.pixToRGBLuminosity(rd));
        return ColorTheory.sortPaletteByLuminance(palette);
    }

    static square(radial, randomFn) {
        const palette = [
            { a: radial.a, r: radial.r },
            { a: radial.a, r: ColorTheory.randomR(randomFn) },
            { a: ColorTheory.mod1(radial.a + 4 * ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a - 4 * ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a + 6 * ColorTheory.OneSpoke), r: radial.r }
        ].map(rd => ColorTheory.pixToRGBLuminosity(rd));
        return ColorTheory.sortPaletteByLuminance(palette);
    }

    static compound(radial, randomFn) {
        const palette = [
            { a: radial.a, r: radial.r },
            { a: ColorTheory.mod1(radial.a - 1 * ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a - 1 * ColorTheory.OneSpoke), r: ColorTheory.randomR(randomFn) },
            { a: ColorTheory.mod1(radial.a - 5 * ColorTheory.OneSpoke), r: radial.r },
            { a: ColorTheory.mod1(radial.a - 5 * ColorTheory.OneSpoke), r: ColorTheory.randomR(randomFn) }
        ].map(rd => ColorTheory.pixToRGBLuminosity(rd));
        return ColorTheory.sortPaletteByLuminance(palette);
    }

    static SchemeGenerators = {
        monochromatic: ColorTheory.monochromatic,
        analogous: ColorTheory.analogous,
        triad: ColorTheory.triad,
        complementary: ColorTheory.complementary,
        splitComplementary: ColorTheory.splitComplementary,
        doubleSplitComplementary: ColorTheory.doubleSplitComplementary,
        square: ColorTheory.square,
        compound: ColorTheory.compound
    };

    static randomScheme(randomFn) {
        const schemes = Object.values(ColorTheory.SchemeGenerators);
        const i = Math.floor(randomFn() * schemes.length);
        const radial = { a: randomFn(), r: ColorTheory.randomR(randomFn) };
        return schemes[i](radial, randomFn);
    }

    // --- Helpers ---

    static rgbToHex(r, g, b) {
        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }

    // --- Colors ---

    static gradient(colors) {
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

    static bands(colors) {
        return (v) => {
            const i = Math.min(colors.length - 1, Math.floor(v * colors.length));
            const [r, g, b] = colors[i];
            return { r, g, b };
        };
    }

    constructor(n, palette) {
        this.n = n;
        this.palette = palette;
        this.f = ColorTheory.gradient(palette);
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
