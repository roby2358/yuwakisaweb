// index.js — bootstrap: state ← engine ← ui, then hand control to the browser.
const state = new GameState();
const engine = new GameEngine(state);
const ui = new GameUI(engine, document.getElementById('game'));
ui.start();
