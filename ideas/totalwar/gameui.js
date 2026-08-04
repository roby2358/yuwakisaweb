// gameui.js — GameUI
//
// The only browser-coupled module: canvas rendering, the DOM HUD, camera/pan, and all
// input wiring. It owns the *view and interaction* state (pan offset, hovered hex,
// current selection, overlays, animation flags) — none of which is game state — and it
// drives GameEngine by dispatching actions and re-rendering from GameState afterward.
//
// The input dispatch mirrors UI_CONTROLS.md; layer citations (L1.2, L2.1, …) are kept.
// The opponents' round is consumed from the engine's event generator and animated
// action by action, so consequences land on screen rather than in a log.
const GameUI = (function () {
    const { UNITS, FACTIONS, CITIES, PARTISAN } = GameArtifacts;
    const {
        HEX_SIZE, COUNTER_SIZE, TERRAIN_COLORS, TERRAIN_NAMES,
        FACTION_COLORS, FACTION_BLURBS, UNIT_LABELS,
        CITY_FILL, CITY_STROKE, VICTORY_RING,
        HIGHLIGHT_MOVE, HIGHLIGHT_ATTACK, HIGHLIGHT_BOMBARD,
        OWNER_TINT_ALPHA, WEB_TINT
    } = GameDisplayArtifacts;

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const line = (ctx, x1, y1, x2, y2) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    };

    // NATO-style unit-type symbols, one painter per type, drawn inside the counter's
    // unit box. The classics follow APP-6 (infantry X, armor ellipse, artillery dot,
    // fixed-wing bowtie, HQ flag); the fantasy/sci-fi uniques get invented symbols in
    // the same visual language. Painters receive the box {x, y, w, h, cx, cy} with the
    // pen (stroke/fill/lineWidth) already set; the frame is drawn by the caller.
    const UNIT_SYMBOLS = {
        infantry(ctx, b) {
            line(ctx, b.x, b.y, b.x + b.w, b.y + b.h);
            line(ctx, b.x, b.y + b.h, b.x + b.w, b.y);
        },
        garrison(ctx, b) {   // static infantry: the X barred down the middle
            UNIT_SYMBOLS.infantry(ctx, b);
            line(ctx, b.cx, b.y, b.cx, b.y + b.h);
        },
        militia(ctx, b) {    // irregulars: half an infantry X
            line(ctx, b.x, b.y + b.h, b.x + b.w, b.y);
        },
        armor(ctx, b) {
            ctx.beginPath();
            ctx.ellipse(b.cx, b.cy, b.w * 0.3, b.h * 0.33, 0, 0, Math.PI * 2);
            ctx.stroke();
        },
        artillery(ctx, b) {
            ctx.beginPath();
            ctx.arc(b.cx, b.cy, 2.2, 0, Math.PI * 2);
            ctx.fill();
        },
        rocket(ctx, b) {     // rocket artillery: the shell going up
            line(ctx, b.cx, b.y + b.h - 1, b.cx, b.y + 1);
            line(ctx, b.cx - 3, b.y + 4, b.cx, b.y + 1);
            line(ctx, b.cx + 3, b.y + 4, b.cx, b.y + 1);
        },
        air(ctx, b) {        // fixed-wing bowtie
            ctx.beginPath();
            ctx.moveTo(b.x + 1, b.y + 1);
            ctx.lineTo(b.cx, b.cy);
            ctx.lineTo(b.x + 1, b.y + b.h - 1);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(b.x + b.w - 1, b.y + 1);
            ctx.lineTo(b.cx, b.cy);
            ctx.lineTo(b.x + b.w - 1, b.y + b.h - 1);
            ctx.closePath();
            ctx.fill();
        },
        hq(ctx, b) {         // headquarters flag
            const staffX = b.x + 4;
            line(ctx, staffX, b.y + 1, staffX, b.y + b.h - 1);
            ctx.beginPath();
            ctx.moveTo(staffX, b.y + 1);
            ctx.lineTo(staffX + 8, b.y + 3.5);
            ctx.lineTo(staffX, b.y + 6);
            ctx.closePath();
            ctx.fill();
        },
        dragon(ctx, b) {     // invented: bat wings over a body
            ctx.beginPath();
            ctx.arc(b.cx, b.cy + 2, 1.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(b.cx, b.cy + 1);
            ctx.quadraticCurveTo(b.cx - 4, b.y - 1, b.x + 1, b.y + 3);
            ctx.moveTo(b.cx, b.cy + 1);
            ctx.quadraticCurveTo(b.cx + 4, b.y - 1, b.x + b.w - 1, b.y + 3);
            ctx.stroke();
        },
        wardens(ctx, b) {    // invented: the warden's sword
            line(ctx, b.cx, b.y + 1, b.cx, b.y + b.h - 1);
            line(ctx, b.cx - 3.5, b.y + 3, b.cx + 3.5, b.y + 3);
        },
        colossus(ctx, b) {   // invented: the walker
            line(ctx, b.cx - 3.5, b.y + b.h - 1, b.cx - 3.5, b.cy);
            line(ctx, b.cx + 3.5, b.y + b.h - 1, b.cx + 3.5, b.cy);
            line(ctx, b.cx - 3.5, b.cy, b.cx + 3.5, b.cy);
            ctx.beginPath();
            ctx.arc(b.cx, b.cy - 2.5, 1.6, 0, Math.PI * 2);
            ctx.fill();
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
            this.panStartX = 0;
            this.panStartY = 0;
            this.panOrigX = 0;
            this.panOrigY = 0;

            // ---- Input-layer state (see UI_CONTROLS.md) ----
            // Modal priority: overlay → (animating) → selection.
            this.selection = null;   // L1.2 { originKey, reachable, attackable, bombardable, buildCity }
            this.overlay = null;     // L5 input-capturing layer: 'intro' | 'end' | null
            this.hoveredHex = null;  // L1.3 hex under the cursor, for the HUD readout
            this.animating = false;  // opponents' round is replaying; map input is off
            this.flashKey = null;    // hex flashed during combat/revolt animation
            this.flashColor = null;
        }

        // ---- Lifecycle ----
        start() {
            this.attach();
            this.buildFactionButtons();
            this.showOverlay('intro');
            this.resize();
        }

        newGame(factionId) {
            this.engine.newGame(null, factionId);
            this.selection = null;
            this.hoveredHex = null;
            this.overlay = null;
            this.syncOverlayDom();
            this.centerOn(Hex.fromKey(this.playerFaction().capital));
            this.sound.fanfare();
            this.render();
        }

        playerFaction() {
            return this.engine.factionOf(this.state.playerFaction);
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
        // unitIds null = whole stack; an array = a sub-stack being split off (movement
        // only). cycleIndex remembers where repeat clicks are in the whole→u1→…→uN walk.
        selectStack(key, unitIds, cycleIndex) {
            const sets = this.engine.selectionSets(key, unitIds);
            const hex = this.state.hexes.get(key);
            this.selection = {
                originKey: key, unitIds, cycleIndex,
                ...sets,
                buildCity: (hex.city && hex.owner === this.state.playerFaction) ? key : null,
            };
        }

        // Repeat clicks on the selected hex walk the selection through the stack:
        // whole stack → each unit in turn → deselected.
        cycleSelection(key) {
            const stack = this.engine.stackAt(key);
            const next = (this.selection.cycleIndex ?? -1) + 1;
            if (stack.length <= 1 || next >= stack.length) {
                this.deselect();
                return;
            }
            this.selectStack(key, [stack[next].id], next);
        }

        selectCity(key) {
            this.selection = {
                originKey: key,
                reachable: new Map(), attackable: new Set(), bombardable: new Set(),
                buildCity: key,
            };
        }

        deselect() {
            this.selection = null;
        }

        trySelect(key) {
            const hex = this.state.hexes.get(key);
            if (!hex) { this.deselect(); return; }
            const stack = this.engine.stackAt(key);
            if (stack.length > 0 && stack[0].faction === this.state.playerFaction) {
                this.selectStack(key, null, -1);
                return;
            }
            if (hex.city && hex.owner === this.state.playerFaction) {
                this.selectCity(key);
                return;
            }
            this.deselect();
        }

        // ---- Player actions (each drives the engine, then re-renders from state) ----
        doMove(destKey) {
            const res = this.engine.moveStack(this.selection.originKey, destKey, this.selection.unitIds);
            if (!res.ok) { this.deselect(); this.render(); return; }
            this.sound.step();
            // L1.4 the stack may still attack (or spend breakthrough MP) from its new hex.
            this.selectStack(destKey, null, -1);
            this.render();
        }

        doAttack(targetKey) {
            const originKey = this.selection.originKey;
            const res = this.engine.resolveCombat(originKey, targetKey);
            if (!res.ok) { this.render(); return; }
            this.sound.combat();
            // Follow the survivors: advanced attackers may have breakthrough MP to spend.
            if (res.advanced) this.selectStack(targetKey, null, -1);
            else if (this.engine.stackAt(originKey).length > 0) this.selectStack(originKey, null, -1);
            else this.deselect();
            this.render();
        }

        doBombard(targetKey) {
            const res = this.engine.bombard(this.selection.originKey, targetKey);
            if (res.ok) this.sound.combat();
            this.selectStack(this.selection.originKey, null, -1);
            this.render();
        }

        doBuild(type) {
            const res = this.engine.build(this.selection.buildCity, type);
            if (res.ok) this.sound.step();
            this.render();
        }

        // ---- L2.1 One context-sensitive primary action (End Turn button + Space/Enter) ----
        primaryAction() {
            if (this.overlay || this.animating || this.state.phase !== 'player') return;
            this.runOpponentRound();
        }

        // Consume the engine's event generator, animating action by action: a short beat
        // per move, a flash + thud per combat, an alarm per revolt.
        async runOpponentRound() {
            this.animating = true;
            this.deselect();
            this.sound.endTurn();
            this.render();

            for (const ev of this.engine.runOpponentRound()) {
                if (ev.type === 'combat' || ev.type === 'bombard') {
                    this.flash(ev.targetKey, 'rgba(255, 60, 60, 0.6)');
                    this.sound.combat();
                    this.render();
                    await sleep(240);
                } else if (ev.type === 'revolt') {
                    this.flash(ev.key, 'rgba(255, 140, 0, 0.7)');
                    this.sound.alarm();
                    this.render();
                    await sleep(280);
                } else if (ev.type === 'move') {
                    this.render();
                    await sleep(90);
                } else {
                    this.render();
                    await sleep(40);
                }
                this.clearFlash();
            }

            this.animating = false;
            this.render();
            this.checkGameOver();
        }

        flash(key, color) {
            this.flashKey = key;
            this.flashColor = color;
        }

        clearFlash() {
            this.flashKey = null;
            this.flashColor = null;
        }

        checkGameOver() {
            const s = this.state;
            const player = this.playerFaction();
            if (!s.winner && !player.eliminated) return;
            const won = s.winner === player.id;
            if (won) this.sound.fanfare(); else this.sound.alarm();
            const winner = s.winner && this.engine.factionOf(s.winner);
            const message = won
                ? `Total victory! Your empire held the victory cities — turn ${s.turn}.`
                : player.eliminated
                    ? `${player.name} has been wiped from the map on turn ${s.turn}.`
                    : `${winner.name} completed the victory countdown on turn ${s.turn}.`;
            document.getElementById('end-message').textContent = message;
            this.showOverlay('end');
        }

        // ---- L5 Overlays: input-capturing layers checked before gameplay ----
        showOverlay(name) {
            this.overlay = name;
            this.syncOverlayDom();
        }

        syncOverlayDom() {
            document.getElementById('intro-panel').classList.toggle('hidden', this.overlay !== 'intro');
            document.getElementById('end-panel').classList.toggle('hidden', this.overlay !== 'end');
        }

        buildFactionButtons() {
            const box = document.getElementById('faction-buttons');
            for (const def of FACTIONS) {
                const btn = document.createElement('button');
                btn.className = 'faction-btn';
                btn.style.borderColor = FACTION_COLORS[def.id];
                btn.innerHTML = `<strong style="color:${FACTION_COLORS[def.id]}">${def.name}</strong>` +
                    `<span>${FACTION_BLURBS[def.id]}</span>`;
                btn.addEventListener('click', () => this.newGame(def.id));
                box.appendChild(btn);
            }
        }

        // ---- Rendering ----
        render() {
            const ctx = this.ctx;
            const canvas = this.canvas;
            const s = this.state;

            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (!s.hexes) return;

            const player = this.playerFaction();
            const onScreen = ({ x, y }) =>
                x > -HEX_SIZE * 2 && x < canvas.width + HEX_SIZE * 2 &&
                y > -HEX_SIZE * 2 && y < canvas.height + HEX_SIZE * 2;

            // Terrain + ownership tint + command web
            for (const [key, hex] of s.hexes) {
                const p = this.hexToScreen(hex.q, hex.r);
                if (!onScreen(p)) continue;
                drawHexPath(ctx, p.x, p.y, HEX_SIZE);
                ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
                ctx.fill();
                if (hex.owner && FACTION_COLORS[hex.owner]) {
                    ctx.globalAlpha = OWNER_TINT_ALPHA;
                    ctx.fillStyle = FACTION_COLORS[hex.owner];
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
                if (player && !player.eliminated && s.phase === 'player' &&
                    this.engine.inCommandWeb(key, player)) {
                    ctx.fillStyle = WEB_TINT;
                    ctx.fill();
                }
                ctx.strokeStyle = '#00000044';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // L1.2 highlight sets: move (yellow), attack (red), bombard (orange)
            if (this.selection) {
                this.paintHexSet(this.selection.reachable.keys(), HIGHLIGHT_MOVE);
                this.paintHexSet(this.selection.attackable, HIGHLIGHT_ATTACK);
                this.paintHexSet(this.selection.bombardable, HIGHLIGHT_BOMBARD);
            }

            // Combat / revolt flash during the opponents' round
            if (this.flashKey) this.paintHexSet([this.flashKey], this.flashColor);

            // Cities
            for (const hex of this.engine.cityHexes()) {
                const p = this.hexToScreen(hex.q, hex.r);
                if (!onScreen(p)) continue;
                this.drawCity(hex, p.x, p.y);
            }

            // Units, one stack per occupied hex
            const byHex = new Map();
            for (const u of s.units) {
                const key = Hex.key(u.q, u.r);
                if (!byHex.has(key)) byHex.set(key, []);
                byHex.get(key).push(u);
            }
            for (const [key, stack] of byHex) {
                const { q, r } = Hex.fromKey(key);
                const p = this.hexToScreen(q, r);
                if (!onScreen(p)) continue;
                const isSel = key === this.selection?.originKey;
                let drawUnits = stack;
                if (isSel && this.selection.unitIds) {
                    // A split selection draws its unit on top of the stack.
                    drawUnits = [...stack.filter(u => this.selection.unitIds.includes(u.id)),
                        ...stack.filter(u => !this.selection.unitIds.includes(u.id))];
                }
                this.drawStack(drawUnits, p.x, p.y, isSel, isSel && !!this.selection.unitIds);
            }

            // Odds preview on the hovered attack target (the CRT before commitment)
            this.drawOddsPreview();

            this.updateHUD();
        }

        paintHexSet(keys, style) {
            const ctx = this.ctx;
            for (const key of keys) {
                const { q, r } = Hex.fromKey(key);
                const { x, y } = this.hexToScreen(q, r);
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = style;
                ctx.fill();
            }
        }

        drawCity(hex, x, y) {
            const ctx = this.ctx;
            const isCapital = this.state.factions.some(f => f.capital === Hex.key(hex.q, hex.r));

            if (hex.city.victory) {
                ctx.beginPath();
                ctx.arc(x, y, 11, 0, Math.PI * 2);
                ctx.strokeStyle = VICTORY_RING;
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fillStyle = CITY_FILL;
            ctx.fill();
            ctx.strokeStyle = CITY_STROKE;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            if (isCapital) {
                ctx.fillStyle = '#333';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('★', x, y + 0.5);
            }

            // Revolt-risk pip: the player's naked conquests wear their danger openly.
            const mine = hex.owner === this.state.playerFaction &&
                hex.city.homelandOf !== this.state.playerFaction;
            if (mine && this.engine.unitsAt(hex.q, hex.r).length === 0) {
                ctx.fillStyle = '#ff4040';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('!', x + 12, y - 10);
            }
        }

        // `split` marks a sub-stack selection: dashed ring instead of solid.
        drawStack(stack, cx, cy, selected, split) {
            const ctx = this.ctx;
            const color = FACTION_COLORS[stack[0].faction] || '#cc3333';
            const spent = stack.every(u => (u.activated || u.attacked) && u.freeMP === 0);

            if (spent) ctx.globalAlpha = 0.55;
            for (let i = stack.length - 1; i >= 0; i--) {
                const off = i * 3;
                const top = i === 0;
                this.drawCounter(cx - off, cy - off, color,
                    top ? stack[0].type : null, top && stack[0].entrenched);
            }
            ctx.globalAlpha = 1;

            if (selected) {
                const sz = COUNTER_SIZE + 6;
                this.roundRect(cx - sz / 2, cy - sz / 2, sz, sz, 6);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                if (split) ctx.setLineDash([4, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        drawOddsPreview() {
            if (!this.selection || !this.hoveredHex) return;
            const key = Hex.key(this.hoveredHex.q, this.hoveredHex.r);
            let label = null;
            if (this.selection.attackable.has(key)) {
                const odds = this.engine.computeOdds(this.selection.originKey, key);
                if (odds) label = `${odds.odds}:1`;
            } else if (this.selection.bombardable.has(key)) {
                label = 'BMB';
            }
            if (!label) return;
            const ctx = this.ctx;
            const { x, y } = this.hexToScreen(this.hoveredHex.q, this.hoveredHex.r);
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000';
            ctx.fillText(label, x + 1, y - HEX_SIZE - 5);
            ctx.fillStyle = '#ffdd55';
            ctx.fillText(label, x, y - HEX_SIZE - 6);
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

        drawCounter(cx, cy, color, unitType, entrenched) {
            const ctx = this.ctx;
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

            // Body — entrenched units get a silver border instead of black
            this.roundRect(x, y, s, s, r);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = entrenched ? '#c8c8d2' : '#000';
            ctx.lineWidth = entrenched ? 1.5 : 1;
            ctx.stroke();

            // NATO-style unit box + type symbol, in whichever pen contrasts the body
            if (unitType) {
                const pen = this.contrastText(color);
                ctx.strokeStyle = pen;
                ctx.fillStyle = pen;
                ctx.lineWidth = 1.2;
                const bw = 16, bh = 10;
                const box = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, cx, cy };
                ctx.strokeRect(box.x, box.y, bw, bh);
                UNIT_SYMBOLS[unitType]?.(ctx, box);

                // Stat line: atk-def-mp, bottom edge of the counter
                const stats = UNITS[unitType];
                if (stats) {
                    ctx.font = 'bold 6px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'alphabetic';
                    ctx.fillText(`${stats.atk}-${stats.def}-${stats.mp}`, cx, y + s - 2);
                }
            }
        }

        // ---- HUD ----
        updateHUD() {
            const s = this.state;
            const player = this.playerFaction();
            const factionEl = document.getElementById('faction-info');
            if (player) {
                factionEl.textContent = player.name;
                factionEl.style.color = FACTION_COLORS[player.id];
            }
            document.getElementById('turn-info').textContent = 'Turn ' + s.turn;
            document.getElementById('cp-info').textContent = player ? 'CP: ' + player.cp : '';
            document.getElementById('vc-info').textContent = player
                ? `VC: ${this.engine.victoryCityCount(player.id)}/${CITIES.VICTORY_NEED}` : '';
            this.updateAlert();
            this.updateHover();
            this.updateBuildPanel();
        }

        // The public victory countdown — everyone sees who is about to win.
        updateAlert() {
            const el = document.getElementById('alert-info');
            const leader = this.state.factions.find(f => f.victoryStreak > 0);
            if (!leader) { el.textContent = ''; return; }
            const left = CITIES.VICTORY_STREAK - leader.victoryStreak;
            el.textContent = `⚑ ${leader.name} wins in ${left} turn${left === 1 ? '' : 's'}!`;
            el.style.color = leader.id === this.state.playerFaction ? '#7dff7d' : '#ff6a6a';
        }

        updateHover() {
            const el = document.getElementById('hover-info');
            const s = this.state;
            const h = this.hoveredHex && s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            if (!h) { el.textContent = ''; return; }
            const parts = [TERRAIN_NAMES[h.terrain] ?? '?'];
            if (h.city) {
                const owner = this.engine.factionOf(h.owner);
                const tags = [];
                if (owner) tags.push(owner.name);
                if (h.owner === PARTISAN) tags.push('partisan');
                if (h.city.victory) tags.push('VC');
                parts.push(`${h.city.name} (${tags.join(', ')})`);
            }
            const stack = this.engine.unitsAt(h.q, h.r);
            if (stack.length > 0)
                parts.push(stack.map(u => UNIT_LABELS[u.type]).join(' '));
            el.textContent = parts.join(' · ');
        }

        updateBuildPanel() {
            const panel = document.getElementById('build-panel');
            const cityKey = this.selection?.buildCity;
            const player = this.playerFaction();
            const show = cityKey && player && !this.animating && this.state.phase === 'player';
            panel.classList.toggle('hidden', !show);
            if (!show) return;

            const hex = this.state.hexes.get(cityKey);
            let html = `<h3>${hex.city.name}</h3>`;
            if (hex.city.builtThisTurn) html += `<p class="note">Already built this turn</p>`;
            for (const type of this.engine.buildableTypes(player)) {
                const cost = this.engine.buildCost(player, type);
                const blocked = hex.city.builtThisTurn ? 'built'
                    : this.engine.buildBlocked(player, cityKey, type);
                const stats = UNITS[type];
                html += `<button class="build-btn" data-type="${type}" ${blocked ? 'disabled' : ''}>` +
                    `${UNIT_LABELS[type]} ${stats.name} — ${cost} CP` +
                    (blocked && blocked !== 'built' ? ` <em>(${blocked})</em>` : '') +
                    `</button>`;
            }
            panel.innerHTML = html;
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
            document.getElementById('new-game').addEventListener('click', () => this.showOverlay('intro'));
            document.getElementById('end-btn').addEventListener('click', () => this.showOverlay('intro'));
            document.getElementById('build-panel').addEventListener('click', e => {
                const btn = e.target.closest('.build-btn');
                if (btn && !btn.disabled) this.doBuild(btn.dataset.type);
            });
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
            if (this.overlay) return;                 // L5 DOM overlays own their own buttons
            if (this.animating) return;               // opponents' round is replaying
            if (s.phase !== 'player') return;         // L1.1 map input only on the player's turn

            const hex = this.screenToHex(e.clientX, e.clientY);
            const key = Hex.key(hex.q, hex.r);

            // L1.2 select, then act — the handler is a pure lookup against the cached sets.
            if (!this.selection) {
                this.trySelect(key);
            } else if (key === this.selection.originKey) {
                this.cycleSelection(key);   // whole stack → each unit → deselect
            } else if (this.selection.attackable.has(key)) {
                this.doAttack(key);
                return;   // doAttack has already re-rendered
            } else if (this.selection.bombardable.has(key)) {
                this.doBombard(key);
                return;
            } else if (this.selection.reachable.has(key)) {
                this.doMove(key);
                return;
            } else {
                this.trySelect(key);
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
            if (!this.state.hexes) return;
            // L1.3 track the hovered hex for the HUD readout (decoupled from panning).
            const hex = this.screenToHex(e.clientX, e.clientY);
            const next = this.state.hexes.has(Hex.key(hex.q, hex.r)) ? { q: hex.q, r: hex.r } : null;
            if (next?.q !== this.hoveredHex?.q || next?.r !== this.hoveredHex?.r) {
                this.hoveredHex = next;
                if (this.selection) this.render();   // odds preview follows the cursor
                else this.updateHUD();
            }
        }

        onMouseUp(e) {
            if (e.button === 2) this.panning = false;
        }

        onKeyDown(e) {
            if (this.overlay) return;                 // L5 overlays are button-driven
            // L2.2 Esc: peel back one modal layer, deepest first.
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
