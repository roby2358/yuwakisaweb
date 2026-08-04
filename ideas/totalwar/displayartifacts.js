// displayartifacts.js — GameDisplayArtifacts
//
// Client-only display attributes: how the pieces and terrain *look and measure* on screen —
// hex/counter geometry, terrain and faction colors, unit counter labels, and the intro
// blurbs. None of this affects adjudication, so it stays out of GameArtifacts and out of
// any server port; only GameUI (and the pixel helpers in hex.js) read it. Keyed off
// GameArtifacts, so it must load after artifacts.js.
const GameDisplayArtifacts = (function () {
    const T = GameArtifacts.TERRAIN;

    return {
        HEX_SIZE: 24,
        COUNTER_SIZE: 26,
        TERRAIN_COLORS: {
            [T.WATER]: '#2a6faa',
            [T.PLAINS]: '#7db344',
            [T.HILLS]: '#c4a44a',
            [T.MOUNTAIN]: '#7a7a7a',
            [T.FOREST]: '#2d6e2d',
        },
        TERRAIN_NAMES: {
            [T.WATER]: 'Water',
            [T.PLAINS]: 'Plains',
            [T.HILLS]: 'Hills',
            [T.MOUNTAIN]: 'Mountain',
            [T.FOREST]: 'Forest',
        },
        FACTION_COLORS: {
            concord: '#5a76a8',
            thornwood: '#3e8a3e',
            marches: '#9b3d3d',
            vault: '#3f9d9b',
            partisan: '#8a5a33',
        },
        FACTION_BLURBS: {
            concord: 'Dieselpunk industry. Rocket Batteries burn enemy stockpiles and strip entrenchment from 8 hexes away.',
            thornwood: 'Elder-forest realms with rifles and wyrms. The Dragon flies over everything and exploits every gap — but each death makes the next one dearer.',
            marches: 'Trench-and-pike grimdark men. Wardens always activate for 1 CP and the cities they hold never revolt.',
            vault: 'Retro-futurist bunker technocracy. The Colossus walks mountains and cracks city defenses like eggshells.',
        },
        UNIT_LABELS: {
            infantry: 'IN',
            armor: 'AR',
            artillery: 'AT',
            air: 'AW',
            garrison: 'GA',
            hq: 'HQ',
            rocket: 'RK',
            dragon: 'DG',
            wardens: 'WD',
            colossus: 'CX',
            militia: 'PM',
        },
        CITY_FILL: '#e8e0c8',
        CITY_STROKE: '#333333',
        VICTORY_RING: '#ffd700',
        HIGHLIGHT_MOVE: 'rgba(255, 255, 0, 0.30)',
        HIGHLIGHT_ATTACK: 'rgba(255, 0, 0, 0.35)',
        HIGHLIGHT_BOMBARD: 'rgba(255, 140, 0, 0.35)',
        OWNER_TINT_ALPHA: 0.30,
        WEB_TINT: 'rgba(255, 255, 255, 0.06)',
    };
})();
