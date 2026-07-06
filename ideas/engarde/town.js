// En Garde! — The Season in Paris
// town.js — the invented living Paris that surrounds the rules: rival
// gentlemen and their fortunes, the ladies of the town, mortality, maladies,
// and the affairs of honour the city serves up. None of this is in the
// published game (see README.md's deviations list); the rules themselves
// live in core.js and engine.js. MIT License.

// ---------- The player's own hazards ----------

// Fate makes the same monthly visit to the player it makes to everyone else
// (0.1%), but with a keener sense of comedy. Only in ordinary months — at
// the front, the war supplies its own mortality. The chosen line serves as
// both the month's narrative and the epitaph.
function resolvePlayerMortality(state, ctx) {
  const char = state.character;
  if (char.dead || !chance(NATURAL_DEATH_CHANCE)) return;
  const line = flourishWide(PLAYER_DEATHS, char.sl);
  ctx.lines.push(line);
  killCharacter(state, line);
}

// Paris has gentler cruelties than the grave (0.2% a month): a mishap or
// malady costing 1-50% of full endurance, capped so it can never kill —
// the sickbed floor is 1. Ordinary months only; the front has its own
// hazards.
function resolvePlayerMalady(state, ctx) {
  const char = state.character;
  if (char.dead || !chance(MALADY_CHANCE)) return;
  const pct = 1 + Math.floor(Math.random() * MALADY_MAX_LOSS_PCT);
  const loss = Math.min(char.endCur - 1, Math.max(1, Math.floor(char.endMax * pct / 100)));
  char.endCur -= loss;
  ctx.lines.push(flourishWide(PLAYER_MALADIES, char.sl) + ' (-' + loss + ' endurance)');
}

// ---------- Rival NPCs ----------

function simulateRivals(state, ctx) {
  state.npcs.forEach(function (npc) {
    if (!npc.alive) return;
    simulateRivalCampaign(state, npc, ctx);
    if (!npc.alive) return;
    simulateRivalMortality(state, npc, ctx);
    if (!npc.alive) return;
    simulateRivalDrift(npc);
    simulateRivalCourtship(state, npc, ctx);
  });
  simulateLadyMortality(state, ctx);
  simulateHonorEvent(state, ctx);
  simulateMistressSuit(state, ctx);
  replenishGentlemen(state, ctx);
}

// Paris never wants for ambitious young men. The fallen linger in the roll
// a while; each month one of them (1-in-3 chance) is struck from the list
// and his place taken by a newcomer of modest standing.
function replenishGentlemen(state, ctx) {
  clearDanglingAffairs(state);
  const arrivals = [];
  const dead = state.npcs.filter(function (n) { return !n.alive; });
  if (dead.length > 0 && chance(1 / 3)) {
    state.npcs.splice(state.npcs.indexOf(dead[0]), 1); // longest-fallen first
    arrivals.push(newcomer(state));
  }
  while (state.npcs.length < NPC_COUNT) arrivals.push(newcomer(state));
  if (arrivals.length === 0) return;
  ctx.gazette.push('Lately arrived from the provinces and making themselves known about town: ' + arrivals.join(', ') + '.');
}

function newcomer(state) {
  const npc = generateNpc(nextNpcId(state), state.ladies, 2 + Math.floor(Math.random() * 4));
  state.npcs.push(npc);
  return npc.name;
}

function npcAtWar(state, npc) {
  if (!deploymentSeason(state) || npc.regimentId === null) return false;
  return (state.warBrigades || []).indexOf(findRegiment(npc.regimentId).brigade) >= 0;
}

function simulateRivalCampaign(state, npc, ctx) {
  if (!npcAtWar(state, npc)) return;
  if (chance(0.05)) {
    npc.alive = false;
    if (npc.mistressId !== null) findLady(state, npc.mistressId).lover = null;
    ctx.gazette.push(npc.name + ' has fallen with the ' + findRegiment(npc.regimentId).name + '. His creditors are inconsolable.');
    return;
  }
  if (chance(0.08)) {
    npc.sl += 1;
    ctx.gazette.push(npc.name + ' is mentioned in despatches from the front.');
  }
}

// Even away from the duelling ground, a gentleman may be struck down. Rare
// (0.1% a month), but Paris is a dangerous city for the mortal.
function simulateRivalMortality(state, npc, ctx) {
  if (!chance(NATURAL_DEATH_CHANCE)) return;
  npc.alive = false;
  if (npc.mistressId !== null) findLady(state, npc.mistressId).lover = null;
  ctx.gazette.push(npc.name + ' ' + flourishWide(NATURAL_DEATHS, npc.sl));
}

// The ladies of Paris are as mortal as the men (0.1% a month), but die
// tragically where the men die ingloriously. The departed's place in society
// is taken at once by a debutante; a bereaved lover, the player included,
// is left without a mistress.
function simulateLadyMortality(state, ctx) {
  const char = state.character;
  state.ladies.forEach(function (lady, i) {
    if (!chance(NATURAL_DEATH_CHANCE)) return;
    if (lady.lover === 'player') {
      char.mistressId = null;
      ctx.lines.push(lady.name + ' ' + flourishWide(LADY_DEATHS, lady.sl) + ' You wear black for the season.');
    } else {
      if (lady.lover !== null) {
        const npc = findNpc(state, lady.lover);
        if (npc !== undefined) npc.mistressId = null;
      }
      ctx.gazette.push(lady.name + ' ' + flourishWide(LADY_DEATHS, lady.sl));
    }
    const debutante = generateLady(nextLadyId(state));
    state.ladies[i] = debutante;
    ctx.gazette.push(debutante.name + ' is newly presented in society.');
  });
}

function simulateRivalDrift(npc) {
  if (chance(0.03)) npc.sl += 1;
  else if (chance(0.01)) npc.sl = Math.max(1, npc.sl - 1);
}

function simulateRivalCourtship(state, npc, ctx) {
  if (npc.mistressId !== null || npcAtWar(state, npc) || !chance(0.25)) return;
  const free = state.ladies.filter(function (l) { return l.lover === null && l.sl <= npc.sl + 3; });
  if (free.length === 0) return;
  const lady = pick(free);
  lady.lover = npc.id;
  npc.mistressId = lady.id;
  ctx.gazette.push(lady.name + ' is seen everywhere on the arm of ' + npc.name + '.');
}

// Once a month at most, Paris tests a gentleman's honour: a single check,
// then a coin decides which way the offence ran — given to you (demand
// satisfaction or let it pass) or given by you (his seconds call; accept or
// refuse). Either way his station picks the venue — gutters and taverns for
// the low, levees and the King's antechamber for the great. Never while an
// affair already waits, never while he is away at the wars, and never while
// he is at half endurance or less — no one presses a convalescent (the same
// threshold that lets a challenged man plead his wounds).
function simulateHonorEvent(state, ctx) {
  const char = state.character;
  if (char.atFront !== null || state.affairs.length > 0) return;
  if (char.endCur * 2 <= char.endMax) return;
  if (!chance(HONOR_EVENT_CHANCE)) return;
  const pool = state.npcs.filter(function (n) { return n.alive && !npcAtWar(state, n); });
  if (pool.length === 0) return;
  const npc = pick(pool);
  if (chance(0.5)) {
    state.affairs.push({ type: 'insult', npcId: npc.id, reason: flourishWide(HONOR_EVENTS_CHALLENGE, char.sl) });
    ctx.gazette.push('Hot words between you and ' + npc.name + ' — all Paris waits to see what you will do.');
    return;
  }
  state.affairs.push({ type: 'challenged', npcId: npc.id, reason: flourishWide(HONOR_EVENTS_CHALLENGED, char.sl) });
  ctx.gazette.push(npc.name + ' demands satisfaction of you — his seconds will call.');
}

// A rival paying court to the mistress is its own flat monthly check, apart
// from the honour table. At home the suit is open and the answer is the
// player's; at the front the suitor presses unopposed, and the usual
// courting roll (+2, for she is taken) decides whether she is carried off.
function simulateMistressSuit(state, ctx) {
  const char = state.character;
  if (char.mistressId === null || state.affairs.some(function (a) { return a.type === 'poach'; })) return;
  if (!chance(MISTRESS_SUIT_CHANCE)) return;
  const lady = findLady(state, char.mistressId);
  const suitors = state.npcs.filter(function (n) {
    return n.alive && n.mistressId === null && !npcAtWar(state, n) && n.sl >= lady.sl - 2;
  });
  if (suitors.length === 0) return;
  const npc = pick(suitors);
  if (char.atFront === null) {
    state.affairs.push({ type: 'poach', npcId: npc.id, reason: 'He pays open court to ' + lady.name + ', your mistress.' });
    ctx.gazette.push(npc.name + ' sends flowers to ' + lady.name + ' — everyone is watching to see what you will do.');
    return;
  }
  if (d6() >= courtingRollNeeded(npc.sl - lady.sl) + 2) {
    lady.lover = npc.id;
    npc.mistressId = lady.id;
    char.mistressId = null;
    ctx.gazette.push('While you were at the wars, ' + npc.name + ' has carried off ' + lady.name + '.');
    return;
  }
  ctx.gazette.push(npc.name + ' pressed his suit on ' + lady.name + ' in your absence; she sent him away with a flea in his ear.');
}
