/* The Great-Souled Sam — presentation layer. Talks to Engine, owns the DOM. */
(function () {
  'use strict';

  const E = window.Engine;
  const SVG = 'http://www.w3.org/2000/svg';
  const GOD_COLORS = { agni: '#ff8c3a', kali: '#c94fd8', yama: '#e04545' };
  const STEP_MS = 380;

  let state = null;
  let animating = false;
  let selectedChannel = 0;

  const el = (id) => document.getElementById(id);
  const map = el('map');

  /* ---------------- svg helpers ---------------- */

  function svg(tag, attrs, parent) {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    parent.appendChild(node);
    return node;
  }

  function place(node, x, y) { node.style.transform = `translate(${x}px, ${y}px)`; }

  /* ---------------- static map scenery ---------------- */

  const layers = {};
  const cityEls = {};   // id -> {base, ring, pulse, label}
  const godEls = {};    // id -> <g>
  let samEl = null;
  let eyeEl = null;
  const demonEls = {};  // cityId -> glyph

  function buildMap() {
    // stars
    const sky = svg('g', {}, map);
    let sr = 12345;
    const srand = () => { sr = (sr * 1103515245 + 12345) & 0x7fffffff; return sr / 0x7fffffff; };
    for (let i = 0; i < 90; i += 1) {
      svg('circle', {
        class: 'star', cx: (srand() * 900).toFixed(1), cy: (srand() * 620).toFixed(1),
        r: (srand() * 1.1 + 0.2).toFixed(2), opacity: (srand() * 0.7 + 0.15).toFixed(2),
      }, sky);
    }
    // the river Vedra, running past Keenset down to the southern sea
    svg('path', { class: 'river', d: 'M 470 90 C 430 180, 500 250, 455 300 C 410 350, 480 450, 445 560 C 430 600, 420 620, 415 640' }, map);

    layers.roads = svg('g', {}, map);
    layers.nodes = svg('g', {}, map);
    layers.markers = svg('g', {}, map);

    for (const [a, b] of E.MAP.edges) {
      const na = E.MAP.nodes[a]; const nb = E.MAP.nodes[b];
      svg('line', { class: 'road', x1: na.x, y1: na.y, x2: nb.x, y2: nb.y }, layers.roads);
    }
    for (const [id, node] of Object.entries(E.MAP.nodes)) buildNode(id, node);

    samEl = svg('text', { class: 'sam-marker sam-glyph' }, layers.markers);
    samEl.textContent = '☸'; // ☸ wheel of dharma
    svg('title', {}, samEl).textContent = 'Sam, the Binder of Demons';
    eyeEl = svg('text', { class: 'eye-marker' }, layers.markers);
    eyeEl.textContent = '👁'; // 👁
    svg('title', {}, eyeEl).textContent = "Heaven's last report of Sam — the gods converge here";
  }

  function buildNode(id, node) {
    const g = svg('g', {}, layers.nodes);
    if (node.kind === 'heaven') {
      svg('path', { d: `M ${node.x - 34} ${node.y + 18} L ${node.x} ${node.y - 26} L ${node.x + 34} ${node.y + 18} Z`,
        fill: '#232c55', stroke: '#5b6bb0', 'stroke-width': 2 }, g);
      const glyph = svg('text', { x: node.x, y: node.y + 12, class: 'node-label special', 'text-anchor': 'middle', 'font-size': 16 }, g);
      glyph.textContent = '✵';
      label(g, node, 'special', 38);
      svg('title', {}, g).textContent = 'The Celestial City on the polar ice. No mortal road leads here.';
      return;
    }
    if (node.kind === 'hellwell') {
      svg('circle', { cx: node.x, cy: node.y, r: 16, fill: '#1a0f0f', stroke: '#7a3520', 'stroke-width': 2 }, g);
      const flame = svg('text', { x: node.x, y: node.y + 6, 'text-anchor': 'middle', 'font-size': 16 }, g);
      flame.textContent = '🔥';
      const base = g.firstChild;
      cityEls[id] = { base, ring: null, pulse: null, g };
      base.classList.add('city-base', 'hellwell');
      label(g, node, 'special', 32);
      svg('title', {}, g).textContent = 'Hellwell — the flame pits of the Rakasha. Gods will not set foot here. Sam may bind demons.';
      return;
    }
    const R = 14; const ringR = 19;
    const ring = svg('circle', { class: 'conv-ring', cx: node.x, cy: node.y, r: ringR }, g);
    const C = 2 * Math.PI * ringR;
    ring.setAttribute('stroke-dasharray', C);
    ring.setAttribute('stroke-dashoffset', C);
    ring.setAttribute('transform', `rotate(-90 ${node.x} ${node.y})`);
    const base = svg('circle', { class: 'city-base', cx: node.x, cy: node.y, r: R }, g);
    const pulse = svg('circle', { class: 'pulse-ring', cx: node.x, cy: node.y, r: R, style: 'display:none' }, g);
    label(g, node, '', 36);
    const tip = svg('title', {}, g);
    cityEls[id] = { base, ring, pulse, g, tip, C };
  }

  function label(g, node, extra, dy) {
    const t = svg('text', { class: `node-label ${extra}`, x: node.x, y: node.y + dy }, g);
    t.textContent = node.name;
  }

  /* ---------------- rendering ---------------- */

  function render() {
    renderMapState();
    renderStats();
    renderBodyCard();
    renderActions();
    renderGodList();
    renderLog();
    renderModals();
  }

  function renderMapState() {
    const acts = E.availableActions(state);
    for (const [id, parts] of Object.entries(cityEls)) {
      if (parts.ring === null) { // hellwell
        parts.base.classList.toggle('travelable', acts.travel.includes(id));
        continue;
      }
      const city = state.cities[id];
      parts.base.classList.toggle('converted', E.isConverted(city));
      parts.base.classList.toggle('burned', city.burned);
      parts.base.classList.toggle('travelable', acts.travel.includes(id));
      parts.pulse.style.display = acts.travel.includes(id) ? '' : 'none';
      parts.ring.setAttribute('stroke-dashoffset', parts.C * (1 - Math.min(100, city.conversion) / 100));
      parts.tip.textContent = cityTooltip(id, city);
      updateDemonGlyph(id, city);
    }
    // Sam
    if (state.sam.city !== null) {
      const n = E.MAP.nodes[state.sam.city];
      samEl.style.display = '';
      samEl.setAttribute('x', n.x - 16);
      samEl.setAttribute('y', n.y - 14);
      samEl.style.opacity = state.sam.hidden ? 0.65 : 1;
    } else {
      samEl.style.display = 'none';
    }
    // last-seen eye
    if (state.sam.lastSeen !== null) {
      const n = E.MAP.nodes[state.sam.lastSeen];
      eyeEl.style.display = '';
      eyeEl.setAttribute('x', n.x + 18);
      eyeEl.setAttribute('y', n.y - 12);
    } else {
      eyeEl.style.display = 'none';
    }
    // gods
    for (const god of state.gods) {
      if (god.status === 'hunting') positionGod(god);
      else if (godEls[god.id]) { godEls[god.id].remove(); delete godEls[god.id]; }
    }
  }

  function cityTooltip(id, city) {
    const bits = [`${E.MAP.nodes[id].name} — conversion ${Math.min(100, city.conversion)}%`];
    if (E.isConverted(city)) bits.push('Follows the Path: tithes karma and enlightenment each turn.');
    if (city.burned) bits.push('Burned by Agni. The word can be preached here again, over the ashes.');
    if (city.possessedBy !== null) bits.push(`Possessed by ${city.possessedBy} — tithes stopped. Travel here and exorcise.`);
    return bits.join('\n');
  }

  function updateDemonGlyph(cityId, city) {
    const existing = demonEls[cityId];
    if (city.possessedBy === null) {
      if (existing) { existing.remove(); delete demonEls[cityId]; }
      return;
    }
    if (existing) return;
    const n = E.MAP.nodes[cityId];
    const d = svg('text', { class: 'demon-marker', x: n.x + 17, y: n.y + 22 }, layers.markers);
    d.textContent = '👹'; // 👹
    demonEls[cityId] = d;
  }

  function ensureGodEl(god) {
    if (godEls[god.id]) return godEls[god.id];
    const g = svg('g', { class: 'god-marker' }, layers.markers);
    svg('circle', { cx: 0, cy: 0, r: 11, fill: GOD_COLORS[god.id] }, g);
    const t = svg('text', { x: 0, y: 4.5 }, g);
    t.textContent = god.name[0];
    svg('title', {}, g).textContent = `${god.name}, ${god.title} — power ${god.power}. ${god.trait}.`;
    godEls[god.id] = g;
    return g;
  }

  function positionGod(god) {
    const g = ensureGodEl(god);
    const n = E.MAP.nodes[god.city];
    const idx = state.gods.filter((x) => x.status === 'hunting').findIndex((x) => x.id === god.id);
    place(g, n.x + 16 + (idx * 4), n.y + (idx * 6) - 4);
    g.querySelector('title').textContent = `${god.name}, ${god.title} — power ${god.power}. ${god.trait}.`;
    const harried = E.demonBoundTo(state, god.id);
    let mark = g.querySelector('.harried');
    if (harried && !mark) {
      mark = svg('text', { class: 'demon-marker harried', x: 0, y: -14 }, g);
      mark.textContent = '👹';
    }
    if (!harried && mark) mark.remove();
  }

  function renderStats() {
    el('stat-turn').textContent = state.turn;
    el('stat-karma').textContent = state.karma;
    el('stat-enl').textContent = `${Math.min(100, state.enlightenment)} / 100`;
    el('stat-wrath').textContent = `${state.wrath} / 100`;
    el('bar-enl').style.width = `${Math.min(100, state.enlightenment)}%`;
    el('bar-wrath').style.width = `${state.wrath}%`;
  }

  function renderBodyCard() {
    const b = E.body(state);
    el('body-name').textContent = b.name;
    el('body-perk').textContent = `${b.perkText}. Battle power ${b.power}.`;
    const s = el('sam-status');
    if (state.sam.city === null) {
      s.innerHTML = '<span class="hidden-no">Between bodies.</span>';
    } else if (state.sam.hidden) {
      s.innerHTML = 'Heaven has lost him: <span class="hidden-yes">hidden</span>';
    } else {
      s.innerHTML = 'Heaven knows this face: <span class="hidden-no">revealed</span>';
    }
  }

  function renderActions() {
    const box = el('action-buttons');
    box.innerHTML = '';
    if (state.phase !== 'play') { el('travel-hint').style.display = 'none'; return; }
    el('travel-hint').style.display = '';
    const acts = E.availableActions(state);

    if (state.sam.city !== 'hellwell') {
      const converted = state.cities[state.sam.city] && E.isConverted(state.cities[state.sam.city]);
      addBtn(box, 'Preach the Word <span class="cost">— spread the faith, reveal yourself</span>',
        acts.preach, () => act({ type: 'preach' }), converted ? 'This city is already converted.' : '');
    }
    addBtn(box, 'Meditate <span class="cost">— +4 karma, slip from sight</span>',
      acts.meditate, () => act({ type: 'meditate' }), '');
    for (const godId of acts.bind.gods) {
      const god = state.gods.find((g) => g.id === godId);
      addBtn(box, `Bind a demon against ${god.name} <span class="cost">— ${acts.bind.cost} karma</span>`,
        acts.bind.can, () => act({ type: 'bind', god: godId }), '');
    }
    if (state.sam.city === 'hellwell' && acts.bind.gods.length === 0) {
      const p = document.createElement('div');
      p.className = 'hint';
      p.textContent = 'The flame pits roar, but no god walks the world to be harried.';
      box.appendChild(p);
    }
    const here = state.cities[state.sam.city];
    if (here && here.possessedBy !== null) {
      addBtn(box, `Exorcise ${here.possessedBy} <span class="cost">— ${acts.exorcise.cost} karma</span>`,
        acts.exorcise.can, () => act({ type: 'exorcise' }), '');
    }
  }

  function addBtn(box, html, enabled, onClick, tip) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.innerHTML = html;
    b.disabled = !enabled || animating;
    if (tip) b.title = tip;
    b.addEventListener('click', onClick);
    box.appendChild(b);
  }

  function renderGodList() {
    const box = el('god-list');
    box.innerHTML = '';
    for (const god of state.gods) {
      const row = document.createElement('div');
      row.className = 'god-row';
      const dot = document.createElement('span');
      dot.className = 'god-dot';
      dot.style.background = GOD_COLORS[god.id];
      const name = document.createElement('span');
      name.className = 'god-name';
      name.textContent = god.name;
      const status = document.createElement('span');
      status.className = 'god-status';
      status.textContent = godStatusText(god);
      row.append(dot, name, status);
      box.appendChild(row);
    }
  }

  function godStatusText(god) {
    if (god.status === 'hunting') {
      const harried = E.demonBoundTo(state, god.id);
      return `hunting (power ${god.power}) — at ${E.MAP.nodes[god.city].name}${harried ? `, harried by ${harried.name}` : ''}`;
    }
    if (state.wrath < god.threshold) return `waits in Heaven until Wrath reaches ${god.threshold}`;
    if (god.respawnIn > 0) return `the Lords of Karma grow him a new body (${god.respawnIn} turns)`;
    return 'descending…';
  }

  function renderLog() {
    const box = el('log');
    box.innerHTML = '';
    for (const entry of state.log.slice(-60)) {
      const p = document.createElement('p');
      p.className = `k-${entry.kind}`;
      p.innerHTML = `<span class="turn-no">${entry.turn}</span>${entry.text}`;
      box.appendChild(p);
    }
    box.scrollTop = box.scrollHeight;
  }

  /* ---------------- modals ---------------- */

  function renderModals() {
    el('modal-confront').classList.toggle('hidden', state.phase !== 'confront' || animating);
    el('modal-death').classList.toggle('hidden', state.phase !== 'dead' || animating);
    if (state.phase === 'confront' && !animating) fillConfront();
    if (state.phase === 'dead' && !animating) fillDeath();
    if ((state.phase === 'won' || state.phase === 'lost') && !animating) showEnding();
  }

  function fillConfront() {
    const god = state.gods.find((g) => g.id === state.confront.god);
    const b = E.body(state);
    el('confront-title').textContent = `${god.name}, ${god.title}`;
    const demon = E.demonBoundTo(state, god.id);
    const aid = demon === null ? 0 : demon.power * (god.id === 'yama' ? 2 : 1);
    el('confront-text').textContent =
      `The god's power is ${god.power}, plus the luck of a die. Sam's body carries power ${b.power}` +
      `${aid > 0 ? ` and ${demon.name} adds ${aid}` : ''}, plus his own die — and whatever karma he dares to burn.`;
    el('confront-aid').textContent = demon === null
      ? (god.id === 'yama' ? 'A bound demon would fight the deathgod at double strength. Sam has none.' : '')
      : `${demon.name} of the Rakasha circles above, eager. (+${aid} power)`;
    const row = el('channel-row');
    row.innerHTML = '';
    const acts = E.availableActions(state);
    selectedChannel = Math.min(selectedChannel, acts.confront.channelMax);
    for (let pips = 0; pips <= acts.confront.channelMax; pips += 1) {
      const btn = document.createElement('button');
      btn.className = 'btn' + (pips === selectedChannel ? ' selected' : '');
      btn.innerHTML = pips === 0 ? 'none' : `+${pips} <span class="cost">(${pips * E.T.CHANNEL_STEP}k)</span>`;
      btn.addEventListener('click', () => { selectedChannel = pips; fillConfront(); });
      row.appendChild(btn);
    }
    el('btn-flee').textContent = E.body(state).perk === 'elusive'
      ? 'Flee (this body always escapes)' : 'Flee (even odds)';
  }

  function fillDeath() {
    const acts = E.availableActions(state);
    el('death-text').textContent =
      `The body is slain, but the Lords of Karma can be paid. A new body costs ${acts.rebirth.cost} karma ` +
      `(Sam has ${state.karma}) and requires one converted city standing to wake in.`;
    const btn = el('btn-rebirth');
    btn.textContent = `Buy a new body (${acts.rebirth.cost} karma)`;
    btn.disabled = !acts.rebirth.can;
  }

  function showEnding() {
    const overlay = el('overlay');
    overlay.classList.remove('hidden');
    el('btn-begin').textContent = 'Tell the tale again';
    if (state.phase === 'won') {
      el('overlay-title').textContent = 'The Age of Reason';
      el('overlay-text').innerHTML =
        `<p>Enlightenment has reached the hundred cities. The temples empty; the pray-o-mats rust; the presses of Keenset run all night, printing what may not be unprinted.</p>
         <p class="quote">"Then, one day, the thunder ceased. And it was enough."</p>
         <p>Heaven still glitters on its polar ice — but no one is looking up anymore. Sam won in ${state.turn} turns, dying ${state.deaths} time${state.deaths === 1 ? '' : 's'} along the way.</p>`;
    } else {
      el('overlay-title').textContent = 'The Real Death';
      el('overlay-text').innerHTML =
        `<p>No karma. No haven. No body. The Lords of Karma close their ledger, and the name of Sam becomes a story mothers tell — quietly, where the priests cannot hear.</p>
         <p class="quote">"It is said that when the Buddha died, it was only a passing. This time, it was not."</p>
         <p>Sam endured ${state.turn} turns and ${state.deaths} rebirth${state.deaths === 1 ? '' : 's'}. Enlightenment reached ${Math.min(100, state.enlightenment)} of 100.</p>`;
    }
  }

  function showIntro() {
    el('overlay-title').textContent = 'Lord of Light';
    el('overlay-text').innerHTML =
      `<p class="quote">"His followers called him <em>Mahasamatman</em> and said he was a god. He preferred to drop the Maha- and the -atman, however, and called himself Sam. He never claimed to be a god. But then, he never claimed not to be a god."</p>
       <p>The crew of the <em>Star of India</em> rule this world as the gods of the Hindu pantheon, hoarding the machines of rebirth and keeping mankind in a beautiful, obedient dark age. You are Sam — first among their crew, last among their believers.</p>
       <p><strong>Preach</strong> in the cities to spread Acceleration and raise <strong>Enlightenment to 100</strong>. But every sermon reveals you, and every converted city stokes <strong>Heaven's Wrath</strong> — until the gods themselves descend to hunt you: Agni, who burns; Kali, who runs; Yama, who does not miss.</p>
       <p><strong>Karma</strong> is everything: it buys battle-power, it binds the treacherous Rakasha demons at Hellwell to harry your hunters — and when a god kills you, it buys your next body. Die without it, and the death is real.</p>`;
    el('btn-begin').textContent = 'Take up the burden';
    el('overlay').classList.remove('hidden');
  }

  /* ---------------- turn animation ---------------- */

  function animateEvents(events, done) {
    if (events.length === 0) { done(); return; }
    animating = true;
    let i = 0;
    const step = () => {
      if (i >= events.length) { animating = false; done(); return; }
      playEvent(events[i]);
      i += 1;
      setTimeout(step, STEP_MS);
    };
    step();
  }

  function playEvent(ev) {
    if (ev.type === 'godMove' || ev.type === 'deploy') {
      const god = state.gods.find((g) => g.id === ev.god);
      const g = ensureGodEl(god);
      const n = E.MAP.nodes[ev.type === 'deploy' ? 'heaven' : ev.to];
      place(g, n.x + 16, n.y - 4);
      return;
    }
    if (ev.type === 'burn') { flash(cityEls[ev.city].base, 'flash-burn'); return; }
    if (ev.type === 'purge') { flash(cityEls[ev.city].base, 'flash-fight'); return; }
    if (ev.type === 'convert') { flash(cityEls[ev.city].ring, 'flash-fight'); return; }
    if (ev.type === 'possess') { flash(cityEls[ev.city].base, 'flash-fight'); return; }
    if (ev.type === 'confront' || ev.type === 'samSlain') { flash(samEl, 'flash-fight'); return; }
    if (ev.type === 'godSlain' && godEls[ev.god]) flash(godEls[ev.god], 'flash-fight');
  }

  function flash(node, cls) {
    node.classList.remove(cls);
    void node.getBoundingClientRect(); // restart the animation
    node.classList.add(cls);
  }

  /* ---------------- actions & wiring ---------------- */

  function act(action) {
    if (animating) return;
    const result = E.takeAction(state, action);
    if (!result.ok) { renderLog(); return; }
    const events = state.turnEvents;
    animating = events.length > 0; // suppress modals until the enemy phase has played out
    render(); // immediate feedback (log, stats)
    animateEvents(events, render);
  }

  function onCityClick(id) {
    if (animating || state.phase !== 'play') return;
    const acts = E.availableActions(state);
    if (!acts.travel.includes(id)) return;
    act({ type: 'travel', city: id });
  }

  function newGame() {
    state = E.newGame(Math.floor(Math.random() * 2 ** 31));
    for (const id of Object.keys(godEls)) { godEls[id].remove(); delete godEls[id]; }
    for (const id of Object.keys(demonEls)) { demonEls[id].remove(); delete demonEls[id]; }
    selectedChannel = 0;
    render();
  }

  buildMap();
  for (const [id, parts] of Object.entries(cityEls)) {
    parts.base.addEventListener('click', () => onCityClick(id));
  }
  el('btn-fight').addEventListener('click', () => act({ type: 'fight', channel: selectedChannel * E.T.CHANNEL_STEP }));
  el('btn-flee').addEventListener('click', () => act({ type: 'flee' }));
  el('btn-rebirth').addEventListener('click', () => act({ type: 'rebirth' }));
  el('btn-fate').addEventListener('click', () => act({ type: 'acceptFate' }));
  el('btn-begin').addEventListener('click', () => {
    el('overlay').classList.add('hidden');
    if (state === null || state.phase === 'won' || state.phase === 'lost') newGame();
  });

  newGame();
  showIntro();
})();
