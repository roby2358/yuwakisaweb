// gameui.js — GameUI
//
// Canvas map + DOM panels. Immediate-mode render loop; all adjudication lives in
// GameEngine. The enemy phase is animated: each doom landing flashes at its hex
// before the ledger lines print — death is an event, not a state check.
const GameUI = (function () {
    const D = GameDisplayArtifacts;
    const A = GameArtifacts;

    let state = null;
    let canvas, ctx;
    let pan = { x: 0, y: 0 };
    let dragging = null;
    let hoverHex = null;
    let selected = false;
    let animating = false;
    let flashes = [];           // { hexKey, start, dur }
    let saveHook = () => {};

    // ---- helpers ----

    function el(id) { return document.getElementById(id); }

    function screenToHex(x, y) {
        return Hex.fromPixel(x - pan.x, y - pan.y);
    }

    function hexCenter(hex) {
        const p = new Hex(hex.q, hex.r).toPixel();
        return { x: p.x + pan.x, y: p.y + pan.y };
    }

    function centerOn(hexKey) {
        const hex = Hex.fromKey(hexKey);
        const p = hex.toPixel();
        pan.x = canvas.width / 2 - p.x;
        pan.y = canvas.height / 2 - p.y;
    }

    // ---- logging ----

    function log(msg, cls) {
        const line = document.createElement('div');
        if (cls) line.className = cls;
        line.textContent = msg;
        const box = el('log');
        box.appendChild(line);
        while (box.children.length > 12) box.removeChild(box.firstChild);
        box.scrollTop = box.scrollHeight;
    }

    function logAll(msgs, cls) {
        for (const m of msgs) log(m, cls);
    }

    // ---- rendering ----

    function shade(elev) {
        return `rgba(0, 0, 0, ${(1 - elev) * 0.18})`;
    }

    function drawRoundedSquare(x, y, size, fill) {
        const half = size / 2;
        // depth lines under and to the right (house counter style)
        ctx.strokeStyle = D.DEPTH_LINE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - half + 3, y + half + 2);
        ctx.lineTo(x + half + 2, y + half + 2);
        ctx.lineTo(x + half + 2, y - half + 3);
        ctx.stroke();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(x - half, y - half, size, size, 5);
        ctx.fill();
    }

    function drawCircleCounter(x, y, size, fill) {
        const half = size / 2;
        // depth arc under and to the right (matches the square counters)
        ctx.strokeStyle = D.DEPTH_LINE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, half, -Math.PI / 4, Math.PI * 0.8);
        ctx.stroke();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(x, y, half, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawGlyph(x, y, glyph, color, size) {
        ctx.fillStyle = color;
        ctx.font = `bold ${size}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(glyph, x, y + 1);
    }

    function drawFieldMark(x, y) {
        ctx.strokeStyle = D.FIELD_MARK;
        ctx.lineWidth = 1.5;
        for (const dx of [-6, 0, 6]) {
            ctx.beginPath();
            ctx.moveTo(x + dx, y + 6);
            ctx.lineTo(x + dx, y - 2);
            ctx.moveTo(x + dx, y - 2);
            ctx.lineTo(x + dx - 3, y + 1);
            ctx.moveTo(x + dx, y - 2);
            ctx.lineTo(x + dx + 3, y + 1);
            ctx.stroke();
        }
    }

    function drawMemorial(x, y) {
        ctx.fillStyle = D.MEMORIAL_COLOR;
        ctx.beginPath();
        ctx.roundRect(x - 5, y - 7, 10, 14, [5, 5, 1, 1]);
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 1);
        ctx.lineTo(x + 3, y - 1);
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 2);
        ctx.stroke();
    }

    function omensByBuilding() {
        const map = new Map();
        for (const v of state.visions.filter(v => v.revealed.place)) {
            if (!map.has(v.buildingId)) map.set(v.buildingId, []);
            map.get(v.buildingId).push(v);
        }
        return map;
    }

    function drawBadge(x, y, text, bg, fg) {
        ctx.font = 'bold 9px monospace';
        const w = Math.ceil(ctx.measureText(text).width) + 8;
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(x, y, w, 12, 3);
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + 4, y + 7);
    }

    function drawOmens(building, x, y, now) {
        const visions = omensByBuilding().get(building.id);
        if (!visions) return;
        // badges stack from the counter's top-left, running down
        const bx = x - D.HEX_SIZE - 6;
        let by = y - D.HEX_SIZE + 4;
        for (const v of visions) {
            if (v.warned) {
                const pulse = 0.5 + 0.5 * Math.sin(now / 300);
                ctx.strokeStyle = D.WARNED_RING;
                ctx.globalAlpha = 0.4 + 0.5 * pulse;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, D.COUNTER_SIZE * 0.85, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            const left = Math.max(0, v.day - state.day);
            const daysText = !v.revealed.day ? '? days'
                : left === 0 ? 'tonight'
                : `${left} day${left === 1 ? '' : 's'}`;
            drawBadge(bx, by, daysText, D.OMEN_COLOR, '#fff');
            by += 14;
            const p = GameEngine.preparedness(state, v);
            if (p) {
                drawBadge(bx, by, String(p.defense), D.TIER_COLORS[p.tier ?? 'unknown'], '#000');
                by += 14;
            }
        }
    }

    function render() {
        requestAnimationFrame(render);
        const now = performance.now();
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!state) return;

        const reach = selected ? GameEngine.reachable(state) : null;

        for (const hex of state.hexes.values()) {
            const c = hexCenter(hex);
            if (c.x < -40 || c.y < -40 || c.x > canvas.width + 40 || c.y > canvas.height + 40) continue;
            drawHexPath(ctx, c.x, c.y, D.HEX_SIZE);
            ctx.fillStyle = D.TERRAIN_COLORS[hex.terrain];
            ctx.fill();
            ctx.fillStyle = shade(hex.elev);
            ctx.fill();
            ctx.strokeStyle = D.GRID_LINE;
            ctx.lineWidth = 1;
            ctx.stroke();

            if (reach && reach.get(Hex.key(hex.q, hex.r)) > 0) {
                drawHexPath(ctx, c.x, c.y, D.HEX_SIZE);
                ctx.fillStyle = D.REACHABLE_FILL;
                ctx.fill();
            }
            if (hex.feature === 'field') drawFieldMark(c.x, c.y);
            if (hex.feature === 'memorial') drawMemorial(c.x, c.y);
        }

        for (const building of state.buildings) {
            const hex = state.hexes.get(building.hexKey);
            const c = hexCenter(hex);
            const spec = A.BUILDINGS[building.kind];
            const fill = building.ruined ? D.RUIN_COLOR
                : building.kind === 'stones' ? D.STONES_COLOR : D.BUILDING_COLOR;
            if (building.kind === 'cottage') {
                drawCircleCounter(c.x, c.y, D.COUNTER_SIZE, fill);
            } else {
                drawRoundedSquare(c.x, c.y, D.COUNTER_SIZE, fill);
            }
            drawGlyph(c.x, c.y, building.ruined ? '✕' : spec.glyph, building.ruined ? '#221' : '#332', 15);
            drawOmens(building, c.x, c.y, now);
        }

        // the augur
        const oracleHex = state.oracleHex();
        const oc = hexCenter(oracleHex);
        const offset = oracleHex.buildingId !== null ? 9 : 0;
        drawRoundedSquare(oc.x + offset, oc.y + offset, D.COUNTER_SIZE - 8, D.ORACLE_COLOR);
        drawGlyph(oc.x + offset, oc.y + offset, '✶', '#432', 13);

        // doom flashes
        flashes = flashes.filter(f => now - f.start < f.dur);
        for (const f of flashes) {
            const t = (now - f.start) / f.dur;
            const c = hexCenter(Hex.fromKey(f.hexKey));
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = D.FLASH_COLOR;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(c.x, c.y, 10 + t * 55, 0, Math.PI * 2);
            ctx.stroke();
            drawHexPath(ctx, c.x, c.y, D.HEX_SIZE);
            ctx.fillStyle = D.FLASH_COLOR;
            ctx.globalAlpha = (1 - t) * 0.5;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // ---- HUD / panels ----

    function updateHud() {
        el('day-info').textContent = `Day ${state.day} · ${state.rank().name}`;
        el('supplies-info').textContent = `Supplies ${state.supplies}`;
        el('trust-info').textContent = `Trust ${state.trust}`;
        el('renown-info').textContent = `Renown ${state.renown}`;
        updateBurdenBar();
        el('actions-info').textContent = `Actions ${state.actions}`;
        el('mp-info').textContent = `MP ${state.mp}`;

        el('work-btn').disabled = animating || !GameEngine.canWorkHere(state);
        el('prep-btn').disabled = animating || state.buildingAtOracle() === null;
        el('festival-btn').disabled = animating || !GameEngine.canFestivalHere(state);
        el('end-day').disabled = animating;
    }

    // Clear through green to yellow to red as the weight of knowing piles up.
    function updateBurdenBar() {
        const b = state.burden;
        const fill = el('burden-fill');
        fill.style.width = `${b}%`;
        const hue = Math.max(0, 120 - b * 1.2);
        const alpha = Math.min(1, 0.15 + b / 40);
        fill.style.backgroundColor = `hsla(${hue}, 70%, 42%, ${alpha})`;

        const tolls = [];
        if (b >= A.TUNING.BURDEN_SLOW_2) tolls.push('−2 actions');
        else if (b >= A.TUNING.BURDEN_SLOW_1) tolls.push('−1 action');
        if (b >= A.TUNING.BURDEN_CLOUD) tolls.push('new visions clouded');
        const band = D.BURDEN_BANDS.find(x => b < x.upTo);
        el('burden-text').textContent =
            `Burden ${b} · ${band.name} — ${tolls.length ? tolls.join(', ') : 'no toll yet'}`;
    }

    function facetRow(vision, facet, labels) {
        const revealed = vision.revealed[facet];
        const text = revealed
            ? GameEngine.facetText(state, vision, facet)
            : vision.riddle[facet];
        const cls = revealed ? 'facet-known' : 'facet-veiled';
        const canPick = vision.pendingChoice && !revealed;
        const btn = canPick
            ? ` <button class="pick-btn" data-vision="${vision.id}" data-facet="${facet}">reveal this</button>`
            : '';
        let extra = '';
        if (revealed && facet === 'day') {
            const left = vision.day - state.day;
            extra = left <= 0 ? ' — TONIGHT' : ` — in ${left} day${left === 1 ? '' : 's'}`;
        }
        return `<div class="facet"><span class="facet-label">${labels[facet]}</span>` +
            `<span class="${cls}">${text}${extra}</span>${btn}</div>`;
    }

    function visionCard(vision) {
        const labels = { kind: 'what', place: 'where', day: 'when', victim: 'who', magnitude: 'how hard' };
        const rows = GameEngine.facetKeys(vision).map(f => facetRow(vision, f, labels)).join('');
        const veiledLeft = GameEngine.facetKeys(vision).some(f => !vision.revealed[f]);

        const divineWhy = GameEngine.divineBlocker(state);
        const divineTitle = vision.pendingChoice
            ? 'the veil has parted — pick the facet to reveal'
            : (divineWhy ?? 'cast for a reveal — a gamble: the veil may hold, or show what it pleases');
        const divineBtn = `<button class="divine-btn" data-vision="${vision.id}" ` +
            `title="${divineTitle}" ` +
            `${(vision.pendingChoice || divineWhy !== null || !veiledLeft || animating) ? 'disabled' : ''}>` +
            `${vision.pendingChoice ? 'Choose a facet…' : 'Divine'}</button>`;
        const warnWhy = GameEngine.warnBlocker(state, vision);
        const warnBtn = vision.warned
            ? `<span class="warned-tag">⚑ vigil kept (aid ${Math.round(vision.aid)})</span>`
            : `<button class="warn-btn" data-vision="${vision.id}" ` +
            `title="${warnWhy ?? 'share this doom: the village will prep it daily, but vigils bleed Trust'}" ` +
            `${(warnWhy !== null || animating) ? 'disabled' : ''}>Warn the village</button>`;
        const fateBtn = state.rankIndex() >= 3
            ? `<button class="fate-btn" data-vision="${vision.id}" ${(!GameEngine.canTurnFate(state) || animating) ? 'disabled' : ''}>Turn Fate</button>`
            : '';

        return `<div class="vision-card">` +
            `<div class="vision-title">◆ ${Flourish.stable('doom-title', vision.id)} <span class="vision-age">(seen day ${vision.arrivedDay})</span></div>` +
            rows +
            `<div class="vision-assess">${GameEngine.preparednessText(state, vision)}</div>` +
            `<div class="vision-actions">${divineBtn}${warnBtn}${fateBtn}</div>` +
            `</div>`;
    }

    function updateVisions() {
        const box = el('vision-list');
        if (state.visions.length === 0) {
            box.innerHTML = `<div class="no-visions">${Flourish.stable('quiet-candle', state.day)}</div>`;
            return;
        }
        box.innerHTML = state.visions.map(visionCard).join('');
    }

    function updatePrepPanel() {
        const building = state.buildingAtOracle();
        const panel = el('prep-panel');
        if (!building || panel.classList.contains('hidden')) return;
        el('prep-title').textContent = `Wards at ${building.name}`;
        el('prep-list').innerHTML = Object.keys(A.PREPS).map(kind => {
            const spec = A.PREPS[kind];
            const strength = building.preps[kind] ?? 0;
            const counters = Object.keys(A.EVENTS).find(e => A.EVENTS[e].prep === kind);
            const disabled = animating || !GameEngine.canPrepareHere(state) ? 'disabled' : '';
            return `<div class="prep-row">` +
                `<div><span class="prep-name">${spec.name}</span> <span class="prep-strength">${strength > 0 ? '· ' + strength : ''}</span>` +
                `<div class="prep-desc">${spec.desc} — against ${A.EVENTS[counters].name}</div></div>` +
                `<button class="prep-raise" data-prep="${kind}" ${disabled}>Raise (${A.TUNING.PREP_COST} sup)</button>` +
                `</div>`;
        }).join('');
    }

    function updateAll() {
        updateHud();
        updateVisions();
        updatePrepPanel();
    }

    function afterAction(msgs) {
        if (msgs === null) return;
        logAll(msgs);
        updateAll();
        saveHook();
    }

    // ---- end of day (animated) ----

    function endDay() {
        if (animating) return;
        animating = true;
        selected = false;
        updateAll();
        const report = GameEngine.endDay(state);

        const queue = report.resolutions.slice();
        const step = () => {
            const rec = queue.shift();
            if (!rec) {
                logAll(report.msgs);
                animating = false;
                updateAll();
                saveHook();
                return;
            }
            centerOn(rec.hexKey);
            flashes.push({ hexKey: rec.hexKey, start: performance.now(), dur: 900 });
            setTimeout(() => logAll(rec.msgs, rec.death ? 'log-death' : 'log-doom'), 400);
            setTimeout(step, 1100);
        };
        setTimeout(step, 200);
    }

    // ---- input ----

    function onCanvasClick(x, y) {
        if (animating) return;
        const hex = screenToHex(x, y);
        if (hex.q === state.oracle.q && hex.r === state.oracle.r) {
            selected = !selected;
            return;
        }
        if (!selected) return;
        if (GameEngine.moveOracle(state, hex.q, hex.r)) {
            updateAll();
            saveHook();
        }
    }

    function onHover(x, y) {
        const hex = screenToHex(x, y);
        const h = state.hexes.get(hex.key());
        if (!h) { el('hover-info').textContent = ''; return; }
        const bits = [h.terrain];
        if (h.feature === 'field') bits.push('a workable field');
        if (h.feature === 'memorial') bits.push('a memorial stone');
        if (h.buildingId !== null) {
            const building = state.buildingById(h.buildingId);
            bits.length = 0;
            bits.push(building.ruined ? `${building.name} (ruined)` : building.name);
            const wards = Object.keys(building.preps)
                .map(k => `${A.PREPS[k].name} ${building.preps[k]}`).join(', ');
            if (wards) bits.push(wards);
            const folk = building.occupantIds
                .map(id => state.villagerById(id))
                .filter(v => v.alive)
                .map(v => `${v.name} ${v.role}`).join(', ');
            if (folk) bits.push(folk);
        }
        if (hex.q === state.oracle.q && hex.r === state.oracle.r) bits.push('you, the augur');
        el('hover-info').textContent = bits.join(' · ');
    }

    function bindCanvas() {
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        canvas.addEventListener('mousedown', e => {
            if (e.button === 2) dragging = { x: e.clientX, y: e.clientY, moved: false };
        });
        window.addEventListener('mousemove', e => {
            if (dragging) {
                pan.x += e.clientX - dragging.x;
                pan.y += e.clientY - dragging.y;
                dragging = { x: e.clientX, y: e.clientY, moved: true };
            }
            if (state) onHover(e.clientX, e.clientY);
        });
        window.addEventListener('mouseup', e => {
            if (e.button === 2) dragging = null;
        });
        canvas.addEventListener('click', e => onCanvasClick(e.clientX, e.clientY));
    }

    function bindPanels() {
        el('vision-list').addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn || btn.disabled) return;
            const visionId = Number(btn.dataset.vision);
            if (btn.classList.contains('divine-btn')) {
                afterAction(GameEngine.divineAttempt(state, visionId));
            }
            if (btn.classList.contains('pick-btn')) {
                afterAction(GameEngine.divineReveal(state, visionId, btn.dataset.facet));
            }
            if (btn.classList.contains('warn-btn')) {
                afterAction(GameEngine.warn(state, visionId));
            }
            if (btn.classList.contains('fate-btn')) {
                afterAction(GameEngine.turnFate(state, visionId));
            }
        });

        el('prep-list').addEventListener('click', e => {
            const btn = e.target.closest('button.prep-raise');
            if (!btn || btn.disabled) return;
            afterAction(GameEngine.prepare(state, btn.dataset.prep));
        });

        el('work-btn').addEventListener('click', () => afterAction(GameEngine.work(state)));
        el('festival-btn').addEventListener('click', () => afterAction(GameEngine.festival(state)));
        el('prep-btn').addEventListener('click', () => {
            el('prep-panel').classList.toggle('hidden');
            updatePrepPanel();
        });
        el('prep-close').addEventListener('click', () => el('prep-panel').classList.add('hidden'));
        el('end-day').addEventListener('click', endDay);

        window.addEventListener('keydown', e => {
            if (!state || animating) return;
            if (e.target.tagName === 'INPUT') return;
            if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); endDay(); }
            if (e.key === 'w') afterAction(GameEngine.work(state));
            if (e.key === 'f') afterAction(GameEngine.festival(state));
            if (e.key === 'p') { el('prep-panel').classList.toggle('hidden'); updatePrepPanel(); }
            if (e.key === 'Escape') el('prep-panel').classList.add('hidden');
        });
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // ---- public ----

    function init(onSave) {
        saveHook = onSave;
        canvas = el('game');
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
        bindCanvas();
        bindPanels();
        requestAnimationFrame(render);
    }

    function setState(newState) {
        state = newState;
        selected = false;
        const shrine = state.buildingsOfKind('shrine')[0];
        centerOn(shrine.hexKey);
        el('log').innerHTML = '';
        log(`Day ${state.day}. ${Flourish.stable('day-dawn', state.day)}`);
        const first = state.visions[0];
        if (first) log(`${A.FLAVOR.arrival[0]} ${GameEngine.describeVision(state, first)}`);
        updateAll();
    }

    return { init, setState, log };
})();
