// index.js — bootstrap
//
// Wires the intro panel, save/load, and hands the state to GameUI. Autosave is a
// single JSON blob in localStorage; no migration while we prototype — old saves
// may simply break.
(function () {
    const SAVE_KEY = 'augur-save';
    let state = null;

    function save() {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state.toJSON()));
    }

    function begin(newState) {
        state = newState;
        document.getElementById('intro-panel').classList.add('hidden');
        GameUI.setState(state);
        save();
    }

    function newGame() {
        begin(GameEngine.newGame(Math.floor(Math.random() * 2 ** 31)));
    }

    function loadGame() {
        const raw = localStorage.getItem(SAVE_KEY);
        const loaded = GameState.fromJSON(JSON.parse(raw));
        // The RNG stream position isn't stored; re-seed deterministically off the day
        // so a reloaded vale keeps rolling without replaying old rolls.
        Rando.seed(loaded.seed + loaded.day * 7919);
        begin(loaded);
    }

    GameUI.init(save);

    // The howto card remembers whether the player folded it away.
    const HOWTO_KEY = 'augur-howto-open';
    const howto = document.getElementById('howto-card');
    howto.open = localStorage.getItem(HOWTO_KEY) !== 'closed';
    howto.addEventListener('toggle', () => {
        localStorage.setItem(HOWTO_KEY, howto.open ? 'open' : 'closed');
    });

    const hasSave = localStorage.getItem(SAVE_KEY) !== null;
    const continueBtn = document.getElementById('continue-btn');
    if (hasSave) continueBtn.classList.remove('hidden');
    continueBtn.addEventListener('click', loadGame);
    document.getElementById('begin-btn').addEventListener('click', newGame);
    document.getElementById('new-game').addEventListener('click', newGame);
})();
