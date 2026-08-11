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
            this.hexes = null;             // Map<"q,r", hex> — each hex carries `explored`
            this.player = null;            // { q, r }
            this.boat = null;              // { q, r } — landing site; escape point
            this.relics = [];              // [{ q, r, taken }] — the tombs
            this.cairns = [];              // [{ q, r, used }] — one-shot reveal stones
            this.hunters = [];             // [{ q, r, speed }] — speed = MP per turn
            this.carried = 0;              // relics taken so far
            this.turn = 1;
            this.mp = GameArtifacts.PLAYER_MP;
            this.night = false;            // true from NIGHT_TURN on: the isle fully awake
            this.gameWon = false;
            this.gameLost = false;         // a hunter reached the player
            this.phase = 'player';         // 'player' | 'enemy' — whose turn is resolving
        }
    }

    return GameState;
})();
