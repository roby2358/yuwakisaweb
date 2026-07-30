# STARLANE — Dynamics Journal

*Why is this fun? Answer that before writing mechanics.*

## Theme

**The shrewd merchant's compounding bet.** You are a small-time freighter captain on a
frontier no one has finished mapping. The feeling is: *I saw the spread before anyone
else, I risked the dark lane to get there, and now the money is making money.* Tension
comes from what you're carrying — every hold full of goods is a bet that can be taxed,
stolen, or stranded. Long-term play is the slow conversion of hustle into standing:
routes memorized, names known at the dock, warehouses with your mark on them.

This is a **thriving** game, not a survival game. The dominant verb is **trading**; the
supporting verbs are **exploration**, **reputation**, and **building**.

## Key Drivers (load-bearing pillars)

1. **Accumulation & Windfall** — wealth compounds: better ship → bigger holds → bigger
   spreads → outposts that earn while you fly. Windfalls are event-driven: a famine
   rumor + a full hold of rations bought cheap = one glorious docking.
2. **Variable Reinforcement on a Competence Backbone** — prices drift, events fire,
   pirates roll — but the player chooses routes, cargo, and timing. Luck shapes the
   edges; the margin is earned.
3. **Readable Consequences** — every price has visible causes (economy type, event,
   *your own trades* moving the market). Route risk, fight odds, and scan odds are
   shown as percentages before you commit. Failure always traces to a decision.

Secondary: **Escalating Commitment** (pirate strength scales with your net worth, not
time — success invites sharks), **Low-Probability Hope** (rumors, derelict windfalls),
**Loss Aversion** (cargo already bought is the thing pirates take).

## Key Mechanics (one sentence each, one per pillar)

- **Living markets** *(Accumulation, Readable Consequences)*: each system prices each
  good as `base × economyRole × wealth × event × drift × (1 + yourTradeImpact)`, and
  your own buying/selling pushes the price against you, decaying ~15%/day.
- **Fog and intel freshness** *(Variable Reinforcement, exploration)*: markets show
  only the prices you last saw, stamped with the day you saw them — visiting, buying
  rumors, or owning an outpost are the three ways to refresh intel.
- **Route risk you can read** *(Readable Consequences)*: before departing, the game
  shows fuel cost, days, and pirate risk % (driven by route security and the value of
  your cargo — rich holds attract sharks).

## Woven Mechanics (each names its driver and the mechanic it deepens)

- **Three factions** (Merchant Guild core / Free Colonies mid / Crimson Syndicate
  fringe) — *Readable Consequences; deepens markets*. Rep raises your sell prices in
  that faction's space (+1%/10 rep), gates contract tiers, and gates outpost purchases.
- **Contracts** — *Escalating Commitment; deepens trading*. Timed deliveries paying
  above-market rates plus rep; failure costs rep. Deadlines are the anti-turtle: money
  now demands motion now.
- **Contraband (Void Spice)** — *Double-edged mechanic; deepens factions*. Cheap in
  Syndicate space, lucrative everywhere, illegal in Guild space: arrival scans can
  confiscate and burn Guild rep, while successful runs build Syndicate rep. Scanner
  upgrades and a legacy perk cut scan odds.
- **Pirate encounters** — *Escalation tied to progress; deepens loss aversion*. Strength
  scales with net worth; every encounter offers Fight / Flee / Bribe / Surrender with
  odds and costs displayed (readable, never a coin flip you couldn't price).
- **Outposts & warehouses** — *Accumulation; deepens intel + markets*. An outpost
  (rep-gated, priced by system wealth) pays daily income, streams live prices from that
  system, and unlocks an 80-unit warehouse — enabling the market-timing play: stockpile
  cheap, wait for the event, sell the spike.
- **Survey bonuses** — *Low-Probability Hope; deepens exploration*. First docking at any
  system pays a Guild survey bonus scaled by distance from home; frontier systems also
  have the widest price spreads, so the map edge is where margins live.
- **Rumors (85% accurate)** — *Variable Reinforcement; deepens intel*. Cantina rumors
  reveal an event elsewhere and chart the system; sometimes the rumor is stale — you
  paid for a maybe.
- **Legacy retirement** — *Prestige meta-loop for repeat play*. Retiring converts net
  worth to Legacy Points spent on permanent perks (starting credits, rep, drives,
  holds, charts, smuggler's nerve) that persist across every future galaxy seed; a Hall
  of Fame records each career.
- **Distress tow** — *Never let a unit feel stuck*. Stranded without fuel to reach any
  system, you can always call a Guild tow (credits if you have them, rep if you don't).

## Gut Checks

- Buying a lot of something raises its price: intuitive (you drained the market).
- Frontier = danger + margin: intuitive (risk premium).
- Wealth attracts pirates: intuitive (fat freighters get hunted) — and it's the
  anti-snowball governor.
- Contraband scans happen at *arrival* in Guild space, never mid-space: intuitive
  (customs at the dock) — and it means the player was warned before departing.

## Code Checks (each mechanic as ≤5-line pseudocode)

- Price: `round(base * eco * wealth * event * drift * (1+impact))`; trades execute
  per-unit, each unit shifting `impact ± 0.25/stockCap` (clamped ±0.5) before the
  next unit prices; daily `impact *= 0.85`. Tuned down from 0.6 after bot playtests
  showed full-hold dumps crushing consumer markets and nullifying bigger hulls.
- Drift: `m += (1-m)*0.05 + (rand-0.5)*0.06`, clamp [0.65, 1.5].
- Encounter roll: `risk = avgDanger(route) * (0.15 + min(cargoValue/20000, 0.25))`.
- Charting: any system within `24 + 6×scanner` units of a visited system is charted.
- Templates, not snowflakes: 6 event types are all `{priceMult per good, dangerDelta,
  duration}`; 5 upgrades are all `{stat, delta, basePrice}`; 6 perks are all
  `{rank, effect scalar}`.

## Strategies (design must support these)

- **Early — the milk run**: shuttle rations from an agri world to the nearest mining
  world; learn that your own trades flatten the spread, forcing a second loop or a
  third port. (Anti-ping-pong via trade impact + finite stock.)
- **Early — contract ladder**: take small deliveries for rep even at thin margins,
  because Trusted rep is what later unlocks tier-3 contracts and outposts.
- **Mid — the rumor sprint**: buy rumors, hear "plague on Chara," fill the hold with
  medicine, race the event's expiry. Windfall or fizzle — the 85% accuracy and event
  timers keep it a bet, not an ATM.
- **Mid — the spice lane**: Syndicate spice run into Colony space (legal, safe-ish) vs.
  into Guild space (scan risk, best prices). Scanner + Syndicate rep tilt the odds.
- **Late — the standing empire**: outposts in 3–4 event-prone systems, warehouses
  pre-stocked, live price feeds; the player plays the whole map's weather at once.
- **Late — retire at the peak**: legacy points are √(net worth), so grinding a dead
  galaxy has diminishing returns vs. retiring and rolling a fresh seed with perks.
- **Anti-strategy — two-port ping-pong forever**: prevented by trade impact, finite
  stock caps, and drift mean-reversion; spreads self-flatten under exploitation.
- **Anti-strategy — same-port pump (buy → your impact raises price → sell back)**:
  prevented by per-unit execution (each unit trades at the marginal price *after* the
  previous unit's impact, symmetric on both sides) plus a 10% dealer bid-ask spread
  that rep narrows but never inverts. A same-port round trip is always a ≥1% loss.
  *Found by strategy review; the naive whole-order pricing allowed +50% per click.*
- **Anti-strategy — turtle in the safe core**: prevented by thin core spreads (high
  security = low margin), contract deadlines, and survey/frontier premiums.
- **Anti-strategy — infinite pirate-free wealth**: prevented by net-worth-scaled
  encounter strength; bribes and losses scale with what you're worth.

## Tuning Notes

- Start: 500 cr, 25 cargo, ~10 cr/unit rations → first loop nets ~300–500 cr. First
  hull upgrade (Mule, 8k) ≈ 6–10 loops. Halve/double from here in playtesting.
- Pirate tier = `floor(netWorth / 25000)`, capped at 4.
- Outpost pays `wealth × 18/day` on a `5000 × wealth` price — ~19-day payback plus
  intel value, a sink that competes with ship upgrades but never dominates.
