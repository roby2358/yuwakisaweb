# Quest System Brainstorm

## The Core Loop

A quest is a three-beat structure: **Encounter** (find the source, hear the plea) -> **Journey** (go somewhere, do something) -> **Consequence** (the world changes, you get rewarded). The interesting design space is in how these beats interact with the existing systems — movement scarcity, chaos escalation, fog of war, and the ticking clock of open breaches.

## Quest Sources

Quest givers appear on the map as a large yellow **!** marker. They occupy a hex like a POI but are ephemeral — they appear mid-game and can disappear if ignored too long (the chaos took them, or they gave up and fled). Each source type implies a tone and a reward tier.

### Villager
A displaced person standing in the open. Low-tier quests. They're fleeing something or lost something. Rewards: small gold, a non-magical item, or information (reveals a patch of fog). They feel urgent because villagers are fragile — if chaos-spawned enemies path through their hex, the villager dies and the quest fails. This creates a natural tension: do you rush to them or finish what you're doing?

### Farmer
Found near plains or gold terrain. Practical quests — clear out creatures harassing their land, deliver something between two points. Rewards: gold, food (HP restoration item if those exist), or they till the land and create a gold deposit on a nearby hex. The farmer is the "safe" quest — low risk, reliable reward, good for when you're hurting and need a breather.

### Maiden / Noble's Child
Found near havens or camps. Mid-tier. Classic rescue or escort setups, but with a twist: the person you're rescuing might be at a ruin that hasn't been looted yet, giving you a reason to go there anyway. Or they're being held near a breach, and the quest reward stacks with the strategic value of sealing it. Rewards: good gold, a magical item, or a skill teaching (like a mobile Wise Man's Hut).

### Lord / Commander
Found at havens. High-tier quests with military flavor. Kill a specific named enemy, clear a region of chaos-spawned creatures, or scout and report on breach activity. The lord marks a target hex — you go there, do the thing, come back. Rewards: top-tier equipment, large gold, stat points. But the lord's quests are demanding — they might require you to go deep into dangerous territory.

### Strange Robed Figure
Found anywhere, often in odd places — a mountain-adjacent hex, the edge of shattered terrain, alone in fog. The figure's quests are cryptic and don't fully explain what you're doing until you get there. "Bring me what lies beneath the broken stone" (go to a specific shattered hex and use Restore on it to find a hidden cache). "Walk the path the stars forgot" (visit 3 hexes in sequence). Rewards: always magical — rare equipment, unique skills, Aether capacity bonuses, or permanent stat increases. But the figure might not be what they seem — completion might also spawn a wave of Phase Wraiths, or the figure vanishes and the "reward" is a trap that tests you.

### Wounded Scout
Found on hills or forest hexes, usually partway between a haven and a breach. Low HP, bleeding out. The scout was sent by a lord or haven but didn't make it back. Their quest is always information-driven: "I found what's out there — go see for yourself" or "Warn the haven before it's too late." The urgency is baked into the fiction — this person is dying and spent their last energy flagging you down. Rewards: fog reveal in a large radius around the scout's intended destination, or the haven they came from gives you a discount/bonus when you arrive. If you ignore them too long, they die — and the information is lost (the quest just vanishes, no failure penalty, but you feel it). The scout is a worldbuilding source: they make you feel like other people are also struggling against the chaos, not just you.

### Merchant
Found on plains between havens, or near camps. They've been cut off from their trade route by enemies or shattered terrain. Their quests are transactional and transparent — no mystery, no drama. "Clear the path between here and the eastern haven" (kill enemies along a rough corridor). "I need quarry stone — find me a quarry hex and I'll meet you there." Rewards: they set up a temporary shop wherever you complete the quest (3-4 items, better prices than havens — 80% instead of 100%), or they give you a choice of 2-3 items from their pack as payment. The merchant is the quest source for players who want loot, not story. They also solve a problem: mid-game, you're often far from havens and want to buy/sell. A merchant quest puts a shop where you need it.

### Hermit
Found in deep forest or on isolated hexes surrounded by difficult terrain. They've been living out here alone, and they like it that way. Their quests are eccentric: "Something is poisoning the water upstream" (find and kill an enemy on a specific water-adjacent hex). "The trees are screaming — make them stop" (restore shattered forest hexes in the area). "I buried something years ago. Can't remember where. It's on a hill, near water, with three trees nearby" (find a hex matching terrain constraints). Rewards: the hermit teaches you a skill (like a Hut, but the skill selection leans toward nature/terrain skills — Restore, Ground Weave, Prospect). Or they give you a unique crafted item — a poultice that restores HP over several turns, or a talisman that reduces movement cost in forest by 1. The hermit is the quest source for exploration-oriented players. Their quests send you to interesting terrain, not to combat.

### Specter
Found on shattered terrain or near breaches. A ghost — someone who died to the chaos and is trapped between worlds. They shimmer, translucent, and their quest text is fragmented. "My... bones... the hill where the sun... please..." You have to interpret what they want. The quest marker is approximate — a region, not a hex. You're looking for a specific hex within that region (their grave, their home, the place they died). When you find it, you perform some action — Restore the hex, kill the enemy occupying it, or simply stand there for a turn (a vigil). Rewards: the specter departs and leaves behind a magical item embedded in the hex. Or they grant you a permanent passive — +1 vision, or enemies within 2 hexes have their detection range reduced by 1. The specter is the emotional quest source. No combat required, but the atmosphere is heavy. Their quests make shattered terrain feel like it has history, not just mechanics.

### Deserter
Found near camps, usually on the far side from the nearest breach — they're running away from the fight. A soldier who broke. Their quests cut both ways: they might ask you to go back to where they fled and finish what they couldn't ("I left my squad behind — they're surrounded"), which is a clear/rescue quest in a dangerous area. Or they ask for safe passage to a haven (escort). The twist: the deserter is a competent fighter. If you take the escort quest, they actually fight alongside you — 2-3 attack, 10 HP, they swing at adjacent enemies during enemy phase. It's the only quest where you temporarily have an ally. Rewards: mid-tier gold and equipment (they give you their gear when they reach safety), or if you sent them back to fight, the lord at the nearest haven offers a bonus quest as thanks. The deserter is interesting because they're morally gray — you're helping someone who quit, and the game doesn't judge that.

### Child
Found at havens or camps. A kid who lost something or wants to prove themselves. Their quests are small-scale and low-danger but charming. "My cat ran into the forest" (go to a specific forest hex, "catch" the cat by stepping on it, bring it back). "I want to see a real monster" (kill any enemy within 3 hexes of the child's location while they "watch" — they don't move, you just fight nearby). "I found a weird rock" (the child gives you a quest item that turns out to be a fragment of something valuable — deliver it to a Wise Man's Hut for identification). Rewards: tiny — 2-5 gold, a minor consumable, or the child's parent gives you a real reward (a piece of equipment, a tip about a ruin location). The child exists to vary the tone. Not everything in the dying world is grim. Also a good tutorial quest source for early game — simple objectives, safe areas, teaches the quest UI.

### Wise Man / Wise Woman
Found at Huts (their existing POI) or occasionally wandering near one. They already teach skills — now they also give quests, and the quests *are* the teaching. "You know Restore, but do you understand it? Go heal the scarred grove to the south and come back changed." The quest objective ties directly to a skill or stat: use Restore 3 times in a region, deal damage to 4 different enemies in one turn, survive 5 turns adjacent to a breach without retreating. They're training montage quests — the objective IS the reward, because completing it grants a permanent upgrade to the skill or stat involved. Restore might gain +1 radius. A combat trial might grant +1 Might. They could also send you to find reagents for a potion or artifact they're crafting — fetch quests, but the destination is always lore-rich (a specific terrain type, a ruin, near the Maw). Rewards: skill upgrades, permanent stat bonuses, unique consumables (a potion that grants temporary +2 to all stats for 10 turns), or they teach you a second skill on the spot. The wise figure is the mentor quest source — their quests make you better at the game's systems, not just stronger numerically. They pair naturally with chain quests: the first quest tests you, the second pushes you, the third transforms you.

### Mariner
Found on hexes adjacent to water — shorelines, riverbanks, lake edges. They live on the boundary the player can't cross. Their quests leverage the coastline: "Something washed ashore three leagues north" (go to a distant water-adjacent hex and retrieve it). "The corruption is poisoning the waters — seal the breach that's bleeding into my bay" (a breach near water, with the twist that shattered coastal hexes might have cut off the approach, forcing a longer route). "I can take you across" — the mariner offers a one-time ferry: accept the quest and they move you to a distant water-adjacent hex on the other side of a body of water, skipping a massive overland detour. The catch is you arrive alone, deep in fog, possibly near enemies. The ferry isn't the reward — it's the *start* of the quest. Whatever they need done is on the other side. Rewards: nautical-flavored items (a compass artifact that increases vision by +1, a waterproof cloak that negates the first hit each combat like a free Warp Shield, a harpoon — ranged weapon with knockback). Or practical rewards: they reveal all water-adjacent hexes on the map (coastline mapping), or they establish a permanent ferry point between two shores you can reuse. The mariner makes water interesting instead of just being a wall. They turn the map's negative space into quest geography.

### Corrupted Knight
Found in shattered terrain, always alone. Encased in dark crystalline armor, half-consumed by chaos but still holding on. They don't ask for help — they demand it, or they challenge you. "Prove you're strong enough to matter." Their quest is always combat: duel them (a fight against a mid-boss-tier enemy, ~35 HP, 8 attack, 4 defense), or they point you toward something worse and say "kill that, then we'll talk." If you beat their challenge, they snap out of it partially — the chaos recedes. They become a temporary ally for 10 turns, following you and fighting. Or they give you their weapon (a unique corrupted item with high damage but a drawback — recoil, or it drains 1 Aether per turn). The knight is the high-risk quest source for players who are ahead of the curve and want a fight. Their quests don't send you far — the challenge IS the quest.

## Quest Types

### Hunt
Kill a specific enemy or enemy type. The target is marked on the map (or its general area is indicated if you haven't revealed that hex yet). Simple, satisfying, plays to the core combat loop.

- **Variants**: Kill N of a type. Kill a "named" version (an enemy with boosted stats and a generated name). Kill without taking damage. Kill using only ranged/melee/skills.

### Fetch / Retrieve
Go to a hex, pick up a thing, bring it back (or to another location). The destination might be dangerous, guarded, or deep in fog. The item could be at a ruin, in shattered terrain, or on a hex you need to Restore first.

### Escort
An NPC spawns and follows you (1 hex behind, matching your movement). You need to get them to a destination. They have HP and enemies will target them. This is brutally tense with 4 MP per turn — you can't outrun threats, you have to fight through them.

### Clear
Remove all enemies from a radius around a location. The quest giver wants to resettle or rebuild. Completing it might upgrade the hex to a camp POI or create a new haven shop. This has lasting strategic value beyond the immediate reward.

### Scout
Reveal a specific area of the map. The quest giver describes a location ("the old watchtower on the eastern hills") and you need to get vision on that hex. Low combat, high exploration. Good early-game quest. Could reveal something unexpected — the "watchtower" is now a breach.

### Restore
A quest specifically about healing the land. Restore N shattered hexes in a region. Plays into the Guardianship driver — you're not just fighting, you're reclaiming. Reward could be that the restored area spawns a new POI.

### Deliver
Carry an item from A to B. You're a messenger or trader. The wrinkle: the item takes an inventory slot, and you might get ambushed en route. The sender and receiver are at known locations (havens, camps, huts). Good connective tissue quest that makes the world feel inhabited.

### Negotiate
Travel to a marked hex and resolve something without fighting. The target is a non-hostile NPC or creature that could go either way — a wildlife pack alpha blocking a pass, a rival scavenger camped on a ruin, a chaos-touched hermit who might turn violent. When you arrive, a dialog opens with 2-3 options shaped by your stats and situation. High Warding might unlock a persuasion option. Carrying a specific item might let you offer a trade. Having a skill like Restore might let you demonstrate good faith. The "wrong" choice (or a choice you don't qualify for) doesn't necessarily fail the quest — it just escalates it into a fight, converting the negotiate into a hunt on the spot. The right choice resolves it peacefully and gives a better reward or an additional bonus.

- **Why this is interesting**: it's the only quest type where your build matters *before* combat. A high-Might character who's been dumping stats into damage suddenly discovers that punching isn't always the answer. It rewards diversified stat investment and exploration-oriented skill loadouts. It also creates moments where you look at the dialog options, realize you don't have what you need, and have to decide: fight now, or leave, go get the thing, and come back?
- **Variants**: Negotiate safe passage for someone else (tied to escort quests). Negotiate a ceasefire between two NPC factions occupying nearby hexes. Negotiate with a Breach Guardian — impossible normally, but the Strange Robed Figure's chain quest might unlock it, letting you seal a breach without a fight.
- **Natural source pairings**: Lord ("convince the eastern settlers to join us"), Merchant ("my competitor is undercutting me — talk to them"), Hermit ("something intelligent lives in the cave nearby — I need you to tell it to leave"), Corrupted Knight ("I can't fight what I've become — find another way to free me").

## Wrinkles and Complications

### Ambushes
When you're on a quest, enemies know. At some point during the journey (50% chance per turn while carrying a quest item, or when you reach a specific hex), an ambush triggers: 2-4 enemies spawn in a ring around you. The spawn composition scales with quest tier. This is the game saying "you thought this was a fetch quest, surprise."

### Betrayal
The Strange Robed Figure's quests have a chance of being traps. You complete the objective and instead of a reward, the figure transforms into a Phase Wraith (or worse). Or the "item" you retrieved was actually a breach catalyst, and completing the quest opens a new breach. The reward still exists — you just have to fight for it.

### Moral Choice
The Maiden quest: you find her, but she's made a deal with the chaos. Bringing her back empowers the haven (reward) but also increases breach spawn rates for 10 turns. Leaving her gives you a different reward (she teaches you a skill as thanks for finding her, but the haven is disappointed). No right answer, just trade-offs.

### Timed Quests
Some quests have a turn limit. The farmer's crops will be consumed by chaos in 15 turns. The villager will flee in 8 turns. This interacts with the existing breach escalation — you're already under time pressure, and now there's a second clock. Do you take the quest knowing it might pull you away from a breach you need to seal?

### Chain Quests
The lord gives you a scout quest. When you report back, he gives you a hunt quest for what you found. When that's done, he sends you to clear the area. Three quests, escalating difficulty and reward, building a narrative arc. The figure's chain might span the whole game — each step more cryptic, the final reward transformative.

## Reward Tiers

### Tier 1 (Levels 1-3)
- 5-15 gold
- 1 non-magical item (tier 1-2)
- Fog reveal (radius 4 around a point)
- Small HP/Aether restore

### Tier 2 (Levels 3-5)
- 15-30 gold
- 1 magical item (tier 1-2) or choice of 2 non-magical
- Skill teaching (from quest giver, like a Hut)
- Create a gold deposit (value 10-20) on a nearby hex
- POI upgrade: a hex becomes a camp

### Tier 3 (Levels 5-8)
- 30-60 gold
- 1 magical item (tier 2-3)
- 1-2 stat points
- Permanent Aether capacity increase (+2)
- POI upgrade: a camp becomes a haven, or a new haven spawns
- Named unique item not in the normal loot table

### Tier 4 (Levels 7+, Figure/Lord only)
- 50-100 gold
- Choice of 2 magical items (tier 3)
- 3 stat points
- A skill not normally available (quest-exclusive)
- Seal a breach remotely (the figure does it as payment)
- Permanent buff: +1 MP, +2 vision, +10% dodge (pick one)

## Quest Generation

Quests should feel placed, not random. Some rules:

- **Havens** always have a lord or noble available for quests
- **Camps** sometimes have a farmer or villager
- **Wilderness** quest givers spawn based on game state: villagers appear when breaches are active (fleeing chaos), the figure appears after turn 20+, farmers appear near plains clusters
- **Max active quests**: 2-3 at a time. Too many and the player feels pulled in every direction instead of making meaningful choices
- **Quest target placement**: targets should be 8-15 hexes from the source — far enough to be a journey, close enough to be reachable in a session of play. Targets should never be on unreachable hexes
- **Quest giver persistence**: villagers and farmers disappear after ~10 turns if not accepted. Lords and the figure persist longer. Accepted quests don't expire (except timed ones)

## How Quests Reinforce Existing Drivers

- **Accumulation/Windfall**: quest rewards are windfalls on top of the normal combat-loot loop. A well-timed quest completion can feel like a breakthrough moment.
- **Scarcity of Agency**: choosing which quest to take (and which to ignore) is a meaningful decision. Taking a quest means NOT doing something else with those turns.
- **Guardianship**: escort and restore quests make you care about something besides yourself. The villager's survival, the land's health.
- **Escalating Commitment**: quests add reasons to push forward into dangerous territory. The target is past that breach, through that shattered zone.
- **Near-Miss Architecture**: timed quests that you *almost* complete. The villager was 2 turns from fleeing. The ambush killed you 1 hex from the turn-in.

## Visual Design Notes

- Quest source: large yellow **!** on the hex, pulsing gently
- Active quest target: yellow **?** or **X** marker, visible through fog as a directional indicator on the edge of vision
- Quest tracker: small panel showing active quest name, brief objective, distance to target
- Quest dialog: reuse the existing dialog overlay system. Portrait area could show a simple icon for the quest giver type
- Ambush: screen flash, enemies fade in rather than just appearing, combat log announces "Ambush!"

## Open Questions

- Should quest givers be killable by roaming enemies? (Yes — it creates urgency and makes the world feel dangerous, but might feel unfair if a quest giver dies before you even see them)
- Can you have multiple quests from the same source type? (Probably not — one lord quest, one figure quest, etc.)
- Should completed quests affect future quest generation? (Chain quests yes, but beyond that it might be overengineered for a first pass)
- Do quest items take inventory slots? (Adds tension but inventory is already tight)
- Should the figure's identity be revealed if you complete all their quests? (Yes — maybe they're a weakened version of something related to the Maw's lore)
