# PowerRange — Game Dynamics

This is the design journal: it answers *why PowerRange is fun* before it says what the
rules are. PowerRange looks like a war game between warring city-states. It is actually an
**economics simulation** wearing a war game's clothes. Every shell fired, every shield
raised, every machine left idle is a line item. You do not win battles; you win balance
sheets — and the battles are how the balance sheet gets settled.

---

## 1. Theme

**The cold arithmetic of dominance — and the underdog gambit that breaks it.**

Warfare has ossified into an arms race of enormous cannon platforms. Whoever fields more
*power* over more *range* simply wins the open field. The feeling the game chases is the
dread of being out-ranged and out-gunned by a machine you cannot afford to answer in
kind — and then the thrill of the **shield knight**: a cheap, man-mobile armored unit
that walks *into* the wall of fire under a regenerating shield, reaches the million-credit
platform, and switches it off for the price of a rounding error.

The emotional core is the tension between **investment and exposure**. Power and range cost
money; money comes from territory; territory must be physically held; holding it means
standing inside someone's kill envelope. Overcommit to firepower and you go bankrupt
defending nothing. Overcommit to economy and you get shelled off your own gold. The fun is
that the arithmetic is *visible* — you can always see why you lost, and you can always see
the cheaper line you should have drawn.

---

## 2. Key Drivers

Three load-bearing drivers; every mechanic weaves into one of them.

- **Scarcity of Agency** — there is one shared currency (the Treasury) and it is never
  enough. Power, range, shields, mobility, ammunition, and upkeep all draw from the same
  pool. Every coin spent on one dimension is a coin denied to the others. The core decision
  every turn is *what not to fund.*
- **Accumulation & Windfall** — territory → income → platforms → more territory is a
  compounding engine. The windfall is the shield-knight arbitrage: a small investment
  cracks an asset worth ten times its cost, swinging the economic curve in a single move.
- **Readable Consequences** — combat is a clean threshold (`power − shield`) inside a
  visible range ring along a visible firing lane. The player can always trace a dead unit or
  a starved treasury back to the decision that caused it.

Supporting: *Escalating Commitment* (to deny enemy income you must push slow platforms
forward into their envelope), *Loss Aversion* (your platforms are expensive — losing one
captured is worse than never building it), *Comedy* (incendiary fires and shield-knight
sabotage produce absurd reversals).

---

## 3. The Core Loop

```
control territory ─► income ─► build/fire/maintain (spend) ─► project force ─►
       ▲                                                            │
       └──────────────── hold more territory ◄──────────────────────┘
```

Firepower is the **stick** (it denies the enemy income); occupation is the **carrot** (only
bodies on the ground *earn*). Shield knights are how you safely put bodies on contested
ground. Bankrupt the enemy or take their Foundry and you win.

---

## 4. The Two Dimensions (and the two that modulate them)

Every combat unit is a point in a priced design space. **Power** and **Range** are the axes
the theme names; **Shield** and **Mobility** modulate them. Each costs credits at build time.

| Dimension | What it buys | Economic character |
|---|---|---|
| **Power (P)** | Damage per shot / ability to overcome shields | Linear cost; the brute-force lever |
| **Range (R)** | Hex radius the unit can fire into | **Super-linear cost** — range is area, and area is expensive |
| **Shield (S)** | Damage absorbed before HP is touched | Per-type; cheap physical vs expensive energy (see §5) |
| **Mobility (M)** | Movement points per turn | Platforms are slow by default; speed is a premium |

*Driver: Scarcity of Agency.* A fixed build budget cannot max all four. Range is priced
super-linearly on purpose — a "snipe everything" build is mechanically possible but
bankrupts you and arrives at long range with power too low to crack a shield (see
anti-strategies, §13).

---

## 5. Damage & Shield Matchup

Four cannon damage types, two shield types. The matchup is **data, not special cases**: a
lookup table maps `(damageType, shieldType) → effectiveness multiplier` on the defender's
shield pool. This is the economic engine that punishes a monoculture army — one shield type
is cheap but exploitable; covering both costs real money.

| Damage \ Shield | Physical (ablative) | Energy (deflector) | Economic role of the damage type |
|---|---|---|---|
| **Kinetic** (railgun) | ✗ shield strong (×1.5) | ✓ shield weak (×0.5) | Highest power-per-credit; cheap brute force |
| **Laser** | ✓ weak (×0.5) | ✗ strong (×1.5) | Long range, cheap-per-shot, low power; the denial sniper |
| **Plasma** | ✓ weak (×0.5) | △ normal (×1.0) | High power, high cost; the heavy-shield breaker |
| **Incendiary** | ignores shield | ignores shield | Low unit damage; sets terrain **on fire** → income denial |

- **Physical shield (ablative armor):** cheap to build; **depletes** as it absorbs and must
  be repaired at the Foundry (a recurring cost). Strong vs kinetic, weak vs laser/plasma.
- **Energy shield (deflector):** expensive to build; **regenerates free** to full each turn.
  Strong vs laser/plasma, weak vs kinetic. Ignored entirely by incendiary.

*Driver: Readable Consequences + Scarcity of Agency.* The player sees the multiplier in the
fire-preview overlay and learns the rock-paper-scissors by playing, not by reading. The
matchup forces diversification spending: no single cheap loadout is safe against everything.

---

## 6. Units — Two Templates, Not Twenty Snowflakes

All combat content is a parameter set over **two templates** plus the special Foundry. (See
the *Template, don't snowflake* principle.)

### Template A — **Platform**
Heavy weapon on a chassis. Parameters: `power, range, mp(low), damageType, shieldType,
shield, hp, buildCost, upkeep, ammoCost`. The four "cannon archetypes" are just four
parameter sets:

- **Railgun** — kinetic, high P, medium R, cheap/shot, physical shield. Cost-efficient line.
- **Laser** — laser, low P, **high R**, cheap/shot, energy shield. Ranged denial.
- **Plasma siege** — plasma, **high P**, medium R, expensive/shot, energy shield. Cracks heavy armor.
- **Incendiary** — incendiary, low P, medium R, sets fire. Economic-warfare / zoning.

Platforms move M = 2 (enough to reposition the firing line); "mobile artillery" is the same
template with M bought up further at premium cost.

### The siege action (Engineer & Knight)
A **siege** unit adjacent to an enemy platform/Foundry can **Disable** it (immediate —
offline this turn) and, if still adjacent and the target is *unescorted* through the enemy's
next turn, **Capture** it (it switches sides). Capture is the windfall — intentionally rare
(see escort rule, §8). Two units carry this one capability at opposite ends of the price
ladder, divided by one rule: **only the Knight can board a target whose shields are still
up.** The Engineer must wait until the target's shield has been beaten down to zero by fire
before it can disable it — so the cheap saboteur only finishes what the cannons started.

- **Template B — Engineer.** Cheap, fast, **no shield**, tiny `hp`. The disposable saboteur
  that does the disable/capture grunt work — but only against a target whose shield is already
  down, and it dies on the approach to any defended target, so it needs cover, a clear lane,
  or an escort to arrive alive. Generates no income.
  **Fortify:** an Engineer that spends a whole turn idle (full MP, no action) digs in as a
  **Field Shield** — a strong, all-absorbing, self-refreshing shield. It keeps **1 MP**: enough
  to tear the shield back down and crawl one hex, which reverts it to a plain Engineer. A cheap
  unit that overstays becomes a defensive emplacement (and a stout escort, since adjacency still
  screens platforms from siege) — but it can pull up stakes and relocate when the line shifts.
  *Serves: terrain-as-language, loss aversion — idle units aren't wasted, they harden the line.*
- **Template C — Shield Knight.** The elite commando and **most expensive unit on the board**.
  Same siege capability, but its **phase shield** — an energy-type pool absorbing *all* damage
  types, refreshing fully each turn — lets it *survive* the walk through the kill zone that
  kills an Engineer. You pay top price for survivability, not for the sabotage itself. Small
  pool: two platforms firing the same turn still deplete it and drop the knight (focus-fire
  counter).

*Driver: Accumulation & Windfall + Roles Through Mechanical Exceptions + Scarcity of Agency.*
Splitting the role makes the price ladder a real decision: spend 6 on a saboteur that might
not make it, or 75 on one that will. Both break the same two core rules — neutralize an asset
by proximity, and (the knight) ignore damage type — which is the arbitrage the theme promises.

### The **Foundry** (landmark)
Immobile, one per city-state. Generates base income, builds new units within a small radius,
and repairs ablative shields. It is the home base — losing it loses the game. *Driver:
Guardianship + Landmarks as Anchors.*

---

## 7. The Economy — "It Works at Every Level"

One currency, the **Treasury**, touched at three scales every turn:

- **Macro — Income.** Each controlled resource hex (gold = credits, quarry = build discount)
  adds to income. A hex is *controlled* if you have a **ground-holding** unit on or adjacent to
  it and the enemy does not. Shield Knights are aristocrats — too aloof to garrison ground — so
  a knight beside a gold or quarry hex claims nothing; only platforms, engineers, and the Foundry
  hold territory. Hexes **on fire** or **suppressed** (shelled this turn) pay nothing. *Stick vs
  carrot: you can deny income by shelling, but only earn it by standing there.*
- **Meso — Build & Upkeep.** Units are bought at the Foundry by allocating credits across
  the priced dimensions (§4). Every unit charges **upkeep** each turn — a fraction of its
  build cost. An idle plasma siege bleeds you; you must *use* expensive assets or disband
  them. This is the anti-turtle pressure, baked into the system, not bolted on.
- **Micro — Ammunition.** Every shot costs `ammoCost = ceil(power × rangeFired / 10)` — a
  tenth of the brute figure, rounded up, so ammo is a real but never debilitating drain. Firing the
  super-cannon is itself an economic decision; you cannot spam it. Lasers (energy, cheap/shot)
  and railguns (cheap rounds) are the sustainable workhorses; plasma is a costed-out finisher.

*Driver: Scarcity of Agency.* Every level of the game is the same question — is this credit
better spent here or somewhere else?

---

## 8. Combat Resolution (code-checkable)

```
fire(attacker, targetHex):
    if attacker.mpLeft != attacker.mp:                  return   # must not have moved — stop to fire
    if hexDist(attacker, targetHex) > attacker.range:   return   # range gate (visible ring)
    if not lineOfSight(attacker, targetHex):            return   # LOS gate (mtn/forest block)
    cost = attacker.power * hexDist(attacker, targetHex)
    if treasury[attacker.owner] < cost:                 return   # economic gate
    treasury[attacker.owner] -= cost
    mult   = MATCHUP[attacker.damageType][target.shieldType]     # data table, §5
    absorb = min(target.shieldLeft * mult, attacker.power)
    target.shieldLeft = max(0, target.shieldLeft - attacker.power / mult)
    dmg = max(0, attacker.power - absorb)                        # threshold — readable
    if attacker.damageType == INCENDIARY: setOnFire(targetHex)   # denial instead of armor
    target.hp -= dmg
    attacker.hasFired = true                                     # one shot per unit per turn
    attacker.mpLeft = 0                                          # firing ends the turn
```

**Move OR shoot, never both.** These are big, lumbering platforms — the only things that
survive the battlefield — and they must *stop, charge, and fire* or *keep rolling*. A unit
that has moved at all this turn cannot fire; a unit that fires forfeits its movement. (Siege
is exempt — knights and engineers still move-then-pry; that's their role.)

Knight gambit:

```
siege(knight, platform):                # knight adjacent, costs the knight's action
    if isEscorted(platform): return     # a friendly defender adjacent screens it — no siege
    if platform.capturingBy == knight.owner:
        platform.owner = knight.owner    # CAPTURE — the windfall
    else:
        platform.disabled = true         # DISABLE — no fire, earns no income; mark for capture
        platform.capturingBy = knight.owner

isEscorted(platform):                    # any same-faction unit adjacent repels boarders
    return exists u != platform: u.owner == platform.owner and dist(u, platform) == 1
```

**Escort counterplay.** A platform or Foundry with any friendly unit adjacent cannot be
disabled *or* captured — the escort fends off the knight. To crack an escorted machine the
attacker must first kill or drive off its escorts (with platforms — knights can't break the
phase shield). This is the intended answer to a shield-knight zerg: screen your expensive
assets. *Serves: guardianship, loss aversion, scarcity of agency (escorts cost upkeep).*

Both fit in a handful of lines; both are pure functions of state.

---

## 9. Terrain as Language

Terrain is the level design — it sets where money lives and where fire can reach.

| Terrain | Economic / tactical meaning |
|---|---|
| **Gold** | Income hex (credits/turn while controlled) — the thing worth fighting over |
| **Quarry** | Build-discount hex while controlled — cheaper platforms nearby |
| **Hills** | High ground: **+1 range and +1 LOS** to a unit standing on it — a *free* range upgrade, so hills are contested |
| **Forest** | Cover: blocks line of fire and reduces incoming power (−P to shots passing through) |
| **Mountain** | Impassable; **blocks line of sight** — creates dead zones and firing lanes |
| **Water** | Impassable; open to fire — no cover, a killing field |
| **Plains** | Open ground, MP 1, fully exposed |

*Driver: Readable Consequences + Terrain as Language.* The map *is* the strategy: gold says
"fight here," mountains draw the firing lanes, forests are the corridors shield knights use
to close distance under cover.

---

## 10. Turn Structure

1. **Income** — Treasury += controlled resource hexes (skip on-fire / suppressed). Energy
   shields and knight phase shields refresh to full.
2. **Upkeep** — Treasury −= Σ unit upkeep. If Treasury < 0, force-disband units (most
   expensive first) and increment `bankruptTurns`.
3. **Build** — spend Treasury at the Foundry; repair ablative shields.
4. **Action** — move (MP) and fire (one shot/unit, costs ammo); knights disable/capture.
5. **Fire spread** — on-fire hexes burn down a counter, may spread to adjacent flammable
   terrain, then expire.
6. **Enemy city-state** repeats 1–5 (AI faction; mirror rules, heuristic play).

---

## 11. Victory & Defeat

- **Win:** capture the enemy **Foundry** (occupy / hold it) **OR** enemy economic
  **collapse** — `bankruptTurns ≥ 3` with no remaining combat units.
- **Lose:** the mirror of either, applied to you.

Both victory routes are economic. You can break them at the front (capture) or break their
bank (collapse) — and the bank route runs *through* denying their gold and forcing upkeep.

---

## 12. State Model (must fit in a struct)

```javascript
// Faction
{ owner, treasury, income, foundryHex, bankruptTurns }

// Unit (Platform | Knight; Foundry is an immobile Platform variant)
{ q, r, owner, kind,
  power, range, mp, mpLeft,
  damageType,                 // KINETIC | LASER | PLASMA | INCENDIARY | NONE
  shieldType,                 // PHYSICAL | ENERGY | PHASE | NONE
  shield, shieldLeft,         // absorb pool; refresh rule depends on shieldType
  hp, hpMax,
  buildCost, upkeep, ammoCost,
  hasFired, disabled, disabledSince, capturedBy }

// Hex (extends the baseline shape)
{ q, r, col, row, elevation, isEdge, terrain,
  resource,                   // 0 | credits/turn (gold) | discount (quarry)
  controlledBy,               // owner | null
  onFire,                     // 0 | turns remaining
  suppressed }                // shelled this turn → earns nothing
```

If a mechanic needs a field not listed here, the mechanic isn't finished.

---

## 13. Strategies

### Early game
- **Land grab.** Push cheap, mobile units onto gold/quarry to start the income engine.
  Skip expensive platforms — you can't afford upkeep yet.
- **Seize the hills.** High ground is a free +1 range/LOS; controlling it makes every cannon
  you later build cheaper-per-effect. Contested early because it's *free* power.

### Mid game
- **Build the line.** Railguns (cost-efficient) hold the income border; one laser for reach.
  Read the enemy shield mix and bias your damage types against it (the matchup table is the
  whole mid-game read).
- **Forest infiltration.** Send shield knights through forest cover toward the enemy's most
  expensive platform. Cover means fewer shots land before they close.

### Late game
- **Crack and capture.** A knight wave (numbers beat focus-fire) disables then captures the
  enemy plasma siege — your economy lurches ahead by the value of their lost asset.
- **Burn the gold.** Incendiary platforms torch the enemy's income hexes to force upkeep
  bankruptcy, then walk into the undefended Foundry. The collapse win.

### Recurring tensions (every game)
- **Power vs Range** — same budget; brute force up close or thin denial at distance.
- **Specialize vs Diversify** — a monoculture is cheap but the matchup table punishes it.
- **Project vs Hold** — pushing platforms forward denies enemy income but exposes them to
  knights; staying back keeps them safe but cedes the map.
- **Spend vs Save** — fire the plasma now (ammo cost) or bank credits for a knight wave.

### Anti-strategies and the mechanic that prevents each
- **Turtle behind max energy shields.** *Prevented by:* upkeep drain + income requires
  *occupying* gold, not sitting on it. A turtle out-economies itself into collapse; energy
  shields generate nothing. Incendiary can also flush a static position by burning its hex.
- **One giant super-cannon.** *Prevented by:* super-linear range cost + per-shot ammo + it's
  a single shield type (knight/matchup bait) + if captured you lose the entire investment.
  Loss aversion makes the all-eggs build feel as bad as it plays.
- **Shield-knight zerg.** *Prevented by:* knights earn no income (spamming starves you) and
  the phase shield only absorbs one platform's shot per turn — two platforms focus-firing
  kill a knight before it closes, so knights need cover or numbers, both of which cost.
- **Pure artillery snipe-fest.** *Prevented by:* shelling *suppresses* income but cannot
  *earn* it — only bodies on resource hexes earn. Artillery can deny forever and still lose
  on the balance sheet. To win you must advance into harm's way.

*Strategy review note:* every anti-strategy above names a concrete rule (upkeep, super-linear
range price, no-income knights, one-shot phase shield, occupy-to-earn) — none rely on "it'd
be boring." Every key mechanic appears in at least one live strategy; no dead mechanics.

---

## 14. First-Pass Tuning (halve-and-double later)

Starting numbers, to be felt out in play — large swings before fine numbers.

- Map: 40×26. Resource density ~2% gold, ~1% quarry — gold is scarcer and far more valuable,
  so each gold hex is a real prize worth contesting. Two Foundries at opposite ends.
- Starting Treasury: 120. Foundry base income: 6/turn. Gold hex: 12/turn. Quarry: build
  discount (10%/quarry, cap 30%).
- Railgun: P6 R3 M2 cost 30 upkeep 3 ammo P×dist. Laser: P3 R6 M2 cost 35 upkeep 3.
  Plasma: P10 R3 M2 cost 60 upkeep 6. Incendiary: P2 R3 M2 cost 25 upkeep 2.
- Engineer: P1 R1 M4 hp 3 no shield, cost 6 upkeep 1 (cheap saboteur, can siege).
- Shield knight: P2 R1 M5 hp 6 phase-shield 8 cost 75 upkeep 7 (priciest unit; can siege).
- Physical shield: 6 absorb, repair 1 credit/point. Energy shield: 8 absorb, free refresh.
- Bankruptcy: 3 consecutive turns of forced disband with zero units → collapse loss.

---

## 14b. Planned — Not Yet Implemented

### Bombard (new platform — indirect artillery)
Extreme-range siege piece that lobs over terrain. **Not built yet** — codebase is at the
move-OR-shoot checkpoint. Spec to implement next:

- **Stats:** kind PLATFORM, label `B`, name "Bombard". P5 R8 M2 hp8. Damage **Kinetic**
  (ballistic arc → cracks energy shields, weak vs physical — complements the Laser, which
  needs LOS and beats physical). Shield: Physical 4 (light rear armor). Cost 50, upkeep 5.
- **New mechanical exception — `indirect`: ignores line of sight.** It can fire over
  mountains/forests at any target in range. Implement as an `indirect` capability flag on the
  archetype (same dispatch pattern as `siege`/`ignites`); in `fireTargets`, skip the
  `lineOfSight` check when `unit.indirect`. Add `indirect` to *every* archetype (no defaults),
  copy it in `Unit.create`, and only Bombard sets it true.
- **Self-balancing range:** ammo cost stays `power × distance`, so a max-range (R8) shot costs
  5×8 = **40 credits** — you can't spam it from safety; creep it forward or pay through the
  nose. Move-OR-shoot still applies (it must halt to fire). Light armor + the longest range
  make it a vulnerable rear piece that knights/engineers pry and that nothing out-ranges.
- **Wiring:** add `BOMBARD` to `BUILD_MENU` (build button auto-appears) and to the AI's
  affordable-build list in `ai.js`. *Driver: Readable Consequences (range/LOS made literal) +
  Roles Through Mechanical Exceptions (indirect fire is a rule nothing else breaks).*

---

## 15. Open Questions

- ~~Is capture too slow/fast?~~ **Resolved:** capture is intentionally rare — the game's
  core is bombardment, and the escort rule (any adjacent friendly unit blocks siege) keeps
  capture a high-effort windfall. Tighten the knight, not the escort rule, if it's too common.
- Should **range** be priced super-linear at build *and* metered by ammo, or is double-taxing
  range redundant? (First pass keeps both; watch for range feeling un-fun rather than costly.)
- Does incendiary's terrain denial need a movement-block component, or is income-suppression
  + LOS-through-smoke enough zoning on its own?
- AI faction heuristics are out of scope for this pass — the rules above are written to be
  symmetric so a mirror-AI is a valid first opponent.
