// En Garde! — The Season in Paris
// index.js — bootstrapping and event wiring. MIT License.

// Bump on every change to the scripts. Shown in the header so you can confirm
// the browser is running the current build and not a cached one.
const BUILD = 24;

let game = null;
let candidate = null;
let chargenMode = 'new'; // 'new' = fresh world, 'replace' = same world, new character

// ---------- Planner wiring ----------

function wirePlanner(state) {
  document.querySelectorAll('.week-action').forEach(function (select) {
    const week = parseInt(select.dataset.week, 10);
    updateWeekParams(state, week, select.value, priorParams(state, week));
  });
}

function updateWeekParams(state, week, action, prior) {
  const span = el('params-' + week);
  if (span !== null) span.innerHTML = weekParamsHTML(state, week, action, prior);
}

// ---------- Month flow ----------

function liveMonth() {
  const plan = game.character.atFront !== null
    ? { weeks: [], conspicuous: false }
    : collectPlan(game);
  if (game.character.atFront === null) {
    const errors = validatePlan(game, plan);
    if (errors.length > 0) {
      el('plan-errors').innerHTML = errors.map(esc).join('<br>');
      return;
    }
    game.lastPlan = plan; // next month defaults to this same plan
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
    game.lastPlan = null;
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
  const result = joinClub(game, el('club-select').value);
  appendGazette(game, 'The Clubs', [result.message]);
  saveGame(game);
  render(game);
}

function doApplyRegiment() {
  applications(game).regiment = game.monthIndex;
  const result = applyToRegiment(game, el('regiment-select').value, parseInt(el('rank-select').value, 10));
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
    updateWeekParams(game, week, target.value, {});
  }
  if (target.id === 'regiment-select') renderEntryRanks(game);
  if (target.closest('#planner') !== null) {
    renderStatusPanel(game);
    renderLedgerPanel(game);
  }
}

// ---------- Boot ----------

function boot() {
  el('build-tag').textContent = 'build ' + BUILD;
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
