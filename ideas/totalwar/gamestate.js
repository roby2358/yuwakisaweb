// gamestate.js — GameState
//
// The authoritative, serializable game data — nothing else. No DOM, no canvas, no
// rules behavior, no view/interaction state (pan, hover, selection, overlays all
// belong to GameUI). This is exactly what a server would own and ship to clients:
// keep it a plain data bag so it stays trivially snapshot-able.
//
// Shapes (all plain data):
//   hex     { q, r, col, row, elevation, isEdge, terrain, owner,
//             city: null | { name, victory, homelandOf, heldTurns, builtThisTurn } }
//   faction { id, name, unique, capital, cp, eliminated, victoryStreak,
//             uniqueCostBump, aiObjective }
//   unit    { id, type, faction, q, r, entrenched, activated, attacked, freeMP }
const GameState = (function () {
    class GameState {
        constructor() {
            this.seed = 0;              // reproducibility anchor for the whole game
            this.hexes = null;          // Map<"q,r", hex>
            this.cityKeys = [];         // hex keys that carry a city (iteration shortcut)
            this.factions = [];         // the four powers, in fixed turn order
            this.units = [];            // every counter on the map, partisans included
            this.playerFaction = null;  // faction id the human commands
            this.nextUnitId = 1;
            this.turn = 1;
            this.phase = 'player';      // 'player' | 'ai' — whose operations are resolving
            this.winner = null;         // faction id once someone completes the countdown
        }
    }

    return GameState;
})();
