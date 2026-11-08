// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering, the DOM HUD, the boot/title/end
// overlays, the animated regime phase, camera/pan, and all input wiring. It owns the
// *view and interaction* state (pan, hover, selection, overlays, animation) — none of it
// game state — and drives GameEngine by calling commands, then animating the events they
// return and re-rendering from GameState.
//
// The input dispatch mirrors UI_CONTROLS.md; layer citations (L1.2, L2.1, …) are kept.
const GameUI = (function () {
    const {
        HEX_SIZE, COUNTER_SIZE, TERRAIN_COLORS, TERRAIN_NAMES, AWAKE_COLOR, ARCOLOGY_EDGE,
        PLAYER_COLOR, RIG_COLOR, SWEEPER_COLORS, SWEEPER_INK, MINISTRY_COLOR, PRECINCT_COLOR,
        JAM_TINT, REACH_TINT, PREVIEW_TINT, FADE_TINT, BG_COLOR, UI_FONT, HOP_MS, FLASH_MS, EGA,
        TARGET_LINE
    } = GameDisplayArtifacts;
    const { TERRAIN, PLAYER_MP, PLANT_MP, TX_RANGE, TX_RANGE_MAX, WIN_FRAC } = GameArtifacts;

    // A left press that stays within this many pixels is a click (select/move);
    // moving past it turns the gesture into a camera pan.
    const DRAG_THRESHOLD = 4;
    const LOG_LINES = 7;

    const BOOT_SCRIPT = [
        'BITROT-DOS Version 3.31',
        '(C) Copyright BitRot Softworks 1981-1987',
        '',
        'A:\\>RFS9',
        'Loading RFS9.EXE ',
        '...........',
        ' 412K OK',
        'Reading SECTOR9.MAP ...... OK',
        'Initializing EGA 640x350 16 colors ... OK',
        '',
        'COPY PROTECTION CHECK',
        'Enter word 4, line 2, page 11 of your manual:',
        '> SLEEPERS',
        'Thank you. This disk is genuine. Probably.',
    ];

    const pad2 = n => String(n).padStart(2, '0');
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 'S'}`;

    // A fresh game's seed. Rolling it is the client's job, so the engine stays deterministic.
    const randomSeed = () => Math.floor(Math.random() * 0x100000000);

    // The log line each event type writes, as [text, css class]; types not listed write none.
    const EVENT_LOG = {
        woke: (ui, e) => [`>> ${plural(e.keys.length, 'BLOCK')} WAKE UP`, 'log-wake'],
        faded: (ui, e) => [`>> ${plural(e.keys.length, 'BLOCK')} DRIFT BACK TO SLEEP`, 'log-fade'],
        smashed: (ui, e) => [`>> ${ui.state.rigs[e.rig].name} SMASHED by ${ui.sweeperName(e.by)}`, 'log-bad'],
        spawned: (ui, e) => [`>> ALERT: ${ui.sweeperName(e.id)} deployed`, 'log-alert'],
        recalled: (ui, e) => [`>> SWEEPER #${e.id} recalled`, ''],
        captured: (ui, e) => [`>> ARRESTED by ${ui.sweeperName(e.by)}`, 'log-bad'],
    };

    // The end card for each outcome: its title, css class, and body text. `end` carries the
    // facts every card may quote — { s, pct, alive, events }.
    const END_CARDS = {
        won: (ui, { s, pct, alive }) => ({
            title: 'THE CITY WAKES', cls: 'won',
            body: 'At 0400 every state screen in Sector 9 goes dark.\n' +
                'At 0402 they show your face, and the crowd cheers.\n\n' +
                `TURN ${s.turn}  ·  ${pct}% AWAKE  ·  RIGS SURVIVING ${alive.length}/${s.rigs.length}\n` +
                (alive.length ? `Still on air: ${alive.map(r => r.name).join(', ')}` : ''),
        }),
        captured: (ui, { s, pct, alive, events }) => {
            const cap = events.find(e => e.type === 'captured');
            const hex = s.hexes.get(s.player.key());
            return {
                title: 'ARRESTED', cls: 'lost',
                body: `${ui.sweeperName(cap.by)} found you in the ${TERRAIN_NAMES[hex.terrain].toLowerCase()}.\n` +
                    'Re-education begins at 0600.\n\n' +
                    `...but ${pct}% of the city is still humming your songs.\n` +
                    `TURN ${s.turn}  ·  RIGS SURVIVING ${alive.length}/${s.rigs.length}`,
            };
        },
        deadair: (ui, { s, pct, events }) => {
            const last = [...events].reverse().find(e => e.type === 'smashed');
            return {
                title: 'DEAD AIR', cls: 'lost',
                body: `${last ? s.rigs[last.rig].name : 'Your last rig'} was the last transmitter.\n` +
                    'Static. Then the anthem. Then nothing.\n\n' +
                    `TURN ${s.turn}  ·  ${pct}% AWAKE AT THE END`,
            };
        },
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
            this.dragCandidate = false;
            this.panStartX = 0;
            this.panStartY = 0;
            this.panOrigX = 0;
            this.panOrigY = 0;

            // ---- Input-layer state (see UI_CONTROLS.md) ----
            //   overlay (top) → animating → targeting → selection (bottom).
            this.selection = null;   // L1.2 { reachable: Map<key,cost>, attackable: Set<key> }
            this.targeting = null;   // L4 scaffold; always null in this game
            this.overlay = null;     // L5 'insert' | 'boot' | 'title' | 'end' | null
            this.hoveredHex = null;  // L1.3 hex under the cursor
            this.anim = null;        // regime-phase playback { t0, events, ... } or null
            this.log = [];           // newest first
            this.bootTimer = null;
        }

        // ---- Lifecycle ----
        start() {
            this.attach();
            this.canvas.width = window.innerWidth;    // size first, so centerOn sees the real viewport
            this.canvas.height = window.innerHeight;
            this.engine.newGame(randomSeed());
            this.resetView();
            this.showOverlay('insert');
            this.render();
        }

        newGame() {
            this.engine.newGame(randomSeed());
            this.resetView();
            this.showOverlay('title');
            this.render();
        }

        resetView() {
            this.selection = null;
            this.targeting = null;
            this.hoveredHex = null;
            this.anim = null;
            this.log = [];
            this.addLog(`-- SECTOR 9 · SEED ${this.state.seed} --`, '');
            this.addLog('>> All quiet. The city sleeps.', '');
            this.centerOn(this.state.player);
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

        busy() {
            return !!this.overlay || !!this.anim || this.state.phase !== 'player' || this.engine.isOver();
        }

        // ---- Commands → outcome handling ----
        commitMove(q, r) {
            const res = this.engine.movePlayer(q, r);
            if (!res.ok) { this.render(); return; }
            this.afterCommand(res, () => this.sound.step());
        }

        plant() {
            if (this.busy()) return;
            const res = this.engine.plant();
            if (!res.ok) return;
            const rig = this.state.rigs[res.rig];
            this.addLog(`>> ${rig.name} ON AIR at ${rig.q},${rig.r}`, 'log-wake');
            this.afterCommand(res, () => this.sound.plant());
        }

        retrieve() {
            if (this.busy()) return;
            const res = this.engine.retrieve();
            if (!res.ok) return;
            this.addLog(`>> ${this.state.rigs[res.rig].name} packed away`, '');
            this.afterCommand(res, () => this.sound.retrieve());
        }

        // L1.4: a command that spent the last MP carries the turn's events — animate them.
        afterCommand(res, cue) {
            if (res.endedTurn) { this.deselect(); this.playTurn(res); return; }
            cue();
            if (this.selection) this.selectPlayer();   // turn continues: recompute from the new state
            this.render();
        }

        // ---- L2.1 One context-sensitive primary action (End Turn button + Space/Enter) ----
        primaryAction() {
            if (this.busy()) return;
            const loc = this.engine.locationAt(this.state.player);
            if (loc) {
                // openLocation(loc) — no interactive locations in this game
            } else {
                const res = this.engine.endTurn();
                if (!res.ok) return;
                this.deselect();
                this.playTurn(res);
            }
        }

        // ---- The animated broadcast + regime phase ----
        // State is already final; playback overrides Sweeper positions along their walked
        // paths and flashes what woke, then logs and resolves the outcome.
        playTurn(res) {
            const events = res.events;
            const paths = new Map();
            let hops = 0;
            for (const e of events) if (e.type === 'moved') {
                paths.set(e.id, e.path);
                hops = Math.max(hops, e.path.length - 1);
            }
            const woke = new Set(events.filter(e => e.type === 'woke').flatMap(e => e.keys));
            const faded = new Set(events.filter(e => e.type === 'faded').flatMap(e => e.keys));
            const spawned = new Set(events.filter(e => e.type === 'spawned').map(e => e.id));
            this.anim = {
                t0: performance.now(), events, paths, woke, faded, spawned,
                duration: FLASH_MS + hops * HOP_MS + 250, res
            };
            this.sound.endTurn();
            if (woke.size >= faded.size && woke.size > 0) setTimeout(() => this.sound.wake(woke.size), 140);
            else if (faded.size > 0) setTimeout(() => this.sound.fade(faded.size), 140);
            const tick = () => {
                if (!this.anim) return;
                if (performance.now() - this.anim.t0 >= this.anim.duration) { this.finishTurn(); return; }
                this.render();
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }

        finishTurn() {
            const { events, res } = this.anim;
            this.anim = null;
            this.logEvents(events);
            const has = t => events.some(e => e.type === t);
            if (has('captured') || has('deadair')) this.sound.defeat();
            else if (has('won')) this.sound.victory();
            else if (has('smashed')) this.sound.smash();
            else if (has('spawned')) this.sound.alarm();
            if (res.outcome) this.showEnd(res.outcome, events);
            else this.addLog(`-- TURN ${pad2(this.state.turn)} --`, '');
            this.render();
        }

        sweeperName(id) {
            const sw = this.state.sweepers.find(w => w.id === id);
            return sw ? `${sw.kind} #${id}` : `SWEEPER #${id}`;
        }

        logEvents(events) {
            for (const e of events.filter(e => EVENT_LOG[e.type])) this.addLog(...EVENT_LOG[e.type](this, e));
        }

        addLog(text, cls) {
            this.log.unshift({ text, cls });
            this.log.length = Math.min(this.log.length, LOG_LINES);
            const ul = document.getElementById('log-list');
            if (!ul) return;
            ul.innerHTML = '';
            for (const line of this.log) {
                const li = document.createElement('li');
                li.textContent = line.text;
                li.className = line.cls;
                ul.appendChild(li);
            }
        }

        // ---- L4 Modal targeting (scaffold) ----
        cancelTargeting() {
            this.targeting = null;
        }

        // ---- L5 Overlays: insert disk → boot → title → play; end card ----
        showOverlay(name) {
            this.overlay = name;
            const boot = document.getElementById('boot');
            boot.classList.toggle('hidden', !['insert', 'boot', 'title'].includes(name));
            document.getElementById('title-card').classList.toggle('hidden', name !== 'title');
            document.getElementById('boot-text').classList.toggle('hidden', name === 'title');
            document.getElementById('endcard').classList.toggle('hidden', name !== 'end');
            if (name === 'insert') {
                document.getElementById('boot-text').textContent =
                    'INSERT DISK 1 IN DRIVE A:\nAND PRESS ANY KEY WHEN READY_';
            }
            this.updateButtons();
        }

        // The overlay's dismissing input is consumed here and never reaches the map.
        dismissOverlay() {
            const o = this.overlay;
            if (o === 'insert') { this.runBoot(); return; }
            if (o === 'boot') { this.finishBoot(); return; }
            if (o === 'title') this.sound.fanfare();
            this.overlay = null;
            this.showOverlay(null);
            this.render();
        }

        runBoot() {
            this.showOverlay('boot');
            this.sound.drive();   // first user gesture: the AudioContext may open now
            const el = document.getElementById('boot-text');
            el.textContent = '';
            let line = 0;
            this.bootTimer = setInterval(() => {
                if (line >= BOOT_SCRIPT.length) { this.finishBoot(); return; }
                const txt = BOOT_SCRIPT[line++];
                // "Loading" lines run on without a newline, like a progress trail.
                const runOn = txt.startsWith('Loading') || txt.startsWith('...');
                el.textContent += txt + (runOn ? '' : '\n');
                if (txt.startsWith('...') || txt.startsWith('Reading')) this.sound.drive();
            }, 190);
        }

        finishBoot() {
            clearInterval(this.bootTimer);
            this.bootTimer = null;
            this.showOverlay('title');
        }

        showEnd(outcome, events) {
            const s = this.state;
            const pct = Math.round(100 * this.engine.awakeCount() / this.engine.blockCount());
            const alive = s.rigs.filter(r => r.status !== 'smashed');
            const card = END_CARDS[outcome](this, { s, pct, alive, events });
            const title = document.getElementById('end-title');
            title.className = card.cls;
            title.textContent = card.title;
            document.getElementById('end-body').textContent = card.body;
            this.showOverlay('end');
        }

        // ---- Rendering ----
        // One frame, bottom layer first. `t` is ms into playback (Infinity when idle).
        render() {
            const s = this.state;
            if (!s.hexes) return;
            const t = this.anim ? performance.now() - this.anim.t0 : Infinity;
            this.ctx.fillStyle = BG_COLOR;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.drawTerrain(t);
            if (!this.anim) this.tintHexes(this.engine.jammedKeys(), JAM_TINT);   // at final Sweeper positions
            this.drawRigRanges();
            if (this.selection) this.tintHexes(this.selection.reachable.keys(), REACH_TINT);   // L1.2
            this.tintHexes(this.previewKeys().map(h => Hex.key(h.q, h.r)), PREVIEW_TINT);      // plant preview
            this.tintHexes(this.pullPreview().map(h => Hex.key(h.q, h.r)), FADE_TINT);         // pull preview
            if (!this.anim) this.drawTargetLines();
            this.drawStations();
            for (const rig of this.engine.plantedRigs()) {
                const { x, y } = this.hexToScreen(rig.q, rig.r);
                this.drawCounter(x, y, RIG_COLOR, rig.label, EGA.black, COUNTER_SIZE);
            }
            this.drawSweepers(t);
            this.drawPlayer();
            if (this.anim && t > this.anim.duration - 250) this.drawSmashBursts();
            this.updateHUD();
        }

        // Is screen point (x, y) close enough to the viewport to be worth drawing?
        onScreen(x, y) {
            const m = HEX_SIZE * 2;
            return x > -m && x < this.canvas.width + m && y > -m && y < this.canvas.height + m;
        }

        // Fill each hex in `keys` (an iterable of "q,r") with `tint`.
        tintHexes(keys, tint) {
            const ctx = this.ctx;
            for (const k of keys) {
                const { q, r } = Hex.fromKey(k);
                const { x, y } = this.hexToScreen(q, r);
                if (!this.onScreen(x, y)) continue;
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = tint;
                ctx.fill();
            }
        }

        // Terrain, with awake blocks in magenta. Fresh wakes flash white, fresh fades black.
        drawTerrain(t) {
            const ctx = this.ctx;
            const flashing = this.anim && t < FLASH_MS;
            const blink = Math.floor(t / 80) % 2;
            for (const [key, hex] of this.state.hexes) {
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                if (!this.onScreen(x, y)) continue;
                drawHexPath(ctx, x, y, HEX_SIZE);
                let color = hex.awake ? AWAKE_COLOR : TERRAIN_COLORS[hex.terrain];
                if (flashing && this.anim.woke.has(key)) color = blink ? EGA.white : AWAKE_COLOR;
                if (flashing && this.anim.faded.has(key)) color = blink ? EGA.black : AWAKE_COLOR;
                ctx.fillStyle = color;
                ctx.fill();
                const arcology = hex.terrain === TERRAIN.ARCOLOGY;
                ctx.strokeStyle = arcology ? ARCOLOGY_EDGE : 'rgba(0, 0, 0, 0.55)';
                ctx.lineWidth = arcology ? 2 : 1;
                ctx.stroke();
            }
        }

        // Rig broadcast range: a dashed cyan outline on every hex in the rig's current range
        // (it widens each unjammed broadcast, up to TX_RANGE_MAX).
        drawRigRanges() {
            const ctx = this.ctx;
            ctx.save();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(85, 255, 255, 0.55)';
            ctx.lineWidth = 1;
            for (const rig of this.engine.plantedRigs()) {
                for (const h of this.engine.board.within(rig.q, rig.r, this.engine.rigRange(rig))) {
                    const { x, y } = this.hexToScreen(h.q, h.r);
                    if (!this.onScreen(x, y)) continue;
                    drawHexPath(ctx, x, y, HEX_SIZE - 3);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }

        drawStations() {
            const s = this.state;
            for (const st of s.stations) {
                const { x, y } = this.hexToScreen(st.q, st.r);
                const ministry = st === s.stations[0];
                this.drawCounter(x, y, ministry ? MINISTRY_COLOR : PRECINCT_COLOR, st.label,
                    ministry ? EGA.red : EGA.white, ministry ? COUNTER_SIZE + 6 : COUNTER_SIZE);
            }
        }

        // Sweepers — at animated positions during playback; fresh spawns appear at the end.
        drawSweepers(t) {
            for (const sw of this.state.sweepers) {
                if (this.anim && this.anim.spawned.has(sw.id) && t < this.anim.duration - 250) continue;
                const { q, r } = this.sweeperShownAt(sw, t);
                const { x, y } = this.hexToScreen(q, r);
                if (!this.onScreen(x, y)) continue;
                this.drawCounter(x, y, SWEEPER_COLORS[sw.kind], sw.label, SWEEPER_INK[sw.kind], COUNTER_SIZE);
            }
        }

        // Where a Sweeper is drawn: along its walked path during playback, else where it stands.
        sweeperShownAt(sw, t) {
            const path = this.anim && this.anim.paths.get(sw.id);
            if (!path) return { q: sw.q, r: sw.r };
            const hop = Math.max(0, Math.min(path.length - 1, Math.floor((t - FLASH_MS) / HOP_MS)));
            return Hex.fromKey(path[hop]);
        }

        // The operator: a magenta ring when sheltered by the crowd, a white box when selected.
        drawPlayer() {
            const ctx = this.ctx;
            const s = this.state;
            const { x, y } = this.hexToScreen(s.player.q, s.player.r);
            if (s.hexes.get(s.player.key()).awake) {
                ctx.beginPath();
                ctx.arc(x, y, COUNTER_SIZE * 0.85, 0, Math.PI * 2);
                ctx.strokeStyle = EGA.lightMagenta;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            this.drawCounter(x, y, PLAYER_COLOR, '@', EGA.black, COUNTER_SIZE);
            if (this.selection) {
                const sz = COUNTER_SIZE + 6;
                ctx.strokeStyle = EGA.white;
                ctx.lineWidth = 2;
                ctx.strokeRect(x - sz / 2, y - sz / 2, sz, sz);
            }
            if (s.outcome === 'captured' && !this.anim) this.drawBurst(x, y, EGA.lightRed);
        }

        // Smashed rigs burst at the end of playback.
        drawSmashBursts() {
            for (const e of this.anim.events.filter(e => e.type === 'smashed')) {
                const rig = this.state.rigs[e.rig];
                const { x, y } = this.hexToScreen(rig.q, rig.r);
                this.drawBurst(x, y, EGA.lightRed);
            }
        }

        drawTargetLines() {
            const ctx = this.ctx;
            const hov = this.hoveredHex;
            ctx.save();
            ctx.setLineDash([5, 4]);
            for (const sw of this.state.sweepers) {
                if (!sw.target) continue;
                const { q, r } = Hex.fromKey(sw.target.key);
                const a = this.hexToScreen(sw.q, sw.r);
                const b = this.hexToScreen(q, r);
                const hovered = hov && sw.isAt(hov.q, hov.r);
                const style = hovered ? { alpha: 1, width: 2 } : TARGET_LINE[sw.target.kind];
                ctx.strokeStyle = `rgba(255, 85, 85, ${style.alpha})`;
                ctx.lineWidth = style.width;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Blocks a rig would wake if planted on the hovered hex — shown when @ carries a rig
        // and could plant there this turn (its own hex, or a reachable hex with PLANT_MP left).
        previewKeys() {
            const s = this.state;
            const h = this.hoveredHex;
            if (!h || this.busy() || this.engine.carriedRigs().length === 0) return [];
            const key = Hex.key(h.q, h.r);
            const own = s.player.isAt(h.q, h.r);
            const cost = this.selection ? this.selection.reachable.get(key) : undefined;
            const canReachAndPlant = cost !== undefined && s.mp - cost >= PLANT_MP;
            if (!(own && s.mp >= PLANT_MP) && !canReachAndPlant) return [];
            if (this.engine.rigAt(h.q, h.r)) return [];
            return this.engine.rigWakeSet(h.q, h.r, this.engine.jammedKeys(), TX_RANGE);   // a fresh rig
        }

        // Blocks that would fade at the next broadcast if the planted rig on the hovered hex were
        // pulled — the engine's own broadcast plan, run without that rig, minus what fades anyway.
        pullPreview() {
            const h = this.hoveredHex;
            if (!h || this.busy()) return [];
            const rig = this.engine.rigAt(h.q, h.r);
            if (!rig) return [];
            const anyway = this.engine.planBroadcast(null).fade;
            return [...this.engine.planBroadcast(rig).fade].filter(([k]) => !anyway.has(k)).map(([, hex]) => hex);
        }

        drawBurst(x, y, color) {
            const ctx = this.ctx;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4;
                ctx.beginPath();
                ctx.moveTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
                ctx.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22);
                ctx.stroke();
            }
            ctx.restore();
        }

        // A square cardboard counter with a hard 2-px depth edge, label centered.
        drawCounter(cx, cy, color, label, ink, size) {
            const ctx = this.ctx;
            const x = Math.round(cx - size / 2), y = Math.round(cy - size / 2);
            ctx.fillStyle = '#000';
            ctx.fillRect(x + 2, y + 2, size, size);   // depth edge
            ctx.fillStyle = color;
            ctx.fillRect(x, y, size, size);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
            ctx.fillStyle = ink;
            ctx.font = `${Math.floor(size * 0.9)}px ${UI_FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx, cy + 1);
        }

        // ---- HUD ----
        updateHUD() {
            const s = this.state;
            const e = this.engine;
            document.getElementById('turn-info').textContent = 'TURN ' + pad2(s.turn);
            document.getElementById('mp-info').textContent =
                'MP ' + '■'.repeat(Math.max(0, s.mp)) + '□'.repeat(Math.max(0, PLAYER_MP - s.mp));

            const seen = !this.anim && !e.isOver() && s.sweepers.some(sw => e.sees(sw));
            const exp = document.getElementById('exposure');
            const sheltered = s.hexes.get(s.player.key()).awake;
            exp.textContent = seen ? 'SEEN!' : sheltered ? 'SHELTERED' : 'HIDDEN';
            exp.className = seen ? 'seen' : 'hidden-ok';

            const blocks = e.blockCount();
            const awake = e.awakeCount();
            document.getElementById('wake-fill').style.width = (100 * awake / blocks) + '%';
            document.getElementById('wake-goal').style.left = (100 * WIN_FRAC) + '%';
            document.getElementById('wake-pct').textContent = `${Math.round(100 * awake / blocks)}%/${Math.round(100 * WIN_FRAC)}%`;

            const n = s.sweepers.length;
            const level = n <= 2 ? 'GREEN' : n <= 5 ? 'AMBER' : n <= 9 ? 'RED' : 'BLACK';
            const lv = document.getElementById('alert-level');
            lv.textContent = level;
            lv.className = 'alert-' + level.toLowerCase();
            document.getElementById('alert-count').textContent =
                `${n} SWEEPER${n === 1 ? '' : 'S'} · QUOTA ${e.alertQuota()}`;

            this.updateRoster();
            this.updateButtons();
            this.updateHover();
        }

        updateRoster() {
            const ul = document.getElementById('rig-list');
            const jam = this.engine.jammedKeys();
            ul.innerHTML = '';
            for (const rig of this.state.rigs) {
                const li = document.createElement('li');
                let status, cls;
                if (rig.status === 'carried') { status = 'CARRIED'; cls = 'rig-carried'; }
                else if (rig.status === 'smashed') { status = 'SMASHED'; cls = 'rig-smashed'; }
                else if (jam.has(rig.key())) { status = 'JAMMED'; cls = 'rig-silent'; }
                else { status = `ON AIR R${this.engine.rigRange(rig)}`; cls = 'rig-planted'; }
                li.className = cls;
                li.innerHTML = `<span>[${rig.label}] ${rig.name}</span><span>${status}</span>`;
                ul.appendChild(li);
            }
        }

        updateButtons() {
            const live = !this.busy();
            document.getElementById('plant-btn').disabled = !(live && this.engine.canPlant());
            document.getElementById('retrieve-btn').disabled = !(live && this.engine.canRetrieve());
            document.getElementById('end-turn').disabled = !live;
        }

        // L1.3 hovered-hex readout: terrain, wake state, jam, and whatever stands there.
        updateHover() {
            const hoverEl = document.getElementById('hover-info');
            const s = this.state;
            const hv = this.hoveredHex;
            const h = hv && s.hexes.get(Hex.key(hv.q, hv.r));
            document.getElementById('hud-hover').classList.toggle('hidden', !h);
            if (!h) return;
            const parts = [TERRAIN_NAMES[h.terrain]];
            if (h.terrain === TERRAIN.BLOCK) parts.push(h.awake ? 'AWAKE' : 'ASLEEP');
            if (this.engine.jammedKeys().has(Hex.key(h.q, h.r))) parts.push('JAMMED');
            const sw = s.sweepers.find(w => w.isAt(h.q, h.r));
            if (sw) parts.push(`${sw.kind} #${sw.id} · MP ${sw.mp} · AFTER ${sw.target ? sw.target.kind.toUpperCase() : 'NOTHING'}`);
            const rig = this.engine.rigAt(h.q, h.r);
            if (rig) {
                const range = this.engine.rigRange(rig);
                parts.push(`RIG ${rig.name} · RANGE ${range}${range === TX_RANGE_MAX ? ' (MAX)' : ''}`);
                parts.push(`PULL NOW: ${this.pullPreview().length} FADE`);
            }
            const st = s.stations.find(p => p.isAt(h.q, h.r));
            if (st) parts.push(st === s.stations[0] ? 'THE MINISTRY' : 'PRECINCT');
            const preview = this.previewKeys();
            if (preview.length) parts.push(`PLANT HERE: WAKES ${preview.length}`);
            hoverEl.textContent = parts.join(' · ') + `  (${hv.q},${hv.r})`;
        }

        // ---- Input handling (dispatch order mirrors UI_CONTROLS.md) ----
        attach() {
            this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
            this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
            window.addEventListener('mouseup', e => this.onMouseUp(e));
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
            window.addEventListener('resize', () => this.resize());
            window.addEventListener('keydown', e => this.onKeyDown(e));

            // L2.3 twin activators: HUD button and hotkey route through one shared function.
            document.getElementById('end-turn').addEventListener('click', () => this.primaryAction());
            document.getElementById('plant-btn').addEventListener('click', () => this.plant());
            document.getElementById('retrieve-btn').addEventListener('click', () => this.retrieve());
            document.getElementById('new-game').addEventListener('click', () => { if (!this.overlay) this.newGame(); });
            for (const id of ['boot', 'endcard'])
                document.getElementById(id).addEventListener('mousedown', e => { e.preventDefault(); this.dismissOverlay(); });
        }

        onMouseDown(e) {
            if (e.button === 2) {
                if (this.targeting) { this.cancelTargeting(); this.render(); }
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

        // L1.2 the stationary-click action: select, then act — a pure lookup.
        handleClick(e) {
            const s = this.state;
            if (this.overlay) { this.dismissOverlay(); return; }   // L5
            if (this.busy()) return;                               // L1.1 + playback + game over

            const hex = this.screenToHex(e.clientX, e.clientY);
            const key = Hex.key(hex.q, hex.r);

            if (this.targeting) {                                  // L4 scaffold
                this.cancelTargeting();
                this.render();
                return;
            }

            if (!this.selection) {
                if (s.player.isAt(hex.q, hex.r)) this.selectPlayer();
            } else if (s.player.isAt(hex.q, hex.r)) {
                this.deselect();
            } else if (this.selection.attackable.has(key)) {
                this.deselect();                                   // no attacks in this game
            } else if (this.selection.reachable.has(key)) {
                this.commitMove(hex.q, hex.r);
                return;
            } else {
                this.deselect();
            }
            this.render();
        }

        onMouseMove(e) {
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
            const hex = this.screenToHex(e.clientX, e.clientY);
            const next = this.state.hexes.has(Hex.key(hex.q, hex.r)) ? { q: hex.q, r: hex.r } : null;
            if (next?.q !== this.hoveredHex?.q || next?.r !== this.hoveredHex?.r) {
                this.hoveredHex = next;
                if (!this.anim) this.render();
            }
        }

        onMouseUp(e) {
            if (e.button !== 0) return;
            if (!this.dragCandidate) return;
            const wasPan = this.panning;
            this.dragCandidate = false;
            this.panning = false;
            if (!wasPan) this.handleClick(e);
        }

        onKeyDown(e) {
            // L5 an overlay swallows any key ("PRESS ANY KEY").
            if (this.overlay) {
                if (e.key === 'F5' || e.ctrlKey || e.metaKey || e.altKey) return;
                e.preventDefault();
                this.dismissOverlay();
                return;
            }
            if (e.key === 'Escape') {                             // L2.2 peel one layer
                if (this.targeting) this.cancelTargeting();
                else this.deselect();
                this.render();
                return;
            }
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.primaryAction(); return; }
            const k = e.key.toLowerCase();
            if (k === 't') this.plant();
            else if (k === 'r') this.retrieve();
            else if (k === 'c') { this.centerOn(this.state.player); this.render(); }
        }
    }

    return GameUI;
})();
