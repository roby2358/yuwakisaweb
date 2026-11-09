// Runs the real page scripts against a stub DOM for ten simulated minutes.
// Run: node test/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const FRAME_MS = 16;
const SIMULATED_MS = 10 * 60 * 1000;

const counts = { strokes: 0, offCanvas: 0, backdrops: 0, texts: [] };

function assertFinite(x, y) {
    assert(Number.isFinite(x) && Number.isFinite(y), `bad point ${x},${y}`);
}

function makeContext2d() {
    return {
        setTransform() {},
        beginPath() {},
        moveTo: assertFinite,
        lineTo(x, y) {
            assertFinite(x, y);
            counts.strokes += 1;
            if (x < -3000 || x > 4400 || y < -3000 || y > 3800) counts.offCanvas += 1;
        },
        stroke() {},
        fillRect() { counts.backdrops += 1; },
        drawImage() {},
        translate: assertFinite,
        transform() {},
        setLineDash() {},
        save() {},
        restore() {},
        fillText(text, x, y) {
            assertFinite(x, y);
            counts.texts.push(text);
        },
        measureText: text => ({ width: text.length * 6 }),
        createLinearGradient() {
            return { addColorStop(_, color) { assert(/^#[0-9a-f]{6}$/.test(color), `bad color ${color}`); } };
        }
    };
}

function makeElement() {
    const context = makeContext2d();
    return {
        listeners: {},
        hidden: false,
        textContent: '',
        width: 0,
        height: 0,
        offsetLeft: 14,
        offsetTop: 12,
        offsetWidth: 200,
        offsetHeight: 90,
        toBlob: done => done({ type: 'image/png' }),
        getContext: () => context,
        querySelector: () => ({ getAttribute: () => 'M0 0' }),
        setAttribute() {},
        addEventListener(name, fn) { this.listeners[name] = fn; },
        getBoundingClientRect: () => ({ left: 1200, top: 700, width: 40, height: 12 })
    };
}

const elements = {};
const sandbox = {
    Math,
    console,
    document: {
        title: '',
        getElementById: id => (elements[id] = elements[id] || makeElement()),
        createElement: makeElement
    },
    innerWidth: 1400,
    innerHeight: 800,
    devicePixelRatio: 2,
    addEventListener() {},
    requestAnimationFrame: fn => { sandbox.nextFrame = fn; },
    setTimeout,
    getComputedStyle: () => ({
        transform: 'matrix(1, 0, 0, 1, 0, 0)',
        lineHeight: '17px',
        textDecorationLine: 'none',
        fontStyle: 'normal',
        fontWeight: '400',
        fontSize: '12px',
        fontFamily: 'Georgia',
        color: 'rgb(38, 35, 30)',
        backgroundColor: 'rgb(244, 241, 232)'
    }),
    DOMMatrix: class { constructor() { Object.assign(this, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }); } },
    Path2D: class {},
    ClipboardItem: class { constructor(items) { this.items = items; } },
    navigator: {
        clipboard: {
            write: items => { sandbox.copied = items; return Promise.resolve(); },
            writeText: text => { sandbox.copiedText = text; return Promise.resolve(); }
        }
    }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

for (const file of ['../colortheory.js', '../index.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), sandbox, { filename: file });
}
const studio = vm.runInContext('studio', sandbox);

let peak = 0;
let now = 0;
const titles = new Set();

function runFor(ms) {
    for (const end = now + ms; now < end; now += FRAME_MS) {
        sandbox.nextFrame(now);
        peak = Math.max(peak, vm.runInContext('studio.swooshes.length', sandbox));
        titles.add(sandbox.document.title);
    }
}

runFor(SIMULATED_MS);

elements.explanation.hidden = true;
const givenBeforeClick = studio.explanationsGiven;
elements.explain.listeners.click();
assert.strictEqual(elements.explanation.hidden, false, 'explain reveals its explanation');
assert(elements.explanation.textContent.length > 0, 'explain says something');
assert.strictEqual(studio.explanationsGiven, givenBeforeClick + 1, 'explain counts');

const heldTitle = sandbox.document.title;
elements.pause.listeners.click();
runFor(2 * 60 * 1000);
assert.strictEqual(sandbox.document.title, heldTitle, 'pause holds the piece');
assert.strictEqual(vm.runInContext('studio.phase', sandbox), 'resting', 'pause lets the piece finish');

const heldExplanation = studio.explanationsGiven;
elements.pause.listeners.click();
runFor(1000);
assert.notStrictEqual(sandbox.document.title, heldTitle, 'play moves on');
assert.strictEqual(studio.explanationsGiven, heldExplanation + 1, 'a new title brings a new explanation');

assert(counts.strokes > 0, 'swooshes painted');
assert.strictEqual(counts.offCanvas, 0, 'swooshes stay near the window');
assert(titles.size > 2, 'pieces change over time');

async function checkSnapshot() {
    const camera = '\u{1F4F8}';
    elements.snapshot.textContent = camera;
    elements.explain.textContent = 'explain';
    elements['placard-title'].textContent = 'A Very Long Title That Will Certainly Need Some Wrapping Today';

    await elements.snapshot.listeners.click();

    assert(counts.texts.includes(camera), 'the camera is in the picture');
    assert(counts.texts.includes('explain'), 'the placard is in the picture');
    assert(counts.texts.filter(text => text.startsWith('A Very') || text.endsWith('Today')).length === 2, 'long titles wrap');
    const png = await sandbox.copied[0].items['image/png'];
    assert.strictEqual(png.type, 'image/png', 'a PNG reaches the clipboard');
    assert.strictEqual(elements.snapshot.textContent, '✓', 'the camera acknowledges the copy');

    await elements.palette.listeners.click();
    assert(/^(#[0-9a-f]{6}\n){4}#[0-9a-f]{6}$/.test(sandbox.copiedText), `palette copied: ${sandbox.copiedText}`);
}

checkSnapshot().then(() => {
    console.log(`ok: ${counts.strokes} strokes, ${titles.size} pieces, peak ${peak} swooshes at once, snapshot copied`);
});
