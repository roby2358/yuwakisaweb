// gamestate.js — GameState
//
// The authoritative, serializable game data — nothing else. No DOM, no canvas, no
// rules behavior, no view/interaction state (pan, hover, selection, overlays all
// belong to GameUI). This is exactly what a server would own and ship to clients:
// keep it a plain data bag so it stays trivially snapshot-able.
const GameState = (function () {
    class GameState {
        constructor() {
            this.seed = 0;                 // reproducibility anchor for the whole game
            this.hexes = null;             // Map<"q,r", hex>
            this.player = null;            // Piece
            this.home = null;              // Piece — starting city and return objective
            this.monsters = [];            // [Piece] — seeded identity colors
            this.gems = [];                 // [{q,r,type}]
            this.inventory = {};
            this.sunstones = 0;
            this.activeEffect = null;       // {gemType,turnsLeft}
            this.effectByGem = {};          // ordinary gem type -> sampled effect id
            this.turn = 1;
            this.mp = GameArtifacts.PLAYER_MP;
            this.status = 'playing';       // 'playing' | 'won' | 'lost'
            this.phase = 'player';         // 'player' | 'monsters'
        }
    }

    return GameState;
})();
