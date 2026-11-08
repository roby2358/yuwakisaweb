// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: how the city and its counters *look* — hex/counter
// geometry and the EGA 16-color palette of a 1987 floppy release. None of this affects
// adjudication, so it stays out of GameArtifacts; only GameUI (and the pixel helpers in
// hex.js) read it. Keyed off GameArtifacts.TERRAIN, so it must load after artifacts.js.
const GameDisplayArtifacts = (function () {
    const T = GameArtifacts.TERRAIN;

    // The EGA default palette, by its traditional names.
    const EGA = {
        black: '#000000', blue: '#0000AA', green: '#00AA00', cyan: '#00AAAA',
        red: '#AA0000', magenta: '#AA00AA', brown: '#AA5500', lightGray: '#AAAAAA',
        darkGray: '#555555', lightBlue: '#5555FF', lightGreen: '#55FF55', lightCyan: '#55FFFF',
        lightRed: '#FF5555', lightMagenta: '#FF55FF', yellow: '#FFFF55', white: '#FFFFFF'
    };

    return {
        EGA,
        HEX_SIZE: 22,
        COUNTER_SIZE: 26,
        TERRAIN_COLORS: {
            [T.CANAL]: EGA.blue,
            [T.PLAZA]: EGA.lightGray,
            [T.BLOCK]: '#888888',           // sleeping tenements: a shade darker than plaza
            [T.INDUSTRIAL]: EGA.darkGray,
            [T.RUINS]: EGA.brown,           // rust
            [T.ARCOLOGY]: EGA.green,
        },
        AWAKE_COLOR: EGA.lightMagenta,      // a woken block
        ARCOLOGY_EDGE: EGA.lightBlue,
        TERRAIN_NAMES: {
            [T.CANAL]: 'TOXIC CANAL',
            [T.PLAZA]: 'PLAZA',
            [T.BLOCK]: 'TENEMENT BLOCK',
            [T.INDUSTRIAL]: 'FACTORY',
            [T.RUINS]: 'RUINS',
            [T.ARCOLOGY]: 'ARCOLOGY',
        },
        PLAYER_COLOR: EGA.yellow,
        RIG_COLOR: EGA.lightCyan,
        SWEEPER_COLORS: { WARDEN: EGA.red, HOUND: EGA.lightRed, HUNTER: EGA.white },
        SWEEPER_INK: { WARDEN: EGA.white, HOUND: EGA.black, HUNTER: EGA.red },
        // Sweeper intent lines, by target kind (a hovered Sweeper's line is drawn at alpha 1, width 2).
        TARGET_LINE: {
            player: { alpha: 0.9, width: 2 },
            rig: { alpha: 0.6, width: 1 },
            frontier: { alpha: 0.25, width: 1 },
            patrol: { alpha: 0.25, width: 1 },
        },
        MINISTRY_COLOR: EGA.white,
        PRECINCT_COLOR: EGA.magenta,
        JAM_TINT: 'rgba(170, 0, 0, 0.32)',
        REACH_TINT: 'rgba(255, 255, 85, 0.30)',
        PREVIEW_TINT: 'rgba(85, 255, 255, 0.55)',
        FADE_TINT: 'rgba(0, 0, 0, 0.55)',            // blocks that would fade if the hovered rig were pulled
        // Canvas chrome — mirror --bg and --font in index.css so drawn text matches the HUD.
        BG_COLOR: '#000000',
        UI_FONT: '"VT323", "Courier New", monospace',
        // Animation pacing (ms).
        HOP_MS: 110,
        FLASH_MS: 320,
    };
})();
