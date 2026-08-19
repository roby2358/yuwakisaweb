// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering, the DOM HUD, camera/pan, and all
// input wiring. It owns the *view and interaction* state (pan offset, hovered hex,
// current selection and overlays) — none of which is game state — and it
// drives GameEngine by dispatching actions and re-rendering from GameState afterward.
//
// The input dispatch mirrors UI_CONTROLS.md; layer citations (L1.2, L2.1, …) are kept.
// In a client/server world this is the client: swap engine calls for messages to a
// server and re-render from the state it ships back, and the seam is already here.
const GameUI = (function () {
    const {
        HEX_SIZE, COUNTER_SIZE, TERRAIN_COLORS, TERRAIN_NAMES,
        PLAYER_COLOR, HOME_COLOR, GEM_CUTS
    } = GameDisplayArtifacts;

    // A left press that stays within this many pixels is a click (select/move);
    // moving past it turns the gesture into a camera pan.
    const DRAG_THRESHOLD = 4;
    const { GEMS, GEM_EFFECTS, GEM_FREQUENCY, SUNSTONES_REQUIRED } = GameArtifacts;

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

            // ---- Input-layer state (see UI_CONTROLS.md) ----
            this.selection = null;   // L1.2 { reachable: Map<key,cost> }
            this.overlay = null;     // L5 input-capturing layer: 'intro' | 'victory' | null
            this.hoveredHex = null;  // L1.3 hex under the cursor, for the HUD readout
            this.buildFrequencyTable();
        }

        // ---- Lifecycle ----
        start() {
            this.attach();
            this.newGame();
        }

        newGame() {
            this.engine.newGame();
            this.selection = null;
            this.hoveredHex = null;
            this.resizeCanvas();
            this.centerOn(this.state.player);
            this.showOverlay('intro');
            this.render();
        }

        resize() {
            this.resizeCanvas();
            this.render();
        }

        resizeCanvas() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
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
        selectPlayer() {
            this.selection = {
                reachable: this.engine.computeReachable()
            };
        }

        deselect() {
            this.selection = null;
        }

        // Move via the engine, then interpret the outcome and re-render.
        commitMove(q, r) {
            const res = this.engine.movePlayer(q, r);
            if (!res.ok) { this.render(); return; }
            // Each terminal outcome owns its cue; only a plain move gets the step boop,
            // so ending the day mid-move stays "bleep bloop" and not a three-note stumble.
            if (res.won) { this.sound.fanfare(); this.deselect(); this.showOverlay('victory'); this.render(); return; }
            if (res.lost || this.state.status === 'lost') { this.deselect(); this.showOverlay('defeat'); this.render(); return; }
            if (res.endedTurn) { this.sound.endTurn(); this.deselect(); this.render(); return; }
            this.sound.step();
            // L1.4 turn continues: recompute the highlight sets from the new position.
            this.selectPlayer();
            this.render();
        }

        // ---- L2.1 One context-sensitive primary action (End Turn button + Space/Enter) ----
        primaryAction() {
            if (this.overlay || this.state.phase !== 'player') return;
            this.engine.endTurn();
            this.sound.endTurn();
            this.deselect();
            if (this.state.status === 'lost') this.showOverlay('defeat');
            this.render();
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

            // Terrain
            for (const [, hex] of s.hexes) {
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 ||
                    y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
                ctx.fill();
                ctx.strokeStyle = '#00000044';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Home marker
            if (s.home && s.status !== 'won') {
                const { x, y } = this.hexToScreen(s.home.q, s.home.r);
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.strokeStyle = HOME_COLOR;
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.fillStyle = HOME_COLOR;
                ctx.font = 'bold 16px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⌂', x, y);
            }

            // Each palette has a stable jewelry-cut profile.
            for (const gem of s.gems) {
                const { x, y } = this.hexToScreen(gem.q, gem.r);
                this.drawGem(x, y, gem.type);
            }

            // L1.2 movement highlights.
            if (this.selection) {
                for (const key of this.selection.reachable.keys()) {
                    const { q, r } = Hex.fromKey(key);
                    const { x, y } = this.hexToScreen(q, r);
                    drawHexPath(ctx, x, y, HEX_SIZE);
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                    ctx.fill();
                }
            }

            // Monsters — each piece draws with its own seeded color and label.
            for (const monster of s.monsters) {
                const { x, y } = this.hexToScreen(monster.q, monster.r);
                this.drawCounter(x, y, monster.color, monster.label);
            }

            // Player — drawn with the display constant, so its piece color stays null.
            if (s.player) {
                const { x, y } = this.hexToScreen(s.player.q, s.player.r);
                this.drawCounter(x, y, PLAYER_COLOR, s.player.label);
                if (this.selection) {
                    const sz = COUNTER_SIZE + 4;
                    this.roundRect(x - sz / 2, y - sz / 2, sz, sz, 6);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            // L5 victory overlay (canvas-drawn, input-capturing layer)
            if (this.overlay === 'victory' || this.overlay === 'defeat') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 48px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.overlay === 'victory' ? 'VICTORY!' : 'CAUGHT!', canvas.width / 2, canvas.height / 2 - 30);
                ctx.font = '20px monospace';
                ctx.fillText(this.overlay === 'victory' ? 'Returned home in ' + s.turn + ' turns' : 'A monster reached you', canvas.width / 2, canvas.height / 2 + 20);
            }

            this.updateHUD();
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

        drawGem(cx, cy, type) {
            const ctx = this.ctx;
            const points = GEM_CUTS[type];
            const scale = type === 'sunstone' ? 9 : 8;
            ctx.beginPath();
            points.forEach(([px, py], i) => {
                const x = cx + px * scale, y = cy + py * scale;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fillStyle = GEMS[type].color;
            ctx.fill();
            ctx.strokeStyle = '#fff9';
            ctx.lineWidth = type === 'sunstone' ? 2 : 1;
            ctx.stroke();
            ctx.beginPath();
            points.forEach(([px, py]) => { ctx.moveTo(cx, cy); ctx.lineTo(cx + px * scale, cy + py * scale); });
            ctx.strokeStyle = '#fff4';
            ctx.lineWidth = 0.75;
            ctx.stroke();
        }

        updateHUD() {
            const s = this.state;
            document.getElementById('turn-info').textContent = 'Turn ' + s.turn + ' · ' + s.mp + ' MP';

            const pct = Math.min(1, s.sunstones / SUNSTONES_REQUIRED);
            document.getElementById('progress-fill').style.width = (pct * 100) + '%';
            document.getElementById('progress-pct').textContent = s.sunstones + '/' + SUNSTONES_REQUIRED;
            const active = s.activeEffect;
            const effect = active && GEM_EFFECTS[s.effectByGem[active.gemType]];
            document.getElementById('effect-bar').textContent = effect
                ? GEMS[active.gemType].name + ' ' + effect.name + ': ' + effect.text + ' · ' + active.turnsLeft + ' turns left'
                : 'No active gem effect';
            this.updateInventory();

            // L1.3 hovered-hex readout — its own bar, so its width never shifts the buttons.
            const hoverEl = document.getElementById('hover-info');
            if (!hoverEl) return;
            const h = this.hoveredHex && s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            hoverEl.textContent = h ? `${TERRAIN_NAMES[h.terrain] ?? '?'} (${this.hoveredHex.q},${this.hoveredHex.r})` : '';
            document.getElementById('hud-hover').classList.toggle('hidden', !h);
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
            document.getElementById('inventory').addEventListener('click', e => {
                const button = e.target.closest('[data-gem]');
                if (!button || !this.engine.activateGem(button.dataset.gem)) return;
                this.selectPlayer();
                this.render();
            });
        }

        updateInventory() {
            const root = document.getElementById('inventory');
            root.innerHTML = Object.keys(this.state.inventory).map(type => {
                const gem = GEMS[type];
                const effect = GEM_EFFECTS[this.state.effectByGem[type]];
                const count = this.state.inventory[type];
                const cut = GEM_CUTS[type].map(([x, y]) => `${(x + 1) * 50}% ${(y + 1) * 50}%`).join(',');
                return `<button class="gem-button" data-gem="${type}" ${count ? '' : 'disabled'}><span class="gem-swatch" style="background:${gem.color};clip-path:polygon(${cut})"></span><span>${gem.name}</span><span class="gem-count">${count}</span><span>${effect.name}: ${effect.text} (${effect.turns}t)</span></button>`;
            }).join('');
        }

        buildFrequencyTable() {
            const names = Object.keys(GEMS);
            const rows = Object.entries(GEM_FREQUENCY).map(([terrain, weights]) => `<tr><th>${TERRAIN_NAMES[terrain]}</th>${names.map(type => `<td>${weights[type]}</td>`).join('')}</tr>`).join('');
            document.getElementById('frequency-table').innerHTML = `<table><thead><tr><th>Terrain</th>${names.map(type => `<th title="${GEMS[type].name}">${GEMS[type].name[0]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><p class="panel-note">Numbers are relative spawn weights.</p>`;
        }

        onMouseDown(e) {
            // Right button has no map action; suppress the browser context menu.
            if (e.button === 2) {
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
            if (s.status !== 'playing') return;                   // game over: board is view-only
            if (s.phase !== 'player') return;                     // L1.1 map input is live only on the player's turn

            const hex = this.screenToHex(e.clientX, e.clientY);
            const key = Hex.key(hex.q, hex.r);

            if (!this.selection) {
                if (s.player.isAt(hex.q, hex.r)) this.selectPlayer();
            } else if (s.player.isAt(hex.q, hex.r)) {
                this.deselect();
            } else if (this.selection.reachable.has(key)) {
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
            // Esc clears the current player selection.
            if (e.key === 'Escape') {
                this.deselect();
                this.render();
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
