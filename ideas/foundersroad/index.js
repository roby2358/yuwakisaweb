// index.js — bootstrap
//
// Wires the four modules together and starts the game. The split is deliberately
// server-friendly:
//   GameArtifacts — static piece/rule definitions (shared, DOM-free)
//   GameState     — authoritative, serializable game data (server-owned)
//   GameEngine    — rules + generation over a GameState (server-runnable, no DOM)
//   GameUI        — canvas/DOM/input; drives the engine and renders the state (client)
// To go client/server, keep State+Engine on the server and have GameUI send actions
// instead of calling engine methods directly.
const state = new GameState();
const engine = new GameEngine(state);
const ui = new GameUI(engine, document.getElementById('game'));
ui.start();
