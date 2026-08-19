// Authoritative game data. UI state belongs in GameUI.
const GameState = (function () {
    class GameState {
        constructor() {
            this.seed = 0;
            this.hexes = null;
            this.caravan = null;
            this.crownMarket = null;
            this.tradingPosts = [];
            this.raiders = [];
            this.nextRaiderId = 1;
            this.influence = 0;
            this.unrest = 0;
            this.turn = 1;
            this.mp = GameArtifacts.CARAVAN_MP;
            this.phase = GameArtifacts.PHASE.CARAVAN;
            this.outcome = null;
            this.statusMessage = '';
        }
    }

    return GameState;
})();
