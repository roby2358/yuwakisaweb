# Game Dynamics — Healer

> This is a design journal, not a spec. It answers *why this is fun* before *what the code does*.
> The live build is still the inherited movement-puzzle baseline; this document is the design we
> are building toward. Update it when mechanics change — it is the authoritative reference for
> **why** the game works.

---

## Theme

**The desperate, thankless triage of keeping reckless heroes alive.**

You are not the hero. You are the medic walking three steps behind them. The party charges toward
treasure and danger on its own stubborn logic — you cannot command it, you can only *save* it. Every
turn is a scramble to be in the right place with the right spell for the ally about to die, and you
never quite are. The reward is being **needed**: the party survives because of you, and that
survival becomes your reputation. This is the support-main fantasy — you didn't land the killing
blow, but you are the only reason anyone is still standing.

The feeling: *anxious indispensability.* Responsible for lives you don't control.

---

## Key Drivers (the load-bearing pillars)

Three drivers carry the whole design. Every other mechanic weaves into one of them.

1. **Guardianship.** The entire game is protecting *named* party members with distinct classes and
   personalities you grow attached to. "The cleric dies and now nobody cleanses" is the whole point.
2. **Scarcity of Agency.** You have limited Aether, limited range, and — uniquely — *you don't even
   steer your own team.* Your agency is doubly scarce: you can't prevent the danger, only mitigate it.
3. **Loss Aversion.** You are preventing death, not collecting loot. Every hero lost is permanent and
   makes the rest more likely to fall. You hoard survival, you don't chase reward.

Supporting drivers the theme activates: **Readable Consequences** (you must see who's about to die
and why), **Near-Miss Architecture** ("if I'd warded the tank one turn earlier"), **Revenge** (the
enemy that killed your fighter is still on the board), **Escalating Commitment** (the party drags you
into the crescendo).

---

## Key Mechanics (one per pillar)

### 1. The party you cannot command — *Guardianship*
> Party members move and fight on their own AI; the healer's only control is **support** — heal,
> shield, buff, cleanse, revive. You select and move *yourself*, never them.

The leader pursues objectives (treasure, then the exit). The followers (mostly) follow the leader.
You (mostly) follow the leader too — because that's where your patients are. This is the central
conceit and it is deliberately counter-intuitive for a tactics game, so the UI must sell it
immediately: party counters show an AI/intent marker, and clicking one shows its plan, never a move
order.

**Fairness leash (so the puzzle stays solvable):** the leader's movement is biased to stay within
`LEADER_LEASH` hexes of the healer; if the healer falls too far behind, the leader slows or waits. A
party that sprints out of heal range forever isn't a challenge, it's a lost game on turn one. *Serves:
Never Let a Unit Feel Stuck — preserves the player's agency without handing them command.*

### 2. Aether and range — *Scarcity of Agency*
> Every skill costs **Aether** from a slowly-regenerating pool, and every skill has a **range** — so
> each turn you choose both *what to cast* and *who is even close enough to receive it.*

Two scarcities bound by one link. You can't heal everyone (Aether), and you can't reach everyone
(range), and getting into range costs movement (MP) that you can't get back. Aether regenerates
faster when you hang back behind the line and act less — which is exactly when you're out of range of
the ally taking hits. *Double-edged: recover mana or stay useful, never both.*

### 3. Permadeath and the cascade — *Loss Aversion*
> A hero at 0 HP is **downed**, not dead; they die permanently if not revived within `REVIVE_WINDOW`
> turns — and each death weakens the survivors (less damage dealt, fewer bodies between the enemies
> and *you*).

Losing the tank means everyone — including the healer — eats more hits. Losing the cleric-type means
a damage type you used to counter now goes unanswered. Death is a cascade, not a subtraction. *Serves
Loss Aversion and Escalating Commitment: the board gets harder precisely because you failed to hold
it.*

---

## The meta-reward: Reputation — *Prestige / "being needed"*
> Reputation accrues from heroes kept alive and objectives the party claims; it is your score, and it
> unlocks higher **skill tiers** mid-run.

Reputation is being-needed made numerical. It is also the progression spine: as it rises you unlock
deeper tiers of the baroque skill list — *and* tougher enemy tiers begin to appear (escalation tied
to progress, see below). A full-party flawless run scores high reputation; limping to the exit with
one survivor scores low but is still a win. This is the near-miss generator.

---

## Secondary Mechanics (each woven into a pillar)

### Enemy damage types make the skill list *necessary* — *weaves Guardianship + Readable Consequences*
The enemy roster is large but groups into a few **classes**, and each class deals damage in a way
that demands a *specific* support answer. This is the load-bearing weave: enemy variety is what makes
a baroque skill list a real toolkit instead of decoration.

| Enemy class | Damage profile | Healer's answer |
|---|---|---|
| **Brute** | Big single melee hit (burst) | Pre-cast **Ward** (absorb) before they connect |
| **Swarm** | Many small hits, spread across the party | **Group heal / Aura** |
| **Rotter** | Poison/DoT debuff that ticks each turn | **Cleanse** the debuff (raw healing can't outpace it) |
| **Hexer** | Stat debuff (weakness, slow, armor-break) | **Dispel** the debuff or **Buff** to offset |
| **Caster** | Ranged magic, ignores front line, picks your backline | **Buff** survivability or reposition; reactive burst heal |

Each class has **tiered members** (lesser → greater → champion) that scale magnitude with the run's
reputation. *Serves Readable Consequences: the threat tells you which spell to reach for.*

### Telegraphed targets — *Readable Consequences + Revenge*
Every enemy commits to a **target** party member (an `enemy.target` field) and telegraphs it (a line
to the victim). This lets the player *pre-ward* the ally about to be hit rather than react after the
spike. When an enemy lands a kill, it remains identifiable and on the board — and the party AI's
leader biases toward focusing the killer. *Serves Revenge: the grief has a face and an address; the
healer can pour buffs into the vengeance.* *Constraint, per "Enemy Identity": no anonymous swarm
deaths — you always know who did it.*

> **Status — telegraph lines disabled (v1).** Drawing a line from every enemy to its target spanned
> the whole map and would become a red cobweb with a large enemy roster. The lines are currently not
> rendered. Idea to restore later: only draw the telegraph when the enemy is within ~2 hexes of its
> target — declutters the board *and* sharpens the cue to mean "imminent" rather than "eventually".
> The `enemy.target` commitment itself still exists; only its rendering changed.

### Status effects as one uniform system — *Readable Consequences (clean mental model)*
Heals-over-time, shields, buffs, poisons, and hexes are all entries in a unit's `statuses[]` array
`{ type, magnitude, turnsLeft, source }`. One tick loop resolves all of them each turn. This is what
gives the "complicated interactions between turns" depth without special-case code: a Regen and a
Poison on the same unit are just two ticking entries that net out.

### Pre-cast vs. react — *Scarcity of Agency*
Wards and Regens are cheaper-per-point than emergency burst heals, but they're *speculative* — cast a
Ward on an ally who never gets hit and the Aether is wasted. Burst heal is guaranteed value but you
ate the spike first and it costs more. Every turn: spend efficiently on a prediction, or expensively
on a certainty. *Double-edged; serves Accumulation (good predictions compound into Aether surplus).*

### Variable enemy speed — *Variable Reinforcement + Near-Miss*
Each enemy rolls a speed at spawn (slow / fast / very fast). A swarm where *any one* might be the fast
one means the player can't count hexes to feel safe — a fast Brute closing from 4 hexes is a surprise
the healer must pre-ward against. Cheap (one field, loop the move step N times), big feel change.

### Escalation tied to progress — *Escalating Commitment (anti-turtle)*
Tougher enemy tiers appear as **reputation rises and the party nears the objective**, not as a clock.
The party's own AI pushes forward and will not turtle, so the player is dragged into worse odds by the
very success they're accruing. *Serves Escalating Commitment: the crescendo is self-inflicted.*

---

## State Model (everything fits in a struct)

```
Healer (player) {
  q, r,                    // position (axial)
  hp, maxHp,               // the healer is killable — see Win/Loss
  mp, maxMp,               // movement budget per turn (PLAYER_MP)
  aether, maxAether,
  aetherRegen,             // per-turn regen, higher when not casting / behind the line
  reputation,
  skills: [skillId, ...],  // unlocked by tier as reputation rises
  cooldowns: { skillId: turnsLeft }   // only the heaviest skills are cooldown-gated
}

PartyMember {
  id, name, class, role,   // role: 'leader' | 'follower'
  q, r,
  hp, maxHp, armor,
  damage,                  // its own offense (you don't control it, but it matters to survival)
  statuses: [{ type, magnitude, turnsLeft, source }],
  alive, downedTurns       // downed at 0 HP; dies when downedTurns > REVIVE_WINDOW
}

Enemy {
  id, class, tier,         // tier scales magnitude
  q, r,
  hp, damage, damageType,  // damageType: 'burst' | 'spread' | 'dot' | 'debuff' | 'magic'
  speed,                   // rolled at spawn: slow / fast / very fast
  target,                  // committed party member id (telegraphed)
  statuses: []
}

Skill {
  id, name, template, tier,
  aetherCost, range, aoeRadius,
  magnitude, duration, cooldown
}
```

If a mechanic ever needs a field with no home here, the mechanic is too vague or this model is
incomplete. (Note: the inherited `resource`, `controlled`, and any `danger`/installation fields from
the Realm extraction are **removed** — they leak another game's design.)

---

## Skill Templates (template, don't snowflake)

The "almost baroque list of tiered skills" is many parameter sets over a *small* set of templates.
Target: ~7 templates, ~6 effect functions; every individual skill is data, not a code path.

| Template | Effect function | Example skills (tiers as data) |
|---|---|---|
| **Instant heal** (activated-targeted) | restore `magnitude` HP now | Mend → Heal → Greater Heal |
| **Regen / HoT** (applies ticking buff) | `+magnitude` HP/turn for `duration` | Renewal → Lifebloom |
| **Ward / Shield** (applies absorb buff) | absorb next `magnitude` damage, decays in `duration` | Aegis → Bulwark |
| **Cleanse / Dispel** (activated-targeted) | remove a `dot` or `debuff` status | Purify (dot) / Dispel (debuff) |
| **Buff** (applies stat-mod buff) | `+magnitude` armor/damage/speed for `duration` | Bless → Inspire |
| **Aura / Group** (self-or-targeted AoE) | apply any of the above to all allies in `aoeRadius` | Sanctuary, Hymn |
| **Revive** (activated-targeted, cooldown) | restore a downed ally to `magnitude` HP | Raise — high cost + cooldown |
| **Passive** (always-on modifier) | e.g. regen Aether on a shrine hex | Meditation, Shrine attunement |

Adding the 40th enemy or the 30th skill should mean adding a *row of data*, never a new branch.

---

## Turn Loop

```
1. Healer phase
   - move (spend MP) and/or cast skills (spend Aether; respect cooldowns + range)
   - movement auto-allows at least one action so the healer never feels stuck

2. Party phase (AI, animated hop-by-hop so the player can read it)
   - leader: A* toward current objective, biased to stay within LEADER_LEASH of healer
   - followers: A* toward leader; attack an adjacent enemy if one is in reach
   - (leader biases toward the enemy that last killed an ally — revenge)

3. Enemy phase (AI, animated; this is where consequences land)
   - each enemy: A* toward its committed target; move `speed` hexes; attack if adjacent
   - damage resolves through statuses: Wards absorb first, then HP drops
   - a hit landing is a visible event (flash), not a silent end-of-turn check

4. Resolution tick
   - apply Regens (heal), apply DoTs (damage)
   - decrement all status durations; remove expired
   - downed party members: downedTurns++ ; if > REVIVE_WINDOW → permadeath (cascade fires)
   - accrue reputation; check tier unlocks and escalation spawns
```

*Per "Death Should Be an Event": kills happen in the enemy phase, on screen, traceable to one enemy
and one missed ward — not a post-turn position audit.*

---

## Win / Loss

- **Win:** the party reaches the adventure objective (the treasure, then the exit/home). Reputation
  scores the *quality* of the win — how many heroes survived, how much loot.
- **Loss:** the **healer dies**, OR the **entire party dies** (no one left to heal = you failed your
  one job).
- **Pyrrhic win (the near-miss engine):** reaching the objective with only some of the party alive is
  a real but low-reputation victory. This is deliberate — "I won, but I lost the cleric on the last
  push" is the one-more-game hook.

*The healer is killable but low-priority to enemies: the party is your front line. As the party thins
(cascade), enemies reach you — so losing heroes is also a direct threat to your own life. Loss
aversion all the way down.*

---

## Strategies (reviewed against the mechanics)

### Early game
Party near full, enemies few and low-tier. Bank Aether, learn which enemy class is which, top off
chip damage cheaply with Regens, and pre-position near the leader. Information-gathering: read the
damage types you'll have to answer later.

### Mid game
Multiple enemy classes engage at once → triage begins. Pre-ward the Brute's telegraphed target,
cleanse the Rotter's poison before it outpaces healing, group-heal the swarm's spread damage. Aether
goes tight; positioning between a spreading party is the core puzzle. Good predictions (cheap pre-casts
that land) bank surplus for the late game.

### Late game
Near the objective, top enemy tiers, party likely down a member and wounded. Burn cooldowns, spend
the banked Aether, gamble on Revives, and accept exposure as the front line thins. The crescendo —
survive it intact for high reputation, or limp through for a Pyrrhic win.

### Recurring tensions (every game)
- **Move to the wounded vs. stay in range of the group.** MP spent reaching one ally is range lost to
  another.
- **Spend now vs. bank.** Reactive heal this turn, or hold Aether for a Ward / a Revive.
- **Pre-cast vs. react.** Efficient prediction that might be wasted, vs. expensive certainty after the
  hit.
- **Follow the reckless leader into danger vs. hang back safe but out of range.**
- **Save the dying follower vs. let them go to keep the tank standing.**

### Anti-strategies (each has a *specific* mechanical prevention)
- **Turtle / out-regen the game.** *Prevented:* the party is AI-driven and pushes forward; you cannot
  make it wait, and escalation scales with progress + reputation. There is no standing still.
- **Ignore the party, solo to the objective.** *Prevented:* a lone healer has no offense and the
  objective requires the *party* to claim it; the healer alone dies to the first Brute.
- **Spam the cheapest heal forever.** *Prevented:* enemy damage types — a Poison DoT outpaces a small
  HoT, a burst needs a Ward, a debuff needs Dispel. Mono-skill play leaves a damage type unanswered.
- **Hide the healer far from danger and do nothing.** *Prevented:* out of range = no heals = party
  dies = loss; and no reputation = no tier unlocks.
- **Blanket-ward everyone every turn.** *Prevented:* Aether can't afford it; you must *predict* via the
  telegraphed `enemy.target` who actually needs the ward.

**Review check:** every key mechanic above is referenced by a strategy, and every strategy references
a mechanic that exists in the state model and turn loop. The leader leash exists specifically so the
"move vs. stay in range" tension is a real choice and not an unwinnable chase. No mechanic is dead; no
strategy invokes a rule that isn't formalized.

---

## Open Questions / v1 Scope

- **v1 is overland** (the existing 60×40 hex map). Connected dungeon rooms are a later layer.
- **Party size** for v1: small (≈3–4) so each hero is irreplaceable (Guardianship) and triage is
  tractable.
- **Do followers have personalities that bias their AI** (the brave one charges, the timid one
  lags)? Desirable for Guardianship and comedy, but v1 can ship with leader-follow only.
- **Tuning constants** (`LEADER_LEASH`, `REVIVE_WINDOW`, `maxAether`, `aetherRegen`, spawn rates) are
  unset on purpose — tune by *halve-and-double* in play, not by guessing now.

---

## Reference: Map & Movement (concrete, inherited baseline)

These tables describe the current generated map and movement model that the design above sits on top
of. Terrain now serves two jobs: **movement cost** and (future) **line-of-range** for skills (forests
and hills cost more / can obscure). Treasure and objectives are **landmark entities**, not terrain
resource nodes — the old "resource" terrain framing is being retired.

### Map
- Rectangular hex grid (60 columns × 40 rows), pointy-top hexes.
- Generated via diamond-square heightmap; terrain assigned by elevation percentile.
- Edge hexes are always water.

### Terrain movement costs
| Terrain  | Cost       |
|----------|------------|
| Plains   | 1          |
| Forest   | 2          |
| Hills    | 2          |
| Water    | Impassable |
| Mountain | Impassable |

*(`Gold` / `Quarry` were Realm resource terrain; they survive only as flavor tiles for now and carry
no special mechanic — to be removed or repurposed as treasure landmarks.)*

### Healer (player) movement
- Starts near the party's entry point on the map.
- `PLAYER_MP` movement points per turn, spendable across multiple moves.
- Cannot move onto hexes occupied by another unit.
</content>
</invoke>
