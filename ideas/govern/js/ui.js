// CHARTER — UI. Full re-render per action; one delegated click handler.
// Reads CharterData / CharterEngine globals; owns only transient view state.

const CharterUI = (function () {
  const D = CharterData;
  const E = CharterEngine;

  const view = { draftOpen: false, draftTemplate: null, draftDomain: null, statusMsg: '', lastLogId: 0 };
  let state = null;

  function start(seed) {
    state = E.newGame(seed);
    view.draftOpen = false;
    view.draftTemplate = null;
    view.draftDomain = null;
    view.statusMsg = '';
    view.lastLogId = 0;
    render();
  }

  // ------------------------------------------------------------- rendering
  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function button(label, action, disabled, className) {
    const b = el('button', className || 'btn');
    b.innerHTML = label;
    b.dataset.action = action;
    if (disabled) b.disabled = true;
    return b;
  }

  function render() {
    renderHeader();
    renderRealm();
    renderChronicle();
    renderStatus();
    renderEndOverlay();
  }

  function renderHeader() {
    document.getElementById('hud-season').textContent = E.seasonLabel(state.turn) + ' · Season ' + state.turn + ' of ' + D.ECON.maxTurns;
    document.getElementById('hud-ap').innerHTML = 'Action Points: <b>' + state.ap + '</b> / ' + D.ECON.apPerSeason;
    document.getElementById('hud-treasury').innerHTML = 'Treasury: <b>' + state.treasury + '</b>';
    const legit = document.getElementById('hud-legitimacy');
    legit.innerHTML = 'Legitimacy: <b>' + state.legitimacy + '</b>';
    legit.className = state.legitimacy < 30 ? 'hud-item danger' : 'hud-item';
  }

  function renderRealm() {
    const pane = document.getElementById('realm');
    pane.innerHTML = '';
    pane.appendChild(renderFactions());
    pane.appendChild(renderCharter());
    pane.appendChild(renderLawBook());
    pane.appendChild(renderPortents());
    pane.appendChild(renderActions());
    if (view.draftOpen) pane.appendChild(renderDrafting());
  }

  function renderFactions() {
    const box = el('section', 'panel');
    box.appendChild(el('h2', null, 'The Estates'));
    D.FACTION_IDS.forEach(function (f) {
      const fs = state.factions[f];
      const bandName = E.band(fs.standing);
      const row = el('div', 'faction-row');
      row.appendChild(el('span', 'faction-name', esc(D.FACTIONS[f].name) + (fs.endorsed ? ' <span class="seal" title="Has endorsed the Charter">✦</span>' : '')));
      row.appendChild(el('span', 'band band-' + bandName.toLowerCase(), bandName));
      const aud = button('Audience <span class="ap-cost">1</span>', 'audience:' + f, state.ap < 1 || state.phase !== 'playing');
      aud.title = 'Learn their exact temper and a portent of the season to come.';
      row.appendChild(aud);
      box.appendChild(row);
    });
    return box;
  }

  function renderCharter() {
    const box = el('section', 'panel');
    box.appendChild(el('h2', null, 'The Grand Charter'));
    const count = E.endorsedCount(state);
    const cons = E.contradictions(state);
    box.appendChild(el('div', 'charter-req',
      reqMark(count >= D.ECON.endorseNeed) + ' Seals: ' + count + ' of ' + D.ECON.endorseNeed + ' needed<br>' +
      reqMark(state.legitimacy >= D.ECON.ratifyLegitimacy) + ' Legitimacy ' + D.ECON.ratifyLegitimacy + '+ (now ' + state.legitimacy + ')<br>' +
      reqMark(cons.length === 0) + ' No contradictions in the law book (' + cons.length + ')'));
    D.FACTION_IDS.forEach(function (f) {
      const fs = state.factions[f];
      const met = E.priceMet(state, f);
      const warm = fs.standing >= D.ECON.warmAt;
      const row = el('div', 'price-row');
      row.appendChild(el('div', 'price-text',
        '<b>' + esc(D.FACTIONS[f].name) + ':</b> &ldquo;' + esc(D.PRICES[f].text) + '&rdquo; ' +
        (fs.endorsed ? '<span class="ok">— sealed ✦</span>'
          : reqMark(met) + (met ? '' : ' price unmet') + (warm ? '' : ' · needs Warm'))));
      if (!fs.endorsed) {
        row.appendChild(button('Seek endorsement <span class="ap-cost">2</span>', 'endorse:' + f,
          state.ap < 2 || !met || !warm || state.phase !== 'playing'));
      }
      box.appendChild(row);
    });
    const canRatify = count >= D.ECON.endorseNeed && state.legitimacy >= D.ECON.ratifyLegitimacy && cons.length === 0;
    box.appendChild(button('RATIFY THE CHARTER <span class="ap-cost">2</span>', 'ratify',
      state.ap < 2 || !canRatify || state.phase !== 'playing', 'btn btn-ratify'));
    return box;
  }

  function reqMark(met) {
    return met ? '<span class="ok">●</span>' : '<span class="bad">○</span>';
  }

  function renderLawBook() {
    const box = el('section', 'panel');
    box.appendChild(el('h2', null, 'The Law Book <span class="count">(' + state.edicts.length + ')</span>'));
    if (state.edicts.length === 0) {
      box.appendChild(el('div', 'muted', 'The book lies open and empty. The city is waiting to be written.'));
    }
    state.edicts.forEach(function (e) {
      const row = el('div', 'edict-row');
      const coin = edictCoinLabel(e);
      row.appendChild(el('span', 'edict-name',
        esc(cap(E.edictDisplayName(e.template, e.domain))) +
        (e.amended ? ' <span class="amended" title="Amended: half as likely to be probed">§</span>' : '') +
        (coin ? ' <span class="coin">' + coin + '</span>' : '')));
      const controls = el('span', 'edict-controls');
      if (!e.amended) controls.appendChild(button('Amend <span class="ap-cost">2</span>', 'amend:' + e.id, state.ap < 2 || state.phase !== 'playing'));
      controls.appendChild(button('Repeal <span class="ap-cost">1</span>', 'repeal:' + e.id, state.ap < 1 || state.phase !== 'playing'));
      row.appendChild(controls);
      box.appendChild(row);
    });
    E.contradictions(state).forEach(function (c) {
      box.appendChild(el('div', 'contradiction', '⚠ ' + esc(c.label)));
    });
    const press = ['gagged — no portents; rumors breed', 'licensed — one portent revealed', 'free — all portents revealed; scandals cut deep'][E.pressLevel(state)];
    box.appendChild(el('div', 'muted press-line', 'The press is ' + press + '.'));
    const probePct = Math.round(Math.min(D.ECON.probePerEdict * state.edicts.length, D.ECON.probeCap) * 100);
    box.appendChild(el('div', 'muted', 'Each season, a ' + probePct + '% chance the court reads one of these laws literally.'));
    return box;
  }

  function edictCoinLabel(e) {
    const t = E.previewEdict(e.template, e.domain).treasuryPerSeason;
    if (t === 0) return '';
    return (t > 0 ? '+' : '') + t + '/season';
  }

  function renderPortents() {
    const box = el('section', 'panel');
    box.appendChild(el('h2', null, 'Portents'));
    const revealed = state.upcoming.filter(function (u) { return u.revealed; });
    const hidden = state.upcoming.length - revealed.length;
    if (revealed.length === 0 && hidden === 0) {
      box.appendChild(el('div', 'muted', 'The season ahead keeps its own counsel.'));
    }
    revealed.forEach(function (u) {
      box.appendChild(el('div', 'portent', '☙ ' + esc(E.lookupEventDef(u).portent)));
    });
    if (hidden > 0) {
      box.appendChild(el('div', 'muted', hidden + ' matter' + (hidden > 1 ? 's' : '') + ' stir' + (hidden > 1 ? '' : 's') + ' unseen. An audience might surface one.'));
    }
    return box;
  }

  function renderActions() {
    const box = el('section', 'panel actions-panel');
    box.appendChild(el('h2', null, 'The Regent\'s Desk'));
    const playing = state.phase === 'playing';
    box.appendChild(button('Draft an edict <span class="ap-cost">2</span>', 'toggleDraft', state.ap < 2 || !playing));
    const fest = button('Hold a festival <span class="ap-cost">2</span> <span class="coin">−' + D.ECON.festivalCost + '</span>', 'festival', state.ap < 2 || !playing);
    if (state.festivalCooldown > 0) fest.title = 'So soon after the last? The effect will be halved.';
    box.appendChild(fest);
    const pending = state.petitions.length + state.disputes.length;
    box.appendChild(button('End the season' + (pending > 0 ? ' <span class="warn">(' + pending + ' unresolved)</span>' : ''),
      'endSeason', !playing, 'btn btn-end'));
    return box;
  }

  function renderDrafting() {
    const box = el('section', 'panel drafting');
    box.appendChild(el('h2', null, 'Drafting Table'));
    const tRow = el('div', 'choice-row');
    Object.keys(D.TEMPLATES).forEach(function (t) {
      const b = button(D.TEMPLATES[t].label, 'draftTemplate:' + t, false, 'btn' + (view.draftTemplate === t ? ' selected' : ''));
      tRow.appendChild(b);
    });
    box.appendChild(tRow);
    if (!view.draftTemplate) {
      box.appendChild(el('div', 'muted', 'Choose the instrument. A levy takes, a subsidy gives, a ban forbids, a mandate requires, a right binds your own hands.'));
      return box;
    }
    const dRow = el('div', 'choice-row');
    const targets = view.draftTemplate === 'right' ? D.FACTION_IDS : D.DOMAINS;
    targets.forEach(function (d) {
      const exists = state.edicts.some(function (e) { return e.template === view.draftTemplate && e.domain === d; });
      const label = view.draftTemplate === 'right' ? D.FACTIONS[d].name : D.DOMAIN_LABELS[d];
      dRow.appendChild(button(esc(cap(label.replace(/^the /, ''))), 'draftPreview:' + d, exists, 'btn small' + (view.draftDomain === d ? ' selected' : '')));
    });
    box.appendChild(dRow);
    if (view.draftDomain) {
      const preview = E.previewEdict(view.draftTemplate, view.draftDomain);
      const parts = preview.standings.map(function (s) {
        return esc(D.FACTIONS[s.faction].name) + ' drifts toward ' + (s.amount > 0 ? '+' : '') + s.amount;
      });
      if (preview.treasuryPerSeason !== 0) parts.push('Treasury ' + (preview.treasuryPerSeason > 0 ? '+' : '') + preview.treasuryPerSeason + '/season');
      if (parts.length === 0) parts.push('No estate is moved either way');
      box.appendChild(el('div', 'preview',
        '<b>' + esc(cap(E.edictDisplayName(view.draftTemplate, view.draftDomain))) + '</b><br>' + parts.join(' · ') +
        '<br><span class="muted">Every law can be read literally. Every law will be.</span>'));
      box.appendChild(button('Enact <span class="ap-cost">2</span>', 'draft', state.ap < 2, 'btn btn-enact'));
    }
    box.appendChild(button('Set the pen down', 'toggleDraft', false, 'btn small'));
    return box;
  }

  // ------------------------------------------------------------- chronicle
  function renderChronicle() {
    const pane = document.getElementById('chronicle');
    pane.innerHTML = '';
    state.log.forEach(function (entry) {
      pane.appendChild(renderEntry(entry));
    });
    const last = state.log[state.log.length - 1];
    if (last && last.id !== view.lastLogId) {
      view.lastLogId = last.id;
      pane.scrollTop = pane.scrollHeight;
    }
  }

  function renderEntry(entry) {
    if (entry.kind === 'season') {
      return el('div', 'log-season', '— ' + esc(entry.title) + ' —');
    }
    const node = el('article', 'log-entry log-' + entry.kind);
    node.appendChild(el('h3', null, esc(entry.title)));
    if (entry.body) node.appendChild(el('p', null, entry.body));
    if (entry.effectsSummary) node.appendChild(el('div', 'fx', esc(entry.effectsSummary)));
    if (entry.petitionUid !== undefined) appendPetitionControls(node, entry.petitionUid);
    if (entry.disputeUid !== undefined) appendDisputeControls(node, entry.disputeUid);
    return node;
  }

  function appendPetitionControls(node, uid) {
    const petition = state.petitions.find(function (p) { return p.uid === uid; });
    if (!petition) return;
    const def = E.petitionDef(petition);
    if (petition.age >= 1) node.appendChild(el('div', 'warn', 'Unanswered a season already — it festers at the next season\'s end.'));
    const controls = el('div', 'controls');
    def.options.forEach(function (opt, i) {
      const fx = E.effectsSummary(E.optionEffects(petition, opt));
      const b = button(esc(opt.label) + ' <span class="ap-cost">1</span><span class="opt-fx">' + esc(fx) + '</span>',
        'respond:' + uid + ':' + i, state.ap < 1 || state.phase !== 'playing', 'btn opt');
      controls.appendChild(b);
    });
    node.appendChild(controls);
  }

  function appendDisputeControls(node, uid) {
    const dispute = state.disputes.find(function (d) { return d.uid === uid; });
    if (!dispute) return;
    const ds = E.disputeScenario(state, dispute);
    const controls = el('div', 'controls');
    controls.appendChild(button('Uphold the letter <span class="ap-cost">1</span><span class="opt-fx">' +
      esc(E.effectsSummary(ds.scenario.uphold)) + ', Legitimacy +2</span>',
      'court:' + uid + ':uphold', state.ap < 1 || state.phase !== 'playing', 'btn opt'));
    controls.appendChild(button('Overrule <span class="ap-cost">1</span><span class="opt-fx">' +
      esc(E.effectsSummary(ds.scenario.overrule)) + ', Legitimacy −4</span>',
      'court:' + uid + ':overrule', state.ap < 1 || state.phase !== 'playing', 'btn opt'));
    controls.appendChild(button('Amend the edict <span class="ap-cost">2</span><span class="opt-fx">' +
      esc(E.effectsSummary(ds.scenario.amend)) + ', text fixed for good</span>',
      'amend:' + ds.edict.id, state.ap < 2 || state.phase !== 'playing', 'btn opt'));
    node.appendChild(controls);
  }

  function renderStatus() {
    const bar = document.getElementById('status');
    bar.textContent = view.statusMsg;
    bar.className = view.statusMsg ? 'visible' : '';
  }

  function renderEndOverlay() {
    const overlay = document.getElementById('endgame');
    if (state.phase === 'playing') { overlay.className = 'hidden'; return; }
    overlay.className = 'visible ' + (state.phase === 'won' ? 'won' : 'lost');
    const titles = {
      ratified: 'The Charter Is Law', deposed: 'Deposed', coup: 'The Coup', expired: 'The Regency Ends',
    };
    const last = state.log[state.log.length - 1];
    document.getElementById('end-title').textContent = titles[state.endReason];
    document.getElementById('end-body').textContent = last ? last.body : '';
    document.getElementById('end-score').textContent = state.score !== null ? 'Final reckoning: ' + state.score : '';
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ----------------------------------------------------------------- input
  function dispatch(actionStr) {
    const parts = actionStr.split(':');
    const kind = parts[0];
    const uiHandlers = {
      toggleDraft: function () {
        view.draftOpen = !view.draftOpen;
        view.draftTemplate = null; view.draftDomain = null;
      },
      draftTemplate: function () { view.draftTemplate = parts[1]; view.draftDomain = null; },
      draftPreview: function () { view.draftDomain = parts[1]; },
      newGame: function () { start((Math.random() * 0x7fffffff) | 0); },
    };
    if (uiHandlers[kind]) { uiHandlers[kind](); render(); return; }

    const gameActions = {
      endSeason: function () { return { type: 'endSeason' }; },
      respond: function () { return { type: 'respond', uid: Number(parts[1]), optionIndex: Number(parts[2]) }; },
      audience: function () { return { type: 'audience', faction: parts[1] }; },
      court: function () { return { type: 'court', uid: Number(parts[1]), ruling: parts[2] }; },
      amend: function () { return { type: 'amend', edictId: Number(parts[1]) }; },
      repeal: function () { return { type: 'repeal', edictId: Number(parts[1]) }; },
      draft: function () { return { type: 'draft', template: view.draftTemplate, domain: view.draftDomain }; },
      festival: function () { return { type: 'festival' }; },
      endorse: function () { return { type: 'endorse', faction: parts[1] }; },
      ratify: function () { return { type: 'ratify' }; },
    };
    if (!gameActions[kind]) return;
    const result = CharterEngine.act(state, gameActions[kind]());
    view.statusMsg = result.ok ? '' : result.msg;
    if (result.ok && kind === 'draft') { view.draftOpen = false; view.draftTemplate = null; view.draftDomain = null; }
    render();
  }

  function bind() {
    document.body.addEventListener('click', function (ev) {
      const btn = ev.target.closest('button[data-action]');
      if (!btn || btn.disabled) return;
      dispatch(btn.dataset.action);
    });
  }

  return { start: start, bind: bind };
})();
