// gamestate.js — GameState
//
// The whole game in one struct, serializable to a single JSON blob. Autosaved
// every dawn; no migration — old saves may simply break while we prototype.
// DOM-free so the engine+state can run headless.
class GameState {
    constructor() {
        this.seed = 0;
        this.day = 1;

        this.supplies = 0;
        this.trust = 0;
        this.renown = 0;
        this.madness = 0;

        this.actions = 0;
        this.mp = 0;
        this.oracle = { q: 0, r: 0 };

        // Map hexKey -> { q, r, terrain, elev, buildingId, feature }
        // feature: null | 'field' | 'memorial'
        this.hexes = new Map();

        // { id, kind, name, hexKey, ruined, rebuildDays, preps: {prepKind: strength}, occupantIds: [] }
        this.buildings = [];

        // { id, name, role, homeId, alive }
        this.villagers = [];

        // { id, kind, buildingId, victimId, day, magnitude, arrivedDay, warned, aid,
        //   revealed: {kind, place, day, victim, magnitude}, riddle: {same keys -> strings} }
        this.visions = [];

        this.nextBuildingId = 1;
        this.nextVillagerId = 1;
        this.nextVisionId = 1;
        this.turnFateDay = -99;   // day Turn Fate was last used
        this.beastName = '';
    }

    // ---- derived ----

    rankIndex() {
        const ranks = GameArtifacts.RANKS;
        let idx = 0;
        for (let i = 0; i < ranks.length; i++) {
            if (this.renown >= ranks[i].at) idx = i;
        }
        return idx;
    }

    rank() {
        return GameArtifacts.RANKS[this.rankIndex()];
    }

    actionsPerDay() {
        const T = GameArtifacts.TUNING;
        let n = T.ACTIONS_PER_DAY;
        if (this.rankIndex() >= 4) n += 1;                 // Crown of Ravens
        if (this.madness >= T.MADNESS_SLOW_1) n -= 1;
        if (this.madness >= T.MADNESS_SLOW_2) n -= 1;
        return Math.max(1, n);                             // never let a unit feel stuck
    }

    // ---- lookups ----

    hexAt(q, r) {
        return this.hexes.get(Hex.key(q, r));
    }

    oracleHex() {
        return this.hexAt(this.oracle.q, this.oracle.r);
    }

    buildingById(id) {
        return this.buildings.find(b => b.id === id);
    }

    buildingAtOracle() {
        const hex = this.oracleHex();
        if (!hex || hex.buildingId === null) return null;
        return this.buildingById(hex.buildingId);
    }

    buildingsOfKind(kind) {
        return this.buildings.filter(b => b.kind === kind);
    }

    villagerById(id) {
        return this.villagers.find(v => v.id === id);
    }

    aliveVillagers() {
        return this.villagers.filter(v => v.alive);
    }

    facetsKnown(vision) {
        return Object.values(vision.revealed).filter(Boolean).length;
    }

    // ---- serialization ----

    toJSON() {
        return {
            seed: this.seed, day: this.day,
            supplies: this.supplies, trust: this.trust, renown: this.renown, madness: this.madness,
            actions: this.actions, mp: this.mp, oracle: this.oracle,
            hexes: Array.from(this.hexes.values()),
            buildings: this.buildings,
            villagers: this.villagers,
            visions: this.visions,
            nextBuildingId: this.nextBuildingId,
            nextVillagerId: this.nextVillagerId,
            nextVisionId: this.nextVisionId,
            turnFateDay: this.turnFateDay,
            beastName: this.beastName
        };
    }

    static fromJSON(data) {
        const state = new GameState();
        Object.assign(state, data);
        state.hexes = new Map(data.hexes.map(h => [Hex.key(h.q, h.r), h]));
        return state;
    }
}
