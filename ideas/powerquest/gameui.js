// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering (with fog of war), the DOM HUD and panels,
// camera/pan, and input wiring. It owns the view and interaction state (pan, hover, selection,
// armed weapon, overlays); none of it is game state. It drives GameEngine through commands and
// re-renders from GameState afterward, and it may not mutate state, roll dice or compute
// legality itself (ONTOLOGY.md client contract). Layer citations (L1.2 ...) refer to UI_CONTROLS.md.
const GameUI = (function () {
    const D = GameDisplayArtifacts;
    const A = GameArtifacts;
    const { HEX_SIZE, COUNTER_SIZE, TERRAIN_COLORS, TERRAIN_NAMES, BG_COLOR, UI_FONT } = D;
    const { MODULES, PERKS, ENEMY_KINDS } = A;

    // A left press that stays within this many pixels is a click; past it, a camera pan.
    const DRAG_THRESHOLD = 4;
    const LOG_LINES = 7;

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const $ = id => document.getElementById(id);

    class GameUI {
        constructor(engine, canvas) {
            this.engine = engine;
            this.state = engine.state;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.sound = new GameSound();

            // ---- View state (render-only; never part of GameState) ----
            this.panX = 0; this.panY = 0;
            this.panning = false; this.dragCandidate = false;
            this.panStartX = 0; this.panStartY = 0; this.panOrigX = 0; this.panOrigY = 0;

            // ---- Input-layer state ----
            this.selected = true;     // L1.2 the hero's highlight sets are showing
            this.selection = null;    // { reachable: Map, attackable: Set, shootable: Set }
            this.armed = null;        // L4 socket index of the armed weapon, or null
            this.overlay = null;      // L5 'intro' | null
            this.hoveredHex = null;   // L1.3
            this.flashUntil = 0;
            this.flashColor = '255, 0, 0';
        }

        // ---- Lifecycle ----
        start() {
            this.attach();
            this.newGame();
        }

        newGame() {
            this.engine.newGame();
            this.selected = true;
            this.armed = null;
            this.hoveredHex = null;
            this.centerOn(this.state.hero);
            this.showOverlay('intro');
            this.refresh();
            this.resize();
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
        screenToHex(sx, sy) { return Hex.fromPixel(sx - this.panX, sy - this.panY); }
        centerOn(p) {
            const px = new Hex(p.q, p.r).toPixel();
            this.panX = this.canvas.width / 2 - px.x;
            this.panY = this.canvas.height / 2 - px.y;
        }
        ensureHeroVisible() {
            const { x, y } = this.hexToScreen(this.state.hero.q, this.state.hero.r);
            const m = 90;
            if (x < m || y < m || x > this.canvas.width - m || y > this.canvas.height - m) this.centerOn(this.state.hero);
        }

        // ---- L1.2 Selection: ask the engine for the legal sets; dispatch is a lookup ----
        computeSelection() {
            const e = this.engine;
            this.selection = {
                reachable: e.computeReachable(),
                attackable: e.attackable(),
                shootable: new Set(this.armed === null ? [] : e.shootable(this.armed).map(c => c.key()))
            };
        }

        // Recompute everything derived from state after a command or a new game.
        refresh() {
            this.computeSelection();
            this.refreshPanels();
        }

        // ---- Commands: run, play cues from the events, re-render ----
        run(res) {
            if (!res.ok) { this.render(); return res; }
            for (const ev of res.events) {
                if (ev.type === 'move') this.sound.step();
                else if (ev.type === 'hit') { this.sound.hit(); if (ev.target === 'hero') this.flash('255, 0, 0'); }
                else if (ev.type === 'kill') this.sound.kill();
                else if (ev.type === 'levelUp') { this.sound.levelUp(); this.flash('255, 214, 51'); }
                else if (ev.type === 'shutdown') { this.flash('255, 0, 0'); this.centerOn(this.state.hero); }
                else if (ev.type === 'tier' || ev.type === 'craft' || ev.type === 'found') this.sound.levelUp();
            }
            this.ensureHeroVisible();
            this.refresh();
            this.render();
            return res;
        }

        flash(rgb) {
            this.flashColor = rgb;
            this.flashUntil = performance.now() + 260;
            setTimeout(() => this.render(), 280);
        }

        endTurn() {
            if (this.overlay || this.state.perkOffers.length) return;
            this.armed = null;
            const res = this.engine.endTurn();
            if (res.ok) this.sound.endTurn();
            this.run(res);
        }

        boost() {
            if (this.overlay || this.state.perkOffers.length) return;
            this.run(this.engine.boost(1));
        }

        found() {
            this.run(this.engine.found());
        }

        // Number keys / socket clicks: arm a weapon, or fire an active module.
        useSocket(i) {
            const h = this.state.hero;
            const m = MODULES[h.sockets[i]];
            if (!m || this.overlay || this.state.perkOffers.length || this.state.phase !== 'hero') return;
            if (m.template === 'weapon') this.armed = this.armed === i ? null : i;
            else if (m.template === 'active') { this.run(this.engine.activate(i)); return; }
            this.refresh();
            this.render();
        }

        // ---- L5 Overlays ----
        showOverlay(name) {
            this.overlay = name;
            $('intro-panel').classList.toggle('hidden', name !== 'intro');
        }
        dismissOverlay() {
            if (this.overlay === 'intro') this.sound.fanfare();
            this.overlay = null;
            $('intro-panel').classList.add('hidden');
            this.render();
        }

        // ---- Panels (DOM) ----
        refreshPanels() {
            this.updateVillagePanel();
            this.updatePerkPanel();
            this.updateSockets();
            this.updateLog();
        }

        updateLog() {
            const lines = this.state.log.slice(-LOG_LINES);
            $('log-panel').innerHTML = lines.map(l => '<div>' + esc(l) + '</div>').join('');
        }

        updateSockets() {
            const h = this.state.hero;
            $('socket-bar').innerHTML = h.sockets.map((id, i) => {
                const m = MODULES[id];
                if (!m) return '<div class="socket empty"><span class="k">' + (i + 1) + '</span>empty</div>';
                let sub = '';
                if (m.template === 'weapon') sub = 'rng ' + m.range + ' dmg ' + m.dmg + ' &middot; ' + m.cost + 'c';
                else if (m.template === 'active') sub = m.effect + ' ' + m.amount + ' &middot; ' + m.cost + 'c';
                else sub = '+' + m.amount + ' ' + m.stat;
                const cls = 'socket' + (this.armed === i ? ' armed' : '') + (m.template === 'passive' ? ' off' : '');
                return '<div class="' + cls + '" data-socket="' + i + '"><span class="k">' + (i + 1) + '</span>' + esc(m.name) + '<small>' + sub + '</small></div>';
            }).join('');
        }

        // The best socket to craft into: an empty one, else the lowest-tier module.
        craftSlot(id) {
            const h = this.state.hero;
            const empty = h.sockets.indexOf(null);
            if (empty >= 0) return empty;
            let worst = 0, wt = Infinity;
            h.sockets.forEach((sid, i) => { const t = MODULES[sid].tier; if (t < wt) { wt = t; worst = i; } });
            return worst;
        }

        updateVillagePanel() {
            const e = this.engine, s = this.state, h = s.hero;
            const v = e.villageAt(h);
            const el = $('village-panel');
            el.classList.toggle('hidden', !v);
            if (!v) return;
            const open = e.isOpen(v);
            const next = v.tier < A.MAX_TIER ? A.TIER_COSTS[v.tier + 1] : null;
            let html = '<h2>' + esc(v.name) + (v.home ? ' (home)' : '') + '</h2>';
            html += '<div class="row">Tier ' + v.tier + ' &middot; stock ' + v.stock + (next ? ' / ' + next : ' (max)') + '</div>';
            html += '<div class="row">Trust ' + Math.round(v.trust * 10) / 10 + ' &middot; ' + (open ? '<b>open</b>' : 'closed') + '</div>';
            html += '<div class="dim">' + (open
                ? 'Rests you each turn (+' + (A.HEAL_BASE + A.HEAL_PER_TIER * v.tier) + ' hp, full charge), crafts modules.'
                : 'Needs trust ' + A.OPEN_TRUST + '. Hunt what threatens it, or give salvage.') + '</div>';
            const pk = h.pack;
            html += '<button class="btn" data-act="deposit"' + (pk.scrap + pk.cells ? '' : ' disabled') + '>Give salvage: ' + pk.scrap + ' scrap, ' + pk.cells + ' cells</button>';
            if (open) {
                html += '<div class="row dim">Craft (replaces ' + esc(MODULES[h.sockets[this.craftSlot()]] ? MODULES[h.sockets[this.craftSlot()]].name : 'an empty socket') + ' if full):</div>';
                for (const id of h.blueprints) {
                    const m = MODULES[id], why = e.canCraft(id);
                    html += '<button class="btn" data-act="craft" data-id="' + id + '"' + (why ? ' disabled' : '') + ' title="' + esc(why || '') + '">' +
                        esc(m.name) + ' &mdash; ' + m.price.scrap + 's ' + m.price.cells + 'c' + (why ? ' <span class="dim">(' + esc(why) + ')</span>' : '') + '</button>';
                }
            }
            el.innerHTML = html;
        }

        updatePerkPanel() {
            const el = $('perk-panel');
            const offer = this.state.perkOffers[0];
            el.classList.toggle('hidden', !offer);
            if (!offer) return;
            const h = this.state.hero;
            let html = '<h2>Level ' + h.level + '</h2><div class="dim">Choose a perk' + (this.state.perkOffers.length > 1 ? ' (' + this.state.perkOffers.length + ' pending)' : '') + '</div>';
            offer.forEach((id, i) => {
                const p = PERKS[id], rank = (h.perks[id] || 0) + 1;
                html += '<button class="btn" data-perk="' + i + '"><b>' + esc(p.name) + '</b> rank ' + rank + ' &mdash; +' + p.amount + ' ' + esc(p.stat) + '</button>';
            });
            el.innerHTML = html;
        }

        // ---- Rendering ----
        render() {
            const ctx = this.ctx, canvas = this.canvas, s = this.state, e = this.engine;
            ctx.fillStyle = BG_COLOR;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const sight = e.sightRadius();
            const hero = s.hero;
            const onScreen = (x, y) => !(x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 || y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2);

            // Terrain: only explored hexes; those outside current sight are dimmed.
            for (const [key, hex] of s.hexes) {
                if (!s.explored[key]) continue;
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                if (!onScreen(x, y)) continue;
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
                ctx.fill();
                if (hex.terrain === A.TERRAIN.MESA) {
                    drawHexPath(ctx, x, y, HEX_SIZE * 0.62);
                    ctx.fillStyle = D.MESA_TOP_COLOR;
                    ctx.fill();
                }
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
                ctx.lineWidth = 1;
                ctx.stroke();
                if (hexDist(hero, hex) > sight) {
                    drawHexPath(ctx, x, y, HEX_SIZE);
                    ctx.fillStyle = D.FOG_DIM;
                    ctx.fill();
                }
            }

            // L1.2 highlight sets
            if (this.selected && this.selection && s.phase === 'hero' && !s.perkOffers.length) {
                const tint = (key, rgb, a) => {
                    const { q, r } = Hex.fromKey(key);
                    const { x, y } = this.hexToScreen(q, r);
                    drawHexPath(ctx, x, y, HEX_SIZE);
                    ctx.fillStyle = 'rgba(' + rgb + ', ' + a + ')';
                    ctx.fill();
                };
                for (const key of this.selection.reachable.keys()) tint(key, D.REACH_COLOR, 0.32);
                for (const key of this.selection.attackable) tint(key, D.ATTACK_COLOR, 0.38);
                for (const key of this.selection.shootable) tint(key, D.SHOOT_COLOR, 0.45);
            }

            // Sites the hero has discovered
            for (const l of s.lairs) if (l.discovered) this.drawSite(l, l.active ? D.LAIR_COLOR : D.LAIR_DEAD_COLOR, 'L');
            for (const r of s.ruins) if (r.discovered) this.drawSite(r, r.looted ? D.RUIN_LOOTED_COLOR : D.RUIN_COLOR, 'R');
            for (const v of s.villages) {
                if (!v.discovered) continue;
                const col = v.ruined ? D.VILLAGE_RUINED_COLOR : e.isOpen(v) ? D.VILLAGE_OPEN_COLOR : D.VILLAGE_CLOSED_COLOR;
                this.drawSite(v, col, 'V');
                if (!v.ruined) this.drawTag(v, 'T' + v.tier);
            }

            // Enemies: only those inside sight
            for (const c of s.enemies) {
                if (hexDist(hero, c) > sight) continue;
                const k = ENEMY_KINDS[c.kind];
                const { x, y } = this.hexToScreen(c.q, c.r);
                if (!onScreen(x, y)) continue;
                this.drawCounter(x, y, D.GROUP_COLORS[k.group], c.label, c.guardian ? '#ffd633' : null);
                this.drawBar(x, y + COUNTER_SIZE / 2 + 3, COUNTER_SIZE, c.hp / c.hpMax, '#d9534f');
                if (c.slayer) {
                    ctx.fillStyle = D.NEMESIS_COLOR;
                    ctx.font = 'bold 14px ' + UI_FONT;
                    ctx.textAlign = 'center';
                    ctx.fillText('\u2620', x + COUNTER_SIZE / 2, y - COUNTER_SIZE / 2);
                }
            }

            // Hero
            {
                const { x, y } = this.hexToScreen(hero.q, hero.r);
                this.drawCounter(x, y, D.PLAYER_COLOR, hero.label, hero.sheltered ? '#3aa55d' : null);
                this.drawBar(x, y + COUNTER_SIZE / 2 + 3, COUNTER_SIZE, hero.hp / e.heroStats().hpMax, '#d9534f');
                if (this.selected) {
                    const sz = COUNTER_SIZE + 4;
                    this.roundRect(x - sz / 2, y - sz / 2, sz, sz, 6);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            if (performance.now() < this.flashUntil) {
                ctx.fillStyle = 'rgba(' + this.flashColor + ', 0.18)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            this.updateHUD();
        }

        drawSite(site, color, label) {
            const { x, y } = this.hexToScreen(site.q, site.r);
            if (x < -60 || y < -60 || x > this.canvas.width + 60 || y > this.canvas.height + 60) return;
            this.drawCounter(x, y, color, label);
        }

        drawTag(site, text) {
            const { x, y } = this.hexToScreen(site.q, site.r);
            const ctx = this.ctx;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px ' + UI_FONT;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, y + COUNTER_SIZE / 2 + 7);
        }

        drawBar(cx, y, w, frac, color) {
            const ctx = this.ctx;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(cx - w / 2, y, w, 4);
            ctx.fillStyle = color;
            ctx.fillRect(cx - w / 2, y, w * Math.max(0, Math.min(1, frac)), 4);
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
            return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.4 ? '#000' : '#fff';
        }

        // A board-game counter: rounded square, label, two gray depth lines; optional colored rim.
        drawCounter(cx, cy, color, label, rim) {
            const ctx = this.ctx;
            const s = COUNTER_SIZE, x = cx - s / 2, y = cy - s / 2, r = 4;
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
            ctx.strokeStyle = rim || '#000';
            ctx.lineWidth = rim ? 2.5 : 1;
            ctx.stroke();
            ctx.fillStyle = this.contrastText(color);
            ctx.font = 'bold ' + Math.floor(s * 0.55) + 'px ' + UI_FONT;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx, cy + 1);
        }

        setMeter(id, frac, text) {
            $(id + '-fill').style.width = (Math.max(0, Math.min(1, frac)) * 100) + '%';
            $(id + '-text').textContent = text;
        }

        updateHUD() {
            const s = this.state, e = this.engine, h = s.hero, st = e.heroStats();
            $('lvl-info').textContent = 'Lv ' + h.level;
            this.setMeter('xp', h.xp / e.xpToNext(), 'XP ' + h.xp + '/' + e.xpToNext());
            this.setMeter('hp', h.hp / st.hpMax, 'HP ' + h.hp + (h.shield ? '+' + h.shield : '') + '/' + st.hpMax);
            this.setMeter('charge', h.charge / st.chargeMax, 'Charge ' + h.charge + '/' + st.chargeMax);
            $('mp-info').textContent = 'MP ' + s.mp;
            $('pack-info').textContent = 'Pack ' + h.pack.scrap + 's ' + h.pack.cells + 'c';
            $('turn-info').textContent = 'Turn ' + s.turn;
            $('boost').disabled = h.charge < 1 || s.phase !== 'hero';
            const why = e.canFound();
            $('found').disabled = !!why;
            $('found').title = why ? 'Cannot found a village: ' + why : 'Found a new village here (F)';

            const hoverEl = $('hover-info');
            const hv = this.hoveredHex && s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            let text = '';
            if (hv && s.explored[Hex.key(hv.q, hv.r)]) {
                text = TERRAIN_NAMES[hv.terrain] + ' (cost ' + (A.MOVEMENT_COST[hv.terrain] === Infinity ? '\u221e' : A.MOVEMENT_COST[hv.terrain]) + ')';
                const c = e.enemyAt(hv.q, hv.r);
                if (c && e.isVisible(c.q, c.r)) {
                    const k = ENEMY_KINDS[c.kind];
                    text = c.name + ' the ' + k.name + (c.guardian ? ' (guardian)' : '') + (c.slayer ? ' \u2620 nemesis' : '') + ' \u2014 tier ' + k.tier + ', hp ' + c.hp + '/' + c.hpMax + ', dmg ' + k.dmg + ', range ' + k.range + ', speed ' + c.speed;
                }
                const v = s.villages.find(x => x.discovered && x.isAt(hv.q, hv.r));
                if (v) text = v.name + ' \u2014 tier ' + v.tier + ', trust ' + Math.round(v.trust * 10) / 10 + (v.ruined ? ', fallen' : '');
                const ru = s.ruins.find(x => x.discovered && x.isAt(hv.q, hv.r));
                if (ru) text = ru.looted ? 'Looted ruin (recharges you)' : 'Ruin \u2014 unexplored';
                const l = s.lairs.find(x => x.discovered && x.isAt(hv.q, hv.r));
                if (l) text = (l.kind === 'camp' ? 'Raider camp' : 'Monster den') + (l.active ? '' : ' (cleared)');
            }
            hoverEl.textContent = text;
            $('hud-hover').classList.toggle('hidden', !text);
        }

        // ---- Input handling ----
        attach() {
            this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
            this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
            window.addEventListener('mouseup', e => this.onMouseUp(e));
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
            window.addEventListener('resize', () => this.resize());
            window.addEventListener('keydown', e => this.onKeyDown(e));

            $('end-turn').addEventListener('click', () => this.endTurn());
            $('boost').addEventListener('click', () => this.boost());
            $('found').addEventListener('click', () => this.found());
            $('new-game').addEventListener('click', () => this.newGame());
            $('begin-btn').addEventListener('click', () => this.dismissOverlay());

            $('socket-bar').addEventListener('click', ev => {
                const el = ev.target.closest('[data-socket]');
                if (el) this.useSocket(Number(el.dataset.socket));
            });
            $('perk-panel').addEventListener('click', ev => {
                const el = ev.target.closest('[data-perk]');
                if (!el) return;
                this.sound.levelUp();
                this.run(this.engine.pickPerk(Number(el.dataset.perk)));
            });
            $('village-panel').addEventListener('click', ev => {
                const el = ev.target.closest('[data-act]');
                if (!el || el.disabled) return;
                const h = this.state.hero;
                if (el.dataset.act === 'deposit') this.run(this.engine.deposit(h.pack.scrap, h.pack.cells));
                else if (el.dataset.act === 'craft') this.run(this.engine.craft(el.dataset.id, this.craftSlot(el.dataset.id)));
            });
        }

        onMouseDown(e) {
            if (e.button === 2) {
                if (this.armed !== null) { this.armed = null; this.refresh(); this.render(); }
                e.preventDefault();
                return;
            }
            if (e.button !== 0) return;
            this.dragCandidate = true;
            this.panning = false;
            this.panStartX = e.clientX; this.panStartY = e.clientY;
            this.panOrigX = this.panX; this.panOrigY = this.panY;
            e.preventDefault();
        }

        // L1.2 the stationary-click action: a pure lookup against the cached sets.
        handleClick(e) {
            const s = this.state;
            if (this.overlay) { this.dismissOverlay(); return; }
            if (s.perkOffers.length || s.phase !== 'hero') return;

            const hex = this.screenToHex(e.clientX, e.clientY);
            const key = Hex.key(hex.q, hex.r);
            const sel = this.selection;

            // L4 armed weapon: a shootable target fires; anything else disarms.
            if (this.armed !== null) {
                if (sel.shootable.has(key)) { this.run(this.engine.shoot(this.armed, hex.q, hex.r)); return; }
                this.armed = null;
                this.refresh();
                this.render();
                return;
            }
            if (s.hero.isAt(hex.q, hex.r)) { this.selected = !this.selected; this.render(); return; }
            if (!this.selected) return;
            if (sel.attackable.has(key)) { this.run(this.engine.attack(hex.q, hex.r)); return; }
            if (sel.reachable.has(key)) { this.run(this.engine.move(hex.q, hex.r)); return; }
            this.selected = false;
            this.render();
        }

        onMouseMove(e) {
            if (this.dragCandidate && !this.panning) {
                if (Math.abs(e.clientX - this.panStartX) > DRAG_THRESHOLD || Math.abs(e.clientY - this.panStartY) > DRAG_THRESHOLD) this.panning = true;
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
                this.updateHUD();
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
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            if (this.overlay && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
                e.preventDefault();
                this.dismissOverlay();
                return;
            }
            if (this.state.perkOffers.length) {
                const i = Number(e.key) - 1;
                if (i >= 0 && i < this.state.perkOffers[0].length) this.run(this.engine.pickPerk(i));
                return;
            }
            if (e.key === 'Escape') {
                if (this.armed !== null) this.armed = null; else this.selected = !this.selected;
                this.refresh();
                this.render();
                return;
            }
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.endTurn(); return; }
            if (e.key === 'b' || e.key === 'B') { this.boost(); return; }
            if (e.key === 'f' || e.key === 'F') { this.found(); return; }
            if (/^[1-9]$/.test(e.key)) this.useSocket(Number(e.key) - 1);
        }
    }

    return GameUI;
})();
