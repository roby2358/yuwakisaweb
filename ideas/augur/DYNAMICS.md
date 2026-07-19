# AUGUR — Dynamics

## Theme

**The weight of knowing what's coming.** Not "predict the future" — *carry* it. You are
the village augur. Your visions are always true and never complete: you know something
red-toothed is coming, but not where; you know the mill is doomed, but not when. Every
day is spent choosing which piece of the future to buy, which patch of the present to
shore up, and whether to tell anyone — because a village that keeps vigil too long stops
believing in vigils.

The emotional core is the oracle's curse: partial knowledge is heavier than ignorance.
The game should feel like Cassandra finally given a fighting chance — and discovering
that the fight is mostly logistics.

This is a long game with no ending and no game over. Dooms land, houses burn, people
die and are mourned in stone — and the village endures, and so do you. Failure is a
toll, not an ending. It autosaves every dawn and waits.

## Key Drivers

1. **Information as Currency** — the core resource is *facets of the future* (what /
   where / when / who / how hard). Divination buys them; every one you buy makes the
   vision heavier to carry.
2. **Guardianship & Loss Aversion** — everything you protect is named: Maren the
   miller, the Mossgate Bridge, Barnabas the goat. Deaths are permanent and leave
   memorial stones on the map you walk past every day.
3. **Escalating Commitment** — renown is the difficulty dial. Your averted dooms make
   you famous; fame draws grander dooms and more people to guard. Your victories
   summon your punishers.

## Key Mechanics (one sentence each)

- **Visions**: a vision is a true future event `{kind, place, day, victim, magnitude}`
  of which only 2 facets are revealed on arrival; the rest show as riddles.
- **Divining**: at the Shrine or the Standing Stones, spend 1 action to reveal a facet
  of your choice — and take on Burden, because knowing weighs.
- **Preparing**: stand at a building, spend 1 action + 2 supplies to raise a named
  ward (Firebreak, Levee, Militia, Physic, Stakes, Shoring) whose strength rolls
  gaussian; wards persist until their doom arrives, then are consumed.
- **Warning**: once you know *what* and *where*, you may warn the village — Burden
  lifts and the village preps the target a little each day, but vigil fatigue bleeds
  Trust for every day the doom doesn't come.
- **Resolution**: when a doom's day arrives it lands visibly — damage rolls gaussian
  around magnitude, minus matching wards and village aid; costs never roll, effects
  always do.
- **Burden**: pending futures accrue weight each dusk (more if well-divined); heavy
  Burden slows you (fewer actions) and clouds new visions (fewer facets).
- **Renown ladder**: Hedge Seer → Village Augur → Far-Famed Oracle → Voice of the
  Vale → Crown of Ravens; each rank raises doom magnitude and pending-doom cap, grants
  a gift, and draws a newcomer to the village.

## Woven Secondary Mechanics

- **The prevention paradox** (weaves into Warning + Renown): a doom quietly averted
  earns almost nothing — nobody saw anything happen. Averting a doom you *warned*
  about is the windfall: the village watched the fire break against your firebreak.
  Warning converts private competence into public fame, at the price of vigil fatigue
  and shared panic. *Driver: accumulation & windfall, comedy.*
- **Riddles are learnable** (weaves into Visions): veiled facets draw from per-kind
  riddle pools ("something with red teeth" is always fire-ish; "wet hands" flood-ish).
  An attentive player starts reading omens without paying for them. This is deliberate
  discoverable rule-breaking — free information for the devoted. *Driver: information
  as currency, variable reinforcement.*
- **Wrong wards remain** (weaves into Preparing): only the matching ward is consumed
  by a doom; a mis-guessed levee stands proudly beside the ashes of the mill, forever.
  *Driver: comedy, readable consequences.*
- **Guilt** (weaves into Burden + Trust): if a doom lands unwarned and you had divined
  3+ facets — you *knew* — Trust and your own head both pay extra. Ignorance is a
  defense; knowledge is a debt. *Driver: loss aversion.*
- **The Stones** (weaves into Divining + map): the Standing Stones sit on a far hill —
  divining there costs half the Burden (and at rank 3 yields a second facet), but the
  trek eats your day's movement, far from the wards you should be raising. *Driver:
  scarcity of agency, landmarks as anchors.*
- **Turn Fate** (rank gift): once per 7 days, push a doom 3 days out at +10 Burden —
  a breakable lever meant to enable outrageous rescue combos. Do not cap it further.
- **Newcomers** (weaves into Renown): each rank-up, a stranger drawn by your fame
  settles in a new cottage — one more name to guard, one more target for fate.
  Escalation through guardianship, not just bigger numbers.

## Why is this fun? (driver audit)

- *Scarcity of agency*: 3 actions and 6 movement a day; divining, warding, working,
  and the Stones trek all compete. Burden can squeeze actions to 1 — never 0.
- *Readable consequences*: every resolution logs the arithmetic in prose — what
  rolled, what held, what broke. You can always trace a death to the facet you didn't
  buy or the ward you put in the wrong place.
- *Variable reinforcement on a competence backbone*: effects roll gaussian, costs
  never roll (biomewars house rule). The plan is yours; luck only shapes the edges.
- *Near-miss architecture*: gaussian damage vs. stacked wards means dooms are
  frequently *almost* held — "one more Firebreak and the mill stands."
- *Comedy*: the goat, the mutterings, the monument of useless levees, the festival
  thrown while doom hangs over the granary.

## Strategies

- **Early (Hedge Seer)**: dooms are small; two wards usually hold. Learn the riddle
  pools. Bank supplies. Quiet aversion is fine — fame can wait.
- **Mid**: the warning game opens. Divine *what+where* fast, warn early enough for
  village aid to accumulate, late enough that vigil fatigue doesn't gut Trust. Timing
  warnings is the game.
- **Late (Voice of the Vale+)**: multiple grand dooms overlap; Turn Fate lets you
  stagger two arrival days apart so wards can be recycled between them. Stones runs
  become planned pilgrimages.
- **Recurring tension**: divine more vs. prepare more — every facet is an action not
  spent on a ward, and makes failure cost extra (guilt).
- **Recurring tension**: warn now vs. hold it alone — Trust drain per day vs. Burden
  crush and no aid.

### Anti-strategies (and what prevents them)

- *Warn everything instantly*: vigil fatigue is per-warned-doom per-day; three open
  vigils bleed 6 Trust a day and Trust gates nothing else replacing it. Trust at the
  floor also stalls village aid.
- *Prep every building with everything*: 2 supplies per ward and supplies come from
  actions (Work); the economy caps blanket coverage well below full.
- *Never divine, just gamble wards*: legal, occasionally hilarious, but wards are
  6-ish strength against 10–22 magnitude — unguided coverage is unaffordable (see
  above), so blind play eats deaths and Trust.
- *Turtle at zero renown forever*: tolerated by design — this game permits a quiet
  life. The ladder is opt-in pressure; windfalls, gifts, and newcomers only come to
  those who climb. (No-game-over ethos: the valley is a valid home, not a win.)
- *Stones-camping*: divining requires pending visions, which arrive at dawn wherever
  you are — but wards can only be raised at buildings, and the Stones are 7+ hexes
  out. Knowledge hoarded on a hill saves no one.

## Tuning notes (halve-and-double first)

- Actions 3/day (−1 at Burden ≥ 50, −1 at ≥ 90, floor 1). MP 6/day.
- Ward strength ~N(6, 1.5) for 2 supplies; Work yields ~N(4, 1) supplies.
- Magnitude mean by rank: 10 / 12 / 15 / 18 / 22, sd 20%; damage rolls N(mag, 0.25·mag).
- Outcomes: net ≤ 0 averted · < 7 scarred · ≥ 7 ruined · ≥ 10 kills the victim.
- Vision arrival: 40%/dawn under the rank's pending cap (2/3/3/4/5), lands 3–12 days out.
- Renown: averted+warned +20 · averted quiet +8 · landed+warned +6 · death of the
  goat +2 (the ballad of Barnabas).
