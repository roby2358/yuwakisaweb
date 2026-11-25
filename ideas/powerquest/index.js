// index.js — bootstrap
//
// Wires the modules together and starts the game. The split is server-friendly:
//   GameArtifacts — static rules-data (shared, DOM-free)
//   GameState     — authoritative, serializable game data
//   GameEngine    — rules over a GameState, with WorldGen and Ecology (server-runnable, no DOM)
//   GameUI        — canvas/DOM/input; drives the engine and renders the state (client)
const state = new GameState();
const engine = new GameEngine(state);
const ui = new GameUI(engine, document.getElementById('game'));
ui.start();
