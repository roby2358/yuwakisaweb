// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering, the DOM HUD, camera/pan, and all
// input wiring. It owns the *view and interaction* state (pan offset, hovered hex,
// current selection, modal targeting, overlays) — none of which is game state — and it
// drives GameEngine by dispatching actions and re-rendering from GameState afterward.
//
// The input dispatch mirrors UI_CONTROLS.md; layer citations (L1.2, L2.1, …) are kept.
// In a client/server world this is the client: swap engine calls for messages to a
// server and re-render from the state it ships back, and the seam is already here.
const GameUI = (function () {
    const {
        HEX_SIZE, COUNTER_SIZE, TERRAIN_COLORS, TERRAIN_NAMES,
        BUILDING_COLORS, BUILDING_LABELS, ROAD_COLOR, MONUMENT_COLOR
    } = GameDisplayArtifacts;
    const { WORKER_MP, MONUMENT_STAGES, BUILDINGS } = GameArtifacts;

    // A left press that stays within this many pixels is a click (select/move);
    // moving past it turns the gesture into a camera pan.
    const DRAG_THRESHOLD = 4;

    // Compact "4w 2s 1g" readout for a { wood, stone, gold } cost object.
    function costText(cost) {
        return Object.entries(cost).map(([k, v]) => `${v}${k[0]}`).join(' ');
    }

    // Darken/lighten a '#rrggbb' color by a factor (elevation shading).
    function shadeColor(hexColor, factor) {
        const ch = i => Math.max(0, Math.min(255,
            Math.round(parseInt(hexColor.slice(i, i + 2), 16) * factor)));
        const to = c => c.toString(16).padStart(2, '0');
        return '#' + to(ch(1)) + to(ch(3)) + to(ch(5));
    }

    class GameUI {
        constructor(engine, canvas) {
            this.engine = engine;
            this.state = engine.state;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.sound = new GameSound();   // client-only audio cues

            // ---- View state (render-only; never part of GameState) ----
            this.panX = 0;
            this.panY = 0;
            this.panning = false;
            this.dragCandidate = false;  // left button down; may become a pan
            this.panStartX = 0;
            this.panStartY = 0;
            this.panOrigX = 0;
            this.panOrigY = 0;
            this.terrainFill = null;     // Map<key, fillStyle> — elevation-shaded, cached per game

            // ---- Input-layer state (see UI_CONTROLS.md) ----
            // A small stack of modal flags decides what any click/key means:
            //   overlay (top) → targeting → selection (bottom).
            this.selection = null;   // L1.2 { workerId, reachable: Map<key,cost>, attackable: Set<key> }
            this.targeting = null;   // L4 modal targeting { what, validHexes: Set<key> } or null
            this.overlay = null;     // L5 input-capturing layer: 'intro' | 'victory' | null
            this.hoveredHex = null;  // L1.3 hex under the cursor, for the HUD readout
            this.lastEvents = [];    // beast-phase reports, shown until the next end of turn
        }

        // ---- Lifecycle ----
        start() {
            this.attach();
            this.newGame();
        }

        newGame() {
            this.engine.newGame();
            this.cacheTerrainFills();
            this.selection = null;
            this.targeting = null;
            this.hoveredHex = null;
            this.lastEvents = [];
            this.centerOn(this.state.workers[0]);
            this.showOverlay('intro');
            this.resize();   // resize() re-renders
        }

        // Elevation-shaded terrain colors, computed once per map: low ground darker,
        // high ground lighter. Gives the big map depth without a sprite pipeline.
        cacheTerrainFills() {
            this.terrainFill = new Map();
            for (const [key, hex] of this.state.hexes) {
                const base = TERRAIN_COLORS[hex.terrain] || '#555';
                const factor = 0.78 + 0.44 * (hex.elevation / 100);
                this.terrainFill.set(key, shadeColor(base, factor));
            }
        }

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.render();
        }

        // ---- Coordinate helpers ----
        hexToScreen(q, r) {
            const p = new Hex(q, r).toPixel();
            return { x: p.x + this.panX, y: p.y + this.panY };
        }

        screenToHex(sx, sy) {
            return Hex.fromPixel(sx - this.panX, sy - this.panY);
        }

        centerOn(hex) {
            const p = new Hex(hex.q, hex.r).toPixel();
            this.panX = this.canvas.width / 2 - p.x;
            this.panY = this.canvas.height / 2 - p.y;
        }

        // ---- L1.2 Selection: ask the engine for the legal sets; dispatch is a lookup ----
        selectedWorker() {
            if (!this.selection) return null;
            return this.engine.workerById(this.selection.workerId);
        }

        selectWorker(worker) {
            this.selection = {
                workerId: worker.id,
                reachable: this.engine.computeReachable(worker),
                attackable: this.engine.computeAttackable(worker)
            };
        }

        // Recompute the highlight sets for the already-selected worker (post-action).
        reselect() {
            const worker = this.selectedWorker();
            if (worker) this.selectWorker(worker);
            else this.selection = null;
        }

        deselect() {
            this.selection = null;
        }

        // Tab: cycle the crew, skipping workers that are out of MP.
        selectNextWorker() {
            const s = this.state;
            const fresh = s.workers.filter(w => w.mp > 0);
            if (fresh.length === 0) return;
            const current = this.selectedWorker();
            const at = current ? fresh.findIndex(w => w.id === current.id) : -1;
            const next = fresh[(at + 1) % fresh.length];
            this.selectWorker(next);
            this.centerOn(next);
            this.render();
        }

        // Move via the engine, then recompute highlights and re-render.
        commitMove(q, r) {
            const res = this.engine.moveWorker(this.selection.workerId, q, r);
            if (res.ok) {
                this.sound.step();
                this.reselect();   // L1.4 same worker stays selected with fresh sets
            }
            this.render();
        }

        // Shoo an adjacent beast (the L3 "attack" of this game).
        commitShoo(q, r) {
            const res = this.engine.shooBeast(this.selection.workerId, q, r);
            if (res.ok) {
                this.sound.shoo();
                this.reselect();
            }
            this.render();
        }

        // ---- Build panel dispatch: option descriptors from the engine, one handler ----
        commitBuild(action, type) {
            const workerId = this.selection.workerId;
            const commit = {
                building: () => this.engine.build(workerId, type),
                road: () => this.engine.buildRoad(workerId),
                monument: () => this.engine.buildMonumentStage(workerId)
            }[action];
            if (!commit) return;
            const res = commit();
            if (!res.ok) { this.render(); return; }
            if (res.won) {
                this.sound.fanfare();
                this.deselect();
                this.showOverlay('victory');
                this.render();
                return;
            }
            this.sound.build();
            this.reselect();
            this.render();
        }

        commitRecruit() {
            const res = this.engine.recruit();
            if (res.ok) this.sound.recruit();
            this.render();
        }

        // ---- L2.1 One context-sensitive primary action (End Turn button + Space/Enter) ----
        primaryAction() {
            if (this.overlay || this.state.phase !== 'player' || this.state.gameWon) return;
            const loc = this.engine.locationAt(this.selectedWorker() ?? this.state.workers[0]);
            if (loc) {
                // openLocation(loc) — wire up when interactive locations exist
            } else {
                const res = this.engine.endTurn();
                this.lastEvents = res.events;
                if (res.events.length > 0) this.sound.smash();
                else this.sound.endTurn();
                this.deselect();
                this.render();
            }
        }

        // ---- L4 Modal targeting (scaffold) ----
        cancelTargeting() {
            this.targeting = null;
        }

        // ---- L5 Overlays: input-capturing layers checked before gameplay ----
        showOverlay(name) {
            this.overlay = name;
            this.syncOverlayDom();
        }

        dismissOverlay() {
            // Clearing the intro is the start of play — and the first user gesture, so
            // it's also where the AudioContext gets to open.
            if (this.overlay === 'intro') this.sound.fanfare();
            this.overlay = null;
            this.syncOverlayDom();
            this.render();
        }

        syncOverlayDom() {
            document.getElementById('intro-panel').classList.toggle('hidden', this.overlay !== 'intro');
        }

        // ---- Rendering ----
        render() {
            const ctx = this.ctx;
            const canvas = this.canvas;
            const s = this.state;

            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Terrain (elevation-shaded fills, cached per game)
            for (const [key, hex] of s.hexes) {
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 ||
                    y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = this.terrainFill.get(key);
                ctx.fill();
                ctx.strokeStyle = '#00000044';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            this.renderRoads();
            this.renderGuardZone();
            this.renderMonument();

            // L1.2 highlight sets: movement tint (yellow) + shoo tint (red)
            if (this.selection) {
                for (const key of this.selection.reachable.keys()) {
                    const { q, r } = Hex.fromKey(key);
                    const { x, y } = this.hexToScreen(q, r);
                    drawHexPath(ctx, x, y, HEX_SIZE);
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                    ctx.fill();
                }
                for (const key of this.selection.attackable) {
                    const { q, r } = Hex.fromKey(key);
                    const { x, y } = this.hexToScreen(q, r);
                    drawHexPath(ctx, x, y, HEX_SIZE);
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.35)';
                    ctx.fill();
                }
            }

            // Buildings: square counters in fixed per-type colors
            for (const b of s.buildings) {
                const { x, y } = this.hexToScreen(b.q, b.r);
                this.drawCounter(x, y, BUILDING_COLORS[b.type], BUILDING_LABELS[b.type]);
            }

            // Beasts: round counters — the wild side of the map's color story
            for (let i = 0; i < s.beasts.length; i++) {
                const { x, y } = this.hexToScreen(s.beasts[i].q, s.beasts[i].r);
                const color = s.beastPalette[i % s.beastPalette.length];
                this.drawRoundCounter(x, y, color, 'B');
            }

            // Workers: numbered square counters; spent crew members fade
            for (let i = 0; i < s.workers.length; i++) {
                const w = s.workers[i];
                const { x, y } = this.hexToScreen(w.q, w.r);
                const color = s.workerPalette[i % s.workerPalette.length];
                if (w.mp <= 0) ctx.globalAlpha = 0.55;
                this.drawCounter(x, y, color, String(i + 1));
                ctx.globalAlpha = 1;
                if (this.selection && this.selection.workerId === w.id) {
                    const sz = COUNTER_SIZE + 4;
                    this.roundRect(x - sz / 2, y - sz / 2, sz, sz, 6);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            // L5 victory overlay (canvas-drawn, input-capturing layer)
            if (this.overlay === 'victory') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 44px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('THE MONUMENT IS COMPLETE!', canvas.width / 2, canvas.height / 2 - 30);
                ctx.font = '20px monospace';
                ctx.fillText('Raised in ' + s.turn + ' turns', canvas.width / 2, canvas.height / 2 + 20);
            }

            this.updateHUD();
        }

        // Roads render as a network: a line from each road hex to every adjacent
        // road/building/Monument hex (3 of 6 directions so each pair draws once),
        // plus a spot so an isolated road stub is still visible.
        renderRoads() {
            const ctx = this.ctx;
            const s = this.state;
            const isNode = (q, r) => {
                const hex = s.hexes.get(Hex.key(q, r));
                if (!hex) return false;
                return hex.road || this.engine.buildingAt(q, r) !== null ||
                    this.engine.isMonumentHex(q, r);
            };

            ctx.strokeStyle = ROAD_COLOR;
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            for (const [, hex] of s.hexes) {
                if (!hex.road) continue;
                const from = this.hexToScreen(hex.q, hex.r);
                if (from.x < -HEX_SIZE * 2 || from.x > this.canvas.width + HEX_SIZE * 2 ||
                    from.y < -HEX_SIZE * 2 || from.y > this.canvas.height + HEX_SIZE * 2) continue;

                ctx.fillStyle = ROAD_COLOR;
                ctx.beginPath();
                ctx.arc(from.x, from.y, 4, 0, Math.PI * 2);
                ctx.fill();

                const neighbors = new Hex(hex.q, hex.r).neighbors();
                for (let d = 0; d < 3; d++) {   // half the directions: draw each pair once
                    const n = neighbors[d];
                    if (!isNode(n.q, n.r)) continue;
                    const to = this.hexToScreen(n.q, n.r);
                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(to.x, to.y);
                    ctx.stroke();
                }
            }
        }

        // Watchtower coverage: white boundary around the union of guarded hexes.
        // Only edges whose neighbor is unguarded draw, so adjacent tower zones merge
        // into one outline around the outside (UI Reveals Mechanics).
        renderGuardZone() {
            const ctx = this.ctx;
            const s = this.state;
            const guarded = new Set();
            for (const key of this.engine.protectedKeys())
                if (s.hexes.has(key)) guarded.add(key);   // clip off-map keys
            if (guarded.size === 0) return;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            for (const key of guarded) {
                const hex = Hex.fromKey(key);
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                if (x < -HEX_SIZE * 2 || x > this.canvas.width + HEX_SIZE * 2 ||
                    y < -HEX_SIZE * 2 || y > this.canvas.height + HEX_SIZE * 2) continue;
                const corners = hexCorners(x, y, HEX_SIZE);
                const neighbors = hex.neighbors();
                for (let d = 0; d < 6; d++) {
                    if (guarded.has(neighbors[d].key())) continue;
                    // Neighbor direction d shares the edge between corners
                    // (6-d)%6 and (7-d)%6 (corners sit at 60°·i − 30°).
                    const a = (6 - d) % 6;
                    const b = (a + 1) % 6;
                    ctx.beginPath();
                    ctx.moveTo(corners[a].x, corners[a].y);
                    ctx.lineTo(corners[b].x, corners[b].y);
                    ctx.stroke();
                }
            }
        }

        // The Monument site: orange outline always; the hex fills in as stages complete.
        renderMonument() {
            const ctx = this.ctx;
            const m = this.state.monument;
            const { x, y } = this.hexToScreen(m.q, m.r);

            if (m.stage > 0) {
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = MONUMENT_COLOR + ['00', '55', 'aa', 'ff'][m.stage];
                ctx.fill();
            }
            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.strokeStyle = MONUMENT_COLOR;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = m.stage === MONUMENT_STAGES.length ? '#fff' : MONUMENT_COLOR;
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('▲', x, y);
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
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            return lum > 0.4 ? '#000' : '#fff';
        }

        drawCounter(cx, cy, color, label) {
            const ctx = this.ctx;
            const labelColor = this.contrastText(color);
            const s = COUNTER_SIZE;
            const x = cx - s / 2, y = cy - s / 2;
            const r = 4;

            // Depth shadow: 2 gray L-shaped lines on bottom-right
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                ctx.moveTo(x + r + i, y + s + 1 + i);
                ctx.arcTo(x + s + 1 + i, y + s + 1 + i, x + s + 1 + i, y + s - r + 1 + i, r);
                ctx.lineTo(x + s + 1 + i, y + r + i);
                ctx.stroke();
            }

            // Body
            this.roundRect(x, y, s, s, r);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Label — pick white or black text for contrast
            ctx.fillStyle = labelColor;
            ctx.font = 'bold ' + Math.floor(s * 0.55) + 'px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx, cy + 1);
        }

        // Round counter — the beasts' shape, so wild pieces read at a glance.
        drawRoundCounter(cx, cy, color, label) {
            const ctx = this.ctx;
            const radius = COUNTER_SIZE / 2;

            // Depth shadow: 2 gray arcs on the bottom-right
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                ctx.arc(cx + 1 + i, cy + 1 + i, radius, -Math.PI * 0.1, Math.PI * 0.6);
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = this.contrastText(color);
            ctx.font = 'bold ' + Math.floor(COUNTER_SIZE * 0.55) + 'px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx, cy + 1);
        }

        updateHUD() {
            const s = this.state;
            const income = this.engine.incomePerTurn();
            document.getElementById('turn-info').textContent = 'Turn ' + s.turn;
            document.getElementById('res-wood').textContent = `Wood ${s.resources.wood} (+${income.wood})`;
            document.getElementById('res-stone').textContent = `Stone ${s.resources.stone} (+${income.stone})`;
            document.getElementById('res-gold').textContent = `Gold ${s.resources.gold} (+${income.gold})`;

            // Monument meter: stages done + the stockpiled fraction of the next stage,
            // so every log and block visibly moves the needle.
            const stage = s.monument.stage;
            let frac = 0;
            if (stage < MONUMENT_STAGES.length) {
                const cost = MONUMENT_STAGES[stage].cost;
                frac = Math.min(1, ...Object.entries(cost).map(([k, v]) => s.resources[k] / v));
            }
            const pct = Math.min(1, (stage + frac) / MONUMENT_STAGES.length);
            document.getElementById('progress-fill').style.width = (pct * 100) + '%';
            document.getElementById('progress-pct').textContent = Math.round(pct * 100) + '%';

            const recruitBtn = document.getElementById('recruit');
            const rCost = this.engine.recruitCost();
            recruitBtn.textContent = `Recruit (${costText(rCost)})`;
            recruitBtn.disabled = !this.engine.canAfford(rCost) || s.gameWon;

            this.updateInfoBar();
            this.updateBuildPanel();

            const msgEl = document.getElementById('hud-msg');
            msgEl.textContent = this.lastEvents.join(' — ');
            msgEl.classList.toggle('hidden', this.lastEvents.length === 0);
        }

        // L1.3 hovered-hex + selected-worker readout — its own bar, so its width
        // never shifts the buttons above.
        updateInfoBar() {
            const s = this.state;
            const parts = [];
            const worker = this.selectedWorker();
            if (worker) {
                const num = s.workers.indexOf(worker) + 1;
                parts.push(`Worker ${num} — MP ${worker.mp}/${WORKER_MP}`);
            }
            const h = this.hoveredHex && s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            if (h) {
                let text = `${TERRAIN_NAMES[h.terrain] ?? '?'}`;
                if (h.road) text += ' + Road';
                const b = this.engine.buildingAt(h.q, h.r);
                if (b) text += ` + ${BUILDINGS[b.type].name}`;
                if (this.engine.isMonumentHex(h.q, h.r)) text += ' + Monument site';
                parts.push(`${text} (${this.hoveredHex.q},${this.hoveredHex.r})`);
            }
            document.getElementById('hover-info').textContent = parts.join('  |  ');
            document.getElementById('hud-hover').classList.toggle('hidden', parts.length === 0);
        }

        // The build panel renders the engine's option descriptors as buttons; the
        // click handler reads back data-action/data-type — a pure lookup, no rules here.
        updateBuildPanel() {
            const panel = document.getElementById('build-panel');
            const worker = this.selectedWorker();
            const options = (worker && !this.state.gameWon) ? this.engine.buildOptions(worker) : [];
            panel.classList.toggle('hidden', options.length === 0);
            panel.innerHTML = options.map(o =>
                `<button data-action="${o.action}" data-type="${o.type ?? ''}"` +
                `${o.enabled ? '' : ' disabled'}>` +
                `${o.name} (${costText(o.cost)}, ${o.mp}MP)` +
                `${o.note ? ' — ' + o.note : ''}</button>`
            ).join('');
        }

        // ---- Input handling (dispatch order mirrors UI_CONTROLS.md) ----
        attach() {
            this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
            this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
            // On window, not the canvas: a drag released off-canvas must still end.
            window.addEventListener('mouseup', e => this.onMouseUp(e));
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
            window.addEventListener('resize', () => this.resize());
            window.addEventListener('keydown', e => this.onKeyDown(e));

            // L2.3 twin activators: HUD button and hotkey route through one shared function.
            document.getElementById('end-turn').addEventListener('click', () => this.primaryAction());
            document.getElementById('new-game').addEventListener('click', () => this.newGame());
            document.getElementById('begin-btn').addEventListener('click', () => this.dismissOverlay());
            document.getElementById('recruit').addEventListener('click', () => this.commitRecruit());
            document.getElementById('build-panel').addEventListener('click', e => {
                const btn = e.target.closest('button[data-action]');
                if (!btn || btn.disabled || !this.selection) return;
                this.commitBuild(btn.dataset.action, btn.dataset.type || null);
            });
        }

        onMouseDown(e) {
            // Right button: narrow cancel — cancel targeting if active (L2.2). No pan.
            if (e.button === 2) {
                if (this.targeting) { this.cancelTargeting(); this.render(); }
                e.preventDefault();
                return;
            }
            if (e.button !== 0) return;

            // Left button: arm a click-or-pan (L1.3). The click action is deferred to
            // mouseup and only fires if the press stayed put; a drag past the threshold
            // pans instead, so left-click keeps its pure select/act role (L1.2).
            this.dragCandidate = true;
            this.panning = false;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.panOrigX = this.panX;
            this.panOrigY = this.panY;
            e.preventDefault();
        }

        // L1.2 the stationary-click action: select, then act — a pure lookup against
        // the cached sets. Reached from mouseup only when the press didn't become a pan.
        handleClick(e) {
            const s = this.state;
            if (this.overlay) { this.dismissOverlay(); return; }  // L5 overlay captures & consumes the click
            if (s.gameWon) return;                                // game over: board is view-only
            if (s.phase !== 'player') return;                     // L1.1 map input is live only on the player's turn

            const hex = this.screenToHex(e.clientX, e.clientY);
            const key = Hex.key(hex.q, hex.r);

            // L4 modal targeting: a valid hex commits the action, anything else cancels.
            if (this.targeting) {
                if (this.targeting.validHexes.has(key)) {
                    // commitTargeting(hex) — wire up when abilities exist
                }
                this.cancelTargeting();
                this.render();
                return;
            }

            const clickedWorker = this.engine.workerAt(hex.q, hex.r);
            const current = this.selectedWorker();
            if (clickedWorker) {
                // Clicking the selected worker deselects; any other worker selects it.
                if (current && clickedWorker.id === current.id) this.deselect();
                else this.selectWorker(clickedWorker);
            } else if (this.selection && this.selection.attackable.has(key)) {
                this.commitShoo(hex.q, hex.r);
                return;   // commitShoo has already re-rendered
            } else if (this.selection && this.selection.reachable.has(key)) {
                this.commitMove(hex.q, hex.r);
                return;   // commitMove has already re-rendered
            } else {
                this.deselect();
            }
            this.render();
        }

        onMouseMove(e) {
            // L1.3 promote a left drag to a pan once it clears the click threshold.
            if (this.dragCandidate && !this.panning) {
                const dx = e.clientX - this.panStartX;
                const dy = e.clientY - this.panStartY;
                if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) this.panning = true;
            }
            if (this.panning) {
                this.panX = this.panOrigX + (e.clientX - this.panStartX);
                this.panY = this.panOrigY + (e.clientY - this.panStartY);
                this.render();
                return;
            }
            // L1.3 track the hovered hex for the HUD readout (decoupled from panning).
            const hex = this.screenToHex(e.clientX, e.clientY);
            const next = this.state.hexes.has(Hex.key(hex.q, hex.r)) ? { q: hex.q, r: hex.r } : null;
            if (next?.q !== this.hoveredHex?.q || next?.r !== this.hoveredHex?.r) {
                this.hoveredHex = next;
                this.updateHUD();
            }
        }

        onMouseUp(e) {
            if (e.button !== 0) return;
            if (!this.dragCandidate) return;    // press didn't start on the board (e.g. a HUD button)
            const wasPan = this.panning;
            this.dragCandidate = false;
            this.panning = false;
            if (!wasPan) this.handleClick(e);   // a press that never became a pan is a click
        }

        onKeyDown(e) {
            // L5 an overlay swallows its dismissing key.
            if (this.overlay && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
                e.preventDefault();
                this.dismissOverlay();
                return;
            }
            // L2.2 Esc: peel back one modal layer, deepest first.
            if (e.key === 'Escape') {
                if (this.targeting) this.cancelTargeting();
                else this.deselect();
                this.render();
                return;
            }
            // Tab: next worker with MP left — the crew is the hand you play.
            if (e.key === 'Tab') {
                e.preventDefault();
                if (!this.overlay && this.state.phase === 'player') this.selectNextWorker();
                return;
            }
            // L2.1 primary action.
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.primaryAction();
            }
        }
    }

    return GameUI;
})();
