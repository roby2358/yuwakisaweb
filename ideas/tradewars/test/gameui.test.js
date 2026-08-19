const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modules = [
    'artifacts.js', 'rando.js', 'colortheory.js', 'displayartifacts.js', 'hex.js',
    'piece.js', 'domain.js', 'board.js', 'gamestate.js', 'gameengine.js', 'gameui.js'
];
const source = modules.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n;\n');
const preamble = `
class GameSound {
    step() {}
    endTurn() {}
    fanfare() {}
}
`;
const bridge = '\n;Object.assign(__exports, { GameState, GameEngine, GameUI, GameDisplayArtifacts, Hex });';
const context = vm.createContext({ console, __exports: {} });
vm.runInContext(preamble + source + bridge, context, { filename: 'gameui-combined.js' });

const { GameState, GameEngine, GameUI, GameDisplayArtifacts, Hex } = context.__exports;

const palette = GameDisplayArtifacts.createRaiderPalette(12345);
assert.equal(palette.length, 5, 'raiders use a five-color monochrome palette');
assert.deepEqual(palette, GameDisplayArtifacts.createRaiderPalette(12345), 'palette is stable for a game seed');
assert.equal(palette.every(color => {
    const [, red, green, blue] = color.match(/^#(..)(..)(..)$/);
    return parseInt(red, 16) >= parseInt(green, 16) && green === blue;
}), true, 'palette colors stay on the red monochrome axis');
const state = new GameState();
const engine = new GameEngine(state);
engine.newGame(12345);

const canvas = { getContext: () => ({}) };
const ui = new GameUI(engine, canvas);
ui.raiderPalette = palette;
ui.render = () => {};
ui.panX = 0;
ui.panY = 0;

const caravanPoint = new Hex(state.caravan.q, state.caravan.r).toPixel();
ui.onClick({ clientX: caravanPoint.x, clientY: caravanPoint.y });
assert.ok(ui.selection, 'clicking the caravan selects it');

const destinationKey = ui.selection.reachable.keys().next().value;
assert.ok(destinationKey, 'selection exposes a reachable destination');
const destination = Hex.fromKey(destinationKey);
const destinationPoint = destination.toPixel();
ui.onClick({ clientX: destinationPoint.x, clientY: destinationPoint.y });
assert.equal(state.caravan.isAt(destination.q, destination.r), true, 'clicking a highlighted hex moves the caravan');

console.log('Game UI click test passed.');
