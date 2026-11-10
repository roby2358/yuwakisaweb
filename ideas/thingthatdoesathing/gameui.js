// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering, the DOM HUD and hand, camera/pan,
// tick animation, and all input wiring. It owns the view and interaction state (picked
// card, hover, pan, overlay, animation) — none of which is game state — and drives
// GameEngine through its commands, animating each tick from the events it returns.
//
// Input dispatch mirrors UI_CONTROLS.md (layer citations kept): overlay → animation →
// picked card → bare map click.
const GameUI = (function () {
    const {
        HEX_SIZE, COUNTER_SIZE, HOP_MS, TERRAIN_COLORS, TERRAIN_NAMES, THING_LOOK,
        CRATE_COLOR, SOURCE_COLOR, TARGET_COLOR, BG_COLOR, UI_FONT, REACH_COLOR
    } = GameDisplayArtifacts;
    const { TERRAIN, THINGS, DELIVER_GOAL, HAND_SIZE } = GameArtifacts;

    const DRAG_THRESHOLD = 4;
    const clockwise = f => (f + 5) % 6;
    const counterClockwise = f => (f + 1) % 6;
    // Has a facing the player can turn: pushers (Belt, Spring) and pullers.
    const aims = kind => THINGS[kind].push > 0 || THINGS[kind].pull > 0;

    // Screen angle of a facing (pointy-top axial direction → pixels).
    function facingAngle(facing) {
        const d = NEIGHBOR_DIRS[facing];
        const p = new Hex(d.q, d.r).toPixel();
        return Math.atan2(p.y, p.x);
    }

    // Draw a Thing centered at (x, y) with hex radius s. Shared by the board and the hand.
    function drawThing(ctx, x, y, s, kind, facing, alpha = 1) {
        const look = THING_LOOK[kind];
        ctx.save();
        ctx.globalAlpha = alpha;
        drawHexPath(ctx, x, y, kind === 'WALL' ? s : s * 0.84);
        ctx.fillStyle = look.fill;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.strokeStyle = look.ink;
        ctx.fillStyle = look.ink;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2, s * 0.1);
        ctx.translate(x, y);

        const chevron = (cx, w) => {
            ctx.beginPath();
            ctx.moveTo(cx - w, -w);
            ctx.lineTo(cx, 0);
            ctx.lineTo(cx - w, w);
            ctx.stroke();
        };

        if (kind === 'BELT') {
            ctx.rotate(facingAngle(facing));
            chevron(-s * 0.12, s * 0.26);
            chevron(s * 0.28, s * 0.26);
        } else if (kind === 'SPRING') {
            ctx.rotate(facingAngle(facing));
            // A coil, then a big arrowhead: it throws far.
            ctx.beginPath();
            const n = 5, x0 = -s * 0.55, x1 = s * 0.05, h = s * 0.22;
            ctx.moveTo(x0, 0);
            for (let i = 0; i < n; i++) ctx.lineTo(x0 + (x1 - x0) * (i + 0.5) / n, i % 2 ? h : -h);
            ctx.lineTo(x1, 0);
            ctx.stroke();
            chevron(s * 0.5, s * 0.3);
        } else if (kind === 'PULLER') {
            // A horseshoe magnet opening toward its facing, with a chevron pointing back
            // at itself: it reaches out that way and pulls things in.
            ctx.rotate(facingAngle(facing));
            ctx.beginPath();
            ctx.arc(-s * 0.1, 0, s * 0.3, Math.PI * 0.5, Math.PI * 1.5);
            ctx.lineTo(s * 0.35, -s * 0.3);
            ctx.moveTo(-s * 0.1, s * 0.3);
            ctx.lineTo(s * 0.35, s * 0.3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s * 0.55, -s * 0.16);
            ctx.lineTo(s * 0.4, 0);
            ctx.lineTo(s * 0.55, s * 0.16);
            ctx.stroke();
        } else if (kind === 'WALL') {
            ctx.lineWidth = Math.max(1, s * 0.05);
            for (const yy of [-0.3, 0, 0.3]) {
                ctx.beginPath(); ctx.moveTo(-s * 0.8, yy * s); ctx.lineTo(s * 0.8, yy * s); ctx.stroke();
            }
            for (const [xx, y0] of [[-0.25, -0.3], [0.3, -0.3], [0, 0], [-0.5, 0], [0.5, 0], [-0.25, 0.3], [0.3, 0.3]]) {
                ctx.beginPath(); ctx.moveTo(xx * s, y0 * s); ctx.lineTo(xx * s, (y0 + 0.3) * s); ctx.stroke();
            }
        } else if (kind === 'BRIDGE') {
            ctx.lineWidth = Math.max(1, s * 0.06);
            for (let i = -3; i <= 3; i++) {
                ctx.beginPath(); ctx.moveTo(i * s * 0.18, -s * 0.55); ctx.lineTo(i * s * 0.18, s * 0.55); ctx.stroke();
            }
        }
        ctx.restore();
    }

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
            this.facing = 0;         // ghost facing; remembered between placements
            this.overlay = null;     // L5 'intro' | 'victory' | null
            this.hoveredHex = null;  // L1.3
            this.anim = null;        // { t0, dur, tracks: Map<id, track>, hidden: Set<id>, won }
        }

        // ---- Lifecycle ----
        start() {
            this.attach();
            this.newGame();
        }

        newGame() {
            this.engine.newGame();
            this.picked = null;
            this.anim = null;
            this.hoveredHex = null;
            document.getElementById('intro-goal').textContent = DELIVER_GOAL;
            this.showOverlay('intro');
            this.resize();
        }

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.centerMap();
            this.render();
        }

        // Center the whole (small) map, nudged down a little to clear the HUD.
        centerMap() {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const [, h] of this.state.hexes) {
                const p = new Hex(h.q, h.r).toPixel();
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            }
            this.panX = this.canvas.width / 2 - (minX + maxX) / 2;
            this.panY = this.canvas.height / 2 - (minY + maxY) / 2 + 10;
        }

        hexToScreen(q, r) {
            const p = new Hex(q, r).toPixel();
            return { x: p.x + this.panX, y: p.y + this.panY };
        }

        screenToHex(sx, sy) {
            return Hex.fromPixel(sx - this.panX, sy - this.panY);
        }

        // ---- L1.2 Pick a card: the legal set is computed once; the click is a lookup ----
        pick(slot) {
            if (this.overlay || this.anim || this.state.gameWon) return;
            if (slot < 0 || slot >= this.state.hand.length) return;
            if (this.picked && this.picked.slot === slot) { this.unpick(); return; }
            this.picked = { slot, legal: this.engine.legalPlacements(this.state.hand[slot]) };
            this.render();
        }

        unpick() {
            this.picked = null;
            this.render();
        }

        turnGhost(dir) {
            this.facing = dir > 0 ? clockwise(this.facing) : counterClockwise(this.facing);
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

        place(q, r) {
            const slot = this.picked.slot;
            this.commit(() => this.engine.place(slot, q, r, this.facing), () => this.sound.place());
        }

        rotate(q, r) {
            this.commit(() => this.engine.rotate(q, r), () => this.sound.step());
        }

        // L2.1 the primary action (Wait button, Space, Enter).
        primaryAction() {
            if (this.overlay || this.anim || this.state.gameWon) return;
            this.commit(() => this.engine.wait(), () => this.sound.endTurn());
        }

        // ---- Tick animation ----
        // Each piece that moved gets a track: its pre-tick hex, then every hex it entered.
        // All tracks advance together one hop per HOP_MS; spawned crates appear at the end.
        startAnim(before, res) {
            const tracks = new Map();
            const hidden = new Set();
            let hops = 0, sank = false, delivered = false;
            for (const e of res.events) {
                if (e.type === 'move') {
                    const b = before.get(e.id);
                    tracks.set(e.id, { ...b, pts: [{ q: b.q, r: b.r }, ...e.path], end: null });
                    hops = Math.max(hops, e.path.length);
                } else if (e.type === 'sink' || e.type === 'deliver') {
                    const t = tracks.get(e.id);
                    if (t) t.end = e.type;
                    if (e.type === 'sink') sank = true; else delivered = true;
                } else if (e.type === 'spawn') {
                    hidden.add(e.id);
                }
            }
            this.anim = { t0: performance.now(), dur: Math.max(1, hops + (sank || delivered ? 1 : 0)) * HOP_MS,
                tracks, before, hidden, won: !!res.won, sank, delivered };
            const frame = now => {
                if (!this.anim) return;
                if (now - this.anim.t0 >= this.anim.dur) { this.finishAnim(); return; }
                this.render(now);
                requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        }

        finishAnim() {
            const a = this.anim;
            this.anim = null;
            if (a.delivered) this.sound.deliver();
            else if (a.sank) this.sound.sink();
            if (a.won) { this.sound.fanfare(); this.showOverlay('victory'); }
            this.render();
        }

        // Where a tracked piece is drawn at time `now`, and how opaque.
        trackPose(t, now) {
            // rAF's timestamp is the frame start, which can precede t0 (taken with
            // performance.now() mid-frame) — clamp so the first frame isn't at hop -1.
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

        // ---- L5 Overlays ----
        showOverlay(name) {
            this.overlay = name;
            document.getElementById('intro-panel').classList.toggle('hidden', name !== 'intro');
        }

        dismissOverlay() {
            if (this.overlay === 'intro') this.sound.fanfare();
            this.overlay = null;
            document.getElementById('intro-panel').classList.add('hidden');
            this.render();
        }

        // ---- Rendering ----
        render(now = performance.now()) {
            const ctx = this.ctx;
            const s = this.state;
            ctx.fillStyle = BG_COLOR;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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

            this.drawPort(s.source, SOURCE_COLOR, 'IN');
            this.drawPort(s.target, TARGET_COLOR, '★');

            for (const t of s.things) {
                const { x, y } = this.hexToScreen(t.q, t.r);
                drawThing(ctx, x, y, HEX_SIZE, t.kind, t.facing);
            }

            // L1.2 legal placements for the picked card, plus a ghost under the cursor.
            if (this.picked) {
                for (const key of this.picked.legal) {
                    const { q, r } = Hex.fromKey(key);
                    const { x, y } = this.hexToScreen(q, r);
                    drawHexPath(ctx, x, y, HEX_SIZE);
                    ctx.fillStyle = `rgba(${REACH_COLOR}, 0.28)`;
                    ctx.fill();
                }
                const h = this.hoveredHex;
                if (h && this.picked.legal.has(Hex.key(h.q, h.r))) {
                    const { x, y } = this.hexToScreen(h.q, h.r);
                    drawThing(ctx, x, y, HEX_SIZE, s.hand[this.picked.slot], this.facing, 0.7);
                }
            } else if (this.hoveredHex && !this.anim && !s.gameWon) {
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
            if (this.overlay === 'victory') this.drawVictory();
            this.updateHUD();
        }

        drawPieces(now) {
            const a = this.anim;
            if (!a) {
                for (const p of this.state.pieces) {
                    const { x, y } = this.hexToScreen(p.q, p.r);
                    this.drawCounter(x, y, p.color || CRATE_COLOR, p.label);
                }
                return;
            }
            // During a tick: tracked pieces follow their paths (gone ones included); the
            // rest sit still; crates spawned this tick wait for the end.
            for (const [id, t] of a.tracks) {
                const pose = this.trackPose(t, now);
                this.drawCounter(pose.x, pose.y, t.color || CRATE_COLOR, t.label, pose.alpha, pose.scale);
            }
            for (const p of this.state.pieces) {
                if (a.tracks.has(p.id) || a.hidden.has(p.id)) continue;
                const { x, y } = this.hexToScreen(p.q, p.r);
                this.drawCounter(x, y, p.color || CRATE_COLOR, p.label);
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
        drawPort(at, color, label) {
            if (!at) return;
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

        drawVictory() {
            const ctx = this.ctx;
            const s = this.state;
            const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            const w = 360, h = 180;
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 24;
            this.roundRect(cx - w / 2, cy - h / 2, w, h, 10);
            ctx.fillStyle = 'rgba(16, 20, 26, 0.94)';
            ctx.fill();
            ctx.restore();
            ctx.strokeStyle = TARGET_COLOR;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = TARGET_COLOR;
            ctx.font = `bold 40px ${UI_FONT}`;
            ctx.fillText('IT DOES THE THING', cx, cy - 36);
            const turns = s.turn - 1;
            ctx.fillStyle = '#e8e6e1';
            ctx.font = `17px ${UI_FONT}`;
            ctx.fillText(`${s.delivered} crates in ${turns} turn${turns === 1 ? '' : 's'}` +
                (s.lost ? ` · ${s.lost} lost at sea` : ''), cx, cy + 12);
            ctx.fillStyle = '#9aa0a8';
            ctx.font = `13px ${UI_FONT}`;
            ctx.fillText('Click or press Space to admire the contraption', cx, cy + 52);
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

        drawCounter(cx, cy, color, label, alpha = 1, scale = 1) {
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
            document.getElementById('progress-fill').style.width = Math.min(1, s.delivered / DELIVER_GOAL) * 100 + '%';
            document.getElementById('progress-pct').textContent = `${s.delivered} / ${DELIVER_GOAL}`;
            document.getElementById('lost-info').textContent = s.lost ? `${s.lost} lost` : '';
            this.renderHand();

            const hoverEl = document.getElementById('hover-info');
            const h = this.hoveredHex && s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            if (!h) { document.getElementById('hud-hover').classList.add('hidden'); return; }
            const parts = [TERRAIN_NAMES[h.terrain]];
            if (s.source.q === h.q && s.source.r === h.r) parts.push('Source — crates appear here');
            if (s.target.q === h.q && s.target.r === h.r) parts.push('Target — deliver crates here');
            const t = this.engine.thingAt(h.q, h.r);
            if (t) parts.push(`${THING_LOOK[t.kind].name}: ${THING_LOOK[t.kind].does}` +
                (aims(t.kind) && !this.picked ? ' (click to turn)' : ''));
            const p = this.engine.pieceAt(h.q, h.r);
            if (p) parts.push(p.kind === 'crate' ? 'Crate' : 'Gremlin — wanders');
            hoverEl.textContent = parts.join(' · ');
            document.getElementById('hud-hover').classList.remove('hidden');
        }

        // The hand: one card per slot, each with a little canvas of the Thing.
        renderHand() {
            const el = document.getElementById('hand');
            const s = this.state;
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
                const kind = s.hand[i];
                const look = THING_LOOK[kind];
                const picked = this.picked && this.picked.slot === i;
                b.classList.toggle('picked', !!picked);
                b.disabled = s.gameWon;
                b.querySelector('.name').textContent = look.name;
                b.querySelector('.does').textContent = look.does;
                const c = b.querySelector('canvas'), cx = c.getContext('2d');
                cx.clearRect(0, 0, c.width, c.height);
                drawThing(cx, 32, 32, 26, kind, aims(kind) ? (picked ? this.facing : 0) : null);
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
            document.getElementById('new-game').addEventListener('click', () => this.newGame());
            document.getElementById('begin-btn').addEventListener('click', () => this.dismissOverlay());
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

        handleClick(e) {
            const s = this.state;
            if (this.overlay) { this.dismissOverlay(); return; }   // L5 captures & consumes
            if (this.anim || s.gameWon) return;                     // L1.1 input waits for the tick
            const hex = this.screenToHex(e.clientX, e.clientY);
            const key = Hex.key(hex.q, hex.r);
            if (this.picked) {
                if (this.picked.legal.has(key)) this.place(hex.q, hex.r);
                else this.unpick();
                return;
            }
            const t = this.engine.thingAt(hex.q, hex.r);
            if (t && aims(t.kind)) this.rotate(hex.q, hex.r);
        }

        onMouseMove(e) {
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
            if (this.overlay && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
                e.preventDefault();
                this.dismissOverlay();
                return;
            }
            if (e.key === 'Escape') { if (this.picked) this.unpick(); return; }   // L2.2
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.primaryAction(); return; }
            if (e.key >= '1' && e.key <= String(HAND_SIZE)) { this.pick(Number(e.key) - 1); return; }
            if ((e.key === 'r' || e.key === 'R') && this.picked) this.turnGhost(e.shiftKey ? -1 : 1);
        }
    }

    return GameUI;
})();
