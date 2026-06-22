// gamestate.js — All serializable game data, plus the pure queries over it.
//
// GameState is *only* data and read-only derivations: the board, the units, the landmarks,
// the score, and the outcome. It holds nothing about the UI (no pan, selection, overlay, or
// animation flags) and never mutates itself as a side effect of play — GameEngine owns the
// rules that change it. That split is what lets a GameState be snapshotted, serialized to
// browser memory, and restored (toJSON / fromJSON) as one self-contained value.
//
// No ES modules — plain <script> global, loaded before the AI strategies and GameEngine.
class GameState {
    constructor() {
        this.hexes = null;                // Map<"q,r", { q, r, col, row, elevation, isEdge, terrain }>
        this.healer = null;
        this.party = [];
        this.enemies = [];
        this.homeHex = null;
        this.treasureHex = null;
        this.objectiveHex = null;         // reference to homeHex or treasureHex (where the party heads)
        this.treasureCollected = false;
        this.turn = 1;
        this.reputation = 0;
        this.nextId = 1;
        this.partyScheme = null;          // ColorTheory palettes for counter colors
        this.enemyScheme = null;
        this.enemyColorIdx = 0;
        this.outcome = null;              // null | 'victory' | 'defeat' — set by the engine, read by the UI
        this.outcomeMessage = '';
    }

    // ---- Terrain rules (pure: read the hex + config only) ----
    hexAt(q, r) {
        return this.hexes.get(Hex.key(q, r)) ?? null;
    }

    moveCost(hex) {
        return MOVEMENT_COST[hex.terrain] ?? Infinity;
    }

    isPassable(hex) {
        return this.moveCost(hex) !== Infinity;
    }

    passableHexes() {
        const out = [];
        for (const [, hex] of this.hexes) {
            if (hex.isEdge) continue;
            if (!this.isPassable(hex)) continue;
            out.push(hex);
        }
        return out;
    }

    // ---- Unit queries ----
    // Every unit currently on the board: the healer, party members still present (downed
    // bodies included — they're not `gone`), and all enemies. Order is irrelevant here;
    // callers that care about draw order use renderOrder().
    boardUnits() {
        return [this.healer, ...this.party.filter(p => !p.gone), ...this.enemies].filter(Boolean);
    }

    // Draw order: enemies first, party next, healer last so the player's own counter sits on
    // top. The snapshot units array follows this so the UI can paint in a single pass.
    renderOrder() {
        return [...this.enemies, ...this.party.filter(p => !p.gone), this.healer].filter(Boolean);
    }

    boardKeySet() {
        const s = new Set();
        for (const u of this.boardUnits()) s.add(Hex.key(u.q, u.r));
        return s;
    }

    occupancyExcluding(unit) {
        const s = new Set();
        for (const u of this.boardUnits()) {
            if (u === unit) continue;
            s.add(Hex.key(u.q, u.r));
        }
        return s;
    }

    unitAt(q, r) {
        return this.boardUnits().find(u => u.q === q && u.r === r) ?? null;
    }

    // Friendly units the healer can target: itself plus party members still on the board
    // (downed bodies included, so Raise can reach them).
    allies() {
        return [this.healer, ...this.party.filter(p => !p.gone)];
    }

    nearest(from, list) {
        const origin = new Hex(from.q, from.r);
        let best = null;
        let bestDist = Infinity;
        for (const u of list) {
            const d = origin.distance(u);
            if (d < bestDist) { bestDist = d; best = u; }
        }
        return best;
    }

    // Tougher tiers appear as reputation rises (DYNAMICS: "Escalation tied to progress").
    currentTier() {
        if (this.reputation >= TIER3_REP) return 3;
        if (this.reputation >= TIER2_REP) return 2;
        return 1;
    }

    // ---- Rendering view ----
    // A frozen, plain-object picture of the board for one frame: enough for the UI to draw a
    // unit (position, hp, label, statuses, downed countdown) without reaching into live units.
    // The engine snapshots one of these after every unit acts so the animated turn can be
    // replayed even though the underlying state has already advanced to its final position.
    snapshot() {
        return {
            units: this.renderOrder().map(u => GameState.cloneRenderable(u)),
            treasureCollected: this.treasureCollected,
            objectiveHex: this.objectiveHex ? { q: this.objectiveHex.q, r: this.objectiveHex.r } : null
        };
    }

    static cloneRenderable(u) {
        return {
            id: u.id, kind: u.kind, label: u.label, color: u.color,
            q: u.q, r: u.r, hp: u.hp, maxHp: u.maxHp,
            alive: u.alive, gone: u.gone, downedTurns: u.downedTurns,
            statuses: u.statuses.map(s => ({ type: s.type }))
        };
    }

    // ---- Serialization (save / restore in browser memory) ----
    // No back-compat shims: playtest saves aren't durable, so fromJSON assumes the current
    // shape. objectiveHex isn't stored — it's re-derived from treasureCollected so it stays a
    // reference to the actual home/treasure landmark (the engine compares it by identity).
    toJSON() {
        return {
            hexes: [...this.hexes.values()],
            healer: this.healer,
            party: this.party,
            enemies: this.enemies,
            homeHex: this.homeHex,
            treasureHex: this.treasureHex,
            treasureCollected: this.treasureCollected,
            turn: this.turn,
            reputation: this.reputation,
            nextId: this.nextId,
            partyScheme: this.partyScheme,
            enemyScheme: this.enemyScheme,
            enemyColorIdx: this.enemyColorIdx,
            outcome: this.outcome,
            outcomeMessage: this.outcomeMessage
        };
    }

    static fromJSON(o) {
        const s = new GameState();
        s.hexes = new Map();
        for (const hex of o.hexes) s.hexes.set(Hex.key(hex.q, hex.r), hex);
        s.healer = o.healer;
        s.party = o.party;
        s.enemies = o.enemies;
        s.homeHex = o.homeHex;
        s.treasureHex = o.treasureHex;
        s.treasureCollected = o.treasureCollected;
        s.turn = o.turn;
        s.reputation = o.reputation;
        s.nextId = o.nextId;
        s.partyScheme = o.partyScheme;
        s.enemyScheme = o.enemyScheme;
        s.enemyColorIdx = o.enemyColorIdx;
        s.outcome = o.outcome;
        s.outcomeMessage = o.outcomeMessage;
        s.objectiveHex = s.treasureCollected ? s.homeHex : s.treasureHex;
        return s;
    }
}
