// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: how the pieces and terrain *look and measure* on screen —
// hex/counter geometry and the per-terrain / per-counter colors and labels. None of this
// affects adjudication, so it stays out of GameArtifacts and out of any server port; only
// GameUI (and the pixel helpers in hex.js) read it. Keyed off GameArtifacts.TERRAIN, so it
// must load after artifacts.js.
const GameDisplayArtifacts = (function () {
    const T = GameArtifacts.TERRAIN;

    function seededRandom(seed) {
        let value = seed >>> 0;
        return function () {
            value = (value + 0x6D2B79F5) | 0;
            let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
            mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
            return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
        };
    }

    return {
        HEX_SIZE: 24,
        COUNTER_SIZE: 28,
        TERRAIN_COLORS: {
            [T.WATER]: '#2a6faa',
            [T.PLAINS]: '#7db344',
            [T.HILLS]: '#c4a44a',
            [T.MOUNTAIN]: '#7a7a7a',
            [T.FOREST]: '#2d6e2d',
            [T.GOLD]: '#d4a017',
            [T.QUARRY]: '#9e8c6c',
        },
        TERRAIN_NAMES: {
            [T.WATER]: 'Water',
            [T.PLAINS]: 'Plains',
            [T.HILLS]: 'Hills',
            [T.MOUNTAIN]: 'Mountain',
            [T.FOREST]: 'Forest',
            [T.GOLD]: 'Gold',
            [T.QUARRY]: 'Quarry',
        },
        CARAVAN_COLOR: '#daa520',
        CROWN_MARKET_COLOR: '#ff6600',
        TRADING_POST_COLOR: '#efe0a2',
        createRaiderPalette(seed) {
            const colors = ColorTheory.monochromatic({ a: 0, r: 0.5 }, seededRandom(seed));
            return colors.map(([r, g, b]) => ColorTheory.rgbToHex(r, g, b));
        },
    };
})();
