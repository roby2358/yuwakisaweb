// index.js — bootstrap
//
// Wires the five modules together and starts the game (D-9):
//   GameArtifacts        — rules data and numbers (DOM-free)
//   GameDisplayArtifacts — colors, names, geometry (client only)
//   GameState            — authoritative, serializable game data
//   GameEngine           — rules + generation over a GameState (no DOM)
//   GameUI               — canvas/DOM/input; drives the engine, animates its events
//
// A phone or tablet (coarse pointer, no hover) gets the sorry page instead: no board, no
// engine, no input (D-41). A browser without matchMedia counts as a desktop.
// The sorry page offers "Try it anyway", which builds the game then, as on a desktop.
const touchOnly = typeof window.matchMedia === 'function' &&
    window.matchMedia(GameDisplayArtifacts.TOUCH_ONLY_QUERY).matches;
let state = null, engine = null, ui = null;
function boot() {
    state = new GameState();
    engine = new GameEngine(state);
    ui = new GameUI(engine, document.getElementById('game'));
    ui.start();
}
if (touchOnly) GameUI.showSorry(boot);
else boot();
