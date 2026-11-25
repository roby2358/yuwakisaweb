// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: geometry, colors, names. None of this affects adjudication,
// so it stays out of GameArtifacts and out of any server port. Keyed off GameArtifacts, so it
// must load after artifacts.js.
const GameDisplayArtifacts = (function () {
    const T = GameArtifacts.TERRAIN;

    return {
        HEX_SIZE: 24,
        COUNTER_SIZE: 28,
        TERRAIN_COLORS: {
            [T.WATER]: '#2a6faa',
            [T.PLAINS]: '#7db344',
            [T.JUNGLE]: '#1f5e2a',
            [T.MESA]: '#b98c4e',
        },
        MESA_TOP_COLOR: '#d6ae6e',
        TERRAIN_NAMES: {
            [T.WATER]: 'Water',
            [T.PLAINS]: 'Plains',
            [T.JUNGLE]: 'Jungle',
            [T.MESA]: 'Mesa',
        },
        GROUP_COLORS: { raider: '#c0392b', beast: '#8a5a2b', relic: '#27a0b8' },
        VILLAGE_OPEN_COLOR: '#3aa55d',
        VILLAGE_CLOSED_COLOR: '#8a8f98',
        VILLAGE_RUINED_COLOR: '#6b3b3b',
        RUIN_COLOR: '#8e6bbf',
        RUIN_LOOTED_COLOR: '#5d5370',
        LAIR_COLOR: '#a8322d',
        LAIR_DEAD_COLOR: '#555a63',
        PLAYER_COLOR: '#daa520',
        NEMESIS_COLOR: '#ff2a2a',
        SHOOT_COLOR: '255, 140, 0',
        ATTACK_COLOR: '255, 0, 0',
        FOG_DIM: 'rgba(14, 17, 22, 0.55)',
        // Canvas chrome — mirror --bg and --font in index.css so drawn text matches the HUD.
        BG_COLOR: '#0e1116',
        UI_FONT: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        REACH_COLOR: '255, 214, 51',   // rgb of --accent; tinted per use
    };
})();
