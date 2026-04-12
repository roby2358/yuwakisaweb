// auto.js — Fill and auto-defrag for DEFRAG.
//
// FILL: populates the disk to ~90% with fragmented files.
// AUTO: removes corruption, enables autoMode, and defrags whatever is
//       on the disk — works mid-game or after a fill.

export class Auto {
  constructor(game) {
    this.game = game;
    this.running = false;
  }

  // ---- Fill disk to ~90% with files ----
  fill() {
    const g = this.game;
    g.init();
    g.state.autoMode = true;
    this.removeBadSectors();

    const totalCells = g.COLS * g.ROWS;
    const target = Math.floor(totalCells * 0.90);

    const occupied = () => {
      let n = 0;
      for (let y = 0; y < g.ROWS; y++) {
        for (let x = 0; x < g.COLS; x++) {
          if (g.state.grid[y][x].kind !== g.EMPTY) n++;
        }
      }
      return n;
    };

    const firstEmpty = () => {
      for (let y = 0; y < g.ROWS; y++) {
        for (let x = 0; x < g.COLS; x++) {
          if (g.at(x, y).kind === g.EMPTY) return { x, y };
        }
      }
      return null;
    };

    while (occupied() < target) {
      const start = firstEmpty();
      if (!start) break;
      const id = g.state.files.length;
      const file = {
        id,
        name: g.pickFileName(),
        color: g.state.palette[id % g.PALETTE_SIZE],
        blocks: [],
        archived: false,
        defragged: false,
        lost: false,
      };
      g.state.files.push(file);
      const size = 7 + Math.floor(Math.random() * 18); // 7-24
      g.state.grid[start.y][start.x] = { kind: g.FILE, fileId: id };
      let prev = start;
      for (let b = 1; b < size; b++) {
        let next;
        if (Math.random() < 0.5) {
          next = this.nextEmptyInReadingOrder(prev);
          if (!next) next = g.findEmpty();
        } else {
          next = g.findEmpty();
        }
        if (!next) break;
        g.state.grid[next.y][next.x] = { kind: g.FILE, fileId: id };
        prev = next;
      }
    }
    g.syncFiles();
    g.render();
  }

  // ---- Auto defrag ----
  // Works on the current disk state: removes corruption, then defrags
  // every active file using a write cursor that advances from the front.
  // For each file: buffer its blocks to the back, then write them forward
  // starting at the cursor, evicting any foreign blocks along the way.
  async defrag() {
    const g = this.game;
    g.state.autoMode = true;
    g.state.gameOver = false;
    this.removeBadSectors();
    for (const f of g.state.files) {
      if (f.lost) f.lost = false;
    }
    g.syncFiles();
    g.render();

    this.running = true;
    const total = g.COLS * g.ROWS;
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    // Sort files by their lowest block index — pack left-to-right.
    g.syncFiles();
    const files = g.activeFiles().slice().sort((a, b) => {
      const minA = Math.min(...a.blocks.map((bl) => bl.y * g.COLS + bl.x));
      const minB = Math.min(...b.blocks.map((bl) => bl.y * g.COLS + bl.x));
      return minA - minB;
    });

    let cursor = 0;

    for (const file of files) {
      if (!this.running) break;
      g.syncFiles();
      if (file.blocks.length === 0 || file.archived) continue;

      const blockCount = file.blocks.length;

      // Compute the target zone: the next blockCount non-locked indices
      // from cursor. Blocks already in this zone can stay.
      const targetSet = new Set();
      let idx2 = cursor;
      let needed = blockCount;
      while (needed > 0 && idx2 < total) {
        const x2 = idx2 % g.COLS;
        const y2 = Math.floor(idx2 / g.COLS);
        const kind = g.at(x2, y2).kind;
        if (kind !== g.SYSTEM && kind !== g.MFT) {
          targetSet.add(idx2);
          needed--;
        }
        idx2++;
      }

      // Only buffer blocks that are outside the target zone.
      const toBuffer = file.blocks.filter(
        (b) => !targetSet.has(b.y * g.COLS + b.x)
      );

      // Phase 1: buffer — move out-of-place blocks to the back.
      let bufIdx = total - 1;
      for (const b of toBuffer) {
        if (!this.running) break;
        while (bufIdx >= 0) {
          const bx = bufIdx % g.COLS;
          const by = Math.floor(bufIdx / g.COLS);
          if (g.at(bx, by).kind === g.EMPTY) break;
          bufIdx--;
        }
        if (bufIdx < 0) break;
        const bx = bufIdx % g.COLS;
        const by = Math.floor(bufIdx / g.COLS);
        g.state.grid[b.y][b.x] = { kind: g.EMPTY };
        g.state.grid[by][bx] = { kind: g.FILE, fileId: file.id };
        bufIdx--;
        g.render();
        await delay(12);
      }
      if (toBuffer.length > 0) {
        g.syncFiles();
        await delay(40);
      }

      // Phase 2: restore — write blocks from cursor, evicting foreign
      // blocks to the back as needed.
      g.syncFiles();
      const buffered = file.blocks.map((b) => ({ x: b.x, y: b.y }));
      let bi = 0;
      let idx = cursor;
      while (bi < buffered.length && idx < total) {
        if (!this.running) break;
        const x = idx % g.COLS;
        const y = Math.floor(idx / g.COLS);
        const kind = g.at(x, y).kind;

        // Skip locked cells.
        if (kind === g.SYSTEM || kind === g.MFT) {
          idx++;
          continue;
        }

        // Already ours — skip, no work needed.
        if (kind === g.FILE && g.at(x, y).fileId === file.id) {
          bi++;
          idx++;
          continue;
        }

        // Evict foreign file block to the back.
        if (kind === g.FILE) {
          const dest = this.findEmptyFromBack();
          if (dest) {
            g.state.grid[dest.y][dest.x] = g.state.grid[y][x];
            g.state.grid[y][x] = { kind: g.EMPTY };
            g.render();
            await delay(6);
          }
        }

        // Slot is empty — place our block.
        const src = buffered[bi];
        g.state.grid[src.y][src.x] = { kind: g.EMPTY };
        g.state.grid[y][x] = { kind: g.FILE, fileId: file.id };
        bi++;
        g.render();
        await delay(12);
        idx++;
      }

      // Advance cursor past this file.
      cursor = idx;
      g.syncFiles();
      g.render();
    }
    this.running = false;
  }

  findEmptyFromBack() {
    const g = this.game;
    const total = g.COLS * g.ROWS;
    for (let idx = total - 1; idx >= 0; idx--) {
      const x = idx % g.COLS;
      const y = Math.floor(idx / g.COLS);
      if (g.at(x, y).kind === g.EMPTY) return { x, y };
    }
    return null;
  }

  removeBadSectors() {
    const g = this.game;
    for (let y = 0; y < g.ROWS; y++) {
      for (let x = 0; x < g.COLS; x++) {
        if (g.state.grid[y][x].kind === g.BAD) {
          g.state.grid[y][x] = { kind: g.EMPTY };
        }
      }
    }
  }

  nextEmptyInReadingOrder(start) {
    const g = this.game;
    const total = g.COLS * g.ROWS;
    const startIdx = start.y * g.COLS + start.x;
    for (let i = 1; i <= total; i++) {
      const idx = (startIdx + i) % total;
      const x = idx % g.COLS;
      const y = Math.floor(idx / g.COLS);
      if (g.at(x, y).kind === g.EMPTY) return { x, y };
    }
    return null;
  }
}
