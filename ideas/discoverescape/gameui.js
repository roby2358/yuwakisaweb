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
        FOG_COLOR, GLIMPSE_ALPHA, NIGHT_TINT, PLAYER_COLOR, BOAT_COLOR,
        RELIC_COLOR, CAIRN_COLOR, HUNTER_COLORS
    } = GameDisplayArtifacts;
    const { RELIC, NIGHT_TURN } = GameArtifacts;

    // A left press that stays within this many pixels is a click (select/move);
    // moving past it turns the gesture into a camera pan.
    const DRAG_THRESHOLD = 4;

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
            // A small stack of modal flags decides what any click/key means:
            //   overlay (top) → targeting → selection (bottom).
            this.selection = null;   // L1.2 { reachable: Map<key,cost>, attackable: Set<key> }
            this.targeting = null;   // L4 modal targeting { what, validHexes: Set<key> } or null
            this.overlay = null;     // L5 input-capturing layer: 'intro' | 'victory' | 'defeat' | null
            this.hoveredHex = null;  // L1.3 hex under the cursor, for the HUD readout
        }

        // ---- Lifecycle ----
        start() {
            this.attach();
            this.newGame();
        }

        newGame() {
            this.engine.newGame();
            this.selection = null;
            this.targeting = null;
            this.hoveredHex = null;
            this.centerOn(this.state.player);
            this.showOverlay('intro');
            this.resize();   // resize() re-renders
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
        selectPlayer() {
            this.selection = {
                reachable: this.engine.computeReachable(),
                attackable: this.engine.computeAttackable()
            };
        }

        deselect() {
            this.selection = null;
        }

        // Move via the engine, then interpret the outcome and re-render.
        // Terminal outcomes (won / caught) own their cue; a relic pickup chimes even
        // when the same move also ended the turn.
        commitMove(q, r) {
            const res = this.engine.movePlayer(q, r);
            if (!res.ok) { this.render(); return; }
            if (res.won) { this.sound.fanfare(); this.deselect(); this.showOverlay('victory'); this.render(); return; }
            if (res.caught) { this.sound.defeat(); this.deselect(); this.showOverlay('defeat'); this.render(); return; }
            if (res.relic) this.sound.pickup();
            else this.sound.step();
            if (res.endedTurn) { this.deselect(); this.render(); return; }
            // L1.4 turn continues: recompute the highlight sets from the new position.
            this.selectPlayer();
            this.render();
        }

        // ---- L2.1 One context-sensitive primary action (End Turn button + Space/Enter) ----
        primaryAction() {
            if (this.overlay || this.state.phase !== 'player') return;
            if (this.state.gameWon || this.state.gameLost) return;
            const loc = this.engine.locationAt(this.state.player);
            if (loc) {
                // openLocation(loc) — wire up when interactive locations exist
            } else {
                const end = this.engine.endTurn();
                this.deselect();
                if (end.caught) { this.sound.defeat(); this.showOverlay('defeat'); }
                else this.sound.endTurn();
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

            // Terrain in three tiers: explored (full color — the map the engine lets
            // you move on), glimpsed (terrain faded over the fog — the shape of the
            // land, not its details), and fog (featureless).
            for (const [, hex] of s.hexes) {
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 ||
                    y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;
                drawHexPath(ctx, x, y, HEX_SIZE);
                if (hex.explored) {
                    ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
                    ctx.fill();
                    if (s.night) { ctx.fillStyle = NIGHT_TINT; ctx.fill(); }
                } else if (hex.glimpsed) {
                    ctx.fillStyle = FOG_COLOR;
                    ctx.fill();
                    ctx.globalAlpha = GLIMPSE_ALPHA;
                    ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
                    ctx.fill();
                    ctx.globalAlpha = 1;
                } else {
                    ctx.fillStyle = FOG_COLOR;
                    ctx.fill();
                }
                ctx.strokeStyle = '#00000044';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // The boat — the landing site and escape point. Always drawn: you know
            // where you came ashore.
            {
                const { x, y } = this.hexToScreen(s.boat.q, s.boat.r);
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.strokeStyle = BOAT_COLOR;
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.fillStyle = BOAT_COLOR;
                ctx.font = 'bold 16px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⛵', x, y);
            }

            // Standing stones (cairns) — visible once their hex is explored; dim when lit.
            for (const c of s.cairns) {
                const hex = s.hexes.get(Hex.key(c.q, c.r));
                if (!hex.explored) continue;
                const { x, y } = this.hexToScreen(c.q, c.r);
                ctx.fillStyle = c.used ? '#6a6a72' : CAIRN_COLOR;
                ctx.font = 'bold 15px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('▲', x, y);
            }

            // Relic tombs — the discovery payoff: a glint in a hex you just revealed.
            for (const t of s.relics) {
                if (t.taken) continue;
                const hex = s.hexes.get(Hex.key(t.q, t.r));
                if (!hex.explored) continue;
                const { x, y } = this.hexToScreen(t.q, t.r);
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.strokeStyle = RELIC_COLOR;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = RELIC_COLOR;
                ctx.font = 'bold 18px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('✦', x, y);
            }

            // L1.2 highlight sets: movement tint (yellow) + attack tint (red, empty until combat)
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

            // Player first, hunters after — so when the game ends the killer is
            // standing on you, plainly visible.
            if (s.player) {
                const { x, y } = this.hexToScreen(s.player.q, s.player.r);
                this.drawCounter(x, y, PLAYER_COLOR, 'P');
                if (this.selection) {
                    const sz = COUNTER_SIZE + 4;
                    this.roundRect(x - sz / 2, y - sz / 2, sz, sz, 6);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            // Hunters — shaded by speed: the bright ones are the fast ones.
            for (const h of s.hunters) {
                const { x, y } = this.hexToScreen(h.q, h.r);
                this.drawCounter(x, y, HUNTER_COLORS[h.speed] || '#cc3333', 'H');
            }

            // L5 end-of-game overlays (canvas-drawn, input-capturing layers)
            if (this.overlay === 'victory') {
                this.drawEndOverlay('ESCAPED!',
                    'Away with ' + s.carried + ' of ' + RELIC.COUNT + ' relics in ' + s.turn + ' turns');
            }
            if (this.overlay === 'defeat') {
                this.drawEndOverlay('CAUGHT!',
                    'The isle keeps its dead — turn ' + s.turn + ', ' + s.carried + ' relics for nothing');
            }

            this.updateHUD();
        }

        drawEndOverlay(title, detail) {
            const ctx = this.ctx;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 48px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(title, this.canvas.width / 2, this.canvas.height / 2 - 30);
            ctx.font = '20px monospace';
            ctx.fillText(detail, this.canvas.width / 2, this.canvas.height / 2 + 20);
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

        updateHUD() {
            const s = this.state;
            const nightLabel = s.night ? ' · NIGHT' : ' · night at ' + NIGHT_TURN;
            document.getElementById('turn-info').textContent = 'Turn ' + s.turn + nightLabel;

            // Relic meter: how much of the isle's plunder you're carrying.
            const pct = s.carried / RELIC.COUNT;
            document.getElementById('progress-fill').style.width = (pct * 100) + '%';
            document.getElementById('progress-pct').textContent = s.carried + '/' + RELIC.COUNT;

            document.getElementById('hunter-info').textContent = 'Hunters ' + s.hunters.length;

            // L1.3 hovered-hex readout — its own bar, so its width never shifts the buttons.
            // The fog keeps its secrets: unexplored hexes don't name their terrain.
            const hoverEl = document.getElementById('hover-info');
            if (!hoverEl) return;
            const h = this.hoveredHex && s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            const name = !h ? ''
                : h.explored ? (TERRAIN_NAMES[h.terrain] ?? '?')
                : h.glimpsed ? (TERRAIN_NAMES[h.terrain] ?? '?') + ' (distant)'
                : 'Unexplored';
            hoverEl.textContent = h ? `${name} (${this.hoveredHex.q},${this.hoveredHex.r})` : '';
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
            if (s.gameWon || s.gameLost) return;                  // game over: board is view-only
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

            if (!this.selection) {
                if (hex.q === s.player.q && hex.r === s.player.r) this.selectPlayer();
            } else if (hex.q === s.player.q && hex.r === s.player.r) {
                this.deselect();
            } else if (this.selection.attackable.has(key)) {
                // attack(hex) — no combat yet
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
            // L2.2 Esc: peel back one modal layer, deepest first.
            if (e.key === 'Escape') {
                if (this.targeting) this.cancelTargeting();
                else this.deselect();
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
