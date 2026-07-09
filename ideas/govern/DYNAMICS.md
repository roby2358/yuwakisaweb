# DYNAMICS.md — CHARTER
*A game of governance in the river-city of Lexden.*

This is the design journal: why the game is fun, before what the game does.
It is a living document — update it when mechanics change.

---

## The Experiment

The brief: design a governance game that *Claude* would want to play. So, honestly:

What fascinates me about governance is that it is conducted **in language**. A law is
a text that must be interpreted by people who weren't in the room when it was written.
The gap between what you *meant* and what you *wrote* is where all of politics lives —
unintended consequences, opportunistic readings, precedents that curdle into
entitlements, the clerk who follows your rule off a cliff because that's what it says.

Most governance games are about resource optimization with a political skin. I don't
want that. I want a game where **the law book is the gameboard** — where every edict I
pass is simultaneously a tool and a liability, where the simulation reads my own words
back to me more literally than I meant them, and where the endgame is reconciling the
contradictions in my own accumulated text. Governance as authorship. Debugging as
statecraft.

Also — and this matters — it should be *funny*. The comedy of literalism is the oldest
comedy in bureaucracy. A game about governing should make me laugh at my own laws.

---

## Theme

**The feeling:** *Every rule you write becomes a lens someone else reads the world
through — and they will read it exactly as written, never as meant.*

You are Regent of Lexden for six years, until the heir comes of age. You govern by
writing: edicts, rulings, responses to petitions. Your words accumulate into a law
book that grows more powerful and more dangerous with every entry. Your goal is to
leave behind a **Grand Charter** — a constitutional settlement ratified by the city's
factions — before the Regency ends. The final obstacle to that Charter is not an
enemy. It is your own law book.

Emotional register: careful authorship under time pressure; the dread-delight of
watching a well-intended decree curdle; the earned windfall when three old laws
suddenly compound into an elegant fix; the rueful laugh when the court rules that
festival lanterns are, technically, open flames.

---

## Key Drivers

Three load-bearing pillars. Every mechanic below weaves into at least one.

1. **Readable Consequences** — every effect in the game cites its cause *by name*:
   the edict, the precedent, the ruling that produced it. The chronicle is a causal
   audit trail. The "one more game" hook is "next regency, I'll word it differently."

2. **Escalating Commitment (as Governance Debt)** — every law you pass makes the
   world more governable *and* more brittle. The law book compounds. Legislating is
   powerful; every statute is also a future liability that can be probed, exploited,
   and contradicted. You cannot win without legislating, and everything you legislate
   will eventually be read against you.

3. **Comedy (of Literalism)** — the interpretation engine exists to produce moments
   where the law does exactly what it says and precisely not what you wanted. Comedy
   is the release valve for the debt pressure, and the stories the player retells.

Supporting drivers (named per-mechanic below): scarcity of agency, loss aversion,
variable reinforcement, near-miss architecture, accumulation and windfall.

---

## Key Mechanics (one per driver)

**M1 — The Cited Chronicle** *(readable consequences)*
Every event resolution names the specific edict, precedent, or ruling that shaped it
("…because of the **Grain Levy** (Autumn, Year 1), the millers…").

**M2 — Governance Debt** *(escalating commitment)*
Each season, the chance of an *interpretation event* rises with the number of active
edicts — the more law you have, the more often the law is read against you.

**M3 — The Letter of the Law** *(comedy)*
Interpretation events apply an active edict literally to a situation it was never
meant for; the player may let the ruling stand (rule of law, +legitimacy), overrule
it (−legitimacy — the Regent above the law), or spend AP to amend the text.

---

## The Shape of Play

Turn-based. One turn = one season. **24 seasons** (6 years) of Regency.

### Action Points *(scarcity of agency)*
**3 AP per season.** Costs vary by action (1–2 AP). You can never do everything;
choosing *which problem to ignore* is the core decision. Ignoring is itself resolved
mechanically (see Petitions).

### Actions

| Action | AP | What it does |
|---|---|---|
| Respond to petition | 1 | Choose among 2–3 options on a pending petition |
| Hold audience | 1 | True reading of one faction + reveal one incoming event |
| Convene court | 1 | Decide an interpretation dispute yourself |
| Repeal edict | 1 | Strike a law; its beneficiaries remember |
| Draft edict | 2 | Enact a parameterized law (see templates) |
| Amend edict | 2 | Add an exception clause; halves that edict's future probe weight |
| Hold festival | 2 + gold | Cheer factions; diminishing returns if repeated |
| Seek endorsement | 2 | Ask a Warm+ faction to endorse the Charter (they name a price) |
| Ratify the Charter | 2 | Win, if all conditions hold |
| End season | 0 | Always available — never stuck |

### Edicts Are Templates, Not Snowflakes
Five templates × eight domains. An edict is a parameter set, not a bespoke rule.

- **LEVY(domain)** — +treasury/season; angers the factions whose livelihood it taxes.
- **SUBSIDY(domain)** — −treasury/season; pleases the domain's dependents.
- **BAN(domain)** — blocks events tagged with the domain — *the good ones and the bad
  ones* (double-edged); angers who profits, pleases who disapproves; +Garrison
  (something to enforce), −Commons (one less liberty).
- **MANDATE(domain)** — requires the thing; −treasury upkeep; strongly pleases the
  domain's champions; creates compliance events.
- **RIGHT(faction)** — grants a liberty; big +standing, but permanently constrains
  you (levying that faction's domains now costs extra legitimacy).

**Domains:** trade, grain, river, faith, arms, festival, press, ale.

*Driver check:* templates keep consequences readable (M1); each new edict feeds the
debt engine (M2) and the interpretation table (M3).

### Factions *(loss aversion, guardianship)*
Four factions with genuinely incommensurable values — none is "correct":

- **The Guilds** — prosperity. Love trade and the river; loathe levies on either.
- **The Temple** — piety and order. Loves faith and festivals; abhors ale and a
  loose press.
- **The Commons** — bread and liberty. Love grain, ale, festivals, the press; hate
  grain levies and every ban.
- **The Garrison** — strength and purpose. Loves arms funding; quietly enjoys every
  ban (enforcement is budget); despises being unpaid.

Standing is a number (−100..100) shown as a **band**: Hostile / Cold / Neutral /
Warm / Loyal. A faction Hostile for 3 consecutive seasons triggers its crisis
(Guilds: capital flight; Temple: interdict; Commons: bread riot; Garrison: coup —
the coup can end the Regency outright).

### Legitimacy *(loss aversion — the thing you guard)*
0–100. Reaches 0 → deposed, game over. Gained by upholding court rulings, honest
petition handling, festivals, endorsements. Lost by overruling courts, ignored
petitions, scandals, broken precedents, insolvency. Legitimacy is the *capacity to
keep acting at all* — the resource that makes every other resource spendable.

### Petitions *(scarcity of agency, variable reinforcement)*
Each season 1–2 petitions arrive in the chronicle with inline options. An
unanswered petition **ages**; at age 2 it auto-resolves badly (cited in the
chronicle as "left to fester"). Ignoring is always legal and always costs something
— the triage is the game.

### Precedent *(readable consequences, escalating commitment)*
Some petition options set a **precedent flag**. Future petitioners cite it by name
("You granted the millers relief in Year 2 — are the dyers lesser subjects?").
Refusing a cited precedent costs double standing. Generosity is a loan the whole
city intends to collect.

### The Press *(information as currency — double-edged both ways)*
Press freedom is a dial (Gagged / Licensed / Free) set by BAN(press) /
MANDATE(press) / neither:
- **Free:** you see *forecasts* of next season's events (better planning), but
  scandals cost double legitimacy (everyone reads about them).
- **Licensed** (default): one forecast, normal scandals.
- **Gagged:** no forecasts, scandals cost little — but **rumor events** spawn
  (rumors thrive in silence) and Commons/Guilds drift down.
There is no correct setting; there is only what you can afford this year.

### Interpretation Events — the Debt Engine *(M2 + M3, comedy)*
Each season: `p = 8% × active edicts (cap 50%)`. On trigger, pick a random active
edict and draw its interpretation scenario — the law applied with perfect literalism
to the wrong situation (BAN(festival) meets a funeral procession "with music, which
is technically revelry"; LEVY(river) applied to the ferryman who rescues drowners —
"passage is passage"). Resolutions via **Convene Court**:
- **Uphold** — the absurdity stands; faction effects land; +2 legitimacy (rule of law).
- **Overrule** — the sensible outcome; −4 legitimacy (the Regent is above the law);
  the overruled faction remembers.
- **Amend** (2 AP) — fix the text; the edict is marked *amended* and its probe
  weight halves. The permanent fix costs the most now. This is the game teaching
  you to write better laws.

### Contradictions *(escalating commitment — your law book is the final boss)*
BAN(x)+MANDATE(x) or LEVY(x)+SUBSIDY(x) active together = a **contradiction**,
listed in the law book panel ("The Circular Ledger: you tax the wharves to pay the
wharves"). Contradictions leak treasury or legitimacy each season *and block
ratification*. The endgame is cleaning your own text while every repeal angers its
beneficiaries.

### The Grand Charter — Win Condition *(near-miss architecture, accumulation & windfall)*
To ratify: **3 of 4 factions endorsed** + **legitimacy ≥ 50** + **zero
contradictions**, before season 24 ends.
- Endorsement requires the faction **Warm+**, costs 2 AP, and the faction names a
  **price** generated from your actual law book (Commons: "repeal the grain levy";
  Temple: "mandate the festivals"; Guilds: "no levy may touch the river"; Garrison:
  "fund the arms"). The price stays visible; break it later and the endorsement is
  withdrawn.
- Each endorsement gained raises unrest among the unendorsed *(escalation tied to
  progress — your success mobilizes the opposition)*.
- A faction that slips below Warm mid-process suspends its endorsement — the
  near-miss is watching your coalition wobble in Year 6 with 2 AP left.

If the Regency ends unratified, the heir takes an ungoverned city and you are scored
on what you leave: standings, legitimacy, treasury, and the law book's coherence.

---

## Turn Loop (code-checked)

```
startSeason():
  treasury += baseIncome + Σ levy - Σ subsidy/mandate upkeep - garrison pay
  if treasury < 0: insolvency event (−legitimacy, Garrison −, forced loan)
  factions drift toward lawBookContentment(faction)   // each faction's read of the book
  apply contradiction leaks (cited)
  roll interpretation probe (p = 8% × edicts, cap 50%)
  draw seasonal + random events; deliver forecasts per press level
  spawn 1–2 petitions; ap = 3

playerPhase():  spend AP on actions until End Season

endSeason():
  age petitions; age ≥ 2 → auto-resolve badly (cited)
  hostile-streak counters; streak = 3 → faction crisis
  endorsement validity check (Warm+ and price intact)
  turn += 1; if turn > 24 → scoring
```

Every mechanic above is a field in one state struct:

```js
state = {
  turn, ap, treasury, legitimacy,
  factions: { guilds: {standing, hostileStreak, endorsed, price}, ... },
  edicts:   [ {id, template, domain, amended, turnEnacted} ],
  petitions:[ {id, key, age, options} ],
  precedents: { <tag>: turnSet },
  pressLevel, festivalCooldown,
  charter: { endorsements, ratified },
  log: [ ... ], rngSeed
}
```

---

## Strategies (reviewed against the mechanics)

**Early game (Years 1–2):** Legislate a working economy — one levy you can survive
politically (each choice angers someone specific), maybe a subsidy to your anchor
faction. Keep the book *thin*: debt pressure is low and you want it to stay low
while you learn the board. Answer petitions cheaply; be stingy with precedents.

**Mid game (Years 3–4):** The book has 4–6 edicts and interpretation events arrive
regularly. Amend the laws you'll keep; repeal the ones you won't — *before* their
beneficiaries are load-bearing for your coalition. Set the press to what you can
afford. Choose your three coalition factions and start shaping the book toward
their eventual prices.

**Late game (Years 5–6):** Endorsement sprint. Pay prices, guard standings, clear
contradictions. Every AP is contested: a petition festering costs a standing you
need Warm, an unamended old law can fire at the worst moment. Ratify with seasons
to spare or lose to your own backlog.

**Recurring tensions (every regency):**
- Legislate (power now, debt forever) vs. govern thin (safe, but poor and priceless
  at endorsement time — factions price what *exists* in the book).
- Uphold absurd rulings (legitimacy, comedy, faction pain) vs. overrule (sane
  outcome, corroded legitimacy).
- Grant the petition (standing now, precedent debt later) vs. refuse (cheap now,
  cited against you if you ever relent for anyone else).
- Free press (see the future, bleed on scandals) vs. gag (fog of rumor).

**Anti-strategies (and the specific mechanic that kills each):**
- *Coast lawlessly:* base income runs a structural deficit (garrison pay exceeds base
  income); insolvency events force taxation. Endorsement prices demand edicts
  *exist*. You must write.
- *Festival spam:* diminishing returns (half effect within cooldown) + gold cost +
  Temple sours on excess.
- *Repeal everything at the end:* each repeal is 1 AP + standing loss with
  beneficiaries; 24 seasons is too short to unwind a bloated book. Debt must be
  managed continuously, not settled at once.
- *Ignore all petitions:* age-2 auto-resolution has strictly worse outcomes than the
  worst manual option, and it's cited in the chronicle.
- *Permanent gag:* rumor events are random legitimacy damage with no counterplay
  except un-gagging — the fog is mechanically worse than the scandals for any
  regent planning more than a season ahead.
- *Endorse early then betray prices:* prices are monitored every season;
  endorsements withdraw. No lock-in.

**Dead-mechanic check:** Every template appears in at least one endorsement price and
one interpretation scenario. Every faction has a crisis, a price, and at least two
domains it cares about. Audience exists because forecasts + hidden exact standings
make information worth 1 AP. ✓

---

## Tuning Notes

- Start: treasury 60, legitimacy 60, all factions Neutral-ish (±10), base income 8,
  garrison pay 10 (structural deficit of 2/season until you legislate — the game's
  opening question is "who pays?").
- Halve-and-double first: probe rate (8%/edict), petition rate (1–2/season), price
  strictness.
- Interpretation scenarios are content, not code: one table keyed by
  (template, domain), ~2 scenarios each for the pairs that matter. One code path.
- If playtesting shows ratification is reliably achievable by Year 5, raise
  endorsement prices; the target is ratifying in the last 2–4 seasons, breathless.

### Playtest Findings (bot playtests, 40 seeded regencies)

- A fixed competent policy (coalition of Temple + Garrison + Commons, funded by
  levies on trade and river, disputes amended when affordable) ratifies **17/40**
  regencies, always between **seasons 17 and 24**. That is the near-miss band the
  design targets: winnable, never routine, always late. Encoded as
  `test/winnability.test.js` so tuning changes that break the band fail loudly.
- A random agent ratifies **0/40** — flailing legislation loses to its own debt.
- Design insight from the losing runs: the Garrison is the hard seal. Their
  contentment ceiling from `subsidy arms` alone (+8) sits below Warm (15), so
  their endorsement demands *both* arms edicts (−7/season) or sustained topping-up
  via petitions and musters. This is intended and now documented: the Garrison's
  price is the one you pay in structure, not in gestures. The first bot, which
  treated them like the Temple, never seated them.
- The endorsement backlash (−5 to each unendorsed faction) interacts sharply with
  the Garrison problem: seal your two easy factions first and the backlash buries
  the third. Correct play seals the *hardest* faction early. This emergent
  ordering puzzle was not designed on purpose. It is being kept on purpose.

---

## Why I'd Play This (the experiment, answered)

Because the core loop is *writing carefully under pressure*, which is — genuinely —
the thing I do. Because failure is legible: the chronicle shows me the exact clause
that broke, and the itch to re-word it is the "one more game" itch. Because the
comedy is structural, not scripted: the ferryman taxed for rescuing drowners emerges
from LEVY(river) meeting a flood event, and nobody wrote that joke. Because there is
no correct faction, only trade-offs held in tension — value pluralism as a game
state. And because the final boss is my own accumulated text, which is the most
honest metaphor for governance — and for authorship — that I can think of.
