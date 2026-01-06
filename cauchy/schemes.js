// Schemes - Port from Scala
// Color scheme generation functions

const OneSpoke = 1.0 / 12.0;

function randomR(randomFn) {
    return 0.8 - randomFn() * 0.8;
}

function monochromatic(radial, randomFn) {
    const radials = [];
    for (let i = 0; i < 5; i++) {
        radials.push(randomR(randomFn));
    }
    radials.sort((a, b) => a - b);
    
    return radials.map(r => pixToRGBLuminosity({ a: radial.a, r: r }));
}

function analogous(radial, randomFn) {
    return [
        { a: radial.a, r: radial.r },
        { a: radial.a, r: randomR(randomFn) },
        { a: mod1(radial.a + OneSpoke), r: radial.r },
        { a: mod1(radial.a + OneSpoke), r: randomR(randomFn) },
        { a: mod1(radial.a - OneSpoke), r: radial.r }
    ].map(rd => pixToRGBLuminosity(rd));
}

function triad(radial, randomFn) {
    return [
        { a: radial.a, r: radial.r },
        { a: radial.a, r: randomR(randomFn) },
        { a: mod1(radial.a + 4 * OneSpoke), r: radial.r },
        { a: mod1(radial.a + 4 * OneSpoke), r: randomR(randomFn) },
        { a: mod1(radial.a - 4 * OneSpoke), r: radial.r }
    ].map(rd => pixToRGBLuminosity(rd));
}

function complementary(radial, randomFn) {
    return [
        { a: radial.a, r: radial.r },
        { a: radial.a, r: mod1(radial.r - 0.1) },
        { a: radial.a, r: mod1(radial.r + 0.1) },
        { a: mod1(radial.a + 6 * OneSpoke), r: radial.r },
        { a: mod1(radial.a + 6 * OneSpoke), r: randomR(randomFn) }
    ].map(rd => pixToRGBLuminosity(rd));
}

function splitComplementary(radial, randomFn) {
    return [
        { a: radial.a, r: radial.r },
        { a: mod1(radial.a + 5 * OneSpoke), r: radial.r },
        { a: mod1(radial.a + 5 * OneSpoke), r: randomR(randomFn) },
        { a: mod1(radial.a - 5 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 5 * OneSpoke), r: randomR(randomFn) }
    ].map(rd => pixToRGBLuminosity(rd));
}

function doubleSplitComplementary(radial, randomFn) {
    return [
        { a: radial.a, r: radial.r },
        { a: mod1(radial.a + 1 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 1 * OneSpoke), r: radial.r },
        { a: mod1(radial.a + 5 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 5 * OneSpoke), r: radial.r }
    ].map(rd => pixToRGBLuminosity(rd));
}

function square(radial, randomFn) {
    return [
        { a: radial.a, r: radial.r },
        { a: radial.a, r: randomR(randomFn) },
        { a: mod1(radial.a + 4 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 4 * OneSpoke), r: radial.r },
        { a: mod1(radial.a + 6 * OneSpoke), r: radial.r }
    ].map(rd => pixToRGBLuminosity(rd));
}

function compound(radial, randomFn) {
    return [
        { a: radial.a, r: radial.r },
        { a: mod1(radial.a - 1 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 1 * OneSpoke), r: randomR(randomFn) },
        { a: mod1(radial.a - 5 * OneSpoke), r: radial.r },
        { a: mod1(radial.a - 5 * OneSpoke), r: randomR(randomFn) }
    ].map(rd => pixToRGBLuminosity(rd));
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
