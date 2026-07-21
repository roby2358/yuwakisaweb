# LAURELS — Dynamics

*Rest on them and be forgotten.*

## Theme

**The hunger of glory.** You are a hero whose legend must be fed. Renown melts
every dawn — the bards move on, the small folk forget — and the only fuel is
deeds: hauls dragged home through hostile country, and great names struck from
the world. The feeling is restless appetite: you are never done, never safe at
the top, always one raid short of the rank you deserve. The game never ends and
never kills you for good; what it takes from you is *standing*.

The three verbs the player lives in: **acquisition** (strip the land, fill the
pack, carry it home), **prestige** (a decaying ladder of titles that must be
re-earned forever), **destruction** (named dooms and even friendly holdings can
be brought down for windfalls — and the world answers).

## Key Drivers

1. **Accumulation and Windfall** — spoils, wealth, skill levels, and monuments
   all compound; toppling a named doom is the earned explosion.
2. **Escalating Commitment** — renown decay plus a world whose hostility scales
   with everything you've taken and razed. There is no turtling; the ladder
   sinks beneath you.
3. **Loss Aversion on a carry economy** — nothing counts until it's home.
   A full pack deep in the dread is worth nothing yet and everything soon.

## Key Mechanics (one per driver)

1. **Harvest and carry** *(Accumulation)* — hexes bear nodes (forage, ore,
   relics); harvesting rolls a gaussian yield into your pack, and the richest
   nodes lie in the most hostile rings — acquisition and danger are the same
   direction.
2. **The dawn tax** *(Escalating Commitment)* — every dawn renown falls by a
   tenth (small fame lingers: no decay at 10 or below); rank follows renown
   with hysteresis (a title is won at its threshold, held down to 80% of it —
   grace, then the fall), so titles are held, not owned, and never flap.
3. **Banking** *(Loss Aversion)* — spoils convert to wealth and renown only at
   your Hall or a holding; falling in the field scatters half your pack and
   bruises your renown, and you wake at the Hall.

## Secondary Mechanics (each woven into a key one)

- **The thriving skills** *(Accumulation)* — nine use-based skills (Gathering,
  Delving, Hunting, Combat, Warding, Crafting, Trading, Building, Presence),
  one uniform template: doing the verb earns xp equal to the magnitude done;
  each level is a flat/percent bump applied by derived-stat getters. Levels are
  uncapped; the curve is polynomial. This is the quiet compounding under the
  loud renown swings.
- **Ranks and privileges** *(dawn tax)* — eight titles (Unsung → Mythic) at
  renown thresholds; each grants one cumulative privilege from a template
  table (more carry, tithes, foes faltering, lesser foes fleeing, louder
  monuments, heavier strikes, louder deeds). Rank can *fall* — the log mourns
  it — which converts decay from bookkeeping into dread.
- **The six works** *(dawn tax + Loss Aversion)* — you may raise each monument
  form once (Cairn → Standing Stone → Obelisk → Statue → Triumphal Arch →
  Colossus); each sings a fixed renown per dawn — the only passive answer to
  decay, deliberately outside the deed multipliers, so a full set of defended
  works floors you near Exalted and no further (sim-verified; the last ranks
  demand deeds). Building discounts their cost. Double-edged gold: monuments
  draw the Reckoning's champions, so your fame-engine is also a siege target
  you will mourn, rebuild, and avenge.
- **Dooms** *(Windfall + Escalating Commitment)* — named hostile anchors
  (procedurally named, epitheted) that spawn raiders and fester if ignored.
  Destroying one pays a fat relic windfall and a renown spike — and raises the
  **Reckoning**, the world's answer: after a doomrise countdown, more and
  stronger dooms rise (capped at eight alive — the world escalates, it doesn't
  silt up). Destruction is self-balancing; the crescendo is player-triggered.
- **Sacking** *(Windfall, dark mirror)* — a holding can be sacked for a huge
  haul and a renown spike (the bards sing of anything big), but you lose a
  bank, a rest stop, a tithe payer, and the Reckoning jumps. Intended as a
  viable warlord line, not a dominant one, because it burns infrastructure.
- **Foe ecology** *(Escalating Commitment)* — beasts spawn by ring, raiders
  spawn from dooms, everything is probabilistic (spawn, wander, chase, decay,
  hesitate), and speed is rolled per foe so any spawn might be the fast one.
  Raiders far from both their doom and the hero slink home — sieges stay local
  and readable, not a slow global grind. Champions are named, announce their
  ride, target your monuments and holdings via a flow field (global vision, no
  horizon problem), and are sated by a single razing — the revenge window is
  the march, and the intercept is a real, winnable play (sim-verified).
- **Holdings fight back** *(Guardianship)* — the small folk man their walls
  for modest damage each dawn, so a lone raider can't take a holding; packs
  and champions can. Losses are events with named causes, not attrition.
- **Everything rolls, costs never roll** — every payout (yield, damage, spoils,
  sale) is a gaussian around its rule value; every price (MP, wealth costs) is
  fixed. You always know what an action costs, never exactly what it pays.

## Gut checks

- Fame fading unless fed: proverbial — reads instantly.
- Rich loot in deadly land: universal.
- Loot only counts at home: every heist story ever.
- Your own monuments drawing attackers: "defiance draws the eye" — intuitive
  once seen; the UI says so on the Build button.
- Sacking a town making the world hate you: yes.

## Strategies

- **The Harvester** (early): work coppices and hills in the hearthlands and
  marches, bank often, level Gathering/Delving/Trading, climb to Known for
  tithes. Tension: hearth yields are too thin to outrun decay past ~Honored.
- **The Deep Raider** (mid): push into wilds/dread with a big pack, harvest
  relics, kill for spoils, bank in one heavy run. Tension: pack value vs.
  distance home vs. hp — the carry economy's whole point.
- **The Doomslayer** (mid/late): hunt dooms for windfalls and rank spikes;
  accept the Reckoning's escalation as the price of glory. Tension: every kill
  makes the next doomrise worse — escalating commitment made literal.
- **The Builder** (late): convert wealth into monuments to hold a renown floor
  against decay; defend them when champions come. Tension: each monument costs
  more and paints a bigger target.
- **The Warlord** (any time, once): sack holdings for spike renown and plunder.
  Tension: burns banks/rest/tithes and doubles Reckoning growth — a peak, not
  a plateau.

**Anti-strategies (and their mechanical prevention):**
- *Turtle at the Hall forever* — decay floors renown at ~Unsung; ignored dooms
  fester and eventually send champions to your doorstep. The war visits you.
- *Monument-idle to Mythic* — only six works can stand, their income is fixed
  per form and outside the deed multipliers; equilibrium renown = 10× income,
  so a full defended set floors near Exalted and Mythic stays deed-only.
- *Treasure recursion* — crafting fuses raw spoils only; treasures are final.
  (The first sim found the exponential mint; this is its tombstone.)
- *Farm tier-1 beasts forever* — kill renown is tiered; at Famed the small
  foes flee you (a privilege that is also a faucet closing).
- *Sack everything* — each sack removes a bank/rest/tithe node permanently and
  jumps the Reckoning; the map holds few holdings. Self-limiting.

## The player never loses

Death scatters half the pack, cuts renown by 15%, and wakes you at the Hall.
The Hall itself is inviolate. The game punishes standing, never continuity —
the "one more turn" loop must never hit a full stop.
