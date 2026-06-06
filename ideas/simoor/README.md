# The Night of the Simoor

A bawdy, PG-13 sci-fi-fantasy game of mistaken identity on a hex grid. Once a year the
desert wind — the *simoor* — blows in and the Sapphire Court throws a masked revel.
Somewhere in the crowd of identically-veiled figures is the **Veiled Sovereign**. Find
them, woo them, and win the night — before the insufferable **Vicomte de Vavoom** does,
and without piling up so much Scandal that the Veil-Wardens throw you out.

Built on the hex-and-counter base game. See [DYNAMICS.md](DYNAMICS.md) for the full
design (theme, drivers, mechanics, state model, strategies).

## Running

No build step. Serve over HTTP so the ES6 module imports resolve:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the served page.

## How to play

- **Click yourself** (the gold **You** counter), then a glowing yellow hex, to **move**.
  Poise (your movement budget) refreshes each turn. The whole **crowd of 12 revelers
  blocks movement** for you, the Vicomte, and the figures — the open lanes shift each turn.
- **Until you claim a Favor, the court is masked.** Impostors, revelers, and the **Veiled
  Sovereign** all look like identical blank counters — nobody is readable, no `?`s, no `G`s.
  Claiming a **Favor** is what *opens the court*.
- Revelers **carry tokens**, drawn **centered** on the counter. Move beside a carrier
  (**cyan ring**) and **click it** to claim. **Claiming ends your turn** — like a woo, it's
  a commitment that costs you the rest of the night's tempo, so it's a turn you didn't spend
  closing on the Sovereign (and a turn the Vicomte gets to move):
  - **Favor (❀)** → your **invitation**. The **first one claimed by anyone** opens the
    court: the impostors and the Sovereign all turn to `?`, and the Gossips light up. (It
    helps the Vicomte too, so it's a real decision.)
  - **Gossip (G)** → *once the court is open*, privately unmasks one impostor (turns grey
    **x**). Contested and private: whoever claims it first denies it to the other, and you
    never see what the Vicomte has learned.
- **Don't approach royalty uninvited.** Before you hold a favor the Sovereign is a blank in
  the crowd — **click it while adjacent and you're expelled on the spot.** The favor makes
  the approach safe.
- Once the court is open, **click a pink-ringed `?`** to **woo** it (move adjacent +
  commit, one click).
  - Right one → **you win**.
  - Wrong one → a **Scandal** hit, worse in public rooms, and the figure flounces off.
    Fill the Scandal meter and you're ejected.
- The **Vicomte de Vavoom** starts **at your elbow** and races you for favors, gossips, and
  the Sovereign — but at **half your speed**, so out-pace him.
- **Right-drag** to pan. **Space / Enter** (or **Wait**) passes your turn.
- **New Night** regenerates everything.

The squeeze: the Sovereign loves the glamorous, public zones (the gold **Ballroom**),
which are exactly where misbehaving costs the most Scandal. You can't win from the safe
shadows, and **Dawn** (a turn limit) forces a decision. Certainty vs. speed vs. composure.

## Status

**v1** is playable: move, the masked court, Gossip clues, wooing, the Scandal meter, the
moving figures, and the Vicomte (driven by the base game's A* pathfinding). Planned next:
charmable guards + fainting obstacles, the Rumor weapon, and the slipped-away tryst
(see the *Implementation Layers* section of DYNAMICS.md).
