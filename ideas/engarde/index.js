// En Garde! — The Season in Paris
// index.js — bootstrapping and event wiring. MIT License.

let game = null;
let candidate = null;
let chargenMode = 'new'; // 'new' = fresh world, 'replace' = same world, new character

// ---------- Planner wiring ----------

function wirePlanner(state) {
  document.querySelectorAll('.week-action').forEach(function (select) {
    updateWeekParams(state, parseInt(select.dataset.week, 10), select.value);
  });
}

function updateWeekParams(state, week, action) {
  const span = el('params-' + week);
  if (span !== null) span.innerHTML = weekParamsHTML(state, week, action);
}

// ---------- Month flow ----------

function liveMonth() {
  const plan = game.character.atFront !== null
    ? { weeks: [], conspicuous: 0 }
    : collectPlan(game);
  if (game.character.atFront === null) {
    const errors = validatePlan(game, plan);
    if (errors.length > 0) {
      el('plan-errors').innerHTML = errors.map(esc).join('<br>');
      return;
    }
  }
  resolveMonth(game, plan);
  saveGame(game);
  render(game);
}

// ---------- Chargen flow ----------

function showChargen() {
  candidate = generateCharacter();
  renderChargen(candidate);
  el('chargen-overlay').classList.remove('hidden');
}

function beginGame() {
  const name = el('chargen-name').value.trim();
  if (name.length > 0) candidate.name = name;
  if (chargenMode === 'replace') {
    game.character = candidate;
    game.affairs = [];
  } else {
    game = newGame(candidate);
  }
  candidate = null;
  chargenMode = 'new';
  el('chargen-overlay').classList.add('hidden');
  el('death-overlay').classList.add('hidden');
  appendGazette(game, 'Arrival in Paris', [
    game.character.name + ' arrives in Paris with ' + game.character.cash +
    ' crowns, a sword, and ambitions out of all proportion to both.']);
  saveGame(game);
  render(game);
}

function newCharacterInWorld() {
  chargenMode = 'replace';
  el('death-overlay').classList.add('hidden');
  showChargen();
}

function confirmNewGame() {
  if (game !== null && !game.character.dead && !confirm('Abandon ' + game.character.name + ' and start anew?')) return;
  clearSave();
  game = null;
  showChargen();
}

// ---------- Establishment actions ----------

function doJoinClub() {
  applications(game).club = game.monthIndex;
  const result = joinClub(game, el('club-select').value);
  appendGazette(game, 'The Clubs', [result.message]);
  saveGame(game);
  render(game);
}

function doApplyRegiment() {
  applications(game).regiment = game.monthIndex;
  const result = applyToRegiment(game, el('regiment-select').value);
  appendGazette(game, 'The Regiments', [result.message]);
  saveGame(game);
  render(game);
}

function doResignRegiment() {
  if (!confirm('Resign your commission?')) return;
  appendGazette(game, 'The Regiments', ['You resign from the ' + findRegiment(game.character.regimentId).name + '.']);
  leaveRegiment(game);
  saveGame(game);
  render(game);
}

function doBorrow() {
  const amount = Math.max(0, parseInt(el('loan-amount').value, 10) || 0);
  const result = borrowMoney(game, amount);
  appendGazette(game, 'The Moneylender', [result.message]);
  saveGame(game);
  render(game);
}

function doRepay() {
  const amount = Math.max(0, parseInt(el('loan-amount').value, 10) || 0);
  const result = repayDebt(game, amount);
  appendGazette(game, 'The Moneylender', [result.message]);
  saveGame(game);
  render(game);
}

function doVolunteer() {
  const message = volunteerForCampaign(game);
  appendGazette(game, 'The Drums of Summer', [message]);
  saveGame(game);
  render(game);
}

// ---------- Event delegation ----------

function onClick(event) {
  const target = event.target;
  if (target.dataset.affair !== undefined) {
    answerAffair(game, parseInt(target.dataset.affair, 10), target.dataset.response);
    saveGame(game);
    render(game);
    return;
  }
  const handlers = {
    'live-month': liveMonth,
    'volunteer': doVolunteer,
    'club-join': doJoinClub,
    'regiment-apply': doApplyRegiment,
    'resign-regiment': doResignRegiment,
    'loan-borrow': doBorrow,
    'loan-repay': doRepay,
    'new-game': confirmNewGame,
    'chargen-reroll': function () { showChargen(); },
    'chargen-begin': beginGame,
    'death-new-character': newCharacterInWorld,
  };
  const handler = handlers[target.id];
  if (handler !== undefined) handler();
}

function onChange(event) {
  const target = event.target;
  if (target.classList.contains('week-action')) {
    const week = parseInt(target.dataset.week, 10);
    updateWeekParams(game, week, target.value);
    carryActionForward(game, week, target.value);
    return;
  }
  carryParamForward(target);
}

// A chosen action carries into the following weeks, sparing the duty slots
// pre-set at the month's end and any weeks locked by wounds.
function carryActionForward(state, week, action) {
  const dutyNeeded = requiredDutyWeeks(state.character);
  for (let w = week + 1; w < 4; w++) {
    if (w >= 4 - dutyNeeded) continue;
    const select = document.querySelector('.week-action[data-week="' + w + '"]');
    if (select === null || select.disabled) continue;
    select.value = action;
    updateWeekParams(state, w, action);
  }
}

const CARRIED_PARAM_CLASSES = ['p-stake', 'p-bets', 'p-lady', 'p-npc', 'p-pref'];

function carryParamForward(target) {
  const week = parseInt(target.dataset.week, 10);
  if (Number.isNaN(week)) return;
  const cls = CARRIED_PARAM_CLASSES.find(function (c) { return target.classList.contains(c); });
  if (cls === undefined) return;
  for (let w = week + 1; w < 4; w++) {
    const next = document.querySelector('.' + cls + '[data-week="' + w + '"]');
    if (next !== null) next.value = target.value;
  }
}

// ---------- Boot ----------

function boot() {
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  const saved = loadGame();
  if (saved !== null) {
    game = saved;
    render(game);
    return;
  }
  showChargen();
}

document.addEventListener('DOMContentLoaded', boot);
