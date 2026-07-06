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
  const appt = char.appointmentId === null ? null : findAppointment(char.appointmentId);
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
    ['Regiment', rank === null ? 'None' : rank.name + ', ' + findRegiment(char.regimentId).name + ' (+' + rank.status + 'S)'],
    ['Appointment', appt === null ? '—' : appt.name + ' (+' + appt.status + 'S)'],
    ['Club', club === null ? 'None' : club.name + ' (+' + club.status + 'S)'],
    ['Mistress', mistress === null ? 'None' : mistress.name + ' (SL ' + mistress.sl + ')'],
    ['Mentions', char.mentions],
  ];
  if (char.horses > 0) rows.push(['Stable', char.horses + ' horse' + (char.horses > 1 ? 's' : '') + ' (' + (char.horses * HORSE_UPKEEP + GROOM_WAGE) + ' cr/month with groom)']);
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
    return '<div class="soc"><b>' + esc(npc.name) + grudge + '</b><span>SL ' + npc.sl + ' · Exp ' + npc.exp + ' · ' + esc(reg) + '</span></div>';
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
  if (char.clubId !== null || char.mistressId !== null) choices.push(['carouse', WEEK_ACTIONS.carouse.label]);
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

// Titles first, then positions (court appointments and general's rank),
// each group in decreasing order of the status it confers. group orders the
// two bands; status is the sort key within a band (a title's one-time burst,
// a position's monthly award).
function prefermentTargets(state) {
  const targets = [];
  TITLES.forEach(function (t, i) {
    if (titleEligible(state, i)) targets.push({ kind: 'title', index: i, group: 0, status: t.statusBurst, label: 'The title of ' + t.name + ' (+' + t.statusBurst + 'S)' });
  });
  APPOINTMENTS.forEach(function (a, i) {
    if (state.character.appointmentId !== a.id && appointmentEligible(state, a)) targets.push({ kind: 'appointment', index: i, group: 1, status: a.status, label: a.name + ' (+' + a.status + 'S)' });
  });
  GENERAL_RANKS.forEach(function (g, i) {
    if (generalRankEligible(state, i)) targets.push({ kind: 'generalRank', index: i, group: 1, status: g.status, label: 'Promotion to ' + g.name + ' (+' + g.status + 'S)' });
  });
  targets.sort(function (a, b) {
    if (a.group !== b.group) return a.group - b.group;
    return b.status - a.status;
  });
  return targets;
}

// prior holds last month's params for this week, so a repeated plan keeps the
// same lady, rival, stake, or petition rather than resetting to the default.
function weekParamsHTML(state, week, action, prior) {
  if (action === 'gamble') {
    const venue = gamblingVenue(state.character);
    const limit = venue.houseLimit === null ? 'no limit' : 'limit ' + venue.houseLimit;
    const stake = prior.stake !== undefined ? prior.stake : Math.max(10, venue.minBet);
    const bets = prior.bets !== undefined ? prior.bets : 3;
    return 'stake <input type="number" class="p-stake" data-week="' + week + '" value="' + stake + '" min="' + venue.minBet + '"> × ' +
      'bets <input type="number" class="p-bets" data-week="' + week + '" value="' + bets + '" min="1" max="' + MAX_BETS_PER_WEEK + '"> <small>(' + limit + ')</small>';
  }
  if (action === 'court') {
    return selectHTML('p-lady', week, courtableLadies(state).map(function (l) {
      const need = courtingRollNeeded(state.character.sl - l.sl) + (l.lover !== null ? 2 : 0);
      const needText = need > 6 ? 'hopeless' : 'needs ' + need + '+';
      return { value: l.id, label: esc(l.name) + ' (SL ' + l.sl + ', ' + COURTING_COST_MULT * l.sl + ' cr, ' + needText + ')' };
    }), prior.ladyId);
  }
  if (action === 'toady') {
    return selectHTML('p-npc', week, toadyTargets(state).map(function (n) {
      return { value: n.id, label: esc(n.name) + ' (SL ' + n.sl + ')' };
    }), prior.npcId);
  }
  if (action === 'preferment') {
    const priorPref = prior.kind !== undefined ? prior.kind + ':' + prior.targetIndex : null;
    return selectHTML('p-pref', week, prefermentTargets(state).map(function (t) {
      return { value: t.kind + ':' + t.index, label: esc(t.label) };
    }), priorPref);
  }
  return '';
}

function selectHTML(cls, week, options, priorValue) {
  const body = options.map(function (o) {
    const selected = o.value === priorValue ? ' selected' : '';
    return '<option value="' + o.value + '"' + selected + '>' + o.label + '</option>';
  }).join('');
  return '<select class="' + cls + '" data-week="' + week + '">' + body + '</select>';
}

// Each week defaults to what you did that week last month (if it is still a
// valid choice); wounds claim the opening weeks; required duty fills the
// tail, with the mistress's carouse week just ahead of it.
function plannerPresets(state) {
  const char = state.character;
  const woundIdle = Math.min(4, char.woundWeeks);
  const dutyNeeded = requiredDutyWeeks(char);
  const carouseNeeded = requiredCarouseWeeks(char);
  const last = state.lastPlan;
  const available = actionChoices(state).map(function (c) { return c[0]; });
  const presets = [];
  for (let week = 0; week < 4; week++) {
    if (week < woundIdle) {
      presets.push({ action: 'idle', locked: true });
    } else if (week >= 4 - dutyNeeded) {
      presets.push({ action: 'duty', locked: false });
    } else if (week >= 4 - dutyNeeded - carouseNeeded) {
      presets.push({ action: 'carouse', locked: false });
    } else {
      const prior = last && last.weeks[week] ? last.weeks[week].action : 'idle';
      const action = available.indexOf(prior) >= 0 ? prior : 'idle';
      presets.push({ action: action, locked: false });
    }
  }
  return presets;
}

function priorParams(state, week) {
  const last = state.lastPlan;
  if (!last || !last.weeks[week] || last.weeks[week].params === undefined) return {};
  return last.weeks[week].params;
}

function renderPlanner(state) {
  const planner = el('planner');
  if (state.affairs.length > 0) {
    planner.innerHTML = '<p class="note">Affairs of honour must be answered before you can plan the month.</p>';
    return;
  }
  const char = state.character;
  const choices = actionChoices(state);
  const presets = plannerPresets(state);
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
  const priorConspicuous = state.lastPlan ? Boolean(state.lastPlan.conspicuous) : false;
  html += '<div class="week"><label>Luxury</label><label class="check"><input type="checkbox" id="conspicuous"' + (priorConspicuous ? ' checked' : '') + '> ' +
    'Conspicuous consumption (-' + (CONSPICUOUS_MULT * char.sl) + ' cr, +1S)</label></div>';
  html += '<div id="plan-errors" class="errors"></div>';
  html += '<button id="live-month" class="big">Live the Month</button>';
  planner.innerHTML = html;
  if (deploymentSeason(state)) {
    planner.insertAdjacentHTML('beforeend',
      '<p class="note">The armies are in the field. <button id="volunteer">March to the frontier</button></p>');
  }
}

// ---------- Campaign overlay ----------

function renderCampaign(state, result) {
  el('campaign-title').textContent = result.died ? 'The Last Campaign' : 'The Summer Campaign';
  el('campaign-body').innerHTML = result.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('');
  el('campaign-return').textContent = result.died ? 'Requiescat' : 'Return to Paris';
}

// ---------- Establishments panel ----------

function renderEstablishments(state) {
  const char = state.character;
  renderClubOffers(state);
  renderRegimentOffers(state);
  el('lender-info').textContent = 'Credit remaining: ' + Math.max(0, borrowLimit(char)) + ' crowns. Debt: ' + char.debt + '.';
  const advice = el('ask-advice');
  advice.disabled = adviceAsked(state);
  advice.title = advice.disabled ? 'Your friend has said his piece; come back next month.' : '';
  el('resign-regiment').classList.toggle('hidden', char.regimentId === null);
  el('club-resign').classList.toggle('hidden', char.clubId === null);
}

function renderClubOffers(state) {
  const char = state.character;
  // A member sees only the resign button; to trade up he first resigns, then
  // seeks election elsewhere — the same flow regiments use for a commission.
  if (char.clubId !== null) {
    el('club-join-row').classList.add('hidden');
    return;
  }
  const open = CLUBS.filter(function (c) { return clubEligible(char, c); });
  const select = el('club-select');
  select.innerHTML = open.map(function (c) {
    return '<option value="' + c.id + '">' + esc(c.name) + ' (' + c.dues + '/mo, +' + c.status + 'S)</option>';
  }).join('');
  el('club-join-row').classList.toggle('hidden', open.length === 0);
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
  renderEntryRanks(state);
  setPetitionButton(el('regiment-apply'), applications(state).regiment === state.monthIndex);
}

// Ranks purchasable at the regiment currently picked in the join row.
function renderEntryRanks(state) {
  const regiment = findRegiment(el('regiment-select').value);
  if (regiment === undefined) {
    el('rank-select').innerHTML = '';
    return;
  }
  el('rank-select').innerHTML = entryRanks(state.character, regiment).map(function (r) {
    const parts = [];
    if (r.price > 0) parts.push(r.price + ' cr');
    if (r.horses > 0) parts.push(r.horses + (r.horses > 1 ? ' horses' : ' horse'));
    parts.push('+' + r.status + 'S');
    return '<option value="' + r.index + '">' + r.rank.name + ' (' + parts.join(', ') + ')</option>';
  }).join('');
}

// ---------- Status panel ----------

// Reads the planner's current selections, so it must render after wirePlanner
// has filled in the week params.
function renderStatusPanel(state) {
  const box = el('status-panel');
  const char = state.character;
  const items = statusForecast(state, collectPlan(state));
  const total = items.reduce(function (sum, item) { return sum + item.sp; }, 0);
  box.innerHTML = items.map(function (item) {
    return '<div class="row"><span>' + esc(item.label) + '</span><b>' + formatSP(item.sp) + 'S</b></div>';
  }).join('') +
    '<div class="row total"><span>If all goes well</span><b>' + formatSP(total) + 'S</b></div>' +
    '<p class="hint">Hold your level at ' + char.sl + 'S; rise at ' + (3 * (char.sl + 1)) + 'S.</p>';
}

// ---------- Ledger panel ----------

// Reads the planner like the Status panel, so it also renders after
// wirePlanner has filled in the week params.
function renderLedgerPanel(state) {
  const box = el('ledger-panel');
  const char = state.character;
  const income = incomeForecast(state);
  const expenses = expensesForecast(state, collectPlan(state));
  const net = sumAmounts(income) - sumAmounts(expenses);
  box.innerHTML =
    '<table class="ledger">' +
    '<tr><th></th><th>Expenses</th><th>Income</th></tr>' +
    expenses.map(function (item) { return ledgerRow(item.label, item.amount, null); }).join('') +
    income.map(function (item) { return ledgerRow(item.label, null, item.amount); }).join('') +
    '<tr class="total"><td>Totals</td><td>' + sumAmounts(expenses) + '</td><td>' + sumAmounts(income) + '</td></tr>' +
    '</table>' +
    '<div class="row total"><span>Balance of the month</span><b>' + (net >= 0 ? '+' : '') + net + ' cr</b></div>' +
    '<p class="hint">In the purse: ' + char.cash + ' cr.</p>';
}

function sumAmounts(items) {
  return items.reduce(function (sum, item) { return sum + item.amount; }, 0);
}

function ledgerRow(label, spent, earned) {
  return '<tr><td>' + esc(label) + '</td>' +
    '<td>' + (spent === null ? '' : spent) + '</td>' +
    '<td>' + (earned === null ? '' : earned) + '</td></tr>';
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
  renderStatusPanel(state);
  renderLedgerPanel(state);
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
  const conspicuous = conspicuousInput !== null && conspicuousInput.checked;
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
