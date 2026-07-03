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
            this.player = null;            // { q, r }
            this.target = null;            // { q, r }
            this.enemies = [];             // [{ q, r }]
            this.enemyColors = [];         // ['#rrggbb'] parallel to enemies (piece identity)
            this.turn = 1;
            this.mp = GameArtifacts.PLAYER_MP;
            this.gameWon = false;
            this.phase = 'player';         // 'player' | 'enemy' — whose turn is resolving
        }
    }

    return GameState;
})();
