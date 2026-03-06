// screen.js — Canvas-based 80x25 text mode renderer

const BOX = {
    [BD_IN]:  { tl:'\u2554',tr:'\u2557',bl:'\u255A',br:'\u255D',h:'\u2550',v:'\u2551' },
    [BD_OUT]: { tl:'\u250C',tr:'\u2510',bl:'\u2514',br:'\u2518',h:'\u2500',v:'\u2502' },
};

// Characters rendered as filled rectangles instead of font glyphs
const FILL_CHARS = {
    [BLOCK]:   1.0,
    [DKBLOCK]: 0.75,
    [MDBLOCK]: 0.50,
    [LTBLOCK]: 0.25,
};

class Screen {
    constructor(canvas) {
        this.cols = 80;
        this.rows = 25;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellW = 10;
        this.cellH = 20;
        this.fontSize = 15;
        this.font = `${this.fontSize}px monospace`;

        canvas.width  = this.cols * this.cellW;
        canvas.height = this.rows * this.cellH;

        // screen bounds for split_screen
        this.x1 = 0;
        this.x2 = this.cols - 1;

        // cell buffer
        this.cells = [];
        for (let i = 0; i < this.cols * this.rows; i++)
            this.cells.push({ ch: ' ', attr: BACKGR });

        // key input
        this._keyResolve = null;
        this._keyQueue = [];
        this._backtick = false;  // debug prefix state

        document.addEventListener('keydown', e => {
            if (e.key === 'Tab' || e.key === 'F5') return; // let browser handle
            e.preventDefault();
            // backtick prefix for debug keys
            if (e.key === '`') { this._backtick = true; return; }
            const ev = { key: e.key, code: e.code, debug: this._backtick };
            this._backtick = false;
            if (this._keyResolve) {
                const res = this._keyResolve;
                this._keyResolve = null;
                res(ev);
            } else {
                this._keyQueue.push(ev);
            }
        });

        canvas.addEventListener('click', () => {
            const ev = { key: 'Enter', code: 'Enter', debug: false };
            if (this._keyResolve) {
                const res = this._keyResolve;
                this._keyResolve = null;
                res(ev);
            } else {
                this._keyQueue.push(ev);
            }
        });

        this.clear(BACKGR);
    }

    waitKey() {
        if (this._keyQueue.length) return Promise.resolve(this._keyQueue.shift());
        return new Promise(res => { this._keyResolve = res; });
    }

    flushKeys() { this._keyQueue.length = 0; }

    plot(x, y, ch, attr) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
        const i = y * this.cols + x;
        this.cells[i].ch = ch;
        this.cells[i].attr = attr;
        this._draw(x, y, ch, attr);
    }

    putStr(x, y, str, attr) {
        for (let i = 0; i < str.length; i++) this.plot(x + i, y, str[i], attr);
    }

    clear(attr) {
        const a = attr != null ? attr : BACKGR;
        for (let y = 0; y < this.rows; y++)
            for (let x = 0; x < this.cols; x++)
                this.plot(x, y, ' ', a);
    }

    box(style, x1, y1, x2, y2, attr) {
        const fill = style & BD_FILL;
        const bd   = style & 0x0F;
        const a    = attr != null ? attr : BACKGR;
        if (fill) {
            for (let yy = y1; yy <= y2; yy++)
                for (let xx = x1; xx <= x2; xx++)
                    this.plot(xx, yy, ' ', a);
        }
        const b = BOX[bd];
        if (!b) return;
        this.plot(x1, y1, b.tl, a); this.plot(x2, y1, b.tr, a);
        this.plot(x1, y2, b.bl, a); this.plot(x2, y2, b.br, a);
        for (let xx = x1+1; xx < x2; xx++) { this.plot(xx, y1, b.h, a); this.plot(xx, y2, b.h, a); }
        for (let yy = y1+1; yy < y2; yy++) { this.plot(x1, yy, b.v, a); this.plot(x2, yy, b.v, a); }
    }

    screenFade() {
        const a  = 9 | BLUEBK;
        const ch = [' ', LTBLOCK, MDBLOCK, DKBLOCK, BLOCK];
        const n  = ch.length;
        for (let y = 0; y < this.rows; y++)
            for (let x = 0; x < this.cols; x++) {
                let r = Math.floor((y+1) * n * 25 / (25 * R(1, 50)));
                if (r >= n) r = n - 1;
                this.plot(x, y, ch[r], a);
            }
    }

    // --- internal rendering ---

    _draw(x, y, ch, attr) {
        const px = x * this.cellW;
        const py = y * this.cellH;
        const fg = attr & 0x0F;
        const bg = (attr >> 4) & 0x0F;

        // background
        this.ctx.fillStyle = PALETTE[bg];
        this.ctx.fillRect(px, py, this.cellW, this.cellH);

        if (!ch || ch === ' ') return;

        // block characters as filled rects
        const fillAmt = FILL_CHARS[ch];
        if (fillAmt !== undefined) {
            if (fillAmt >= 1) {
                this.ctx.fillStyle = PALETTE[fg];
                this.ctx.fillRect(px, py, this.cellW, this.cellH);
            } else {
                this.ctx.fillStyle = PALETTE[fg];
                this.ctx.globalAlpha = fillAmt;
                this.ctx.fillRect(px, py, this.cellW, this.cellH);
                this.ctx.globalAlpha = 1;
            }
            return;
        }

        // lower-half block
        if (ch === LHALF) {
            this.ctx.fillStyle = PALETTE[fg];
            this.ctx.fillRect(px, py + Math.floor(this.cellH/2), this.cellW, Math.ceil(this.cellH/2));
            return;
        }

        // regular glyph
        this.ctx.fillStyle = PALETTE[fg];
        this.ctx.font = this.font;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(ch, px + this.cellW/2, py + this.cellH/2);
    }
}
