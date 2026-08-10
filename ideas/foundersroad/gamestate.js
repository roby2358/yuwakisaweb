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
            this.hexes = null;             // Map<"q,r", hex> (hex.road marks laid roads)
            this.workers = [];             // [{ id, q, r, mp }] — the player's crew
            this.buildings = [];           // [{ id, type, q, r }] — type keys GameArtifacts.BUILDINGS
            this.beasts = [];              // [{ q, r, speed }]
            this.monument = null;          // { q, r, stage } — stage 0..3 complete
            this.resources = null;         // { wood, stone, gold } global stockpile
            this.workerPalette = [];       // ['#rrggbb'] per-game crew colors (piece identity)
            this.beastPalette = [];        // ['#rrggbb'] per-game beast colors
            this.nextId = 1;               // id counter for workers/buildings
            this.turn = 1;
            this.gameWon = false;
            this.phase = 'player';         // 'player' | 'enemy' — whose turn is resolving
        }
    }

    return GameState;
})();
