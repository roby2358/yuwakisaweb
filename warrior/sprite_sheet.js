// sprite_sheet.js — A fixed-grid sprite sheet with optional color tinting

export class SpriteSheet {
    constructor(src, cellW, cellH) {
        this.cellW = cellW;
        this.cellH = cellH;
        this.img = new Image();
        this.img.src = src;
        // Offscreen canvas for tinting — sized to one cell
        this.tmp = document.createElement('canvas');
        this.tmp.width = Math.ceil(cellW);
        this.tmp.height = Math.ceil(cellH);
        this.tmpCtx = this.tmp.getContext('2d');
    }

    isReady() {
        return this.img.complete && this.img.naturalWidth > 0;
    }

    // Draw cell (col, row) into ctx at (dx, dy) with size (dw, dh).
    // If tint is set, recolor all opaque pixels to that CSS color.
    draw(ctx, col, row, dx, dy, dw, dh, tint) {
        if (!this.isReady()) return;
        const sx = col * this.cellW, sy = row * this.cellH;
        const sw = this.cellW, sh = this.cellH;
        if (tint) {
            this.tmpCtx.clearRect(0, 0, sw, sh);
            this.tmpCtx.drawImage(this.img, sx, sy, sw, sh, 0, 0, sw, sh);
            this.tmpCtx.globalCompositeOperation = 'source-in';
            this.tmpCtx.fillStyle = tint;
            this.tmpCtx.fillRect(0, 0, sw, sh);
            this.tmpCtx.globalCompositeOperation = 'source-over';
            ctx.drawImage(this.tmp, 0, 0, sw, sh, dx, dy, dw, dh);
        } else {
            ctx.drawImage(this.img, sx, sy, sw, sh, dx, dy, dw, dh);
        }
    }
}
