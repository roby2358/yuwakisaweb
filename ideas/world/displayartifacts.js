// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: how the pieces and terrain *look and measure* on screen —
// hex/counter geometry and the per-terrain / per-counter colors and labels. None of this
// affects adjudication, so it stays out of GameArtifacts and out of any server port; only
// GameUI (and the pixel helpers in hex.js) read it. Keyed off GameArtifacts.TERRAIN, so it
// must load after artifacts.js.
const GameDisplayArtifacts = (function () {
    const T = GameArtifacts.TERRAIN;

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
            [T.FARM]: '#e8d16a',
            [T.VILLAGE]: '#b5541c',
        },
        TERRAIN_NAMES: {
            [T.WATER]: 'Water',
            [T.PLAINS]: 'Plains',
            [T.HILLS]: 'Hills',
            [T.MOUNTAIN]: 'Mountain',
            [T.FOREST]: 'Forest',
            [T.GOLD]: 'Gold',
            [T.QUARRY]: 'Quarry',
            [T.FARM]: 'Farmland',
            [T.VILLAGE]: 'Village',
        },
        PLAYER_COLOR: '#daa520',
        // Status titles, indexed by rank (parallel to GameArtifacts.PRIVILEGES).
        STATUS_TITLES: ['Wanderer', 'Yeoman', 'Reeve', 'Protector', 'Warden', 'Lord'],
        // Enemy-phase playback pacing (ms).
        ANIM_HOP_MS: 120,
        ANIM_FLASH_MS: 260,
    };
})();
