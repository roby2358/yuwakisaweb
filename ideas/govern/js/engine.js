// CHARTER — game engine. Pure state logic, no DOM. Deterministic given a seed.
// Browser: uses global CharterData. Node (tests): requires ./data.js.

const CharterEngine = (function () {
  const D = (typeof module !== 'undefined' && typeof require !== 'undefined')
    ? require('./data.js')
    : CharterData;

  // ------------------------------------------------------------------ rng
  function nextRand(state) {
    // mulberry32
    state.rngState = (state.rngState + 0x6D2B79F5) | 0;
    let t = state.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function randPick(state, list) {
    return list[Math.floor(nextRand(state) * list.length)];
  }

  function shuffled(state, list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand(state) * (i + 1));
      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  // ---------------------------------------------------------------- basics
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function seasonName(turn) { return D.SEASON_NAMES[(turn - 1) % 4]; }
  function yearOf(turn) { return Math.ceil(turn / 4); }
  function seasonLabel(turn) { return seasonName(turn) + ', Year ' + yearOf(turn); }

  function band(standing) {
    const E = D.ECON;
    if (standing <= E.hostileAt) return 'Hostile';
    if (standing <= E.coldAt) return 'Cold';
    if (standing < E.warmAt) return 'Neutral';
    if (standing < E.loyalAt) return 'Warm';
    return 'Loyal';
  }

  function findEdict(state, template, domain) {
    return state.edicts.find(function (e) { return e.template === template && e.domain === domain; }) || null;
  }

  function hasEdictFn(state) {
    return function (template, domain) { return findEdict(state, template, domain) !== null; };
  }

  function edictDisplayName(template, domain) {
    if (template === 'right') return 'the Right of ' + D.FACTIONS[domain].name.replace(/^The\b/, 'the');
    const T = D.TEMPLATES[template];
    if (template === 'ban') return 'the Ban on ' + D.DOMAIN_LABELS[domain];
    return 'the ' + D.DOMAIN_LABELS[domain].replace(/^the /, '') + ' ' + T.label;
  }

  function eventApi(state) {
    return {
      hasEdict: hasEdictFn(state),
      edictName: edictDisplayName,
      pressLevel: function () { return pressLevel(state); },
    };
  }

  function pressLevel(state) {
    if (findEdict(state, 'ban', 'press')) return 0;
    if (findEdict(state, 'mandate', 'press')) return 2;
    return 1;
  }

  // ------------------------------------------------------------ contentment
  // The long-run standing an edict pulls a faction toward. Single source for
  // drift, enactment shocks, repeal shocks, and the UI's drafting preview.
  function contribution(factionId, edict) {
    const F = D.FACTIONS[factionId];
    const C = D.CONTRIB;
    const liked = F.likes.indexOf(edict.domain) >= 0;
    const hated = F.hates.indexOf(edict.domain) >= 0;
    if (edict.template === 'right') return edict.domain === factionId ? C.right : 0;
    if (edict.template === 'levy') return liked ? C.levyLiked : (hated ? C.levyHated : 0);
    if (edict.template === 'subsidy') return liked ? C.subsidyLiked : (hated ? C.subsidyHated : 0);
    if (edict.template === 'mandate') return liked ? C.mandateLiked : (hated ? C.mandateHated : 0);
    // ban
    let v = liked ? C.banLiked : (hated ? C.banHated : 0);
    if (factionId === 'garrison') v += C.banGarrison;
    if (factionId === 'commons') v += C.banCommons;
    return v;
  }

  function contentment(state, factionId) {
    return state.edicts.reduce(function (sum, e) { return sum + contribution(factionId, e); }, 0);
  }

  function edictSeasonTreasury(edict) {
    const E = D.ECON;
    if (edict.template === 'levy') return E.levyIncome;
    if (edict.template === 'subsidy') return -E.subsidyUpkeep;
    if (edict.template === 'mandate') return -E.mandateUpkeep;
    return 0;
  }

  // Used by the UI before drafting: who this edict pleases/angers, and the coin.
  function previewEdict(template, domain) {
    const fake = { template: template, domain: domain };
    const standings = D.FACTION_IDS
      .map(function (f) { return { faction: f, amount: contribution(f, fake) }; })
      .filter(function (x) { return x.amount !== 0; });
    return { standings: standings, treasuryPerSeason: edictSeasonTreasury(fake) };
  }

  // ---------------------------------------------------------- contradictions
  function contradictions(state) {
    const found = [];
    D.DOMAINS.forEach(function (d) {
      if (findEdict(state, 'levy', d) && findEdict(state, 'subsidy', d)) {
        found.push({ kind: 'ledger', domain: d, label: 'The Circular Ledger: you tax ' + D.DOMAIN_LABELS[d] + ' to pay ' + D.DOMAIN_LABELS[d] + '.' });
      }
      if (findEdict(state, 'ban', d) && findEdict(state, 'mandate', d)) {
        found.push({ kind: 'statute', domain: d, label: 'The Impossible Statute: ' + D.DOMAIN_LABELS[d] + ' is both required and forbidden.' });
      }
    });
    return found;
  }

  // -------------------------------------------------------------------- log
  function addLog(state, entry) {
    entry.id = state.logSerial;
    state.logSerial += 1;
    entry.turn = state.turn;
    entry.seasonLabel = seasonLabel(state.turn);
    state.log.push(entry);
  }

  function effectsSummary(effects) {
    return effects.map(function (fx) {
      if (fx.standing !== undefined) return D.FACTIONS[fx.standing].name + ' ' + signed(fx.amount);
      if (fx.treasury !== undefined) return 'Treasury ' + signed(fx.treasury);
      return 'Legitimacy ' + signed(fx.legitimacy);
    }).join(', ');
  }

  function signed(n) { return (n >= 0 ? '+' : '') + n; }

  function applyEffects(state, effects) {
    effects.forEach(function (fx) {
      if (fx.standing !== undefined) {
        state.factions[fx.standing].standing = clamp(state.factions[fx.standing].standing + fx.amount, -100, 100);
        return;
      }
      if (fx.treasury !== undefined) { state.treasury += fx.treasury; return; }
      state.legitimacy = clamp(state.legitimacy + fx.legitimacy, 0, 100);
    });
  }

  function logEvent(state, kind, title, body, effects) {
    applyEffects(state, effects);
    addLog(state, { kind: kind, title: title, body: body, effectsSummary: effectsSummary(effects) });
    checkDeposed(state);
  }

  function checkDeposed(state) {
    if (state.phase !== 'playing') return;
    if (state.legitimacy > 0) return;
    state.phase = 'lost';
    state.endReason = 'deposed';
    addLog(state, {
      kind: 'crisis', title: 'Deposed',
      body: 'The city has withdrawn its consent. The council of wards, the Temple, and a locksmith of no previous political convictions have together changed the palace locks. The Regency of ' + seasonLabel(state.turn) + ' is over.',
      effectsSummary: '',
    });
  }

  // ---------------------------------------------------------------- newGame
  function newGame(seed) {
    const E = D.ECON;
    const state = {
      phase: 'playing', endReason: null,
      turn: 0, ap: 0,
      treasury: E.startTreasury, legitimacy: E.startLegitimacy,
      factions: {},
      edicts: [], edictSerial: 1,
      petitions: [], petitionSerial: 1, petitionDeck: [],
      disputes: [], disputeSerial: 1,
      precedents: {},
      festivalCooldown: 0,
      charter: { ratified: false },
      upcoming: [],
      stats: {
        edictsPassed: 0, repeals: 0, overrules: 0, upholds: 0, amendments: 0,
        petitionsGranted: 0, petitionsRefused: 0, petitionsFestered: 0, festivalsHeld: 0,
      },
      log: [], logSerial: 1,
      rngState: seed | 0,
      score: null, epithet: null,
    };
    D.FACTION_IDS.forEach(function (f) {
      state.factions[f] = { standing: 0, hostileStreak: 0, endorsed: false };
    });
    state.petitionDeck = shuffled(state, D.PETITIONS.map(function (p) { return p.id; }));

    addLog(state, {
      kind: 'system', title: 'The Regency Begins',
      body: 'The old Duke is dead; the heir is six years from her majority; and you, by a compromise nobody loves equally, are Regent of Lexden. You govern by writing. Everything you write will be read — carefully, literally, and against you. Leave the city a Charter before the Regency ends.',
      effectsSummary: '',
    });
    beginSeason(state);
    return state;
  }

  // ------------------------------------------------------------ season flow
  function beginSeason(state) {
    state.turn += 1;
    state.ap = D.ECON.apPerSeason;
    if (state.festivalCooldown > 0) state.festivalCooldown -= 1;

    addLog(state, { kind: 'season', title: seasonLabel(state.turn), body: '', effectsSummary: '' });

    runAccounts(state);
    if (state.phase !== 'playing') return;
    runContradictionLeaks(state);
    if (state.phase !== 'playing') return;
    runDrift(state);
    runUpcomingEvents(state);
    if (state.phase !== 'playing') return;
    runInterpretationProbe(state);
    if (state.phase !== 'playing') return;
    runRumor(state);
    if (state.phase !== 'playing') return;
    spawnPetitions(state);
    rollUpcoming(state);
  }

  function runAccounts(state) {
    const E = D.ECON;
    const lines = [{ label: 'base income', amount: E.baseIncome }];
    state.edicts.forEach(function (e) {
      const amount = edictSeasonTreasury(e);
      if (amount !== 0) lines.push({ label: edictDisplayName(e.template, e.domain), amount: amount });
    });
    lines.push({ label: 'garrison pay', amount: -E.garrisonPay });
    const total = lines.reduce(function (s, l) { return s + l.amount; }, 0);
    state.treasury += total;
    const detail = lines.map(function (l) { return l.label + ' ' + signed(l.amount); }).join('; ');
    addLog(state, {
      kind: 'accounts', title: 'The Season\'s Accounts',
      body: detail + '.', effectsSummary: 'Treasury ' + signed(total) + ' → ' + state.treasury,
    });
    if (state.treasury >= 0) return;
    logEvent(state, 'crisis', 'Insolvency',
      'The treasury is empty and the moneylenders of Coldharbour Row know it to the shilling. A loan is taken at terms best described as memorable. The Garrison, paid late, counts the days aloud.',
      [D.fx.tr(D.ECON.loanAmount), D.fx.lg(-4), D.fx.st('garrison', -3)]);
  }

  function runContradictionLeaks(state) {
    contradictions(state).forEach(function (c) {
      if (c.kind === 'ledger') {
        logEvent(state, 'contradiction', 'The Circular Ledger',
          'The clerks collect the levy on ' + D.DOMAIN_LABELS[c.domain] + ' and pay it back out as the subsidy on ' + D.DOMAIN_LABELS[c.domain] + ', less handling, wages, ink, and a margin for error that is all margin. The law book is eating money.',
          [D.fx.tr(-D.ECON.contradictionLedgerLeak)]);
        return;
      }
      logEvent(state, 'contradiction', 'The Impossible Statute',
        D.DOMAIN_LABELS[c.domain].charAt(0).toUpperCase() + D.DOMAIN_LABELS[c.domain].slice(1) + ' is at present both mandatory and forbidden. Citizens are complying and offending simultaneously, and the courts have begun citing the Regent\'s law book as grounds for doubting the Regent.',
        [D.fx.lg(-D.ECON.contradictionStatuteLeak)]);
    });
  }

  function runDrift(state) {
    D.FACTION_IDS.forEach(function (f) {
      const target = contentment(state, f);
      const gap = target - state.factions[f].standing;
      if (gap === 0) return;
      let step = clamp(Math.round(gap * 0.25), -5, 5);
      if (step === 0) step = gap > 0 ? 1 : -1;
      state.factions[f].standing = clamp(state.factions[f].standing + step, -100, 100);
    });
  }

  function resolveEventDef(state, def) {
    const banned = findEdict(state, 'ban', def.domain) !== null;
    if (banned && def.suppressed) {
      const s = def.suppressed;
      logEvent(state, 'event', s.title,
        s.body + ' [' + edictDisplayName('ban', def.domain) + ']', s.effects);
      return;
    }
    const result = def.run(eventApi(state));
    logEvent(state, 'event', result.title, result.body, result.effects);
  }

  function runUpcomingEvents(state) {
    const queue = state.upcoming;
    state.upcoming = [];
    for (let i = 0; i < queue.length; i++) {
      if (state.phase !== 'playing') return;
      resolveEventDef(state, lookupEventDef(queue[i]));
    }
  }

  function lookupEventDef(ref) {
    if (ref.kind === 'seasonal') {
      const pool = D.SEASONALS[ref.season];
      return pool.find(function (e) { return e.id === ref.id; });
    }
    return D.INCIDENTS.find(function (e) { return e.id === ref.id; });
  }

  function rollUpcoming(state) {
    if (state.turn >= D.ECON.maxTurns) { state.upcoming = []; return; }
    const nextSeason = seasonName(state.turn + 1);
    const refs = [];
    const seasonal = randPick(state, D.SEASONALS[nextSeason]);
    refs.push({ kind: 'seasonal', season: nextSeason, id: seasonal.id, revealed: false });
    if (nextRand(state) < 0.4) {
      const incident = randPick(state, D.INCIDENTS);
      refs.push({ kind: 'incident', season: nextSeason, id: incident.id, revealed: false });
    }
    const level = pressLevel(state);
    for (let i = 0; i < refs.length && i < level; i++) refs[i].revealed = true;
    state.upcoming = refs;
  }

  function runInterpretationProbe(state) {
    if (state.edicts.length === 0) return;
    const E = D.ECON;
    const p = Math.min(E.probePerEdict * state.edicts.length, E.probeCap);
    if (nextRand(state) >= p) return;
    const weights = state.edicts.map(function (e) { return e.amended ? 0.5 : 1; });
    const edict = weightedPick(state, state.edicts, weights);
    if (state.disputes.some(function (d) { return d.edictId === edict.id; })) return;
    const scenario = D.interpretationFor(edict.template, edict.domain);
    const uid = state.disputeSerial;
    state.disputeSerial += 1;
    state.disputes.push({ uid: uid, edictId: edict.id });
    addLog(state, {
      kind: 'dispute', title: 'The Letter of the Law: ' + scenario.title,
      body: scenario.body(edictDisplayName(edict.template, edict.domain), D.DOMAIN_LABELS[edict.domain]) +
        ' The court will let the ruling stand at season\'s end unless you convene it.',
      effectsSummary: '', disputeUid: uid,
    });
  }

  function weightedPick(state, items, weights) {
    const total = weights.reduce(function (s, w) { return s + w; }, 0);
    let roll = nextRand(state) * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function runRumor(state) {
    if (pressLevel(state) !== 0) return;
    if (nextRand(state) >= 0.4) return;
    const rumors = [
      'It is said in the taverns that the Regent dines on swan while the granaries stand padlocked. There is no gazette to say otherwise, so it is said louder.',
      'A rumor runs that the heir has been sent away — or worse. It is nonsense, but printed nonsense could be answered, and nothing can be printed.',
      'The story this month is that the treasury is empty and the Chancellor has fled by night. He has not. He has, however, been seen carrying a large bag, which in the absence of a press is all the evidence anyone requires.',
    ];
    logEvent(state, 'event', 'The Rumor', randPick(state, rumors) + ' [the Ban on the Press]', [D.fx.lg(-3)]);
  }

  function spawnPetitions(state) {
    const count = 1 + (nextRand(state) < 0.5 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const def = drawPetition(state);
      if (!def) return;
      const cites = Boolean(def.cites && state.precedents[def.cites]);
      const uid = state.petitionSerial;
      state.petitionSerial += 1;
      state.petitions.push({ uid: uid, defId: def.id, age: 0, cites: cites });
      addLog(state, {
        kind: 'petition', title: 'Petition: ' + def.title,
        body: def.body + (cites ? def.citeText : ''),
        effectsSummary: '', petitionUid: uid,
      });
    }
  }

  function drawPetition(state) {
    if (state.petitionDeck.length === 0) {
      state.petitionDeck = shuffled(state, D.PETITIONS.map(function (p) { return p.id; }));
    }
    const open = state.petitions.map(function (p) { return p.defId; });
    for (let i = 0; i < state.petitionDeck.length; i++) {
      const def = D.PETITIONS.find(function (p) { return p.id === state.petitionDeck[i]; });
      if (open.indexOf(def.id) >= 0) continue;
      if (def.when && !def.when(hasEdictFn(state), state.precedents)) continue;
      state.petitionDeck.splice(i, 1);
      return def;
    }
    return null;
  }

  // -------------------------------------------------------- petition helpers
  function petitionDef(petition) {
    return D.PETITIONS.find(function (p) { return p.id === petition.defId; });
  }

  // Refusing in the face of a cited precedent costs double (the negatives).
  function optionEffects(petition, option) {
    if (!(petition.cites && option.refusal)) return option.effects;
    return option.effects.map(function (fx) {
      if (fx.standing !== undefined && fx.amount < 0) return D.fx.st(fx.standing, fx.amount * 2);
      if (fx.legitimacy !== undefined && fx.legitimacy < 0) return D.fx.lg(fx.legitimacy * 2);
      return fx;
    });
  }

  function resolvePetition(state, petition, optionIndex, festered) {
    const def = petitionDef(petition);
    const option = def.options[optionIndex];
    let effects = optionEffects(petition, option);
    let suffix = '';
    if (festered) {
      effects = effects.map(function (fx) {
        if (fx.standing !== undefined) return D.fx.st(fx.standing, Math.round(fx.amount * 1.25));
        return fx;
      }).concat([D.fx.lg(-2)]);
      suffix = ' Left to fester two seasons, it resolved itself in the worst available way, and the chronicle records that you were elsewhere.';
      state.stats.petitionsFestered += 1;
    } else if (option.refusal) {
      state.stats.petitionsRefused += 1;
    } else {
      state.stats.petitionsGranted += 1;
    }
    if (!festered && option.sets) state.precedents[option.sets] = state.turn;
    state.petitions = state.petitions.filter(function (p) { return p.uid !== petition.uid; });
    const cited = petition.cites && option.refusal && !festered ? ' The refusal, against cited precedent, lands twice as hard.' : '';
    logEvent(state, 'resolution', def.title + ' — ' + (festered ? 'Festered' : option.label),
      (festered ? '' : '"' + option.label + '."') + cited + suffix +
      (option.sets && !festered ? ' A precedent is set; the city will remember it was set.' : ''),
      effects);
  }

  // --------------------------------------------------------- dispute helpers
  function disputeScenario(state, dispute) {
    const edict = state.edicts.find(function (e) { return e.id === dispute.edictId; });
    return { edict: edict, scenario: D.interpretationFor(edict.template, edict.domain) };
  }

  function closeDispute(state, dispute) {
    state.disputes = state.disputes.filter(function (d) { return d.uid !== dispute.uid; });
  }

  function autoUpholdDisputes(state) {
    state.disputes.slice().forEach(function (dispute) {
      const ds = disputeScenario(state, dispute);
      closeDispute(state, dispute);
      logEvent(state, 'ruling', ds.scenario.title + ' — The Ruling Stands',
        'You did not convene the court; the literal reading of ' + edictDisplayName(ds.edict.template, ds.edict.domain) + ' is now precedent. The law said what it said, and nobody said otherwise.',
        ds.scenario.uphold);
    });
  }

  // --------------------------------------------------------------- endSeason
  function finishSeason(state) {
    autoUpholdDisputes(state);
    if (state.phase !== 'playing') return;

    state.petitions.slice().forEach(function (p) {
      p.age += 1;
      if (p.age >= 2) resolvePetition(state, p, petitionDef(p).autoIndex, true);
    });
    if (state.phase !== 'playing') return;

    checkEndorsements(state);
    runHostileStreaks(state);
    if (state.phase !== 'playing') return;

    if (state.turn >= D.ECON.maxTurns) { concludeRegency(state); return; }
    beginSeason(state);
  }

  function checkEndorsements(state) {
    D.FACTION_IDS.forEach(function (f) {
      if (!state.factions[f].endorsed) return;
      const priceOk = D.PRICES[f].check(hasEdictFn(state));
      const warmOk = state.factions[f].standing >= D.ECON.warmAt;
      if (priceOk && warmOk) return;
      state.factions[f].endorsed = false;
      logEvent(state, 'charter', 'Endorsement Withdrawn: ' + D.FACTIONS[f].name,
        (priceOk ? 'Their goodwill has cooled below the point of signature.' : 'Their price — "' + D.PRICES[f].text + '" — is no longer honored by the law book.') +
        ' Their seal is scraped from the draft Charter.',
        [D.fx.lg(-3)]);
    });
  }

  function runHostileStreaks(state) {
    D.FACTION_IDS.forEach(function (f) {
      if (state.phase !== 'playing') return;
      const fs = state.factions[f];
      if (fs.standing > D.ECON.hostileAt) { fs.hostileStreak = 0; return; }
      fs.hostileStreak += 1;
      if (fs.hostileStreak < 3) {
        addLog(state, {
          kind: 'crisis', title: D.FACTIONS[f].name + ' Seethe',
          body: fs.hostileStreak === 1
            ? D.FACTIONS[f].name + ' have moved from grievance to organization. Meetings are being held. You are the agenda.'
            : D.FACTIONS[f].name + ' are one season from open crisis. Their patience is now a formality.',
          effectsSummary: '',
        });
        return;
      }
      fs.hostileStreak = 0;
      triggerCrisis(state, f);
    });
  }

  function triggerCrisis(state, factionId) {
    const crisis = D.CRISES[factionId];
    if (factionId !== 'garrison') {
      state.factions[factionId].standing = -35; // vented, not soothed
      logEvent(state, 'crisis', crisis.title, crisis.body, crisis.effects);
      return;
    }
    if (state.legitimacy >= 60) {
      state.factions.garrison.standing = -20;
      logEvent(state, 'crisis', 'The Coup That Wasn\'t',
        crisis.body + ' But the wards barred their streets, the Guilds shut the bridges, and by noon the Marshal was explaining that it had been an exercise. Your legitimacy held the city; it spent itself doing so.',
        [D.fx.lg(-20)]);
      return;
    }
    state.phase = 'lost';
    state.endReason = 'coup';
    addLog(state, {
      kind: 'crisis', title: 'The Coup',
      body: crisis.body + ' By noon it was answered. The city, asked to choose between an unpaid soldiery and an unloved Regent, chose neither loudly — and you quietly. The Regency ends at sword-point, politely held.',
      effectsSummary: '',
    });
  }

  function endorsedCount(state) {
    return D.FACTION_IDS.filter(function (f) { return state.factions[f].endorsed; }).length;
  }

  function concludeRegency(state) {
    const avg = Math.round(D.FACTION_IDS.reduce(function (s, f) { return s + state.factions[f].standing; }, 0) / 4);
    state.score = state.legitimacy + avg + Math.floor(state.treasury / 2) +
      endorsedCount(state) * 20 - contradictions(state).length * 15;
    state.phase = 'lost';
    state.endReason = 'expired';
    state.epithet = pickEpithet(state);
    addLog(state, {
      kind: 'system', title: 'The Regency Ends',
      body: 'The heir comes of age at midwinter, and you hand her a city — solvent or not, settled or not — without a Charter. The chronicle closes on a question the next reign must answer. History styles you Regent ' + state.epithet.title + ', ' + state.epithet.line + ' Final reckoning: ' + state.score + '.',
      effectsSummary: '',
    });
  }

  function pickEpithet(state) {
    let best = D.EPITHETS[0];
    let bestVal = -1;
    D.EPITHETS.forEach(function (e) {
      if (state.stats[e.stat] > bestVal) { best = e; bestVal = state.stats[e.stat]; }
    });
    return best;
  }

  // ------------------------------------------------------------------ actions
  const ACTIONS = {
    endSeason: {
      ap: 0,
      run: function (state) { finishSeason(state); return ok(); },
    },
    respond: {
      ap: 1,
      run: function (state, action) {
        const petition = state.petitions.find(function (p) { return p.uid === action.uid; });
        if (!petition) return fail('No such petition awaits.');
        const def = petitionDef(petition);
        if (!def.options[action.optionIndex]) return fail('No such option.');
        resolvePetition(state, petition, action.optionIndex, false);
        return ok();
      },
    },
    audience: {
      ap: 1,
      run: function (state, action) {
        const f = action.faction;
        if (!D.FACTIONS[f]) return fail('No such faction.');
        const fs = state.factions[f];
        const target = contentment(state, f);
        const trend = target > fs.standing ? 'warming' : (target < fs.standing ? 'cooling' : 'settled');
        let revealText = ' No further word reaches you of the season to come.';
        const hidden = state.upcoming.find(function (u) { return !u.revealed; });
        if (hidden) {
          hidden.revealed = true;
          revealText = ' In passing, their people let slip what is coming: ' + lookupEventDef(hidden).portent + '';
        }
        addLog(state, {
          kind: 'audience', title: 'Audience: ' + D.FACTIONS[f].name,
          body: 'Behind the courtesies, their true temper stands at ' + fs.standing + ' (' + band(fs.standing) + '), and the law book as written is ' + trend + ' toward ' + target + '.' + revealText,
          effectsSummary: '',
        });
        return ok();
      },
    },
    court: {
      ap: 1,
      run: function (state, action) {
        const dispute = state.disputes.find(function (d) { return d.uid === action.uid; });
        if (!dispute) return fail('No such dispute is before the court.');
        if (action.ruling !== 'uphold' && action.ruling !== 'overrule') return fail('The court knows only uphold and overrule.');
        const ds = disputeScenario(state, dispute);
        const name = edictDisplayName(ds.edict.template, ds.edict.domain);
        closeDispute(state, dispute);
        if (action.ruling === 'uphold') {
          state.stats.upholds += 1;
          logEvent(state, 'ruling', ds.scenario.title + ' — Upheld',
            'You convene the court and let ' + name + ' mean exactly what it says. The outcome is absurd; the principle is sound; the city notes that in Lexden, the law is the law even when it is ridiculous.',
            ds.scenario.uphold.concat([D.fx.lg(2)]));
          return ok();
        }
        state.stats.overrules += 1;
        logEvent(state, 'ruling', ds.scenario.title + ' — Overruled',
          'You convene the court and set the literal reading aside. Sense prevails; the statute book does not. It is quietly understood that the law in Lexden means whatever the Regent last needed it to mean.',
          ds.scenario.overrule.concat([D.fx.lg(-4)]));
        return ok();
      },
    },
    amend: {
      ap: 2,
      run: function (state, action) {
        const edict = state.edicts.find(function (e) { return e.id === action.edictId; });
        if (!edict) return fail('No such edict stands.');
        if (edict.amended) return fail('That edict is already amended.');
        edict.amended = true;
        state.stats.amendments += 1;
        const dispute = state.disputes.find(function (d) { return d.edictId === edict.id; });
        let effects = [];
        let disputeText = '';
        if (dispute) {
          const ds = disputeScenario(state, dispute);
          closeDispute(state, dispute);
          effects = ds.scenario.amend;
          disputeText = ' The pending dispute dissolves — the new wording simply excludes it.';
        }
        logEvent(state, 'edict', 'Amended: ' + edictDisplayName(edict.template, edict.domain),
          'You redraft the text with the failure in hand: definitions tightened, impediments listed, the obvious reading made the only reading.' + disputeText + ' Future clerks will find less room to be inventive.',
          effects);
        return ok();
      },
    },
    repeal: {
      ap: 1,
      run: function (state, action) {
        const idx = state.edicts.findIndex(function (e) { return e.id === action.edictId; });
        if (idx < 0) return fail('No such edict stands.');
        const edict = state.edicts[idx];
        state.edicts.splice(idx, 1);
        state.stats.repeals += 1;
        state.disputes.slice().forEach(function (d) {
          if (d.edictId === edict.id) closeDispute(state, d);
        });
        const effects = [];
        D.FACTION_IDS.forEach(function (f) {
          const c = contribution(f, edict);
          if (c > 0) effects.push(D.fx.st(f, -Math.round(c / 2) - 4)); // taken away hurts extra
          if (c < 0) effects.push(D.fx.st(f, Math.round(-c / 2)));
        });
        logEvent(state, 'edict', 'Repealed: ' + edictDisplayName(edict.template, edict.domain),
          'The edict is struck from the book. Those it burdened exhale; those it benefited had planned around it, and a granted thing withdrawn is remembered longer than a thing never granted.',
          effects);
        return ok();
      },
    },
    draft: {
      ap: 2,
      run: function (state, action) {
        const template = action.template;
        const domain = action.domain;
        if (!D.TEMPLATES[template]) return fail('No such template of law.');
        const domainOk = template === 'right' ? Boolean(D.FACTIONS[domain]) : D.DOMAINS.indexOf(domain) >= 0;
        if (!domainOk) return fail('No such domain.');
        if (findEdict(state, template, domain)) return fail('That edict already stands.');
        const edict = { id: state.edictSerial, template: template, domain: domain, amended: false, turnEnacted: state.turn };
        state.edictSerial += 1;
        state.edicts.push(edict);
        state.stats.edictsPassed += 1;
        const effects = [];
        D.FACTION_IDS.forEach(function (f) {
          const c = contribution(f, edict);
          if (c !== 0) effects.push(D.fx.st(f, Math.round(c / 2)));
        });
        let rightNote = '';
        if (template === 'levy') {
          D.FACTION_IDS.forEach(function (f) {
            if (!findEdict(state, 'right', f)) return;
            if (D.FACTIONS[f].likes.indexOf(domain) < 0) return;
            effects.push(D.fx.lg(-5));
            rightNote = ' The levy trespasses on ' + edictDisplayName('right', f) + ', and the city sees a promise bent.';
          });
        }
        logEvent(state, 'edict', 'Enacted: ' + edictDisplayName(template, domain),
          'The edict is read from the balcony, posted at the gates, and entered in the book' +
          (state.edicts.length >= 5 ? ' — a book now thick enough that its pages have begun to disagree with one another.' : '.') + rightNote,
          effects);
        return ok();
      },
    },
    festival: {
      ap: 2,
      run: function (state) {
        const E = D.ECON;
        const stale = state.festivalCooldown > 0;
        const effects = stale
          ? [D.fx.tr(-E.festivalCost), D.fx.st('commons', 4), D.fx.st('temple', 2), D.fx.st('guilds', 2), D.fx.lg(1)]
          : [D.fx.tr(-E.festivalCost), D.fx.st('commons', 8), D.fx.st('temple', 8), D.fx.st('guilds', 4), D.fx.lg(3)];
        state.festivalCooldown = E.festivalCooldown;
        state.stats.festivalsHeld += 1;
        logEvent(state, 'event', stale ? 'Another Festival' : 'A Festival Proclaimed',
          stale
            ? 'Another festival, so soon after the last. The city attends, eats, and is not fooled; the Temple murmurs that joy by decree, twice a year, is closer to policy than piety.'
            : 'A festival by proclamation: ovens fired at the city\'s expense, the fountain briefly running with wine (small wine). For one day the city agrees to be pleased with itself, and by extension, faintly, with you.',
          effects);
        return ok();
      },
    },
    endorse: {
      ap: 2,
      run: function (state, action) {
        const f = action.faction;
        if (!D.FACTIONS[f]) return fail('No such faction.');
        const fs = state.factions[f];
        if (fs.endorsed) return fail('Their seal is already on the Charter.');
        if (fs.standing < D.ECON.warmAt) return fail(D.FACTIONS[f].name + ' are not warm enough to court.');
        if (!D.PRICES[f].check(hasEdictFn(state))) return fail('Their price is not met: ' + D.PRICES[f].text);
        fs.endorsed = true;
        const effects = [D.fx.st(f, 5), D.fx.lg(5)];
        D.FACTION_IDS.forEach(function (other) {
          if (other !== f && !state.factions[other].endorsed) effects.push(D.fx.st(other, -5));
        });
        logEvent(state, 'charter', 'Endorsed: ' + D.FACTIONS[f].name,
          'Their seal goes onto the draft Charter, their price — "' + D.PRICES[f].text + '" — written into its margins. The factions still outside the settlement read the list of signatures and begin, quietly, to organize against their own absence.',
          effects);
        return ok();
      },
    },
    ratify: {
      ap: 2,
      run: function (state) {
        const E = D.ECON;
        if (endorsedCount(state) < E.endorseNeed) return fail('The Charter needs ' + E.endorseNeed + ' seals; it has ' + endorsedCount(state) + '.');
        if (state.legitimacy < E.ratifyLegitimacy) return fail('The city must believe in the hand that signs: legitimacy ' + E.ratifyLegitimacy + ' is required.');
        if (contradictions(state).length > 0) return fail('The Charter cannot ratify a law book that disagrees with itself.');
        state.phase = 'won';
        state.endReason = 'ratified';
        state.charter.ratified = true;
        state.epithet = { title: 'the Lawgiver', line: 'who wrote a city into agreement with itself.' };
        const avg = Math.round(D.FACTION_IDS.reduce(function (s, f) { return s + state.factions[f].standing; }, 0) / 4);
        state.score = state.legitimacy + avg + Math.floor(state.treasury / 2) + endorsedCount(state) * 20 + 50;
        addLog(state, {
          kind: 'charter', title: 'THE GRAND CHARTER IS RATIFIED',
          body: 'In the ' + seasonLabel(state.turn) + ' of the Regency, the Charter of Lexden is read from the balcony and sealed by the estates of the city. It is not perfect. It is agreed to — which is rarer. The heir will take a governed city, and history styles you Regent the Lawgiver, who wrote a city into agreement with itself. Final reckoning: ' + state.score + '.',
          effectsSummary: '',
        });
        return ok();
      },
    },
  };

  function ok() { return { ok: true, msg: '' }; }
  function fail(msg) { return { ok: false, msg: msg }; }

  function act(state, action) {
    if (state.phase !== 'playing') return fail('The Regency is over.');
    const def = ACTIONS[action.type];
    if (!def) return fail('Unknown action.');
    if (state.ap < def.ap) return fail('Not enough action points (' + def.ap + ' needed).');
    state.ap -= def.ap;
    const result = def.run(state, action);
    if (!result.ok) state.ap += def.ap; // a refused action costs nothing
    return result;
  }

  function actionCost(type) { return ACTIONS[type].ap; }

  function priceMet(state, factionId) {
    return D.PRICES[factionId].check(hasEdictFn(state));
  }

  // ------------------------------------------------------------------ export
  return {
    newGame: newGame,
    act: act,
    actionCost: actionCost,
    band: band,
    contentment: contentment,
    contradictions: contradictions,
    pressLevel: pressLevel,
    previewEdict: previewEdict,
    edictDisplayName: edictDisplayName,
    seasonLabel: seasonLabel,
    endorsedCount: endorsedCount,
    petitionDef: petitionDef,
    disputeScenario: disputeScenario,
    optionEffects: optionEffects,
    effectsSummary: effectsSummary,
    priceMet: priceMet,
    lookupEventDef: lookupEventDef,
  };
})();

if (typeof module !== 'undefined') module.exports = CharterEngine;
