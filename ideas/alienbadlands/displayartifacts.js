// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: how the pieces and terrain *look and measure* on screen.
// None of this affects adjudication, so it stays out of GameArtifacts and out of any
// server port; only GameUI (and the pixel helpers in hex.js) read it. Keyed off
// GameArtifacts.TERRAIN, so it must load after artifacts.js.
const GameDisplayArtifacts = (function () {
    const T = GameArtifacts.TERRAIN;

    return {
        HEX_SIZE: 24,
        COUNTER_SIZE: 28,
        TERRAIN_COLORS: {
            [T.STORM]: '#241d2e',
            [T.ACID]: '#86b049',
            [T.HARDPAN]: '#b98a4e',
            [T.SCRUB]: '#8a8a3d',
            [T.BROKEN]: '#9a5f42',
            [T.CRAG]: '#544848',
            [T.GLOWVINE]: '#3fa06a',
            [T.SHARD]: '#9c6ad4',
            [T.ORESCARP]: '#c47a2a',
            [T.GEODE]: '#e0498a'
        },
        TERRAIN_NAMES: {
            [T.STORM]: 'Storm Wall',
            [T.ACID]: 'Acid Flats',
            [T.HARDPAN]: 'Hardpan',
            [T.SCRUB]: 'Scrub',
            [T.BROKEN]: 'Broken Ground',
            [T.CRAG]: 'Crag',
            [T.GLOWVINE]: 'Glowvine Thicket',
            [T.SHARD]: 'Shard Field',
            [T.ORESCARP]: 'Ore Scarp',
            [T.GEODE]: 'Geode Bloom'
        },
        UNSEEN_COLOR: '#0b0a10',
        PLAYER_COLOR: '#daa520',
        MOUNTED_RING: '#4ee0e0',
        BIKE_COLOR: '#4ec3e0',
        CACHE_COLOR: '#d8c48a',
        BANDIT_COLOR: '#b03030',
        PREDATOR_COLORS: { howler: '#d46a2a', gravemaw: '#7a2ad4' },
        LOCATION_COLORS: { starport: '#f0f0f0', town: '#d8d8b0', settlement: '#c0b890' },
        LOCATION_GLYPHS: { starport: '★', town: 'T', settlement: 'H' },
        CAMP_COLOR: '#802020'
    };
})();
