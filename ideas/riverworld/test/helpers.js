// Loads the browser script-tag files into a shared vm context, exactly as a
// sequence of <script> tags would — no ES modules, matching the game itself.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const LOGIC_FILES = ['hex.js', 'data.js', 'map.js', 'game.js'];

function loadLogic() {
  const ctx = vm.createContext({ console });
  for (const file of LOGIC_FILES) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
    vm.runInContext(src, ctx, { filename: file });
  }
  return ctx;
}

const TEST_LEADER = 'Test Leader';

// A fresh game with all slavers removed — for tests that must not be
// interrupted by the enemy phase.
function calmGame(ctx, seed) {
  const S = ctx.Game.newGame(seed, TEST_LEADER);
  S.units = S.units.filter(u => u.side === 'party');
  return S;
}

function freeStones(ctx, S) {
  return S.stones.filter(st => !S.tiles[st.r][st.c].stone.slaver);
}

module.exports = { loadLogic, calmGame, freeStones, TEST_LEADER };
