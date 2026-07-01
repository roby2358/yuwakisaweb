// gamestate.js — GameState: the data model plus pure queries (DYNAMICS §3).
// No rules, no rendering. GameEngine mutates it; GameUI reads it.

class GameState {
    constructor() {
        this.hexes = new Map();      // key "q,r" -> hex object
        this.units = [];             // colony units (captain + colonists)
        this.aliens = [];            // hostile mobile units
        this.lander = null;          // { q, r, hp, maxHp }
        this.materials = 0;
        this.rations = 0;
        this.frozen = 0;             // colonists still in cryo
        this.relics = 0;             // spent on blaster upgrades
        this.turn = 1;
        this.phase = 'player';       // 'player' | 'enemy'
        this.gameOver = null;        // null | 'win' | 'lose'
        this.controlled = new Set(); // hex keys currently under colony control
        this.revealed = new Set();   // hex keys ever revealed (fog)
        this.nextId = 1;
        this.log = 'Grounded. Reclaim the planet — hex by hex.';
    }

    // ---- lookups ----
    key(q, r) { return Hex.key(q, r); }
    get(key) { return this.hexes.get(key); }
    hex(q, r) { return this.hexes.get(Hex.key(q, r)); }
    inBounds(q, r) { return this.hexes.has(Hex.key(q, r)); }

    colonyUnitAt(q, r) { return this.units.find(u => u.q === q && u.r === r) || null; }
    alienAt(q, r) { return this.aliens.find(a => a.q === q && a.r === r) || null; }
    isLander(q, r) { return this.lander && this.lander.q === q && this.lander.r === r; }
    structureAt(q, r) { const h = this.hex(q, r); return h ? h.structure : null; }

    // Terrain a foot unit could ever stand on (ignores occupants / corruption).
    isLand(q, r) {
        const h = this.hex(q, r);
        return !!h && MOVEMENT_COST[h.terrain] !== Infinity;
    }

    // Blocked for movement: off-map, water/mountain, a wall, or an occupant.
    isBlocked(q, r) {
        if (!this.isLand(q, r)) return true;
        const h = this.hex(q, r);
        if (h.structure && h.structure.type === 'wall') return true;
        if (this.colonyUnitAt(q, r) || this.alienAt(q, r)) return true;
        return false;
    }

    isControlled(q, r) { return this.controlled.has(Hex.key(q, r)); }
    isRevealed(q, r) { return this.revealed.has(Hex.key(q, r)); }

    // A hex is a live node (breeds aliens, blocks cleansing) while its breeder lives.
    isNode(h) { return h && h.corruption >= RECLAIMER.corruptionMax && h.breederHp > 0; }

    // ---- derived counts / win math ----
    captain() { return this.units.find(u => u.kind === 'captain') || null; }
    colonistsAwake() { return this.units.filter(u => u.kind === 'colonist').length; }
    controlledCount() { return this.controlled.size; }

    breedersRemaining() {
        let n = 0;
        for (const h of this.hexes.values()) if (h.breederHp > 0) n++;
        return n;
    }

    threat() {
        const R = RECLAIMER;
        return R.threatBase
            + R.threatPerTurn * this.turn
            + R.threatPerColonist * this.colonistsAwake()
            + R.threatPerControlled * this.controlledCount();
    }

    upkeep() { return this.colonistsAwake() * RECLAIMER.upkeepPerColonist; }
}
