// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering, the DOM HUD, camera/pan, and all
// input wiring. It owns the view and interaction state (pan offset, hovered hex,
// selection, overlays, the banner queue) — none of which is game state — and it drives
// GameEngine by dispatching actions and re-rendering from GameState afterward. It also
// owns persistence: the world is saved to localStorage after every world phase, so a
// double-clicked index.html resumes the same life's work.
const GameUI = (function () {
    const { TERRAIN_RULES, NODES, FOES, SKILLS, RANKS, RULES } = GameArtifacts;
    const {
        HEX_SIZE, COUNTER_SIZE, FOE_RADIUS,
        TERRAIN_COLORS, RING_SHADE, NODE_GLYPHS, NODE_COLORS, NODE_SPENT,
        TIER_COLORS, PREY_RING, HOSTILE_RING, CHAMPION_RING,
        HERO_COLOR, HALL_COLOR, HOLDING_COLOR, MONUMENT_COLOR,
        DOOM_COLOR, DOOM_GLYPH_COLOR, BAR_BACK, HP_BAR, DOOM_BAR
    } = GameDisplayArtifacts;

    const SAVE_KEY = 'laurels-save';
    const RING_NAMES = ['the Hearthlands', 'the Marches', 'the Wilds', 'the Deepwilds', 'the Dread'];
    const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
        'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

    // How each anchor kind presents — counter face, status bar, hover readout.
    // The view-side mirror of the engine's role dispatch: the UI never asks `kind === ...`.
    const ANCHOR_VIEWS = {
        hall: {
            counter: () => ({ color: HALL_COLOR, glyph: '⌂', ring: HERO_COLOR }),
            bar: () => null,
            describe: () => 'the Hall — your hearth. Bank (B), craft (C); it cannot fall'
        },
        holding: {
            counter: a => ({ color: HOLDING_COLOR, glyph: a.name.charAt(0), ring: '#7dd87d' }),
            bar: a => ({ fraction: a.hp / a.maxHp, color: HP_BAR }),
            describe: a => `${a.name} — holding, ${a.hp}/${a.maxHp}. Bank here; rest heals; sackable`
        },
        monument: {
            counter: () => ({ color: MONUMENT_COLOR, glyph: '▲', ring: HERO_COLOR }),
            bar: a => ({ fraction: a.hp / a.maxHp, color: HP_BAR }),
            describe: a => `${a.name} — monument, ${a.hp}/${a.maxHp}, +${a.income} renown per dawn`
        },
        doom: {
            counter: () => ({ color: DOOM_COLOR, glyph: '✸', ring: DOOM_GLYPH_COLOR }),
            bar: a => ({ fraction: a.hp / a.maxHp, color: DOOM_BAR }),
            describe: a => `${a.name} — doom (tier ${a.tier}), ${a.hp}/${a.maxHp}. Topple it for glory`
        }
    };

    // Canvas-drawn banners, queued so a big dawn shows each in turn.
    const BANNERS = {
        rankup: text => ({ title: 'THE BARDS SING', sub: `You are ${text} now. (click to continue)` }),
        rankdown: text => ({ title: 'THE BARDS MOVE ON', sub: `You are merely ${text} now. (click to continue)` }),
        doomrise: () => ({ title: 'DOOMRISE', sub: 'The Reckoning answers your glory. New dooms fester. (click)' }),
        fell: () => ({ title: 'CARRIED HOME', sub: 'Half your pack scattered; your renown is bruised. (click)' })
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

            // ---- Input-layer state: overlay (top) → selection (bottom) ----
            this.selection = null;    // { reachable: Map<key,cost>, attackable: Set<key> }
            this.overlay = null;      // 'intro' | 'skills' | 'banner' | null
            this.banner = null;       // { title, sub } currently displayed
            this.bannerQueue = [];
            this.hoveredHex = null;
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
            this.hoveredHex = null;
            this.overlay = null;
            this.banner = null;
            this.bannerQueue = [];
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

        // ---- Selection: ask the engine for the legal sets ----
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
        // Every engine action returns { ok, rankUp? }; this one funnel interprets the
        // outcome: refresh highlights while the turn continues, queue the big banners.
        doAction(res) {
            if (!res.ok) { this.render(); return; }
            if (res.rankUp) this.queueBanner(BANNERS.rankup(res.rankUp));
            this.saveGame();
            if (this.selection) this.selectHero();
            this.render();
        }

        // Interpret the world phase's outcome flags in drama order.
        handleWorldFlags(flags) {
            this.saveGame();
            if (flags.fell) {
                this.centerOn(this.state.hero);
                this.queueBanner(BANNERS.fell());
            }
            if (flags.doomrise) this.queueBanner(BANNERS.doomrise());
            if (flags.rankUp) this.queueBanner(BANNERS.rankup(flags.rankUp));
            if (flags.rankDown) this.queueBanner(BANNERS.rankdown(flags.rankDown));
        }

        commitMove(q, r) {
            this.doAction(this.engine.movePlayer(q, r));
        }

        doAttack(q, r) {
            this.doAction(this.engine.attack(q, r));
        }

        // Gameplay input is live only with no overlay up, on the player's phase.
        canAct() {
            return !this.overlay && this.state.phase === 'player';
        }

        doHarvest() {
            if (!this.canAct()) return;
            this.doAction(this.engine.harvest());
        }

        doBank() {
            if (!this.canAct()) return;
            this.doAction(this.engine.bank());
        }

        doCraft() {
            if (!this.canAct()) return;
            this.doAction(this.engine.craft());
        }

        doBuild() {
            if (!this.canAct()) return;
            this.doAction(this.engine.buildMonument());
        }

        doSack() {
            if (!this.canAct() || !this.engine.canSack()) return;
            const holding = this.engine.bankAnchor();
            if (!confirm(`Put ${holding.name} to the torch? The plunder is rich, the renown loud — and the Reckoning will remember.`)) return;
            this.doAction(this.engine.sack());
        }

        // ---- One primary action: End Turn (button + Space/Enter) ----
        primaryAction() {
            if (!this.canAct()) return;
            const flags = this.engine.endTurn();
            this.deselect();
            this.handleWorldFlags(flags);
            this.render();
        }

        // ---- Overlays: input-capturing layers checked before gameplay ----
        queueBanner(banner) {
            this.bannerQueue.push(banner);
            if (this.overlay === null) this.nextBanner();
        }

        nextBanner() {
            this.banner = this.bannerQueue.shift();
            this.overlay = this.banner ? 'banner' : null;
        }

        showOverlay(name) {
            this.overlay = name;
            if (name === 'skills') this.buildSkillsPanel();
            this.syncOverlayDom();
        }

        dismissOverlay() {
            if (this.overlay === 'banner') this.nextBanner();
            else this.overlay = null;
            if (this.overlay === null && this.bannerQueue.length > 0) this.nextBanner();
            this.syncOverlayDom();
            this.render();
        }

        syncOverlayDom() {
            document.getElementById('intro-panel').classList.toggle('hidden', this.overlay !== 'intro');
            document.getElementById('skills-panel').classList.toggle('hidden', this.overlay !== 'skills');
        }

        // ---- Skills & ranks panel (DOM overlay) ----
        buildSkillsPanel() {
            const list = document.getElementById('skills-list');
            list.innerHTML = '';
            for (const def of SKILLS) list.appendChild(this.skillRow(def));

            const ladder = document.getElementById('rank-list');
            ladder.innerHTML = '';
            const idx = this.engine.rankIndex();
            for (let i = 0; i < RANKS.length; i++) ladder.appendChild(this.rankRow(RANKS[i], i, idx));

            document.getElementById('skills-title').textContent =
                `${this.engine.title()} — renown ${this.state.hero.renown}, the dawn takes ${this.engine.decayAmount()}`;
        }

        skillRow(def) {
            const p = this.engine.xpProgress(def.key);
            const row = document.createElement('div');
            row.className = 'skill-row';

            const info = document.createElement('div');
            const title = document.createElement('div');
            title.className = 'skill-name';
            title.textContent = `${def.name} ${p.level}`;
            const desc = document.createElement('div');
            desc.className = 'skill-desc';
            desc.textContent = def.desc;
            info.appendChild(title);
            info.appendChild(desc);

            const bar = document.createElement('div');
            bar.className = 'xp-bar';
            const fill = document.createElement('div');
            fill.className = 'xp-fill';
            fill.style.width = `${Math.min(100, Math.round(100 * p.xp / p.need))}%`;
            bar.appendChild(fill);
            bar.title = `${p.xp}/${p.need} xp`;

            row.appendChild(info);
            row.appendChild(bar);
            return row;
        }

        rankRow(rank, i, currentIdx) {
            const row = document.createElement('div');
            row.className = 'rank-row' + (i === currentIdx ? ' rank-current' : '') +
                (i > currentIdx ? ' rank-locked' : '');
            const name = document.createElement('span');
            name.textContent = `${this.cap(rank.title)} (${rank.at})`;
            const priv = document.createElement('span');
            priv.className = 'rank-priv';
            priv.textContent = rank.privDesc;
            row.appendChild(name);
            row.appendChild(priv);
            return row;
        }

        // ---- Rendering ----

        hexToRgb(color) {
            return {
                r: parseInt(color.slice(1, 3), 16),
                g: parseInt(color.slice(3, 5), 16),
                b: parseInt(color.slice(5, 7), 16)
            };
        }

        // Danger rings darken the land toward the dread — the map is the difficulty curve.
        shade(color, factor) {
            const { r, g, b } = this.hexToRgb(color);
            return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
        }

        hexFill(hex) {
            return this.shade(TERRAIN_COLORS[hex.terrain], RING_SHADE[hex.ring]);
        }

        render() {
            this.ctx.fillStyle = '#0a0a12';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.drawTerrain();
            this.drawSelectionHighlights();
            this.drawAnchors();
            this.drawFoes();
            this.drawHero();
            if (this.overlay === 'banner' && this.banner) this.drawBanner(this.banner.title, this.banner.sub);

            this.updateHUD();
            this.renderLog();
        }

        onScreen(x, y) {
            return x >= -HEX_SIZE * 2 && x <= this.canvas.width + HEX_SIZE * 2 &&
                y >= -HEX_SIZE * 2 && y <= this.canvas.height + HEX_SIZE * 2;
        }

        drawTerrain() {
            const ctx = this.ctx;
            for (const [, hex] of this.state.hexes) {
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                if (!this.onScreen(x, y)) continue;
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = this.hexFill(hex);
                ctx.fill();
                ctx.strokeStyle = '#00000044';
                ctx.lineWidth = 1;
                ctx.stroke();
                if (hex.node) this.drawNode(hex, x, y);
            }
        }

        drawNode(hex, x, y) {
            const ctx = this.ctx;
            ctx.fillStyle = hex.node.stock > 0 ? NODE_COLORS[hex.node.kind] : NODE_SPENT;
            ctx.font = '13px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(NODE_GLYPHS[hex.node.kind], x, y + 1);
        }

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

        drawAnchors() {
            for (const a of this.state.anchors) {
                const { x, y } = this.hexToScreen(a.q, a.r);
                if (!this.onScreen(x, y)) continue;
                const view = ANCHOR_VIEWS[a.kind];
                const counter = view.counter(a);
                this.drawCounter(x, y, counter.color, counter.glyph);
                this.drawRing(x, y, counter.ring);
                const bar = view.bar(a);
                if (bar) this.drawBar(x, y, bar.fraction, bar.color);
            }
        }

        drawFoes() {
            const ctx = this.ctx;
            for (const f of this.state.foes) {
                const { x, y } = this.hexToScreen(f.q, f.r);
                if (!this.onScreen(x, y)) continue;
                const def = FOES[f.kind];
                ctx.beginPath();
                ctx.arc(x, y, FOE_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = TIER_COLORS[def.tier];
                ctx.fill();
                ctx.strokeStyle = f.name ? CHAMPION_RING : (def.role === 'prey' ? PREY_RING : HOSTILE_RING);
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = '#000';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(def.label.charAt(0).toUpperCase(), x, y + 1);
                if (f.hp < f.maxHp) this.drawBar(x, y, f.hp / f.maxHp, HP_BAR);
            }
        }

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

            this.roundRect(x, y, s, s, r);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();

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

        hoverInfo() {
            const s = this.state;
            if (!this.hoveredHex) return '';
            const hex = s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            if (!hex) return '';

            const parts = [`${this.cap(TERRAIN_RULES[hex.terrain].label)}, ${RING_NAMES[hex.ring]}`];
            if (hex.node) {
                const def = NODES[hex.node.kind];
                parts.push(hex.node.stock > 0
                    ? `${def.label} ×${hex.node.stock} (~${Math.round(def.base * hex.node.mult)} each)`
                    : `${def.label} (spent)`);
            }

            const foe = this.engine.foeAt(hex.q, hex.r);
            if (foe) {
                const def = FOES[foe.kind];
                const who = foe.name ? `${foe.name} (${def.label})` : this.cap(def.label);
                parts.push(`${who} — tier ${def.tier}, ${foe.hp}/${foe.maxHp}, hits ${foe.dmg}, speed ${foe.speed}`);
            }

            const anchor = this.engine.anchorAt(hex.q, hex.r);
            if (anchor) parts.push(ANCHOR_VIEWS[anchor.kind].describe(anchor));

            return parts.join(' · ');
        }

        nextRankInfo() {
            const idx = this.engine.rankIndex();
            if (idx >= RANKS.length - 1) return '';
            const next = RANKS[idx + 1];
            return ` · ${this.cap(next.title)} at ${next.at}`;
        }

        updateHUD() {
            const s = this.state;
            const engine = this.engine;
            document.getElementById('title-info').textContent = engine.title();
            document.getElementById('renown-info').textContent =
                `Renown ${s.hero.renown} (−${engine.decayAmount()}/dawn)${this.nextRankInfo()}`;
            document.getElementById('wealth-info').textContent = `Wealth ${s.hero.wealth}`;
            document.getElementById('pack-info').textContent =
                `Pack ${s.hero.pack.length}/${engine.packCap()} (worth ${engine.packValue()})`;
            document.getElementById('hp-info').textContent = `HP ${s.hero.hp}/${RULES.HERO_HP}`;
            document.getElementById('mp-info').textContent = `MP ${s.mp}/${RULES.HERO_MP}`;
            document.getElementById('world-info').textContent =
                `Turn ${s.turn} · Reckoning ${ROMAN[Math.min(s.reckoning, ROMAN.length - 1)]} · ✸ ${engine.dooms().length}`;

            document.getElementById('harvest-btn').disabled = !engine.canHarvest();
            document.getElementById('bank-btn').disabled = !engine.canBank();
            document.getElementById('craft-btn').disabled = !engine.canCraft();
            document.getElementById('build-btn').disabled = !engine.canBuild();
            document.getElementById('build-btn').textContent = `Build (${engine.monumentCost()})`;
            document.getElementById('sack-btn').disabled = !engine.canSack();

            document.getElementById('hover-info').textContent = this.hoverInfo();
        }

        renderLog() {
            const el = document.getElementById('log');
            el.innerHTML = '';
            for (const entry of this.state.log.slice(-7)) {
                const line = document.createElement('div');
                line.textContent = `T${entry.turn} · ${entry.msg}`;
                el.appendChild(line);
            }
        }

        // ---- Input handling ----
        attach() {
            this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
            this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
            this.canvas.addEventListener('mouseup', e => this.onMouseUp(e));
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
            window.addEventListener('resize', () => this.resize());
            window.addEventListener('keydown', e => this.onKeyDown(e));

            // Twin activators: HUD buttons and hotkeys route through shared functions.
            document.getElementById('harvest-btn').addEventListener('click', () => this.doHarvest());
            document.getElementById('bank-btn').addEventListener('click', () => this.doBank());
            document.getElementById('craft-btn').addEventListener('click', () => this.doCraft());
            document.getElementById('build-btn').addEventListener('click', () => this.doBuild());
            document.getElementById('sack-btn').addEventListener('click', () => this.doSack());
            document.getElementById('skills-btn').addEventListener('click', () => this.toggleSkills());
            document.getElementById('end-turn').addEventListener('click', () => this.primaryAction());
            document.getElementById('new-game').addEventListener('click', () => this.confirmNewWorld());
            document.getElementById('begin-btn').addEventListener('click', () => this.newWorld());
            document.getElementById('continue-btn').addEventListener('click', () => this.dismissOverlay());
            document.getElementById('skills-close').addEventListener('click', () => this.dismissOverlay());
        }

        toggleSkills() {
            if (this.overlay === 'skills') this.dismissOverlay();
            else if (!this.overlay) this.showOverlay('skills');
        }

        confirmNewWorld() {
            if (this.overlay !== 'intro' &&
                !confirm('Abandon this life\'s work and begin a new world?')) return;
            this.newWorld();
        }

        onMouseDown(e) {
            const s = this.state;
            // Right button: begin a camera pan.
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

            if (this.overlay) {
                // Overlay captures & consumes the click; the intro only dismisses
                // forward via its buttons.
                if (this.overlay !== 'intro') this.dismissOverlay();
                return;
            }
            if (s.phase !== 'player') return;

            const hex = this.screenToHex(e.clientX, e.clientY);
            const key = Hex.key(hex.q, hex.r);

            // Select, then act — the handler is a pure lookup against the cached sets.
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
            // An overlay swallows its dismissing key (the intro only dismisses forward
            // via its buttons, so a stray keypress can't skip the choice).
            if (this.overlay && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
                e.preventDefault();
                if (this.overlay !== 'intro') this.dismissOverlay();
                return;
            }
            if (this.overlay) return;
            if (e.key === 'Escape') {
                this.deselect();
                this.render();
                return;
            }
            if (e.key === 'g' || e.key === 'G') { this.doHarvest(); return; }
            if (e.key === 'b' || e.key === 'B') { this.doBank(); return; }
            if (e.key === 'c' || e.key === 'C') { this.doCraft(); return; }
            if (e.key === 'm' || e.key === 'M') { this.doBuild(); return; }
            if (e.key === 't' || e.key === 'T') { this.toggleSkills(); return; }
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.primaryAction();
            }
        }
    }

    return GameUI;
})();
