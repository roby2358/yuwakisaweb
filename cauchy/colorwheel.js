// ColorWheel - Port from Scala
// Handles color conversions and color wheel operations

function mod1(a) {
    if (a < 0.0) return a + 1.0;
    if (a > 1.0) return a - 1.0;
    return a;
}

function sqr(x) {
    return x * x;
}

function hslToRgb(h, s, l) {
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

function rgbToHsl(r, g, b) {
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

    return [mod1(h / 6), s, l];
}

function pixToRGBLuminosity(radial) {
    return hslToRgb(radial.a, 1, sqr(1 - radial.r));
}

function pixToRGBSaturation(radial) {
    return hslToRgb(radial.a, radial.r, 0.5);
}
