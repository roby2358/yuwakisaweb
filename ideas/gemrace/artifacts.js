// artifacts.js — GameArtifacts
//
// Static definitions of the game's *pieces and rules* — the vocabulary the engine reasons
// over: terrain types, their movement costs, and the fixed sizing constants of the map and
// a turn. This is server-side data: no colors, no pixels, nothing the engine wouldn't need
// to adjudicate a move. Display attributes (colors, hex/counter geometry) live separately
// in GameDisplayArtifacts so a headless server can drop this file in and ignore that one.
//
// Plain-script global (no ES modules) so the page runs from file:// on a double-click.
const GameArtifacts = (function () {
    const TERRAIN = {
        WATER: 0,
        PLAINS: 1,
        HILLS: 2,
        MOUNTAIN: 3,
        FOREST: 4,
        GOLD: 5,
        QUARRY: 6
    };

    const GEMS = {
        sunstone: { name: 'Sunstone', color: '#ffd447' },
        ruby: { name: 'Ruby', color: '#ef476f' },
        jade: { name: 'Jade', color: '#4ade80' },
        cobalt: { name: 'Cobalt', color: '#4f8cff' },
        violet: { name: 'Violet', color: '#b56cff' },
        pearl: { name: 'Pearl', color: '#f8fafc' },
        ember: { name: 'Ember', color: '#ff7a33' }
    };

    // Six of these are sampled without replacement and assigned to the six
    // consumable palettes at the start of every game.
    const GEM_EFFECTS = {
        haste: { name: 'Rush', text: 'Gain 3 MP each turn', turns: 3 },
        tread: { name: 'Tread', text: 'Passable terrain costs 1 MP', turns: 4 },
        freeze: { name: 'Calm', text: 'Monsters do not move', turns: 2 },
        veil: { name: 'Veil', text: 'Monsters cannot detect you', turns: 4 },
        ward: { name: 'Ward', text: 'Survive one monster collision', turns: 5 },
        howl: { name: 'Howl', text: 'Nearby monsters flee', turns: 3 },
        sprint: { name: 'Sprint', text: 'Gain 6 MP immediately', turns: 1 },
        patience: { name: 'Patience', text: 'Unused MP carries into next turn', turns: 3 },
        magnet: { name: 'Magnet', text: 'Collect gems from adjacent hexes', turns: 3 },
        mirage: { name: 'Mirage', text: 'Monster aggro range is reduced to 2', turns: 5 },
        current: { name: 'Current', text: 'Forests and hills cost 1 MP', turns: 5 },
        blink: { name: 'Blink', text: 'Monster movement is reversed this turn', turns: 1 }
    };

    const GEM_FREQUENCY = {
        [TERRAIN.PLAINS]: { sunstone: 1, ruby: 3, jade: 3, cobalt: 2, violet: 2, pearl: 2, ember: 2 },
        [TERRAIN.FOREST]: { sunstone: 1, ruby: 1, jade: 7, cobalt: 1, violet: 4, pearl: 2, ember: 1 },
        [TERRAIN.HILLS]: { sunstone: 2, ruby: 4, jade: 1, cobalt: 3, violet: 2, pearl: 2, ember: 4 },
        [TERRAIN.GOLD]: { sunstone: 7, ruby: 4, jade: 1, cobalt: 1, violet: 2, pearl: 3, ember: 3 },
        [TERRAIN.QUARRY]: { sunstone: 3, ruby: 2, jade: 1, cobalt: 5, violet: 1, pearl: 5, ember: 2 }
    };

    return {
        TERRAIN,
        MOVEMENT_COST: {
            [TERRAIN.WATER]: Infinity,
            [TERRAIN.PLAINS]: 1,
            [TERRAIN.HILLS]: 2,
            [TERRAIN.MOUNTAIN]: Infinity,
            [TERRAIN.FOREST]: 2,
            [TERRAIN.GOLD]: 2,
            [TERRAIN.QUARRY]: 2
        },
        GEMS,
        GEM_EFFECTS,
        GEM_FREQUENCY,
        PLAYER_MP: 6,
        SUNSTONES_REQUIRED: 3,
        INITIAL_ORDINARY_GEMS: 45,
        MONSTER_AGGRO_RANGE: 6,
        MONSTER_MOVEMENT: 2,
        MAP_COLS: 60,
        MAP_ROWS: 60,
    };
})();
