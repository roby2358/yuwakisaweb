// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes. Nothing here affects adjudication; only GameUI
// (and the pixel helpers in hex.js) read it.
const GameDisplayArtifacts = (function () {
    const T = GameArtifacts.TERRAIN;

    return {
        HEX_SIZE: 26,
        COUNTER_SIZE: 30,

        TERRAIN_COLORS: {
            [T.WATER]: '#14405a',
            [T.MARSH]: '#3d5a45',
            [T.FIELD]: '#6fae4a',
            [T.FOREST]: '#33702f',
            [T.HILL]: '#8a8070'
        },

        ORACLE_COLOR: '#ffd24a',
        BUILDING_COLOR: '#f0ead6',
        RUIN_COLOR: '#4a4038',
        STONES_COLOR: '#b8b0c8',
        MEMORIAL_COLOR: '#9a9a9a',
        FIELD_MARK: '#e8d86a',

        REACHABLE_FILL: 'rgba(255, 235, 60, 0.35)',
        OMEN_COLOR: '#b04fd8',
        // preparedness badge backgrounds (black lettering on top)
        TIER_COLORS: {
            vulnerable: '#e04838',
            close: '#eec83c',
            ready: '#54c454',
            unknown: '#a8a0b8'
        },
        WARNED_RING: '#ff9530',
        FLASH_COLOR: '#ff4030',

        GRID_LINE: 'rgba(0, 0, 0, 0.25)',
        DEPTH_LINE: '#777',

        // burden bar descriptions, lightest first
        BURDEN_BANDS: [
            { upTo: 10, name: 'a passing shadow' },
            { upTo: 30, name: 'a light weight' },
            { upTo: 50, name: 'a gathering weight' },
            { upTo: 70, name: 'a heavy burden' },
            { upTo: 90, name: 'a crushing weight' },
            { upTo: 101, name: 'the weight of all tomorrows' }
        ]
    };
})();
