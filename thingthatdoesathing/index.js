// index.js — bootstrap
//
// Wires the five modules together and starts the game (D-9):
//   GameArtifacts        — rules data and numbers (DOM-free)
//   GameDisplayArtifacts — colors, names, geometry (client only)
//   GameState            — authoritative, serializable game data
//   GameEngine           — rules + generation over a GameState (no DOM)
//   GameUI               — canvas/DOM/input; drives the engine, animates its events
const state = new GameState();
const engine = new GameEngine(state);
const ui = new GameUI(engine, document.getElementById('game'));
ui.start();
