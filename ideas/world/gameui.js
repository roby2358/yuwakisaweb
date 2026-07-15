// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering, the DOM HUD, camera/pan, and all
// input wiring. It owns the *view and interaction* state (pan offset, hovered hex,
// current selection, modal targeting, overlays, enemy-phase playback) — none of which is
// game state — and it drives GameEngine by dispatching actions and re-rendering from
// GameState afterward. The engine resolves a whole turn synchronously and returns an
// event list; playEvents replays it here as animation, hop by hop, so the player can
// read what happened.
//
// The input dispatch mirrors UI_CONTROLS.md; layer citations (L1.2, L2.1, …) are kept.
// In a client/server world this is the client: swap engine calls for messages to a
// server and replay the event list the server ships back, and the seam is already here.
const GameUI = (function () {
    const { PLAYER_MP, PLAYER_HP, VILLAGE_HP, TERRAIN } = GameArtifacts;
    const {
        HEX_SIZE, COUNTER_SIZE, TERRAIN_COLORS, TERRAIN_NAMES,
        PLAYER_COLOR, STATUS_TITLES, ANIM_HOP_MS, ANIM_FLASH_MS
    } = GameDisplayArtifacts;

    class GameUI {
        constructor(engine, canvas) {
            this.engine = engine;
            this.state = engine.state;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');

            // ---- View state (render-only; never part of GameState) ----
            this.panX = 0;
            this.panY = 0;
            this.panning = false;
            this.panStartX = 0;
            this.panStartY = 0;
            this.panOrigX = 0;
            this.panOrigY = 0;

            // ---- Input-layer state (see UI_CONTROLS.md) ----
            // A small stack of modal flags decides what any click/key means:
            //   overlay (top) → targeting → selection (bottom).
            this.selection = null;   // L1.2 { reachable: Map<key,cost>, attackable: Set<key> }
            this.targeting = null;   // L4 modal targeting { what, validHexes: Set<key> } or null
            this.overlay = null;     // L5 input-capturing layer: 'intro' | null
            this.hoveredHex = null;  // L1.3 hex under the cursor, for the HUD readout

            // ---- Enemy-phase playback (view state; the game state is already final) ----
            this.anim = null;        // { events, index, raiders, flash, playerFlash }
            this.animTimer = null;
            this.message = '';       // one-line event ticker in the HUD
        }

        // ---- Lifecycle ----
        start() {
            this.attach();
            this.newGame();
        }

        newGame() {
            this.stopAnim();
            this.engine.newGame();
            this.selection = null;
            this.targeting = null;
            this.hoveredHex = null;
            this.message = 'The world is quiet, for now.';
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
        commitMove(q, r) {
            const res = this.engine.movePlayer(q, r);
            if (!res.ok) { this.render(); return; }
            if (res.endedTurn) { this.deselect(); this.playEvents(res.events); return; }
            // L1.4 turn continues: recompute the highlight sets from the new position.
            this.selectPlayer();
            this.render();
        }

        // L3 attack via the engine; highlights recompute (a wall just died).
        commitAttack(q, r) {
            const res = this.engine.attack(q, r);
            if (!res.ok) { this.deselect(); this.render(); return; }
            this.message = 'A raider falls. +' + res.gained + ' prestige.';
            if (res.endedTurn) { this.deselect(); this.playEvents(res.events); return; }
            this.selectPlayer();
            this.render();
        }

        // ---- L2.1 One context-sensitive primary action (End Turn button + Space/Enter) ----
        primaryAction() {
            if (this.overlay || this.anim || this.state.phase !== 'player') return;
            const loc = this.engine.locationAt(this.state.player);
            if (loc) {
                // openLocation(loc) — wire up when interactive locations exist
            } else {
                const events = this.engine.endTurn();
                this.deselect();
                this.playEvents(events);
            }
        }

        // ---- Enemy-phase playback ----
        // The engine has already resolved everything; `events` is the story of it.
        // Raiders are drawn from a playback list seeded at their start-of-phase
        // positions and advanced event by event, so hops, strikes, and escapes are
        // readable. Any input fast-forwards to the final state.
        playEvents(events) {
            this.stopAnim();
            const start = events.find(e => e.type === 'phaseStart');
            this.anim = {
                events,
                index: 0,
                raiders: start.enemies.map(e => ({ ...e })),
                flash: null,        // { q, r, color } one-beat hex flash
                playerFlash: false
            };
            this.stepAnim();
        }

        stepAnim() {
            const anim = this.anim;
            if (!anim) return;
            if (anim.index >= anim.events.length) { this.stopAnim(); this.render(); return; }

            const delay = this.applyAnimEvent(anim.events[anim.index++]);
            if (delay === 0) { this.stepAnim(); return; }

            this.render();
            this.animTimer = setTimeout(() => {
                if (!this.anim) return;
                this.anim.flash = null;
                this.anim.playerFlash = false;
                this.stepAnim();
            }, delay);
        }

        // Advance the playback state for one event; return how long to show it (0 = instant).
        applyAnimEvent(ev) {
            const anim = this.anim;
            switch (ev.type) {
                case 'hop': {
                    const r = anim.raiders.find(x => x.id === ev.id);
                    if (r) { r.q = ev.to.q; r.r = ev.to.r; }
                    return ANIM_HOP_MS;
                }
                case 'burn':
                    anim.flash = { q: ev.q, r: ev.r, color: 'rgba(255, 120, 0, 0.7)' };
                    this.message = ev.village
                        ? 'Raiders burn the fields of ' + ev.village + '!'
                        : 'Raiders burn the fields!';
                    return ANIM_FLASH_MS;
                case 'sated': {
                    const r = anim.raiders.find(x => x.id === ev.id);
                    if (r) r.sated = true;
                    return 0;
                }
                case 'escaped':
                    anim.raiders = anim.raiders.filter(x => x.id !== ev.id);
                    this.message = 'A raider escapes with its plunder.';
                    return ANIM_HOP_MS;
                case 'strike':
                    anim.flash = { q: ev.q, r: ev.r, color: 'rgba(255, 0, 0, 0.7)' };
                    this.message = 'Raiders strike ' + ev.name + '! (' + ev.hp + '/' + VILLAGE_HP + ')';
                    return ANIM_FLASH_MS;
                case 'fell':
                    anim.flash = { q: ev.q, r: ev.r, color: 'rgba(255, 0, 0, 0.9)' };
                    this.message = ev.name + ' has fallen.';
                    return ANIM_FLASH_MS * 2;
                case 'founded':
                    this.message = 'A new village is founded: ' + ev.name + '.';
                    return ANIM_FLASH_MS;
                case 'playerHit':
                    anim.playerFlash = true;
                    this.message = 'You are struck! (' + ev.hp + '/' + PLAYER_HP + ' HP)';
                    return ANIM_FLASH_MS;
                case 'knockout':
                    this.message = ev.name
                        ? 'Knocked out — carried to ' + ev.name + '. Your renown suffers.'
                        : 'Beaten down where you stood. Your renown suffers.';
                    this.centerOn({ q: ev.q, r: ev.r });
                    return ANIM_FLASH_MS * 2;
                case 'spawn':
                    anim.raiders.push({ id: ev.id, q: ev.q, r: ev.r, color: ev.color, sated: false });
                    this.message = 'A raider emerges from the wilds.';
                    return ANIM_FLASH_MS;
                case 'status':
                    this.message = ev.promoted
                        ? 'Promoted! You are now a ' + STATUS_TITLES[ev.to] + '.'
                        : 'Your renown fades. Demoted to ' + STATUS_TITLES[ev.to] + '.';
                    return ANIM_FLASH_MS * 2;
                default:
                    return 0;   // phaseStart, hesitate, growth — the map itself shows these
            }
        }

        stopAnim() {
            if (this.animTimer) clearTimeout(this.animTimer);
            this.animTimer = null;
            this.anim = null;
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
                if (hex.terrain === TERRAIN.VILLAGE) this.drawVillage(x, y, hex);
            }

            // L1.2 highlight sets: movement tint (yellow) + attack tint (red)
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

            // Event flash (burns, strikes) during enemy-phase playback
            if (this.anim && this.anim.flash) {
                const f = this.anim.flash;
                const { x, y } = this.hexToScreen(f.q, f.r);
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = f.color;
                ctx.fill();
            }

            // Raiders — from the playback list while animating, else from game state
            const raiders = this.anim ? this.anim.raiders : s.enemies;
            for (const raider of raiders) {
                const { x, y } = this.hexToScreen(raider.q, raider.r);
                this.drawCounter(x, y, raider.color || '#cc3333', 'R');
                if (raider.sated) this.drawSatedPip(x, y);
            }

            // Player
            if (s.player) {
                const { x, y } = this.hexToScreen(s.player.q, s.player.r);
                this.drawCounter(x, y, PLAYER_COLOR, 'P');
                if (this.anim && this.anim.playerFlash) {
                    const sz = COUNTER_SIZE + 6;
                    this.roundRect(x - sz / 2, y - sz / 2, sz, sz, 6);
                    ctx.strokeStyle = '#ff2222';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
                if (this.selection) {
                    const sz = COUNTER_SIZE + 4;
                    this.roundRect(x - sz / 2, y - sz / 2, sz, sz, 6);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            this.updateHUD();
        }

        // House glyph, plus HP pips when the village has taken structural hits.
        drawVillage(x, y, hex) {
            const ctx = this.ctx;
            ctx.fillStyle = '#3a1c08';
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⌂', x, y);

            const village = this.engine.villageAt(hex.q, hex.r);
            if (!village || village.hp >= VILLAGE_HP) return;
            for (let i = 0; i < VILLAGE_HP; i++) {
                ctx.beginPath();
                ctx.arc(x - 8 + i * 8, y + HEX_SIZE * 0.55, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = i < village.hp ? '#ff4444' : '#00000055';
                ctx.fill();
            }
        }

        // Gold pip on a raider counter: it is carrying plunder (worth extra prestige).
        drawSatedPip(cx, cy) {
            const ctx = this.ctx;
            ctx.beginPath();
            ctx.arc(cx + COUNTER_SIZE / 2 - 3, cy - COUNTER_SIZE / 2 + 3, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd700';
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
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
            const maxMp = PLAYER_MP + this.engine.privileges().mpBonus;
            document.getElementById('turn-info').textContent = 'Turn ' + s.turn;
            document.getElementById('mp-info').textContent = 'MP: ' + s.mp + '/' + maxMp;
            document.getElementById('hp-info').textContent = 'HP: ' + s.player.hp + '/' + PLAYER_HP;
            document.getElementById('prestige-info').textContent = 'Prestige: ' + s.prestige;
            document.getElementById('status-info').textContent = STATUS_TITLES[s.status];
            document.getElementById('message-info').textContent = this.message;

            // L1.3 hovered-hex readout
            const hoverEl = document.getElementById('hover-info');
            if (!hoverEl) return;
            hoverEl.textContent = this.hoverText();
        }

        hoverText() {
            const s = this.state;
            if (!this.hoveredHex) return '';
            const h = s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            if (!h) return '';
            if (h.terrain === TERRAIN.VILLAGE) {
                const v = this.engine.villageAt(h.q, h.r);
                if (v) return v.name + ' — ' + v.farms.length + ' farms, ' + v.hp + '/' + VILLAGE_HP + ' HP';
            }
            if (h.terrain === TERRAIN.FARM) {
                const owner = this.engine.farmOwner(Hex.key(h.q, h.r));
                if (owner) return 'Farmland of ' + owner.name;
            }
            return (TERRAIN_NAMES[h.terrain] ?? '?') + ' (' + h.q + ',' + h.r + ')';
        }

        // ---- Input handling (dispatch order mirrors UI_CONTROLS.md) ----
        attach() {
            this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
            this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
            this.canvas.addEventListener('mouseup', e => this.onMouseUp(e));
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
            window.addEventListener('resize', () => this.resize());
            window.addEventListener('keydown', e => this.onKeyDown(e));

            // L2.3 twin activators: HUD button and hotkey route through one shared function.
            document.getElementById('end-turn').addEventListener('click', () => this.primaryAction());
            document.getElementById('new-game').addEventListener('click', () => this.newGame());
            document.getElementById('begin-btn').addEventListener('click', () => this.dismissOverlay());
        }

        onMouseDown(e) {
            const s = this.state;
            // Right button: cancel targeting if active (L2.2), else begin a camera pan (L1.3).
            if (e.button === 2) {
                if (this.targeting) { this.cancelTargeting(); this.render(); return; }
                this.panning = true;
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
                this.panOrigX = this.panX;
                this.panOrigY = this.panY;
                e.preventDefault();
                return;
            }
            if (e.button !== 0) return;

            if (this.overlay) { this.dismissOverlay(); return; }  // L5 overlay captures & consumes the click
            if (this.anim) { this.stopAnim(); this.render(); return; }  // click fast-forwards playback
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

            // L1.2 select, then act — the handler is a pure lookup against the cached sets.
            if (!this.selection) {
                if (hex.q === s.player.q && hex.r === s.player.r) this.selectPlayer();
            } else if (hex.q === s.player.q && hex.r === s.player.r) {
                this.deselect();
            } else if (this.selection.attackable.has(key)) {
                this.commitAttack(hex.q, hex.r);
                return;   // commitAttack has already re-rendered
            } else if (this.selection.reachable.has(key)) {
                this.commitMove(hex.q, hex.r);
                return;   // commitMove has already re-rendered
            } else {
                this.deselect();
            }
            this.render();
        }

        onMouseMove(e) {
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
            if (e.button === 2) this.panning = false;
        }

        onKeyDown(e) {
            // L5 an overlay swallows its dismissing key.
            if (this.overlay && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
                e.preventDefault();
                this.dismissOverlay();
                return;
            }
            // Any key fast-forwards enemy-phase playback.
            if (this.anim && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
                e.preventDefault();
                this.stopAnim();
                this.render();
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
