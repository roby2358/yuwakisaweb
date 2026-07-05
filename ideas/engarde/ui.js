// En Garde! — The Season in Paris
// ui.js — DOM rendering and plan collection. MIT License.

function el(id) {
  return document.getElementById(id);
}

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------- Character sheet ----------

function renderSheet(state) {
  const char = state.character;
  const rank = rankData(char);
  const club = char.clubId === null ? null : findClub(char.clubId);
  const mistress = char.mistressId === null ? null : findLady(state, char.mistressId);
  const styled = char.title === null ? char.name : char.name + ', ' + char.title;
  const rows = [
    ['Born', char.sibling + ' of a ' + char.fatherPosition + (char.orphan ? ' (orphaned)' : '')],
    ['Strength', char.str], ['Constitution', char.con], ['Expertise', char.exp],
    ['Military Ability', char.ma],
    ['Endurance', char.endCur + ' / ' + char.endMax],
    ['Social Level', char.sl + ' (peak ' + char.peakSL + ')'],
    ['Cash', char.cash + ' crowns'],
    ['Allowance', char.allowance + '/month'],
    ['Debt', char.debt > 0 ? char.debt + ' crowns' : '—'],
    ['Influence', characterInfluence(state)],
    ['Regiment', rank === null ? 'None' : rank.name + ', ' + findRegiment(char.regimentId).name],
    ['Appointment', char.appointmentId === null ? '—' : APPOINTMENTS.find(function (a) { return a.id === char.appointmentId; }).name],
    ['Club', club === null ? 'None' : club.name],
    ['Mistress', mistress === null ? 'None' : mistress.name + ' (SL ' + mistress.sl + ')'],
    ['Mentions', char.mentions],
  ];
  if (char.woundWeeks > 0) rows.push(['Wounds', char.woundWeeks + ' week(s) of rest needed']);
  el('sheet-name').innerHTML = esc(styled);
  el('sheet-rows').innerHTML = rows.map(function (r) {
    return '<div class="row"><span>' + r[0] + '</span><b>' + esc(String(r[1])) + '</b></div>';
  }).join('');
  el('status-need').textContent = 'Hold: ' + char.sl + ' pts · Rise: ' + (3 * (char.sl + 1)) + ' pts' + (char.carrySP !== 0 ? ' · carried: ' + formatSP(char.carrySP) : '');
}

// ---------- Society panels ----------

function renderSociety(state) {
  el('npc-list').innerHTML = state.npcs.map(function (npc) {
    if (!npc.alive) return '<div class="soc dead">&#8224; ' + esc(npc.name) + '</div>';
    const reg = npc.regimentId === null ? 'no regiment' : findRegiment(npc.regimentId).name;
    const grudge = npc.grudge >= 2 ? ' &#9876;' : '';
    return '<div class="soc"><b>' + esc(npc.name) + grudge + '</b><span>SL ' + npc.sl + ' · ' + esc(reg) + '</span></div>';
  }).join('');
  el('lady-list').innerHTML = state.ladies.slice().sort(function (a, b) { return b.sl - a.sl; }).map(function (lady) {
    const tags = [lady.beautiful ? 'beautiful' : '', lady.wealthy ? 'wealthy' : '', lady.influential ? 'influential' : ''].filter(Boolean).join(', ');
    const who = ladyAttachment(state, lady);
    return '<div class="soc"><b>' + esc(lady.name) + '</b><span>SL ' + lady.sl + (tags ? ' · ' + tags : '') + (who ? ' · ' + esc(who) : '') + '</span></div>';
  }).join('');
}

function ladyAttachment(state, lady) {
  if (lady.lover === null) return '';
  if (lady.lover === 'player') return 'yours';
  const npc = findNpc(state, lady.lover);
  return npc === undefined ? '' : 'with ' + npc.name;
}

// ---------- Affairs ----------

const AFFAIR_BUTTONS = {
  insult: [['challenge', 'Demand satisfaction'], ['letpass', 'Let it pass (-2)']],
  poach: [['challenge', 'Demand satisfaction'], ['letpass', 'Look away']],
  challenged: [['accept', 'Accept the challenge'], ['refuse', 'Refuse (coward!)']],
};

function renderAffairs(state) {
  const box = el('affairs');
  if (state.affairs.length === 0) {
    box.innerHTML = '';
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  box.innerHTML = '<h3>Affairs of Honour</h3>' + state.affairs.map(function (affair, i) {
    const npc = findNpc(state, affair.npcId);
    const buttons = AFFAIR_BUTTONS[affair.type].map(function (b) {
      return '<button data-affair="' + i + '" data-response="' + b[0] + '">' + b[1] + '</button>';
    }).join(' ');
    return '<div class="affair"><p><b>' + esc(npc.name) + '</b> — ' + esc(affair.reason) + '</p>' + buttons + '</div>';
  }).join('');
}

// ---------- Week planner ----------

function actionChoices(state) {
  const char = state.character;
  const choices = [['idle', WEEK_ACTIONS.idle.label]];
  if (char.regimentId !== null) choices.push(['duty', WEEK_ACTIONS.duty.label]);
  if (char.clubId !== null) choices.push(['carouse', WEEK_ACTIONS.carouse.label]);
  choices.push(['bawdy', WEEK_ACTIONS.bawdy.label]);
  choices.push(['gamble', WEEK_ACTIONS.gamble.label]);
  if (courtableLadies(state).length > 0) choices.push(['court', WEEK_ACTIONS.court.label]);
  if (toadyTargets(state).length > 0) choices.push(['toady', WEEK_ACTIONS.toady.label]);
  if (nextRankPurchase(char) !== null) choices.push(['petition', WEEK_ACTIONS.petition.label]);
  if (prefermentTargets(state).length > 0) choices.push(['preferment', WEEK_ACTIONS.preferment.label]);
  return choices;
}

function courtableLadies(state) {
  return state.ladies.filter(function (l) { return l.lover !== 'player'; });
}

function toadyTargets(state) {
  return state.npcs.filter(function (n) { return n.alive && n.sl > state.character.sl; });
}

function prefermentTargets(state) {
  const targets = [];
  APPOINTMENTS.forEach(function (a, i) {
    if (state.character.appointmentId !== a.id && appointmentEligible(state, a)) targets.push({ kind: 'appointment', index: i, label: a.name });
  });
  TITLES.forEach(function (t, i) {
    if (titleEligible(state, i)) targets.push({ kind: 'title', index: i, label: 'The title of ' + t.name });
  });
  GENERAL_RANKS.forEach(function (g, i) {
    if (generalRankEligible(state, i)) targets.push({ kind: 'generalRank', index: i, label: 'Promotion to ' + g.name });
  });
  return targets;
}

function weekParamsHTML(state, week, action) {
  if (action === 'gamble') {
    const venue = gamblingVenue(state.character);
    const limit = venue.houseLimit === null ? 'no limit' : 'limit ' + venue.houseLimit;
    return 'stake <input type="number" class="p-stake" data-week="' + week + '" value="' + Math.max(10, venue.minBet) + '" min="' + venue.minBet + '"> × ' +
      'bets <input type="number" class="p-bets" data-week="' + week + '" value="3" min="1" max="' + MAX_BETS_PER_WEEK + '"> <small>(' + limit + ')</small>';
  }
  if (action === 'court') {
    return '<select class="p-lady" data-week="' + week + '">' + courtableLadies(state).map(function (l) {
      const need = courtingRollNeeded(state.character.sl - l.sl) + (l.lover !== null ? 2 : 0);
      const needText = need > 6 ? 'hopeless' : 'needs ' + need + '+';
      return '<option value="' + l.id + '">' + esc(l.name) + ' (SL ' + l.sl + ', ' + COURTING_COST_MULT * l.sl + ' cr, ' + needText + ')</option>';
    }).join('') + '</select>';
  }
  if (action === 'toady') {
    return '<select class="p-npc" data-week="' + week + '">' + toadyTargets(state).map(function (n) {
      return '<option value="' + n.id + '">' + esc(n.name) + ' (SL ' + n.sl + ')</option>';
    }).join('') + '</select>';
  }
  if (action === 'preferment') {
    return '<select class="p-pref" data-week="' + week + '">' + prefermentTargets(state).map(function (t) {
      return '<option value="' + t.kind + ':' + t.index + '">' + esc(t.label) + '</option>';
    }).join('') + '</select>';
  }
  return '';
}

// Wounds claim the opening weeks; required duty is pre-set in the last slots.
function plannerPresets(char) {
  const woundIdle = Math.min(4, char.woundWeeks);
  const dutyNeeded = requiredDutyWeeks(char);
  const presets = [];
  for (let week = 0; week < 4; week++) {
    if (week < woundIdle) {
      presets.push({ action: 'idle', locked: true });
    } else if (week >= 4 - dutyNeeded) {
      presets.push({ action: 'duty', locked: false });
    } else {
      presets.push({ action: 'idle', locked: false });
    }
  }
  return presets;
}

function renderPlanner(state) {
  const planner = el('planner');
  if (state.affairs.length > 0) {
    planner.innerHTML = '<p class="note">Affairs of honour must be answered before you can plan the month.</p>';
    return;
  }
  const char = state.character;
  if (char.atFront !== null) {
    renderFrontPlanner(state, planner);
    return;
  }
  const choices = actionChoices(state);
  const presets = plannerPresets(char);
  let html = '<h3>Plan of the Month — ' + esc(monthLabel(state)) + '</h3>';
  for (let week = 0; week < 4; week++) {
    const preset = presets[week];
    const options = choices.map(function (c) {
      const selected = c[0] === preset.action ? ' selected' : '';
      return '<option value="' + c[0] + '"' + selected + '>' + c[1] + '</option>';
    }).join('');
    const locked = preset.locked ? ' disabled title="Your wounds demand rest"' : '';
    html += '<div class="week"><label>Week ' + (week + 1) + '</label>' +
      '<select class="week-action" data-week="' + week + '"' + locked + '>' + options + '</select>' +
      '<span class="week-params" id="params-' + week + '"></span></div>';
  }
  html += '<div class="week"><label>Luxury</label>Conspicuous purchases: <input type="number" id="conspicuous" value="0" min="0" max="9"> × ' +
    (CONSPICUOUS_MULT * char.sl) + ' crowns (+1 status each)</div>';
  html += '<div id="plan-errors" class="errors"></div>';
  html += '<button id="live-month" class="big">Live the Month</button>';
  planner.innerHTML = html;
  if (deploymentSeason(state) && char.atFront === null) {
    planner.insertAdjacentHTML('beforeend',
      '<p class="note">The armies are in the field. <button id="volunteer">Volunteer for the frontier</button></p>');
  }
}

function renderFrontPlanner(state, planner) {
  const front = state.character.atFront;
  const regiment = frontRegiment(state.character);
  planner.innerHTML = '<h3>' + esc(monthLabel(state)) + ' — With the Colours</h3>' +
    '<p class="note">You are at the front with the ' + esc(regiment.name) + '. ' + front.monthsLeft + ' month(s) of the season remain.</p>' +
    '<button id="live-month" class="big">Endure the Month</button>';
}

// ---------- Establishments panel ----------

function renderEstablishments(state) {
  const char = state.character;
  renderClubOffers(state);
  renderRegimentOffers(state);
  el('lender-info').textContent = 'Credit remaining: ' + Math.max(0, borrowLimit(char)) + ' crowns. Debt: ' + char.debt + '.';
  el('resign-regiment').classList.toggle('hidden', char.regimentId === null || char.atFront !== null);
}

function renderClubOffers(state) {
  const char = state.character;
  const open = CLUBS.filter(function (c) { return clubEligible(char, c) && char.clubId !== c.id; });
  const select = el('club-select');
  select.innerHTML = open.map(function (c) {
    return '<option value="' + c.id + '">' + esc(c.name) + ' (' + c.dues * CLUB_ADMISSION_MULT + ' cr entry, ' + c.dues + '/mo, +' + c.status + ' status)</option>';
  }).join('');
  el('club-join-row').classList.toggle('hidden', open.length === 0);
  setPetitionButton(el('club-join'), applications(state).club === state.monthIndex);
}

function setPetitionButton(button, spent) {
  button.disabled = spent;
  button.title = spent ? 'You have already pressed your suit this month.' : '';
}

function renderRegimentOffers(state) {
  const char = state.character;
  const row = el('regiment-join-row');
  if (char.regimentId !== null) {
    row.classList.add('hidden');
    return;
  }
  row.classList.remove('hidden');
  el('regiment-select').innerHTML = REGIMENTS.map(function (r) {
    const need = applicationRollNeeded(char, r);
    const note = need > 6 ? 'closed to you' : (need <= 0 ? 'open' : 'roll ' + need + '+');
    return '<option value="' + r.id + '">' + esc(r.name) + ' (' + note + (r.cavalry ? ', cavalry' : '') + ')</option>';
  }).join('');
  setPetitionButton(el('regiment-apply'), applications(state).regiment === state.monthIndex);
}

// ---------- Gazette ----------

function renderGazette(state) {
  el('gazette').innerHTML = state.gazette.map(function (entry) {
    return '<div class="entry"><h4>' + esc(entry.heading) + '</h4>' +
      entry.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>';
  }).join('');
}

// ---------- Death overlay ----------

function renderDeath(state) {
  const overlay = el('death-overlay');
  const char = state.character;
  if (!char.dead) {
    overlay.classList.add('hidden');
    return;
  }
  overlay.classList.remove('hidden');
  el('epitaph').innerHTML = '<b>' + esc(char.name) + '</b><br>' + esc(char.epitaph) +
    '<br><small>Peak social level: ' + char.peakSL + '</small>';
}

// ---------- Chargen overlay ----------

function renderChargen(candidate) {
  const c = candidate;
  el('chargen-name').value = c.name;
  el('chargen-stats').innerHTML =
    '<div class="row"><span>Born</span><b>' + esc(c.sibling + ' of a ' + c.fatherPosition) + (c.orphan ? ' (orphaned)' : '') + '</b></div>' +
    (c.title !== null ? '<div class="row"><span>Title</span><b>' + esc(c.title) + '</b></div>' : '') +
    '<div class="row"><span>Strength</span><b>' + c.str + '</b></div>' +
    '<div class="row"><span>Constitution</span><b>' + c.con + '</b></div>' +
    '<div class="row"><span>Expertise</span><b>' + c.exp + '</b></div>' +
    '<div class="row"><span>Military Ability</span><b>' + c.ma + '</b></div>' +
    '<div class="row"><span>Endurance</span><b>' + c.endMax + '</b></div>' +
    '<div class="row"><span>Social Level</span><b>' + c.sl + '</b></div>' +
    '<div class="row"><span>Funds</span><b>' + c.cash + ' crowns</b></div>' +
    '<div class="row"><span>Allowance</span><b>' + c.allowance + '/month</b></div>';
}

// ---------- Top-level render ----------

function render(state) {
  el('date-line').textContent = monthLabel(state);
  renderSheet(state);
  renderSociety(state);
  renderAffairs(state);
  renderPlanner(state);
  renderEstablishments(state);
  renderGazette(state);
  renderDeath(state);
  wirePlanner(state);
}

// ---------- Plan collection ----------

function collectPlan(state) {
  const weeks = [];
  for (let week = 0; week < 4; week++) {
    const select = document.querySelector('.week-action[data-week="' + week + '"]');
    const action = select === null ? 'idle' : select.value;
    weeks.push({ action: action, params: collectParams(week, action) });
  }
  const conspicuousInput = el('conspicuous');
  const conspicuous = conspicuousInput === null ? 0 : Math.max(0, parseInt(conspicuousInput.value, 10) || 0);
  return { weeks: weeks, conspicuous: conspicuous };
}

function collectParams(week, action) {
  if (action === 'gamble') {
    return {
      stake: Math.max(1, parseInt(document.querySelector('.p-stake[data-week="' + week + '"]').value, 10) || 1),
      bets: Math.max(1, parseInt(document.querySelector('.p-bets[data-week="' + week + '"]').value, 10) || 1),
    };
  }
  if (action === 'court') return { ladyId: document.querySelector('.p-lady[data-week="' + week + '"]').value };
  if (action === 'toady') return { npcId: document.querySelector('.p-npc[data-week="' + week + '"]').value };
  if (action === 'preferment') {
    const parts = document.querySelector('.p-pref[data-week="' + week + '"]').value.split(':');
    return { kind: parts[0], targetIndex: parseInt(parts[1], 10) };
  }
  return {};
}
