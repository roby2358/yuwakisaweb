// Static rules and content definitions. Plain-script global for file:// launches.
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
    const RESOURCE = {
        PROVISIONS: 'provisions',
        TIMBER: 'timber',
        ORE: 'ore',
        COIN: 'coin'
    };
    const OUTCOME = { VICTORY: 'victory', DEFEAT: 'defeat' };
    const PHASE = { CARAVAN: 'caravan', RAIDERS: 'raiders' };

    return {
        TERRAIN,
        RESOURCE,
        OUTCOME,
        PHASE,
        MOVEMENT_COST: {
            [TERRAIN.WATER]: Infinity,
            [TERRAIN.PLAINS]: 1,
            [TERRAIN.HILLS]: 2,
            [TERRAIN.MOUNTAIN]: Infinity,
            [TERRAIN.FOREST]: 2,
            [TERRAIN.GOLD]: 2,
            [TERRAIN.QUARRY]: 2
        },
        HARVEST_BY_TERRAIN: {
            [TERRAIN.FOREST]: { [RESOURCE.TIMBER]: 2 },
            [TERRAIN.QUARRY]: { [RESOURCE.ORE]: 2 },
            [TERRAIN.GOLD]: { [RESOURCE.COIN]: 3 }
        },
        CARAVAN_MP: 5,
        MAP_COLS: 60,
        MAP_ROWS: 40,
        STARTING_CARGO: { provisions: 8, timber: 0, ore: 0, coin: 3 },
        VICTORY_INFLUENCE: 15,
        MAX_UNREST: 8,
        TRADING_POST_COUNT: 7,
        CONTRACTS: [
            { id: 'mixed', cost: { timber: 1, ore: 1 }, reward: { coin: 2 } },
            { id: 'timber', cost: { timber: 3 }, reward: { coin: 1 } },
            { id: 'ore', cost: { ore: 2 }, reward: { coin: 3 } }
        ],
        CONTRACT_INFLUENCE: 5,
        SUPPLY_COST: { coin: 2 },
        SUPPLY_REWARD: { provisions: 3 },
        FORCE_COST: { provisions: 1, ore: 1 },
        FORCE_REWARD: { coin: 3 }
    };
})();
