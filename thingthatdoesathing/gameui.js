// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering, the DOM HUD and hand, camera/pan,
// tick animation, and all input wiring. It owns the view and interaction state (picked
// card, hover, pan, overlay, animation) — none of which is game state — and drives
// GameEngine through its commands, animating each tick from the events it returns.
//
// Input dispatch follows UI_CONTROLS.md (its layers cited as L1.2 etc.): overlay → animation →
// picked card → bare map click. Go/Pause keeps issuing Waits between animations.
const GameUI = (function () {
    const {
        HEX_SIZE, COUNTER_SIZE, HOP_MS, RUN_GAP_MS, MILESTONE_MS, TERRAIN_COLORS, TERRAIN_NAMES, THING_LOOK,
        PIECE_LOOK, CRATE_SHADES, BIG_CRATE_SCALE, COLOR_INK, SPLAT_BLOTS, SOURCE_COLOR, BG_COLOR, UI_FONT, REACH_COLOR, MAP_SIZE_NOTES,
        COLOR_PICKER_PX
    } = GameDisplayArtifacts;
    const { TERRAIN, THINGS, WHITE, HAND_SIZE, MAP_SIZES, aims, nextMilestone } = GameArtifacts;
    const SIZE_KEYS = Object.keys(MAP_SIZES);
    // A splat burst's color, by piece kind: a gremlin's own color, a crate's side face.
    const SPLAT_COLOR = {
        crate: p => CRATE_SHADES[p.color].left,
        bigcrate: p => CRATE_SHADES[p.color].left,
        gremlin: p => p.color,
    };
    const END_CUES = ['deliver', 'splat', 'sink'];   // the one sound a tick's endings play, by priority
    // A card's picture on a small canvas `px` square (the news panel and the milestone banner).
    function cardPicture(kind, px) {
        const c = document.createElement('canvas');
        c.width = c.height = px;
        drawThing(c.getContext('2d'), px / 2, px / 2, px * 5 / 12, kind, WHITE, aims(kind) ? 0 : null, 1);
        return c;
    }
    const OVERLAY_PANELS = { intro: 'intro-panel', size: 'size-panel', news: 'news-panel', help: 'help-panel', color: 'color-panel' };   // L5 overlay → its panel
    // L5: what a key does on each overlay. The size pickers take their number keys (and Esc
    // when a game is behind); the news panel (new colors) and the keys legend close
    // on any key; the color picker takes its swatch numbers and Esc.
    const OVERLAY_KEYS = {
        intro: (ui, e) => ui.sizeKey(e),
        size: (ui, e) => ui.sizeKey(e),
        news: ui => ui.dismissOverlay(),
        help: ui => ui.dismissOverlay(),
        color: (ui, e) => ui.colorKey(e),
    };

    const DRAG_THRESHOLD = 4;

    // How each kind of piece is drawn. `p` is a live Piece or the animation's pre-tick
    // snapshot of one.
    const PIECE_DRAW = {
        crate:   (ui, x, y, p, alpha, scale) => ui.drawCrate(x, y, CRATE_SHADES[p.color], alpha, scale),
        bigcrate: (ui, x, y, p, alpha, scale) => ui.drawCrate(x, y, CRATE_SHADES[p.color], alpha, scale * BIG_CRATE_SCALE),
        gremlin: (ui, x, y, p, alpha, scale) => ui.drawCounter(x, y, p.color, p.label, alpha, scale),
    };

    // Screen angle of a facing (pointy-top axial direction → pixels).
    function facingAngle(facing) {
        const d = NEIGHBOR_DIRS[facing];
        const p = new Hex(d.q, d.r).toPixel();
        return Math.atan2(p.y, p.x);
    }

    // A chevron pointing +x with its tip at (cx, 0), half-height w.
    function chevron(ctx, cx, w) {
        ctx.beginPath();
        ctx.moveTo(cx - w, -w);
        ctx.lineTo(cx, 0);
        ctx.lineTo(cx - w, w);
        ctx.stroke();
    }

    // Each Thing kind's glyph, drawn in the Thing's ink at the origin with hex radius s.
    // Facing glyphs are drawn pointing +x; drawThing has already rotated to the facing.
    const GLYPHS = {
        BELT(ctx, s) {
            chevron(ctx, -s * 0.12, s * 0.26);
            chevron(ctx, s * 0.28, s * 0.26);
        },
        SPRING(ctx, s) {
            // A coil, then a big arrowhead: it throws far.
            ctx.beginPath();
            const n = 5, x0 = -s * 0.55, x1 = s * 0.05, h = s * 0.22;
            ctx.moveTo(x0, 0);
            for (let i = 0; i < n; i++) ctx.lineTo(x0 + (x1 - x0) * (i + 0.5) / n, i % 2 ? h : -h);
            ctx.lineTo(x1, 0);
            ctx.stroke();
            chevron(ctx, s * 0.5, s * 0.3);
        },
        PUSHER(ctx, s) {
            // A ram: a back plate, a rod, a flat head at the hex edge, and a chevron beyond
            // it: it shoves what's in front of it on.
            ctx.beginPath();
            ctx.moveTo(-s * 0.45, -s * 0.22); ctx.lineTo(-s * 0.45, s * 0.22);
            ctx.moveTo(-s * 0.45, 0); ctx.lineTo(s * 0.25, 0);
            ctx.moveTo(s * 0.25, -s * 0.3); ctx.lineTo(s * 0.25, s * 0.3);
            ctx.stroke();
            chevron(ctx, s * 0.55, s * 0.18);
        },
        PULLER(ctx, s) {
            // A short horseshoe magnet opening toward its facing, with an arrow (stem and
            // head) pointing back into it: it reaches out that way and pulls things in.
            ctx.beginPath();
            ctx.arc(-s * 0.22, 0, s * 0.28, Math.PI * 0.5, Math.PI * 1.5);
            ctx.lineTo(s * 0.05, -s * 0.28);
            ctx.moveTo(-s * 0.22, s * 0.28);
            ctx.lineTo(s * 0.05, s * 0.28);
            ctx.moveTo(s * 0.62, 0);
            ctx.lineTo(s * 0.14, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s * 0.3, -s * 0.16);
            ctx.lineTo(s * 0.14, 0);
            ctx.lineTo(s * 0.3, s * 0.16);
            ctx.stroke();
        },
        ROCKET(ctx, s) {
            // A body with a pointed nose, two fins at the back, and exhaust: it flies far.
            ctx.beginPath();
            ctx.moveTo(s * 0.55, 0);
            ctx.lineTo(s * 0.25, -s * 0.16);
            ctx.lineTo(-s * 0.3, -s * 0.16);
            ctx.lineTo(-s * 0.3, s * 0.16);
            ctx.lineTo(s * 0.25, s * 0.16);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-s * 0.15, -s * 0.16); ctx.lineTo(-s * 0.4, -s * 0.36); ctx.lineTo(-s * 0.3, -s * 0.16);
            ctx.moveTo(-s * 0.15, s * 0.16); ctx.lineTo(-s * 0.4, s * 0.36); ctx.lineTo(-s * 0.3, s * 0.16);
            ctx.stroke();
            ctx.lineWidth = Math.max(1, s * 0.06);
            for (const yy of [-0.08, 0.08]) {
                ctx.beginPath(); ctx.moveTo(-s * 0.42, yy * s); ctx.lineTo(-s * 0.7, yy * s * 1.6); ctx.stroke();
            }
        },
        CANNON(ctx, s) {
            // A barrel on a round carriage wheel, a ball leaving the muzzle in a dotted arc:
            // it lobs what's on it over 4 hexes and down on the 5th.
            ctx.beginPath();
            ctx.moveTo(-s * 0.45, -s * 0.14);
            ctx.lineTo(s * 0.2, -s * 0.2);
            ctx.lineTo(s * 0.2, s * 0.2);
            ctx.lineTo(-s * 0.45, s * 0.14);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-s * 0.2, s * 0.22, s * 0.16, 0, Math.PI * 2);
            ctx.stroke();
            for (const [xx, yy, rr] of [[0.36, -0.12, 0.05], [0.5, -0.2, 0.05], [0.64, -0.12, 0.09]]) {
                ctx.beginPath();
                ctx.arc(xx * s, yy * s, rr * s, 0, Math.PI * 2);
                ctx.fill();
            }
        },
        TRAP(ctx, s) {
            // Open jaws: a ring with teeth pointing in, and the trigger plate in the middle.
            const r = s * 0.5, n = 8;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const a = (i + 0.5) / n * Math.PI * 2, a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
                ctx.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
                ctx.lineTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
                ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
            }
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2);
            ctx.fill();
        },
        WALL(ctx, s) {
            ctx.lineWidth = Math.max(1, s * 0.05);
            for (const yy of [-0.3, 0, 0.3]) {
                ctx.beginPath(); ctx.moveTo(-s * 0.8, yy * s); ctx.lineTo(s * 0.8, yy * s); ctx.stroke();
            }
            for (const [xx, y0] of [[-0.25, -0.3], [0.3, -0.3], [0, 0], [-0.5, 0], [0.5, 0], [-0.25, 0.3], [0.3, 0.3]]) {
                ctx.beginPath(); ctx.moveTo(xx * s, y0 * s); ctx.lineTo(xx * s, (y0 + 0.3) * s); ctx.stroke();
            }
        },
        BRIDGE(ctx, s) {
            // Faint planks across the way it carries, and a belt's chevron over them: a deck
            // that moves what's on it 1 hex.
            const width = ctx.lineWidth;
            ctx.lineWidth = Math.max(1, s * 0.05);
            ctx.globalAlpha *= 0.45;
            for (let i = -3; i <= 3; i++) {
                ctx.beginPath(); ctx.moveTo(i * s * 0.18, -s * 0.55); ctx.lineTo(i * s * 0.18, s * 0.55); ctx.stroke();
            }
            ctx.globalAlpha /= 0.45;
            ctx.lineWidth = width;
            chevron(ctx, s * 0.2, s * 0.3);
        },
        SLIDE(ctx, s) {
            // Ice streaks on a slab: what comes onto it keeps going (it has no facing).
            ctx.lineWidth = Math.max(1, s * 0.06);
            for (const [dx, dy, len] of [[-0.42, -0.22, 0.42], [-0.1, 0.08, 0.5], [-0.3, 0.38, 0.3]]) {
                ctx.beginPath();
                ctx.moveTo(dx * s, dy * s);
                ctx.lineTo((dx + len) * s, (dy - len * 0.4) * s);
                ctx.stroke();
            }
        },
    };

    // Draw a Thing centered at (x, y) with hex radius s. Shared by the board and the hand.
    // `facing` is null for kinds that don't aim; `color` is the Thing's (WHITE for most).
    function drawThing(ctx, x, y, s, kind, color, facing, alpha) {
        const look = THING_LOOK[kind];
        const ink = THINGS[kind].colored ? COLOR_INK[color] : look.ink;
        ctx.save();
        ctx.globalAlpha = alpha;
        drawHexPath(ctx, x, y, s * look.inset);
        ctx.fillStyle = look.fill;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.strokeStyle = ink;
        ctx.fillStyle = ink;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2, s * 0.1);
        ctx.translate(x, y);
        if (aims(kind)) ctx.rotate(facingAngle(facing));
        GLYPHS[kind](ctx, s);
        ctx.restore();
    }

    // A Thing's name and verb line: a colored kind in a crate color says so.
    const capitalized = w => w[0].toUpperCase() + w.slice(1);
    const thingName = (kind, color) => (THINGS[kind].colored && color !== WHITE ? capitalized(color) + ' ' : '') + THING_LOOK[kind].name;
    const thingDoes = (kind, color) => THING_LOOK[kind].does + (!THINGS[kind].colored ? '' :
        color === WHITE ? ' (you pick its crate color when you place it)' : ` (only ${color} crates, and gremlins)`);

    class GameUI {
        constructor(engine, canvas) {
            this.engine = engine;
            this.state = engine.state;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.sound = new GameSound();

            this.panX = 0;
            this.panY = 0;
            this.panning = false;
            this.dragCandidate = false;
            this.panStartX = 0;
            this.panStartY = 0;
            this.panOrigX = 0;
            this.panOrigY = 0;

            this.picked = null;      // L1.2 { slot, legal: Set<key> } — the card being placed
            this.choosing = null;    // L5 { q, r, colors } — the color picker's hex and swatches, while it's open (D-32)
            this.facing = 0;         // ghost facing; remembered between placements
            this.overlay = null;     // L5 'intro' | 'size' (board-size pickers) | 'news' (a color opened) | 'help' (the keys) | 'color' (the color picker, D-32) | null
            this.hoveredHex = null;  // L1.3
            this.selected = null;    // {q, r} — a clicked hex: highlighted, holds Go; a second click turns its mover
            this.anim = null;        // { t0, dur, tracks: Map<id, track>, before, hidden: Set<id>, milestone, ends: Set<type> }
            this.running = false;    // Go/Pause: tick on its own after each animation
            this.runTimer = null;    // the pending RUN_GAP_MS timeout, if any
            this.bannerTimer = null; // hides the milestone banner
            this.handDrawn = null;   // what renderHand last drew, so it redraws only on change
        }

        // ---- Lifecycle ----
        // No board until a size is picked from the intro.
        start() {
            this.attach();
            this.showOverlay('intro');
            this.resize();
        }

        // New Game: the size picker over the current game (Esc goes back to it).
        newGame() {
            this.unpick();
            this.showOverlay('size');
        }

        // The first game, picked from the intro, opens on the keys legend.
        startGame(size) {
            const fromIntro = this.overlay === 'intro';
            this.engine.newGame(Math.floor(Math.random() * 0x100000000), size);
            this.picked = null;
            this.choosing = null;
            this.selected = null;
            this.anim = null;
            this.hoveredHex = null;
            this.setRunning(false);
            document.getElementById('milestone').classList.add('hidden');
            this.dismissOverlay();
            this.sound.fanfare();
            this.resize();
            if (fromIntro) this.showOverlay('help');
        }

        // Help: the keys legend over the game. Like every overlay it holds Go; Go picks up
        // again when it closes.
        showHelp() {
            if (this.overlay) return;
            this.showOverlay('help');
        }

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            if (this.state.hexes) this.centerMap();
            this.render();
        }

        // Center the whole map when it fits the window, nudged down a little to clear the
        // HUD; a bigger map centers on the source instead, and you drag to pan.
        centerMap() {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const [, h] of this.state.hexes) {
                const p = new Hex(h.q, h.r).toPixel();
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            }
            const fits = maxX - minX + 2 * HEX_SIZE <= this.canvas.width && maxY - minY + 2 * HEX_SIZE <= this.canvas.height;
            const src = new Hex(this.state.sources[0].q, this.state.sources[0].r).toPixel();
            const cx = fits ? (minX + maxX) / 2 : src.x;
            const cy = fits ? (minY + maxY) / 2 : src.y;
            this.panX = this.canvas.width / 2 - cx;
            this.panY = this.canvas.height / 2 - cy + 10;
        }

        hexToScreen(q, r) {
            const p = new Hex(q, r).toPixel();
            return { x: p.x + this.panX, y: p.y + this.panY };
        }

        screenToHex(sx, sy) {
            return Hex.fromPixel(sx - this.panX, sy - this.panY);
        }

        // ---- L1.2 Pick a card: the legal set is computed once; the click is a lookup ----
        // Allowed mid-animation (the state is already post-tick), so a card can be picked
        // while Go runs; the run holds while a card is picked.
        pick(slot) {
            if (this.overlay) return;
            if (slot < 0 || slot >= this.state.hand.length) return;
            if (this.picked && this.picked.slot === slot) { this.unpick(); return; }
            this.selected = null;
            this.picked = { slot, legal: this.engine.legalPlacements(this.state.hand[slot].kind) };
            this.render();
        }

        unpick() {
            this.picked = null;
            this.choosing = null;
            this.render();
        }

        turnGhost(dir) {
            this.facing = dir > 0 ? Hex.clockwise(this.facing) : Hex.counterClockwise(this.facing);
            this.render();
        }

        // ---- Commands: snapshot, call the engine, animate from its events ----
        commit(fn, cue) {
            const before = new Map(this.state.pieces.map(p =>
                [p.id, { q: p.q, r: p.r, color: p.color, label: p.label, kind: p.kind }]));
            const res = fn();
            if (!res.ok) { this.render(); return; }
            this.picked = null;
            cue();
            this.startAnim(before, res);
        }

        place(q, r, color) {
            const slot = this.picked.slot;
            this.commit(() => this.engine.place(slot, q, r, this.facing, color), () => this.sound.place());
        }

        // A click on a legal hex: with one color to choose from (every kind but Pushers and
        // Pullers), place at once; otherwise ask for the color first (D-32).
        placeOrAsk(q, r) {
            const colors = this.engine.colorChoices(this.state.hand[this.picked.slot].kind);
            if (colors.length === 1) { this.place(q, r, colors[0]); return; }
            this.openColorPicker(q, r, colors);
        }

        // ---- L5 The color picker: one swatch per open color, beside the hex (D-32) ----
        // The card stays picked behind it; nothing is sent until a swatch is chosen.
        openColorPicker(q, r, colors) {
            this.choosing = { q, r, colors };
            const box = document.getElementById('color-picker');
            box.innerHTML = '';
            colors.forEach((color, i) => {
                const b = document.createElement('button');
                b.className = 'swatch';
                b.title = capitalized(color);
                b.style.background = CRATE_SHADES[color].top;
                b.innerHTML = `<kbd>${i + 1}</kbd>`;
                b.addEventListener('click', e => { e.stopPropagation(); this.chooseColor(i); });
                box.appendChild(b);
            });
            const { x, y } = this.hexToScreen(q, r);
            box.style.left = Math.min(x + HEX_SIZE, window.innerWidth - COLOR_PICKER_PX - 8) + 'px';
            box.style.top = Math.max(8, y - HEX_SIZE - COLOR_PICKER_PX) + 'px';
            this.showOverlay('color');
            this.render();
        }

        chooseColor(i) {
            const { q, r, colors } = this.choosing;
            this.closeColorPicker();
            this.place(q, r, colors[i]);
        }

        // Esc, right-click or a click off the swatches: back to the picked card, nothing placed.
        closeColorPicker() {
            this.choosing = null;
            this.dismissOverlay();
        }

        colorKey(e) {
            if (e.key === 'Escape') { this.closeColorPicker(); return; }
            const i = Number(e.key) - 1;
            if (Number.isInteger(i) && i >= 0 && i < this.choosing.colors.length) this.chooseColor(i);
        }

        // ---- Select a hex: it holds Go so you can look; clicking it again turns its mover ----
        select(q, r) {
            this.selected = { q, r };
            this.render();
        }

        deselect() {
            this.selected = null;
            this.render();
            this.scheduleRun();
        }

        // Turning a mover doesn't tick (D-19), so there's nothing to animate.
        rotate(q, r) {
            if (!this.engine.rotate(q, r).ok) return;
            this.sound.step();
            this.render();
        }

        // Remove the Thing under the cursor (D).
        removeHovered() {
            if (this.overlay || this.anim || !this.hoveredHex) return;
            const { q, r } = this.hoveredHex;
            this.commit(() => this.engine.remove(q, r), () => this.sound.sink());
        }

        // Blow up the crate under the cursor (B).
        blastHovered() {
            if (this.overlay || this.anim || !this.hoveredHex) return;
            const { q, r } = this.hoveredHex;
            this.commit(() => this.engine.blast(q, r), () => {});
        }

        // Throw the picked card away (the Discard spot or X); it ticks like any command.
        discardPicked() {
            if (this.overlay || this.anim || !this.picked) return;
            const slot = this.picked.slot;
            this.commit(() => this.engine.discard(slot), () => this.sound.discard());
        }

        // L2.1 the primary action (Wait button, Space).
        primaryAction() {
            if (this.overlay || this.anim) return;
            this.commit(() => this.engine.wait(), () => this.sound.endTurn());
        }

        // Space: do one tick, or finish the one in flight, then stop. While Go runs it turns
        // Go off (the animation playing finishes; no new tick starts); otherwise it's a Wait.
        oneTick() {
            if (this.overlay) return;
            if (this.running) { this.setRunning(false); return; }
            this.primaryAction();
        }

        // ---- Go/Pause (Go button, Enter): Wait after every animation, RUN_GAP_MS apart.
        // Turning it off lets the tick in flight finish; no new one starts. ----
        toggleRun() {
            if (this.overlay) return;
            this.setRunning(!this.running);
            if (this.running) this.runStep();
        }

        setRunning(on) {
            this.running = on;
            clearTimeout(this.runTimer);
            this.runTimer = null;
            const b = document.getElementById('go');
            b.textContent = on ? 'Pause' : 'Go';
            b.classList.toggle('running', on);
        }

        scheduleRun() {
            if (!this.running || this.runTimer) return;
            this.runTimer = setTimeout(() => { this.runTimer = null; this.runStep(); }, RUN_GAP_MS);
        }

        // A held card, a selected hex or an animation in flight waits for the next gap.
        runStep() {
            if (!this.running || this.overlay) return;
            if (this.anim || this.picked || this.selected) { this.scheduleRun(); return; }
            this.commit(() => this.engine.wait(), () => {});
        }

        // ---- Tick animation ----
        // Each piece that moved gets a track: its pre-tick hex, then every hex it entered.
        // All tracks advance together one hop per HOP_MS; spawned crates appear at the end.
        // A bumped piece (its move names the bumper `by`, D-33) holds still until the bumper
        // reaches it (`byAt` hexes into the bumper's own path), then the line and the bumper
        // go on together, the bumper one hex behind.
        startAnim(before, res) {
            const tracks = new Map();
            const hidden = new Set();
            let hops = 0;
            const milestones = [];
            const opened = [];
            const unlocked = [];
            const redrawn = [];
            const ends = new Set();
            for (const e of res.events) {
                if (e.type === 'move') {
                    const b = before.get(e.id);
                    const by = e.by && tracks.get(e.by);
                    const hold = Array.from({ length: by ? by.hold + e.byAt : 1 }, () => ({ q: b.q, r: b.r }));
                    const pts = [...hold, ...e.path];
                    tracks.set(e.id, { ...b, pts, hold: hold.length, end: null });
                    hops = Math.max(hops, pts.length - 1);
                } else if (e.type === 'sink' || e.type === 'deliver' || e.type === 'splat') {
                    // A piece that ends without moving (its Bridge removed, or splatted where
                    // it stood) fades where it stood; one hit by a flier waits for it to land.
                    const b = before.get(e.id);
                    const t = tracks.get(e.id) || { ...b, pts: [{ q: b.q, r: b.r }], hold: 1, end: null };
                    const by = e.by && tracks.get(e.by);
                    while (by && t.pts.length < by.pts.length) t.pts.push(t.pts[t.pts.length - 1]);
                    t.end = e.type;
                    tracks.set(e.id, t);
                    ends.add(e.type);
                } else if (e.type === 'spawn') {
                    hidden.add(e.id);
                } else if (e.type === 'milestone') {
                    milestones.push(e.count);
                } else if (e.type === 'open') {
                    opened.push(e.color);
                } else if (e.type === 'unlock') {
                    unlocked.push(...e.kinds);
                } else if (e.type === 'redraw') {
                    redrawn.push(e.slot);
                }
            }
            this.anim = { t0: performance.now(), dur: Math.max(1, hops + (ends.size ? 1 : 0)) * HOP_MS,
                tracks, before, hidden, milestones, opened, unlocked, redrawn, ends };
            const frame = now => {
                if (!this.anim) return;
                if (now - this.anim.t0 >= this.anim.dur) { this.finishAnim(); return; }
                this.render();
                requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        }

        // A card the idle rule redrew glows once (restarting the CSS animation).
        flashCard(slot) {
            const b = document.getElementById('cards').children[slot];
            b.classList.remove('fresh');
            void b.offsetWidth;
            b.classList.add('fresh');
        }

        finishAnim() {
            const a = this.anim;
            this.anim = null;
            const cue = END_CUES.find(type => a.ends.has(type));
            if (cue) this.sound[cue]();
            if (a.milestones.length) { this.sound.fanfare(); this.showMilestone(a.milestones, a.unlocked); }
            if (a.opened.length) this.showNews(a.opened, a.unlocked);
            this.render();
            a.redrawn.forEach(slot => this.flashCard(slot));
            this.scheduleRun();
        }

        // Where a tracked piece is drawn at time `now`, and how opaque.
        trackPose(t, now) {
            // Never before hop 0, even if `now` came from a clock that precedes t0.
            const k = Math.max(0, (now - this.anim.t0) / HOP_MS);
            const last = t.pts.length - 1;
            if (k >= last) {
                // Arrived; a sinking or delivered piece fades over one more hop.
                const fade = t.end ? Math.max(0, 1 - (k - last)) : 1;
                return { ...this.hexToScreen(t.pts[last].q, t.pts[last].r), alpha: fade, scale: t.end ? 0.6 + 0.4 * fade : 1 };
            }
            const i = Math.floor(k), f = k - i;
            const a = this.hexToScreen(t.pts[i].q, t.pts[i].r), b = this.hexToScreen(t.pts[i + 1].q, t.pts[i + 1].r);
            return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, alpha: 1, scale: 1 };
        }

        // A banner that doesn't stop play: the milestones this tick crossed (usually one; a big
        // crate can cross several), the next one, and the cards they unlocked (D-30).
        showMilestone(counts, kinds) {
            const s = this.state, turns = s.turn - 1, count = counts[counts.length - 1];
            document.getElementById('milestone-title').textContent =
                counts.includes(GameArtifacts.FIRST_MILESTONE) ? 'IT DOES THE THING' : `${count} crates!`;
            const passed = counts.length > 1 ? `passed ${counts.join(' and ')} · ` : '';
            document.getElementById('milestone-sub').textContent =
                `${passed}${count} crates in ${turns} turns · next: ${nextMilestone(count)}` + (s.lost ? ` · ${s.lost} lost at sea` : '');
            const row = document.getElementById('milestone-cards');
            row.innerHTML = '';
            row.classList.toggle('hidden', !kinds.length);
            if (kinds.length) {
                const label = document.createElement('span');
                label.textContent = kinds.length > 1 ? 'New cards:' : 'New card:';
                row.appendChild(label);
            }
            for (const kind of kinds) {
                const card = document.createElement('span');
                card.className = 'mcard';
                const name = document.createElement('span');
                name.textContent = THING_LOOK[kind].name;
                card.appendChild(cardPicture(kind, 28));
                card.appendChild(name);
                row.appendChild(card);
            }
            const el = document.getElementById('milestone');
            el.classList.remove('hidden');
            clearTimeout(this.bannerTimer);
            this.bannerTimer = setTimeout(() => el.classList.add('hidden'), MILESTONE_MS);
        }

        // A new crate color stops play until the player has seen it: a swatch per color, plus a
        // picture and verb line per card the same milestone unlocked (cards alone only get the
        // banner, D-30); click or any key goes on.
        showNews(colors, kinds) {
            const row = document.getElementById('news-swatches');
            row.innerHTML = '';
            for (const c of colors) {
                const sw = document.createElement('div');
                sw.className = 'swatch';
                sw.style.background = `linear-gradient(135deg, ${CRATE_SHADES[c].top}, ${CRATE_SHADES[c].left} 60%, ${CRATE_SHADES[c].right})`;
                row.appendChild(sw);
            }
            for (const kind of kinds) row.appendChild(cardPicture(kind, 48));
            const and = names => names.join(' and ');
            document.getElementById('news-title').textContent = `${and(colors.map(capitalized))} crates!`;
            const lines = [`A new source now sends ${and(colors)} crates. Each color goes to its own target.`];
            if (kinds.length) lines.push(`Now in the deck: ${kinds.map(k => `${THING_LOOK[k].name} (${THING_LOOK[k].does})`).join('; ')}.`);
            document.getElementById('news-sub').textContent = lines.join(' ');
            this.showOverlay('news');
        }

        // ---- L5 Overlays ----
        // The size pickers close only on a size (or Esc on New Game); the others on any key or click.
        showOverlay(name) {
            this.overlay = name;
            for (const [n, id] of Object.entries(OVERLAY_PANELS))
                document.getElementById(id).classList.toggle('hidden', n !== name);
        }

        dismissOverlay() {
            this.overlay = null;
            for (const id of Object.values(OVERLAY_PANELS)) document.getElementById(id).classList.add('hidden');
            this.render();
            this.scheduleRun();
        }

        // One button per MAP_SIZES row, in each picker, keyed 1…n.
        buildSizeButtons(el) {
            SIZE_KEYS.forEach((size, i) => {
                const { cols, rows } = MAP_SIZES[size];
                const b = document.createElement('button');
                b.className = 'btn size';
                b.innerHTML = `<span class="dims">${cols} × ${rows}</span>` +
                    `<span class="note">${MAP_SIZE_NOTES[size]}</span><kbd>${i + 1}</kbd>`;
                b.addEventListener('click', () => this.startGame(size));
                el.appendChild(b);
            });
        }

        // ---- Rendering ----
        // Draws the board as of now: animated pieces are posed by the current clock.
        render() {
            const now = performance.now();
            const ctx = this.ctx;
            const s = this.state;
            ctx.fillStyle = BG_COLOR;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            if (!s.hexes) return;

            for (const [, hex] of s.hexes) {
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
                ctx.fill();
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
                ctx.lineWidth = 1;
                ctx.stroke();
                if (hex.terrain === TERRAIN.ICE) this.drawIceStreaks(x, y);
                if (hex.terrain === TERRAIN.MOUNTAIN) this.drawPeak(x, y);
            }

            for (const src of s.sources) this.drawSource(src);
            for (const t of s.targets) this.drawTarget(t);

            // A Thing under the ghost is about to be replaced (D-28): the ghost stands in for it.
            const doomed = this.replaceTarget(this.ghostHex());
            for (const t of s.things) {
                if (t === doomed) continue;
                const { x, y } = this.hexToScreen(t.q, t.r);
                drawThing(ctx, x, y, HEX_SIZE, t.kind, t.color, t.facing, 1);
            }

            // L1.2 legal placements for the picked card, plus a ghost under the cursor. A legal
            // hex holding a Thing (placing replaces it) also gets a dashed yellow ring.
            if (this.picked) {
                for (const key of this.picked.legal) {
                    const { q, r } = Hex.fromKey(key);
                    const { x, y } = this.hexToScreen(q, r);
                    drawHexPath(ctx, x, y, HEX_SIZE);
                    ctx.fillStyle = `rgba(${REACH_COLOR}, 0.28)`;
                    ctx.fill();
                    if (!this.engine.thingAt(q, r)) continue;
                    drawHexPath(ctx, x, y, HEX_SIZE - 2);
                    ctx.save();
                    ctx.setLineDash([4, 3]);
                    ctx.strokeStyle = `rgba(${REACH_COLOR}, 0.9)`;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.restore();
                }
                const h = this.ghostHex();
                if (h && this.picked.legal.has(Hex.key(h.q, h.r))) {
                    const { x, y } = this.hexToScreen(h.q, h.r);
                    drawThing(ctx, x, y, HEX_SIZE, s.hand[this.picked.slot].kind, WHITE, this.facing, 0.7);
                }
            } else if (this.hoveredHex && !this.anim) {
                // A bare hover over a mover: outline it — clicking turns it.
                const t = this.engine.thingAt(this.hoveredHex.q, this.hoveredHex.r);
                if (t && aims(t.kind)) {
                    const { x, y } = this.hexToScreen(t.q, t.r);
                    drawHexPath(ctx, x, y, HEX_SIZE - 2);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            this.drawPieces(now);
            if (this.selected) this.drawSelected(this.selected);
            this.updateHUD();
        }

        // Where the ghost stands: the hex the color picker is open on, else the hovered one.
        ghostHex() {
            return this.choosing || this.hoveredHex;
        }

        // The placed Thing that placing the picked card on `h` would replace, or null.
        replaceTarget(h) {
            if (!this.picked || !h || !this.picked.legal.has(Hex.key(h.q, h.r))) return null;
            return this.engine.thingAt(h.q, h.r) || null;
        }

        // The selected hex: a bright outline, and over a mover a white arrow along its facing.
        drawSelected({ q, r }) {
            const ctx = this.ctx;
            const { x, y } = this.hexToScreen(q, r);
            drawHexPath(ctx, x, y, HEX_SIZE - 1.5);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();
            const t = this.engine.thingAt(q, r);
            if (!t || !aims(t.kind)) return;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(facingAngle(t.facing));
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            const s = HEX_SIZE;
            const arrow = () => {
                ctx.beginPath();
                ctx.moveTo(-s * 0.5, 0); ctx.lineTo(s * 0.62, 0);
                ctx.moveTo(s * 0.34, -s * 0.26); ctx.lineTo(s * 0.62, 0); ctx.lineTo(s * 0.34, s * 0.26);
                ctx.stroke();
            };
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.lineWidth = Math.max(4, s * 0.2);
            arrow();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = Math.max(2, s * 0.1);
            arrow();
            ctx.restore();
        }

        drawPieces(now) {
            const a = this.anim;
            if (!a) {
                for (const p of this.state.pieces) {
                    const { x, y } = this.hexToScreen(p.q, p.r);
                    this.drawPiece(x, y, p, 1, 1);
                }
                return;
            }
            // During a tick: tracked pieces follow their paths (gone ones included); the
            // rest sit still; crates spawned this tick wait for the end.
            for (const [id, t] of a.tracks) {
                const pose = this.trackPose(t, now);
                if (t.end === 'splat' && pose.alpha < 1) this.drawSplat(pose.x, pose.y, SPLAT_COLOR[t.kind](t), 1 - pose.alpha);
                this.drawPiece(pose.x, pose.y, t, pose.alpha, pose.scale);
            }
            for (const p of this.state.pieces) {
                if (a.tracks.has(p.id) || a.hidden.has(p.id)) continue;
                const { x, y } = this.hexToScreen(p.q, p.r);
                this.drawPiece(x, y, p, 1, 1);
            }
        }

        drawIceStreaks(x, y) {
            const ctx = this.ctx;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 1.5;
            for (const [dx, dy, len] of [[-12, -8, 12], [2, 2, 16], [-6, 12, 9]]) {
                ctx.beginPath();
                ctx.moveTo(x + dx, y + dy);
                ctx.lineTo(x + dx + len, y + dy - len * 0.4);
                ctx.stroke();
            }
        }

        drawPeak(x, y) {
            const ctx = this.ctx;
            ctx.beginPath();
            ctx.moveTo(x - 14, y + 10);
            ctx.lineTo(x - 2, y - 12);
            ctx.lineTo(x + 4, y - 2);
            ctx.lineTo(x + 8, y - 8);
            ctx.lineTo(x + 16, y + 10);
            ctx.closePath();
            ctx.fillStyle = '#5c5c5c';
            ctx.fill();
        }

        // Source/target: a glowing ring with a label.
        // A target: a ring in its color with a black line just inside it, so pale colors
        // (green, yellow) still stand out on plains.
        drawTarget(t) {
            this.drawPort(t, CRATE_SHADES[t.color].left, '★');
            const ctx = this.ctx;
            const { x, y } = this.hexToScreen(t.q, t.r);
            drawHexPath(ctx, x, y, HEX_SIZE - 5);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // A source: the IN ring, with one pip per color it makes.
        drawSource(src) {
            this.drawPort(src, SOURCE_COLOR, 'IN');
            const ctx = this.ctx;
            const { x, y } = this.hexToScreen(src.q, src.r);
            const gap = 9, y0 = y + HEX_SIZE * 0.62;
            src.colors.forEach((color, i) => {
                ctx.beginPath();
                ctx.arc(x + (i - (src.colors.length - 1) / 2) * gap, y0, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = CRATE_SHADES[color].left;
                ctx.fill();
            });
        }

        drawPort(at, color, label) {
            const ctx = this.ctx;
            const { x, y } = this.hexToScreen(at.q, at.r);
            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
            drawHexPath(ctx, x, y, HEX_SIZE - 2);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
            ctx.fillStyle = color;
            ctx.font = `bold ${label.length > 1 ? 11 : 16}px ${UI_FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x, y - HEX_SIZE * 0.62);
        }

        roundRect(x, y, w, h, r) {
            const ctx = this.ctx;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.arcTo(x + w, y, x + w, y + r, r);
            ctx.lineTo(x + w, y + h - r);
            ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
            ctx.lineTo(x + r, y + h);
            ctx.arcTo(x, y + h, x, y + h - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
        }

        contrastText(hexColor) {
            const r = parseInt(hexColor.slice(1, 3), 16) / 255;
            const g = parseInt(hexColor.slice(3, 5), 16) / 255;
            const b = parseInt(hexColor.slice(5, 7), 16) / 255;
            return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#000' : '#fff';
        }

        // A burst of blots in the splatted piece's color, flying out as `k` goes 0 → 1.
        drawSplat(x, y, color, k) {
            const ctx = this.ctx;
            ctx.save();
            ctx.globalAlpha = 1 - k * 0.7;
            ctx.fillStyle = color;
            for (let i = 0; i < SPLAT_BLOTS; i++) {
                const a = i / SPLAT_BLOTS * Math.PI * 2 + i;
                const d = COUNTER_SIZE * (0.3 + 0.6 * k) * (i % 2 ? 0.7 : 1);
                ctx.beginPath();
                ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, COUNTER_SIZE * (0.14 - 0.06 * k), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        drawPiece(x, y, p, alpha, scale) {
            PIECE_DRAW[p.kind](this, x, y, p, alpha, scale);
        }

        // An isometric box centred on (cx, cy): a rhombus top and two side faces.
        drawCrate(cx, cy, shades, alpha, scale) {
            const ctx = this.ctx;
            const w = COUNTER_SIZE * scale * 0.45;     // half-width
            const h = w / 2;                           // half-height of the top rhombus
            const d = w;                               // side-face depth
            const top = cy - d / 2;                    // y of the top face's centre
            const face = (pts, fill) => {
                ctx.beginPath();
                ctx.moveTo(pts[0][0], pts[0][1]);
                for (const [px, py] of pts.slice(1)) ctx.lineTo(px, py);
                ctx.closePath();
                ctx.fillStyle = fill;
                ctx.fill();
                ctx.stroke();
            };
            const N = [cx, top - h], E = [cx + w, top], S = [cx, top + h], W = [cx - w, top];
            const down = ([px, py]) => [px, py + d];
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.lineJoin = 'round';
            face([W, S, down(S), down(W)], shades.left);
            face([S, E, down(E), down(S)], shades.right);
            face([N, E, S, W], shades.top);
            ctx.restore();
        }

        drawCounter(cx, cy, color, label, alpha, scale) {
            const ctx = this.ctx;
            const s = COUNTER_SIZE * scale;
            const x = cx - s / 2, y = cy - s / 2;
            const r = 4;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                ctx.moveTo(x + r + i, y + s + 1 + i);
                ctx.arcTo(x + s + 1 + i, y + s + 1 + i, x + s + 1 + i, y + s - r + 1 + i, r);
                ctx.lineTo(x + s + 1 + i, y + r + i);
                ctx.stroke();
            }
            this.roundRect(x, y, s, s, r);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = this.contrastText(color);
            ctx.font = `bold ${Math.floor(s * 0.55)}px ${UI_FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx, cy + 1);
            ctx.restore();
        }

        // ---- HUD and hand ----
        updateHUD() {
            const s = this.state;
            document.getElementById('turn-info').textContent = 'Turn ' + s.turn;
            const next = nextMilestone(s.delivered);
            document.getElementById('progress-fill').style.width = s.delivered / next * 100 + '%';
            document.getElementById('progress-pct').textContent = `${s.delivered} / ${next}`;
            document.getElementById('lost-info').textContent = s.lost ? `${s.lost} crates lost` : '';
            // Per-color counts, once a second color is open.
            document.getElementById('color-info').innerHTML = s.targets.length < 2 ? '' : s.targets.map(t =>
                `<span style="color:${CRATE_SHADES[t.color].top}">■ ${t.delivered}</span>`).join(' ');
            document.getElementById('ex-info').textContent = s.exGremlins;
            document.getElementById('trap-info').textContent = s.trapped;
            this.renderHand();

            const hoverEl = document.getElementById('hover-info');
            const h = this.hoveredHex && s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            if (!h) { document.getElementById('hud-hover').classList.add('hidden'); return; }
            const parts = [TERRAIN_NAMES[h.terrain]];
            const src = s.sources.find(e => Hex.same(e, h));
            const tgt = this.engine.targetAt(h.q, h.r);
            if (src) parts.push(`Source — ${src.colors.join(', ')} crates appear here`);
            if (tgt) parts.push(`Target — deliver ${tgt.color} crates here`);
            const t = this.engine.thingAt(h.q, h.r);
            if (t) parts.push(`${thingName(t.kind, t.color)}: ${thingDoes(t.kind, t.color)}` + this.thingHint(h, t));
            const p = this.engine.pieceAt(h.q, h.r);
            if (p) parts.push(PIECE_LOOK[p.kind].name);
            hoverEl.textContent = parts.join(' · ');
            document.getElementById('hud-hover').classList.remove('hidden');
        }

        // What the mouse can do to the hovered Thing `t` on `h`, for the hover bar.
        thingHint(h, t) {
            if (this.replaceTarget(h)) return ' (click to replace, D to remove)';
            if (aims(t.kind) && !this.picked) return ' (click to select, again to turn, D to remove)';
            return ' (D to remove)';
        }

        // The hand: one card per slot, each with a little canvas of the Thing. Redrawn only
        // when what it shows changes, not on every animation frame or mouse move.
        renderHand() {
            const el = document.getElementById('cards');
            const s = this.state;
            document.getElementById('discard').classList.toggle('armed', !!this.picked);
            const shown = JSON.stringify([s.hand, this.picked && this.picked.slot, this.facing]);
            if (shown === this.handDrawn && el.children.length === HAND_SIZE) return;
            this.handDrawn = shown;
            if (el.children.length !== HAND_SIZE) {
                el.innerHTML = '';
                for (let i = 0; i < HAND_SIZE; i++) {
                    const b = document.createElement('button');
                    b.className = 'card';
                    b.innerHTML = `<canvas width="64" height="64"></canvas><span class="name"></span>` +
                        `<span class="does"></span><kbd>${i + 1}</kbd>`;
                    b.addEventListener('click', () => this.pick(i));
                    el.appendChild(b);
                }
            }
            [...el.children].forEach((b, i) => {
                const { kind } = s.hand[i];   // cards have no color (D-32)
                const picked = this.picked && this.picked.slot === i;
                b.classList.toggle('picked', !!picked);
                b.querySelector('.name').textContent = thingName(kind, WHITE);
                b.querySelector('.does').textContent = thingDoes(kind, WHITE);
                const c = b.querySelector('canvas'), cx = c.getContext('2d');
                cx.clearRect(0, 0, c.width, c.height);
                drawThing(cx, 32, 32, 26, kind, WHITE, aims(kind) ? (picked ? this.facing : 0) : null, 1);
            });
        }

        // ---- Input (dispatch order mirrors UI_CONTROLS.md) ----
        attach() {
            this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
            this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
            this.canvas.addEventListener('mouseleave', () => { this.hoveredHex = null; this.render(); });
            window.addEventListener('mouseup', e => this.onMouseUp(e));
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
            this.canvas.addEventListener('wheel', e => {
                if (!this.picked) return;
                e.preventDefault();
                this.turnGhost(e.deltaY > 0 ? 1 : -1);
            }, { passive: false });
            window.addEventListener('resize', () => this.resize());
            window.addEventListener('keydown', e => this.onKeyDown(e));
            document.getElementById('end-turn').addEventListener('click', () => this.primaryAction());
            document.getElementById('go').addEventListener('click', () => this.toggleRun());
            document.getElementById('new-game').addEventListener('click', () => this.newGame());
            document.getElementById('discard').addEventListener('click', () => this.discardPicked());
            document.getElementById('size-cancel').addEventListener('click', () => this.dismissOverlay());
            document.getElementById('news-panel').addEventListener('click', () => this.dismissOverlay());
            document.getElementById('help').addEventListener('click', () => this.showHelp());
            document.getElementById('help-panel').addEventListener('click', () => this.dismissOverlay());
            const colorPanel = document.getElementById('color-panel');
            colorPanel.addEventListener('click', () => this.closeColorPicker());
            colorPanel.addEventListener('contextmenu', e => { e.preventDefault(); this.closeColorPicker(); });
            this.buildSizeButtons(document.getElementById('intro-sizes'));
            this.buildSizeButtons(document.getElementById('new-sizes'));
        }

        onMouseDown(e) {
            // Right button: narrow cancel — put the picked card back (L2.2). No pan.
            if (e.button === 2) {
                if (this.picked) this.unpick();
                e.preventDefault();
                return;
            }
            if (e.button !== 0) return;
            this.dragCandidate = true;
            this.panning = false;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.panOrigX = this.panX;
            this.panOrigY = this.panY;
            e.preventDefault();
        }

        // With no card picked: a click on a hex selects it (and holds Go), a click on the
        // selected hex turns its mover, and a click anywhere else only deselects. Selecting
        // and turning work mid-animation, since neither ticks.
        handleClick(e) {
            if (this.overlay) return;                               // L5 captures & consumes
            const hex = this.screenToHex(e.clientX, e.clientY);
            const key = Hex.key(hex.q, hex.r);
            if (this.picked) {
                if (this.anim) return;                              // L1.1 a place waits for the tick
                if (this.picked.legal.has(key)) this.placeOrAsk(hex.q, hex.r);
                else this.unpick();
                return;
            }
            if (this.selected) {
                if (Hex.same(this.selected, hex)) this.rotate(hex.q, hex.r);
                else this.deselect();
                return;
            }
            if (this.state.hexes.has(key)) this.select(hex.q, hex.r);
        }

        // The intro and size cards don't cover the canvas, so the mouse reaches it under
        // them, before any board exists on the intro; L5 consumes it like a click.
        onMouseMove(e) {
            if (this.overlay) return;                               // L5 captures & consumes
            if (this.dragCandidate && !this.panning) {
                const dx = e.clientX - this.panStartX, dy = e.clientY - this.panStartY;
                if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) this.panning = true;
            }
            if (this.panning) {
                this.panX = this.panOrigX + (e.clientX - this.panStartX);
                this.panY = this.panOrigY + (e.clientY - this.panStartY);
                if (!this.anim) this.render();
                return;
            }
            const hex = this.screenToHex(e.clientX, e.clientY);
            const next = this.state.hexes.has(Hex.key(hex.q, hex.r)) ? { q: hex.q, r: hex.r } : null;
            if (next?.q !== this.hoveredHex?.q || next?.r !== this.hoveredHex?.r) {
                this.hoveredHex = next;
                if (!this.anim) this.render();
            }
        }

        onMouseUp(e) {
            if (e.button !== 0 || !this.dragCandidate) return;
            const wasPan = this.panning;
            this.dragCandidate = false;
            this.panning = false;
            if (!wasPan) this.handleClick(e);
        }

        onKeyDown(e) {
            if (this.overlay) { this.onOverlayKey(e); return; }
            if (e.key === 'Escape') { if (this.picked) this.unpick(); else if (this.selected) this.deselect(); return; }   // L2.2
            if (e.key === ' ') { e.preventDefault(); this.oneTick(); return; }
            if (e.key === 'Enter') { e.preventDefault(); this.toggleRun(); return; }
            if (e.key >= '1' && e.key <= String(HAND_SIZE)) { this.pick(Number(e.key) - 1); return; }
            if ((e.key === 'r' || e.key === 'R') && this.picked) { this.turnGhost(e.shiftKey ? -1 : 1); return; }
            if (e.key === 'd' || e.key === 'D') { this.removeHovered(); return; }
            if (e.key === 'b' || e.key === 'B') { this.blastHovered(); return; }
            if (e.key === 'x' || e.key === 'X') this.discardPicked();
        }

        onOverlayKey(e) {
            e.preventDefault();
            OVERLAY_KEYS[this.overlay](this, e);
        }

        // L5: a size picker takes only its number keys, and Esc when there's a game behind it.
        sizeKey(e) {
            const i = Number(e.key) - 1;
            if (Number.isInteger(i) && i >= 0 && i < SIZE_KEYS.length) { this.startGame(SIZE_KEYS[i]); return; }
            if (e.key === 'Escape' && this.overlay === 'size') this.dismissOverlay();
        }
    }

    return GameUI;
})();
