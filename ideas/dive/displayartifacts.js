// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: how the pieces and terrain *look and measure* on screen —
// hex/counter geometry and the per-terrain / per-material / per-counter colors and labels.
// None of this affects adjudication, so it stays out of GameArtifacts and out of any server
// port; only GameUI (and the pixel helpers in hex.js) read it. Keyed off GameArtifacts, so
// it must load after artifacts.js.
const GameDisplayArtifacts = (function () {
    const T = GameArtifacts.TERRAIN;
    const M = GameArtifacts.MATERIAL;

    return {
        HEX_SIZE: 24,
        COUNTER_SIZE: 28,
        TERRAIN_COLORS: {
            [T.ROCK]: '#3a3a45',
            [T.SHALLOWS]: '#37cdbf',
            [T.REEF]: '#d95fa8',
            [T.KELP]: '#43c06e',
            [T.DEEP]: '#27508f',
            [T.VENT]: '#8a4a3f',
            [T.TRENCH]: '#241d4e',
            [T.BASE]: '#e8c96a',
        },
        TERRAIN_NAMES: {
            [T.ROCK]: 'Rock Spire',
            [T.SHALLOWS]: 'Shallows',
            [T.REEF]: 'Reef',
            [T.KELP]: 'Kelp Forest',
            [T.DEEP]: 'Deep Water',
            [T.VENT]: 'Vent Field',
            [T.TRENCH]: 'Trench',
            [T.BASE]: 'Berth Station',
        },
        MATERIAL_COLORS: {
            [M.GLOWFIBER]: '#9dffb8',
            [M.PRISMSHARD]: '#ff8ff0',
            [M.PEARL]: '#f5f2e4',
            [M.EMBERGLASS]: '#ff8c3a',
            [M.VOIDAMBER]: '#b06cff',
        },
        MATERIAL_NAMES: {
            [M.GLOWFIBER]: 'Glowfiber',
            [M.PRISMSHARD]: 'Prismshard',
            [M.PEARL]: 'Drift Pearl',
            [M.EMBERGLASS]: 'Emberglass',
            [M.VOIDAMBER]: 'Void Amber',
        },
        SUB_COLOR: '#ffd447',
        DIVER_COLOR: '#7ce8ff',
        LEVIATHAN_COLOR: '#b0342c',
        CACHE_COLOR: '#ffe9a0',
        MURK_COLOR: 'rgba(4, 10, 34, 0.5)',   // laid over hexes whose nodes are unseen
    };
})();
