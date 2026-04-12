# DEFRAG — Dynamics

A solo puzzle game about consolidating a failing disk before corruption reaches the Master File Table.

## Theme

You are the defrag process. The disk is dying. Files scatter as the OS keeps writing, bad sectors creep in from the edge, and the MFT — the sector that indexes everything — sits at the center, waiting to be defended. Every turn is triage: which file do you save, which do you sacrifice, and do you have enough seek budget to reach the cluster that matters most?

The emotional target is the old Windows defrag display: the hypnotic pleasure of watching chaos shuffle into order, pulled taut against the dread of a disk you're not sure you can save.

## Drivers

- **Scarcity of Agency** — Seek budget per turn is finite. You cannot defrag every file every turn. Choosing which fragments to chase is the game.
- **Accumulation and Windfall** — A defragged file is a permanent gain: new OS writes to that file extend the existing cluster instead of scattering. Each defragged file compounds by freeing attention for the next one. The windfall is the turn where three fragments fall into place with one swap.
- **Near-Miss Architecture** — Corruption spread escalates every 5 turns. The disk gets loud at exactly the point you're running out of budget. You almost saved it.
- **Guardianship** — The MFT is a single named sector at the center. Corruption touching it drains integrity. You are not just optimizing — you are protecting.
- **Readable Consequences** — The grid is the entire state. Nothing is hidden. Every loss can be traced back to the swap you didn't make.

## Key Mechanics

### Swap & Clock (Scarcity of Agency)
Click two sectors to swap them. Cost = Manhattan distance. There is no per-turn budget; instead, a single running **clock** accumulates the total distance you have ever moved this game. Every 20 units of accumulated movement, a **tick** fires — the disk runs its periodic update (writes, corruption spread, freshness decay, MFT damage). Locked sectors (system, bad, MFT) cannot be moved. A big 30-distance swap at the wrong time can trigger *two* ticks in one action (crossing both the next and the one after), while a careful sequence of 1- and 2-cost nudges costs nothing in "wasted budget" — they just push you steadily closer to the next tick. The central question is no longer "do I have enough seek left?" but "is this move worth the fraction of a tick it will cost me, and is the corruption about to catch up before I finish consolidating?"

### Continuous Run = Defragged (Accumulation)
A file is DEFRAGGED when all of its blocks occupy **consecutive sector indices** in reading order (index = y × COLS + x) — a horizontal run that naturally wraps from the right edge of one row to the left edge of the next. Vertical columns and L-shapes and 2×2 squares don't count; the filesystem doesn't care how tidy your cluster *looks*, it cares whether the blocks are in sequence on the linear address line. This matches how a real filesystem thinks about contiguity, and it makes the defrag puzzle harder in a principled way: the target shape is a 1D run, not a 2D blob, so obstacles (system blocks, the MFT) are more punishing because they can only be routed around the row-wrap path, not over or under. Defragged files attract new OS writes to an adjacent empty cell (extending the run at one of its ends), so alignment compounds once you lock it in. Breaking the run (corruption, a write that lands off-line, a swap) re-fragments the file.

### Archive Cleanses (Double-Edged)
A defragged file can be ARCHIVED: its blocks vanish, scoring 100/block, AND every bad sector orthogonally adjacent to the archived blocks is cleansed. This makes positioning matter twice — a defragged file parked next to the MFT is both a score and a weapon. But you only get to cleanse once per file, and archiving removes it from your win count budget (you need 4 archives to win, and there are only 4 files).

### Corruption Spread (Near-Miss + Loss Aversion)
Each turn, every bad sector has a chance to spread to a random orthogonal non-locked, non-fresh neighbor. Base chance 20%, +5% every 5 turns.

If the victim cell is a **file block**, the entire file is marked **LOST** on the spot — a single corrupted sector condemns the whole file. The moment this happens, the player takes a penalty of **-100 per block in the file** (including the block that just got corrupted; "the whole file" is counted at its size at the moment of loss). The file's surviving sectors remain on the board — they can still be moved, and their swaps still generate freshness — but the file can no longer be defragged or archived. Subsequent corruptions of the same file's sectors just remove blocks without further penalty.

This rule turns corruption from "a nibbling that reduces archive payout" into "a guillotine that deletes an entire objective from the board." It dramatically raises the stakes of letting corruption touch a file even once, and it is the clearest expression of **loss aversion** in the game: protecting a file from its first corruption is now more valuable than any amount of score-mining.

### Freshness (Scarcity of Agency + Double-Edged)
Whenever you swap two sectors, every orthogonal neighbor of both endpoints becomes **fresh** — protected from corruption spread. Fresh is not a separate kind; it's a flag on top of empty or file sectors. Fresh sectors are visibly marked with a cyan inner border. Each end of turn, every fresh sector has a 10% chance to decay back to normal, so freshness is a renewable but leaky buff — keep swapping to refresh your frontline, or let the flags lapse and hope the dice are kind. This mechanic quietly turns "where you swap" into a second decision layer: a swap near the corruption front is now doing double duty (defrag progress + barrier reinforcement), while a swap in a safe corner wastes the protective side effect.

### MFT Damage (Guardianship)
Each turn, the MFT takes damage equal to the number of bad sectors orthogonally adjacent to it. Starts at 5 integrity. Zero = disk lost. The MFT is the loss-aversion anchor: every mechanic eventually routes through "is the MFT safe?"

## Secondary Mechanics

- **OS Writes** — Each tick runs one write event, which rolls a 4-way split:
  - **1/4**: a new **locked system sector** at a random empty cell. The OS is flushing system data and eats a square of terrain.
  - **1/2**: a **new block appended to an existing active file**, extending the cluster's run if defragged or landing randomly if fragmented.
  - **1/4**: a **new-file check**. Sample a random active file; the chance of actually spawning a new file is linear in that file's current size — 0% at size 4, 100% at size 20. If the roll succeeds, a new file is created: pick a distinct filesystem name, generate a distinct bright color (random hue, saturation 0.7, luminance 0.55), add it to the file list, seed it with a single starting block at a random empty cell, and continue. A new 1-block file is trivially "defragged" and could be archived immediately for a quick 100 points and a small cleanse — but each new file is also another objective that must eventually resolve (archive or lose) for the game to end, so spawning files extends the game and raises the final-score ceiling. The math creates a feedback loop: large files breed more files, so letting a file balloon past size 12 or so is a strategic tradeoff between the bigger archive payout and the new work it will generate. Longer-running games organically develop both terrain and fresh objectives.
- **System Sectors** — Immobile gray blocks scattered at start. Terrain. They break line-of-defrag, block corruption from spreading into them, and force the player to route around them.
- **Initial Bad Sector** — One bad sector spawns on an edge at start. This is the seed of corruption; it is also your revenge target — the thing that killed the file you lost.

## Strategies

**Early (turns 1-5)** — Identify your two most-clustered files. Do cheap short swaps to consolidate them. Ignore the edge bad sector; it's slow. Defragged count: 1-2.

**Mid (turns 6-12)** — First archive. Pick a defragged file near enough to the corruption front that cleansing matters; even better if near the MFT. Writes are now extending your defragged file, so you're net-positive on that one. Start the second defrag with the breathing room.

**Late (turns 13+)** — Corruption rate is high. Bad sectors are advancing on the MFT. You'll have to sacrifice one file — usually the one whose blocks ended up farthest from its siblings. Race to archive three; use the fourth as a cleanse-bomb near the MFT if needed.

**Anti-strategies**:
- **Turtle** — Don't move, wait it out. *Prevented by:* writes fragment you further, corruption keeps spreading, MFT eventually dies.
- **Archive-first** — Archive the moment any file is defragged. *Prevented by:* you give up cleanse positioning, and corruption wins the MFT.
- **Defrag-all-then-archive** — Defrag all 4 files before archiving any. *Prevented by:* corruption and writes will break your earlier defrags before you finish the later ones. You have to archive on a rolling basis.
- **Ignore corruption** — Focus only on files. *Prevented by:* MFT dies. Hard loss.

## Tuning

- Grid: 32 × 16 (512 sectors)
- Files: 4, each 4–7 blocks at start (uniform random per file)
- System obstacles: 20
- Tick threshold: one tick every 20 units of accumulated movement (no per-turn budget; swaps are always allowed)
- Writes per tick: 1 (each has a 1/3 chance of being a new system-lock instead of a file block)
- Corruption spread: 20% base, +5% every 5 turns
- Freshness decay: 10% per fresh sector per turn
- MFT integrity: 5
- End game triggers when either (a) MFT integrity ≤ 0 or (b) every file is resolved (archived or lost)
  - All archived → **DISK RESTORED** (full win)
  - Mixed archived + lost → **PARTIAL RECOVERY** (score-dependent outcome)
  - All lost or MFT dead → **DISK LOST / WIPED** (loss)

Numbers are first-pass. Halve and double first if the feel is wrong.
