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
// forecastCost: what the week is set to cost, for the Ledger panel.
const WEEK_ACTIONS = {
  idle: {
    label: 'Keep to your lodgings',
    resolve: function (state, params, ctx) {
      const char = state.character;
      if (char.woundWeeks > 0) {
        char.woundWeeks -= 1;
        ctx.recuperated = true;
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
    label: 'Carouse',
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
      ctx.lines.push('You carouse at ' + carouseCompany(state) + ' (' + cost + ' crowns, +1 status).');
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
      if (npc === undefined || !npc.alive) return 0;
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
  const net = (wins - losses) * wager;
  const outcome = net > 0 ? 'Won ' + net + ' crowns' : (net < 0 ? 'Lost ' + (-net) + ' crowns' : 'Broke even');
  ctx.lines.push(outcome + ' at ' + venue.name + ': ' + wins + ' won, ' + losses + ' lost at ' + wager + ' crowns a hand.' + bonusNote);
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
  if (npc === undefined || !npc.alive) {
    ctx.lines.push('The gentleman you meant to flatter has left Paris, feet first.');
    return;
  }
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
    clearDanglingAffairs(state);
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
  // attempted marks whether a suit was actually pressed. Failing the eligibility
  // or affordability pre-checks means you never petitioned, so it must not burn
  // your one application for the month; only reaching the acceptance roll does.
  const needed = applicationRollNeeded(char, regiment);
  if (needed > 6) return { ok: false, attempted: false, message: 'The ' + regiment.name + ' does not take gentlemen of your standing.' };
  const rank = RANKS[rankIndex];
  const col = regiment.column;
  if (char.sl < rank.minSL[col]) return { ok: false, attempted: false, message: 'A ' + rank.name + "'s commission in the " + regiment.name + ' wants a gentleman of social level ' + rank.minSL[col] + '.' };
  const price = commissionPrice(rankIndex, col);
  const horses = horsesForRank(rankIndex, regiment);
  const cost = price + horses * HORSE_PRICE;
  if (char.cash < cost) return { ok: false, attempted: false, message: 'Joining as a ' + rank.name + ' costs ' + cost + ' crowns' + (horses > 0 ? ' (' + horses + ' horse' + (horses > 1 ? 's' : '') + ' included)' : '') + ' — beyond your purse.' };
  if (needed > 0 && d6() < needed) return { ok: false, attempted: true, message: 'The ' + regiment.name + ' regrets it has no place for you at present.' };
  char.cash -= cost;
  char.horses = horses;
  char.regimentId = regimentId;
  char.rankIndex = rankIndex;
  char.seniority = 0;
  char.appointmentId = null;
  if (rankIndex === 0) return { ok: true, attempted: true, message: 'You are sworn in as a Private of the ' + regiment.name + '.' };
  return { ok: true, attempted: true, message: 'You purchase a ' + rank.name + "'s commission in the " + regiment.name + ' (' + cost + ' crowns' + (horses > 0 ? ', stable of ' + horses : '') + ').' };
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

function leaveClub(state) {
  const char = state.character;
  const club = findClub(char.clubId);
  char.clubId = null;
  return 'You send your resignation round to ' + club.name + '; the porter bows you out without a word.';
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

// A mistress expects an evening on the town: one carouse week each month.
function requiredCarouseWeeks(char) {
  if (char.woundWeeks > 0) return 0; // she forgives a wounded man
  return char.mistressId === null ? 0 : 1;
}

// Where, and with whom, the carousing week is spent.
function carouseCompany(state) {
  const char = state.character;
  const where = char.clubId !== null ? findClub(char.clubId).name : 'the taverns of the town';
  if (char.mistressId === null) return where;
  return where + ' with ' + findLady(state, char.mistressId).name;
}

function validatePlan(state, plan) {
  const char = state.character;
  const errors = [];
  const dutyPlanned = plan.weeks.filter(function (w) { return w.action === 'duty'; }).length;
  if (dutyPlanned < requiredDutyWeeks(char)) {
    errors.push('Your rank requires ' + requiredDutyWeeks(char) + ' duty week(s) this month.');
  }
  const carousePlanned = plan.weeks.filter(function (w) { return w.action === 'carouse'; }).length;
  if (carousePlanned < requiredCarouseWeeks(char)) {
    errors.push('Your mistress expects to be taken carousing one week this month.');
  }
  const woundIdle = plan.weeks.slice(0, Math.min(4, char.woundWeeks)).filter(function (w) { return w.action === 'idle'; }).length;
  if (woundIdle < Math.min(4, char.woundWeeks)) {
    errors.push('Your wounds demand ' + Math.min(4, char.woundWeeks) + ' week(s) of rest first.');
  }
  return errors;
}

function newMonthContext() {
  return { sp: 0, lines: [], gazette: [], dutyDone: 0, bawdyVisited: false, caroused: false, duesPaid: false, recuperated: false, finalSP: 0 };
}

function resolveMonth(state, plan) {
  const char = state.character;
  const ctx = newMonthContext();

  ctx.dutyRequired = requiredDutyWeeks(char);
  ctx.carouseRequired = requiredCarouseWeeks(char);
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
  resolveMistressNeglect(state, ctx);
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

// The planner requires a carouse week, so this only fires when the week
// fizzled — too poor to pay for the evening. She does not stay for that.
function resolveMistressNeglect(state, ctx) {
  const char = state.character;
  if (ctx.carouseRequired <= 0 || ctx.caroused || char.mistressId === null) return;
  const lady = findLady(state, char.mistressId);
  lady.lover = null;
  char.mistressId = null;
  ctx.lines.push(lady.name + ' waits all month for an evening on the town, and finding none, departs.');
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
    const gift = MISTRESS_GIFT_MULT * (lady.sl - char.sl);
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
  if (lady.wealthy) return; // a wealthy mistress never needs keeping
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
  if (ctx.recuperated) {
    char.lonelyMonths = 0;
    ctx.lines.push('Society excuses a wounded man his solitude.');
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
    const caroused = plan.weeks.some(function (w) { return w.action === 'carouse'; });
    if (requiredCarouseWeeks(char) > 0 && !caroused) {
      const excused = plan.weeks.some(function (w) { return w.action === 'bawdy'; });
      return { label: lady.name + ', neglected, will depart', sp: excused ? 0 : -(char.lonelyMonths + 1) };
    }
    return { label: 'Mistress: ' + lady.name, sp: 1 + (lady.beautiful ? 1 : 0) };
  }
  const courted = plan.weeks.find(function (w) { return w.action === 'court'; });
  if (courted !== undefined) {
    const lady = findLady(state, courted.params.ladyId);
    if (lady !== undefined) return { label: 'If ' + lady.name + ' consents', sp: 1 + (lady.beautiful ? 1 : 0) };
  }
  if (plan.weeks.some(function (w) { return w.action === 'bawdy'; })) return null;
  if (char.woundWeeks > 0) return null; // recuperation excuses the solitude
  return { label: 'No lady on your arm', sp: -(char.lonelyMonths + 1) };
}

// ---------- Ledger forecast (the Ledger panel) ----------

// Everything the month is set to cost: standing commitments (maintenance,
// dues, mistress, stable, interest) plus the planned weeks' outlays.
function expensesForecast(state, plan) {
  const char = state.character;
  const items = [];
  items.push({ label: 'Keeping up appearances (SL ' + char.sl + ')', amount: MAINTENANCE_MULT * char.sl });
  if (char.clubId !== null) {
    const club = findClub(char.clubId);
    items.push({ label: 'Dues at ' + club.name, amount: club.dues });
  }
  const support = mistressSupportForecast(state);
  if (support !== null) items.push(support);
  if (char.horses > 0) {
    items.push({ label: 'Stable of ' + char.horses + ' and a groom', amount: char.horses * HORSE_UPKEEP + GROOM_WAGE });
  }
  if (char.debt > 0 && (char.debtMonths + 1) % LOAN_INTEREST_PERIOD === 0) {
    items.push({ label: 'Interest falls due', amount: Math.ceil(char.debt * LOAN_INTEREST_RATE) });
  }
  plan.weeks.forEach(function (week, i) {
    const action = WEEK_ACTIONS[week.action];
    const cost = action.forecastCost(state, week.params);
    if (cost !== 0) {
      const label = action.costLabel !== undefined ? action.costLabel : action.label;
      items.push({ label: 'Week ' + (i + 1) + ': ' + label, amount: cost });
    }
  });
  if (plan.conspicuous) {
    items.push({ label: 'Conspicuous consumption', amount: CONSPICUOUS_MULT * char.sl });
  }
  const dutyPlanned = plan.weeks.filter(function (w) { return w.action === 'duty'; }).length;
  const owed = requiredDutyWeeks(char);
  if (dutyPlanned < owed) items.push({ label: 'Fines for shirked duty', amount: 10 * (owed - dutyPlanned) });
  return items;
}

function mistressSupportForecast(state) {
  const char = state.character;
  if (char.mistressId === null) return null;
  const lady = findLady(state, char.mistressId);
  if (lady.wealthy) return null; // a wealthy mistress never needs keeping
  return { label: 'Keeping ' + lady.name, amount: MISTRESS_SUPPORT_MULT * lady.sl };
}

// Forecast counterpart of resolveIncome, itemized for the Ledger panel.
function incomeForecast(state) {
  const char = state.character;
  const items = [];
  if (char.allowance > 0) items.push({ label: 'Allowance from home', amount: char.allowance });
  const rank = rankData(char);
  if (rank !== null && rank.pay > 0) items.push({ label: 'Pay as ' + rank.name, amount: rank.pay });
  if (char.appointmentId !== null) {
    const appt = findAppointment(char.appointmentId);
    if (appt.pay > 0) items.push({ label: 'Pay as ' + appt.name, amount: appt.pay });
  }
  if (char.pension > 0) items.push({ label: 'Pension', amount: char.pension });
  const gift = mistressGiftForecast(state);
  if (gift !== null) items.push(gift);
  return items;
}

function mistressGiftForecast(state) {
  const char = state.character;
  if (char.mistressId === null) return null;
  const lady = findLady(state, char.mistressId);
  if (!lady.wealthy || lady.sl <= char.sl) return null;
  return { label: lady.name + '’s purse', amount: MISTRESS_GIFT_MULT * (lady.sl - char.sl) };
}

// ---------- A knowing friend (the Ask advice button) ----------

// Scripted counsel from the same tables the resolvers use: what bars each
// road of advancement. Reads state, rolls nothing, changes nothing.
function adviceReport(state) {
  const lines = [
    adviceOnRank(state),
    adviceOnRegiment(state),
    adviceOnTitle(state),
    adviceOnAppointment(state),
    adviceOnClub(state),
  ].filter(function (line) { return line !== null; });
  if (characterInfluence(state) === 0) {
    lines.push('And remember: influence is had two ways — stand at social level 8 yourself, or keep a mistress whose word opens doors. The grander the lady, the wider they swing.');
  }
  return lines;
}

function adviceOnRank(state) {
  const char = state.character;
  if (char.regimentId === null) return 'On rank: a gentleman without a regiment has no ladder to climb. Present yourself to a colonel.';
  if (char.rankIndex < 5) {
    const purchase = nextRankPurchase(char);
    const stableCost = Math.max(0, horsesForRank(char.rankIndex + 1, findRegiment(char.regimentId)) - char.horses) * HORSE_PRICE;
    const cost = purchase.price + stableCost;
    const wants = [];
    if (char.sl < purchase.minSL) wants.push('a gentleman of social level ' + purchase.minSL + ' (you stand at ' + char.sl + ')');
    if (char.cash < cost) wants.push(cost + ' crowns' + (stableCost > 0 ? ', horses included' : '') + ' — your purse holds ' + char.cash);
    if (wants.length === 0) return 'On rank: a ' + purchase.rank.name + '’s commission can be had for ' + cost + ' crowns. Petition for promotion and pray for a vacancy.';
    return 'On rank: a ' + purchase.rank.name + '’s commission wants ' + wants.join(', and ') + '.';
  }
  const idx = char.rankIndex - 5;
  if (idx >= GENERAL_RANKS.length) return 'On rank: there is none in France above Field Marshal.';
  const g = GENERAL_RANKS[idx];
  const wants = prefermentWants(state, g.minSL, g.inf);
  if (wants.length === 0) return 'On rank: nothing bars your gazetting as ' + g.name + '. Seek preferment at court.';
  return 'On rank: to be gazetted ' + g.name + ' wants ' + wants.join(', and ') + '.';
}

// A finer regiment at the same rank. Commissions are only sold up through
// Major (MAX_ENTRY_RANK), so above that there is no changing coats.
function adviceOnRegiment(state) {
  const char = state.character;
  if (char.regimentId === null || char.rankIndex >= 6) return null;
  if (char.rankIndex > MAX_ENTRY_RANK) {
    return 'On regiments: no regiment sells a commission above ' + RANKS[MAX_ENTRY_RANK].name + ', so there is no changing coats at your rank.';
  }
  const here = findRegiment(char.regimentId);
  const rank = RANKS[char.rankIndex];
  const hereStatus = rank.status[here.column];
  const better = REGIMENTS.filter(function (r) {
    return r.id !== here.id && rank.status[r.column] > hereStatus;
  });
  if (better.length === 0) return 'On regiments: no other coat would wear finer at your rank.';
  const open = better.filter(function (r) {
    return char.sl >= rank.minSL[r.column] && applicationRollNeeded(char, r) <= 6;
  });
  if (open.length > 0) {
    const best = open.reduce(function (a, b) { return rank.status[b.column] > rank.status[a.column] ? b : a; });
    const horses = horsesForRank(char.rankIndex, best);
    const cost = commissionPrice(char.rankIndex, best.column) + horses * HORSE_PRICE;
    let line = 'On regiments: the ' + best.name + ' might take you as a ' + rank.name + ' (+' + rank.status[best.column] + 'S against your +' + hereStatus + 'S), a fresh commission at ' + cost + ' crowns' + (horses > 0 ? ', stable included' : '') + '.';
    line += char.cash < cost ? ' Your purse holds ' + char.cash + '.' : ' Apply and pray for a place.';
    return line;
  }
  const next = better.reduce(function (a, b) { return rank.status[b.column] < rank.status[a.column] ? b : a; });
  const needSL = Math.max(rank.minSL[next.column], Math.max(1, next.firstSL));
  return 'On regiments: the next finer coat is the ' + next.name + ', whose ' + rank.name + ' wants a gentleman of social level ' + needSL + ' (you stand at ' + char.sl + ').';
}

function adviceOnTitle(state) {
  const next = titleIndex(state.character) + 1;
  if (next >= TITLES.length) return 'On title: you bear the grandest the King bestows.';
  const t = TITLES[next];
  const wants = prefermentWants(state, t.minSL, t.inf);
  if (wants.length === 0) return 'On title: the King might well make you ' + t.name + '. Seek preferment at court.';
  return 'On title: to be made ' + t.name + ' wants ' + wants.join(', and ') + '.';
}

function adviceOnAppointment(state) {
  const char = state.character;
  const held = currentAppointmentStatus(char);
  const candidates = APPOINTMENTS
    .filter(function (a) { return a.id !== char.appointmentId && a.status > held; })
    .map(function (a) { return { appt: a, wants: appointmentWants(state, a) }; });
  if (candidates.length === 0) return 'On appointments: none at court would raise you higher than you sit.';
  const ready = candidates.filter(function (c) { return c.wants.length === 0; });
  if (ready.length > 0) {
    const best = ready.reduce(function (a, b) { return b.appt.status > a.appt.status ? b : a; });
    return 'On appointments: ' + best.appt.name + ' (+' + best.appt.status + 'S) is yours to ask for. Seek preferment at court.';
  }
  const nearest = candidates.reduce(function (a, b) {
    if (b.wants.length !== a.wants.length) return b.wants.length < a.wants.length ? b : a;
    if (b.appt.inf !== a.appt.inf) return b.appt.inf < a.appt.inf ? b : a;
    return b.appt.status > a.appt.status ? b : a;
  });
  return 'On appointments: the nearest is ' + nearest.appt.name + ' (+' + nearest.appt.status + 'S), which wants ' + nearest.wants.join(', and ') + '.';
}

function appointmentWants(state, appt) {
  const char = state.character;
  const wants = [];
  if (appt.needsRegiment && char.regimentId === null) wants.push('a regiment');
  if (char.sl < appt.minSL) wants.push('social level ' + appt.minSL + ' (you stand at ' + char.sl + ')');
  if (appt.ma > 0 && char.ma < appt.ma) wants.push('military ability ' + appt.ma + ' (yours is ' + char.ma + ')');
  const rankOk = char.rankIndex >= appt.rankReq;
  const titleOk = appt.titleAlt !== null && titleIndex(char) >= appt.titleAlt;
  if (!rankOk && !titleOk) {
    let need = 'the rank of ' + rankName(appt.rankReq);
    if (appt.titleAlt !== null) need += ' (or the title of ' + TITLES[appt.titleAlt].name + ')';
    wants.push(need);
  }
  const inf = characterInfluence(state);
  if (inf < appt.inf) wants.push('influence of ' + appt.inf + ' (you have ' + inf + ')');
  return wants;
}

function prefermentWants(state, minSL, infNeeded) {
  const char = state.character;
  const wants = [];
  if (char.sl < minSL) wants.push('social level ' + minSL + ' (you stand at ' + char.sl + ')');
  const inf = characterInfluence(state);
  if (inf < infNeeded) wants.push('influence of ' + infNeeded + ' (you have ' + inf + ')');
  return wants;
}

function rankName(index) {
  return index <= 5 ? RANKS[index].name : GENERAL_RANKS[index - 6].name;
}

function adviceOnClub(state) {
  const char = state.character;
  const held = char.clubId === null ? 0 : findClub(char.clubId).status;
  const better = CLUBS.filter(function (c) {
    return c.id !== char.clubId && c.status > held && !(c.requiresHorseGuards && !isHorseGuardsOfficer(char));
  });
  if (better.length === 0) return 'On clubs: there is no finer door in Paris than the one you already pass.';
  const next = better.reduce(function (a, b) { return b.status < a.status ? b : a; });
  if (clubEligible(char, next)) return 'On clubs: ' + next.name + ' (+' + next.status + 'S, ' + next.dues + '/mo) would have you. Seek election.';
  return 'On clubs: the next step is ' + next.name + ' (+' + next.status + 'S, ' + next.dues + '/mo), which wants a gentleman of social level ' + next.minSL + ' (you stand at ' + char.sl + ').';
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
  state.pendingCampaign = true; // index.js resolves it and pops the campaign panel
  ctx.lines.push('The ' + regiment.name + ' is called to the field for the summer.');
}

// Months of the campaign season still to run, counting the current one. A June
// call-up serves all three; a July or August volunteer serves what remains.
function campaignSeasonMonths(state) {
  const last = CAMPAIGN_MONTHS[CAMPAIGN_MONTHS.length - 1];
  return Math.max(1, last - currentMonth(state) + 1);
}

function frontRegiment(char) {
  if (char.atFront.volunteer) return findRegiment('frontier');
  return findRegiment(char.regimentId);
}

// The whole summer resolves in one episode: the season's single engagement,
// pay for each month served, and whatever the rivals get up to while you are
// away. Advances the calendar past the season and returns the narrative plus
// whether the gentleman fell. char.atFront is set only for the duration so the
// away-logic (poaching, frontier regiment) still reads it.
function resolveCampaign(state, volunteer) {
  const char = state.character;
  const months = campaignSeasonMonths(state);
  char.atFront = { volunteer: volunteer };
  const regiment = frontRegiment(char);
  const ctx = newMonthContext();
  ctx.lines.push('You march to the frontier with the ' + regiment.name + ' for the season.');
  if (volunteer) {
    char.carrySP += 3;
    ctx.lines.push('Paris approves of such dash (+3 status on your return).');
  }
  let engaged = false;
  for (let m = 0; m < months; m++) {
    const mustEngage = m === months - 1 && !engaged;
    if (!engaged && (mustEngage || d6() <= 2)) {
      engaged = true;
      resolveEngagement(state, ctx);
      if (char.dead) break;
    } else {
      ctx.lines.push('Camp fever, mud, and drill; the war keeps its distance.');
    }
    const rank = rankData(char);
    if (rank !== null) char.cash += rank.pay;
    simulateRivals(state, ctx);
    state.monthIndex += 1;
    char.seniority += 1;
    // A grievous wound (resolveBattleDeath clears atFront) carts you home early.
    if (char.atFront === null) break;
  }
  char.atFront = null;
  // resolveBattleDeath already narrates a death or a wound-and-home; only the
  // unscathed survivor needs the season's closing line.
  if (!char.dead && char.woundWeeks === 0) {
    ctx.lines.push('The season closes; the regiment marches home for the winter. You have survived.');
  }
  const lines = ctx.lines.concat(ctx.gazette);
  appendGazette(state, 'The Summer Campaign of ' + currentYear(state), lines);
  return { lines: lines, died: char.dead };
}

function signed(n) {
  return (n >= 0 ? '+' : '') + n;
}

// One line of after-action arithmetic, per the rulebook: the number to beat is
// the personal-outcome value plus its modifiers, and the raw 2d6 must reach it.
// A positive modifier lifts the bar (rarer outcome), a negative one lowers it;
// a target of 2 or less is guaranteed, 13 or more impossible.
function outcomeCheck(label, roll, regMod, rankMod, base) {
  const required = base + regMod + rankMod;
  let mods = '';
  if (rankMod !== 0) mods += ' ' + signed(rankMod) + ' rank';
  if (regMod !== 0) mods += ' ' + signed(regMod) + ' regiment';
  let target = 'needs ' + required;
  if (required <= 2) target += ' (guaranteed)';
  else if (required > 12) target += ' (impossible)';
  return {
    pass: roll >= required,
    line: label + ': ' + base + mods + ' = ' + target + '; rolled 2d6 ' + roll + '. ' + (roll >= required ? 'Yes.' : 'No.'),
  };
}

function resolveEngagement(state, ctx) {
  const char = state.character;
  const regiment = frontRegiment(char);
  const mission = MISSION_TYPES[d6() - 1];
  const rawRoll = roll2d6();
  const row = Math.max(1, Math.min(10, rawRoll - 2));
  const br = BATTLE_RESULT[row - 1][char.ma - 1];
  const outcome = PERSONAL_OUTCOME[mission][br - 1];
  const rankMods = RANK_OUTCOME_MODS[Math.max(0, char.rankIndex)];
  ctx.lines.push(engagementFlavor(mission, br, regiment));
  ctx.lines.push('Battle roll: 2d6 ' + rawRoll + ' - 2 = row ' + row + '; Military Ability ' + char.ma + ' gives Battle Result ' + br + '.');

  const death = outcomeCheck('Casualty', roll2d6(), regiment.mods.death, rankMods.death, outcome.death);
  ctx.lines.push(death.line);
  if (death.pass) {
    resolveBattleDeath(state, regiment, ctx);
    if (char.dead) return;
  }

  const mention = outcomeCheck('Mention in despatches', roll2d6(), regiment.mods.mention, rankMods.mention, outcome.mention);
  ctx.lines.push(mention.line);
  if (mention.pass) {
    char.mentions += 1;
    char.carrySP += 6;
    ctx.lines.push('You are mentioned in despatches! (+6 status on your return, and Paris remembers.)');
  }

  const promo = outcomeCheck('Promotion', roll2d6(), regiment.mods.promotion, rankMods.promotion, outcome.promotion);
  ctx.lines.push(promo.line);
  if (promo.pass) resolveBattlePromotion(state, ctx);

  if (outcome.plunder === null) {
    ctx.lines.push('Plunder: none to be had from this action.');
    return;
  }
  const plunder = outcomeCheck('Plunder', roll2d6(), regiment.mods.crowns, rankMods.crowns, outcome.crowns);
  ctx.lines.push(plunder.line);
  if (plunder.pass) {
    const loot = rollDice(outcome.plunder[0], 6) * outcome.plunder[1];
    char.cash += loot;
    ctx.lines.push('Plunder! ' + outcome.plunder[0] + 'd6 x ' + outcome.plunder[1] + ' = ' + loot + ' crowns the richer.');
  }
}

function engagementFlavor(mission, br, regiment) {
  const quality = ['a famous victory', 'a hard-won success', 'a creditable action', 'a confused affair', 'a costly reverse', 'a bloody disaster'][br - 1];
  return mission + ' with the ' + regiment.name + ': ' + quality + '.';
}

function resolveBattleDeath(state, regiment, ctx) {
  const char = state.character;
  const save = d6();
  if (save <= 3) {
    killCharacter(state, 'Fell in ' + monthLabel(state) + ', serving with the ' + regiment.name + '.');
    ctx.lines.push('Struck down: d6 ' + save + ' (1-3 kills). A ball finds you in the smoke; the regiment buries you with honours.');
    return;
  }
  applyWound(char, Math.ceil(char.endCur / 2), 8);
  char.atFront = null;
  ctx.lines.push('Struck down: d6 ' + save + ' (4-6 wounds). You fall grievously wounded and are carted home to Paris to mend.');
}

function resolveBattlePromotion(state, ctx) {
  const char = state.character;
  const purchase = nextRankPurchase(char);
  if (purchase === null) {
    ctx.lines.push('A step up is earned, but there is no higher commission open for you to fill.');
    return;
  }
  if (char.sl < purchase.minSL) {
    ctx.lines.push('A step up is earned, but ' + purchase.rank.name + ' wants social level ' + purchase.minSL + ' (you stand at ' + char.sl + ').');
    return;
  }
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

// The ways a gentleman leaves Paris feet-first without a sword in his hand,
// ordered humble to grand — the higher his social level, the higher his death
// indexes into the table (with a little jitter). Each is a sentence the
// gazette appends after his name.
const NATURAL_DEATHS = [
  'is knifed in an alley off the Rue des Mauvais-Garçons for the coat on his back.',
  'perishes when a tavern quarrel he did not start turns to fire.',
  'is found floating in the Seine, his purse long gone.',
  'succumbs to the gaol-fever after a night in the watch-house.',
  'is found cold in a garret by a distraught landlady.',
  'is trampled in a crowd pressing to see a hanging.',
  'is carried off by the smallpox despite every attention.',
  'drowns when his hired boat overturns crossing to the Left Bank.',
  'is taken by a wasting sickness that had long troubled him.',
  'succumbs to a fever the physicians cannot name.',
  'is thrown by his horse on the Pont Neuf and does not recover.',
  'is bled to death by a physician for a complaint that would have passed.',
  'takes a chill at the opera and is dead within the week.',
  'is crushed when a balcony gives way beneath the press of admirers.',
  'succumbs to an apoplexy at the card table, three kings in his hand.',
  'expires of a surfeit of lampreys at the Duc’s own table.',
  'chokes upon a fish bone at a banquet, to the horror of his host.',
  'is found insensible in a bawdy-house and never wakes.',
  'breaks his neck upon the grand staircase, deep in his cups.',
  'is carried off by a fit while berating his tailor over the cut of a sleeve.',
];

function simulateRivals(state, ctx) {
  state.npcs.forEach(function (npc) {
    if (!npc.alive) return;
    simulateRivalCampaign(state, npc, ctx);
    if (!npc.alive) return;
    simulateRivalMortality(state, npc, ctx);
    if (!npc.alive) return;
    simulateRivalDrift(npc);
    simulateRivalCourtship(state, npc, ctx);
    simulateRivalPoaching(state, npc, ctx);
    simulateRivalInsult(state, npc, ctx);
  });
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

// Dead men demand no satisfaction: drop any affair whose gentleman is dead
// or struck from the list.
function clearDanglingAffairs(state) {
  state.affairs = state.affairs.filter(function (a) {
    const npc = findNpc(state, a.npcId);
    return npc !== undefined && npc.alive;
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

// Even away from the duelling ground, a gentleman may be struck down. Rare
// (0.1% a month), but Paris is a dangerous city for the mortal.
function simulateRivalMortality(state, npc, ctx) {
  if (!chance(0.001)) return;
  npc.alive = false;
  if (npc.mistressId !== null) findLady(state, npc.mistressId).lover = null;
  const last = NATURAL_DEATHS.length - 1;
  const index = Math.max(0, Math.min(last, (npc.sl - 1) + (d6() - 3)));
  ctx.gazette.push(npc.name + ' ' + NATURAL_DEATHS[index]);
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
