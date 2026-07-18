// Input, side panel, and turn sequencing. UI reveals mechanics: reachable hexes
// light up, attack targets ring red, the gong count turns urgent — learn by seeing.

var UI = (function () {
  const SAVE_KEY = 'riverworld.save';

  let selected = null;   // {kind:'unit', id} | {kind:'raft'} | null
  let busy = false;      // true while the enemy phase animates

  const $ = id => document.getElementById(id);

  function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

  // The leader's name is player-supplied and flows into log lines and cards,
  // which render via innerHTML — escape anything that travels that path.
  function esc(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function init() {
    $('overlay-btn').addEventListener('click', onOverlayBtn);
    $('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') onOverlayBtn(); });
    if (resumeSavedRiver()) { beginPlay(); return; }
    showNameEntry();
  }

  function showNameEntry() {
    $('overlay-text').textContent =
      'You died.\n\nAnd then you woke — young again, on a green bank beside a river without end, a grail in your hand.\n\nWhat name did you carry in life?';
    $('name-input').classList.remove('hidden');
    $('overlay-btn').textContent = 'Wake';
    $('overlay').classList.remove('hidden');
    $('name-input').focus();
  }

  // One button, two doorways: into a new life, or out of a finished one.
  function onOverlayBtn() {
    const S = Game.state();
    if (S && S.over) { localStorage.removeItem(SAVE_KEY); location.reload(); return; }
    if (S) return; // already playing
    const name = $('name-input').value.trim().slice(0, 24) || 'Richard Burton';
    Game.newGame((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0, name);
    $('name-input').classList.add('hidden');
    $('overlay').classList.add('hidden');
    beginPlay();
  }

  function beginPlay() {
    Render.init($('board'));
    bindInput();
    selectHero('burton');
    refresh();
  }

  // ---------- the River waits: persistence ----------

  function resumeSavedRiver() {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return false;
    try {
      Game.load(saved);
      return true;
    } catch (err) {
      console.error('Save could not be read — starting a new river.', err);
      localStorage.removeItem(SAVE_KEY);
      return false;
    }
  }

  function saveRiver() {
    const S = Game.state();
    if (!S || S.over) return;
    localStorage.setItem(SAVE_KEY, Game.serialize());
  }

  function newRiver() {
    if (!confirm('Abandon this river entirely and wake on a new one? The current pilgrimage is erased.')) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

  function bindInput() {
    $('board').addEventListener('click', onBoardClick);
    $('board').addEventListener('wheel', e => { e.preventDefault(); Render.scroll(e.deltaY); }, { passive: false });
    $('end-turn').addEventListener('click', endTurn);
    $('new-river').addEventListener('click', newRiver);
    document.addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); endTurn(); }
      if (e.code === 'ArrowUp') Render.scroll(-90);
      if (e.code === 'ArrowDown') Render.scroll(90);
      if (e.code === 'Tab') { e.preventDefault(); cycleSelection(); }
    });
  }

  // ---------- selection ----------

  function selectHero(heroId) {
    const u = Game.byHero(heroId);
    if (u) select({ kind: 'unit', id: u.id });
  }

  function select(sel) {
    selected = sel;
    pushSelection();
    refresh();
  }

  function selectedUnit() {
    if (!selected || selected.kind !== 'unit') return null;
    return Game.byId(selected.id) || null;
  }

  function pushSelection() {
    const S = Game.state();
    if (busy || S.over) { Render.setSelection(null, new Map(), new Set()); return; }
    if (selected && selected.kind === 'raft' && S.raft) {
      Render.setSelection(selected, Game.raftReachable(), new Set());
      return;
    }
    const u = selectedUnit();
    if (!u || u.aboard) { Render.setSelection(null, new Map(), new Set()); return; }
    const targets = new Set(Game.slaverUnits().filter(t => Game.canAttack(u, t)).map(t => t.id));
    Render.setSelection(selected, Game.reachableFor(u), targets);
  }

  function cycleSelection() {
    const foot = Game.footParty();
    if (foot.length === 0) return;
    const cur = selectedUnit();
    const idx = cur ? (foot.findIndex(u => u.id === cur.id) + 1) % foot.length : 0;
    const next = foot[idx];
    Render.centerOn(next.c, next.r);
    select({ kind: 'unit', id: next.id });
  }

  // ---------- board clicks ----------

  function onBoardClick(e) {
    if (busy || Game.state().over) return;
    const rect = $('board').getBoundingClientRect();
    const hex = Render.pixelToHex(e.clientX - rect.left, e.clientY - rect.top);
    if (!hex) return;
    const S = Game.state();

    const clicked = Game.occupant(hex.c, hex.r);
    const u = selectedUnit();

    if (clicked && clicked.side === 'slaver' && u && Game.canAttack(u, clicked)) {
      playEvents(Game.attack(u.id, clicked.id));
      return;
    }
    if (clicked && clicked.side === 'party') { select({ kind: 'unit', id: clicked.id }); return; }
    if (S.raft && S.raft.c === hex.c && S.raft.r === hex.r) { select({ kind: 'raft' }); return; }

    if (selected && selected.kind === 'raft' && S.raft) {
      if (Game.moveRaft(hex.c, hex.r)) refresh();
      return;
    }
    if (u && Game.moveTo(u.id, hex.c, hex.r)) {
      Render.centerOn(u.c, u.r);
      refresh();
    }
  }

  // ---------- event playback (death is an event, not a state check) ----------

  async function playEvents(events) {
    if (!events) return;
    busy = true;
    pushSelection();
    for (const ev of events) {
      await playOne(ev);
      if (Game.state().over) break;
    }
    busy = false;
    if (!selectedUnit() && !Game.state().over) {
      const foot = Game.footParty();
      if (foot.length > 0) selected = { kind: 'unit', id: foot[0].id };
    }
    pushSelection();
    refresh();
    checkGameOver();
  }

  const EVENT_PLAYERS = {
    async emove(ev) {
      const ms = Render.animateMove(ev.id, ev.path, ev.from);
      await sleep(ms + 40);
    },
    async hit(ev) {
      Render.flash(ev.c, ev.r, '#ff4b3b', '-' + ev.dmg, 400);
      await sleep(280);
    },
    async dread(ev) {
      Render.flash(ev.c, ev.r, '#7fb4d8', '!', 400);
      await sleep(200);
    },
    async gong() {
      Render.gongPulse();
      await sleep(650);
    },
    async drift() { await sleep(160); },
    async pdeath(ev) {
      Render.flash(ev.c, ev.r, '#000000', '✝', 700);
      await sleep(600);
    },
    async resurrect(ev) {
      Render.centerOn(ev.c, ev.r);
      Render.flash(ev.c, ev.r, '#7fb4d8', '⟳', 900);
      await sleep(800);
    },
    async gang(ev) {
      Render.flash(ev.c, ev.r, '#ff4b3b', '⚔', 700);
      await sleep(450);
    },
  };

  async function playOne(ev) {
    const player = EVENT_PLAYERS[ev.type];
    if (player) await player(ev);
    refreshPanel();
  }

  async function endTurn() {
    if (busy || Game.state().over) return;
    const events = Game.endTurn();
    await playEvents(events);
    const u = selectedUnit();
    if (u && !u.aboard) Render.centerOn(u.c, u.r);
  }

  function checkGameOver() {
    const over = Game.state().over;
    if (!over) return;
    localStorage.removeItem(SAVE_KEY);
    $('overlay-text').textContent = over.text;
    $('overlay-btn').textContent = 'Sail a New River';
    $('overlay').classList.remove('hidden');
  }

  // ---------- panel ----------

  function refresh() {
    pushSelection();
    refreshPanel();
    saveRiver();
  }

  function refreshPanel() {
    const S = Game.state();
    renderClocks(S);
    renderParty(S);
    renderActions(S);
    renderInventory(S);
    renderLog(S);
  }

  function renderClocks(S) {
    $('gong-count').textContent = S.gongIn;
    $('gong-count').parentElement.classList.toggle('urgent', S.gongIn <= 3);
    const b = Game.byHero('burton');
    $('tower').textContent = b ? b.r + ' lg' : '—';
    $('stretch').textContent = b ? MapGen.stretchOf(b.r) + ' / 5' : '—';
  }

  function renderParty(S) {
    const box = $('party');
    box.innerHTML = '';
    for (const u of Game.partyUnits()) {
      const card = document.createElement('div');
      card.className = 'unit-card'
        + (selected && selected.kind === 'unit' && selected.id === u.id ? ' selected' : '')
        + (u.acted && u.mpLeft <= 0 ? ' spent' : '');
      const starving = u.hunger >= Data.CONFIG.STARVE_AT - 6;
      const famished = Game.famished(u);
      card.innerHTML =
        `<div class="unit-glyph">${u.glyph}${u.aboard ? '🛶' : ''}</div>
         <div class="unit-body">
           <div class="unit-name">${esc(u.name)}${u.buzz ? ' 🍬' : ''}${famished ? ' <span style="color:#ff8b7b">famished</span>' : ''}</div>
           <div class="bar bar-hp${u.hp / u.maxHp <= 0.35 ? ' low' : ''}"><div class="bar-fill" style="width:${Math.max(0, 100 * u.hp / u.maxHp)}%"></div></div>
           <div class="bar bar-hunger${starving ? ' starving' : ''}"><div class="bar-fill" style="width:${Math.min(100, 100 * u.hunger / Data.CONFIG.STARVE_AT)}%"></div></div>
         </div>
         <div class="unit-stats">HP ${u.hp}/${u.maxHp}<br>ATK ${Game.atkOf(u)} · MP ${u.mpLeft}</div>`;
      card.title = Data.HEROES[u.hero].role + (famished ? ' — FAMISHED: -1 ATK, -1 MP, HP pinned low until fed' : (starving ? ' — famine soon: find a stone or eat a ration' : ''));
      card.addEventListener('click', () => select({ kind: 'unit', id: u.id }));
      box.appendChild(card);
    }
  }

  function addButton(box, label, title, danger, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title;
    if (danger) btn.className = 'danger';
    btn.addEventListener('click', onClick);
    box.appendChild(btn);
  }

  function renderActions(S) {
    const box = $('actions');
    box.innerHTML = '';
    if (busy || S.over) return;
    const u = selectedUnit();

    if (selected && selected.kind === 'raft' && S.raft) {
      if (Game.canLand()) addButton(box, '⛺ Land the Band', 'Everyone wades ashore beside the raft.', false, () => { Game.landRaft(); refresh(); });
      return;
    }
    if (!u) return;
    if (u.aboard) return;
    if (Game.canGather(u)) {
      addButton(box, `🎋 Cut Bamboo (${S.inventory.bamboo}/${Data.CONFIG.RAFT_BAMBOO})`, 'Gather one bundle toward a raft.', false,
        () => { Game.gather(u.id); refresh(); });
    }
    if (Game.canBuildRaft(u)) {
      addButton(box, '🛶 Build Raft', 'Spend the bamboo; a raft slides into the adjacent water.', false,
        () => { Game.buildRaft(u.id); refresh(); });
    }
    if (Game.canBoard(u)) {
      addButton(box, '🛶 Board Raft', 'Climb aboard. The River is faster than the bank — but no stone stands on it.', false,
        () => { Game.boardRaft(u.id); refresh(); });
    }
    if (u.hero === 'burton') {
      addButton(box, '☠ Suicide Express', `${u.name} dies on purpose: half the hoard is left behind, and the River returns them to a RANDOM stone in this stretch. Companions keep standing where they are.`, true, rideExpress);
    }
  }

  function rideExpress() {
    if (!confirm('Leave half the hoard behind and wake at a random stone in this stretch? The Express does not take requests.')) return;
    playEvents(Game.suicide());
  }

  function renderInventory(S) {
    const box = $('inventory');
    box.innerHTML = '';
    if (S.inventory.bamboo > 0) {
      const tag = document.createElement('button');
      tag.textContent = `🎍 Bamboo ×${S.inventory.bamboo}`;
      tag.disabled = true;
      box.appendChild(tag);
    }
    const u = selectedUnit();
    for (const [id, count] of Object.entries(S.inventory.items)) {
      if (count <= 0) continue;
      const item = Data.ITEMS[id];
      const btn = document.createElement('button');
      btn.textContent = `${item.glyph} ${item.name} ×${count}`;
      btn.title = item.desc + (u ? ` (use on ${u.name})` : ' (select someone first)');
      btn.disabled = busy || !u || u.aboard || !!S.over;
      btn.addEventListener('click', () => { if (Game.useItem(id, u.id)) refresh(); });
      box.appendChild(btn);
    }
  }

  function renderLog(S) {
    const box = $('log');
    box.innerHTML = S.log.map(l => `<div class="${l.cls || ''}">${esc(l.text)}</div>`).join('');
    box.scrollTop = box.scrollHeight;
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', UI.init);
