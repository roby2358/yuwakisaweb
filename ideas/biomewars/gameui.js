// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering, the DOM HUD, camera/pan, and all
// input wiring. It owns the *view and interaction* state (pan offset, hovered hex,
// current selection, modal overlays) — none of which is game state — and it drives
// GameEngine by dispatching actions and re-rendering from GameState afterward. It also
// owns persistence: the world is saved to localStorage after every world phase, so a
// double-clicked index.html resumes where the player left off.
//
// The input dispatch mirrors UI_CONTROLS.md; layer citations (L1.2, L2.1, …) are kept.
// In a client/server world this is the client: swap engine calls for messages to a
// server and re-render from the state it ships back, and the seam is already here.
const GameUI = (function () {
    const { BIOME_RULES, CREATURES, TALENTS, RULES } = GameArtifacts;
    const {
        HEX_SIZE, COUNTER_SIZE, CREATURE_RADIUS,
        BIOME_COLORS, VITALITY_SHADE_FLOOR, CREATURE_COLORS,
        HOSTILE_RING, FRIENDLY_RING, HERO_COLOR,
        SETTLEMENT_COLOR, BLIGHT_COLOR, BLIGHT_GLYPH_COLOR,
        BAR_BACK, PROSPERITY_BAR, BLIGHT_BAR
    } = GameDisplayArtifacts;

    const SAVE_KEY = 'biomewars-save';

    // How each anchor kind presents — counter face, status bar, hover readout.
    // The view-side mirror of the engine's ANCHOR_KINDS dispatch: the UI never
    // asks `kind === ...` either.
    const ANCHOR_VIEWS = {
        settlement: {
            counter: a => ({ color: SETTLEMENT_COLOR, glyph: a.name.charAt(0), ring: BIOME_COLORS[a.biome] }),
            bar: a => ({ fraction: a.prosperity / RULES.PROSPERITY_MAX, color: PROSPERITY_BAR }),
            describe: a => `${a.name} — settlement, prosperity ${Math.round(a.prosperity)}`
        },
        blight: {
            counter: () => ({ color: BLIGHT_COLOR, glyph: '✸', ring: BLIGHT_GLYPH_COLOR }),
            bar: a => ({ fraction: a.hp / a.maxHp, color: BLIGHT_BAR }),
            describe: a => `${a.name} — blight, ${a.hp} HP, prosperity ${Math.round(a.prosperity)}`
        }
    };

    // Canvas-drawn overlay banners, keyed by overlay name. (The DOM overlays —
    // intro, talents — are toggled in syncOverlayDom instead.)
    const BANNERS = {
        goldenage: {
            title: 'A GOLDEN AGE DAWNS',
            sub: 'Every blight is cleansed — for now. (click to continue)'
        },
        defeat: {
            title: 'THE LAST SETTLEMENT HAS FALLEN',
            sub: 'The planet\'s war rolls on without you. New World to begin again.'
        }
    };

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
            this.targeting = null;   // L4 modal targeting — unused, no aimed abilities yet
            this.overlay = null;     // L5 input-capturing layer: 'intro' | 'talents' | 'goldenage' | 'defeat' | null
            this.hoveredHex = null;  // L1.3 hex under the cursor, for the HUD readout
        }

        // ---- Lifecycle ----
        start() {
            this.attach();
            let save = this.loadSave();
            if (save) {
                // No save migration while prototyping: a stale-shaped save just breaks —
                // but it should break into a fresh world, not a blank page.
                try { this.engine.loadGame(save); }
                catch (e) { save = null; this.clearSave(); }
            }
            if (!save) this.engine.newGame();
            document.getElementById('continue-btn').classList.toggle('hidden', !save);
            this.centerOn(this.state.hero);
            this.showOverlay('intro');
            this.resize();   // resize() re-renders
        }

        newWorld() {
            this.engine.newGame();
            this.selection = null;
            this.targeting = null;
            this.hoveredHex = null;
            this.overlay = null;
            this.syncOverlayDom();
            this.centerOn(this.state.hero);
            this.saveGame();
            this.resize();
        }

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.render();
        }

        // ---- Persistence (client-owned; the engine never touches storage) ----
        saveGame() {
            try {
                localStorage.setItem(SAVE_KEY, JSON.stringify(this.state.toJSON()));
            } catch (e) { /* storage unavailable (privacy mode) — play on without saves */ }
        }

        loadSave() {
            try {
                const raw = localStorage.getItem(SAVE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        }

        clearSave() {
            try {
                localStorage.removeItem(SAVE_KEY);
            } catch (e) { /* nothing to clear */ }
        }

        // ---- Coordinate helpers ----
        hexToScreen(q, r) {
            const p = new Hex(q, r).toPixel();
            return { x: p.x + this.panX, y: p.y + this.panY };
        }

        screenToHex(sx, sy) {
            return Hex.fromPixel(sx - this.panX, sy - this.panY);
        }

        centerOn(pos) {
            const p = new Hex(pos.q, pos.r).toPixel();
            this.panX = this.canvas.width / 2 - p.x;
            this.panY = this.canvas.height / 2 - p.y;
        }

        // ---- L1.2 Selection: ask the engine for the legal sets; dispatch is a lookup ----
        selectHero() {
            this.selection = {
                reachable: this.engine.computeReachable(),
                attackable: this.engine.computeAttackable()
            };
        }

        deselect() {
            this.selection = null;
        }

        // ---- Action plumbing ----
        // Every engine action returns { ok, endedTurn?, flags?, goldenAge? }; this one
        // funnel interprets the outcome: refresh highlights while the turn continues,
        // resolve the world phase's flags when it ends.
        doAction(res) {
            if (!res.ok) { this.render(); return; }
            if (res.goldenAge) this.showOverlay('goldenage');
            if (res.endedTurn) {
                this.deselect();
                this.handleWorldFlags(res.flags);
            } else if (this.selection) {
                this.selectHero();   // L1.4 turn continues: recompute sets after MP spent
            }
            this.render();
        }

        // Interpret the world phase's outcome flags: save (or clear on defeat), pull
        // the camera to the hero when he fell, raise the big overlays.
        handleWorldFlags(flags) {
            if (this.state.gameOver) {
                this.clearSave();
                this.showOverlay('defeat');
            } else {
                this.saveGame();
            }
            if (flags.fell) this.centerOn(this.state.hero);
            if (flags.goldenAge) this.showOverlay('goldenage');
        }

        commitMove(q, r) {
            this.doAction(this.engine.movePlayer(q, r));
        }

        doAttack(q, r) {
            this.doAction(this.engine.attack(q, r));
        }

        // Gameplay input is live only with no overlay up, on the player's phase,
        // while the game is on — the shared guard for every action activator.
        canAct() {
            return !this.overlay && this.state.phase === 'player' && !this.state.gameOver;
        }

        doGather() {
            if (!this.canAct()) return;
            this.doAction(this.engine.gather());
        }

        doFeed() {
            if (!this.canAct()) return;
            this.doAction(this.engine.feed());
        }

        // ---- L2.1 One context-sensitive primary action (End Turn button + Space/Enter) ----
        primaryAction() {
            if (!this.canAct()) return;
            const loc = this.engine.locationAt(this.state.hero);
            if (loc) {
                // openLocation(loc) — wire up when interactive locations exist
            } else {
                const flags = this.engine.endTurn();
                this.deselect();
                this.handleWorldFlags(flags);
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
            if (name === 'talents') this.buildTalentPanel();
            this.syncOverlayDom();
        }

        dismissOverlay() {
            this.overlay = null;
            this.syncOverlayDom();
            this.render();
        }

        syncOverlayDom() {
            document.getElementById('intro-panel').classList.toggle('hidden', this.overlay !== 'intro');
            document.getElementById('talent-panel').classList.toggle('hidden', this.overlay !== 'talents');
        }

        // ---- Talent panel (DOM overlay) ----
        buildTalentPanel() {
            const canTrain = this.engine.canTrain();
            document.getElementById('talent-hint').classList.toggle('hidden', canTrain);
            const list = document.getElementById('talent-list');
            list.innerHTML = '';
            // Purchased talents list first; the unbought wait below, uncounted.
            const purchased = TALENTS.filter(t => this.engine.talentLevel(t.key) > 0);
            const unbought = TALENTS.filter(t => this.engine.talentLevel(t.key) === 0);
            for (const def of [...purchased, ...unbought])
                list.appendChild(this.talentRow(def, canTrain));
            document.getElementById('talent-essence').textContent = `Essence: ${this.state.hero.essence}`;
        }

        talentRow(def, canTrain) {
            const level = this.engine.talentLevel(def.key);
            const cost = this.engine.talentCost(def.key);
            const maxed = level >= def.max;

            const row = document.createElement('div');
            row.className = 'talent-row';

            const info = document.createElement('div');
            info.className = 'talent-info';
            const title = document.createElement('div');
            title.className = 'talent-name';
            title.textContent = level > 0 ? `${def.name} ${level}/${def.max}` : def.name;
            const desc = document.createElement('div');
            desc.className = 'talent-desc';
            desc.textContent = def.desc;
            info.appendChild(title);
            info.appendChild(desc);

            const btn = document.createElement('button');
            btn.textContent = maxed ? 'MAX' : `Buy (${cost})`;
            btn.disabled = maxed || this.state.hero.essence < cost || !canTrain;
            btn.addEventListener('click', () => this.onBuyTalent(def.key));

            row.appendChild(info);
            row.appendChild(btn);
            return row;
        }

        onBuyTalent(key) {
            const res = this.engine.buyTalent(key);
            if (!res.ok) return;
            this.saveGame();
            this.buildTalentPanel();
            this.updateHUD();
            this.renderLog();
        }

        // ---- Rendering ----

        // '#rrggbb' -> { r, g, b } in 0-255.
        hexToRgb(color) {
            return {
                r: parseInt(color.slice(1, 3), 16),
                g: parseInt(color.slice(3, 5), 16),
                b: parseInt(color.slice(5, 7), 16)
            };
        }

        // Darken a '#rrggbb' color toward black as vitality drains, so front lines
        // read as sickly bands (UI reveals mechanics).
        shade(color, factor) {
            const { r, g, b } = this.hexToRgb(color);
            return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
        }

        hexFill(hex) {
            const base = BIOME_COLORS[hex.biome];
            if (!BIOME_RULES[hex.biome].warring) return base;
            const factor = VITALITY_SHADE_FLOOR + (1 - VITALITY_SHADE_FLOOR) * hex.vitality / 100;
            return this.shade(base, factor);
        }

        render() {
            this.ctx.fillStyle = '#0a0a12';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.drawBiomes();
            this.drawSelectionHighlights();
            this.drawAnchors();
            this.drawCreatures();
            this.drawHero();
            this.drawOverlayBanner();

            this.updateHUD();
            this.renderLog();
        }

        // Biomes, shaded by vitality; hexes far off-screen are skipped.
        drawBiomes() {
            const ctx = this.ctx;
            for (const [, hex] of this.state.hexes) {
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                if (x < -HEX_SIZE * 2 || x > this.canvas.width + HEX_SIZE * 2 ||
                    y < -HEX_SIZE * 2 || y > this.canvas.height + HEX_SIZE * 2) continue;
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = this.hexFill(hex);
                ctx.fill();
                ctx.strokeStyle = '#00000044';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // L1.2 highlight sets: movement tint (yellow) + attack tint (red).
        drawSelectionHighlights() {
            if (!this.selection) return;
            this.tintHexes(this.selection.reachable.keys(), 'rgba(255, 255, 0, 0.3)');
            this.tintHexes(this.selection.attackable, 'rgba(255, 0, 0, 0.35)');
        }

        tintHexes(keys, color) {
            for (const key of keys) {
                const { q, r } = Hex.fromKey(key);
                const { x, y } = this.hexToScreen(q, r);
                drawHexPath(this.ctx, x, y, HEX_SIZE);
                this.ctx.fillStyle = color;
                this.ctx.fill();
            }
        }

        // Anchors: counter + biome ring + status bar, per the kind's view.
        drawAnchors() {
            for (const a of this.state.anchors) {
                const { x, y } = this.hexToScreen(a.q, a.r);
                const view = ANCHOR_VIEWS[a.kind];
                const counter = view.counter(a);
                this.drawCounter(x, y, counter.color, counter.glyph);
                this.drawRing(x, y, counter.ring);
                const bar = view.bar(a);
                this.drawBar(x, y, bar.fraction, bar.color);
            }
        }

        // Creatures: species-lettered discs, ring color = disposition.
        drawCreatures() {
            const ctx = this.ctx;
            for (const c of this.state.creatures) {
                const { x, y } = this.hexToScreen(c.q, c.r);
                const def = CREATURES[c.biome];
                ctx.beginPath();
                ctx.arc(x, y, CREATURE_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = CREATURE_COLORS[c.biome];
                ctx.fill();
                ctx.strokeStyle = def.friendly ? FRIENDLY_RING : HOSTILE_RING;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = '#000';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.engine.creatureName(c.biome).charAt(0), x, y + 1);
            }
        }

        // The hero counter, boxed in white while selected.
        drawHero() {
            const s = this.state;
            if (!s.hero) return;
            const { x, y } = this.hexToScreen(s.hero.q, s.hero.r);
            this.drawCounter(x, y, HERO_COLOR, '@');
            if (!this.selection) return;
            const sz = COUNTER_SIZE + 4;
            this.roundRect(x - sz / 2, y - sz / 2, sz, sz, 6);
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // L5 canvas-drawn overlays (input-capturing layers).
        drawOverlayBanner() {
            const banner = BANNERS[this.overlay];
            if (banner) this.drawBanner(banner.title, banner.sub);
        }

        drawBanner(title, sub) {
            const ctx = this.ctx;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(title, this.canvas.width / 2, this.canvas.height / 2 - 30);
            ctx.font = '18px monospace';
            ctx.fillText(sub, this.canvas.width / 2, this.canvas.height / 2 + 20);
        }

        drawBar(cx, cy, fraction, color) {
            const ctx = this.ctx;
            const w = COUNTER_SIZE;
            const x = cx - w / 2;
            const y = cy + COUNTER_SIZE / 2 + 4;
            ctx.fillStyle = BAR_BACK;
            ctx.fillRect(x, y, w, 3);
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraction)), 3);
        }

        drawRing(cx, cy, color) {
            const ctx = this.ctx;
            const sz = COUNTER_SIZE + 4;
            this.roundRect(cx - sz / 2, cy - sz / 2, sz, sz, 6);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
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

        contrastText(color) {
            const { r, g, b } = this.hexToRgb(color);
            const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
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

        // ---- HUD ----
        cap(text) {
            return text.charAt(0).toUpperCase() + text.slice(1);
        }

        // L1.3 hovered-hex readout: biome (proper name + archetype), land stats, and
        // whatever stands there — every mechanic surfaced at the point of decision.
        hoverInfo() {
            const s = this.state;
            if (!this.hoveredHex) return '';
            const hex = s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            if (!hex) return '';

            const rules = BIOME_RULES[hex.biome];
            const proper = s.names.biomes[hex.biome];
            const parts = [proper ? `${proper} (${rules.label})` : this.cap(rules.label)];
            if (rules.warring) {
                parts.push(`vit ${Math.round(hex.vitality)}`);
                if (rules.hazard > 0) parts.push(`hazard ${rules.hazard}`);
                parts.push(`yield ${rules.yield}`);
            }

            const creature = this.engine.creatureAt(hex.q, hex.r);
            if (creature) {
                const def = CREATURES[creature.biome];
                const mood = def.friendly ? 'friendly' : 'hostile';
                parts.push(`${this.engine.creatureName(creature.biome)} (${def.label}, ${mood}) ${creature.hp}/${def.hp}`);
            }

            const anchor = this.engine.anchorAt(hex.q, hex.r);
            if (anchor) parts.push(ANCHOR_VIEWS[anchor.kind].describe(anchor));

            return parts.join(' · ');
        }

        updateHUD() {
            const s = this.state;
            const engine = this.engine;
            document.getElementById('turn-info').textContent = 'Turn ' + s.turn;
            document.getElementById('hp-info').textContent = `HP ${s.hero.hp}/${engine.heroMaxHp()}`;
            document.getElementById('mp-info').textContent = `MP ${s.mp}/${engine.heroMp()}`;
            document.getElementById('essence-info').textContent = `Essence ${s.hero.essence}`;

            const golden = s.goldenAge > 0 ? ` · Golden Age ${s.goldenAge}` : '';
            document.getElementById('world-info').textContent =
                `⌂ ${engine.settlements().length} · ✸ ${engine.blights().length}${golden}`;

            document.getElementById('gather-btn').disabled = !engine.canGather();
            document.getElementById('feed-btn').disabled = !engine.canFeed();
            document.getElementById('end-turn').disabled = s.gameOver;

            document.getElementById('hover-info').textContent = this.hoverInfo();
        }

        renderLog() {
            const el = document.getElementById('log');
            el.innerHTML = '';
            for (const entry of this.state.log.slice(-6)) {
                const line = document.createElement('div');
                line.textContent = `T${entry.turn} · ${entry.msg}`;
                el.appendChild(line);
            }
        }

        // ---- Input handling (dispatch order mirrors UI_CONTROLS.md) ----
        attach() {
            this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
            this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
            this.canvas.addEventListener('mouseup', e => this.onMouseUp(e));
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
            window.addEventListener('resize', () => this.resize());
            window.addEventListener('keydown', e => this.onKeyDown(e));

            // L2.3 twin activators: HUD buttons and hotkeys route through shared functions.
            document.getElementById('gather-btn').addEventListener('click', () => this.doGather());
            document.getElementById('feed-btn').addEventListener('click', () => this.doFeed());
            document.getElementById('talents-btn').addEventListener('click', () => this.toggleTalents());
            document.getElementById('end-turn').addEventListener('click', () => this.primaryAction());
            document.getElementById('new-game').addEventListener('click', () => this.confirmNewWorld());
            document.getElementById('begin-btn').addEventListener('click', () => this.newWorld());
            document.getElementById('continue-btn').addEventListener('click', () => this.dismissOverlay());
            document.getElementById('talents-close').addEventListener('click', () => this.dismissOverlay());
        }

        toggleTalents() {
            if (this.overlay === 'talents') this.dismissOverlay();
            else if (!this.overlay) this.showOverlay('talents');
        }

        confirmNewWorld() {
            if (!this.state.gameOver && this.overlay !== 'intro' &&
                !confirm('Abandon this world and generate a new one?')) return;
            this.newWorld();
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

            if (this.overlay) {
                // L5 overlay captures & consumes the click; DOM panels (intro, talents)
                // keep their own buttons — a canvas click behind them dismisses too.
                if (this.overlay !== 'intro') this.dismissOverlay();
                return;
            }
            if (s.gameOver) return;                               // game over: board is view-only
            if (s.phase !== 'player') return;                     // L1.1 map input is live only on the player's turn

            const hex = this.screenToHex(e.clientX, e.clientY);
            const key = Hex.key(hex.q, hex.r);

            // L4 modal targeting: a valid hex commits the action, anything else cancels.
            if (this.targeting) {
                if (this.targeting.validHexes.has(key)) {
                    // commitTargeting(hex) — wire up when aimed abilities exist
                }
                this.cancelTargeting();
                this.render();
                return;
            }

            // L1.2 select, then act — the handler is a pure lookup against the cached sets.
            if (!this.selection) {
                if (hex.q === s.hero.q && hex.r === s.hero.r) this.selectHero();
            } else if (hex.q === s.hero.q && hex.r === s.hero.r) {
                this.deselect();
            } else if (this.selection.attackable.has(key)) {
                this.doAttack(hex.q, hex.r);
                return;   // doAttack has already re-rendered
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
            // L5 an overlay swallows its dismissing key (intro only dismisses forward
            // via its buttons, so a stray keypress can't skip the Continue choice).
            if (this.overlay && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
                e.preventDefault();
                if (this.overlay !== 'intro') this.dismissOverlay();
                return;
            }
            if (this.overlay) return;
            // L2.2 Esc: peel back one modal layer, deepest first.
            if (e.key === 'Escape') {
                if (this.targeting) this.cancelTargeting();
                else this.deselect();
                this.render();
                return;
            }
            // L2.3 action hotkeys
            if (e.key === 'g' || e.key === 'G') { this.doGather(); return; }
            if (e.key === 'f' || e.key === 'F') { this.doFeed(); return; }
            if (e.key === 't' || e.key === 'T') { this.toggleTalents(); return; }
            // L2.1 primary action.
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.primaryAction();
            }
        }
    }

    return GameUI;
})();
