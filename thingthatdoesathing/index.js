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
const touchOnly = typeof window.matchMedia === 'function' &&
    window.matchMedia(GameDisplayArtifacts.TOUCH_ONLY_QUERY).matches;
const state = touchOnly ? null : new GameState();
const engine = touchOnly ? null : new GameEngine(state);
const ui = touchOnly ? null : new GameUI(engine, document.getElementById('game'));
if (touchOnly) GameUI.showSorry();
else ui.start();
