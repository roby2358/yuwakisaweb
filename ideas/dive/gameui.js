// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering, the DOM HUD, camera/pan, and all
// input wiring. It owns the *view and interaction* state (pan offset, hovered hex,
// current selection, overlays) — none of which is game state — and it drives GameEngine
// by dispatching actions and re-rendering from GameState afterward.
//
// The input dispatch mirrors UI_CONTROLS.md; layer citations (L1.2, L2.1, …) are kept.
// In a client/server world this is the client: swap engine calls for messages to a
// server and re-render from the state it ships back, and the seam is already here.
const GameUI = (function () {
    const {
        TERRAIN, MATERIAL, SELL_PRICES, UPGRADES, UPGRADE_KEYS, BEACON,
        O2_DRAIN, SUB_MP, RESCUE_FEE
    } = GameArtifacts;
    const {
        HEX_SIZE, COUNTER_SIZE, TERRAIN_COLORS, TERRAIN_NAMES,
        MATERIAL_COLORS, MATERIAL_NAMES,
        SUB_COLOR, DIVER_COLOR, LEVIATHAN_COLOR, CACHE_COLOR, MURK_COLOR
    } = GameDisplayArtifacts;

    // Event type -> HUD toast. Kept as data so the predator phase stays one code path.
    const EVENT_TEXT = {
        blackout: () => `Blackout. The drone hauls you in — your bag lies where you fell (−${RESCUE_FEE}cr).`,
        maul: () => `Mauled! You kick free to the sub — your bag sinks where it happened (−${RESCUE_FEE}cr).`,
        bite: e => `${e.name} slams the hull! Hull ${e.hull}.`,
        wreck: e => `The sub goes down under ${e.name}! The tender drags you home — your hold lies in the wreck.`,
        wake: e => `Something vast stirs in the trench. ${e.name} is awake.`
    };

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
            this.panStartX = 0;
            this.panStartY = 0;
            this.panOrigX = 0;
            this.panOrigY = 0;

            // ---- Input-layer state (see UI_CONTROLS.md) ----
            // A small stack of modal flags decides what any click/key means:
            //   overlay (top) → targeting → selection (bottom).
            this.selection = null;   // L1.2 { reachable: Map<key,cost>, attackable: Set<key> }
            this.targeting = null;   // L4 modal targeting — no aimed abilities in this game
            this.overlay = null;     // L5 input-capturing layer: 'intro' | 'market' | 'victory' | null
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
            this.setMessage(null);
            this.centerOn(this.state.base);
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

        // ---- Predator-phase events -> toasts + one sound ----
        setMessage(text) {
            const el = document.getElementById('msg-info');
            el.textContent = text || '';
            el.classList.toggle('hidden', !text);
        }

        processEvents(events) {
            if (!events || events.length === 0) { this.setMessage(null); return; }
            this.setMessage(events.map(e => EVENT_TEXT[e.type](e)).join(' '));
            if (events.some(e => e.type === 'bite' || e.type === 'wreck')) this.sound.bite();
            else this.sound.danger();
        }

        // Move via the engine, then interpret the outcome and re-render.
        commitMove(q, r) {
            const res = this.engine.movePlayer(q, r);
            if (!res.ok) { this.render(); return; }
            if (res.endedTurn) {
                this.deselect();
                this.processEvents(res.events);
                if (res.events.length === 0) this.sound.endTurn();
                this.render();
                return;
            }
            this.sound.step();
            // L1.4 turn continues: recompute the highlight sets from the new position.
            this.selectPlayer();
            this.render();
        }

        // ---- Context actions (the verbs of the dive loop) ----
        // Ordered by specificity; the first available one is the L2.1 primary action.
        availableActions() {
            const e = this.engine;
            const actions = [];
            if (e.isDocked()) actions.push({ id: 'market', label: 'Market', run: () => this.openMarket() });
            if (e.canBoard()) actions.push({ id: 'board', label: 'Board', run: () => this.doBoard() });
            if (e.canScoop()) actions.push({ id: 'scoop', label: 'Scoop Cache', run: () => this.doScoop() });
            if (e.canGather()) actions.push({ id: 'gather', label: 'Gather', run: () => this.doGather() });
            if (e.canDive()) actions.push({ id: 'dive', label: 'Dive', run: () => this.doDive() });
            return actions;
        }

        doDive() {
            if (!this.engine.dive().ok) return;
            this.sound.step();
            this.deselect();
            this.render();
        }

        doBoard() {
            if (!this.engine.board().ok) return;
            this.sound.step();
            this.deselect();
            this.render();
        }

        doGather() {
            const res = this.engine.gather();
            if (!res.ok) return;
            this.sound.gather();
            if (res.endedTurn) {
                this.deselect();
                this.processEvents(res.events);
            } else if (this.selection) {
                this.selectPlayer();   // MP changed; refresh the highlights
            }
            this.render();
        }

        doScoop() {
            if (!this.engine.scoop().ok) return;
            this.sound.coin();
            this.render();
        }

        doEndTurn() {
            const events = this.engine.endTurn();
            this.deselect();
            this.processEvents(events);
            if (events.length === 0) this.sound.endTurn();
            this.render();
        }

        // ---- L2.1 One context-sensitive primary action (Space/Enter) ----
        // Dive is deliberately never the primary: aboard-and-in-transit, Space must
        // stay End Turn (diving is a button-only commitment, not a default).
        primaryOf(actions) {
            return actions.find(a => a.id !== 'dive') || null;
        }

        primaryAction() {
            if (this.overlay || this.state.phase !== 'player' || this.state.gameWon) return;
            const primary = this.primaryOf(this.availableActions());
            if (primary) primary.run();
            else this.doEndTurn();
        }

        // ---- Market overlay (DOM panel; rebuilt after every transaction) ----
        openMarket() {
            this.engine.dock();   // free hull patch + air on dock
            this.showOverlay('market');
        }

        matsText(mats) {
            return Object.entries(mats)
                .map(([m, n]) => `${n} ${MATERIAL_NAMES[m]}`)
                .join(', ');
        }

        buildMarket() {
            const s = this.state;
            const e = this.engine;
            const panel = document.getElementById('market-panel');

            const sellRows = Object.entries(s.hold).map(([m, n]) =>
                `<tr><td>${MATERIAL_NAMES[m]}</td><td class="num">×${n}</td>` +
                `<td class="num">@${SELL_PRICES[m]}cr</td>` +
                `<td><button data-sell="${m}">Sell ${n * SELL_PRICES[m]}cr</button></td></tr>`
            ).join('');
            const sellSection = sellRows
                ? `<table>${sellRows}</table><button data-sell-all>Sell All</button>`
                : '<div>Nothing in the hold.</div>';

            const craftRows = UPGRADE_KEYS.map(key => {
                const u = UPGRADES[key];
                const tier = s.upgrades[key];
                if (tier >= u.tiers.length)
                    return `<tr><td>${u.name}</td><td>${u.stat} ${u.values[tier]}</td><td colspan="2">MAX</td></tr>`;
                const recipe = u.tiers[tier];
                const cost = `${recipe.price}cr + ${this.matsText(recipe.mats)}`;
                const disabled = e.canCraft(key) ? '' : 'disabled';
                return `<tr><td>${u.name} ${'I'.repeat(tier + 1)}</td>` +
                    `<td>${u.stat} ${u.values[tier]} → ${u.values[tier + 1]}</td>` +
                    `<td>${cost}</td><td><button data-craft="${key}" ${disabled}>Craft</button></td></tr>`;
            }).join('');

            const beaconCost = `${BEACON.price}cr + ${this.matsText(BEACON.mats)}`;
            const beaconDisabled = e.canCraftBeacon() ? '' : 'disabled';
            const beaconRow = `<tr class="beacon-row"><td>${BEACON.name}</td><td>call the tender — WIN</td>` +
                `<td>${beaconCost}</td><td><button data-beacon ${beaconDisabled}>Craft</button></td></tr>`;

            panel.innerHTML =
                `<h2>Berth Station</h2>` +
                `<div class="credits">Credits: ${s.credits}cr &nbsp; Attention: ${e.attention()}</div>` +
                `<h3>Sell</h3>${sellSection}` +
                `<h3>Fabricate</h3><table>${craftRows}${beaconRow}</table>` +
                `<div class="close-row"><button data-close>Close</button></div>`;

            panel.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', ev => {
                    ev.currentTarget.blur();
                    this.onMarketClick(ev.currentTarget);
                });
            });
        }

        onMarketClick(btn) {
            if (btn.hasAttribute('data-close')) { this.dismissOverlay(); return; }
            if (btn.hasAttribute('data-sell')) {
                if (this.engine.sell(btn.getAttribute('data-sell')).ok) this.sound.coin();
            } else if (btn.hasAttribute('data-sell-all')) {
                if (this.engine.sellAll().ok) this.sound.coin();
            } else if (btn.hasAttribute('data-craft')) {
                if (this.engine.craft(btn.getAttribute('data-craft')).ok) this.sound.coin();
            } else if (btn.hasAttribute('data-beacon')) {
                if (this.engine.craftBeacon().ok) {
                    this.sound.fanfare();
                    this.overlay = null;
                    this.syncOverlayDom();
                    this.showOverlay('victory');
                    this.render();
                    return;
                }
            }
            this.buildMarket();   // refresh counts, prices, disabled states
            this.updateHUD();
        }

        // ---- L5 Overlays: input-capturing layers checked before gameplay ----
        showOverlay(name) {
            this.overlay = name;
            if (name === 'market') this.buildMarket();
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
            document.getElementById('market-panel').classList.toggle('hidden', this.overlay !== 'market');
        }

        // ---- Rendering ----
        render() {
            const ctx = this.ctx;
            const canvas = this.canvas;
            const s = this.state;

            ctx.fillStyle = '#060b1e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Terrain, murk, nodes, caches — the map layer
            for (const [key, hex] of s.hexes) {
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 ||
                    y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;

                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
                ctx.fill();
                ctx.strokeStyle = '#00000044';
                ctx.lineWidth = 1;
                ctx.stroke();

                const seen = s.seen.has(key);
                if (!seen) {
                    drawHexPath(ctx, x, y, HEX_SIZE);
                    ctx.fillStyle = MURK_COLOR;
                    ctx.fill();
                }

                if (seen && hex.node) this.drawNode(x, y, hex.node);
                if (hex.terrain === TERRAIN.BASE) {
                    ctx.fillStyle = '#403010';
                    ctx.font = 'bold 16px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('⌂', x, y);
                }
            }

            // Caches: dropped bags and wrecks — always visible once they exist; they
            // are the map's revenge markers.
            for (const cache of s.caches) {
                const { x, y } = this.hexToScreen(cache.q, cache.r);
                ctx.fillStyle = CACHE_COLOR;
                ctx.font = 'bold 15px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('◆', x, y);
            }

            // L1.2 highlight sets: movement tint (yellow); attack tint never fills here.
            if (this.selection) {
                for (const key of this.selection.reachable.keys()) {
                    const { q, r } = Hex.fromKey(key);
                    const { x, y } = this.hexToScreen(q, r);
                    drawHexPath(ctx, x, y, HEX_SIZE);
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                    ctx.fill();
                }
            }

            // Eels: small counters, only inside current sight (they ambush from murk)
            for (let i = 0; i < s.eels.length; i++) {
                const eel = s.eels[i];
                if (!this.engine.inSight(eel)) continue;
                const { x, y } = this.hexToScreen(eel.q, eel.r);
                this.drawCounter(x, y, s.eelColors[i] || '#cc3333', 'e', COUNTER_SIZE * 0.7);
            }

            // Leviathans: huge, named, always visible — you track the shadow
            for (const lev of s.leviathans) {
                const { x, y } = this.hexToScreen(lev.q, lev.r);
                this.drawCounter(x, y, LEVIATHAN_COLOR, 'L', COUNTER_SIZE * 1.5);
                ctx.fillStyle = LEVIATHAN_COLOR;
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(lev.name, x, y + COUNTER_SIZE);
            }

            // The sub (always) and the diver (when out)
            {
                const { x, y } = this.hexToScreen(s.sub.q, s.sub.r);
                this.drawCounter(x, y, SUB_COLOR, 'S', COUNTER_SIZE);
                if (this.selection && !s.diverOut) this.drawSelectionRing(x, y, COUNTER_SIZE);
            }
            if (s.diverOut) {
                const { x, y } = this.hexToScreen(s.diver.q, s.diver.r);
                this.drawCounter(x, y, DIVER_COLOR, 'D', COUNTER_SIZE * 0.85);
                if (this.selection) this.drawSelectionRing(x, y, COUNTER_SIZE * 0.85);
            }

            // L5 victory overlay (canvas-drawn, input-capturing layer)
            if (this.overlay === 'victory') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#7ce8ff';
                ctx.font = 'bold 44px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('THE BEACON SINGS', canvas.width / 2, canvas.height / 2 - 30);
                ctx.fillStyle = '#fff';
                ctx.font = '20px monospace';
                ctx.fillText('The tender ship is coming. You thrived. — ' + s.turn + ' turns',
                    canvas.width / 2, canvas.height / 2 + 20);
            }

            this.updateHUD();
        }

        drawNode(x, y, node) {
            const ctx = this.ctx;
            const radius = 2 + Math.min(node.amount, 5);
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = MATERIAL_COLORS[node.material];
            ctx.fill();
            ctx.strokeStyle = '#00000088';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        drawSelectionRing(x, y, size) {
            const sz = size + 4;
            this.roundRect(x - sz / 2, y - sz / 2, sz, sz, 6);
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
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

        drawCounter(cx, cy, color, label, size) {
            const ctx = this.ctx;
            const labelColor = this.contrastText(color);
            const s = size;
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
            const e = this.engine;
            document.getElementById('turn-info').textContent = 'Turn ' + s.turn;
            const mpMax = s.diverOut ? e.stat('fins') : SUB_MP;
            document.getElementById('mp-info').textContent = 'MP: ' + s.mp + '/' + mpMax;

            const o2El = document.getElementById('o2-info');
            o2El.classList.toggle('hidden', !s.diverOut);
            o2El.textContent = 'O₂: ' + s.o2 + '/' + e.stat('o2');
            o2El.classList.toggle('low', s.o2 <= 3);

            document.getElementById('hull-info').textContent = 'Hull: ' + s.hull + '/' + e.stat('hull');
            document.getElementById('credits-info').textContent = s.credits + 'cr';
            document.getElementById('bag-info').textContent =
                'Bag: ' + (e.stat('bag') - e.bagSpace()) + '/' + e.stat('bag');
            document.getElementById('hold-info').textContent =
                'Hold: ' + (e.stat('hold') - e.holdSpace()) + '/' + e.stat('hold');

            this.renderActionButtons();
            this.updateHover();
        }

        renderActionButtons() {
            const el = document.getElementById('action-buttons');
            el.innerHTML = '';
            if (this.overlay || this.state.gameWon) return;
            const actions = this.availableActions();
            const primary = this.primaryOf(actions);
            actions.forEach(action => {
                const btn = document.createElement('button');
                btn.textContent = action.label;
                if (action === primary) btn.classList.add('primary');
                btn.addEventListener('click', ev => { ev.currentTarget.blur(); action.run(); });
                el.appendChild(btn);
            });
        }

        // L1.3 hovered-hex readout — terrain, O2 tax, and what's known to be there.
        updateHover() {
            const s = this.state;
            const hoverEl = document.getElementById('hover-info');
            if (!hoverEl) return;
            const h = this.hoveredHex && s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            if (!h) { hoverEl.textContent = ''; return; }

            const parts = [TERRAIN_NAMES[h.terrain] ?? '?'];
            const drain = O2_DRAIN[h.terrain];
            if (drain > 1) parts.push(`O₂ −${drain}`);
            if (s.seen.has(Hex.key(h.q, h.r)) && h.node)
                parts.push(`${MATERIAL_NAMES[h.node.material]} ×${h.node.amount}`);
            if (this.engine.cacheAt(h)) parts.push('cache ◆');
            hoverEl.textContent = parts.join(' · ');
        }

        // ---- Input handling (dispatch order mirrors UI_CONTROLS.md) ----
        attach() {
            this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
            this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
            this.canvas.addEventListener('mouseup', e => this.onMouseUp(e));
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
            window.addEventListener('resize', () => this.resize());
            window.addEventListener('keydown', e => this.onKeyDown(e));

            // L2.3 twin activators: HUD button and hotkey route through shared functions.
            document.getElementById('end-turn').addEventListener('click', () => {
                if (this.overlay || this.state.phase !== 'player' || this.state.gameWon) return;
                this.doEndTurn();
            });
            document.getElementById('new-game').addEventListener('click', () => this.newGame());
            document.getElementById('begin-btn').addEventListener('click', () => this.dismissOverlay());
        }

        onMouseDown(e) {
            const s = this.state;
            // Right button: begin a camera pan (L1.3).
            if (e.button === 2) {
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
            if (s.gameWon) return;                                // game over: board is view-only
            if (s.phase !== 'player') return;                     // L1.1 map input is live only on the player's turn

            const hex = this.screenToHex(e.clientX, e.clientY);
            const key = Hex.key(hex.q, hex.r);
            const active = this.engine.activePos();

            // L1.2 select, then act — the handler is a pure lookup against the cached sets.
            if (!this.selection) {
                if (hex.q === active.q && hex.r === active.r) this.selectPlayer();
            } else if (hex.q === active.q && hex.r === active.r) {
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
                this.updateHover();
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
            // L2.2 Esc: peel back one modal layer, deepest first.
            if (e.key === 'Escape') {
                this.deselect();
                this.render();
                return;
            }
            // L2.1 primary action: first context action, else end turn.
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.primaryAction();
            }
        }
    }

    return GameUI;
})();
