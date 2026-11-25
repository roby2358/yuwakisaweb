# Power Quest — Rationale

Why each current choice, with the alternatives considered and the evidence. Rules are in
[ONTOLOGY.md](ONTOLOGY.md); numbers are cited by name. Tags: *Decided* = the designer's call;
*Proposed* = Claude's, pending review. Evidence marked "Modeled" is first-guess; "Measured" names a
command. The bot in `test/sim.js` is more disciplined than a human, so its numbers bound the pace.

## The shape of the game

### D-1 The game does not end — *Decided*
- **Alternatives:** survive N turns; find the full armor set then a final boss; a score run.
- **Why:** the designer wants an open game where the player may eventually move on and found a new village. A fixed end would turn levels into a countdown (G-1).
- **Evidence:** none needed.

### D-2 Two level tracks: hero level and village tier — *Decided*
- **Alternatives:** hero only; village only; armor power-core levels with no hero level.
- **Why:** hero level opens perks and sockets; village tier opens recipes and healing. Salvage can feed only one: crafting spends the pack, banking raises tier (G-1, G-3).
- **Evidence:** Measured by: `node test/sim.js 500 8` → bot kept crafting (1–7 modules) while raising villages to tier 5 in most games.

### D-3 Hunting and crafting are the thriving verbs — *Decided*
- **Alternatives:** exploration/discovery with defense; trading and reputation; command.
- **Why:** kills pay XP, parts and trust at once; parts become modules. Exploration still matters through fog and ruins but is not promoted (G-2, G-3).

### D-4 Combat: free melee, a weapon selector, charge spent as power — *Decided*
- **Alternatives:** melee only; ranged only; every action draws charge.
- **Why:** melee costs only movement so you are never stuck; ranged and modules spend charge, so charge is the scarcity (see D-11).

## Levels and crafting

### D-5 XP leaves level L at `XP_STEP × L`; pace is a first guess — *Proposed, tuned by sim*
- **Alternatives:** exponential curve; kill-count levels; fixed xp per level.
- **Why:** a linear step keeps early levels quick and later ones slower, without a cliff. Halve and double first.
- **Evidence:** Measured by: `node test/sim.js 500 8` → bot level at turn 100 was 3–5 and at turn 300 was 3–11. A human will be slower; no human data yet (X-1).

### D-6 Crafting needs a blueprint (from ruins) plus two part kinds — *Proposed*
- **Alternatives:** buy recipes with salvage; one part kind; random drops of finished modules.
- **Why:** ruins reward ranging (G-3 with exploration); scrap from raiders and cells from relic monsters means the choice of what to hunt shapes what you can build. Module price and tier are template parameters (D-10).

### D-9 Perks are one template and have no cap — *Decided (no cap), Proposed (template)*
- **Alternatives:** capped ranks; per-perk special code.
- **Why:** the designer wants room for game-breaking stacks; the counterweight is enemy tier rising with level (see D-12). Every perk is `{stat, amount}`, so eight perks cost one code path.
- **Evidence:** Modeled: a bot that takes toughness first reaches level 15 with few shutdowns; whether a stack trivializes hunting is a playtest question (Q-3).

### D-10 Three module templates — *Proposed*
- **Alternatives:** unique code per module.
- **Why:** passive `{stat, amount}`, weapon `{range, dmg, cost}`, active `{effect, amount, cost}`. Eleven modules, three code paths.

### D-11 Charge is movement's second axis — *Decided*
- **Why:** `boost(n)` turns charge into movement; shots and active modules cost charge. Charge refills slowly in the wild and fully at villages and ruins, so a burst turn leaves you dry in the open (double-edged).
- **Evidence:** Modeled: bot fights used charge most turns; a recharge-at-ruin pattern emerged unplanned.

## Villages and trust

### D-7 Raids hurt villages; tier is lost and villages can fall — *Proposed*
- **Alternatives:** villages invulnerable; raids only slow trust.
- **Why:** loss aversion needs something to lose (G-4). Walls (tier) and regeneration scale with tier so strong villages hold.
- **Evidence:** Measured by: `node test/sim.js 500 8` → 2–3 of 5 villages stood at turn 500, high-tier ones surviving (X-3). Before `RAID_DAMAGE_PER_HIT` was halved most villages fell within 30 idle turns.

### D-17 Trust comes from killing what threatens a village and from gifts — *Decided (core), Proposed (details)*
- **Alternatives:** trust from deeds only; trust that erodes when your power attracts raiders.
- **Why:** hunting becomes how you earn a village's help. Gifts are capped by a bucket so salvage can't buy it all. Neglected trust decays so remote villages need revisits.

### D-15 Founding leaves the old village standing — *Decided*
- **Alternatives:** the old village is abandoned; founding is a prestige reset.
- **Why:** a growing network of benches is accumulation; each village is another thing to guard. Conditions (cost, distance, trust nearby) are *Proposed*.

### D-16 The home village is always open — *Proposed*
- **Alternatives:** home trust like any other village.
- **Why:** with trust penalties on shutdown the bot spiralled: 275 shutdowns in one game with every door closed. A hero who can't heal is stuck. See D-8 for the second half of the fix.
- **Evidence:** Measured by: `node test/sim.js 500 8` before the fix: seed 134 shut down 375 times; after both fixes: 2.

### D-24 If every village falls, survivors found one where you fell — *Proposed*
- **Why:** an open game must not dead-end. Free, tier 0, at `FOUNDER_TRUST`.

## Failure

### D-8 Shutdown is a cost, not an end; you wake depleted and sheltered — *Decided (soft failure, depleted), Proposed (sheltered)*
- **Alternatives:** armor lost where you fell; permadeath of the character.
- **Why:** the cost is real (half the pack, half the xp toward the next level, days pass, trust dips) but levels survive. A depleted hero next to the monster that downed it would be killed again, so convalescence in a village is protected until you leave or heal to half.

### D-13 Enemies are named individuals and a slayer becomes a nemesis — *Proposed*
- **Why:** revenge needs a target. Killing a nemesis pays `REVENGE_XP_MULT` and the log names it.

## Ecology

### D-12 One enemy template, a routine per group, tier set by place and level — *Proposed*
- **Alternatives:** scripted encounters.
- **Why:** raiders walk a cached cost field to the nearest village (same terrain costs, no teleporting); beasts chase within `AGGRO` and otherwise wander a leash; guardians keep a leash around a lair. Tier rises with distance from villages and with hero level, so power draws harder monsters (G-5).
- **Evidence:** Modeled; bots met tier 3–4 monsters from around level 7 and were shut down 1–6 times per 500 turns (X-2).

### D-14 Mesa is closed to ground enemies — *Proposed*
- **Why:** terrain as language: mesas are fortresses. Interior mesa hexes are safe from melee; attackers at the rim can still hit.

### D-20 Wild creatures respawn and lairs re-arm — *Proposed*
- **Why:** an early sim emptied the map of enemies by turn 300, ending the hunting loop.
- **Evidence:** Measured by: `node test/sim.js 400 6` → 30–50 enemies alive after the change vs 0–14 before.

### D-22 Kills near an open village pay `HOME_XP_MULT` — *Proposed*
- **Why:** anti-turtle: trust still rises there, xp doesn't, so farming at home is a poor trade (G-5).

## Interface and map

### D-18 Fog of war with sight radius; jungle hides sites — *Decided (fog), Proposed (jungle)*
- **Why:** discovery is the map. Fog is a display filter over complete engine state (the future server would filter).

### D-19 80×60 map, large sessions — *Decided*

### D-21 The turn does not auto-end at 0 mp — *Proposed*
- **Why:** shots and modules cost charge, not movement, so 0 mp doesn't mean the turn is spent.

### D-23 Enemy damage is flat; hero damage has a spread — *Proposed*
- **Why:** readable consequences: a monster's blow can be predicted from its tooltip; your own variance is the variable reinforcement.

## Open questions

- **Q-1 Should monsters regain hp when you leave?** Options: never (hit-and-retreat works), slowly, fully. *Recommend:* slowly, after playtest shows kiting.
- **Q-2 Line of sight for shots?** Mesa walls could block it. *Recommend:* not yet (no LOS in the base).
- **Q-3 Does an uncapped perk stack trivialize play?** *Recommend:* playtest first; tune `TIER_LEVELS` before any cap.
- **Q-4 Should raiders be drawn to high-tier villages or to a hero's armor signature?** *Recommend:* tier-scaled raid size, no signature.
- **Q-5 A summary of a run (levels, villages founded, nemeses slain) when the player quits?** *Recommend:* yes, cheap.
- **Q-6 XP pace.** The bot may be faster than a human. *Recommend:* leave until a human has played 30 minutes.

## Deliberately left out

- Recruited followers and commandable villagers (command was not chosen).
- Fixed win or defeat conditions.
- Armor signature that draws monsters or erodes trust (considered, cut for scope).
- Save and load.
