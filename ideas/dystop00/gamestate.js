// gamestate.js — GameState
//
// The authoritative, serializable game data — nothing else. No DOM, no canvas, no rules
// behavior, no view/interaction state. Per-hex Wake state lives on the hexes themselves
// (`hex.awake`), so the map stays the single source of truth for the city.
const GameState = (function () {
    class GameState {
        constructor() {
            this.seed = 0;                 // reproducibility anchor for the whole game
            this.hexes = null;             // Map<"q,r", hex>
            this.player = null;            // Piece '@'
            this.stations = [];            // [Piece] — stations[0] is the Ministry, the rest precincts
            this.rigs = [];                // [Rig] — fixed roster, RIG_NAMES order
            this.sweepers = [];            // [Sweeper]
            this.nextSweeperId = 1;
            this.turn = 1;
            this.mp = GameArtifacts.PLAYER_MP;
            this.phase = 'player';         // 'player' | 'broadcast' | 'regime'
            this.outcome = null;           // null | 'won' | 'captured' | 'deadair'
        }
    }

    return GameState;
})();
