# DUSTRUNNER — Game Dynamics

A long-playing, recurring hex game set in the Vesk Barrens: an alien badlands with one
starport, scattered settlements, bandit gangs, and things in the waste big enough to eat
your gravbike. This document is the design journal — *why* the game works, then the rules.

## Theme

**"Freedom is a number, and the number is huge."** You are stranded. Every trip into the
waste is a bet: how much can you carry home before something notices you? The emotional
loop is frontier hustle — greed pulling you one node farther out, dread pulling you back
toward the lights. The ticket offworld (4,000 cr) is the far shore; the gravbike is the
one thing between you and walking.

## Key Drivers

1. **Accumulation and Windfall** — the credit total only goes up by working the waste;
   camp raids, geode blooms, and predator trophies are the windfalls that patient
   positioning makes possible.
2. **Loss Aversion** — everything you're carrying can be lost: cargo drops where you die,
   half your credits with it, and the gravbike can be *eaten*. The trip home with full
   bags is the tensest part of the game.
3. **Variable Reinforcement on a Competence Backbone** — markets drift, nodes bloom,
   predators wander, gangs raid; but route choice, when to dismount, where to park, and
   when to flee are real decisions the player owns.

## Key Mechanics (one per driver)

- **Gather → haul → sell/craft** *(accumulation)*: dismount on a resource node, spend MP
  to harvest into limited cargo, sell at any market or craft permanent upgrade tiers at
  the starport workshop.
- **Mounted/dismounted split** *(loss aversion)*: mounted you have 10 MP, cross acid
  flats, and can't act; on foot you have 4 MP and can harvest/fight — and the parked bike
  is a thing in the world that a Gravemaw can swallow whole.
- **Scent, not scripts** *(variable reinforcement)*: predators chase whatever they smell
  nearest — a mounted player at radius 6–7, a walker at 3 (1 with the Dust Cloak), a
  parked bike at 4 (Gravemaw only), a bandit at 3. The board's danger is an ecology, not
  an encounter table.

## Secondary Mechanics (each named to a driver, each woven into a key mechanic)

- **Distance-richness**: nodes farther than 14 hexes from the starport carry +2 yield;
  geode blooms (the best material) only appear 16+ hexes out, in predator country.
  *(Escalating commitment — the close ring depletes, the good stuff pulls you outward.)*
  Weaves into: gather/haul.
- **Node depletion and blooms**: nodes are finite; each day new nodes may bloom elsewhere
  (geode blooms are broadcast as rumors with a compass bearing). *(Variable
  reinforcement, exploration.)* Weaves into: gather/haul.
- **Cargo makes you a target**: bandits within 3 hexes come for you; the fuller your
  bags, the more a fight costs you. *(Loss aversion — double-edged riches.)* Weaves into:
  haul.
- **Bandit raid loop with a return trip**: raiders path to a settlement, steal wealth,
  and *carry it home* — kill one on the return leg and the loot drops. Stolen wealth
  banks up in the camp, so ignored gangs make camp raids fatter. *(Windfall; NPC rivals
  need the same return trip.)* Weaves into: sell (wealth sets prices), combat.
- **Bounty tags are cargo**: dead bandits drop a tag (25 cr) that rides in your bags like
  any material — die on the way home and the bounty is in the dirt with everything else.
  *(Loss aversion — one loss rule for everything you carry.)* Weaves into: haul/sell.
- **Settlement wealth sets prices**: raids drain a settlement's wealth, which drains what
  it pays you. Defending the roads is self-interest, not charity. *(Guardianship with a
  readable economic consequence.)* Weaves into: sell.
- **Market drift**: each town/settlement has per-material demand multipliers (0.7–1.5)
  that occasionally re-roll; the starport is the stable 1.0 baseline. *(Variable
  reinforcement; routing decisions.)* Weaves into: sell.
- **Sonic fences**: predators never come within 2 hexes of a settlement or the starport.
  Safe ground is visible and spatial — ending the day at any settlement heals you.
  *(Readable consequences; landmarks as anchors.)* Weaves into: flee.
- **Predator identity**: the **Dust Howler** (fast, pack-hunter, can't cross acid) and
  the **Gravemaw** (slow, swims acid, swallows gravbikes in one hit). Which one is
  chasing you decides your escape route. *(Enemy identity; readable consequences.)*
  Weaves into: mounted/dismounted split (acid crossings), flee.
- **Predators don't discriminate**: they chase bandits too, and a bandit eaten in the
  open drops his tag for whoever wanders by. *(Shared obstacles, comedy — lure a Howler
  through a camp.)* Weaves into: scent ecology.
- **Death is a corpse run, not a game over**: at 0 HP you wake at the starport; your
  cargo and half your credits sit in a cache on the hex where you fell, waiting.
  *(Revenge as fuel; loss aversion without ending a long game.)* Weaves into: haul.
- **Late-game inversion — hunt the hunters**: predators drop trophies (100 cr) and
  chitin, and chitin is the only path to the best armor. The thing you fled for twenty
  days becomes prey. *(Revenge, escalating commitment.)* Weaves into: craft, combat.
- **Fog of exploration**: the map starts unknown; hexes within 5 of the player become
  permanently seen, and live entities render only within sight 6. Raids and geode rumors
  are broadcast; everything else you learn by going there. *(Information as currency.)*

## Rules

### Map

- 60×40 pointy-top hexes, diamond-square elevation. Edge ring is **storm wall**
  (impassable). By elevation percentile: 12% **acid flats** (bike-only), 45% **hardpan**
  (cost 1), 20% **scrub** (cost 1), 17% **broken ground** (cost 2), 6% **crag**
  (impassable).
- **Starport** at map center; 3 **towns** (8–14 hexes out), 6 **settlements** (10–20),
  4 **bandit camps** (18+), min 5 hexes apart, all foot-reachable from the starport.
  World generation retries until placement succeeds.
- Resource nodes overwrite matching base terrain (all cost 2, all foot-reachable):

| Node | On | Material | Base price | Yield | Count |
|---|---|---|---|---|---|
| Glowvine thicket | scrub | Glowvine Resin | 16 | 3–5 | 24 |
| Shard field | hardpan | Shardglass | 28 | 3–5 | 18 |
| Ore scarp | broken | Ferric Ore | 22 | 4–6 | 14 |
| Geode bloom | hardpan, 16+ out | Heartstone | 120 | 2–3 | 6 |

  Nodes 14+ hexes from the starport get +2 yield. Depleted nodes revert to base terrain.
  Each day: 25% chance a new node blooms (weighted 4/3/3/1) while under the world cap.
  Other cargo: **Bandit Tag** 50, **Predator Trophy** 200, **Chitin Plate** 80.

### Player and gravbike

- HP 5 base, attack 1 at range 1 (blasters: range 2, up to attack 4). Cargo 6 base.
- Mounted: 10 MP (engine tiers to 16), may cross acid, may not harvest or attack.
  On foot: 5 MP. Mount/dismount costs 1 MP; dismounting caps remaining MP at foot speed.
- Actions: **harvest** 2 MP (on foot, on a node — takes 2/action base, +1 per harvester
  tier), **attack** 2 MP, **raid camp** (on foot, on the camp hex, no gang member within
  4 — pays the camp's banked loot + 2 tags).
- Bike: 4 HP base. Howler hits deal 2; a Gravemaw hit swallows it whole (destroyed, no
  wreck). Predators strike the bike first while you're mounted — the bike is your armor.
  Repair 10 cr/HP at any settlement; replacement bike 400 cr at the starport.
- Death (HP ≤ 0): all cargo + half your credits drop as a cache on that hex (caches
  persist and merge; walking onto one auto-collects what fits). You wake at the starport
  at full HP. Ending a day on any settlement hex heals to full, free.

### Bandits and camps

- Camp spawns a raider (HP 3, atk 1, speed 2 MP) at 8%/day while it has fewer than 3
  alive. Raider AI: player within 3 → chase/attack; carrying loot → walk it home and bank
  it; otherwise → walk to its target settlement and steal 15 wealth. Killing a raider
  pays a tag; killing a loot-carrier also drops the stolen credits.
- Camps bank 50 cr + everything their raiders deliver; each razed camp makes future
  camps richer (+25 base). New camps: 2%/day up to 5, founded 18+ hexes out, broadcast
  as a rumor.
- Settlements: wealth starts 100 (max 120, +1/day regen). Sell price =
  base × demand × (0.5 + wealth/200). Starport pays flat 1.0 demand at wealth 100.

### Predators

| | HP | Atk | Chase MP | Crosses acid | Eats bikes |
|---|---|---|---|---|---|
| Dust Howler | 8 | 2 | 4 | no | no (2 dmg) |
| Gravemaw | 16 | 4 | 2 | yes | **whole** |

- 5 at start (12+ hexes out), 3%/day spawn to a cap of 9 (18+ out, 30% Gravemaw).
- Each day a predator chases the nearest scented target (player, parked bike, bandit)
  with full A* pathfinding, else wanders. Kills on bandits drop their tag as a cache.
- Drops: Howler — 1 trophy + 1 chitin. Gravemaw — 2 + 2.

### Economy and victory

- Start: 40 cr, bare hands, stock gravbike.
- Workshop (starport only) — tiers require the previous tier:

| Upgrade | Effect | Cost |
|---|---|---|
| Engine I/II/III | +2 bike MP each | 150+3 ore / 400+6 ore / 900+10 ore |
| Cargo Rack I/II/III | +3/+3/+4 cargo | 120+3 resin / 300+4 shard / 700+2 heartstone |
| Hull Plating I/II | +2/+3 bike HP | 150+4 ore / 400+6 ore+1 chitin |
| Blaster I/II/III | +1 atk each; I sets range 2 | 200+4 shard / 500+8 shard / 1000+2 heartstone |
| Padded Duster → Chitin Carapace | +2 / +3 max HP | 150+4 resin / 600+2 chitin |
| Sonic Harvester I/II | +1 harvest each | 180+3 ore / 450+6 shard |
| Dust Cloak | foot scent 3 → 1 | 250+6 resin |

- **Victory**: the offworld ticket, 4,000 cr at the starport. Buying it plays the
  epilogue — and you may keep playing the world afterward. The game autosaves every day
  and action (localStorage); one persistent world per browser until you start a new one.

### Turn (one day)

1. **Player phase** — spend MP on moves/actions; entering a location opens its panel
   (market actions are free).
2. **World phase** — bandits act, predators act, spawns/blooms/market drift/wealth
   regen, day advances, heal-if-at-settlement, autosave.

## Strategies

- **Early (days 1–15)**: work resin/shard in the 8–12 ring, sell into high-demand towns,
  buy Cargo Rack I and Blaster I. Park at settlements, walk to nodes.
- **Mid**: bounty routes — patrol the settlement ring, kill raiders on the return leg
  for tag + loot, keep wealth (your prices) high. Push to ore scarps; Engine and Plating
  buy escape margin from Howlers.
- **Late**: geode runs 16+ out with the Dust Cloak (harvest at scent 1 while a Howler
  wanders 2 hexes away); raze fattened camps; hunt Howlers, then Gravemaws with Blaster
  III + Carapace, for trophies and the last thousand credits.
- **Recurring tensions**: one more node vs. full bags in predator country · park close
  (bike at risk) vs. park far (long walk out) · sell here at a weak market vs. ride to
  demand while the world takes another turn · bounty income now vs. node income farther
  out · raze the camp now vs. let the bank fatten.
- **Anti-strategies checked**:
  - *Turtle-farm the starport ring* — depletion + distance-richness + blooms landing
    anywhere thin the close ring out; income there decays.
  - *Arbitrage loops* — markets only buy; the player only buys upgrades/repairs/bike/
    ticket. No buy-low-sell-high loop exists.
  - *Kite predators into towns* — fences stop them 2 hexes out; kiting into bandit
    camps, however, is intended fun.
  - *Farm tags forever* — spawn caps (3/camp, 8%/day) bound the income rate; it's a
    valid playstyle, not an exploit.
  - *Never engage bandits* — settlement wealth (your sell prices) drains and camps bank
    what you didn't stop; the economy pushes back.

## Tuning notes

First guesses were halved-and-doubled against the headless harnesses (`test/sim.js` for
invariants, `test/econbot.js` for pacing). Applied so far: base harvest 1 → 2, foot MP
4 → 5, all material prices ×2, bloom rate 0.08 → 0.25/day. Measured: a greedy bot that
never recovers its death-caches buys the ticket around **day 93–115** when it avoids
dying; a human who corpse-runs, times markets, and works bounties should land near
day 60–90 — the intended long-game pace. Watch in playtests: if the close ring never
empties, lower the bloom rate; if Gravemaws never matter, raise their scent-bike radius;
if deaths feel cheap, predators need more patience, not more damage.

## Deferred

- Per-settlement reputation and defense contracts (defending pays a stipend).
- Rumor board (see other markets' demand for a fee) — information as currency, phase 2.
- Enemy-phase hop animation (currently instant moves + message log).
- Weather/storm days that change scent radii.
- Named wandering trader NPC.
