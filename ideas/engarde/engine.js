// En Garde! — The Season in Paris
// engine.js — monthly resolution, duels, campaigns, rivals. MIT License.

// ---------- Derived character info ----------

function rankData(char) {
  if (char.rankIndex < 0) return null;
  if (char.rankIndex >= 6) {
    const g = GENERAL_RANKS[char.rankIndex - 6];
    return { name: g.name, pay: g.pay, status: g.status, dutyWeeks: 0 };
  }
  const rank = RANKS[char.rankIndex];
  const regiment = findRegiment(char.regimentId);
  const col = regiment.column;
  return { name: rank.name, pay: rank.pay[col], status: rank.status[col], dutyWeeks: rank.dutyWeeks };
}

function currentRankStatus(char) {
  const rank = rankData(char);
  return rank === null ? 0 : rank.status;
}

function currentAppointmentStatus(char) {
  return char.appointmentId === null ? 0 : findAppointment(char.appointmentId).status;
}

function titleIndex(char) {
  if (char.title === null) return -1;
  return TITLES.findIndex(function (t) { return t.name === char.title; });
}

function characterInfluence(state) {
  const char = state.character;
  let inf = influenceFromSL(char.sl);
  if (char.mistressId !== null) {
    const lady = findLady(state, char.mistressId);
    inf += mistressInfluence(lady.sl, lady.influential);
  }
  return inf;
}

function borrowLimit(char) {
  return LOAN_LIMIT_BASE + char.sl * LOAN_LIMIT_PER_SL - char.debt;
}

function isHorseGuardsOfficer(char) {
  if (char.regimentId === null || char.rankIndex < 1) return false;
  return findRegiment(char.regimentId).brigade === 'Horse Guards Brigade';
}

function clubEligible(char, club) {
  if (club.requiresHorseGuards) return isHorseGuardsOfficer(char);
  return char.sl >= club.minSL;
}

function gamblingVenue(char) {
  if (char.clubId !== null) return findClub(char.clubId);
  return { name: 'the bawdyhouse tables', houseLimit: BAWDYHOUSE_GAMBLING.houseLimit, minBet: BAWDYHOUSE_GAMBLING.minBet, divisor: BAWDYHOUSE_GAMBLING.divisor };
}

// ---------- Week actions (dispatch table) ----------

// forecastSP: the best status the week could yield, for the Status panel.
// forecastCost: what the week is set to cost, for the Expenses panel.
const WEEK_ACTIONS = {
  idle: {
    label: 'Keep to your lodgings',
    resolve: function (state, params, ctx) {
      const char = state.character;
      if (char.woundWeeks > 0) {
        char.woundWeeks -= 1;
        // Half the harm mends in the first week; Constitution per week after.
        const heal = char.firstWeekHeal > 0 ? char.firstWeekHeal : char.con;
        char.firstWeekHeal = 0;
        char.endCur = Math.min(char.endMax, char.endCur + heal);
        ctx.lines.push(heal > char.con
          ? 'A week under the surgeon\'s care; the worst of the damage mends.'
          : 'A week abed; the wounds knit slowly.');
        return;
      }
      char.endCur = Math.min(char.endMax, char.endCur + char.con);
      ctx.lines.push('A quiet week at your lodgings.');
    },
    forecastSP: function (state, params) { return 0; },
    forecastCost: function (state, params) { return 0; },
  },
  duty: {
    label: 'Regimental duty',
    resolve: function (state, params, ctx) {
      ctx.dutyDone += 1;
      ctx.lines.push('A week on duty with the ' + findRegiment(state.character.regimentId).name + '.');
    },
    forecastSP: function (state, params) { return 0; },
    forecastCost: function (state, params) { return 0; },
  },
  carouse: {
    label: 'Carouse at your club',
    resolve: function (state, params, ctx) {
      const char = state.character;
      const cost = char.sl;
      if (char.cash < cost) {
        ctx.lines.push('Too poor to carouse this week — you nurse one cup all evening, to sidelong looks.');
        return;
      }
      char.cash -= cost;
      ctx.sp += CAROUSE_STATUS;
      ctx.caroused = true;
      ctx.lines.push('You carouse at ' + findClub(char.clubId).name + ' (' + cost + ' crowns, +1 status).');
    },
    forecastSP: function (state, params) { return CAROUSE_STATUS; },
    forecastCost: function (state, params) { return state.character.sl; },
  },
  bawdy: {
    label: 'Visit the bawdyhouse',
    resolve: function (state, params, ctx) {
      const char = state.character;
      const cost = char.sl;
      if (char.cash < cost) {
        ctx.lines.push('Turned away from the bawdyhouse — your purse is empty.');
        return;
      }
      char.cash -= cost;
      ctx.sp += CAROUSE_STATUS;
      ctx.bawdyVisited = true;
      ctx.lines.push('A week of low company at the bawdyhouse (' + cost + ' crowns, +1 status).');
    },
    forecastSP: function (state, params) { return CAROUSE_STATUS; },
    forecastCost: function (state, params) { return state.character.sl; },
  },
  gamble: {
    label: 'Gamble',
    costLabel: 'Gambling stakes at risk',
    resolve: function (state, params, ctx) {
      resolveGambling(state, params.stake, params.bets, ctx);
    },
    forecastSP: function (state, params) {
      const venue = gamblingVenue(state.character);
      const limit = venue.houseLimit === null ? Infinity : venue.houseLimit;
      const wager = Math.max(venue.minBet, Math.min(params.stake, limit));
      const bets = Math.min(params.bets, MAX_BETS_PER_WEEK);
      return bets + Math.floor(bets * wager / venue.divisor);
    },
    forecastCost: function (state, params) {
      const venue = gamblingVenue(state.character);
      const limit = venue.houseLimit === null ? Infinity : venue.houseLimit;
      const wager = Math.max(venue.minBet, Math.min(params.stake, limit));
      return wager * Math.min(params.bets, MAX_BETS_PER_WEEK);
    },
  },
  court: {
    label: 'Court a lady',
    resolve: function (state, params, ctx) {
      resolveCourtship(state, params.ladyId, ctx);
    },
    forecastSP: function (state, params) { return 0; }, // her favour lands under companionship
    forecastCost: function (state, params) {
      const lady = findLady(state, params.ladyId);
      return lady === undefined ? 0 : COURTING_COST_MULT * lady.sl;
    },
  },
  toady: {
    label: 'Toady to a gentleman',
    resolve: function (state, params, ctx) {
      resolveToadying(state, params.npcId, ctx);
    },
    forecastSP: function (state, params) {
      const npc = findNpc(state, params.npcId);
      if (npc === undefined) return 0;
      const diff = npc.sl - state.character.sl;
      if (diff <= 0) return 0;
      return 1 + Math.floor(diff / 4);
    },
    forecastCost: function (state, params) { return 0; },
  },
  petition: {
    label: 'Petition for promotion',
    costLabel: 'Promotion, if granted',
    resolve: function (state, params, ctx) {
      resolvePromotionPetition(state, ctx);
    },
    forecastSP: function (state, params) {
      const char = state.character;
      const purchase = nextRankPurchase(char);
      if (purchase === null) return 0;
      const col = findRegiment(char.regimentId).column;
      return Math.max(0, purchase.rank.status[col] - currentRankStatus(char));
    },
    forecastCost: function (state, params) {
      const char = state.character;
      const purchase = nextRankPurchase(char);
      if (purchase === null) return 0;
      const stableCost = Math.max(0, horsesForRank(char.rankIndex + 1, findRegiment(char.regimentId)) - char.horses) * HORSE_PRICE;
      return purchase.price + stableCost;
    },
  },
  preferment: {
    label: 'Seek preferment at court',
    resolve: function (state, params, ctx) {
      resolvePreferment(state, params.kind, params.targetIndex, ctx);
    },
    forecastSP: function (state, params) {
      return PREFERMENT_KINDS[params.kind].forecastSP(state, params.targetIndex);
    },
    forecastCost: function (state, params) { return 0; },
  },
};

function resolveGambling(state, stake, bets, ctx) {
  const char = state.character;
  const venue = gamblingVenue(char);
  const limit = venue.houseLimit === null ? Infinity : venue.houseLimit;
  const wager = Math.max(venue.minBet, Math.min(stake, limit));
  let wagered = 0;
  let wins = 0;
  let losses = 0;
  for (let i = 0; i < Math.min(bets, MAX_BETS_PER_WEEK); i++) {
    if (char.cash < wager) break;
    wagered += wager;
    if (chance(0.5)) {
      char.cash += wager;
      wins += 1;
      ctx.sp += 1;
    } else {
      char.cash -= wager;
      losses += 1;
      ctx.sp -= 1;
    }
  }
  if (wagered === 0) {
    ctx.lines.push('You hover by the tables at ' + venue.name + ', unable to cover a single stake.');
    return;
  }
  const bonus = Math.floor(wagered / venue.divisor);
  ctx.sp += bonus;
  const bonusNote = bonus > 0 ? (' Word of your play spreads (+' + bonus + ' status).') : '';
  ctx.lines.push('Gambling at ' + venue.name + ': ' + wins + ' won, ' + losses + ' lost at ' + wager + ' crowns a hand.' + bonusNote);
}

function resolveCourtship(state, ladyId, ctx) {
  const char = state.character;
  const lady = findLady(state, ladyId);
  const cost = COURTING_COST_MULT * lady.sl;
  if (char.cash < cost) {
    ctx.lines.push('You cannot afford the flowers, the fiacres, the little gifts — ' + lady.name + ' remains uncourted.');
    return;
  }
  char.cash -= cost;
  const taken = lady.lover !== null && lady.lover !== 'player';
  const needed = courtingRollNeeded(char.sl - lady.sl) + (taken ? 2 : 0);
  const roll = d6();
  if (roll >= needed) {
    acceptMistress(state, lady, ctx);
    return;
  }
  ctx.lines.push(lady.name + ' accepts your gifts (' + cost + ' crowns) and gives nothing back but a smile.');
  if (taken && d6() <= 2) {
    const rival = findNpc(state, lady.lover);
    if (rival !== undefined && rival.alive) {
      state.affairs.push({ type: 'challenged', npcId: rival.id, reason: 'He has discovered your suit to ' + lady.name + '.' });
      ctx.lines.push(rival.name + ' has heard of your attentions to his mistress. His seconds will call.');
    }
  }
}

function acceptMistress(state, lady, ctx) {
  const char = state.character;
  if (char.mistressId !== null && char.mistressId !== lady.id) {
    const former = findLady(state, char.mistressId);
    former.lover = null;
    ctx.lines.push(former.name + ' is cast off, and does not take it kindly.');
  }
  if (lady.lover !== null && lady.lover !== 'player') {
    const rival = findNpc(state, lady.lover);
    if (rival !== undefined) rival.mistressId = null;
    if (rival !== undefined && rival.alive) {
      rival.grudge += 2;
      state.affairs.push({ type: 'challenged', npcId: rival.id, reason: 'You have stolen ' + lady.name + ' from him.' });
    }
  }
  lady.lover = 'player';
  char.mistressId = lady.id;
  ctx.lines.push(lady.name + ' consents to be your mistress. Paris will hear of it by morning.');
}

function resolveToadying(state, npcId, ctx) {
  const char = state.character;
  const npc = findNpc(state, npcId);
  const diff = npc.sl - char.sl;
  if (diff <= 0) {
    ctx.lines.push(npc.name + ' is beneath your station; nothing is gained by fawning on him.');
    return;
  }
  const roll = d6();
  if (roll === 1 || roll < toadyAcceptNeeded(diff)) {
    ctx.sp -= 1;
    ctx.lines.push(npc.name + ' looks through you as if you were glass. The snub is noticed (-1 status).');
    return;
  }
  const gain = 1 + Math.floor(diff / 4);
  ctx.sp += gain;
  ctx.lines.push('You are seen everywhere at ' + npc.name + "'s elbow (+" + gain + ' status).');
}

function nextRankPurchase(char) {
  if (char.regimentId === null || char.rankIndex < 0 || char.rankIndex >= 5) return null;
  const next = RANKS[char.rankIndex + 1];
  const col = findRegiment(char.regimentId).column;
  return { rank: next, minSL: next.minSL[col], price: next.price[col] };
}

function resolvePromotionPetition(state, ctx) {
  const char = state.character;
  const purchase = nextRankPurchase(char);
  if (purchase === null) {
    ctx.lines.push('There is no commission above yours to be had at regimental headquarters.');
    return;
  }
  if (char.sl < purchase.minSL) {
    ctx.lines.push('The colonel is polite, but a ' + purchase.rank.name + "'s commission wants a gentleman of standing (social level " + purchase.minSL + ').');
    return;
  }
  const stableCost = Math.max(0, horsesForRank(char.rankIndex + 1, findRegiment(char.regimentId)) - char.horses) * HORSE_PRICE;
  if (char.cash < purchase.price + stableCost) {
    ctx.lines.push('A ' + purchase.rank.name + "'s commission costs " + purchase.price + ' crowns' + (stableCost > 0 ? ' and ' + stableCost + ' more in horses' : '') + ' — beyond your purse.');
    return;
  }
  const roll = d6() + Math.min(char.mentions, 2);
  if (roll < 4) {
    ctx.lines.push('No vacancy this month; your petition gathers dust.');
    return;
  }
  char.cash -= purchase.price + stableCost;
  char.rankIndex += 1;
  char.horses = Math.max(char.horses, horsesForRank(char.rankIndex, findRegiment(char.regimentId)));
  char.seniority = 0;
  ctx.lines.push('Your purchase is approved: you are now a ' + purchase.rank.name + ' of the ' + findRegiment(char.regimentId).name + ' (' + (purchase.price + stableCost) + ' crowns' + (stableCost > 0 ? ', horses included' : '') + ').');
}

// ---------- Preferment: titles, appointments, general ranks ----------

function appointmentEligible(state, appt) {
  const char = state.character;
  if (appt.needsRegiment && char.regimentId === null) return false;
  if (char.sl < appt.minSL) return false;
  if (appt.ma > 0 && char.ma < appt.ma) return false;
  const rankOk = char.rankIndex >= appt.rankReq;
  const titleOk = appt.titleAlt !== null && titleIndex(char) >= appt.titleAlt;
  if (!rankOk && !titleOk) return false;
  return characterInfluence(state) >= appt.inf;
}

function titleEligible(state, index) {
  const char = state.character;
  const t = TITLES[index];
  if (index !== titleIndex(char) + 1) return false;
  if (char.sl < t.minSL) return false;
  return characterInfluence(state) >= t.inf;
}

function generalRankEligible(state, index) {
  const char = state.character;
  const g = GENERAL_RANKS[index];
  if (char.rankIndex !== 5 + index) return false;
  if (char.sl < g.minSL) return false;
  return characterInfluence(state) >= g.inf;
}

const PREFERMENT_KINDS = {
  appointment: {
    eligible: function (state, i) { return appointmentEligible(state, APPOINTMENTS[i]); },
    needed: function (i) { return APPOINTMENTS[i].roll; },
    grant: function (state, i, ctx) {
      state.character.appointmentId = APPOINTMENTS[i].id;
      ctx.lines.push('You are named ' + APPOINTMENTS[i].name + '. The appointment is worth ' + APPOINTMENTS[i].status + ' status a month.');
    },
    name: function (i) { return APPOINTMENTS[i].name; },
    // A new appointment replaces the old, so only the improvement counts;
    // if it would be a step down, the best case is the petition failing.
    forecastSP: function (state, i) { return Math.max(0, APPOINTMENTS[i].status - currentAppointmentStatus(state.character)); },
  },
  title: {
    eligible: titleEligible,
    needed: function (i) { return TITLES[i].roll; },
    grant: function (state, i, ctx) {
      const t = TITLES[i];
      const char = state.character;
      char.title = t.name;
      char.sl = Math.max(char.sl, t.newSL);
      char.pension = t.pension;
      ctx.sp += t.statusBurst;
      ctx.lines.push('The King is pleased to create you ' + t.name + '! Your social level rises to ' + char.sl + '.');
    },
    name: function (i) { return TITLES[i].name; },
    forecastSP: function (state, i) { return TITLES[i].statusBurst; },
  },
  generalRank: {
    eligible: generalRankEligible,
    needed: function (i) { return GENERAL_RANKS[i].roll; },
    grant: function (state, i, ctx) {
      state.character.rankIndex = 6 + i;
      state.character.seniority = 0;
      ctx.lines.push('You are gazetted ' + GENERAL_RANKS[i].name + '. Paris bows a little lower.');
    },
    name: function (i) { return GENERAL_RANKS[i].name; },
    // General rank supersedes regimental rank in the monthly reckoning.
    forecastSP: function (state, i) { return Math.max(0, GENERAL_RANKS[i].status - currentRankStatus(state.character)); },
  },
};

function resolvePreferment(state, kind, targetIndex, ctx) {
  const handler = PREFERMENT_KINDS[kind];
  if (!handler.eligible(state, targetIndex)) {
    ctx.lines.push('Your petition for preferment is not even read; you lack the standing or the friends.');
    return;
  }
  const roll = roll2d6() + characterInfluence(state);
  if (roll < handler.needed(targetIndex) + 4) {
    ctx.lines.push('You wait all week in the antechambers at court for ' + handler.name(targetIndex) + ', and are sent away with compliments.');
    return;
  }
  handler.grant(state, targetIndex, ctx);
}

// ---------- Duels ----------

function regimentRelation(char, npc) {
  if (char.regimentId === null || npc.regimentId === null) return 'neutral';
  const mine = findRegiment(char.regimentId);
  if (mine.friends.indexOf(npc.regimentId) >= 0 || npc.regimentId === char.regimentId) return 'friendly';
  if (mine.enemies.indexOf(npc.regimentId) >= 0) return 'enemy';
  return 'neutral';
}

function duelWinStatus(relation) {
  if (relation === 'friendly') return DUEL_STATUS.winVsFriendly;
  if (relation === 'enemy') return DUEL_STATUS.winVsEnemy;
  return DUEL_STATUS.winVsNeutral;
}

// Abstract duel in place of the plotted fencing game: exchanges of
// Expertise-driven passes to first blood (or worse, if grudges run deep).
function resolveDuel(state, npc, toTheDeath, ctx) {
  const char = state.character;
  let playerWounds = 0;
  let npcWounds = 0;
  const playerThreshold = toTheDeath ? Math.max(6, Math.floor(char.endCur / 3)) : 1;
  const npcThreshold = toTheDeath ? Math.max(6, Math.floor(npc.endMax / 3)) : 1;
  ctx.lines.push('Swords are drawn at dawn: you face ' + npc.name + (toTheDeath ? ' — to the death.' : '.'));
  for (let pass = 0; pass < 12; pass++) {
    const mine = d6() + Math.floor(char.exp / 4);
    const his = d6() + Math.floor(npc.exp / 4);
    if (mine > his) npcWounds += d6() + Math.floor(char.str / 6);
    if (his > mine) playerWounds += d6() + Math.floor(npc.str / 6);
    if (playerWounds >= playerThreshold || npcWounds >= npcThreshold) break;
  }
  if (npcWounds >= npcThreshold && playerWounds < playerThreshold) {
    finishDuelWon(state, npc, toTheDeath, ctx);
    return;
  }
  if (playerWounds >= playerThreshold) {
    finishDuelLost(state, npc, toTheDeath, playerWounds, ctx);
    return;
  }
  ctx.lines.push('Twelve passes and no blood drawn; honour is declared satisfied and you breakfast together.');
}

function finishDuelWon(state, npc, toTheDeath, ctx) {
  const char = state.character;
  const relation = regimentRelation(char, npc);
  char.exp += 1;
  let sp = duelWinStatus(relation);
  const killed = toTheDeath && d6() <= 3;
  if (killed) {
    sp += DUEL_STATUS.kill;
    npc.alive = false;
    if (npc.mistressId !== null) findLady(state, npc.mistressId).lover = null;
    ctx.lines.push('Your point takes ' + npc.name + ' through the chest. He does not rise. (' + formatSP(sp) + ' status, +1 Expertise)');
  } else {
    npc.grudge += 1;
    ctx.lines.push('First blood to you: ' + npc.name + ' is pinked and yields. (' + formatSP(sp) + ' status, +1 Expertise)');
  }
  ctx.sp += sp;
}

function finishDuelLost(state, npc, toTheDeath, wounds, ctx) {
  const char = state.character;
  const relation = regimentRelation(char, npc);
  npc.exp += 1;
  if (relation === 'enemy') ctx.sp += DUEL_STATUS.loseVsEnemy;
  if (toTheDeath && d6() <= 3) {
    killCharacter(state, 'Killed in a duel with ' + npc.name + '.');
    ctx.lines.push(npc.name + "'s blade slips past your guard, and the morning goes very quiet.");
    return;
  }
  applyWound(char, wounds * 4, toTheDeath ? 4 : 1);
  ctx.lines.push(npc.name + ' pinks you neatly. The wound is more to your pride than your person.');
}

function formatSP(sp) {
  return sp >= 0 ? '+' + sp : String(sp);
}

// Endurance lost to violence; half of it mends in the first week of rest.
function applyWound(char, endLost, restWeeks) {
  char.endCur = Math.max(1, char.endCur - endLost);
  char.firstWeekHeal = Math.floor(endLost / 2);
  char.woundWeeks += restWeeks;
}

// ---------- Affairs of honour ----------

const AFFAIR_RESPONSES = {
  challenge: function (state, affair, ctx) {
    const npc = findNpc(state, affair.npcId);
    resolveDuel(state, npc, npc.grudge >= 2, ctx);
  },
  accept: function (state, affair, ctx) {
    const npc = findNpc(state, affair.npcId);
    resolveDuel(state, npc, npc.grudge >= 2, ctx);
  },
  refuse: function (state, affair, ctx) {
    const char = state.character;
    const loss = Math.ceil(char.sl / 2);
    ctx.sp -= loss;
    findNpc(state, affair.npcId).grudge += 1;
    ctx.lines.push('You decline to meet ' + findNpc(state, affair.npcId).name + '. The word "coward" travels fast (-' + loss + ' status).');
  },
  letpass: function (state, affair, ctx) {
    ctx.sp -= 2;
    ctx.lines.push('You affect not to hear. It costs you in the telling (-2 status).');
  },
};

function answerAffair(state, affairIndex, response) {
  const affair = state.affairs.splice(affairIndex, 1)[0];
  const ctx = newMonthContext();
  AFFAIR_RESPONSES[response](state, affair, ctx);
  state.character.carrySP += ctx.sp;
  appendGazette(state, 'Affair of Honour', ctx.lines);
  return ctx.lines;
}

// ---------- Regiments: joining and leaving ----------

function applicationRollNeeded(char, regiment) {
  if (regiment.id === 'frontier') return 0;
  if (char.sl < Math.max(1, regiment.firstSL)) return 99;
  return 5 - Math.floor((char.sl - regiment.firstSL) / 2);
}

// Cavalrymen and captains ride; majors and above (generals included) keep three.
function horsesForRank(rankIndex, regiment) {
  if (rankIndex >= 3) return 3;
  if (rankIndex >= 2) return 1;
  return regiment.cavalry ? 1 : 0;
}

// Purchase is cumulative: a commission costs every rank up to it.
function commissionPrice(rankIndex, col) {
  let total = 0;
  for (let i = 1; i <= rankIndex; i++) total += RANKS[i].price[col];
  return total;
}

// Ranks open to a direct buy-in at this regiment, by social level,
// best commission first.
function entryRanks(char, regiment) {
  const col = regiment.column;
  const open = [];
  for (let i = MAX_ENTRY_RANK; i >= 0; i--) {
    if (char.sl >= RANKS[i].minSL[col]) {
      open.push({ index: i, rank: RANKS[i], price: commissionPrice(i, col), horses: horsesForRank(i, regiment), status: RANKS[i].status[col] });
    }
  }
  return open;
}

function applyToRegiment(state, regimentId, rankIndex) {
  const char = state.character;
  const regiment = findRegiment(regimentId);
  const needed = applicationRollNeeded(char, regiment);
  if (needed > 6) return { ok: false, message: 'The ' + regiment.name + ' does not take gentlemen of your standing.' };
  const rank = RANKS[rankIndex];
  const col = regiment.column;
  if (char.sl < rank.minSL[col]) return { ok: false, message: 'A ' + rank.name + "'s commission in the " + regiment.name + ' wants a gentleman of social level ' + rank.minSL[col] + '.' };
  const price = commissionPrice(rankIndex, col);
  const horses = horsesForRank(rankIndex, regiment);
  const cost = price + horses * HORSE_PRICE;
  if (char.cash < cost) return { ok: false, message: 'Joining as a ' + rank.name + ' costs ' + cost + ' crowns' + (horses > 0 ? ' (' + horses + ' horse' + (horses > 1 ? 's' : '') + ' included)' : '') + ' — beyond your purse.' };
  if (needed > 0 && d6() < needed) return { ok: false, message: 'The ' + regiment.name + ' regrets it has no place for you at present.' };
  char.cash -= cost;
  char.horses = horses;
  char.regimentId = regimentId;
  char.rankIndex = rankIndex;
  char.seniority = 0;
  char.appointmentId = null;
  if (rankIndex === 0) return { ok: true, message: 'You are sworn in as a Private of the ' + regiment.name + '.' };
  return { ok: true, message: 'You purchase a ' + rank.name + "'s commission in the " + regiment.name + ' (' + cost + ' crowns' + (horses > 0 ? ', stable of ' + horses : '') + ').' };
}

function leaveRegiment(state) {
  const char = state.character;
  char.regimentId = null;
  char.rankIndex = -1;
  char.seniority = 0;
  char.appointmentId = null;
  char.horses = 0;
}

// ---------- Clubs ----------

// A gentleman who meets the requirements is made a member immediately.
function joinClub(state, clubId) {
  const char = state.character;
  const club = findClub(clubId);
  if (!clubEligible(char, club)) return { ok: false, message: club.name + ' will not have you.' };
  char.clubId = clubId;
  return { ok: true, message: 'You are made a member of ' + club.name + ' at once.' };
}

// ---------- Moneylender ----------

function borrowMoney(state, amount) {
  const char = state.character;
  const capped = Math.min(amount, borrowLimit(char));
  if (capped <= 0) return { ok: false, message: 'The moneylender shakes his head: your credit is spent.' };
  char.debt += capped;
  char.cash += capped;
  return { ok: true, message: 'You borrow ' + capped + ' crowns at ten percent the half-year.' };
}

function repayDebt(state, amount) {
  const char = state.character;
  const paid = Math.min(amount, char.debt, char.cash);
  if (paid <= 0) return { ok: false, message: 'Nothing is repaid.' };
  char.debt -= paid;
  char.cash -= paid;
  return { ok: true, message: 'You repay ' + paid + ' crowns of your debts.' };
}

// ---------- Death ----------

function killCharacter(state, epitaph) {
  const char = state.character;
  char.dead = true;
  char.epitaph = epitaph;
  if (char.mistressId !== null) {
    findLady(state, char.mistressId).lover = null;
  }
}

// ---------- Monthly resolution ----------

function requiredDutyWeeks(char) {
  if (char.woundWeeks > 0) return 0; // the surgeon's certificate excuses duty
  const rank = rankData(char);
  if (rank === null) return 0;
  return rank.dutyWeeks;
}

function validatePlan(state, plan) {
  const char = state.character;
  const errors = [];
  const dutyPlanned = plan.weeks.filter(function (w) { return w.action === 'duty'; }).length;
  if (dutyPlanned < requiredDutyWeeks(char)) {
    errors.push('Your rank requires ' + requiredDutyWeeks(char) + ' duty week(s) this month.');
  }
  const woundIdle = plan.weeks.slice(0, Math.min(4, char.woundWeeks)).filter(function (w) { return w.action === 'idle'; }).length;
  if (woundIdle < Math.min(4, char.woundWeeks)) {
    errors.push('Your wounds demand ' + Math.min(4, char.woundWeeks) + ' week(s) of rest first.');
  }
  return errors;
}

function newMonthContext() {
  return { sp: 0, lines: [], gazette: [], dutyDone: 0, bawdyVisited: false, caroused: false, duesPaid: false, finalSP: 0 };
}

function resolveMonth(state, plan) {
  const char = state.character;
  const ctx = newMonthContext();

  if (char.atFront !== null) {
    resolveCampaignMonth(state, ctx);
    if (!char.dead) simulateRivals(state, ctx);
    finishMonth(state, ctx, true);
    return ctx;
  }

  ctx.dutyRequired = requiredDutyWeeks(char);
  plan.weeks.forEach(function (week) {
    if (char.dead) return;
    WEEK_ACTIONS[week.action].resolve(state, week.params, ctx);
  });
  resolveConspicuous(state, plan.conspicuous, ctx);
  if (char.dead) {
    finishMonth(state, ctx, true);
    return ctx;
  }
  resolveDutyFines(state, ctx);
  resolveIncome(state, ctx);
  resolveUpkeep(state, ctx);
  resolveMonthlyStatus(state, ctx);
  resolveDebts(state, ctx);
  simulateRivals(state, ctx);
  reckonStatus(state, ctx);
  finishMonth(state, ctx, false);
  return ctx;
}

// A flat +1: spending an extra SL crowns on show buys one status point,
// and no more however much is spent.
function resolveConspicuous(state, wanted, ctx) {
  const char = state.character;
  if (!wanted) return;
  const cost = CONSPICUOUS_MULT * char.sl;
  if (char.cash < cost) return;
  char.cash -= cost;
  ctx.sp += 1;
  ctx.lines.push('Conspicuous consumption: new plumes, new lace, new carriage-hire (' + cost + ' crowns, +1 status).');
}

function resolveDutyFines(state, ctx) {
  const char = state.character;
  const owed = ctx.dutyRequired;
  if (owed <= 0 || ctx.dutyDone >= owed) return;
  const fine = 10 * (owed - ctx.dutyDone);
  char.cash = Math.max(0, char.cash - fine);
  ctx.sp -= 2;
  ctx.lines.push('You shirked duty; the regiment fines you ' + fine + ' crowns and the mess talks (-2 status).');
}

function resolveIncome(state, ctx) {
  const char = state.character;
  let income = char.allowance + char.pension;
  const rank = rankData(char);
  if (rank !== null) income += rank.pay;
  if (char.appointmentId !== null) {
    income += findAppointment(char.appointmentId).pay;
  }
  if (income > 0) {
    char.cash += income;
    ctx.lines.push('Income: ' + income + ' crowns (allowance, pay, pensions).');
  }
  resolveMistressGifts(state, ctx);
}

function resolveMistressGifts(state, ctx) {
  const char = state.character;
  if (char.mistressId === null) return;
  const lady = findLady(state, char.mistressId);
  if (lady.wealthy && lady.sl > char.sl) {
    const gift = MISTRESS_SUPPORT_MULT * lady.sl;
    char.cash += gift;
    ctx.lines.push(lady.name + ' presses a purse of ' + gift + ' crowns on you. It would be rude to refuse.');
  }
}

function resolveUpkeep(state, ctx) {
  const char = state.character;
  resolveMistressSupport(state, ctx);
  resolveClubDues(state, ctx);
  resolveStableUpkeep(state, ctx);
  const maintenance = MAINTENANCE_MULT * char.sl;
  if (char.cash >= maintenance) {
    char.cash -= maintenance;
    return;
  }
  char.cash = 0;
  char.sl = Math.max(1, char.sl - 1);
  ctx.lines.push('You cannot keep up appearances (' + maintenance + ' crowns wanted). Your social level falls to ' + char.sl + '.');
}

function resolveMistressSupport(state, ctx) {
  const char = state.character;
  if (char.mistressId === null) return;
  const lady = findLady(state, char.mistressId);
  if (lady.wealthy && lady.sl > char.sl) return;
  const support = MISTRESS_SUPPORT_MULT * lady.sl;
  if (char.cash >= support) {
    char.cash -= support;
    return;
  }
  lady.lover = null;
  char.mistressId = null;
  ctx.lines.push(lady.name + ' discovers the state of your purse and departs in a hired coach.');
}

function resolveClubDues(state, ctx) {
  const char = state.character;
  if (char.clubId === null) return;
  const club = findClub(char.clubId);
  if (char.cash >= club.dues) {
    char.cash -= club.dues;
    ctx.duesPaid = true;
    return;
  }
  char.clubId = null;
  ctx.lines.push('Struck from the rolls of ' + club.name + ' for non-payment of dues.');
}

function resolveStableUpkeep(state, ctx) {
  const char = state.character;
  if (char.horses <= 0) return;
  const cost = char.horses * HORSE_UPKEEP + GROOM_WAGE;
  if (char.cash >= cost) {
    char.cash -= cost;
    return;
  }
  ctx.sp -= 1;
  ctx.lines.push('Your groom goes unpaid and your horses look it (-1 status).');
}

function resolveMonthlyStatus(state, ctx) {
  const char = state.character;
  if (ctx.duesPaid) ctx.sp += findClub(char.clubId).status;
  const rank = rankData(char);
  if (rank !== null) ctx.sp += rank.status;
  if (char.appointmentId !== null) {
    ctx.sp += findAppointment(char.appointmentId).status;
  }
  ctx.sp += Math.min(char.mentions, 5);
  resolveCompanionship(state, ctx);
}

function resolveCompanionship(state, ctx) {
  const char = state.character;
  if (char.mistressId !== null) {
    const lady = findLady(state, char.mistressId);
    ctx.sp += 1 + (lady.beautiful ? 1 : 0);
    char.lonelyMonths = 0;
    return;
  }
  if (ctx.bawdyVisited) {
    char.lonelyMonths = 0;
    return;
  }
  char.lonelyMonths += 1;
  ctx.sp -= char.lonelyMonths;
  ctx.lines.push('A gentleman seen nowhere with a lady is talked about (-' + char.lonelyMonths + ' status).');
}

function resolveDebts(state, ctx) {
  const char = state.character;
  if (char.debt <= 0) {
    char.debtMonths = 0;
    return;
  }
  char.debtMonths += 1;
  if (char.debtMonths % LOAN_INTEREST_PERIOD === 0) {
    const interest = Math.ceil(char.debt * LOAN_INTEREST_RATE);
    char.debt += interest;
    ctx.lines.push('The moneylender adds ' + interest + ' crowns of interest to your account.');
  }
  if (char.debt > LOAN_LIMIT_BASE + char.sl * LOAN_LIMIT_PER_SL + 100) {
    const seized = Math.min(char.cash, char.debt);
    char.cash -= seized;
    char.debt -= seized;
    char.sl = Math.max(1, char.sl - 1);
    ctx.lines.push('Bailiffs at the door! ' + seized + ' crowns are seized and your credit is a public joke. Social level falls to ' + char.sl + '.');
  }
}

// ---------- Status forecast (the Status panel) ----------

// Everything that will count toward this month's status if every roll goes
// the player's way: standing influences plus the planned weeks' best cases.
function statusForecast(state, plan) {
  const char = state.character;
  const items = [];
  if (char.carrySP !== 0) items.push({ label: 'Carried over', sp: char.carrySP });
  const rank = rankData(char);
  if (rank !== null) items.push({ label: rank.name + ', ' + findRegiment(char.regimentId).name, sp: rank.status });
  if (char.clubId !== null) {
    const club = findClub(char.clubId);
    items.push({ label: 'Member of ' + club.name, sp: club.status });
  }
  if (char.appointmentId !== null) {
    const appt = findAppointment(char.appointmentId);
    items.push({ label: appt.name, sp: appt.status });
  }
  if (char.mentions > 0) items.push({ label: 'Mentioned in despatches', sp: Math.min(char.mentions, 5) });
  const companionship = companionshipForecast(state, plan);
  if (companionship !== null) items.push(companionship);
  plan.weeks.forEach(function (week, i) {
    const sp = WEEK_ACTIONS[week.action].forecastSP(state, week.params);
    if (sp !== 0) items.push({ label: 'Week ' + (i + 1) + ': ' + WEEK_ACTIONS[week.action].label, sp: sp });
  });
  if (plan.conspicuous) items.push({ label: 'Conspicuous consumption', sp: 1 });
  const dutyPlanned = plan.weeks.filter(function (w) { return w.action === 'duty'; }).length;
  if (dutyPlanned < requiredDutyWeeks(char)) items.push({ label: 'Shirking regimental duty', sp: -2 });
  return items;
}

function companionshipForecast(state, plan) {
  const char = state.character;
  if (char.mistressId !== null) {
    const lady = findLady(state, char.mistressId);
    return { label: 'Mistress: ' + lady.name, sp: 1 + (lady.beautiful ? 1 : 0) };
  }
  const courted = plan.weeks.find(function (w) { return w.action === 'court'; });
  if (courted !== undefined) {
    const lady = findLady(state, courted.params.ladyId);
    if (lady !== undefined) return { label: 'If ' + lady.name + ' consents', sp: 1 + (lady.beautiful ? 1 : 0) };
  }
  if (plan.weeks.some(function (w) { return w.action === 'bawdy'; })) return null;
  return { label: 'No lady on your arm', sp: -(char.lonelyMonths + 1) };
}

// ---------- Expenses forecast (the Expenses panel) ----------

// Everything the month is set to cost: standing commitments (maintenance,
// dues, mistress, stable, interest) plus the planned weeks' outlays.
function expensesForecast(state, plan) {
  const char = state.character;
  const items = [];
  items.push({ label: 'Keeping up appearances (SL ' + char.sl + ')', cost: MAINTENANCE_MULT * char.sl });
  if (char.clubId !== null) {
    const club = findClub(char.clubId);
    items.push({ label: 'Dues at ' + club.name, cost: club.dues });
  }
  const support = mistressSupportForecast(state);
  if (support !== null) items.push(support);
  if (char.horses > 0) {
    items.push({ label: 'Stable of ' + char.horses + ' and a groom', cost: char.horses * HORSE_UPKEEP + GROOM_WAGE });
  }
  if (char.debt > 0 && (char.debtMonths + 1) % LOAN_INTEREST_PERIOD === 0) {
    items.push({ label: 'Interest falls due', cost: Math.ceil(char.debt * LOAN_INTEREST_RATE) });
  }
  plan.weeks.forEach(function (week, i) {
    const action = WEEK_ACTIONS[week.action];
    const cost = action.forecastCost(state, week.params);
    if (cost !== 0) {
      const label = action.costLabel !== undefined ? action.costLabel : action.label;
      items.push({ label: 'Week ' + (i + 1) + ': ' + label, cost: cost });
    }
  });
  if (plan.conspicuous) {
    items.push({ label: 'Conspicuous consumption', cost: CONSPICUOUS_MULT * char.sl });
  }
  const dutyPlanned = plan.weeks.filter(function (w) { return w.action === 'duty'; }).length;
  const owed = requiredDutyWeeks(char);
  if (dutyPlanned < owed) items.push({ label: 'Fines for shirked duty', cost: 10 * (owed - dutyPlanned) });
  return items;
}

function mistressSupportForecast(state) {
  const char = state.character;
  if (char.mistressId === null) return null;
  const lady = findLady(state, char.mistressId);
  if (lady.wealthy && lady.sl > char.sl) return null;
  return { label: 'Keeping ' + lady.name, cost: MISTRESS_SUPPORT_MULT * lady.sl };
}

// Forecast counterpart of resolveIncome, for the Expenses panel hint.
function incomeForecast(state) {
  const char = state.character;
  let income = char.allowance + char.pension;
  const rank = rankData(char);
  if (rank !== null) income += rank.pay;
  if (char.appointmentId !== null) income += findAppointment(char.appointmentId).pay;
  if (char.mistressId !== null) {
    const lady = findLady(state, char.mistressId);
    if (lady.wealthy && lady.sl > char.sl) income += MISTRESS_SUPPORT_MULT * lady.sl;
  }
  return income;
}

// ---------- Status reckoning ----------

function reckonStatus(state, ctx) {
  const char = state.character;
  const sp = ctx.sp + char.carrySP;
  char.carrySP = 0;
  ctx.finalSP = sp;
  const needed = 3 * (char.sl + 1);
  if (sp >= needed) {
    char.sl += 1;
    char.peakSL = Math.max(char.peakSL, char.sl);
    ctx.lines.push('Paris takes note: with ' + sp + ' status points you rise to social level ' + char.sl + '!');
    return;
  }
  if (sp < char.sl) {
    char.sl = Math.max(1, char.sl - 1);
    ctx.lines.push('Only ' + sp + ' status points this month; your star fades to social level ' + char.sl + '.');
    return;
  }
  ctx.lines.push('You hold your place in society (' + sp + ' status points against level ' + char.sl + ').');
}

// ---------- Campaigns ----------

function deploymentSeason(state) {
  return CAMPAIGN_MONTHS.indexOf(currentMonth(state)) >= 0;
}

function rollJuneDeployments(state, ctx) {
  state.warBrigades = [];
  Object.keys(BRIGADE_DEPLOYMENT).forEach(function (brigade) {
    if (d6() <= BRIGADE_DEPLOYMENT[brigade]) state.warBrigades.push(brigade);
  });
  const char = state.character;
  if (char.regimentId === null) return;
  const regiment = findRegiment(char.regimentId);
  if (state.warBrigades.indexOf(regiment.brigade) < 0) return;
  char.atFront = { volunteer: false, monthsLeft: 3, engaged: false };
  ctx.lines.push('The ' + regiment.name + ' takes the field! You march with the summer campaign.');
}

function volunteerForCampaign(state) {
  const char = state.character;
  char.atFront = { volunteer: true, monthsLeft: 4 - CAMPAIGN_MONTHS.indexOf(currentMonth(state)) - 1, engaged: false };
  char.carrySP += 3;
  return 'You volunteer for the frontier — Paris approves of dash (+3 status on your return).';
}

function frontRegiment(char) {
  if (char.atFront.volunteer) return findRegiment('frontier');
  return findRegiment(char.regimentId);
}

function resolveCampaignMonth(state, ctx) {
  const char = state.character;
  const front = char.atFront;
  front.monthsLeft -= 1;
  const mustEngage = front.monthsLeft === 0 && !front.engaged;
  if (!front.engaged && (mustEngage || d6() <= 2)) {
    front.engaged = true;
    resolveEngagement(state, ctx);
  } else {
    ctx.lines.push('Camp fever, mud, and drill. The war keeps its distance this month.');
  }
  if (char.dead) return;
  const rank = rankData(char);
  if (rank !== null) char.cash += rank.pay;
  if (front.monthsLeft <= 0) {
    char.atFront = null;
    ctx.lines.push('The regiment is recalled to Paris for the winter. You have survived the season.');
  }
}

function resolveEngagement(state, ctx) {
  const char = state.character;
  const regiment = frontRegiment(char);
  const mission = MISSION_TYPES[d6() - 1];
  const row = Math.max(1, Math.min(10, roll2d6() - 2));
  const br = BATTLE_RESULT[row - 1][char.ma - 1];
  const outcome = PERSONAL_OUTCOME[mission][br - 1];
  const rankMods = RANK_OUTCOME_MODS[Math.max(0, char.rankIndex)];
  ctx.lines.push(engagementFlavor(mission, br, regiment));
  if (roll2d6() + regiment.mods.death + rankMods.death >= outcome.death) {
    resolveBattleDeath(state, regiment, ctx);
    if (char.dead) return;
  }
  if (roll2d6() + regiment.mods.mention + rankMods.mention >= outcome.mention) {
    char.mentions += 1;
    char.carrySP += 6;
    ctx.lines.push('You are mentioned in despatches! (+6 status on your return, and Paris remembers.)');
  }
  if (roll2d6() + regiment.mods.promotion + rankMods.promotion >= outcome.promotion) {
    resolveBattlePromotion(state, ctx);
  }
  if (outcome.plunder !== null && roll2d6() + regiment.mods.crowns + rankMods.crowns >= outcome.crowns) {
    const loot = rollDice(outcome.plunder[0], 6) * outcome.plunder[1];
    char.cash += loot;
    ctx.lines.push('Plunder! You come away ' + loot + ' crowns the richer.');
  }
}

function engagementFlavor(mission, br, regiment) {
  const quality = ['a famous victory', 'a hard-won success', 'a creditable action', 'a confused affair', 'a costly reverse', 'a bloody disaster'][br - 1];
  return mission + ' with the ' + regiment.name + ': ' + quality + '.';
}

function resolveBattleDeath(state, regiment, ctx) {
  const char = state.character;
  if (d6() <= 3) {
    killCharacter(state, 'Fell in ' + monthLabel(state) + ', serving with the ' + regiment.name + '.');
    ctx.lines.push('A ball finds you in the smoke. The regiment buries you with honours.');
    return;
  }
  applyWound(char, Math.ceil(char.endCur / 2), 8);
  char.atFront = null;
  ctx.lines.push('You fall grievously wounded and are carted home to Paris to mend.');
}

function resolveBattlePromotion(state, ctx) {
  const char = state.character;
  const purchase = nextRankPurchase(char);
  if (purchase === null) return;
  if (char.sl < purchase.minSL) return;
  char.rankIndex += 1;
  char.seniority = 0;
  ctx.lines.push('Field promotion! You are made ' + purchase.rank.name + ' without purchase.');
  const needed = horsesForRank(char.rankIndex, findRegiment(char.regimentId));
  const stableCost = Math.max(0, needed - char.horses) * HORSE_PRICE;
  if (stableCost > 0 && char.cash >= stableCost) {
    char.cash -= stableCost;
    char.horses = needed;
    ctx.lines.push('New rank, new stable: you buy up to ' + needed + ' horses (' + stableCost + ' crowns).');
  }
}

// ---------- Rival NPCs ----------

function simulateRivals(state, ctx) {
  state.npcs.forEach(function (npc) {
    if (!npc.alive) return;
    simulateRivalCampaign(state, npc, ctx);
    if (!npc.alive) return;
    simulateRivalDrift(npc);
    simulateRivalCourtship(state, npc, ctx);
    simulateRivalPoaching(state, npc, ctx);
    simulateRivalInsult(state, npc, ctx);
  });
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

function simulateRivalDrift(npc) {
  if (chance(0.12)) npc.sl += 1;
  else if (chance(0.08)) npc.sl = Math.max(1, npc.sl - 1);
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

function simulateRivalPoaching(state, npc, ctx) {
  const char = state.character;
  if (char.mistressId === null || npcAtWar(state, npc)) return;
  const lady = findLady(state, char.mistressId);
  const away = char.atFront !== null;
  if (npc.sl < lady.sl - 2 || !chance(away ? 0.12 : 0.05)) return;
  if (away) {
    lady.lover = npc.id;
    npc.mistressId = lady.id;
    char.mistressId = null;
    ctx.gazette.push('While you were at the wars, ' + npc.name + ' has carried off ' + lady.name + '.');
    return;
  }
  state.affairs.push({ type: 'poach', npcId: npc.id, reason: 'He pays open court to ' + lady.name + ', your mistress.' });
  ctx.gazette.push(npc.name + ' sends flowers to ' + lady.name + ' — everyone is watching to see what you will do.');
}

function simulateRivalInsult(state, npc, ctx) {
  const char = state.character;
  if (!ctx.caroused || char.regimentId === null || npc.regimentId === null) return;
  const relation = regimentRelation(char, npc);
  if (relation !== 'enemy' || !chance(0.12)) return;
  state.affairs.push({ type: 'insult', npcId: npc.id, reason: 'Words over cards: he calls your regiment a pack of tavern bullies.' });
  ctx.gazette.push('Hot words between you and ' + npc.name + ' at the club — seconds are being spoken of.');
}

// ---------- Month bookkeeping ----------

function appendGazette(state, heading, lines) {
  if (lines.length === 0) return;
  state.gazette.unshift({ heading: heading, lines: lines.slice() });
  if (state.gazette.length > 60) state.gazette.pop();
}

function finishMonth(state, ctx, statusFrozen) {
  const char = state.character;
  if (statusFrozen && !char.dead) {
    char.carrySP += Math.max(0, ctx.sp);
  }
  appendGazette(state, monthLabel(state), ctx.lines.concat(ctx.gazette || []));
  state.monthIndex += 1;
  char.seniority += 1;
  if (char.dead) return;
  if (currentMonth(state) === CAMPAIGN_MONTHS[0] && char.atFront === null) {
    const juneCtx = { lines: [] };
    rollJuneDeployments(state, juneCtx);
    if (juneCtx.lines.length > 0) appendGazette(state, 'The Drums of Summer', juneCtx.lines);
  }
}
