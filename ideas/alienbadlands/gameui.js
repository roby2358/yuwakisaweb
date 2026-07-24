// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering (terrain under fog-of-exploration,
// counters, highlights), the DOM HUD and message log, the location panel (market /
// workshop / ticket), camera pan, and all input wiring. It owns view/interaction state
// only; game state lives in GameState and is autosaved to localStorage here (the
// client owns persistence in this single-player build).
//
// The input dispatch mirrors UI_CONTROLS.md; layer citations (L1.2, L2.1, …) are kept.
// One deliberate deviation from L1.4: moves never auto-end the day — the world phase
// (predators!) only runs on an explicit End Day, so 0 MP just means you're done acting.
const GameUI = (function () {
    const {
        TERRAIN, NODES, MATERIALS, PREDATOR_KINDS, UPGRADES,
        HARVEST_COST, ECON, WORLD
    } = GameArtifacts;
    const {
        HEX_SIZE, COUNTER_SIZE, TERRAIN_COLORS, TERRAIN_NAMES, UNSEEN_COLOR,
        PLAYER_COLOR, MOUNTED_RING, BIKE_COLOR, CACHE_COLOR, BANDIT_COLOR,
        PREDATOR_COLORS, LOCATION_COLORS, LOCATION_GLYPHS, CAMP_COLOR
    } = GameDisplayArtifacts;

    const SAVE_KEY = 'dustrunner-save';

    class GameUI {
        constructor(engine, canvas) {
            this.engine = engine;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.sound = new GameSound();

            // ---- View state (render-only; never part of GameState) ----
            this.panX = 0;
            this.panY = 0;
            this.panning = false;
            this.panStartX = 0;
            this.panStartY = 0;
            this.panOrigX = 0;
            this.panOrigY = 0;

            // ---- Input-layer state (see UI_CONTROLS.md) ----
            this.selection = null;   // L1.2 { reachable: Map<key,cost>, attackable: Set<key> }
            this.overlay = null;     // L5: 'intro' | 'victory' | 'location' | null
            this.currentLocation = null;   // settlement whose panel is open
            this.hoveredHex = null;  // L1.3
            this.logLines = [];      // message log (client-side, not game state)
        }

        get state() { return this.engine.state; }

        // ---- Lifecycle / persistence ----
        start() {
            this.attach();
            if (this.tryLoad()) {
                this.log(`Day ${this.state.day}. The Barrens remember you.`);
                this.syncOverlayDom();   // the intro div is visible by default in the HTML
                this.resize();   // size the canvas before centering on the player
                this.centerOn(this.state.player);
                this.render();
            } else {
                this.newWorld(false);
            }
        }

        newWorld(confirmFirst = true) {
            if (confirmFirst && !window.confirm('Abandon this world and start a new one?')) return;
            localStorage.removeItem(SAVE_KEY);
            this.engine.newGame();
            this.selection = null;
            this.hoveredHex = null;
            this.logLines = [];
            this.log('You are stranded at ' + this.state.settlements[0].name + '.');
            this.resize();   // size the canvas before centering on the player
            this.centerOn(this.state.player);
            this.showOverlay('intro');
            this.save();
            this.render();
        }

        save() {
            try {
                localStorage.setItem(SAVE_KEY, JSON.stringify(this.state.toJSON()));
            } catch (e) { /* storage unavailable: play on without persistence */ }
        }

        tryLoad() {
            try {
                const raw = localStorage.getItem(SAVE_KEY);
                if (!raw) return false;
                const state = GameState.fromJSON(JSON.parse(raw));
                this.engine.setState(state);
                // Re-arm the RNG off the seed + day so the resumed stream isn't a replay.
                Rando.seed((state.seed ^ Math.imul(state.day, 2654435761)) >>> 0);
                return true;
            } catch (e) {
                return false;   // no migration in prototypes: a broken save starts fresh
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

        // ---- Message log ----
        log(text) {
            this.logLines.push(`D${this.state.day} · ${text}`);
            if (this.logLines.length > 8) this.logLines.shift();
            const el = document.getElementById('log');
            el.innerHTML = this.logLines.map(l => `<div>${l}</div>`).join('');
        }

        // Engine events -> log lines + sound cues. Non-broadcast events with a position
        // are only reported when they happened within sight.
        handleEvents(events) {
            for (const e of events) {
                if (!e.broadcast && e.q !== undefined) {
                    const d = new Hex(e.q, e.r).distance(new Hex(this.state.player.q, this.state.player.r));
                    if (d > WORLD.SIGHT) continue;
                }
                const text = this.fmtEvent(e);
                if (text) this.log(text);
                if (e.type === 'sell' || e.type === 'cache-pickup') this.sound.coin();
                if (e.type === 'player-hit' || e.type === 'bike-hit') this.sound.hurt();
                if (e.type === 'bike-eaten' || e.type === 'death') this.sound.doom();
                if (e.type === 'craft' || e.type === 'camp-razed') this.sound.fanfare();
            }
        }

        fmtEvent(e) {
            const mat = id => MATERIALS[id]?.name ?? id;
            const pred = k => PREDATOR_KINDS[k]?.name ?? k;
            switch (e.type) {
                case 'gain': return `+${e.n} ${mat(e.mat)}`;
                case 'cache-drop': return `Bags full — ${e.n} ${mat(e.mat)} cached on the ground`;
                case 'cache-pickup': {
                    const parts = Object.entries(e.mats).map(([m, n]) => `${n} ${mat(m)}`);
                    if (e.credits > 0) parts.unshift(`${e.credits} cr`);
                    return `Recovered: ${parts.join(', ')}`;
                }
                case 'depleted': return 'The node is spent.';
                case 'sell': return `Sold ${e.n} ${mat(e.mat)} for ${e.credits} cr`;
                case 'hit-bandit': return `You wing the ${e.gang} raider (${e.hp} HP)`;
                case 'bandit-killed': return `${e.gang} raider down.`;
                case 'loot-recovered': return `Recovered ${e.n} stolen credits`;
                case 'hit-pred': return `You wound the ${pred(e.kind)} (${e.hp} HP)`;
                case 'pred-killed': return `The ${pred(e.kind)} is down!`;
                case 'pred-ate-bandit': return `A ${pred(e.kind)} devours a ${e.gang} raider`;
                case 'player-hit': return e.by === 'bandit'
                    ? `A ${e.gang} raider shoots you!`
                    : `The ${pred(e.by)} savages you!`;
                case 'bike-hit': return `The ${pred(e.kind)} claws your gravbike (${e.hp} HP left)`;
                case 'bike-eaten': return e.kind === 'gravemaw'
                    ? 'The Gravemaw swallows your gravbike WHOLE.'
                    : 'The Dust Howler tears your gravbike apart!';
                case 'death': return 'You black out… and wake in the starport med-bay. Your gear lies where you fell.';
                case 'raided': return `${e.gang} raided ${e.loc}`;
                case 'banked': return `A ${e.gang} raider banks stolen credits at camp`;
                case 'camp-razed': return `${e.gang} camp razed — ${e.bank} cr seized!`;
                case 'camp-new': return `Word spreads: the ${e.gang} have made camp in the deep waste`;
                case 'geode-rumor': return `Prospectors whisper of a geode bloom ${this.bearing(e.q, e.r)}`;
                case 'rest': return 'You rest easy behind the fence. HP restored.';
                case 'repair': return `Gravbike repaired (+${e.n} HP, ${e.credits} cr)`;
                case 'buy-bike': return 'A new gravbike. Try to keep this one.';
                case 'craft': return `${e.name} installed`;
                case 'ticket': return 'TICKET PUNCHED. The sky is yours.';
                default: return null;
            }
        }

        bearing(q, r) {
            const sp = this.state.settlements[0];
            const from = this.state.hexes.get(Hex.key(sp.q, sp.r));
            const to = this.state.hexes.get(Hex.key(q, r));
            if (!from || !to) return 'somewhere out there';
            const dx = to.col - from.col;
            const dy = to.row - from.row;
            const ns = Math.abs(dy) > 2 ? (dy < 0 ? 'north' : 'south') : '';
            const ew = Math.abs(dx) > 2 ? (dx < 0 ? 'west' : 'east') : '';
            const dir = ns && ew ? `${ns}-${ew}` : (ns || ew || 'near the Spindle');
            return `far to the ${dir}`;
        }

        // ---- L1.2 Selection ----
        selectPlayer() {
            this.selection = {
                reachable: this.engine.computeReachable(),
                attackable: this.engine.computeAttackable()
            };
        }

        deselect() {
            this.selection = null;
        }

        commitMove(q, r) {
            const res = this.engine.movePlayer(q, r);
            if (!res.ok) { this.render(); return; }
            this.sound.step();
            this.handleEvents(res.events);
            if (res.location) {
                this.deselect();
                this.openLocation(res.location);
            } else if (this.state.mp > 0) {
                this.selectPlayer();   // L1.4 turn continues; NO auto end-of-day at 0 MP
            } else {
                this.deselect();
            }
            this.save();
            this.render();
        }

        commitAttack(q, r) {
            const res = this.engine.attack(q, r);
            if (res.ok) {
                this.sound.zap();
                this.handleEvents(res.events);
                this.selectPlayer();
                this.save();
            }
            this.render();
        }

        // ---- L2.1 The context-sensitive primary action (button + Space/Enter) ----
        primaryLabel() {
            const s = this.state;
            const loc = this.engine.locationAt(s.player);
            if (loc) return 'Enter ' + loc.name;
            if (this.engine.campAt(s.player)) return 'Raid Camp';
            if (this.engine.nodeAt(s.player) && !s.player.mounted && s.mp >= HARVEST_COST)
                return `Harvest (${HARVEST_COST} MP)`;
            return 'End Day';
        }

        primaryAction() {
            if (this.overlay || this.state.phase !== 'player') return;
            const s = this.state;
            const loc = this.engine.locationAt(s.player);
            if (loc) { this.openLocation(loc); return; }

            const camp = this.engine.campAt(s.player);
            if (camp) {
                const res = this.engine.raidCamp();
                if (!res.ok) {
                    if (res.reason === 'mounted') this.log('Dismount to raid the camp.');
                    else if (res.reason === 'guards') this.log(`${res.n} raider(s) still guard this camp.`);
                } else {
                    this.handleEvents(res.events);
                    this.deselect();
                    this.save();
                }
                this.render();
                return;
            }

            if (this.engine.nodeAt(s.player) && !s.player.mounted && s.mp >= HARVEST_COST) {
                const res = this.engine.harvest();
                if (res.ok) {
                    this.sound.harvestCue();
                    this.handleEvents(res.events);
                    this.deselect();
                    this.save();
                }
                this.render();
                return;
            }

            this.endDay();
        }

        endDay() {
            if (this.overlay || this.state.phase !== 'player') return;
            const events = this.engine.endTurn();
            this.sound.endTurn();
            this.deselect();
            this.handleEvents(events);
            if (events.some(e => e.type === 'death')) this.centerOn(this.state.player);
            this.save();
            this.render();
        }

        mountToggle() {
            if (this.overlay || this.state.phase !== 'player') return;
            const res = this.engine.toggleMount();
            if (!res.ok) {
                if (res.reason === 'nobike') this.log('Your gravbike is not here.');
                else if (res.reason === 'mp') this.log('No MP left to change mount.');
                else if (res.reason === 'terrain') this.log('You are not dismounting over acid.');
            } else {
                this.sound.step();
                this.deselect();
                this.save();
            }
            this.render();
        }

        // ---- L5 Overlays ----
        showOverlay(name) {
            this.overlay = name;
            this.syncOverlayDom();
        }

        dismissOverlay() {
            if (this.overlay === 'intro') this.sound.fanfare();
            this.overlay = null;
            this.currentLocation = null;
            this.syncOverlayDom();
            this.render();
        }

        syncOverlayDom() {
            document.getElementById('intro-panel').classList.toggle('hidden', this.overlay !== 'intro');
            document.getElementById('location-panel').classList.toggle('hidden', this.overlay !== 'location');
        }

        // ---- Location panel (market / workshop / ticket) ----
        openLocation(loc) {
            this.currentLocation = loc;
            this.showOverlay('location');
            this.buildLocationPanel();
            this.render();
        }

        wealthLabel(loc) {
            if (loc.kind === 'starport') return 'stable prices';
            if (loc.wealth >= 100) return 'thriving';
            if (loc.wealth >= 60) return 'getting by';
            return 'struggling';
        }

        effectsLabel(u) {
            const parts = [];
            for (const [k, v] of Object.entries(u.effects)) {
                if (k === 'bikeMp') parts.push(`+${v} bike MP`);
                else if (k === 'cargo') parts.push(`+${v} cargo`);
                else if (k === 'bikeHp') parts.push(`+${v} bike HP`);
                else if (k === 'atk') parts.push(`+${v} attack`);
                else if (k === 'rangeTwo') parts.push('range 2');
                else if (k === 'maxHp') parts.push(`+${v} max HP`);
                else if (k === 'harvest') parts.push(`+${v} harvest`);
                else if (k === 'scentFoot') parts.push('foot scent 1');
            }
            return parts.join(', ');
        }

        matCostLabel(u) {
            const mats = Object.entries(u.mats)
                .map(([m, n]) => `${n} ${MATERIALS[m].name}`).join(' + ');
            return mats ? `${u.credits} cr + ${mats}` : `${u.credits} cr`;
        }

        buildLocationPanel() {
            const s = this.state;
            const loc = this.currentLocation;
            if (!loc) return;
            const panel = document.getElementById('location-panel');
            let html = `<h2>${loc.name}</h2>`;
            html += `<div class="loc-sub">${loc.kind} · ${this.wealthLabel(loc)} · day ${s.day}</div>`;

            // Market: what you carry, at this market's prices.
            const carried = Object.entries(s.player.cargo);
            html += '<h3>Market</h3>';
            if (carried.length === 0) {
                html += '<div class="loc-note">Nothing in your bags.</div>';
            } else {
                html += '<table>';
                for (const [mat, n] of carried) {
                    const p = this.engine.price(mat, loc);
                    const demand = loc.kind === 'starport' ? 1 : (loc.demand[mat] ?? 1);
                    const hint = demand > 1.15 ? ' ▲' : demand < 0.85 ? ' ▼' : '';
                    html += `<tr><td>${MATERIALS[mat].name} ×${n}</td><td>${p} cr${hint}</td>` +
                        `<td><button data-act="sell1" data-mat="${mat}">Sell 1</button>` +
                        `<button data-act="sellall" data-mat="${mat}">All</button></td></tr>`;
                }
                html += '</table>';
            }

            // Bike services.
            if (s.bike && s.bike.q === s.player.q && s.bike.r === s.player.r &&
                s.bike.hp < this.engine.stats().bikeMaxHp) {
                const missing = this.engine.stats().bikeMaxHp - s.bike.hp;
                html += `<div class="loc-row"><button data-act="repair">Repair gravbike ` +
                    `(${missing * ECON.REPAIR_PER_HP} cr)</button></div>`;
            }

            if (loc.kind === 'starport') {
                html += '<h3>Workshop</h3><table>';
                for (const u of UPGRADES) {
                    if (s.upgrades.includes(u.id)) continue;
                    if (u.requires && !s.upgrades.includes(u.requires)) continue;
                    const ok = this.engine.canCraft(u);
                    html += `<tr><td>${u.name}<div class="loc-note">${this.effectsLabel(u)}</div></td>` +
                        `<td>${this.matCostLabel(u)}</td>` +
                        `<td><button data-act="craft" data-id="${u.id}" ${ok ? '' : 'disabled'}>Craft</button></td></tr>`;
                }
                html += '</table>';
                if (!s.bike) {
                    html += `<div class="loc-row"><button data-act="buybike" ` +
                        `${s.player.credits >= ECON.BIKE ? '' : 'disabled'}>Buy Gravbike (${ECON.BIKE} cr)</button></div>`;
                }
                if (!s.gameWon) {
                    html += `<div class="loc-row"><button data-act="ticket" class="ticket-btn" ` +
                        `${s.player.credits >= ECON.TICKET ? '' : 'disabled'}>` +
                        `Offworld Ticket (${ECON.TICKET} cr)</button></div>`;
                }
            }

            html += '<div class="loc-row"><button data-act="close">Leave (Esc)</button></div>';
            panel.innerHTML = html;
            this.updateHUD();
        }

        onPanelClick(e) {
            const act = e.target.dataset?.act;
            if (!act) return;
            let res = null;
            if (act === 'close') { this.dismissOverlay(); return; }
            if (act === 'sell1') res = this.engine.sell(e.target.dataset.mat, 1);
            if (act === 'sellall') res = this.engine.sell(e.target.dataset.mat, 999);
            if (act === 'repair') res = this.engine.repairBike();
            if (act === 'craft') res = this.engine.craft(e.target.dataset.id);
            if (act === 'buybike') res = this.engine.buyBike();
            if (act === 'ticket') {
                res = this.engine.buyTicket();
                if (res.ok) {
                    this.handleEvents(res.events);
                    this.save();
                    this.showOverlay('victory');
                    this.sound.fanfare();
                    this.render();
                    return;
                }
            }
            if (res && res.ok) {
                this.handleEvents(res.events);
                this.save();
            }
            this.buildLocationPanel();
        }

        // ---- Rendering ----
        render() {
            const ctx = this.ctx;
            const canvas = this.canvas;
            const s = this.state;

            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Terrain under fog of exploration
            for (const [key, hex] of s.hexes) {
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                if (x < -HEX_SIZE * 2 || x > canvas.width + HEX_SIZE * 2 ||
                    y < -HEX_SIZE * 2 || y > canvas.height + HEX_SIZE * 2) continue;
                drawHexPath(ctx, x, y, HEX_SIZE);
                if (!s.seen.has(key)) {
                    ctx.fillStyle = UNSEEN_COLOR;
                    ctx.fill();
                    continue;
                }
                ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
                ctx.fill();
                ctx.strokeStyle = '#00000044';
                ctx.lineWidth = 1;
                ctx.stroke();
                if (hex.yield > 0) {
                    ctx.fillStyle = '#ffffffcc';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(String(hex.yield), x, y + HEX_SIZE * 0.45);
                }
            }

            // L1.2 highlight sets
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

            // Static features on seen ground
            for (const cache of s.caches) {
                if (!s.seen.has(Hex.key(cache.q, cache.r))) continue;
                const { x, y } = this.hexToScreen(cache.q, cache.r);
                this.drawCounter(x, y, CACHE_COLOR, '$', COUNTER_SIZE * 0.7);
            }
            for (const camp of s.camps) {
                if (!s.seen.has(Hex.key(camp.q, camp.r))) continue;
                const { x, y } = this.hexToScreen(camp.q, camp.r);
                this.drawCounter(x, y, CAMP_COLOR, 'X');
            }
            for (const loc of s.settlements) {
                if (!s.seen.has(Hex.key(loc.q, loc.r))) continue;
                const { x, y } = this.hexToScreen(loc.q, loc.r);
                this.drawCounter(x, y, LOCATION_COLORS[loc.kind], LOCATION_GLYPHS[loc.kind]);
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.strokeText(loc.name, x, y + COUNTER_SIZE * 0.75);
                ctx.fillText(loc.name, x, y + COUNTER_SIZE * 0.75);
            }

            // Parked gravbike (always drawn — it's yours and you remember where it is)
            if (s.bike && !s.player.mounted) {
                const { x, y } = this.hexToScreen(s.bike.q, s.bike.r);
                this.drawCounter(x, y, BIKE_COLOR, 'V');
            }

            // Live entities render only within sight of the player
            const pHex = new Hex(s.player.q, s.player.r);
            for (const b of s.bandits) {
                if (pHex.distance(new Hex(b.q, b.r)) > WORLD.SIGHT) continue;
                const { x, y } = this.hexToScreen(b.q, b.r);
                this.drawCounter(x, y, BANDIT_COLOR, 'B');
            }
            for (const p of s.predators) {
                if (pHex.distance(new Hex(p.q, p.r)) > WORLD.SIGHT) continue;
                const { x, y } = this.hexToScreen(p.q, p.r);
                this.drawCounter(x, y, PREDATOR_COLORS[p.kind],
                    p.kind === 'gravemaw' ? 'G' : 'D', COUNTER_SIZE * 1.25);
            }

            // Player (cyan ring while mounted)
            {
                const { x, y } = this.hexToScreen(s.player.q, s.player.r);
                this.drawCounter(x, y, PLAYER_COLOR, 'P');
                if (s.player.mounted) {
                    ctx.beginPath();
                    ctx.arc(x, y, COUNTER_SIZE * 0.85, 0, Math.PI * 2);
                    ctx.strokeStyle = MOUNTED_RING;
                    ctx.lineWidth = 2;
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

            // L5 victory overlay (canvas-drawn; dismiss to keep playing)
            if (this.overlay === 'victory') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 44px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('TICKET PUNCHED', canvas.width / 2, canvas.height / 2 - 40);
                ctx.font = '18px monospace';
                ctx.fillText('You watch the Barrens shrink below. Day ' + s.day + '.',
                    canvas.width / 2, canvas.height / 2 + 10);
                ctx.fillText('(click to keep riding)', canvas.width / 2, canvas.height / 2 + 44);
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

        drawCounter(cx, cy, color, label, size = COUNTER_SIZE) {
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

        updateHUD() {
            const s = this.state;
            const st = this.engine.stats();
            document.getElementById('day-info').textContent = 'Day ' + s.day;
            document.getElementById('mp-info').textContent =
                `MP ${s.mp}/${s.player.mounted ? st.bikeMp : st.footMp} ` +
                (s.player.mounted ? '[BIKE]' : '[FOOT]');
            document.getElementById('hp-info').textContent = `HP ${s.player.hp}/${st.maxHp}`;
            const bikeEl = document.getElementById('bike-info');
            if (!s.bike) bikeEl.textContent = 'NO BIKE';
            else if (s.player.mounted) bikeEl.textContent = `Bike ${s.bike.hp}/${st.bikeMaxHp}`;
            else {
                const d = new Hex(s.bike.q, s.bike.r).distance(new Hex(s.player.q, s.player.r));
                bikeEl.textContent = `Bike ${s.bike.hp}/${st.bikeMaxHp} (parked ${d})`;
            }
            document.getElementById('credits-info').textContent = s.player.credits + ' cr';
            const total = Object.values(s.player.cargo).reduce((a, n) => a + n, 0);
            document.getElementById('cargo-info').textContent = `Cargo ${total}/${st.cargo}`;
            document.getElementById('action-btn').textContent = this.primaryLabel();
            document.getElementById('mount-btn').textContent =
                s.player.mounted ? 'Dismount (M)' : 'Mount (M)';

            // L1.3 hovered-hex readout
            const hoverEl = document.getElementById('hover-info');
            if (!hoverEl) return;
            const h = this.hoveredHex && s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            hoverEl.textContent = (h && s.seen.has(Hex.key(h.q, h.r)))
                ? `${TERRAIN_NAMES[h.terrain] ?? '?'}${h.yield > 0 ? ' [' + h.yield + ']' : ''}`
                : '';
        }

        // ---- Input handling (dispatch order mirrors UI_CONTROLS.md) ----
        attach() {
            this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
            this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
            this.canvas.addEventListener('mouseup', e => this.onMouseUp(e));
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
            window.addEventListener('resize', () => this.resize());
            window.addEventListener('keydown', e => this.onKeyDown(e));

            // L2.3 twin activators: HUD buttons and hotkeys route through one function.
            document.getElementById('action-btn').addEventListener('click', () => this.primaryAction());
            document.getElementById('end-day').addEventListener('click', () => this.endDay());
            document.getElementById('mount-btn').addEventListener('click', () => this.mountToggle());
            document.getElementById('new-world').addEventListener('click', () => this.newWorld());
            document.getElementById('begin-btn').addEventListener('click', () => this.dismissOverlay());
            document.getElementById('location-panel').addEventListener('click', e => this.onPanelClick(e));
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

            if (this.overlay) { this.dismissOverlay(); return; }  // L5 captures & consumes
            if (s.phase !== 'player') return;                     // L1.1

            const hex = this.screenToHex(e.clientX, e.clientY);
            const key = Hex.key(hex.q, hex.r);

            // L1.2 select, then act — the handler is a pure lookup against cached sets.
            if (!this.selection) {
                if (hex.q === s.player.q && hex.r === s.player.r) this.selectPlayer();
            } else if (hex.q === s.player.q && hex.r === s.player.r) {
                this.deselect();
            } else if (this.selection.attackable.has(key)) {
                this.commitAttack(hex.q, hex.r);
                return;
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
            // L5 an overlay swallows its dismissing key.
            if (this.overlay && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
                e.preventDefault();
                this.dismissOverlay();
                return;
            }
            if (this.overlay) return;
            // L2.2 Esc peels back one layer.
            if (e.key === 'Escape') {
                this.deselect();
                this.render();
                return;
            }
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.primaryAction();
                return;
            }
            if (e.key === 'm' || e.key === 'M') { this.mountToggle(); return; }
            if (e.key === 'e' || e.key === 'E') { this.endDay(); }
        }
    }

    return GameUI;
})();
