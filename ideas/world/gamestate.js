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
            this.player = null;            // { q, r, hp }
            this.villages = [];            // [{ q, r, hp, name, farms: ["q,r", ...] }]
            this.enemies = [];             // [{ id, q, r, speed, burned, sated, hp, color, homeQ, homeR }]
            this.nextEnemyId = 1;          // raider identity counter (per-raider colors, animation)
            this.prestige = 0;
            this.status = 0;               // rank on the privilege ladder
            this.turn = 1;
            this.mp = GameArtifacts.PLAYER_MP;
            this.phase = 'player';         // 'player' | 'enemy' | 'world' — what is resolving
        }
    }

    return GameState;
})();
