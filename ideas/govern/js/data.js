// CHARTER — game content: factions, edict templates, events, petitions,
// interpretation scenarios, endorsement prices. All content is data consumed
// by one code path per kind (see engine.js). No bespoke logic per item.

const CharterData = (function () {

  const DOMAINS = ['trade', 'grain', 'river', 'faith', 'arms', 'festival', 'press', 'ale'];

  const DOMAIN_LABELS = {
    trade: 'Trade', grain: 'Grain', river: 'the River', faith: 'the Faith',
    arms: 'Arms', festival: 'the Festivals', press: 'the Press', ale: 'Ale',
  };

  const FACTIONS = {
    guilds: { name: 'The Guilds', likes: ['trade', 'river'], hates: [] },
    temple: { name: 'The Temple', likes: ['faith', 'festival'], hates: ['ale', 'press'] },
    commons: { name: 'The Commons', likes: ['grain', 'ale', 'festival', 'press'], hates: [] },
    garrison: { name: 'The Garrison', likes: ['arms'], hates: [] },
  };
  const FACTION_IDS = ['guilds', 'temple', 'commons', 'garrison'];

  const TEMPLATES = {
    levy: { label: 'Levy', article: 'the', verb: 'taxes' },
    subsidy: { label: 'Subsidy', article: 'the', verb: 'funds' },
    ban: { label: 'Ban', article: 'the', verb: 'prohibits' },
    mandate: { label: 'Mandate', article: 'the', verb: 'requires' },
    right: { label: 'Right', article: 'the', verb: 'enshrines' },
  };

  // Contribution of one edict to one faction's long-run contentment.
  const CONTRIB = {
    levyLiked: -10, levyHated: 4,
    subsidyLiked: 8, subsidyHated: -4,
    banLiked: -10, banHated: 8, banGarrison: 3, banCommons: -4,
    mandateLiked: 10, mandateHated: -8,
    right: 15,
  };

  const ECON = {
    baseIncome: 8, garrisonPay: 10,
    levyIncome: 6, subsidyUpkeep: 4, mandateUpkeep: 3,
    apPerSeason: 3, maxTurns: 24,
    startTreasury: 60, startLegitimacy: 60,
    probePerEdict: 0.08, probeCap: 0.5,
    festivalCost: 10, festivalCooldown: 4,
    loanAmount: 15,
    contradictionLedgerLeak: 4, contradictionStatuteLeak: 2,
    endorseNeed: 3, ratifyLegitimacy: 50,
    hostileAt: -50, warmAt: 15, loyalAt: 50, coldAt: -15,
  };

  const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

  // ---------------------------------------------------------------- effects
  // Effects are primitive ops applied by one applier in the engine:
  //   { standing: factionId, amount }  |  { treasury: amount }  |  { legitimacy: amount }
  function st(faction, amount) { return { standing: faction, amount: amount }; }
  function tr(amount) { return { treasury: amount }; }
  function lg(amount) { return { legitimacy: amount }; }

  // ------------------------------------------------------- seasonal events
  // Each: { id, domain, portent, run(api) -> {title, body, effects}, suppressed }
  // `suppressed` is used instead of `run` when the event's domain is banned
  // (bans block human affairs, never weather — those have suppressed: null).
  // api: { hasEdict(t,d), edictName(t,d), pressLevel() }
  const SEASONALS = {
    Spring: [
      {
        id: 'flood', domain: 'river', suppressed: null,
        portent: 'The upland snows are heavy; the boatmen eye the wharf-marks.',
        run: function (api) {
          if (api.hasEdict('subsidy', 'river')) {
            return {
              title: 'The Spring Flood', effects: [st('commons', 2), st('guilds', 2)],
              body: 'The river rose to the wharf-tops — and stopped. The dredging crews funded under ' + api.edictName('subsidy', 'river') + ' had cleared the channels all winter. The Low Quarter stayed dry, and everyone knows why.',
            };
          }
          if (api.hasEdict('levy', 'river')) {
            return {
              title: 'The Spring Flood', effects: [tr(-4), st('commons', -5), st('guilds', -3)],
              body: 'The river took the Low Quarter. The dredgers, idle since ' + api.edictName('levy', 'river') + ' priced the boatmen off the water, watched from the bank. The Commons watched the dredgers.',
            };
          }
          return {
            title: 'The Spring Flood', effects: [tr(-4), st('commons', -2)],
            body: 'The river rose with the thaw and took a row of cellars in the Low Quarter. The usual spring misery; the usual spring bill.',
          };
        },
      },
      {
        id: 'muster', domain: 'arms', suppressed: null,
        portent: 'The Marshal is chalking names on the armoury door: a muster is coming.',
        run: function (api) {
          if (api.hasEdict('subsidy', 'arms') || api.hasEdict('mandate', 'arms')) {
            return {
              title: 'The Spring Muster', effects: [st('garrison', 4), lg(1)],
              body: 'The Garrison mustered on the field in good boots and better temper — the arms funding has been felt. The Marshal saluted the balcony. He has not done that in years.',
            };
          }
          return {
            title: 'The Spring Muster', effects: [st('garrison', -3), tr(-2)],
            body: 'The Garrison mustered in patched boots and made sure the whole city saw them do it. The quartermaster sent the mending bill to the palace, itemized, with commentary.',
          };
        },
      },
    ],
    Summer: [
      {
        id: 'fair', domain: 'festival',
        portent: 'Stalls are going up in the Low Market — the summer fair is being readied.',
        suppressed: {
          title: 'The Silent Fairground', effects: [st('guilds', -4), st('commons', -3)],
          body: 'Midsummer came and the Low Market stood empty: the fair is, by the letter of the ban, a festival. The Guilds counted the sales that never happened. The Commons just stood there, in the sun, with nothing.',
        },
        run: function (api) {
          if (api.hasEdict('levy', 'trade')) {
            return {
              title: 'The Summer Fair', effects: [tr(8), st('guilds', -3), st('commons', 2)],
              body: 'The fair filled the Low Market and the assessors filled their ledgers — ' + api.edictName('levy', 'trade') + ' bit every stall. The take was handsome. The Guilds\' smiles were not.',
            };
          }
          return {
            title: 'The Summer Fair', effects: [tr(5), st('guilds', 3), st('commons', 2)],
            body: 'The summer fair filled the Low Market with wool, tin, foreign apples, and money. A good fair, and the city warmer for it.',
          };
        },
      },
      {
        id: 'lowwater', domain: 'river', suppressed: null,
        portent: 'The river runs thin; barge-masters are already cursing the shallows.',
        run: function (api) {
          if (api.hasEdict('subsidy', 'river')) {
            return {
              title: 'The Low Water', effects: [st('guilds', 3)],
              body: 'The river shrank to a channel — but a dredged channel. Barges passed all summer, single file, thanks to ' + api.edictName('subsidy', 'river') + '. The Guilds noticed the difference between luck and policy.',
            };
          }
          return {
            title: 'The Low Water', effects: [tr(-3), st('guilds', -3)],
            body: 'The river shrank in the heat and the barges sat on gravel for a month. Cargo rotted at the staithes. The Guilds sent a delegation with a map of the shallows and a pointed silence.',
          };
        },
      },
    ],
    Autumn: [
      {
        id: 'harvest', domain: 'grain', suppressed: null,
        portent: 'The fields stand gold to the horizon: harvest is near.',
        run: function (api) {
          if (api.hasEdict('levy', 'grain')) {
            return {
              title: 'The Harvest', effects: [tr(12), st('commons', -5)],
              body: 'The wagons rolled in heavy and the tithe-men met them at the gate — ' + api.edictName('levy', 'grain') + ' takes its share before the millers do. The granary of the palace is full. The word "before" is doing a great deal of work in the Commons\' retelling.',
            };
          }
          if (api.hasEdict('subsidy', 'grain')) {
            return {
              title: 'The Harvest', effects: [tr(4), st('commons', 5)],
              body: 'A fat harvest, and the public granaries — kept under ' + api.edictName('subsidy', 'grain') + ' — bought the surplus at a fair price. Bread will be cheap until spring, and the Commons are saying your name kindly.',
            };
          }
          return {
            title: 'The Harvest', effects: [tr(6), st('commons', 2)],
            body: 'The harvest came in fair and full. Market dues swelled the treasury; the smell of threshing hung over the city for a week.',
          };
        },
      },
      {
        id: 'vintage', domain: 'ale',
        portent: 'The brewers are scrubbing their vats: the autumn brewing is near.',
        suppressed: {
          title: 'The Dry Vintage', effects: [tr(-3), st('garrison', 2)],
          body: 'The autumn brewing did not happen — not officially. The Garrison, enforcing the ban, reports the cellars of the city are mysteriously full and the excise mysteriously empty. They rather enjoy the raids.',
        },
        run: function (api) {
          if (api.hasEdict('levy', 'ale')) {
            return {
              title: 'The Vintage', effects: [tr(7), st('commons', -3)],
              body: 'The brewhouses steamed for a fortnight and the excise-men stood at every door — ' + api.edictName('levy', 'ale') + ' turns thirst into revenue. Efficient. Unloved.',
            };
          }
          return {
            title: 'The Vintage', effects: [tr(3), st('commons', 3)],
            body: 'The autumn brewing filled the cellars and, briefly, everyone was in a forgiving mood. Even the Chancellor was seen to smile, though he denies it.',
          };
        },
      },
    ],
    Winter: [
      {
        id: 'frost', domain: 'grain', suppressed: null,
        portent: 'The almanac-men promise a hard frost; firewood is climbing in price.',
        run: function (api) {
          if (api.hasEdict('subsidy', 'grain')) {
            return {
              title: 'The Hard Frost', effects: [st('commons', 3), tr(-2)],
              body: 'A killing frost, but the public granaries opened on schedule — ' + api.edictName('subsidy', 'grain') + ' was written for exactly this. Queues, but no funerals. The Commons remember which winters had funerals.',
            };
          }
          return {
            title: 'The Hard Frost', effects: [st('commons', -4), tr(-3)],
            body: 'A frost that split fence-posts. Bread doubled in price by Candle-week and the poor burned their stools. The Commons ask, reasonably, what a Regent is for.',
          };
        },
      },
      {
        id: 'feastday', domain: 'festival',
        portent: 'The Temple is rehearsing the midwinter processional; candles are being counted.',
        suppressed: {
          title: 'The Dark Midwinter', effects: [st('temple', -5), st('commons', -4)],
          body: 'No processional, no feast, no lights: the midwinter rites are, by the letter of the ban, a festival. The city sat in the dark and thought about you specifically.',
        },
        run: function (api) {
          if (api.hasEdict('mandate', 'festival')) {
            return {
              title: 'The Midwinter Feast', effects: [st('temple', 4), st('commons', 4)],
              body: 'The processional wound through every ward, lamps in every window, as ' + api.edictName('mandate', 'festival') + ' provides. Cold outside, warm inside. This is what the mandate buys, and tonight it looks cheap.',
            };
          }
          return {
            title: 'The Midwinter Feast', effects: [st('temple', 3), st('commons', 2)],
            body: 'The midwinter feast came off well enough: the processional was short and the ale was hot. The year turns.',
          };
        },
      },
    ],
  };

  // ------------------------------------------------------- random incidents
  const INCIDENTS = [
    {
      id: 'scandal', domain: 'press',
      portent: 'Clerks in the counting-house have gone quiet when questioned. Something is off in the ledgers.',
      suppressed: null, // scandals ignore bans; press level shapes them in run()
      run: function (api) {
        const level = api.pressLevel();
        if (level === 2) {
          return {
            title: 'The Counting-House Scandal', effects: [lg(-8), tr(-4)],
            body: 'A deputy of the counting-house has been skimming the wharf dues — and the free gazettes have printed the sums, the names, and a woodcut. Everyone literate has read it twice. The money is gone; so is a strip of your good name.',
          };
        }
        if (level === 0) {
          return {
            title: 'The Counting-House Whisper', effects: [lg(-1), tr(-4)],
            body: 'A deputy of the counting-house has been skimming the wharf dues. No gazette exists to say so, and so almost nobody knows. The money is still gone. The silence was convenient. Remember that it was also purchased.',
          };
        }
        return {
          title: 'The Counting-House Scandal', effects: [lg(-4), tr(-4)],
          body: 'A deputy of the counting-house has been skimming the wharf dues. The licensed gazette reported it in careful language on an inside page. Bad, contained.',
        };
      },
    },
    {
      id: 'brawl', domain: 'ale',
      portent: 'The taverns by the wharf are loud lately; the watch is doubling its rounds.',
      suppressed: {
        title: 'The Quiet Taverns', effects: [tr(-3), st('garrison', 2)],
        body: 'No tavern brawls this season — no taverns, officially. The Garrison reports that the city drinks in cellars now, untaxed and unwatched, and asks with a straight face for a cellar-raiding budget.',
      },
      run: function () {
        return {
          title: 'The Wharfside Brawl', effects: [st('commons', -2), st('garrison', 2), lg(-1)],
          body: 'A tavern disagreement about a dice game annexed the whole wharf by midnight. The watch broke it up with relish. Three stalls, one tooth, and a little of your peace were lost.',
        };
      },
    },
    {
      id: 'bequest', domain: 'trade', suppressed: null,
      portent: 'Old Mercer Halloway is dying, and his heirs are said to be quarrelsome.',
      run: function () {
        return {
          title: 'The Mercer\'s Bequest', effects: [tr(12), st('guilds', 2)],
          body: 'Mercer Halloway died as he lived: spitefully. His will leaves his fortune "to the city, that my nephews may watch it spent." The treasury accepts, on behalf of the nephews\' education.',
        };
      },
    },
    {
      id: 'relic', domain: 'faith',
      portent: 'Pilgrims are drifting into the city; the Temple is being coy about why.',
      suppressed: {
        title: 'The Unwelcome Relic', effects: [st('temple', -6), st('commons', -2)],
        body: 'A relic of Saint Osric was carried to the gates — and turned away, the rites of welcome being prohibited under the ban. The Temple\'s silence has a temperature, and it is not warm.',
      },
      run: function () {
        return {
          title: 'The Relic of Saint Osric', effects: [st('temple', 4), st('commons', 2), tr(2)],
          body: 'A knucklebone of Saint Osric, authenticated by three abbots of varying sobriety, has come to the Temple. Pilgrims follow it. Pilgrims spend money. The Temple calls it grace; the Guilds call it foot traffic.',
        };
      },
    },
    {
      id: 'duel', domain: 'arms',
      portent: 'Two lieutenants of the Garrison have stopped speaking to each other. Their friends are choosing seconds.',
      suppressed: {
        title: 'The Confiscated Quarrel', effects: [st('garrison', -2), lg(1)],
        body: 'Two lieutenants meant to duel at dawn; the watch, citing the ban on arms, confiscated both swords the night before. The duel was fought with fists, briefly and badly, and honor was declared satisfied by whoever declares that.',
      },
      run: function () {
        return {
          title: 'The Lieutenants\' Duel', effects: [st('garrison', -3), lg(-2)],
          body: 'Two lieutenants duelled at dawn over a matter neither can now state clearly. One will limp; both are disgraced; the Garrison is embarrassed and therefore surly.',
        };
      },
    },
    {
      id: 'ballad', domain: 'press',
      portent: 'A minstrel in the Low Market has been trying rhymes for "Regent." Most are kind.',
      suppressed: {
        title: 'The Unsung Ballad', effects: [st('commons', -2)],
        body: 'A minstrel wrote a flattering ballad about you. It cannot be printed, printing being banned, and a ballad that cannot be sold is a ballad that dies. The Commons hum the tune anyway, with words about someone else.',
      },
      run: function () {
        return {
          title: 'The Regent\'s Ballad', effects: [lg(2), st('commons', 2)],
          body: 'A ballad about your regency — mostly flattering, scanning badly — is selling in the Low Market for a penny the sheet. You come off as stern but fair. The rhyme for "Regent" is "decent," which does some heavy lifting.',
        };
      },
    },
    {
      id: 'pilgrimjam', domain: 'river',
      portent: 'A convoy of pilgrim barges is reported upriver, moving slowly and singing.',
      suppressed: {
        title: 'The Barges Turned Away', effects: [st('temple', -4), tr(-2)],
        body: 'Forty barges of pilgrims reached the boom and were turned back, river traffic being prohibited. They sang the whole way upstream, a hymn with a grievance in it, and the candle-money went to some other city.',
      },
      run: function (api) {
        if (api.hasEdict('levy', 'river')) {
          return {
            title: 'The Pilgrim Barges', effects: [tr(4), st('temple', -3)],
            body: 'Forty barges of pilgrims came downriver and were charged toll at the boom, each barge, per ' + api.edictName('levy', 'river') + '. The Temple notes acidly that grace is now the only thing entering this city untaxed.',
          };
        }
        return {
          title: 'The Pilgrim Barges', effects: [st('temple', 2), tr(2)],
          body: 'Forty barges of pilgrims came downriver singing, bought every candle in the city, and left. The Temple is pleased. The chandlers are ecstatic.',
        };
      },
    },
  ];

  // --------------------------------------------- interpretation scenarios
  // The Letter of the Law. Keyed 'template:domain'; GENERIC by template.
  // Shape: { title, body(edictName, domainLabel), uphold, overrule, amend } —
  // effects arrays; court-uphold adds +2 legitimacy and overrule adds -4
  // centrally in the engine (rule-of-law is one rule, not per scenario).
  function mkInterp(title, body, victim, extraUphold) {
    return {
      title: title, body: body,
      uphold: [st(victim, -6)].concat(extraUphold),
      overrule: [st(victim, 4)],
      amend: [st(victim, 2)],
    };
  }

  const INTERPRETATIONS = {
    'levy:river': mkInterp('The Ferryman\'s Rescue',
      function (name) { return 'During the floods, the ferryman Dobbin pulled eleven drowning citizens from the water. The toll-clerks, reading ' + name + ' strictly, have billed him passage-tax for each: eleven persons conveyed across the river. "Passage," the clerk explains, "is passage." Dobbin has framed the bill and hung it on his boat.'; },
      'commons', [tr(2)]),
    'levy:grain': mkInterp('The Seed Corn',
      function (name) { return 'The assessors under ' + name + ' have weighed the farmers\' seed grain — grain held for planting — and taxed it as harvest. "It is grain," the chief assessor says, tapping the statute. "The statute does not say when grain becomes grain." Next year\'s bread is being taxed before it exists.'; },
      'commons', [tr(3)]),
    'levy:trade': mkInterp('The Gift Horse',
      function (name) { return 'At the Tanner-Wickfield wedding, the customs-men assessed the wedding gifts as imported goods under ' + name + ' — the bride being from downriver, her dowry crossed the toll-line. Forty geese, a loom, and a grandmother\'s chair, all dutied. The groom paid. The marriage is off to a documented start.'; },
      'guilds', [tr(2)]),
    'levy:faith': mkInterp('The Beggar\'s Alms',
      function (name) { return 'The assessors have ruled that alms-bowls at the Temple door constitute revenue of the Faith and fall under ' + name + '. They now stand beside the beggars with a smaller bowl, collecting the tithe of the tithe. The beggars have begun charging the assessors rent for the shade.'; },
      'temple', [tr(1)]),
    'levy:ale': mkInterp('The Small Beer',
      function (name) { return 'Small beer — the weak brew children drink because the well-water kills — has been ruled ale under ' + name + '. "Fermented is fermented," says the excise-man. Mothers are paying drink-tax on breakfast. A delegation of eight-year-olds delivered a petition in crayon.'; },
      'commons', [tr(2)]),
    'levy:festival': mkInterp('The Juggler\'s Count',
      function (name) { return 'The fair-tax under ' + name + ' is assessed "per performance." A clerk has ruled that each ball a juggler keeps aloft is a separate performance, being separately entertaining. Tumbler\'s Row is in arrears. One juggler now performs with a single enormous ball, staring at the clerk the whole time.'; },
      'commons', [tr(1)]),
    'subsidy:grain': mkInterp('The Ornamental Wheat',
      function (name) { return 'Guild households have planted wheat in their window-boxes and claimed the growers\' subsidy under ' + name + '. Six stalks constitutes a farm, apparently; the statute names no minimum. The Chancellor is paying prosperous mercers to decorate their sills while the dole queue watches.'; },
      'commons', [tr(-5)]),
    'subsidy:arms': mkInterp('The Pikemen of Ledger Lane',
      function (name) { return 'Eleven counting-house clerks have registered as pikemen to draw the muster-pay under ' + name + '. They drill on Ledger Lane at lunch, badly, holding their pikes like enormous quills. The statute pays anyone who musters. They muster. The Marshal\'s letter on this subject is one sentence long.'; },
      'garrison', [tr(-5)]),
    'subsidy:river': mkInterp('The Navigable Cellar',
      function (name) { return 'A wharfinger whose cellar floods every spring has declared it a waterway and claimed dredging funds under ' + name + '. The statute defines a waterway as "water upon which a vessel may pass"; he demonstrated with a rowboat and his nephew. The claim was paid. He is said to be excavating.'; },
      'guilds', [tr(-5)]),
    'ban:festival': mkInterp('The Solemn Funeral',
      function (name) { return 'Old Abbess Merrin\'s funeral procession — trumpets, banners, the full rites — has been halted at the gate under ' + name + '. Music in the streets is revelry, the captain ruled, and revelry is festival. The Abbess waits in the gatehouse. The Temple\'s letter uses the word "grotesque" four times.'; },
      'temple', []),
    'ban:ale': mkInterp('The Communion Cup',
      function (name) { return 'The watch has seized the Temple\'s sacramental wine under ' + name + '. "Fermented is fermented," the sergeant said, which is becoming this city\'s epitaph. The rite of the cup is suspended pending appeal. The Temple is incandescent in a very quiet way.'; },
      'temple', []),
    'ban:arms': mkInterp('The Butcher\'s Cleaver',
      function (name) { return 'The watch, enforcing ' + name + ', has confiscated every cleaver in the Shambles — a cleaver being inarguably an arm, by weight if not intent. The butchers stand before whole oxen, holding spoons. Meat is now negotiated rather than cut.'; },
      'commons', []),
    'ban:press': mkInterp('The Recipe Card',
      function (name) { return 'Widow Prentice copied out her pie recipes for the neighbors, as she has for thirty years. Under ' + name + ', copies distributed to the public constitute publication; she has been cited as an unlicensed press. The evidence — one card, "eel pie, mind the bones" — is under seal in the courthouse.'; },
      'commons', []),
    'ban:river': mkInterp('The Interrupted Baptism',
      function (name) { return 'The Temple\'s river baptisms have been halted under ' + name + ': the celebrant and the anointed do, technically, enter the river, and entering the river is traffic upon it. Souls are being saved in a rain-barrel while the appeal is heard. The Temple finds the barrel demeaning.'; },
      'temple', []),
    'mandate:festival': mkInterp('The Feast of the Quarantined',
      function (name) { return 'The hamlet of Nether Ashing, sealed for fever, has been fined for failing to hold its festival as ' + name + ' requires. The statute admits no exemptions; plague is not among the listed impediments, the clerk notes, because nothing is. The fine was delivered by a man with a very long pole.'; },
      'commons', [tr(1)]),
    'mandate:faith': mkInterp('The Sleeping Watchman',
      function (name) { return 'The night watch, who sleep at dawn because they work at night, have been fined under ' + name + ' for missing the dawn observance. The statute requires attendance of "all able persons"; sleep, the clerk ruled, is an ability. The watch now attends dawn prayers and sleeps through them, upright, in armor, snoring in unison.'; },
      'garrison', []),
    'mandate:arms': mkInterp('Grandmother Tilly\'s Pike',
      function (name) { return 'Under ' + name + ', every household must keep arms fit for muster. The inspectors cited Grandmother Tilly, ninety-one, for an unfit pike — hers is used to prop the beans. She appealed on grounds of the beans. She has been drilling with it in the lane, to the terror of all, to prove a point about statutory drafting.'; },
      'commons', []),
    'mandate:press': mkInterp('The Correspondent',
      function (name) { return 'The public gazette required under ' + name + ' must "print all notices submitted by any citizen." A crank named Fennick has submitted forty pages on the theft of his boundary-stone in the year \'06, and the statute admits no editor. This season\'s gazette is entirely Fennick. Next season\'s is expected to be also Fennick.'; },
      'guilds', [tr(-2)]),
  };

  const GENERIC_INTERPRETATIONS = {
    levy: function (victim) {
      return mkInterp('The Diligent Assessor',
        function (name, domain) { return 'An assessor of uncommon energy has ruled that ' + name + ' applies to goods merely passing through the city, resting in the city, or being thought about within the walls. Collections are up. So are complaints, from everyone whose livelihood touches ' + domain + '.'; },
        victim, [tr(2)]);
    },
    subsidy: function (victim) {
      return mkInterp('The Broad Reading',
        function (name, domain) { return 'Claimants have discovered that ' + name + ' nowhere defines its beneficiary. Anyone adjacent to ' + domain + ' — suppliers, cousins, a man who once painted a picture of it — has filed. The Chancellor is paying out to a queue of the creatively eligible.'; },
        victim, [tr(-4)]);
    },
    ban: function (victim) {
      return mkInterp('The Zealous Seizure',
        function (name, domain) { return 'The watch, enforcing ' + name + ' to the letter, has seized a quantity of things that resemble, adjoin, or might one day become ' + domain + '. The evidence-room is full. The line between prohibition and collection has blurred.'; },
        victim, []);
    },
    mandate: function (victim) {
      return mkInterp('The Impossible Compliance',
        function (name, domain) { return 'The inspectors under ' + name + ' have fined a man for non-compliance in circumstances where compliance was physically impossible, the statute listing no impediments. His appeal — a diagram, mostly — is circulating in the taverns to great acclaim.'; },
        victim, [tr(1)]);
    },
  };

  // RIGHT edicts probe differently: the holder stretches the right.
  function rightInterpretation(factionId, factionName) {
    return {
      title: 'The Elastic Right',
      body: function (name) { return factionName + ' have produced ' + name + ' in answer to a routine obligation, arguing the right, "reasonably construed," excuses them from it. The construal is not reasonable. It is, however, arguable, and they have retained a lawyer who can argue.'; },
      uphold: [tr(-4), st(factionId, 3)],
      overrule: [st(factionId, -5)],
      amend: [st(factionId, -2)],
    };
  }

  // The faction most invested in a domain (first lister; commons as fallback).
  function likerOf(domain) {
    for (let i = 0; i < FACTION_IDS.length; i++) {
      if (FACTIONS[FACTION_IDS[i]].likes.indexOf(domain) >= 0) return FACTION_IDS[i];
    }
    return 'commons';
  }

  function interpretationFor(template, domain) {
    if (template === 'right') return rightInterpretation(domain, FACTIONS[domain].name);
    const specific = INTERPRETATIONS[template + ':' + domain];
    if (specific) return specific;
    return GENERIC_INTERPRETATIONS[template](likerOf(domain));
  }

  // ---------------------------------------------------------------- petitions
  // { id, title, body, when(hasEdict, precedents)|null, cites, citeText,
  //   options: [{label, effects, sets, refusal}], autoIndex }
  // autoIndex: the option applied (worsened) if the petition festers.
  const PETITIONS = [
    {
      id: 'millers', title: 'The Millers\' Petition',
      body: 'The millers of the East Bank petition for relief from the grain levy: the tithe-men assess the grain entering the mill and the flour leaving it, taxing the same bread twice on its way to existing.',
      when: function (hasEdict) { return hasEdict('levy', 'grain'); },
      cites: null, citeText: '',
      options: [
        { label: 'Grant relief', effects: [st('commons', 6), tr(-4)], sets: 'tax-relief', refusal: false },
        { label: 'Refuse — the levy stands', effects: [st('commons', -4)], sets: null, refusal: true },
      ],
      autoIndex: 1,
    },
    {
      id: 'dyers', title: 'The Dyers\' Petition',
      body: 'The dyers\' fellowship petitions for relief from their assessments, pleading hard years and harder colors.',
      when: null,
      cites: 'tax-relief',
      citeText: ' Their spokesman reads aloud from your relief of the millers: "Are the dyers lesser subjects than the millers, or merely worse-smelling?"',
      options: [
        { label: 'Grant relief', effects: [st('guilds', 5), tr(-4)], sets: 'tax-relief', refusal: false },
        { label: 'Refuse', effects: [st('guilds', -4)], sets: null, refusal: true },
      ],
      autoIndex: 1,
    },
    {
      id: 'orphans', title: 'The Orphans of Candlemas Row',
      body: 'The wardens of the Candlemas orphanage petition for a winter bread-dole. The children have been taught to wave at your window. It is extremely effective.',
      when: null,
      cites: 'charity',
      citeText: ' The wardens note, gently, that the city\'s purse has opened for charity before, and children remember what a city teaches them it is.',
      options: [
        { label: 'Grant the dole', effects: [st('commons', 5), tr(-6), lg(1)], sets: 'charity', refusal: false },
        { label: 'Refuse — the purse is not bottomless', effects: [st('commons', -3), lg(-1)], sets: null, refusal: true },
      ],
      autoIndex: 1,
    },
    {
      id: 'bells', title: 'The Cracked Bell',
      body: 'The great bell of the Temple has cracked — mid-toll, alarmingly. The Temple petitions the city to fund its recasting, the bell being, they argue, civic infrastructure that happens to be holy.',
      when: null, cites: null, citeText: '',
      options: [
        { label: 'Fund the recasting', effects: [st('temple', 6), tr(-8)], sets: 'charity', refusal: false },
        { label: 'Refuse — the Temple has coffers', effects: [st('temple', -4)], sets: null, refusal: true },
      ],
      autoIndex: 1,
    },
    {
      id: 'boots', title: 'The Marshal\'s Requisition',
      body: 'The Marshal requisitions new boots for the Garrison, attaching a single worn-through sole to the document as Exhibit A. The exhibit has been nailed to the requisition. The nail is also worn.',
      when: null, cites: null, citeText: '',
      options: [
        { label: 'Pay for the boots', effects: [st('garrison', 6), tr(-8)], sets: null, refusal: false },
        { label: 'Promise boots "when the treasury allows"', effects: [st('garrison', -2), lg(-1)], sets: null, refusal: false },
        { label: 'Refuse', effects: [st('garrison', -5)], sets: null, refusal: true },
      ],
      autoIndex: 2,
    },
    {
      id: 'monopoly', title: 'The Shipping Compact',
      body: 'The Guilds petition for exclusive carriage rights on the river — a monopoly, though their draftsman has found four longer words for it. Order on the water, they promise. Their prices, they do not mention.',
      when: null, cites: null, citeText: '',
      options: [
        { label: 'Grant the compact', effects: [st('guilds', 7), st('commons', -4)], sets: 'monopoly', refusal: false },
        { label: 'Refuse — the river is common', effects: [st('guilds', -4), st('commons', 2)], sets: null, refusal: true },
      ],
      autoIndex: 1,
    },
    {
      id: 'widow', title: 'The Widow at the Toll-Boom',
      body: 'The widow Harrow crosses the river daily to nurse her sister and cannot pay the toll both ways. She petitions for exemption. The toll-clerk who reported her has also, unofficially, been paying her fare, and would appreciate a ruling before he is ruined.',
      when: function (hasEdict) { return hasEdict('levy', 'river'); },
      cites: null, citeText: '',
      options: [
        { label: 'Exempt her', effects: [st('commons', 4)], sets: 'toll-exemption', refusal: false },
        { label: 'Enforce the toll', effects: [st('commons', -3), tr(1), lg(-1)], sets: null, refusal: true },
      ],
      autoIndex: 1,
    },
    {
      id: 'printer', title: 'The Heretical Printer',
      body: 'The Temple demands the arrest of Jonas Quill, printer, for a pamphlet questioning whether Saint Osric\'s knucklebone is Saint Osric\'s, or indeed a knucklebone. The Commons have bought every copy. Quill has already set type for a sequel.',
      when: null, cites: null, citeText: '',
      options: [
        { label: 'Arrest the printer', effects: [st('temple', 5), st('commons', -5)], sets: null, refusal: false },
        { label: 'Protect him — let doubt be printed', effects: [st('commons', 5), st('temple', -5)], sets: 'free-word', refusal: false },
      ],
      autoIndex: 0,
    },
    {
      id: 'alehours', title: 'The Curfew Question',
      body: 'The Temple petitions for tavern hours ending at dusk, "when the day\'s honest work is done." The Commons counter-petition that the day\'s honest work is precisely what taverns exist to end. Both delegations are here. They have been made to share a bench.',
      when: null, cites: null, citeText: '',
      options: [
        { label: 'Side with the Temple', effects: [st('temple', 5), st('commons', -4)], sets: null, refusal: false },
        { label: 'Side with the Commons', effects: [st('commons', 5), st('temple', -4)], sets: null, refusal: false },
      ],
      autoIndex: 0,
    },
    {
      id: 'bridge', title: 'The Sagging Bridge',
      body: 'The Wardens of the Ways report the Old Bridge is sagging "in a manner that has begun to interest engineers from other cities." Repair is costly. The bridge carries half the city\'s trade and all of its shortcuts.',
      when: null, cites: null, citeText: '',
      options: [
        { label: 'Fund the repair', effects: [tr(-10), st('guilds', 4), st('commons', 3)], sets: null, refusal: false },
        { label: 'Defer it another year', effects: [st('guilds', -3), st('commons', -2)], sets: null, refusal: true },
      ],
      autoIndex: 1,
    },
    {
      id: 'beggarking', title: 'The Beggar Who Would Be King',
      body: 'A beggar called Old Fitch has proclaimed himself the rightful heir, on the evidence of a birthmark and tremendous confidence. He holds court on the Temple steps, pardoning passersby. The crowd loves him. The Garrison awaits instruction, hands hovering near their patience.',
      when: null, cites: null, citeText: '',
      options: [
        { label: 'Grant him an audience, solemnly', effects: [st('commons', 4), lg(-2)], sets: null, refusal: false },
        { label: 'Have him moved along', effects: [st('commons', -3), st('garrison', 2)], sets: null, refusal: false },
      ],
      autoIndex: 1,
    },
    {
      id: 'census', title: 'The Proposal of a Census',
      body: 'The city clerks propose a census: every household, hearth, and trade, counted and written down. "One cannot govern what one has not counted," their memorandum begins, and continues in that vein for some pages.',
      when: null, cites: null, citeText: '',
      options: [
        { label: 'Commission the census', effects: [tr(-5), lg(3), st('garrison', 2)], sets: null, refusal: false },
        { label: 'Decline — the city dislikes being counted', effects: [st('commons', 1), lg(-1)], sets: null, refusal: false },
      ],
      autoIndex: 1,
    },
    {
      id: 'cheese', title: 'The Standard of Cheese',
      body: 'The cheesemongers petition for an official standard of cheese — weight, water, and what may lawfully be called "old." Fraudulent cheese, they say, walks among us. They have brought examples. The examples are compelling and one is frankly upsetting.',
      when: null, cites: null, citeText: '',
      options: [
        { label: 'Proclaim the standard', effects: [st('guilds', 4), lg(1)], sets: 'standards', refusal: false },
        { label: 'Decline to regulate cheese', effects: [st('guilds', -2)], sets: null, refusal: true },
      ],
      autoIndex: 1,
    },
    {
      id: 'doctrine', title: 'The Standard of Doctrine',
      body: 'The Temple petitions for an official standard of doctrine, to be proclaimed as the cheese was.',
      when: null,
      cites: 'standards',
      citeText: ' Their advocate is direct: "The city has ruled on what may be called cheese. Is truth less than cheese? We ask the Regent to be consistent." You have, in fact, no good answer to whether truth is less than cheese.',
      options: [
        { label: 'Proclaim the doctrine', effects: [st('temple', 6), st('commons', -5)], sets: null, refusal: false },
        { label: 'Refuse — creeds are not cheese', effects: [st('temple', -4)], sets: null, refusal: true },
      ],
      autoIndex: 1,
    },
    {
      id: 'ratcatchers', title: 'The Ratcatchers\' Wage',
      body: 'The ratcatchers petition for a per-rat bounty, to replace their flat wage. Their productivity argument is sound. Their sacks, brought as evidence, are sound too, and moving slightly.',
      when: null, cites: null, citeText: '',
      options: [
        { label: 'Pay per rat', effects: [st('commons', 3), tr(-3)], sets: 'bounty', refusal: false },
        { label: 'Keep the flat wage', effects: [st('commons', -2)], sets: null, refusal: true },
      ],
      autoIndex: 1,
    },
    {
      id: 'ratfarm', title: 'The Rat Farm',
      body: 'The watch has discovered that the ratcatchers of Tanner\'s Yard are breeding rats in a loft, harvesting the bounty on a sustainable-yield basis.',
      when: function (hasEdict, precedents) { return Boolean(precedents['bounty']); },
      cites: 'bounty',
      citeText: ' Their foreman, unrepentant: "The proclamation pays for dead rats. It is silent on the provenance of rats. We read it twice." He is correct. You have checked. You wrote it.',
      options: [
        { label: 'Pay, and amend the wording', effects: [tr(-4), st('commons', 2), lg(1)], sets: null, refusal: false },
        { label: 'Refuse and prosecute', effects: [st('commons', -4), lg(-2)], sets: null, refusal: true },
      ],
      autoIndex: 1,
    },
  ];

  // -------------------------------------------------------- endorsement prices
  // Visible from the start; checked against the live law book every season.
  const PRICES = {
    guilds: {
      text: 'No levy may touch trade or the river.',
      check: function (hasEdict) { return !hasEdict('levy', 'trade') && !hasEdict('levy', 'river'); },
    },
    temple: {
      text: 'The festivals must be mandated, or the Faith subsidized.',
      check: function (hasEdict) { return hasEdict('mandate', 'festival') || hasEdict('subsidy', 'faith'); },
    },
    commons: {
      text: 'No levy on grain, and no ban on ale.',
      check: function (hasEdict) { return !hasEdict('levy', 'grain') && !hasEdict('ban', 'ale'); },
    },
    garrison: {
      text: 'The arms must be funded — a subsidy or a mandate on arms.',
      check: function (hasEdict) { return hasEdict('subsidy', 'arms') || hasEdict('mandate', 'arms'); },
    },
  };

  // ---------------------------------------------------------------- crises
  const CRISES = {
    guilds: {
      title: 'Capital Flight',
      body: 'Three of the great houses have moved their counting-rooms downriver, taking their capital, their custom, and their opinion of you. The wharves are quieter. So is the treasury.',
      effects: [tr(-20), lg(-4)],
    },
    temple: {
      title: 'The Interdict',
      body: 'The Temple has closed its doors: no rites, no bells, no burials until the Regent mends their grievances. The city\'s dead wait. The city\'s living blame you for the waiting.',
      effects: [lg(-10), st('commons', -4)],
    },
    commons: {
      title: 'The Bread Riot',
      body: 'The Low Quarter rose at dusk — bakeries first, then the toll-booths, then anything with a lock. The Garrison restored order and enjoyed it more than is seemly. The bill is in three parts: damages, overtime, and trust.',
      effects: [tr(-10), lg(-8), st('garrison', 3)],
    },
    garrison: {
      title: 'The Coup',
      body: 'Before dawn, the Garrison seized the gates, the armoury, and the question of who rules.',
      effects: [],
    },
  };

  const EPITHETS = [
    { stat: 'overrules', title: 'the Imperious', line: 'who found the law a fine thing for other people.' },
    { stat: 'upholds', title: 'the Letter-Perfect', line: 'who let the law say what it said, and said so.' },
    { stat: 'amendments', title: 'the Meticulous', line: 'who governed with a pen in one hand and an eraser in the other.' },
    { stat: 'petitionsGranted', title: 'the Openhanded', line: 'to whom no petitioner returned empty, including the ones who were lying.' },
    { stat: 'petitionsRefused', title: 'the Flinty', line: 'who heard every petition all the way to its no.' },
    { stat: 'petitionsFestered', title: 'the Unavailable', line: 'whose door was famous for the queue outside it.' },
    { stat: 'edictsPassed', title: 'the Prolific', line: 'who never met a problem a statute couldn\'t complicate.' },
    { stat: 'repeals', title: 'the Eraser', line: 'who governed mostly by taking it back.' },
    { stat: 'festivalsHeld', title: 'the Merry', line: 'who ruled on the theory that a fed and dancing city asks fewer questions.' },
  ];

  return {
    DOMAINS: DOMAINS, DOMAIN_LABELS: DOMAIN_LABELS,
    FACTIONS: FACTIONS, FACTION_IDS: FACTION_IDS,
    TEMPLATES: TEMPLATES, CONTRIB: CONTRIB, ECON: ECON,
    SEASON_NAMES: SEASON_NAMES,
    SEASONALS: SEASONALS, INCIDENTS: INCIDENTS,
    interpretationFor: interpretationFor, likerOf: likerOf,
    PETITIONS: PETITIONS, PRICES: PRICES, CRISES: CRISES, EPITHETS: EPITHETS,
    fx: { st: st, tr: tr, lg: lg },
  };
})();

if (typeof module !== 'undefined') module.exports = CharterData;
