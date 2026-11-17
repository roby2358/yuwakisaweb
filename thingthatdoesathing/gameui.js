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
        PIECE_LOOK, CRATE_SHADES, BIG_CRATE_SCALE, COLOR_INK, SPLAT_BLOTS, SOURCE_COLOR, PORT_NEUTRAL_MARK, PORT_OUTLINE,
        PORT_MARK_WIDTH, PORT_RING_RADII, PORT_PLUS_REACH, PORT_OUTLINE_WIDTH, BG_COLOR, UI_FONT, REACH_COLOR, MAP_SIZE_NOTES,
        COLOR_PICKER_PX, ZOOM_DIVISORS, MIN_TEXT_PX, SORRY_PICTURE_PX
    } = GameDisplayArtifacts;
    const { TERRAIN, THINGS, WHITE, HAND_SIZE, MAP_SIZES, aims, cardOf, nextMilestone } = GameArtifacts;
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

    // L1.2 What a picked card does, by its mode (D-47). A Thing card is in `build`; a tool card
    // starts in `pickup`, where its first click must take a hex the engine's legalPicks allows,
    // and AFTER_PICK[kind] says what that pick leads to (the Mover: `carry`, holding the picked
    // Thing as a card; the Bomb: `bomb`, blowing up hexes one click at a time, D-48). Per mode: `click` on a board hex (a lookup in `picked.legal`), `back`
    // (Esc, right-click), `discard` (the Discard spot, X), `legal` (the hexes it may click,
    // for the kind it holds), whether the hand is `locked` (the card is already spent), whether
    // legal hexes get a ghost and replace `rings` (`ghostAnywhere`: the ghost follows the mouse
    // over every board hex, not only legal ones), and the hover bar's `hint` over a Thing (by the
    // card in play).
    const PICK_MODES = {
        build: {
            click: (ui, hex, legal) => legal ? ui.placeOrAsk(hex.q, hex.r) : ui.unpick(),
            back: ui => ui.unpick(),
            discard: ui => ui.discardCard(),
            legal: (ui, kind) => ui.engine.legalPlacements(kind),
            locked: false, ghost: true, rings: true, hint: () => '',
        },
        pickup: {
            click: (ui, hex, legal) => { if (legal) AFTER_PICK[ui.picked.card].pick(ui, hex); },   // a bare hex does nothing
            back: ui => ui.unpick(),
            discard: ui => ui.discardCard(),
            legal: (ui, kind) => ui.engine.legalPicks(kind),
            locked: false, ghost: true, ghostAnywhere: true, rings: false, hint: ui => AFTER_PICK[ui.picked.card].hint,
        },
        carry: {
            click: (ui, hex, legal) => { if (legal) ui.putDown(hex.q, hex.r); },   // an illegal hex does nothing
            back: ui => ui.scrapCarried(),
            discard: ui => ui.scrapCarried(),
            legal: (ui, kind) => ui.engine.legalPlacements(kind),
            locked: true, ghost: true, ghostAnywhere: true, rings: true, hint: () => '',
        },
        // The Bomb after its first boom (D-48): the card is spent; each click on a filled hex
        // not yet blown up blows it up at once (in the view); the last of its `wipes` booms,
        // Esc, right-click or Discard ends the bomb (one command, one tick).
        bomb: {
            click: (ui, hex, legal) => { if (legal) ui.boom(hex); },   // a bare or blown-up hex does nothing
            back: ui => ui.endBomb(),
            discard: ui => ui.endBomb(),
            legal: (ui, kind) => ui.unboomed(ui.engine.legalPicks(kind)),
            locked: true, ghost: true, ghostAnywhere: true, rings: false, hint: () => ' (click to clear)',
        },
    };
    // A tool card's pick (the hex its first click took) and its hover hint, by card kind.
    const AFTER_PICK = {
        MOVER: { pick: (ui, hex) => ui.carry(hex), hint: ' (click to pick up)' },
        BOMB: { pick: (ui, hex) => ui.boom(hex), hint: ' (click to blow up)' },
    };
    // The mode a freshly picked card starts in.
    const startMode = kind => THINGS[kind] ? 'build' : 'pickup';

    // The map-scale buttons (D-40), in order: one per ZOOM_DIVISORS entry (1/d size, keeping the
    // point at the canvas center where it is), then ∞, which fits the whole board once, when
    // pressed, and centers it. `scale` picks the view scale; `place` re-aims the pan for it.
    const ZOOMS = [
        ...ZOOM_DIVISORS.map(d => ({
            label: String(d),
            title: d === 1 ? 'The map at full size' : `The map at 1/${d} size`,
            scale: () => 1 / d,
            place: (ui, old) => ui.keepCenter(old),
        })),
        { label: '∞', title: 'The whole board on screen', scale: ui => ui.fitScale(), place: ui => ui.centerBoard() },
    ];

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
        MOVER(ctx, s) {
            // A four-way move cross, an arrowhead on each arm: it takes a Thing somewhere else.
            const r = s * 0.5, h = s * 0.14;
            ctx.beginPath();
            ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
            ctx.moveTo(0, -r); ctx.lineTo(0, r);
            ctx.stroke();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                ctx.beginPath();
                ctx.moveTo(dx * r - dy * h - dx * h, dy * r - dx * h - dy * h);
                ctx.lineTo(dx * r, dy * r);
                ctx.lineTo(dx * r + dy * h - dx * h, dy * r + dx * h - dy * h);
                ctx.stroke();
            }
        },
        BOMB(ctx, s) {
            // A round bomb with a lit fuse: it clears what it lands on.
            const r = s * 0.32;
            ctx.beginPath();
            ctx.arc(-s * 0.06, s * 0.1, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s * 0.16, -s * 0.14);
            ctx.quadraticCurveTo(s * 0.3, -s * 0.42, s * 0.46, -s * 0.36);
            ctx.stroke();
            for (const a of [0, 1.6, 3.2, 4.8]) {
                ctx.beginPath();
                ctx.moveTo(s * 0.46 + Math.cos(a) * s * 0.06, -s * 0.36 + Math.sin(a) * s * 0.06);
                ctx.lineTo(s * 0.46 + Math.cos(a) * s * 0.14, -s * 0.36 + Math.sin(a) * s * 0.14);
                ctx.stroke();
            }
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
        const ink = cardOf(kind).colored ? COLOR_INK[color] : look.ink;
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
    const thingName = (kind, color) => (cardOf(kind).colored && color !== WHITE ? capitalized(color) + ' ' : '') + THING_LOOK[kind].name;
    const thingDoes = (kind, color) => THING_LOOK[kind].does + (!cardOf(kind).colored ? '' :
        color === WHITE ? ' (you pick its crate color when you place it)' : ` (only ${color} crates, and gremlins)`);

    // A Bomb's card once it has gone off (D-48): how many booms it has left.
    const bombLeft = p => {
        const left = cardOf(p.card).wipes - p.booms.length;
        return `${left} more boom${left === 1 ? '' : 's'}; Esc ends it`;
    };

    class GameUI {
        constructor(engine, canvas) {
            this.engine = engine;
            this.state = engine.state;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.sound = new GameSound();

            this.panX = 0;
            this.panY = 0;
            this.scale = 1;          // view scale (D-40): screen px per world px; the engine never sees it
            this.zoom = ZOOMS[0].label;   // the map-scale button last pressed (lit)
            this.panning = false;
            this.dragCandidate = false;
            this.panStartX = 0;
            this.panStartY = 0;
            this.panOrigX = 0;
            this.panOrigY = 0;

            this.picked = null;      // L1.2 { slot, card, mode, legal: Set<key>, kind, color, from, booms } — the card in play (PICK_MODES; kind/color: what a ghost draws; from: a carried Thing's hex; booms: the hexes a Bomb has blown up, D-48)
            this.choosing = null;    // L5 { q, r, colors } — the color picker's hex and swatches, while it's open (D-32)
            this.facing = 0;         // ghost facing; remembered between placements
            this.overlay = null;     // L5 'intro' | 'size' (board-size pickers) | 'news' (a color opened) | 'help' (the keys) | 'color' (the color picker, D-32) | null
            this.hoveredHex = null;  // L1.3
            this.selected = null;    // {q, r} — a clicked hex: highlighted, holds Go; a second click turns its mover
            this.bursts = [];        // [{ q, r, thing, piece, t0 }] — Bomb booms bursting now, outside any tick (D-48)
            this.queued = null;      // a command that came in during the tick animation, run when it ends (one slot, the latest wins)
            this.anim = null;        // { t0, dur, tracks: Map<id, track {pts, hop, over, end}>, before, hidden: Set<id>, milestone, ends: Set<type> }
            this.running = false;    // Go/Pause: tick on its own after each animation
            this.runTimer = null;    // the pending RUN_GAP_MS timeout, if any
            this.bannerTimer = null; // hides the milestone banner
            this.handDrawn = null;   // what renderHand last drew, so it redraws only on change
        }

        // ---- Lifecycle ----
        // A phone or tablet (D-41): the sorry page stands in for the whole game. The body class
        // hides every other panel and the canvas; no GameUI is built, so nothing listens.
        static showSorry() {
            document.body.classList.add('touch-only');
            const panel = document.getElementById('sorry-panel');
            panel.classList.remove('hidden');
            document.getElementById('sorry-picture').appendChild(cardPicture('BELT', SORRY_PICTURE_PX));
        }

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
            this.queued = null;
            this.hoveredHex = null;
            this.setRunning(false);
            this.scale = 1;          // every new game starts at full size (D-40)
            this.zoom = ZOOMS[0].label;
            this.markZoom();
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

        // Center the whole map when it fits the window at the current scale, nudged down a
        // little to clear the HUD; a bigger map centers on the source instead, and you drag to pan.
        centerMap() {
            const b = this.boardBounds();
            const fits = b.width * this.scale <= this.canvas.width && b.height * this.scale <= this.canvas.height;
            const src = this.hexToWorld(this.state.sources[0].q, this.state.sources[0].r);
            this.aimAt(fits ? b.cx : src.x, fits ? b.cy : src.y);
            this.panY += 10;
            this.clampPan();
        }

        // ---- L1.3 View: world px (Hex.toPixel at HEX_SIZE) → screen px is `world * scale + pan` (D-40) ----
        hexToWorld(q, r) {
            return new Hex(q, r).toPixel();
        }

        hexToScreen(q, r) {
            const p = this.hexToWorld(q, r);
            return { x: p.x * this.scale + this.panX, y: p.y * this.scale + this.panY };
        }

        screenToHex(sx, sy) {
            return Hex.fromPixel((sx - this.panX) / this.scale, (sy - this.panY) / this.scale);
        }

        // The board in world px: its hex centers' box (min/max, center) and its full extent
        // (a hex reaches at most HEX_SIZE past its center).
        boardBounds() {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const [, h] of this.state.hexes) {
                const p = this.hexToWorld(h.q, h.r);
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            }
            return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
                width: maxX - minX + 2 * HEX_SIZE, height: maxY - minY + 2 * HEX_SIZE };
        }

        // Pan so world point (wx, wy) sits at the canvas center.
        aimAt(wx, wy) {
            this.panX = this.canvas.width / 2 - wx * this.scale;
            this.panY = this.canvas.height / 2 - wy * this.scale;
        }

        // The world point at the canvas center, at view scale `scale`.
        centerWorld(scale) {
            return { x: (this.canvas.width / 2 - this.panX) / scale, y: (this.canvas.height / 2 - this.panY) / scale };
        }

        // The board can't leave the screen: the canvas center stays inside its hex-center box.
        clampPan() {
            if (!this.state.hexes) return;
            const b = this.boardBounds(), c = this.centerWorld(this.scale);
            const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
            this.aimAt(clamp(c.x, b.minX, b.maxX), clamp(c.y, b.minY, b.maxY));
        }

        // ---- Map scale (D-40): buttons only; no keys (1–3 pick cards) and no wheel (it turns the ghost) ----
        setZoom(label) {
            if (!this.state.hexes) return;
            const z = ZOOMS.find(z => z.label === label);
            const old = this.scale;
            this.scale = z.scale(this);
            this.zoom = label;
            z.place(this, old);
            this.clampPan();
            this.markZoom();
            this.render();
        }

        // Re-aim after a scale change so the point at the canvas center stays put.
        keepCenter(oldScale) {
            const c = this.centerWorld(oldScale);
            this.aimAt(c.x, c.y);
        }

        // ∞ centers the board in the space above the hand (D-40).
        centerBoard() {
            const b = this.boardBounds();
            this.panX = this.canvas.width / 2 - b.cx * this.scale;
            this.panY = this.aboveHand() / 2 - b.cy * this.scale;
        }

        // ∞: the largest scale, never above 1x, at which the whole board fits between the top
        // of the window and the top of the hand, and across the canvas, whichever is tighter.
        // Computed once, on the press; a later window resize doesn't redo it.
        fitScale() {
            const b = this.boardBounds();
            return Math.min(1, this.canvas.width / b.width, this.aboveHand() / b.height);
        }

        // Screen px from the top of the canvas to the top of the hand panel (the whole canvas if
        // the hand can't be measured).
        aboveHand() {
            const hand = document.getElementById('hand');
            const top = hand && hand.getBoundingClientRect ? hand.getBoundingClientRect().top : NaN;
            return top > 0 ? Math.min(top, this.canvas.height) : this.canvas.height;
        }

        markZoom() {
            for (const b of document.getElementById('zoom-buttons').children)
                b.classList.toggle('active', b.dataset.zoom === this.zoom);
        }

        buildZoomButtons(el) {
            for (const z of ZOOMS) {
                const b = document.createElement('button');
                b.className = 'btn zoom';
                b.textContent = z.label;
                b.title = z.title;
                b.dataset.zoom = z.label;
                b.addEventListener('click', () => this.setZoom(z.label));
                el.appendChild(b);
            }
            this.markZoom();
        }

        // On-map text is drawn only when it would be at least MIN_TEXT_PX on screen.
        readable(px) {
            return px * this.scale >= MIN_TEXT_PX;
        }

        // ---- L1.2 Pick a card: the legal set is computed once; the click is a lookup ----
        // Allowed mid-animation (the state is already post-tick), so a card can be picked
        // while Go runs; the run holds while a card is picked.
        pick(slot) {
            if (this.overlay) return;
            if (slot < 0 || slot >= this.state.hand.length) return;
            if (this.handLocked()) return;   // a spent card: no switching
            if (this.picked && this.picked.slot === slot) { this.unpick(); return; }
            this.selected = null;
            this.queued = null;
            const card = this.state.hand[slot].kind;
            const mode = startMode(card);
            this.picked = { slot, card, mode, legal: PICK_MODES[mode].legal(this, card), kind: card, color: WHITE, from: null, booms: [] };
            this.render();
        }

        // Is the card in play already spent (the Mover carrying a Thing, a Bomb that has gone off)? Then
        // only its own put-down, scrap or blast may follow (D-47, D-48).
        handLocked() {
            return !!this.picked && PICK_MODES[this.picked.mode].locked;
        }

        // Esc or right-click with a card in play: back one step, as its mode says.
        backOut() {
            PICK_MODES[this.picked.mode].back(this);
        }

        // The Mover's pick (D-47): the Thing on `hex` comes off the board (in the view only;
        // the engine hears of it with the put-down or the scrap, one command) and the card
        // becomes it: same kind, same color, placed by that kind's own rule.
        carry(hex) {
            const t = this.engine.thingAt(hex.q, hex.r);
            const p = this.picked;
            this.picked = { slot: p.slot, card: p.card, mode: 'carry', legal: PICK_MODES.carry.legal(this, t.kind),
                kind: t.kind, color: t.color, from: { q: t.q, r: t.r }, booms: [] };
            if (aims(t.kind)) this.facing = t.facing;   // the lifted Thing keeps its look under the cursor
            this.sound.step();
            this.render();
        }

        // Put the carried Thing down on (q, r): one command, one tick. Its color is kept, so
        // there's no color picker (D-32 call 6, D-47).
        putDown(q, r) {
            const { slot, from } = this.picked;
            this.commit(() => this.engine.move(slot, from.q, from.r, q, r, this.facing), () => this.sound.place());
        }

        // Backing out of a carried Thing scraps it: the Thing is gone, the card spent, one tick.
        scrapCarried() {
            const { slot, from } = this.picked;
            this.commit(() => this.engine.scrap(slot, from.q, from.r), () => this.sound.discard());
        }

        // The Bomb blows up `hex` (D-48): it bursts now and is drawn cleared from here on, in
        // the view only; the engine hears of every boom at once when the bomb ends. The first
        // boom spends the card; the last one ends the bomb.
        boom(hex) {
            const p = this.picked;
            const thing = this.engine.thingAt(hex.q, hex.r), piece = this.engine.pieceAt(hex.q, hex.r);
            p.mode = 'bomb';
            p.booms = [...p.booms, { q: hex.q, r: hex.r }];
            this.bursts.push({ q: hex.q, r: hex.r, thing: thing && { kind: thing.kind },
                piece: piece && { kind: piece.kind, color: piece.color, label: piece.label }, t0: performance.now() });
            this.sound.splat();
            if (this.bursts.length === 1) this.burstFrames();
            if (p.booms.length >= cardOf(p.card).wipes) { this.endBomb(); return; }
            p.legal = PICK_MODES.bomb.legal(this, p.card);
            this.render();
        }

        // Redraw every frame while a boom is bursting (a tick's own animation may run alongside).
        burstFrames() {
            const frame = () => {
                this.render();
                if (this.bursts.length) requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        }

        // The keys of `keys` the Bomb hasn't blown up.
        unboomed(keys) {
            const boomed = new Set(this.picked.booms.map(m => Hex.key(m.q, m.r)));
            return new Set([...keys].filter(k => !boomed.has(k)));
        }

        // Is (q, r) a hex the Bomb in play has blown up (drawn cleared before the engine hears)?
        boomed(q, r) {
            return !!this.picked && this.picked.booms.some(m => m.q === q && m.r === r);
        }

        // The bomb ends: one command, one tick (D-48). Its booms already burst and splatted on
        // screen, so their `clear`s and `splat`s are left out of the tick's animation (and its
        // end sound); the rest of the tick animates as usual.
        endBomb() {
            const { slot, booms } = this.picked;
            const shown = new Set(booms.map(m => Hex.key(m.q, m.r)));
            const gone = new Set(booms.map(m => this.engine.pieceAt(m.q, m.r)).filter(p => p).map(p => p.id));
            const unshown = e => !(e.type === 'clear' && e.hop === 0 && shown.has(Hex.key(e.q, e.r))) && !(e.type === 'splat' && gone.has(e.id));
            this.commit(() => {
                const res = this.engine.bomb(slot, booms);
                return res.ok ? { ...res, events: res.events.filter(unshown) } : res;
            }, () => {});
        }

        // The Thing a carry took off the board, or null.
        carried() {
            return this.picked && this.picked.from ? this.engine.thingAt(this.picked.from.q, this.picked.from.r) : null;
        }

        unpick() {
            this.picked = null;
            this.queued = null;
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
            if (!res.ok) { this.render(); return false; }
            this.picked = null;
            cue();
            this.startAnim(before, res);
            return true;
        }

        place(q, r, color) {
            const slot = this.picked.slot;
            this.commit(() => this.engine.place(slot, q, r, this.facing, color), () => this.sound.place());
        }

        // A click on a legal hex: with one color to choose from (every kind but Pushers and
        // Pullers), place at once; otherwise ask for the color first (D-32).
        placeOrAsk(q, r) {
            const colors = this.engine.colorChoices(this.picked.kind);
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
            const reach = HEX_SIZE * this.scale;   // the hex's radius on screen
            box.style.left = Math.min(x + reach, window.innerWidth - COLOR_PICKER_PX - 8) + 'px';
            box.style.top = Math.max(8, y - reach - COLOR_PICKER_PX) + 'px';
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

        // Remove the Thing on the selected hex (D), never the hovered one (D-39); a bare hex
        // or no selection does nothing. A remove lets go of the hex, so Go resumes.
        // Mid-animation it waits for the tick to end, then runs (queued).
        removeSelected() {
            if (this.overlay || !this.selected) return;
            if (this.anim) { this.queued = () => this.removeSelected(); return; }
            const { q, r } = this.selected;
            if (this.commit(() => this.engine.remove(q, r), () => this.sound.sink())) this.selected = null;
        }

        // Blow up the crate under the cursor (B). Not while a spent card is in play (D-47).
        // The hex is the one hovered at the keypress, even if the blast waits for the tick.
        blastHovered() {
            if (this.overlay || !this.hoveredHex) return;
            this.blastAt(this.hoveredHex.q, this.hoveredHex.r);
        }

        blastAt(q, r) {
            if (this.overlay || this.handLocked()) return;
            if (this.anim) { this.queued = () => this.blastAt(q, r); return; }
            this.commit(() => this.engine.blast(q, r), () => {});
        }

        // The Discard spot or X: throw the card in play away, as its mode says; it ticks like
        // any command. Mid-animation it waits for the tick to end, then runs, if the same card
        // is still in play.
        discardPicked() {
            if (this.overlay || !this.picked) return;
            if (this.anim) { const p = this.picked; this.queued = () => { if (this.picked === p) this.discardPicked(); }; return; }
            PICK_MODES[this.picked.mode].discard(this);
        }

        discardCard() {
            const slot = this.picked.slot;
            this.commit(() => this.engine.discard(slot), () => this.sound.discard());
        }

        // A card's red X or Shift+1/2/3: throw that card away in one action, without picking it
        // (D-50); the same discard and tick as pick-then-Discard. A different card in play goes
        // back first. Not while the hand is locked (a carry, a bomb gone off) or an overlay is
        // open; mid-animation it waits in the one-slot queue and re-checks when the tick ends (D-49).
        discardSlot(slot) {
            if (this.overlay || this.handLocked()) return;
            if (slot < 0 || slot >= this.state.hand.length) return;
            if (this.anim) { this.queued = () => this.discardSlot(slot); return; }
            if (this.picked && this.picked.slot !== slot) this.unpick();
            this.commit(() => this.engine.discard(slot), () => this.sound.discard());
        }

        // L2.1 the primary action (Wait button, Space). Not while a spent card is in play: the
        // Mover's carry ends only in a put-down or a scrap (D-47).
        primaryAction() {
            if (this.overlay || this.anim || this.handLocked()) return;
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
        // The engine moves pieces in lockstep, one hex per hop (D-38), and the animation plays
        // the same hops: each piece that moved or ended gets a track, `pts[k]` being where it
        // stands after hop k (its pre-tick hex until its move's start `hop`, then its path).
        // All tracks advance together one hop per HOP_MS; a piece that ends (sinks, is
        // delivered, splats) fades over the hop after its end's `hop`; spawned crates appear
        // at the end. Since the engine never puts two pieces on one hex at a hop, no two
        // tracks overlap (a shot passing over, its move's first `over` hexes, aside).
        startAnim(before, res) {
            const tracks = new Map();
            const hidden = new Set();
            const milestones = [];
            const opened = [];
            const unlocked = [];
            const redrawn = [];
            const cleared = [];   // Things taken off mid-command (a bomb, a new endpoint): a burst on their hop
            const ends = new Set();
            const still = id => ({ q: before.get(id).q, r: before.get(id).r });
            const trackOf = id => tracks.get(id) || { ...before.get(id), pts: [still(id)], hop: 0, over: 0, end: null };
            for (const e of res.events) {
                if (e.type === 'move') {
                    const pts = [...Array.from({ length: e.hop }, () => still(e.id)), ...e.path];
                    tracks.set(e.id, { ...trackOf(e.id), pts, hop: e.hop, over: e.over });
                } else if (e.type === 'sink' || e.type === 'deliver' || e.type === 'splat') {
                    // It stands where it ended until that hop, then fades.
                    const t = trackOf(e.id);
                    while (t.pts.length < e.hop + 1) t.pts.push(t.pts[t.pts.length - 1]);
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
                } else if (e.type === 'clear') {
                    cleared.push(e);
                }
            }
            const hops = Math.max(1, ...[...tracks.values()].map(t => t.pts.length - 1 + (t.end ? 1 : 0)),
                ...cleared.map(e => e.hop + 1));
            this.anim = { t0: performance.now(), dur: hops * HOP_MS,
                tracks, before, hidden, milestones, opened, unlocked, redrawn, cleared, ends };
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
            const queued = this.queued;   // its own guards drop it if, say, a news overlay just opened
            this.queued = null;
            if (queued) queued();
            this.scheduleRun();
        }

        // Where a tracked piece is drawn at time `now` (world px, D-40), and how opaque.
        trackPose(t, now) {
            // Never before hop 0, even if `now` came from a clock that precedes t0.
            const k = Math.max(0, (now - this.anim.t0) / HOP_MS);
            const last = t.pts.length - 1;
            if (k >= last) {
                // Arrived; a sinking or delivered piece fades over one more hop.
                const fade = t.end ? Math.max(0, 1 - (k - last)) : 1;
                return { ...this.hexToWorld(t.pts[last].q, t.pts[last].r), alpha: fade, scale: t.end ? 0.6 + 0.4 * fade : 1 };
            }
            const i = Math.floor(k), f = k - i;
            const a = this.hexToWorld(t.pts[i].q, t.pts[i].r), b = this.hexToWorld(t.pts[i + 1].q, t.pts[i + 1].r);
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

            // Everything on the board draws in world px under one view transform (D-40), so the
            // art, line widths and fonts all scale together; only text checks `readable`.
            ctx.save();
            ctx.setTransform(this.scale, 0, 0, this.scale, this.panX, this.panY);

            for (const [, hex] of s.hexes) {
                const { x, y } = this.hexToWorld(hex.q, hex.r);
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
            // A carried Thing is off the board, in the hand (D-47).
            const doomed = this.replaceTarget(this.ghostHex());
            const carried = this.carried();
            for (const t of s.things) {
                if (t === doomed || t === carried || this.boomed(t.q, t.r)) continue;
                const { x, y } = this.hexToWorld(t.q, t.r);
                drawThing(ctx, x, y, HEX_SIZE, t.kind, t.color, t.facing, 1);
            }

            // L1.2 legal placements for the picked card, plus a ghost under the cursor. A legal
            // hex holding a Thing (placing replaces it) also gets a dashed yellow ring.
            if (this.picked) {
                const mode = PICK_MODES[this.picked.mode];
                for (const key of this.picked.legal) {
                    const { q, r } = Hex.fromKey(key);
                    const { x, y } = this.hexToWorld(q, r);
                    drawHexPath(ctx, x, y, HEX_SIZE);
                    ctx.fillStyle = `rgba(${REACH_COLOR}, 0.28)`;
                    ctx.fill();
                    const there = this.engine.thingAt(q, r);
                    if (!mode.rings || !there || there === carried) continue;
                    drawHexPath(ctx, x, y, HEX_SIZE - 2);
                    ctx.save();
                    ctx.setLineDash([4, 3]);
                    ctx.strokeStyle = `rgba(${REACH_COLOR}, 0.9)`;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.restore();
                }
                const h = this.ghostHex();
                if (mode.ghost && h && (mode.ghostAnywhere || this.picked.legal.has(Hex.key(h.q, h.r)))) {
                    const { x, y } = this.hexToWorld(h.q, h.r);
                    drawThing(ctx, x, y, HEX_SIZE, this.picked.kind, this.picked.color, this.facing, 0.7);
                }
            } else if (this.hoveredHex && !this.anim) {
                // A bare hover over a mover: outline it — clicking turns it.
                const t = this.engine.thingAt(this.hoveredHex.q, this.hoveredHex.r);
                if (t && aims(t.kind)) {
                    const { x, y } = this.hexToWorld(t.q, t.r);
                    drawHexPath(ctx, x, y, HEX_SIZE - 2);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            this.drawPieces(now);
            this.drawBursts(now);
            if (this.selected) this.drawSelected(this.selected);
            ctx.restore();
            this.updateHUD();
        }

        // Where the ghost stands: the hex the color picker is open on, else the hovered one.
        ghostHex() {
            return this.choosing || this.hoveredHex;
        }

        // The placed Thing that placing the picked card on `h` would replace, or null (a
        // carried Thing's own hex replaces nothing; picking up replaces nothing).
        replaceTarget(h) {
            if (!this.picked || !PICK_MODES[this.picked.mode].rings || !h || !this.picked.legal.has(Hex.key(h.q, h.r))) return null;
            const t = this.engine.thingAt(h.q, h.r);
            return t && t !== this.carried() ? t : null;
        }

        // The Bomb's booms bursting now (D-48), `k` going 0 → 1 over one hop: the Thing bursts
        // in its colors, the piece fades and splats as a tick's splat does. Done ones drop off.
        drawBursts(now) {
            this.bursts = this.bursts.filter(b => now - b.t0 < HOP_MS);
            for (const b of this.bursts) {
                const k = Math.max(0, (now - b.t0) / HOP_MS);
                const { x, y } = this.hexToWorld(b.q, b.r);
                if (b.thing) this.drawThingBurst(x, y, b.thing.kind, k);
                if (!b.piece) continue;
                this.drawSplat(x, y, SPLAT_COLOR[b.piece.kind](b.piece), k);
                this.drawPiece(x, y, b.piece, 1 - k, 0.6 + 0.4 * (1 - k));
            }
        }

        // A Thing blown off its hex: a burst in its fill, then its ink, as `k` goes 0 → 1.
        drawThingBurst(x, y, kind, k) {
            this.drawSplat(x, y, THING_LOOK[kind].fill, k);
            this.drawSplat(x, y, THING_LOOK[kind].ink, Math.min(1, k + 0.2));
        }

        // The selected hex: a bright outline, and over a mover a white arrow along its facing.
        drawSelected({ q, r }) {
            const ctx = this.ctx;
            const { x, y } = this.hexToWorld(q, r);
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
                    if (this.boomed(p.q, p.r)) continue;   // blown up, the engine not yet told (D-48)
                    const { x, y } = this.hexToWorld(p.q, p.r);
                    this.drawPiece(x, y, p, 1, 1);
                }
                return;
            }
            // During a tick: a cleared Thing bursts in its colors over the hop after its own
            // (D-48); tracked pieces follow their paths (gone ones included); the rest sit
            // still; crates spawned this tick wait for the end.
            const k = Math.max(0, (now - a.t0) / HOP_MS);
            for (const e of a.cleared) {
                if (k < e.hop || k >= e.hop + 1) continue;
                const { x, y } = this.hexToWorld(e.q, e.r);
                this.drawThingBurst(x, y, e.kind, k - e.hop);
            }
            for (const [id, t] of a.tracks) {
                const pose = this.trackPose(t, now);
                if (t.end === 'splat' && pose.alpha < 1) this.drawSplat(pose.x, pose.y, SPLAT_COLOR[t.kind](t), 1 - pose.alpha);
                this.drawPiece(pose.x, pose.y, t, pose.alpha, pose.scale);
            }
            for (const p of this.state.pieces) {
                if (a.tracks.has(p.id) || a.hidden.has(p.id)) continue;
                const { x, y } = this.hexToWorld(p.q, p.r);
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

        // Sources and targets fill their hex with their color, marks in its light shade, under
        // a dark outline (D-42). A target: two rings.
        drawTarget(t) {
            const shades = CRATE_SHADES[t.color];
            const { x, y } = this.hexToWorld(t.q, t.r);
            this.fillPort(x, y, [shades.left]);
            const ctx = this.ctx;
            const inner = HEX_SIZE * Math.sqrt(3) / 2;
            ctx.strokeStyle = shades.light;
            ctx.lineWidth = PORT_MARK_WIDTH;
            for (const r of PORT_RING_RADII) {
                ctx.beginPath();
                ctx.arc(x, y, inner * r, 0, Math.PI * 2);
                ctx.stroke();
            }
            this.outlinePort(x, y);
        }

        // A source: a plus, vertex to vertex up and down, edge to edge across. One color fills
        // the hex; several split it into equal wedges (in `colors` order) under a neutral plus.
        drawSource(src) {
            const { x, y } = this.hexToWorld(src.q, src.r);
            const fills = src.colors.length ? src.colors.map(c => CRATE_SHADES[c].left) : [SOURCE_COLOR];
            this.fillPort(x, y, fills);
            const ctx = this.ctx;
            const reachY = HEX_SIZE * PORT_PLUS_REACH, reachX = HEX_SIZE * Math.sqrt(3) / 2 * PORT_PLUS_REACH;
            ctx.strokeStyle = src.colors.length === 1 ? CRATE_SHADES[src.colors[0]].light : PORT_NEUTRAL_MARK;
            ctx.lineWidth = PORT_MARK_WIDTH;
            ctx.beginPath();
            ctx.moveTo(x, y - reachY);
            ctx.lineTo(x, y + reachY);
            ctx.moveTo(x - reachX, y);
            ctx.lineTo(x + reachX, y);
            ctx.stroke();
            this.outlinePort(x, y);
        }

        // Fills the hex with equal wedges, one per color, clockwise from the top.
        fillPort(x, y, colors) {
            const ctx = this.ctx;
            ctx.save();
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.clip();
            const step = Math.PI * 2 / colors.length;
            colors.forEach((color, i) => {
                const from = -Math.PI / 2 + i * step;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.arc(x, y, HEX_SIZE * 1.2, from, from + step);
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
            });
            ctx.restore();
        }

        outlinePort(x, y) {
            const ctx = this.ctx;
            drawHexPath(ctx, x, y, HEX_SIZE - PORT_OUTLINE_WIDTH / 2);
            ctx.strokeStyle = PORT_OUTLINE;
            ctx.lineWidth = PORT_OUTLINE_WIDTH;
            ctx.stroke();
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
            const px = Math.floor(s * 0.55);
            if (this.readable(px)) {
                ctx.fillStyle = this.contrastText(color);
                ctx.font = `bold ${px}px ${UI_FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, cx, cy + 1);
            }
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
            const cleared = this.boomed(h.q, h.r);   // a Bomb blew it up already (D-48)
            const t = this.engine.thingAt(h.q, h.r);
            if (t && t !== this.carried() && !cleared) parts.push(`${thingName(t.kind, t.color)}: ${thingDoes(t.kind, t.color)}` + this.thingHint(h, t));
            const p = this.engine.pieceAt(h.q, h.r);
            if (p && !cleared) parts.push(PIECE_LOOK[p.kind].name);
            hoverEl.textContent = parts.join(' · ');
            document.getElementById('hud-hover').classList.remove('hidden');
        }

        // What the mouse can do to the hovered Thing `t` on `h`, for the hover bar.
        thingHint(h, t) {
            if (this.replaceTarget(h)) return ' (click to replace)';
            if (this.picked) return PICK_MODES[this.picked.mode].hint(this);
            if (this.selected && Hex.same(this.selected, h)) return aims(t.kind) ? ' (click to turn, D to remove)' : ' (D to remove)';
            return aims(t.kind) ? ' (click to select, then click to turn or D to remove)' : ' (click to select, then D to remove)';
        }

        // The hand: one card per slot, each with a little canvas of the Thing. Redrawn only
        // when what it shows changes, not on every animation frame or mouse move.
        renderHand() {
            const el = document.getElementById('cards');
            const s = this.state;
            document.getElementById('discard').classList.toggle('armed', !!this.picked);
            const p = this.picked;
            const shown = JSON.stringify([s.hand, p && [p.slot, p.kind, p.color, p.booms.length], this.facing]);
            if (shown === this.handDrawn && el.children.length === HAND_SIZE) return;
            this.handDrawn = shown;
            if (el.children.length !== HAND_SIZE) {
                el.innerHTML = '';
                for (let i = 0; i < HAND_SIZE; i++) {
                    const b = document.createElement('button');
                    b.className = 'card';
                    b.innerHTML = `<canvas width="64" height="64"></canvas><span class="name"></span>` +
                        `<span class="does"></span><kbd>${i + 1}</kbd>` +
                        `<span class="x" role="button" title="Throw this card away (Shift+${i + 1}, ticks)">×</span>`;
                    b.addEventListener('click', () => this.pick(i));
                    b.querySelector('.x').addEventListener('click', e => { e.stopPropagation(); this.discardSlot(i); });
                    el.appendChild(b);
                }
            }
            [...el.children].forEach((b, i) => {
                // Cards have no color (D-32); a picked card shows what it is now (a Mover
                // carrying a Thing shows that Thing, in its color, D-47; a Bomb that has gone off,
                // the booms it has left, D-48).
                const picked = p && p.slot === i;
                const kind = picked ? p.kind : s.hand[i].kind, color = picked ? p.color : WHITE;
                b.classList.toggle('picked', !!picked);
                b.querySelector('.name').textContent = thingName(kind, color);
                b.querySelector('.does').textContent = picked && p.booms.length ? bombLeft(p) : thingDoes(kind, color);
                const c = b.querySelector('canvas'), cx = c.getContext('2d');
                cx.clearRect(0, 0, c.width, c.height);
                drawThing(cx, 32, 32, 26, kind, color, aims(kind) ? (picked ? this.facing : 0) : null, 1);
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
            this.buildZoomButtons(document.getElementById('zoom-buttons'));
        }

        onMouseDown(e) {
            // Right button: narrow cancel — put the picked card back (L2.2). No pan.
            if (e.button === 2) {
                if (this.picked) this.backOut();
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
            if (this.picked) { this.clickPicked(hex); return; }
            if (this.selected) {
                if (Hex.same(this.selected, hex)) this.rotate(hex.q, hex.r);
                else this.deselect();
                return;
            }
            if (this.state.hexes.has(key)) this.select(hex.q, hex.r);
        }

        // A board click with a card in play, as its mode says. L1.1 a place (or a pick-up)
        // waits for the tick: mid-animation it's queued and runs when the tick ends, if the
        // same card is still in play.
        clickPicked(hex) {
            if (this.overlay || !this.picked) return;
            if (this.anim) { const p = this.picked; this.queued = () => { if (this.picked === p) this.clickPicked(hex); }; return; }
            PICK_MODES[this.picked.mode].click(this, hex, this.picked.legal.has(Hex.key(hex.q, hex.r)));
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
                this.clampPan();
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
            if (e.key === 'Escape') { if (this.picked) this.backOut(); else if (this.selected) this.deselect(); return; }   // L2.2
            if (e.key === ' ') { e.preventDefault(); this.oneTick(); return; }
            if (e.key === 'Enter') { e.preventDefault(); this.toggleRun(); return; }
            // Shift+number discards that slot (D-50). e.key reads '!' '@' '#' (or other
            // characters, by layout) with Shift, so the slot comes from e.code.
            const digit = /^(Digit|Numpad)([1-9])$/.exec(e.code || '');
            if (e.shiftKey && digit) { this.discardSlot(Number(digit[2]) - 1); return; }
            if (e.key >= '1' && e.key <= String(HAND_SIZE)) { this.pick(Number(e.key) - 1); return; }
            if ((e.key === 'r' || e.key === 'R') && this.picked) { this.turnGhost(e.shiftKey ? -1 : 1); return; }
            if (e.key === 'd' || e.key === 'D') { this.removeSelected(); return; }
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
