// Schemes - Port from Scala
// Color scheme generation functions

const OneSpoke = 1.0 / 12.0;

function randomR(randomFn) {
    return 0.8 - randomFn() * 0.8;
}

function rgbLuminance(color) {
    const [r, g, b] = color;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function sortPaletteByLuminance(colors) {
    return [...colors].sort((a, b) => rgbLuminance(a) - rgbLuminance(b));
}

function monochromatic(radial, randomFn) {
    const radials = [];
    for (let i = 0; i < 5; i++) {
        radials.push(randomR(randomFn));
    }
    radials.sort((a, b) => a - b);
    const palette = radials.map(r => pixToRGBLuminosity({ a: radial.a, r: r }));
    return sortPaletteByLuminance(palette);
}

function analogous(radial, randomFn) {
    const palette = [
        { a: radial.a, r: radial.r },
        { a: radial.a, r: randomR(randomFn) },
        { a: mod1(radial.a + OneSpoke), r: radial.r },
        { a: mod1(radial.a + OneSpoke), r: randomR(randomFn) },
        { a: mod1(radial.a - OneSpoke), r: radial.r }
    ].map(rd => pixToRGBLuminosity(rd));
    return sortPaletteByLuminance(palette);
}

function triad(radial, randomFn) {
    const palette = [
        { a: radial.a, r: radial.r },
        { a: radial.a, r: randomR(randomFn) },
        { a: mod1(radial.a + 4 * OneSpoke), r: radial.r },
        { a: mod1(radial.a + 4 * OneSpoke), r: randomR(randomFn) },
        { a: mod1(radial.a - 4 * OneSpoke), r: radial.r }
    ].map(rd => pixToRGBLuminosity(rd));
    return sortPaletteByLuminance(palette);
}

function complementary(radial, randomFn) {
    const palette = [
        { a: radial.a, r: radial.r },
        { a: radial.a, r: mod1(radial.r - 0.1) },
        { a: radial.a, r: mod1(radial.r + 0.1) },
        { a: mod1(radial.a + 6 * OneSpoke), r: radial.r },
        { a: mod1(radial.a + 6 * OneSpoke), r: randomR(randomFn) }
    ].map(rd => pixToRGBLuminosity(rd));
    return sortPaletteByLuminance(palette);
}

function splitComplementary(radial, randomFn) {
    const palette = [
        { a: radial.a, r: radial.r },
        { a: mod1(radial.a + 5 * OneSpoke), r: radial.r },
        { a: mod1(radial.a + 5 * OneSpoke), r: randomR(randomFn) },
        { a: mod1(radial.a - 5 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 5 * OneSpoke), r: randomR(randomFn) }
    ].map(rd => pixToRGBLuminosity(rd));
    return sortPaletteByLuminance(palette);
}

function doubleSplitComplementary(radial, randomFn) {
    const palette = [
        { a: radial.a, r: radial.r },
        { a: mod1(radial.a + 1 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 1 * OneSpoke), r: radial.r },
        { a: mod1(radial.a + 5 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 5 * OneSpoke), r: radial.r }
    ].map(rd => pixToRGBLuminosity(rd));
    return sortPaletteByLuminance(palette);
}

function square(radial, randomFn) {
    const palette = [
        { a: radial.a, r: radial.r },
        { a: radial.a, r: randomR(randomFn) },
        { a: mod1(radial.a + 4 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 4 * OneSpoke), r: radial.r },
        { a: mod1(radial.a + 6 * OneSpoke), r: radial.r }
    ].map(rd => pixToRGBLuminosity(rd));
    return sortPaletteByLuminance(palette);
}

function compound(radial, randomFn) {
    const palette = [
        { a: radial.a, r: radial.r },
        { a: mod1(radial.a - 1 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 1 * OneSpoke), r: randomR(randomFn) },
        { a: mod1(radial.a - 5 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 5 * OneSpoke), r: randomR(randomFn) }
    ].map(rd => pixToRGBLuminosity(rd));
    return sortPaletteByLuminance(palette);
}

const SchemeGenerators = {
    monochromatic,
    analogous,
    triad,
    complementary,
    splitComplementary,
    doubleSplitComplementary,
    square,
    compound
};

function randomScheme(randomFn) {
    const schemes = Object.values(SchemeGenerators);
    const i = Math.floor(randomFn() * schemes.length);
    const radial = { a: randomFn(), r: randomR(randomFn) };
    return schemes[i](radial, randomFn);
}
