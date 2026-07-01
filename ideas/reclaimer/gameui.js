// gameui.js — GameUI: canvas rendering, input (the modal-flag stack from UI_CONTROLS),
// the HUD/action-bar/panels, and the animation loop that paces the enemy phase.

// One descriptor per action verb. Targeting set, enabled test, tint, arming and execution all
// key off this single table, so a new verb is one entry here rather than edits smeared across
// armVerb / executeTargeting / verbColor / the action bar / the hotkey handler.
const VERBS = {
    fire:    { label: 'Fire',    hotkey: 'R', color: COLORS.attack,
               hint: 'No alien or nest within blaster range.',
               targets: (e, u) => e.fireTargets(u),
               enabled: (e, u) => e.fireTargets(u).size > 0,
               arm: (ui) => ui.armVerb('fire'),
               perform: (e, ui, key) => ui.fireAt(key) },
    cleanse: { label: 'Cleanse', hotkey: 'C', color: COLORS.cleanse,
               hint: 'Move a unit next to violet corruption, then Cleanse (free).',
               targets: (e, u) => e.cleanseTargets(u),
               enabled: (e, u) => e.cleanseTargets(u).size > 0,
               arm: (ui) => ui.armVerb('cleanse'),
               perform: (e, ui, key) => e.performCleanse(ui.selected, key) },
    build:   { label: 'Build',   hotkey: 'B', color: COLORS.build,
               enabled: (e, u) => e.canAct(u),
               arm: (ui) => ui.toggleBuildPalette(),
               perform: (e, ui, key) => e.performBuild(ui.selected, ui.targeting.structKey, key) },
    gather:  { label: 'Gather',  hotkey: 'G', color: COLORS.gather,
               hint: 'Stand next to a gold-star relic or a damaged structure to Gather.',
               targets: (e, u) => e.gatherTargets(u),
               enabled: (e, u) => e.gatherTargets(u).size > 0,
               arm: (ui) => ui.armVerb('gather'),
               perform: (e, ui, key) => e.performGather(ui.selected, key) },
};
const ACTION_BAR = ['fire', 'cleanse', 'build', 'gather'];

class GameUI {
    constructor(engine, state, canvas) {
        this.engine = engine;
        this.state = state;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // camera (pure render offset — never touches game logic)
        this.panX = 0; this.panY = 0;
        this.dragging = false; this.dragStart = null; this.panStart = null;

        // interaction / modal-flag stack
        this.overlay = 'intro';          // 'intro' | 'gameover' | 'map' | null
        this.targeting = null;           // { verb, valid, structKey }
        this.selected = null;            // colony unit
        this.selection = null;           // { reachable: Map, fire: Map }
        this.buildPalette = false;
        this.landerPanel = false;
        this.hovered = null;
        this.beams = [];                 // transient { from, to, color, until }

        this.animating = false;
        this.bindDom();
        this.bindInput();
        this.resize();
    }

    // ---------------------------------------------------------------- DOM
    bindDom() {
        this.el = {
            materials: document.getElementById('materials'),
            rations: document.getElementById('rations'),
            turn: document.getElementById('turn'),
            threatBar: document.getElementById('threat-bar'),
            colonists: document.getElementById('colonists'),
            breeders: document.getElementById('breeders'),
            landerHp: document.getElementById('lander-hp'),
            log: document.getElementById('log'),
            selected: document.getElementById('selected-info'),
            actionBar: document.getElementById('action-bar'),
            buildPalette: document.getElementById('build-palette'),
            landerPanelEl: document.getElementById('lander-panel'),
            overlayEl: document.getElementById('overlay'),
            overlayText: document.getElementById('overlay-text'),
            overlayBtn: document.getElementById('overlay-btn'),
        };
        document.getElementById('end-turn').addEventListener('click', () => this.endTurn());
        document.getElementById('new-game').addEventListener('click', () => this.newGame());
        this.el.overlayBtn.addEventListener('click', () => this.dismissOverlay());
    }

    newGame() {
        this.engine.initGame();
        this.selected = null; this.selection = null; this.targeting = null;
        this.buildPalette = false; this.landerPanel = false;
        this.overlay = 'intro';
        this.centerOnLander();
        this.refresh();
    }

    // ---------------------------------------------------------------- input
    bindInput() {
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
        window.addEventListener('mouseup', () => { this.dragging = false; });
        window.addEventListener('keydown', e => this.onKey(e));
    }

    onMouseDown(e) {
        if (e.button === 2) { // right — pan (and narrow cancel)
            this.dragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.panStart = { x: this.panX, y: this.panY };
            if (this.targeting) this.cancelTargeting();
            return;
        }
        if (e.button !== 0) return;
        this.onLeftClick(e.clientX, e.clientY);
    }

    onMouseMove(e) {
        if (this.dragging) {
            this.panX = this.panStart.x + (e.clientX - this.dragStart.x);
            this.panY = this.panStart.y + (e.clientY - this.dragStart.y);
            this.render();
            return;
        }
        const h = this.screenToHex(e.clientX, e.clientY);
        const key = h.key();
        if (this.hovered !== key) { this.hovered = key; this.updateHoverReadout(); this.render(); }
    }

    onLeftClick(sx, sy) {
        if (this.animating) return;
        if (this.overlay) { this.dismissOverlay(); return; }
        const hex = this.screenToHex(sx, sy);
        const key = hex.key();

        if (this.targeting) {
            if (this.targeting.valid.has(key)) this.executeTargeting(key);
            else this.cancelTargeting();
            return;
        }
        if (this.state.phase !== 'player' || this.state.gameOver) return;

        if (this.state.isLander(hex.q, hex.r)) { this.openLanderPanel(); return; }

        const unit = this.state.colonyUnitAt(hex.q, hex.r);
        if (unit) { this.selectUnit(unit); return; }

        if (this.selected && this.selection) {
            if (this.selection.fire.has(key)) { this.doFire(key); return; }
            if (this.selection.reachable.has(key)) { this.doMove(key); return; }
        }
        this.deselect();
    }

    onKey(e) {
        const k = e.key.toLowerCase();
        if (e.key === 'Escape') { this.escape(); return; }
        if (k === 'l') { document.getElementById('legend').classList.toggle('hidden'); return; }
        if (this.overlay) return;
        if (k === 'm') { this.toggleMap(); return; }
        if (k === ' ' || e.key === 'Enter') { e.preventDefault(); this.endTurn(); return; }
        if (this.state.phase !== 'player' || this.state.gameOver) return;

        if (this.buildPalette) {
            const entry = STRUCTURE_ORDER.find(sk => STRUCTURES[sk].hotkey === k);
            if (entry) { this.chooseStructure(entry); return; }
        }
        if (!this.selected) return;
        const verb = Object.values(VERBS).find(d => d.hotkey.toLowerCase() === k);
        if (verb) verb.arm(this);
    }

    escape() {
        if (this.overlay && this.overlay !== 'gameover') { this.dismissOverlay(); return; }
        if (this.targeting) { this.cancelTargeting(); return; }
        if (this.buildPalette) { this.buildPalette = false; this.refresh(); return; }
        if (this.landerPanel) { this.landerPanel = false; this.refresh(); return; }
        this.deselect();
    }

    // ---------------------------------------------------------- selection
    selectUnit(unit) {
        this.landerPanel = false; this.buildPalette = false; this.targeting = null;
        this.selected = unit;
        this.selection = { reachable: this.engine.reachable(unit), fire: this.engine.fireTargets(unit) };
        this.refresh();
    }

    deselect() {
        this.selected = null; this.selection = null; this.targeting = null;
        this.buildPalette = false; this.landerPanel = false;
        this.refresh();
    }

    refreshSelection() {
        if (this.selected && this.state.units.includes(this.selected)) {
            this.selection = { reachable: this.engine.reachable(this.selected), fire: this.engine.fireTargets(this.selected) };
        } else { this.selected = null; this.selection = null; }
    }

    // ------------------------------------------------------------- verbs
    doMove(key) {
        this.engine.performMove(this.selected, key, this.selection.reachable);
        this.refreshSelection();
        this.refresh();
    }

    // fire the mutation + beam only (shared by the direct red-hex click and the targeting path)
    fireAt(key) {
        const beam = this.engine.performFire(this.selected, key);
        if (beam) this.addBeam(beam.from, beam.to, '#ff5a3c', 160);
    }

    doFire(key) {
        this.fireAt(key);
        this.refreshSelection();
        this.refresh();
    }

    armVerb(verb) {
        const u = this.selected;
        if (!u) return;
        if (!this.engine.canAct(u)) { this.flashLog(`Your ${u.kind} has already acted this turn.`); return; }
        const valid = VERBS[verb].targets(this.engine, u);
        if (!valid || valid.size === 0) { this.flashLog(VERBS[verb].hint); return; }
        this.buildPalette = false;
        this.targeting = { verb, valid };
        this.refresh();
    }

    toggleBuildPalette() {
        if (!this.selected) return;
        this.buildPalette = !this.buildPalette;
        this.targeting = null;
        this.refresh();
    }

    chooseStructure(structKey) {
        const valid = this.engine.buildTargets(this.selected, structKey);
        if (valid.size === 0) { this.flashLog('No controlled clean ground in reach (or too costly).'); return; }
        this.buildPalette = false;
        this.targeting = { verb: 'build', valid, structKey };
        this.refresh();
    }

    cancelTargeting() { this.targeting = null; this.refresh(); }

    executeTargeting(key) {
        VERBS[this.targeting.verb].perform(this.engine, this, key);
        this.targeting = null;
        this.refreshSelection();
        this.refresh();
    }

    // ------------------------------------------------------- lander panel
    openLanderPanel() { this.deselect(); this.landerPanel = true; this.refresh(); }
    doAwaken() { if (this.engine.performAwaken()) this.refresh(); else this.refresh(); }

    // -------------------------------------------------------- turn / enemy
    endTurn() {
        if (this.animating || this.overlay || this.state.gameOver) return;
        if (this.state.phase !== 'player') return;
        this.deselect();
        this.animating = true;
        this.engine.beginEnemyPhase();
        this.stepEnemy();
    }

    stepEnemy() {
        const ev = this.engine.enemyStep();
        // visuals for this step
        if (ev.type === 'defense') for (const f of ev.flashes) this.addBeam(f.from, f.to, '#7fd0ff', 400);
        if (ev.type === 'hop' && ev.action === 'kill') this.addBeam(ev.at, ev.at, '#ff2020', 400);
        this.render();
        this.updateHud();

        if (ev.type === 'done') {
            this.engine.finishEnemyPhase();
            this.animating = false;
            if (this.state.gameOver) this.showGameOver();
            this.refresh();
            return;
        }
        const delay = ev.type === 'hop' ? 150 : 110;
        setTimeout(() => this.stepEnemy(), delay);
    }

    // --------------------------------------------------------- overlays
    dismissOverlay() {
        if (this.overlay === 'gameover') { this.newGame(); return; }
        this.overlay = null; this.refresh();
    }
    toggleMap() { this.overlay = this.overlay === 'map' ? null : 'map'; this.refresh(); }
    showGameOver() { this.overlay = 'gameover'; this.refresh(); }

    // --------------------------------------------------------- effects
    addBeam(from, to, color, ms) {
        this.beams.push({ from, to, color, until: Date.now() + ms });
        setTimeout(() => this.render(), ms + 20);
    }
    flashLog(msg) { this.state.log = msg; this.updateHud(); }

    // ========================================================== rendering
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (!this._centered && this.state.lander) { this.centerOnLander(); this._centered = true; }
        this.render();
    }

    centerOnLander() {
        const p = new Hex(this.state.lander.q, this.state.lander.r).toPixel();
        this.panX = this.canvas.width / 2 - p.x;
        this.panY = this.canvas.height / 2 - p.y;
    }

    hexToScreen(q, r) { const p = new Hex(q, r).toPixel(); return { x: p.x + this.panX, y: p.y + this.panY }; }
    screenToHex(sx, sy) { return Hex.fromPixel(sx - this.panX, sy - this.panY); }

    refresh() { this.render(); this.updateHud(); }

    render() {
        const ctx = this.ctx, s = this.state;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#0a0a10';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.overlay === 'map') { this.renderOverview(); return; }

        const margin = HEX_SIZE * 2;
        for (const h of s.hexes.values()) {
            const p = this.hexToScreen(h.q, h.r);
            if (p.x < -margin || p.x > this.canvas.width + margin || p.y < -margin || p.y > this.canvas.height + margin) continue;
            this.drawHex(h, p);
        }
        // highlight sets
        if (this.targeting) this.drawSet(this.targeting.valid, VERBS[this.targeting.verb].color);
        else if (this.buildPalette && this.selected) this.drawSet(this.engine.buildableGround(this.selected), COLORS.build);
        else if (this.selection) {
            this.drawSet(this.selection.reachable, COLORS.reachable);
            this.drawSet(this.selection.fire, COLORS.attack);
        }
        // structures, deposits, breeders
        for (const h of s.hexes.values()) {
            if (!s.isRevealed(h.q, h.r)) continue;
            const p = this.hexToScreen(h.q, h.r);
            if (h.breederHp > 0) this.drawBreeder(h, p);
            if (h.structure) this.drawStructure(h, p);
            else if (h.deposit) this.drawDeposit(h, p);
        }
        // lander + units + aliens
        this.drawLander();
        for (const u of s.units) this.drawUnit(u);
        for (const a of s.aliens) if (s.isRevealed(a.q, a.r)) this.drawAlien(a); // enemies hidden in fog
        if (this.selected) this.strokeHex(this.hexToScreen(this.selected.q, this.selected.r), COLORS.selectEdge, 3);
        this.drawBeams();
    }

    // Darkened landscape tone for unexplored fog (cached per terrain).
    mutedTerrain(terrain) {
        if (!this._fogCache) this._fogCache = {};
        if (this._fogCache[terrain]) return this._fogCache[terrain];
        const n = parseInt(TERRAIN_COLORS[terrain].slice(1), 16);
        const d = c => Math.round(c * 0.30);
        return this._fogCache[terrain] = `rgb(${d((n >> 16) & 255)},${d((n >> 8) & 255)},${d(n & 255)})`;
    }

    drawHex(h, p) {
        const ctx = this.ctx, s = this.state;
        if (!s.isRevealed(h.q, h.r)) {
            // fog: the landscape shape shows through darkened, but nothing on it (items/blight/units)
            drawHexPath(ctx, p.x, p.y, HEX_SIZE); ctx.fillStyle = this.mutedTerrain(h.terrain); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
            return;
        }
        drawHexPath(ctx, p.x, p.y, HEX_SIZE);
        ctx.fillStyle = TERRAIN_COLORS[h.terrain]; ctx.fill();
        if (h.corruption > 0) { drawHexPath(ctx, p.x, p.y, HEX_SIZE); ctx.fillStyle = COLORS.corruption[h.corruption - 1]; ctx.fill(); }
        if (s.isControlled(h.q, h.r)) {
            drawHexPath(ctx, p.x, p.y, HEX_SIZE); ctx.fillStyle = COLORS.controlFill; ctx.fill();
            ctx.strokeStyle = COLORS.controlEdge; ctx.lineWidth = 1.5; ctx.stroke();
        } else {
            ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
        }
    }

    drawSet(set, color) {
        const ctx = this.ctx;
        for (const key of set.keys()) {
            const h = Hex.fromKey(key);
            const p = this.hexToScreen(h.q, h.r);
            drawHexPath(ctx, p.x, p.y, HEX_SIZE); ctx.fillStyle = color; ctx.fill();
        }
    }

    strokeHex(p, color, w) { const ctx = this.ctx; drawHexPath(ctx, p.x, p.y, HEX_SIZE); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); }

    drawCounter(p, size, fill, glyph, glyphColor) {
        const ctx = this.ctx, half = size / 2, x = p.x - half, y = p.y - half, r = 5;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + size, y, x + size, y + size, r);
        ctx.arcTo(x + size, y + size, x, y + size, r);
        ctx.arcTo(x, y + size, x, y, r);
        ctx.arcTo(x, y, x + size, y, r);
        ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = 'rgba(120,120,120,0.9)'; ctx.beginPath();
        ctx.moveTo(x, y + size + 1.5); ctx.lineTo(x + size, y + size + 1.5);
        ctx.moveTo(x + size + 1.5, y); ctx.lineTo(x + size + 1.5, y + size); ctx.stroke();
        if (glyph) { ctx.fillStyle = glyphColor; ctx.font = `bold ${Math.floor(size * 0.6)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, p.x, p.y + 1); }
    }

    drawHpBar(p, size, frac, color) {
        const ctx = this.ctx, w = size, x = p.x - size / 2, y = p.y - size / 2 - 5;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, 3);
        ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), 3);
    }

    drawUnit(u) {
        const p = this.hexToScreen(u.q, u.r);
        const glyph = u.kind === 'captain' ? '@' : 'c';
        this.drawCounter(p, COUNTER_SIZE, u.kind === 'captain' ? CAPTAIN_COLOR : COLONIST_COLOR, glyph, '#111');
        this.drawHpBar(p, COUNTER_SIZE, u.hp / u.maxHp, '#4caf50');
        // silver dot = still has its action this turn. Cleared by acting (fire/cleanse/build/
        // gather), NOT by moving. A groggy just-woken colonist spawns 'acted', so shows none.
        if (this.engine.canAct(u)) {
            const ctx = this.ctx;
            ctx.beginPath(); ctx.arc(p.x, p.y - COUNTER_SIZE / 2 + 5, 3.6, 0, Math.PI * 2);
            ctx.fillStyle = '#e2e6ec'; ctx.fill();
        }
    }

    drawAlien(a) {
        const p = this.hexToScreen(a.q, a.r);
        this.drawCounter(p, COUNTER_SIZE - 2, ALIEN_COLORS[a.kind] || '#c33', RECLAIMER.aliens[a.kind].glyph, '#fff');
        this.drawHpBar(p, COUNTER_SIZE - 2, a.hp / a.maxHp, '#ff8a7a');
    }

    drawLander() {
        const s = this.state, p = this.hexToScreen(s.lander.q, s.lander.r);
        this.drawCounter(p, COUNTER_SIZE + 6, LANDER_COLOR, '#', '#123');
        this.drawHpBar(p, COUNTER_SIZE + 6, s.lander.hp / s.lander.maxHp, '#66aaff');
    }

    drawStructure(h, p) {
        const def = STRUCTURES[h.structure.type];
        this.drawCounter(p, COUNTER_SIZE - 4, '#3a4a5a', def.glyph, '#cfe');
        this.drawHpBar(p, COUNTER_SIZE - 4, h.structure.hp / def.hp, '#88ccff');
    }

    drawBreeder(h, p) {
        const ctx = this.ctx;
        drawHexPath(ctx, p.x, p.y, HEX_SIZE - 2); ctx.strokeStyle = COLORS.node; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = COLORS.node; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        this.drawHpBar(p, HEX_SIZE, h.breederHp / RECLAIMER.breederHp, '#e040e0');
    }

    drawDeposit(h, p) {
        const ctx = this.ctx;
        const color = h.deposit === DEPOSIT.MINERALS ? '#e8e8f2' : h.deposit === DEPOSIT.BIOMASS ? '#a7f078' : '#ffd24a';
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.fillStyle = color;
        if (h.deposit === DEPOSIT.RELIC) { this.star(p.x, p.y, 7, 3.4); ctx.stroke(); }
        else {
            ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(h.deposit === DEPOSIT.MINERALS ? 'M' : 'B', p.x, p.y + 0.5);
        }
    }

    star(cx, cy, outer, inner) {
        const ctx = this.ctx; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const rad = i % 2 === 0 ? outer : inner; const a = Math.PI / 5 * i - Math.PI / 2; ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a)); }
        ctx.closePath(); ctx.fill();
    }

    drawBeams() {
        const ctx = this.ctx, now = Date.now();
        this.beams = this.beams.filter(b => b.until > now);
        for (const b of this.beams) {
            const f = this.hexToScreen(b.from.q, b.from.r), t = this.hexToScreen(b.to.q, b.to.r);
            ctx.strokeStyle = b.color; ctx.lineWidth = 2.5;
            if (b.from.q === b.to.q && b.from.r === b.to.r) { drawHexPath(ctx, t.x, t.y, HEX_SIZE); ctx.stroke(); }
            else { ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.stroke(); }
        }
    }

    renderOverview() {
        const ctx = this.ctx, s = this.state;
        const cell = 12, ox = 40, oy = 80;
        ctx.fillStyle = '#eee'; ctx.font = '16px monospace'; ctx.textAlign = 'left';
        ctx.fillText('OVERVIEW — corruption (violet) · your ground (silver) · nests (red) · press M to close', ox, 50);
        for (const h of s.hexes.values()) {
            const x = ox + h.col * cell, y = oy + h.row * cell;
            if (!s.isRevealed(h.q, h.r)) { ctx.fillStyle = '#14141c'; }
            else if (h.breederHp > 0) { ctx.fillStyle = '#ff5027'; }
            else if (s.isControlled(h.q, h.r)) { ctx.fillStyle = '#cdd2da'; }
            else if (h.corruption > 0) { ctx.fillStyle = COLORS.corruption[h.corruption - 1]; }
            else if (MOVEMENT_COST[h.terrain] === Infinity) { ctx.fillStyle = '#223'; }
            else { ctx.fillStyle = '#3a4a2a'; }
            ctx.fillRect(x, y, cell - 1, cell - 1);
        }
        const lp = { x: ox + this.state.lander.col * cell, y: oy + this.state.lander.row * cell };
        ctx.fillStyle = '#cfe'; ctx.fillRect(lp.x - 1, lp.y - 1, cell + 1, cell + 1);
    }

    // ============================================================= HUD
    updateHud() {
        const s = this.state, e = this.el;
        const prod = this.engine.production();
        const ratNet = prod.rations - s.upkeep();
        e.materials.textContent = `⛏ ${s.materials} (+${prod.materials})`;
        e.rations.textContent = `🍞 ${s.rations} (${ratNet >= 0 ? '+' : ''}${ratNet})`;
        e.turn.textContent = `Turn ${s.turn}` + (s.phase === 'enemy' ? ' — swarm' : '');
        e.threatBar.style.width = clamp(s.threat() / 50, 0, 1) * 100 + '%';
        e.colonists.textContent = `Colonists ${s.colonistsAwake()} awake · ${s.frozen} frozen`;
        e.breeders.textContent = `Breeders ${s.breedersRemaining()}/${RECLAIMER.breederNodes}`;
        e.landerHp.style.width = clamp(s.lander.hp / s.lander.maxHp, 0, 1) * 100 + '%';
        e.log.textContent = s.log;

        this.updateHoverReadout();
        this.updateSelectedPanel();
        this.updateBuildPalette();
        this.updateLanderPanel();
        this.updateOverlay();
    }

    updateHoverReadout() {
        const el = document.getElementById('hover-info');
        if (!this.hovered) { el.textContent = ''; return; }
        const [q, r] = this.hovered.split(',').map(Number);
        const h = this.state.hex(q, r);
        if (!h || !this.state.isRevealed(q, r)) { el.textContent = 'unexplored'; return; }
        const parts = [TERRAIN_NAMES[h.terrain]];
        if (h.corruption > 0) parts.push(`corruption ${h.corruption}`);
        if (h.breederHp > 0) parts.push('NODE');
        parts.push(this.state.isControlled(q, r) ? 'controlled' : 'wild');
        if (h.deposit) parts.push(DEPOSIT_NAMES[h.deposit]);
        if (h.structure) parts.push(STRUCTURES[h.structure.type].name);
        el.textContent = parts.join(' · ');
    }

    updateSelectedPanel() {
        const u = this.selected, e = this.el;
        if (!u) { e.selected.textContent = 'No unit selected — click the Lander (#) to wake colonists, or a counter to act.'; e.actionBar.innerHTML = ''; return; }
        const name = u.kind === 'captain' ? 'Captain' : 'Colonist';
        const act = this.engine.canAct(u) ? 'action ready' : 'acted ✓';
        e.selected.textContent = `▸ ${name}  hp ${u.hp}/${u.maxHp}  mp ${u.mp}  ${act}` + (u.weapon ? `  blaster r${u.weapon.range}/d${u.weapon.dmg}` : '');
        e.actionBar.innerHTML = '';
        for (const v of ACTION_BAR) {
            const d = VERBS[v];
            const on = d.enabled(this.engine, u);
            const b = document.createElement('button');
            b.textContent = `[${d.hotkey}] ${d.label}`;
            b.className = 'verb' + (on ? '' : ' off') + (this.targeting && this.targeting.verb === v ? ' armed' : '');
            if (on) b.addEventListener('click', () => d.arm(this)); else b.disabled = true;
            e.actionBar.appendChild(b);
        }
    }

    updateBuildPalette() {
        const e = this.el.buildPalette;
        if (!this.buildPalette || !this.selected) { e.classList.add('hidden'); return; }
        e.classList.remove('hidden');
        const u = this.selected;
        const acted = !this.engine.canAct(u);
        const hasGround = this.engine.buildableGround(u).size > 0;
        e.innerHTML = '<div class="palette-title">Build — you have ⛏ ' + this.state.materials + ' materials</div>'
            + '<div class="panel-line">Pick a structure, then click a <b style="color:#7fb0ff">blue</b> hex — your controlled (green) clean ground, next to this unit.'
            + (acted ? ' <b style="color:#e88">This unit already acted this turn.</b>' : hasGround ? '' : ' <b style="color:#e88">No buildable ground next to this unit — move onto your green territory.</b>')
            + '</div>';
        for (const sk of STRUCTURE_ORDER) {
            const def = STRUCTURES[sk];
            const can = this.engine.buildTargets(u, sk).size > 0;
            // explain a greyed button: affordability vs. placement vs. already-acted
            let why = '';
            if (!can) {
                if (acted) why = 'acted';
                else if (this.state.materials < def.cost) why = `need ${def.cost} ⛏ (have ${this.state.materials})`;
                else if (def.needs) why = `no adjacent ${DEPOSIT_NAMES[def.needs]}`;
                else why = 'no clean spot adjacent';
            }
            const b = document.createElement('button');
            b.className = 'verb' + (can ? '' : ' off');
            b.textContent = `[${def.hotkey}] ${def.name} (${def.cost} ⛏${def.needs ? ', ' + DEPOSIT_NAMES[def.needs] : ''})` + (why ? ` — ${why}` : '');
            if (can) b.addEventListener('click', () => this.chooseStructure(sk)); else b.disabled = true;
            e.appendChild(b);
        }
    }

    updateLanderPanel() {
        const e = this.el.landerPanelEl;
        if (!this.landerPanel) { e.classList.add('hidden'); return; }
        e.classList.remove('hidden');
        const s = this.state;
        e.innerHTML = `<div class="palette-title">Lander  hp ${s.lander.hp}/${s.lander.maxHp}</div>
            <div class="panel-line">${s.frozen} colonists frozen · ${s.rations} rations</div>`;
        const wake = document.createElement('button');
        wake.className = 'verb' + (this.engine.canAwaken() ? '' : ' off');
        wake.textContent = `Awaken colonist (${RECLAIMER.awakenCost} rations)`;
        if (this.engine.canAwaken()) wake.addEventListener('click', () => this.doAwaken()); else wake.disabled = true;
        e.appendChild(wake);
        const close = document.createElement('button');
        close.className = 'verb'; close.textContent = 'Close';
        close.addEventListener('click', () => { this.landerPanel = false; this.refresh(); });
        e.appendChild(close);
    }

    updateOverlay() {
        const e = this.el;
        if (!this.overlay || this.overlay === 'map') { e.overlayEl.classList.add('hidden'); return; }
        e.overlayEl.classList.remove('hidden');
        if (this.overlay === 'intro') {
            e.overlayText.innerHTML = '<h1>RECLAIMER</h1><p>Your evac ship crash-landed on a blighted world. Cleanse the corruption, ' +
                'build your settlement, wake your colonists, and destroy every alien nest.</p>' +
                '<p><b>Win:</b> all Breeders destroyed <i>and</i> all colonists awake. <b>Lose:</b> the Lander falls.</p>' +
                '<p>Click a unit → move (yellow) or fire (red). [C]leanse · [B]uild · [G]ather · click the Lander (#) to wake colonists. Space ends the turn. M = overview.</p>';
            e.overlayBtn.textContent = 'Land';
        } else if (this.overlay === 'gameover') {
            const win = this.state.gameOver === 'win';
            e.overlayText.innerHTML = `<h1>${win ? 'PLANET RECLAIMED' : 'COLONY LOST'}</h1><p>${this.state.log}</p><p>Survived to turn ${this.state.turn}.</p>`;
            e.overlayBtn.textContent = 'New Game';
        }
    }
}

// ================================================================ bootstrap
window.addEventListener('DOMContentLoaded', () => {
    const state = new GameState();
    const engine = new GameEngine(state);
    engine.initGame();
    const ui = new GameUI(engine, state, document.getElementById('game'));
    ui.centerOnLander();
    ui.refresh();
});
