// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: how the biomes, creatures, and counters *look and
// measure* on screen. None of this affects adjudication, so it stays out of
// GameArtifacts and out of any server port; only GameUI (and the pixel helpers in
// hex.js) read it. Keyed off GameArtifacts.BIOMES, so it must load after artifacts.js.
const GameDisplayArtifacts = (function () {
    const B = GameArtifacts.BIOMES;

    return {
        HEX_SIZE: 24,
        COUNTER_SIZE: 28,
        CREATURE_RADIUS: 10,

        BIOME_COLORS: {
            [B.SEA]: '#103c4a',
            [B.CRAG]: '#565060',
            [B.MEADOW]: '#6fae4a',
            [B.SPORE]: '#7e4fa8',
            [B.CRYSTAL]: '#3fb3c4',
            [B.ASH]: '#8a4634',
            [B.WRITHE]: '#2b0f38'
        },
        // Vitality shading: hexes darken toward this floor as their vitality drains,
        // so front lines read as sickly bands without any extra markers.
        VITALITY_SHADE_FLOOR: 0.45,

        CREATURE_COLORS: {
            [B.MEADOW]: '#e8e4c0',
            [B.SPORE]: '#cfa3ef',
            [B.CRYSTAL]: '#bff2ff',
            [B.ASH]: '#ff7a45',
            [B.WRITHE]: '#d01a8a'
        },
        HOSTILE_RING: '#ff3333',
        FRIENDLY_RING: '#ffffff',

        HERO_COLOR: '#ffd24a',
        SETTLEMENT_COLOR: '#f0ead6',
        BLIGHT_COLOR: '#170820',
        BLIGHT_GLYPH_COLOR: '#d01a8a',
        BAR_BACK: '#00000088',
        PROSPERITY_BAR: '#7dd87d',
        BLIGHT_BAR: '#d01a8a'
    };
})();
