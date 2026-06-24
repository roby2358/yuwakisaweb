# THRIVE — Game Dynamics

> Design journal for *Thrive*, a hex-and-counter survival/economy game built on the Hex &
> Counters baseline. This document answers **"why is this fun?"** before the mechanics are
> coded. It supersedes the old movement-puzzle dynamics — that was the engine test; this is
> the game. Scope is deliberately bounded to what a plain browser game can do (see §15).

---

## 1. Theme

**The desperate hustle in a place that wants you dead.**

You are a **free agent** — a loose end, an untethered spirit — marooned on **Cinder**, an alien
wasteland at the bottom of the galaxy, washed up in the lawless shantyport of **Last Ditch**
with the worst people in known space. Nobody owns you. Nobody is coming for you. The only way
out is **the Gate** — a one-way ticket off-world that costs more credits than a castaway has any
right to scrape together. So you'll scrape harder.

The feeling is not "open-world survival sandbox." It is **hope grinding against attrition**: the
ticket is always just out of reach, you can watch your escape fund tick upward, and any bad day —
a beast, a robbery, a grudge come due — can erase weeks of clawing. Every credit is dragged out of
a hostile world at real risk, and the world gets meaner *because of what you do to it*. You are
always one good score from the stars and one bad encounter from a shallow grave on a planet
nobody will remember.

---

## 2. Key Drivers (the load-bearing pillars)

The theme naturally activates three drivers. Every mechanic weaves into these.

1. **Accumulation & Windfall** — the spine. You are literally accumulating toward a price. The
   baseline is a *managed decline* (upkeep bleeds you daily); the ceiling is the rare big score —
   a fat bounty, a rare find, a market killing — that lurches you toward the Gate. The bar should
   crawl up and occasionally leap.
2. **Loss Aversion** — death and robbery *strip* you, and death is only survivable while your
   **Resbed** still has a charge. You spend the whole game protecting what you've earned: your
   fund, your gear, your charges, your skin. Progress you can lose stings more than progress you
   chase.
3. **Escalating Commitment** — you cannot turtle, and the escalation is *self-inflicted*. Every
   credit you take and everything you kill makes **enemies**; the wastes that grazed past you in
   week one hunt you by week four. Your own success turns the world hostile, crescendoing toward
   a final, dangerous push for the ticket.

Secondary drivers woven through: **Scarcity of Agency** (limited stamina/days; six income streams
you can't all run), **Variable Reinforcement** (yields, encounters, prices roll each time on a
competence backbone), **Revenge** (now two-way — you mark those who wrong you, and those you wrong
hunt you), **Readable Consequences** (everything surfaced at the moment of decision),
**Guardianship** (the Resbed is a thing you fought for and must keep alive), **Near-Miss** (ticket
price tuned just past safe reach).

---

## 3. The Core Loop

```
LAST DITCH (safe hub)            THE WASTES (turn-based danger)
 ┌─────────────────┐   set out   ┌──────────────────────────┐
 │ Gate (escape)   │ ──────────▶ │ travel · work nodes ·    │
 │ Locker (bank)   │             │ hunt · fight · prospect  │
 │ Market (trade)  │             │ (spends Stamina, makes   │
 │ Forge (craft)   │ ◀────────── │  enemies, rolls          │
 │ Infirmary (heal)│   return    │  encounters)             │
 │ Resbed (re-life)│             └──────────────────────────┘
 └─────────────────┘
        │ rest = end of day: pay UPKEEP, grudges settle
        ▼
```

**Act zero:** you wash up with nothing and no safety net — death is final until you **secure a
Resbed** (§4.4). That is the first thing you do, and it is dangerous.

Thereafter a **day** is one expedition: leave Last Ditch with stamina and rations, work the
wastes, return to bank/sell/craft/heal, then **rest** (which ends the day and settles upkeep). The
settlement is the only safe ground. Everything worth money is outside it. Every credit that counts
must survive the trip home — and everything you do out there, someone remembers.

---

## 4. Key Mechanics (one per pillar, plus the Resbed)

Each is a single sentence; the gut-check and driver follow.

### 4.1 The Ticket Fund  — *Accumulation & Windfall*
> Every credit in your **Locker** (banked) counts toward a fixed ticket price; reach it and board
> at the Gate to **win**.

*Gut check:* you're saving for passage off-world — intuitive. *Driver:* the visible bar climbing
toward escape is the whole reason to endure the grind, and the daily upkeep nibbling at it is the
attrition the windfalls have to outrun.

### 4.2 Carry vs. Bank (the Death-Strip)  — *Loss Aversion*
> Credits and gear **on your person** are lost on death and to robbery; only credits in the
> **Locker** are safe and only Locker credits count toward the ticket — so you must survive the
> trip home to make any real progress.

*Gut check:* cash in your pocket gets taken by the scum out there; cash in the Locker doesn't —
and you can't buy passage with credits a beast just ate. *Driver:* the round trip is a gauntlet
you run to lock in gains; the deeper/richer the expedition, the more there is to lose on the way
back.

### 4.3 The Enemies You Make  — *Escalating Commitment*
> A single **Notoriety** value rises with what you take and (more steeply) what you kill, and it
> flips the world's disposition toward you — the **same** fauna and scum that were benign at low
> Notoriety graze past, ignore, or trade; above their thresholds they **aggro, rob, and hunt** —
> so your own success is what makes Cinder deadly.

*Gut check:* you strip a creature's hunting grounds, gun down someone's crew, outbid the market
sharks — of course they come for you. The world isn't arbitrarily worse over time; it's worse
*because of you*, and the player feels exactly why. *Driver:* the anti-turtle engine with no
clock and no creditor — escalation is tied to **success**, not the calendar. Notoriety drives
encounter hostility, spawn weighting, and robbery odds (§7.3); it decays slowly when you lie low
and can be bought down by "making amends" — a credit sink that trades money for peace.

### 4.4 The Resbed  — *Guardianship / Loss Aversion*
> Death is permanent **until** you secure a **Resbed** (a salvaged re-embodiment cradle); once
> active at your shelter, dying **re-embodies you there minus everything you carried and one
> charge** — and charges are finite, so when they run out death is final again.

*Gut check:* on a planet at the bottom of the galaxy, the only resurrection you get is the alien
tech you scavenged and keep fed — nothing about it is free. *Driver:* this is what makes
survivable death *earned and costly* instead of a free respawn. Securing the Resbed is the
opening objective (Act zero), a landmark worth protecting (raidable at high Notoriety, §7.3), and
a charge economy you guard like everything else. It converts the loss model into: **die with a
charge → setback; die without one → game over** (§7.4).

---

## 5. The Six Income Streams

The six streams are the **verbs of play** — gathering, mining, hunting, crafting, combat,
trading. Scarcity of Agency lives here: a day's stamina only buys you a few of these, so the core
decision every morning is **which to chase and which to ignore.** They are not six silos — they
form a **value chain**, and each is **double-edged** (payoff depends on game state).

```
   RAW                 REFINED            SOLD
 ┌────────┐          ┌─────────┐       ┌────────┐
 │Scavenge│─┐        │         │       │        │
 │Mine    │─┼──────▶ │ Craft   │─────▶ │ Trade  │──▶ credits ──▶ Locker / Gate
 │Hunt    │─┘        │ (Forge) │       │(Market)│
 └────────┘          └─────────┘       └────────┘
       ▲   funds gear & ammo   │            ▲
       └─────── Bounty (combat) ────────────┘
              (protects the chain, spikes Notoriety)
```

| # | Stream | Verb | Where | Reward | The Edge (cost / risk) | Skill |
|---|--------|------|-------|--------|------------------------|-------|
| 1 | **Scavenging** | gathering | salvage fields, ruins | low, steady | quiet, low grudge, but can't outrun upkeep alone; fields **deplete** (worst near town) | Scavenging |
| 2 | **Mining** | mining | ore deposits, mountains | medium materials | **stationary & loud** — draws predators to a fixed spot; angers the things that den there | Mining |
| 3 | **Hunting** | hunting | fauna grounds | meat, hides, trophies | the game **fights back**, needs a real weapon, and **killing fauna raises their kind's grudge** | Hunting |
| 4 | **Crafting** | crafting | the Forge (hub) | multiplies raw value; makes gear/ammo/charges | consumes inputs + time; quality gated by skill | Tinkering |
| 5 | **Bounty** | combat | marked enemies (map) | high, lumpy | targets are lethal and can rob you; killing scum **spikes Notoriety hard** | Gunnery |
| 6 | **Trading** | trading | the Market (hub) | spread on price swings | needs capital; prices **fluctuate**; sharp dealing **nettles rival traders** | Bartering |

Streams 1–3 produce raw goods. Stream 4 refines them into higher-value items, gear, ammo, and
**Resbed charges**. Stream 6 converts goods to credits and arbitrages price swings. Stream 5 is
the high-variance spike — funded by gear from the chain, and it protects you (and clears the map)
while making the most enemies. A pure-raw player nets little; a player who runs the chain
multiplies it; a player who only fights drowns in grudges and repairs. **The interlock is the
game.**

### Income action — one template, parameterized
All field income (1,2,3) is the same code path:

```
work(node):
  require tool/weapon for node.type        else: unavailable (not highlighted)
  spend Stamina = baseCost[type] − skillBonus
  yield = roll(node.richness, skill.level, gear.tier)   # variable reinforcement
  add yield to inventory (or trophies)
  gainXP(skillFor[type], yield)
  node.richness −= depletion                            # nodes run dry
  Notoriety += grudgeFor[type]                          # kill ≫ mine > scavenge
  maybe spawnEncounter(weight = Notoriety + distanceFromHub)   # the edge
```

Crafting and Trading are hub menus over inventory and a fluctuating price table; Bounty is
resolved through the combat model (§8) and claimed at the hub. No snowflakes — six streams, one
income template plus two hub menus and the combat resolver.

---

## 6. Three Progressions

The brief calls for three kinds of growth. Each is a template, not a pile of special cases.

### 6.1 Income skills (one per stream) — *use-to-level*
Six skills (Scavenging, Mining, Hunting, Tinkering, Gunnery, Bartering). Doing the activity grants
XP **in that skill**; leveling improves yield / success / stamina-cost / quality and unlocks higher
tiers and recipes. One code path:

```
gainXP(skill, amount):
  skill.xp += amount
  while skill.xp >= threshold(skill.level): skill.level++   # diminishing-returns curve
```

*Driver:* Accumulation (compounding competence), and it deepens the opportunity-cost decision —
specializing makes one stream lucrative but leaves you weak in the others.

### 6.2 Weapons & Equipment — *tiered gear, four slots*
Gear is a parameter set, not a unique item. Four slots; tiers T1 (scavenged) → T2 (crafted) → T3
(bought/looted) → T4 (rare). Gear **degrades with use** (durability) → repair at the Forge (a
Tinkering use) or replace — a money sink that feeds Loss Aversion.

```
item = { kind, slot: weapon|tool|armor|utility, tier, mods:{dmg,acc,range,...}, durability }
```

- **Weapon** — melee (knife→machete→shock-maul) or ranged (slug pistol→hunting rifle→railgun).
  Ranged attacks at range and costs ammo (a craftable consumable) — see Roles, §8.
- **Tool** — pick (mining), scanner (prospecting/scavenge), cutter (salvage). Tool tier gates and
  boosts the matching stream.
- **Armor** — damage reduction, but heavier armor **costs more stamina per move** (double-edged).
- **Utility** — medkit (field heal), ration pack, beacon (cheaper return), etc.

Skill and gear are **multiplicative**: top yields need both. A great rifle in untrained hands, or a
master hunter with a knife, each underperform — so both progressions stay relevant.

### 6.3 Survival skills — *staying alive between scores*
The layer that keeps you in the game: **Toughness** (max HP), **First Aid** (heal rate / self-
heal), **Foraging** (rations from the land), **Endurance** (max Stamina). Leveled by use or by
paying to train at the hub. *Driver:* Loss Aversion — these are pure survivability, the buffer that
lets you push one node deeper and still get home.

---

## 7. Pressure Systems (the world bites back)

### 7.1 Stamina — the expedition budget  — *Scarcity of Agency*
Stamina is your per-day action/movement pool (it replaces raw MP). Moving, working, and fighting
drain it; it does **not** refill in the field except by **resting** (consumes rations) or eating.
Low stamina → you must turn back or risk HP. This makes every expedition self-limiting: you
genuinely cannot do everything before you must run for home.

### 7.2 Rations & Upkeep — the cost of living
- **Rations** (field) are carried and consumed by resting/eating; out of rations → stamina can't
  recover and **HP drains**. Foraging skill lets you live off the land. One field consumable
  instead of separate food/water/fuel (Simplify Until It Hurts).
- **Upkeep** (hub) is the daily settle-up when you rest at Last Ditch — a bunk, clean air, water —
  paid from your funds (carried first, then the Locker; in town all your money spends freely). It
  is the **steady attrition** the ticket fund must outrun: roughly flat, so a pure-quiet grind
  *almost* keeps pace but never quite pulls ahead (Near-Miss). Run completely broke with upkeep
  due and you're **stranded** (§7.4).

### 7.3 Notoriety (the grudges you earn)  — *Escalating Commitment / Revenge*
A single value, the heart of the escalation pillar (§4.3). It rises with what you take and far more
with what you kill, and it changes the world's **disposition** toward you:

```
disposition(enemy) =
  Notoriety >= enemy.hostileThreshold ? HOSTILE          # aggro, hunt, rob
  Notoriety >= enemy.waryThreshold    ? WARY             # avoids, won't trade, flees
                                      : BENIGN           # grazes / ignores / trades
```

So the same counter on the map *becomes* a threat as you climb — readable, never arbitrary. High
Notoriety also raises spawn weighting, aggro range, robbery odds, and (late) the chance scum
**raid your Resbed** while you're away. It is a *managed* resource, not a doom clock:

- **Lie low** — quiet days (scavenge/forage only, no kills) let it **decay slowly**.
- **Make amends** — pay down a faction's grudge at the Market (a credit sink: trade money for
  peace — a real double-edged decision against banking toward the ticket).

(Notoriety replaces the earlier separate Heat + planet-pressure: one number, the player's own
footprint, doing all the escalation work.)

### 7.4 Death is an event, not a state check  — *Readable Consequences / Revenge*
HP reaching 0 **in the field** resolves during the enemy/ecology phase — you go down, on screen,
killed by a specific enemy one hex away. Then the Resbed (§4.4) decides what death means:

```
on death:
  drop everything carried (credits + droppable gear) at the death hex
  if resbed.secured and resbed.charges > 0:
    resbed.charges -= 1
    re-embody at the resbed (hub), HP restored, inventory empty   # survivable setback
  else:
    GAME OVER (permadeath)
```

The other game-over is being **stranded** — no funds left to cover upkeep, so you can't survive
Cinder's next night. The killer **keeps your dropped loot and becomes a marked bounty** (§8) —
grief converted into a target you can reach. This keeps stakes high (Act zero is true permadeath;
charges are finite) while preserving the recovery-and-revenge arc.

---

## 8. Combat & Enemies

Combat serves Hunting (3), Bounty (5), and self-defense. Kept simple and readable; it reuses the
baseline's inert combat extension points (`computeAttackable`, etc.).

- **Resolution:** an adjacent attack rolls `weapon.dmg + skill` vs `target.hp` reduced by its
  toughness; defender retaliates if it survives and is armed. Readable, one resolver.
- **Roles through exceptions:** *ranged* weapons attack at range and **don't take the target's
  hex** — safe damage, costs ammo, can't body-block a node; *melee* is cheap and ammo-free but you
  must close, exposing you. (Mirrors the baseline's "ranged unit can't seal a hex.")
- **Disposition over scripting** — enemies aren't fixed threats; the §7.3 disposition decides each
  one's behavior this turn, then simple probabilistic rules (spawn, wander, aggro, flee, hesitate)
  weighted by **Notoriety + distance from hub** play it out. Same board, different weather every
  run, and the shift from benign to hostile is something the player *causes*.
- **Variable speed creates dread** — roll each enemy's speed at spawn (slow / fast / very fast). A
  swarm where any one might be the fast one means counting hexes never feels safe.

### Enemy kinds
```
enemy = { q, r, kind: fauna|scum, faction, hp, speed, marked(bounty?), carried(loot),
          waryThreshold, hostileThreshold }
```
- **Fauna** — alien wildlife. Benign grazers (huntable income) that turn predatory toward you as
  you thin their grounds (their *kind's* grudge is the Notoriety they read against).
- **Scum** — rival castaways. Benign/tradeable when unknown; once your Notoriety crosses their
  threshold they **rob** you on a downing (take carried credits/gear and flee) and some post as
  **bounty** targets. Rivals obey the same movement/terrain rules you do, only know what's been
  **revealed** (info limit), and **commit** to a target rather than omnisciently switching — so you
  can outmaneuver, not just outrun, them.
- **Named grudge-holders (later slice):** a specific scum you robbed or outbid becomes a persistent
  antagonist who hunts you across days — the mirror of your own revenge bounties (Enemy Identity).

### Emergent stories (Shared Obstacles)
Threats don't discriminate: a predator you woke with a noisy mine can maul the scum who just robbed
you; a beast can block a rival from the bounty she was about to claim. The board writes its own
comedy and its own alliances.

---

## 9. Map & Exploration

- **Last Ditch** — the home-base region: Gate (win + escape), Locker (bank; safe credits + the
  ticket fund), Market (trade + amends), Forge (craft/repair/charges), Infirmary (heal/train), and
  your **shelter** where the Resbed sits once secured. The only safe ground; the place you fight to
  return to. *Home bases give the map emotional weight.*
- **The Wastes** — the hex map outward from Last Ditch, terrain-typed (the baseline's water /
  plains / forest / hills / mountain). Terrain carries meaning: movement cost, which streams it
  hosts, where predators den. **Distance from the hub is the risk gradient** — richer nodes lie
  deeper, with a longer, deadlier trip home, and as you deplete the near fields the deep is the
  only money left. *Escalating commitment; landmarks as anchors.*
- **Fog & Prospecting (information layer)** — node yields and dangers are **unknown until
  scouted**. A Prospecting action (Scavenging/scanner) reveals a node's richness and threat for a
  stamina cost. Map knowledge **compounds** across days — *Accumulation; Information as Currency.*
  (Optional layer; ship full-reveal first — see §15.)

---

## 10. Turn & Time Structure

1. **Player phase** — spend Stamina to move/work/fight/prospect in the wastes.
2. **Ecology phase** — enemies act by their §7.3 disposition and the §8 rules; **death resolves
   here, as a visible event** (then the Resbed check, §7.4).
3. Repeat until you **return to Last Ditch and rest** → the day ends:
   - Stamina restored; rations/HP/training/charges available (for credits).
   - **Upkeep deducted** from the Locker; **Notoriety decays a little** (lying low between
     expeditions); if your funds can't cover upkeep → **stranded (game over)**.
4. **Win** at any hub visit once **Locker credits ≥ ticket price**: board at the Gate.

---

## 11. State Model (must fit in a struct)

```
player = {
  q, r,
  hp, hpMax, stamina, staminaMax, rations,
  creditsCarried,        // lost on death / robbery
  creditsBanked,         // Locker: safe from death; counts toward the ticket
  notoriety, day,
  skills: { scavenge, mine, hunt, tinker, gunnery, barter,     // {level, xp} each
            toughness, firstaid, foraging, endurance },
  gear: { weapon, tool, armor, utility },                      // item refs
  inventory: [ item ],                                         // goods + materials + ammo
}
resbed = { secured, charges }                                  // false/0 at start (Act zero)
item   = { kind, slot, tier, mods:{}, durability, value }
node   = { q, r, type, richness, depleted, revealed }
enemy  = { q, r, kind, faction, hp, speed, marked, carried, waryThreshold, hostileThreshold }
world  = { hexes, nodes, enemies, hub:{q,r,services}, ticketPrice, upkeep, prices:{},
           grudges:{} }   // optional per-faction grudge if global notoriety isn't granular enough
```

If a mechanic needs state with no home here, the mechanic is too vague or the model is incomplete.

---

## 12. Strategies (and the rule that backs each)

**Act zero** — *get a Resbed before you get bold.* With no safety net, the first expeditions are
cautious: scavenge near the hub, scrape the credits/parts to secure a Resbed and its first charge.
This is the tensest stretch in the game — one death ends it.

**Early game** — *establish a floor.* Now that death is survivable, scavenge to learn the map, bank
small, craft a T2 weapon/tool, keep Notoriety low. Goal: cover upkeep and stop dying.

**Mid game** — *run the chain.* Mine + hunt for raw, refine at the Forge, time Market sells on
price swings. Pick a specialty and equip into it. Notoriety climbs — the near grounds are turning
hostile and thinning — so expeditions go deeper. Decide when to spend on **amends** vs bank.

**Late game** — *the crescendo.* The world you made is hostile, the easy ground is dead, your
Resbed charges are precious. Take big bounties and deep-wastes nodes for the windfalls that close
the gap to the ticket, then make the dangerous final round trips to bank the fund and **run for the
Gate** before a grudge cashes in.

**Recurring tensions (a real choice every time):**
- **Carry or bank?** Invest carried credits in gear/streams now, or run home to lock them in.
- **Push or pull back?** One node deeper for a better yield, or keep enough stamina/HP/charges to
  get home alive.
- **Earn or cool off?** Keep scoring while grudges mount, or lie low / pay amends to bleed
  Notoriety — at the cost of days and credits.
- **Bank or spend on charges/amends?** Every credit toward survival is a credit not toward the
  ticket.
- **Specialize or hedge?** A deep skill multiplies one stream but leaves you fragile elsewhere.

**Anti-strategies — and the mechanic that prevents each:**
- *Safe-scavenge turtle (grind town salvage forever):* **upkeep is steady**, the **near fields
  deplete (worst near town)** forcing costlier deep trips, and even quiet work **trickles
  Notoriety** → the floor rises until safe net < cost-of-reaching-income. Patience alone can't win.
- *Hoard-and-rush (haul a giant wad to the Gate):* only **Locker** credits count, and carrying
  wealth **raises robbery weighting** → you must survive deposits, not one heroic dash.
- *Pacifist exploit (never fight, never escalate):* you still need gear/charges, and deep income
  sits behind fauna grounds and dens; **distance alone drives encounters**, and depletion forces
  you there → you can't stay benign *and* solvent forever.
- *Risk-free bounty farming:* targets are **lethal and rob you**, and kills **spike Notoriety hard**
  → bounties cost you the world's goodwill, not nothing.
- *Heal-rest exploit (rest to full in the field):* resting **burns rations** (then drains HP),
  **passes ecology turns** (enemies close), and **safe healing only exists at the hub** for credits
  → no free regeneration.
- *Suicide-shuttle (die on purpose to teleport home with loot):* death **drops everything carried**
  and **burns a finite Resbed charge** → it's a net loss, never a shortcut.
- *Omniscient/teleporting rival:* rivals are bound by **terrain costs, revealed-only info, and
  commitment patterns** → you can intercept and outmaneuver them, not just outrace.

**Dead-mechanic / coverage check:** every pillar has a strategy that engages it (Accumulation →
ticket fund + chain; Loss Aversion → carry/bank + Resbed charges; Escalation → Notoriety
disposition flips), and every system above is referenced by at least one strategy or anti-strategy.
No orphan mechanics.

---

## 13. Tuning Knobs (initial guesses — halve & double to find the feel)

| Knob | Start | Notes |
|------|------:|-------|
| Ticket price (Locker) | 1000 cr | the whole arc's length |
| Resbed cost / first charge | ~120 cr + parts | the Act-zero objective; gates survivable death |
| Resbed recharge | ~40 cr or rare part | each charge is precious; crafted at the Forge |
| Upkeep / day | ~8 cr (≈flat) | the steady drain; quiet income barely beats it |
| Scavenge grudge / Kill grudge | +1 / +8 Notoriety | violence escalates far faster than taking |
| Wary / Hostile thresholds | ~25 / ~55 (0–100) | where benign fauna/scum flip on you |
| Notoriety decay / amends | ~3 per quiet day / buyable | the management valves |
| HP / Stamina | 100 / 12 | Endurance & Toughness raise the caps |

Starting points, not law. Relationships that must hold: **safe income alone can't pull ahead of
upkeep** (forces risk), **violence escalates Notoriety far faster than gathering** (so the world's
hostility tracks *how* you play), and **the ticket sits just past comfortable reach** (near-miss).

---

## 14. Open Questions (living journal)

- Is one global **Notoriety** enough, or do factions/fauna-kinds need **separate grudges** (the
  optional `world.grudges`)? Separate grudges enable "anger the miners but stay friendly with the
  hunters" play; global is simpler. Prototype global first.
- **Resbed charges:** finite-and-recharged (current design) vs a flat per-use credit cost? The
  charge economy adds a guardable resource and a craft sink; the flat cost is simpler. Lean charges.
- Should the Resbed be **raidable** while you're away at high Notoriety (a reason the hub isn't
  inviolable late), or is that too punishing on top of everything? Gate behind a later slice.
- Do **named grudge-holders** add enough revenge-flavor to justify the tracking, or does generic
  hostile scum carry it? Add only if generic feels faceless in play.
- Fog/prospecting: ship full-reveal first; add fog only if early play feels too solved.

---

## 15. Implementation Scope (browser game, no backend)

Everything above must run as a static **HTML + JS + canvas + CSS** game on the existing baseline —
immediate-mode `render()` over flat-color hexes, module-level state, DOM/canvas events. No server,
no multiplayer, no asset pipeline. The design respects this by construction:

- **All content is data tables**, not bespoke code: streams, recipes, gear tiers, skill curves,
  enemy thresholds, and market prices are parameter sets read by the one income template, two hub
  menus, the disposition function, and the combat resolver. Adding an item/enemy = a row.
- **No real-time** — strictly turn/day based, so the canvas only redraws on input or animation
  callbacks (reuse the baseline's phase-by-phase enemy animation).
- **Persistence is optional** — a single `localStorage` JSON of the §11 state struct is the only
  save; not required for a first playable.

**Build order (core first, layer outward — mirrors the UI_CONTROLS layering):**
1. **Slice 1 — the loop works:** map + hub, Stamina expeditions, **3 streams** (Scavenge, Hunt,
   Trade), carry/bank Locker, flat upkeep, the **Resbed** (Act-zero securing + charges +
   re-embody/permadeath), **Notoriety** with benign→hostile disposition flips, ticket win,
   stranded loss. Full-reveal map, melee only. This alone is the whole emotional arc.
2. **Slice 2 — the chain:** add Mining, the Forge (crafting/repair/charges), gear tiers +
   durability, ranged weapons + ammo.
3. **Slice 3 — the hunt:** add Bounty targets, rival-scum robbery + revenge marks, named
   grudge-holders, variable enemy speed, Resbed raids.
4. **Slice 4 — depth:** fog + prospecting, per-faction grudges, skill specialization curves.

Cut anything in a slice that doesn't earn its complexity in playtest before moving on.
```
