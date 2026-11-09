// Swoosh. A palette from ColorTheory, a backdrop from two of its colors, and
// ribbons of thread that wander the window walking the palette's gradient.
// When a piece has had enough swooshes it rests, then washes into the next one.

const STEP_PIXELS = 3;
const MAX_FRAME_SECONDS = 0.05;
const MAX_PIXEL_RATIO = 2;
const REFERENCE_SIZE = 800; // the window's short side at which sizes are 1:1

const COLORMAP_SIZE = 1024;
// ColorTheory.gradient holds its last color flat for the final 1/n of the ramp
// (n = 5 colors), so a full traversal stops where the last color arrives.
const RAMP_END = 0.8;

const HOMING_TURN = 0.012;  // radians per pixel, turning back toward the window
const HOMING_RAMP = 150;    // pixels outside the window to reach full homing
const SHY_TURN = 0.022;     // radians per pixel, turning away from the pointer
const SHY_RADIUS = 240;

const REST_SECONDS = 6;
const WASH_SECONDS = 4;

const COPIED_MS = 1200;
const UNDERLINE_DROP = 6;
const EASEL_STROKE = 1.3; // matches the easel's stroke-width in index.html
const PAUSE_ICON = '⏸︎';
const PLAY_ICON = '▶︎';
const PLACARD_SHADOWS = [ // the same two shadows as .placard in index.css
    { color: 'rgba(0, 0, 0, 0.35)', offsetY: 1, blur: 2 },
    { color: 'rgba(0, 0, 0, 0.2)', offsetY: 6, blur: 18 }
];

const HABITS = [
    { bristles: 70, halfWidth: 80, bristleWidth: 1.2, alpha: 0.75, twist: 0.006, fray: 0.02, sheen: 0.08 },  // silk
    { bristles: 130, halfWidth: 170, bristleWidth: 0.8, alpha: 0.28, twist: 0.0025, fray: 0.06, sheen: 0.18 }, // veil
    { bristles: 9, halfWidth: 110, bristleWidth: 2.4, alpha: 0.9, twist: 0.004, fray: 0, sheen: 0.04 },      // comb
    { bristles: 46, halfWidth: 34, bristleWidth: 2.4, alpha: 1, twist: 0.0015, fray: 0.01, sheen: 0.12 }     // brush
];

const BACKDROP_LINES = [
    [0, 0, 1, 1], // corner to corner
    [1, 0, 0, 1], // the other corners
    [0, 0, 0, 1]  // top to bottom
];

const TITLE_OPENERS = [
    'Study for', 'Second Attempt at', 'Notes Toward', 'Apology to', 'Minor Incident Near',
    'An Arrangement Regarding', 'Remembering', 'Preliminary Sketch of', 'Against', 'In Lieu of'
];

const TITLE_SUBJECTS = [
    'the Soup', 'a Tuesday', 'Your Aunt\'s Hallway', 'Wet Geometry', 'the Long Way Round',
    'an Unattended Scarf', 'the Concept of Later', 'Several Eels', 'a Lake, Reconsidered',
    'What the Stairs Knew', 'the Other Spoon', 'a Polite Disagreement'
];

const EXPLANATIONS = [
    'It\'s mostly about the second one.',
    'The curve is the part that curves.',
    'You had to be there, and you are, so.',
    'Imagine a river that has given up on the sea but not on going.',
    'There was going to be a point. It went that way.',
    'Think of it as a spreadsheet, then stop.',
    'The colors were already arguing when we got here.',
    'My lawyer says it\'s a ribbon.',
    'No.',
    'Okay, ask me again.'
];

function between(low, high) {
    return low + Math.random() * (high - low);
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

// The shortest signed turn from one angle to another.
function angleDelta(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

class Swoosh {
    constructor(x, y, heading, habit, length, unit, colormap) {
        this.x = x;
        this.y = y;
        this.heading = heading;
        this.habit = habit;
        this.length = length;
        this.unit = unit;
        this.colormap = colormap;
        this.travelled = 0;
        this.owedSteps = 0;
        this.pace = between(700, 1500) * unit / STEP_PIXELS;
        this.bends = Swoosh.rollBends(unit);
        this.twistRate = habit.twist * between(0.6, 1.4) / unit;
        this.twistPhase = between(0, Math.PI * 2);

        const forward = Math.random() < 0.5;
        this.rampFrom = forward ? 0 : RAMP_END;
        this.rampTo = forward ? RAMP_END : 0;
        this.threads = Swoosh.spinThreads(habit.bristles, unit);
    }

    static rollBends(unit) {
        return {
            drift: between(-0.002, 0.002) / unit,
            slowAmp: between(0.002, 0.008) / unit,
            slowFreq: between(0.001, 0.004) / unit,
            slowPhase: between(0, Math.PI * 2),
            fastAmp: between(0.001, 0.005) / unit,
            fastFreq: between(0.006, 0.014) / unit,
            fastPhase: between(0, Math.PI * 2)
        };
    }

    static spinThreads(count, unit) {
        return Array.from({ length: count }, (_, i) => ({
            across: -1 + 2 * i / (count - 1),
            frayFreq: between(0.004, 0.03) / unit,
            frayPhase: between(0, Math.PI * 2),
            lastX: null,
            lastY: null
        }));
    }

    progress() {
        return Math.min(1, this.travelled / this.length);
    }

    isDone() {
        return this.travelled >= this.length;
    }

    // A swoosh whooshes: slow at both ends, fastest through the middle.
    advance(ctx, view, seconds) {
        this.owedSteps += seconds * this.pace * (0.3 + Math.sin(Math.PI * this.progress()));
        while (this.owedSteps >= 1 && !this.isDone()) {
            this.owedSteps -= 1;
            this.step(ctx, view);
        }
    }

    step(ctx, view) {
        this.heading += this.turn(view) * STEP_PIXELS;
        this.x += Math.cos(this.heading) * STEP_PIXELS;
        this.y += Math.sin(this.heading) * STEP_PIXELS;
        this.travelled += STEP_PIXELS;

        const t = this.progress();
        const taper = Math.pow(Math.sin(Math.PI * t), 0.7);
        const twist = Math.cos(this.twistRate * this.travelled + this.twistPhase);
        const breadth = this.habit.halfWidth * this.unit * taper * twist;
        const rampAt = this.rampFrom + (this.rampTo - this.rampFrom) * t;

        ctx.globalAlpha = this.habit.alpha;
        ctx.lineWidth = this.habit.bristleWidth * Math.max(0.7, this.unit);
        for (const thread of this.threads) {
            this.drawThread(ctx, thread, breadth, rampAt + this.habit.sheen * thread.across * twist);
        }
    }

    turn(view) {
        const b = this.bends;
        const curl = b.drift
            + b.slowAmp * Math.sin(b.slowFreq * this.travelled + b.slowPhase)
            + b.fastAmp * Math.sin(b.fastFreq * this.travelled + b.fastPhase);
        return curl + this.homing(view) + this.shyness(view);
    }

    homing(view) {
        const outside = Math.max(-this.x, this.x - view.width, -this.y, this.y - view.height);
        if (outside <= 0) return 0;
        const home = Math.atan2(view.height / 2 - this.y, view.width / 2 - this.x);
        const urgency = Math.min(1, outside / (HOMING_RAMP * this.unit));
        return angleDelta(this.heading, home) * urgency * HOMING_TURN / this.unit;
    }

    shyness(view) {
        if (view.pointer === null) return 0;
        const dx = view.pointer.x - this.x;
        const dy = view.pointer.y - this.y;
        const radius = SHY_RADIUS * this.unit;
        const distance = Math.hypot(dx, dy);
        if (distance >= radius) return 0;
        const towardPointer = angleDelta(this.heading, Math.atan2(dy, dx));
        return -Math.sign(towardPointer) * (1 - distance / radius) * SHY_TURN / this.unit;
    }

    drawThread(ctx, thread, breadth, rampAt) {
        const wander = this.habit.fray * Math.sin(thread.frayFreq * this.travelled + thread.frayPhase);
        const offset = breadth * (thread.across + wander);
        const x = this.x - Math.sin(this.heading) * offset;
        const y = this.y + Math.cos(this.heading) * offset;

        if (thread.lastX !== null) {
            const color = this.colormap.apply(rampAt);
            ctx.strokeStyle = ColorTheory.rgbToHex(color.r, color.g, color.b);
            ctx.beginPath();
            ctx.moveTo(thread.lastX, thread.lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        thread.lastX = x;
        thread.lastY = y;
    }
}

function composePiece() {
    const schemeName = pick(Object.keys(ColorTheory.SchemeGenerators));
    const radial = { a: Math.random(), r: ColorTheory.randomR(Math.random) };
    const palette = ColorTheory.SchemeGenerators[schemeName](radial, Math.random);

    const fromIndex = Math.floor(Math.random() * palette.length);
    const toIndex = (fromIndex + 1 + Math.floor(Math.random() * (palette.length - 1))) % palette.length;

    return {
        title: `${pick(TITLE_OPENERS)} ${pick(TITLE_SUBJECTS)}`,
        schemeName,
        palette,
        colormap: new ColorTheory(COLORMAP_SIZE, palette),
        backdrop: { from: palette[fromIndex], to: palette[toIndex], line: pick(BACKDROP_LINES) },
        quota: Math.floor(between(14, 35)),
        launched: 0
    };
}

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const placard = {
    panel: document.getElementById('placard'),
    title: document.getElementById('placard-title'),
    medium: document.getElementById('placard-medium'),
    count: document.getElementById('placard-count'),
    explain: document.getElementById('explain'),
    explanation: document.getElementById('explanation'),
    palette: document.getElementById('palette'),
    pause: document.getElementById('pause'),
    snapshot: document.getElementById('snapshot')
};
const easelShape = new Path2D(placard.palette.querySelector('path').getAttribute('d'));

const view = { width: 0, height: 0, unit: 1, pointer: null };
const studio = {
    piece: composePiece(),
    swooshes: [],
    phase: 'painting',
    clock: 0,
    lastFrame: 0,
    explanationsGiven: 0,
    paused: false
};

function paintBackdrop(alpha) {
    const { from, to, line } = studio.piece.backdrop;
    const fill = ctx.createLinearGradient(
        line[0] * view.width, line[1] * view.height,
        line[2] * view.width, line[3] * view.height
    );
    fill.addColorStop(0, ColorTheory.rgbToHex(...from));
    fill.addColorStop(1, ColorTheory.rgbToHex(...to));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, view.width, view.height);
}

function showPlacard() {
    const words = studio.piece.schemeName.replace(/([A-Z])/g, ' $1').toLowerCase();
    placard.title.textContent = studio.piece.title;
    placard.medium.textContent = `${words} on window`;
    showCount();
    document.title = studio.piece.title;
}

function showCount() {
    const n = studio.piece.launched;
    placard.count.textContent = `${n} ${n === 1 ? 'swoosh' : 'swooshes'}, not for sale`;
}

function launch(x, y, heading) {
    const diagonal = Math.hypot(view.width, view.height);
    studio.swooshes.push(new Swoosh(
        x, y, heading, pick(HABITS), between(1.1, 2.6) * diagonal, view.unit, studio.piece.colormap
    ));
    studio.piece.launched += 1;
    showCount();
}

function launchFromBeyond() {
    const bearing = between(0, Math.PI * 2);
    const reach = Math.hypot(view.width, view.height) / 2;
    const heading = bearing + Math.PI + between(-0.7, 0.7);
    launch(view.width / 2 + Math.cos(bearing) * reach, view.height / 2 + Math.sin(bearing) * reach, heading);
}

const PHASES = {
    painting(seconds) {
        const piece = studio.piece;
        studio.clock -= seconds;
        if (piece.launched < piece.quota && studio.clock <= 0) {
            launchFromBeyond();
            studio.clock = between(0.3, 2.4);
        }
        if (piece.launched < piece.quota || studio.swooshes.length > 0) return;
        studio.phase = 'resting';
        studio.clock = REST_SECONDS;
    },

    resting(seconds) {
        studio.clock -= seconds;
        if (studio.clock > 0 || studio.paused) return;
        studio.piece = composePiece();
        showPlacard();
        nextExplanation();
        studio.phase = 'washing';
        studio.clock = WASH_SECONDS;
    },

    // Each frame covers its share of what's left, so the last frame lands at 100%.
    washing(seconds) {
        paintBackdrop(Math.min(1, seconds / studio.clock));
        studio.clock -= seconds;
        if (studio.clock > 0) return;
        studio.phase = 'painting';
        studio.clock = 0;
    }
};

function frame(now) {
    const seconds = Math.min(MAX_FRAME_SECONDS, (now - studio.lastFrame) / 1000);
    studio.lastFrame = now;
    PHASES[studio.phase](seconds);
    for (const swoosh of studio.swooshes) swoosh.advance(ctx, view, seconds);
    studio.swooshes = studio.swooshes.filter(swoosh => !swoosh.isDone());
    requestAnimationFrame(frame);
}

function fitCanvas() {
    const ratio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio);
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    view.unit = Math.min(view.width, view.height) / REFERENCE_SIZE;
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

// Whatever was painted gets stretched to the new window.
function resize() {
    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext('2d').drawImage(canvas, 0, 0);
    fitCanvas();
    ctx.drawImage(snapshot, 0, 0, view.width, view.height);
}

function say(text) {
    placard.explanation.textContent = text;
    placard.explanation.hidden = false;
}

function nextExplanation() {
    say(EXPLANATIONS[studio.explanationsGiven % EXPLANATIONS.length]);
    studio.explanationsGiven += 1;
}

function explain() {
    nextExplanation();

    const box = placard.explain.getBoundingClientRect();
    launch(box.left + box.width / 2, box.top + box.height / 2, between(0, Math.PI * 2));
}

function wrapLines(target, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
        const longer = line === '' ? word : `${line} ${word}`;
        if (line !== '' && target.measureText(longer).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = longer;
        }
    }
    lines.push(line);
    return lines;
}

function drawPlacardText(target, element) {
    if (element.hidden) return;
    const style = getComputedStyle(element);
    const lineHeight = parseFloat(style.lineHeight);
    const underlined = style.textDecorationLine === 'underline';
    target.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    target.fillStyle = style.color;
    target.strokeStyle = style.color;
    target.textBaseline = 'middle';
    target.lineWidth = 1;
    target.setLineDash([1, 1.5]);

    wrapLines(target, element.textContent, element.offsetWidth).forEach((line, i) => {
        const y = element.offsetTop + lineHeight * (i + 0.5);
        target.fillText(line, element.offsetLeft, y);
        if (!underlined) return;
        target.beginPath();
        target.moveTo(element.offsetLeft, y + UNDERLINE_DROP);
        target.lineTo(element.offsetLeft + target.measureText(line).width, y + UNDERLINE_DROP);
        target.stroke();
    });
}

// The canvas can't capture HTML, so the placard is redrawn from its live layout.
function drawPlacard(target, scale) {
    const panel = placard.panel;
    const style = getComputedStyle(panel);
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const tilt = new DOMMatrix(style.transform);

    target.setTransform(scale, 0, 0, scale, 0, 0);
    target.translate(panel.offsetLeft + width / 2, panel.offsetTop + height / 2);
    target.transform(tilt.a, tilt.b, tilt.c, tilt.d, tilt.e, tilt.f);
    target.translate(-width / 2, -height / 2);

    target.fillStyle = style.backgroundColor;
    for (const shadow of PLACARD_SHADOWS) {
        target.shadowColor = shadow.color;
        target.shadowOffsetY = shadow.offsetY * scale; // canvas shadows ignore the transform
        target.shadowBlur = shadow.blur * scale;
        target.fillRect(0, 0, width, height);
    }
    target.shadowColor = 'transparent';

    const texts = [placard.title, placard.medium, placard.count, placard.explanation, placard.explain, placard.pause, placard.snapshot];
    for (const element of texts) drawPlacardText(target, element);
    drawEasel(target);
}

function drawEasel(target) {
    const button = placard.palette;
    target.save();
    target.translate(button.offsetLeft, button.offsetTop);
    target.strokeStyle = getComputedStyle(button).color;
    target.lineWidth = EASEL_STROKE;
    target.lineCap = 'round';
    target.setLineDash([]);
    target.stroke(easelShape);
    target.restore();
}

function composeShot() {
    const shot = document.createElement('canvas');
    shot.width = canvas.width;
    shot.height = canvas.height;
    const target = shot.getContext('2d');
    target.drawImage(canvas, 0, 0);
    drawPlacard(target, canvas.width / view.width);
    return shot;
}

function acknowledgeCopy(button) {
    const icon = button.innerHTML;
    button.textContent = '✓';
    button.disabled = true;
    setTimeout(() => {
        button.innerHTML = icon;
        button.disabled = false;
    }, COPIED_MS);
}

async function copyWith(button, write) {
    try {
        await write();
        acknowledgeCopy(button);
    } catch (error) {
        say(`The clipboard declined: ${error.message}`);
    }
}

// Safari only allows the write if it starts during the click, so the clipboard
// is handed a promise for the PNG rather than waiting for the PNG first.
function copyPicture() {
    const shot = composeShot();
    const png = new Promise(resolve => shot.toBlob(resolve, 'image/png'));
    return copyWith(placard.snapshot, () => navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]));
}

function copyPalette() {
    const hexes = studio.piece.palette.map(color => ColorTheory.rgbToHex(...color));
    return copyWith(placard.palette, () => navigator.clipboard.writeText(hexes.join('\n')));
}

function showPauseState() {
    const label = studio.paused ? 'Carry on to the next piece' : 'Stay on this piece';
    placard.pause.textContent = studio.paused ? PAUSE_ICON : PLAY_ICON; // shows the state, not the action
    placard.pause.title = label;
    placard.pause.setAttribute('aria-label', label);
}

function togglePause() {
    studio.paused = !studio.paused;
    showPauseState();
}

window.addEventListener('resize', resize);
window.addEventListener('pointermove', event => {
    view.pointer = { x: event.clientX, y: event.clientY };
});
window.addEventListener('pointerout', event => {
    if (event.relatedTarget === null) view.pointer = null;
});
canvas.addEventListener('click', event => launch(event.clientX, event.clientY, between(0, Math.PI * 2)));
placard.explain.addEventListener('click', explain);
placard.snapshot.addEventListener('click', copyPicture);
placard.palette.addEventListener('click', copyPalette);
placard.pause.addEventListener('click', togglePause);

fitCanvas();
paintBackdrop(1);
showPlacard();
showPauseState();
requestAnimationFrame(frame);
