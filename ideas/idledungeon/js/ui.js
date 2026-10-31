// DOM side: the two lists with drag and drop, the status bar, the event log, save/load,
// and the main loop. Reads state through the engine and changes it only through commands.
(function (ID) {
  const E = ID.Engine, N = ID.N, R = ID.Render, fmt = ID.fmt;
  const $ = id => document.getElementById(id);

  const OWNER = {
    warrior: ['Warrior', '#8a9099'], archer: ['Archer', '#3f8f4a'], mage: ['Mage', '#3d5fd6'],
    priest: ['Priest', '#e8d27a'], party: ['Party', '#a46fd6'], dungeon: ['Dungeon', '#d65a3d'],
    bonus: ['★ Party', '#ffd84a'],
  };
  const CLS = { warrior: 'Warrior', archer: 'Archer', mage: 'Mage', priest: 'Priest' };

  let g = null;
  let rows = {};             // id → { li, fill, eta, cost, lv }
  let samples = [];          // { t, earned } for the measured XP rate
  let flashIds = new Set();

  // ---------- formatting ----------

  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
    if (s < 86400) return Math.floor(s / 3600) + 'h ' + Math.floor(s % 3600 / 60) + 'm';
    return Math.floor(s / 86400) + 'd ' + Math.floor(s % 86400 / 3600) + 'h';
  }

  const one = v => (v < 100 ? v.toFixed(1) : fmt(v));

  // How each stat reads in the list, keyed by the part after the dot.
  const STAT_FMT = {
    hp: fmt, damage: one, heal: one, armor: one,
    taunt: v => one(v) + ' cells', radius: v => one(v) + ' cells',
    interval: v => (1 / v).toFixed(2) + '/s', pierce: v => String(Math.floor(v)),
    revive: v => one(v) + 's', xpRate: v => one(v) + '/s', xpKill: v => '×' + one(v), move: v => fmt(v),
  };

  function upgradePreview(def) {
    if (!def.stat) return `depth ${g.depth} → ${g.depth + 1}, foes ×${N.DEPTH_MULT}`;
    const u = g.upgrades[def.id], f = STAT_FMT[def.stat.split('.')[1]];
    const now = E.stat(g, def.stat);
    u.level++;
    const next = E.stat(g, def.stat);
    u.level--;
    return `${f(now)} → ${f(next)}` + (def.foeMult !== 1 ? `, foes ×${def.foeMult}` : '');
  }

  // A bonus reads as its change to every hero, keyed by how its effect works.
  const BONUS_FMT = {
    mul: (now, next) => '×' + (next / now).toFixed(2),
    quicker: (now, next) => '×' + (now / next).toFixed(2),
    add: (now, next) => '+' + one(next - now),
  };

  function bonusPreview(def) {
    const eff = ID.BONUSES[def.kind].effect, n = g.boons[def.kind];
    const now = ID.EFFECTS[eff](1, n, N.BONUS_MULT), next = ID.EFFECTS[eff](1, n + def.amount, N.BONUS_MULT);
    return `one-time · all ${def.label.toLowerCase()} ${BONUS_FMT[eff](now, next)}`;
  }

  // The second line of a row.
  const META = {
    upgrade: def => `Lv ${g.upgrades[def.id].level} · ${upgradePreview(def)}`,
    bonus: bonusPreview,
  };

  const label = id => { const d = E.item(g, id); return `${OWNER[d.owner][0]} ${d.label}`; };

  // ---------- lists ----------

  function makeRow(id, queued) {
    const def = E.item(g, id);
    const li = document.createElement('li');
    li.className = 'row ' + def.buy;
    li.dataset.id = id;
    li.style.setProperty('--owner', OWNER[def.owner][1]);
    li.innerHTML =
      `<span class="grip">⋮⋮</span>` +
      `<span class="label"><em>${OWNER[def.owner][0]}</em> ${def.label}</span>` +
      `<span class="cost"></span>` +
      `<span class="meta"><span class="lv"></span><span class="eta"></span></span>` +
      (queued ? `<div class="fill"></div>` : '');
    const r = { li, cost: li.querySelector('.cost'), lv: li.querySelector('.lv'), eta: li.querySelector('.eta'), fill: li.querySelector('.fill') };
    r.cost.textContent = fmt(E.cost(g, id));
    r.lv.textContent = META[def.buy](def);
    if (flashIds.has(id)) li.classList.add('bought');
    rows[id] = r;
    return li;
  }

  function renderLists() {
    rows = {};
    const p = $('purchase'), a = $('available');
    p.replaceChildren(...g.purchase.map(id => makeRow(id, true)));
    a.replaceChildren(...g.available.map(id => makeRow(id, false)));
    if (g.purchase[0]) rows[g.purchase[0]].li.classList.add('head');
    flashIds.clear();
  }

  function measuredRate() {
    const passive = E.stat(g, 'party.xpRate');
    if (samples.length < 2) return passive;
    const a = samples[0], b = samples[samples.length - 1];
    return b.t - a.t < 3 ? passive : Math.max(passive, (b.earned - a.earned) / (b.t - a.t));
  }

  function live() {
    samples.push({ t: g.time, earned: g.earned });
    while (samples.length > 2 && g.time - samples[0].t > 30) samples.shift();
    const rate = measuredRate();
    $('depth').textContent = g.depth;
    $('best').textContent = g.best > g.depth ? `best ${g.best}` : '';
    $('xp').textContent = fmt(g.xp);
    $('rate').textContent = one(rate);
    $('foes').textContent = E.foeScale(g) > 1 ? `foes ×${one(E.foeScale(g))}` : '';

    let cum = 0;
    g.purchase.forEach((id, i) => {
      const r = rows[id];
      if (!r) return;
      cum += E.cost(g, id);
      const need = cum - g.xp;
      r.eta.textContent = need <= 0 ? 'now' : '~' + fmtTime(need / rate);
      if (r.fill) r.fill.style.width = i === 0 ? Math.min(100, g.xp / E.cost(g, id) * 100) + '%' : '0';
    });
    const head = g.purchase[0];
    $('next').innerHTML = head
      ? `next: <b>${label(head)}</b> in ~${fmtTime(Math.max(0, E.cost(g, head) - g.xp) / rate)}`
      : 'queue empty: drag upgrades in';
  }

  // ---------- drag and drop (pointer events: mouse anywhere on a row, touch on the grip) ----------

  let drag = null;

  function overBox(box, x, y) {
    const r = box.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function dropIndex(y) {
    const items = [...$('purchase').children].filter(el => el.classList.contains('row') && !el.classList.contains('dragging'));
    let i = 0;
    for (const el of items) { const r = el.getBoundingClientRect(); if (y > r.top + r.height / 2) i++; }
    return { i, before: items[i] || null };
  }

  function onDown(e) {
    const li = e.target.closest('.row');
    if (!li || e.button > 0) return;
    if (e.pointerType !== 'mouse' && !e.target.closest('.grip')) return;
    drag = { id: li.dataset.id, from: li.parentElement.id, li, x0: e.clientX, y0: e.clientY, active: false };
    if (e.pointerType === 'mouse') e.preventDefault();
  }

  function onMove(e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
      drag.active = true;
      drag.ghost = drag.li.cloneNode(true);
      drag.ghost.classList.add('ghost');
      document.body.appendChild(drag.ghost);
      drag.li.classList.add('dragging');
      drag.ph = document.createElement('li');
      drag.ph.className = 'placeholder';
    }
    e.preventDefault();
    drag.ghost.style.left = (e.clientX - 20) + 'px';
    drag.ghost.style.top = (e.clientY - 14) + 'px';
    const inQueue = overBox($('purchaseBox'), e.clientX, e.clientY);
    const inAvail = drag.from === 'purchase' && overBox($('availableBox'), e.clientX, e.clientY);
    $('purchaseBox').classList.toggle('over', inQueue);
    $('availableBox').classList.toggle('over', inAvail);
    if (inQueue) $('purchase').insertBefore(drag.ph, dropIndex(e.clientY).before);
    else drag.ph.remove();
  }

  function onUp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.active) return;
    d.ph.remove();
    const { i } = dropIndex(e.clientY);
    if (overBox($('purchaseBox'), e.clientX, e.clientY)) {
      if (d.from === 'available') E.queue(g, d.id, i); else E.reorder(g, d.id, Math.min(i, g.purchase.length - 1));
    } else if (d.from === 'purchase' && overBox($('availableBox'), e.clientX, e.clientY)) {
      E.unqueue(g, d.id);
    }
    d.ghost.remove();
    $('purchaseBox').classList.remove('over');
    $('availableBox').classList.remove('over');
    renderLists();
    live();
  }

  // Double-click shortcut: available → end of queue, queue → back to available.
  function onDouble(e) {
    const li = e.target.closest('.row');
    if (!li) return;
    if (li.parentElement.id === 'available') E.queue(g, li.dataset.id, g.purchase.length);
    else E.unqueue(g, li.dataset.id);
    renderLists();
    live();
  }

  // ---------- events → log ----------

  const LOG = {
    heroDied: e => ['death', `${e.by} felled the ${CLS[e.cls]}`],
    revived: e => ['rise', `The Priest raised the ${CLS[e.cls]}`],
    wiped: e => ['death', `The party fell on depth ${e.depth}`],
    levelEntered: e => (e.reason === 'descend' ? ['depth', `Descended to depth ${e.depth}`] : null),
    offline: e => ['rise', `While you were away (${fmtTime(e.seconds)}): +${fmt(e.xp)} XP`],
    purchased: e => ['', `Bought ${label(e.id)} → Lv ${e.level}`],
    bonusBought: e => ['rise', `Bought ★ Party ${ID.BONUSES[e.kind].label}`],
    chestOpened: e => CHEST_LOG[e.outcome](e),
  };

  const CHEST_LOG = {
    xp: e => ['rise', `A chest held ${fmt(e.xp)} XP`],
    ambush: e => ['death', `Ambush! ${e.spots.length} foes burst from a chest`],
    bonus: e => ['rise', `A chest held ★ Party ${ID.BONUSES[e.kind].label} (queued 2nd)`],
  };
  // Events that change what the lists show.
  const RELIST = new Set(['purchased', 'bonusBought', 'chestOpened']);

  function log(cls, text) {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    const box = $('log');
    box.prepend(div);
    while (box.children.length > 8) box.lastChild.remove();
  }

  function handle(events) {
    let relist = false;
    for (const e of events) {
      const entry = LOG[e.type] && LOG[e.type](e);
      if (entry) log(entry[0], entry[1]);
      if (RELIST.has(e.type)) relist = true;
      if (e.type === 'purchased') flashIds.add(e.id);
      if (e.type === 'offline') samples = [];
    }
    R.addEvents(events);
    if (relist && !drag) renderLists();   // mid-drag, the drop re-renders
  }

  // ---------- save / load / loop ----------

  function save() {
    try { localStorage.setItem(N.SAVE_KEY, JSON.stringify(E.serialize(g, Date.now()))); } catch (err) { /* private mode etc. */ }
  }

  function start(fresh) {
    let saved = null;
    if (!fresh) try { saved = JSON.parse(localStorage.getItem(N.SAVE_KEY)); } catch (err) { saved = null; }
    const res = saved ? E.load(saved, Date.now()) : null;
    g = res && res.ok ? res.game : E.newGame((Math.random() * 4294967296) >>> 0);
    samples = [];
    $('log').replaceChildren();
    renderLists();
    if (res && res.ok) handle(res.events);
    live();
  }

  let lastFrame = 0, lastLive = 0, lastSave = 0;
  function frame(now) {
    const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    const res = dt > N.AWAY_THRESHOLD ? E.away(g, dt) : E.tick(g, dt);
    if (res.ok) handle(res.events);
    R.draw(g, Math.min(dt, 0.1));
    if (now - lastLive > 200) { live(); lastLive = now; }
    if (now - lastSave > N.SAVE_INTERVAL * 1000) { save(); lastSave = now; }
    requestAnimationFrame(frame);
  }

  function boot() {
    R.init($('map'));
    new ResizeObserver(() => R.resize()).observe($('mapwrap'));
    for (const id of ['purchase', 'available']) {
      $(id).addEventListener('pointerdown', onDown);
      $(id).addEventListener('dblclick', onDouble);
    }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    window.addEventListener('pagehide', save);
    $('restart').addEventListener('click', () => {
      if (!confirm('Start over in a new dungeon? All progress is lost.')) return;
      try { localStorage.removeItem(N.SAVE_KEY); } catch (err) { /* ignore */ }
      start(true);
    });
    start(false);
    requestAnimationFrame(frame);
  }

  boot();
})(this.ID = this.ID || {});
