// renderer.js — Sprite loading, hex rendering on canvas

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load ' + src));
        img.src = src;
    });
}

function hexPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + Math.PI / 3 * i;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
}

class HexRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.terrainImg = null;
        this.monsterImg = null;
        this.effectImg = null;
        // Pre-processed hex sprites: terrainHex[terrainType][variation] = ImageBitmap/canvas
        this.terrainHex = [];
        this.monsterHex = []; // monsterHex[row][col] = canvas (transparent bg)
        this.effectHex = [];  // effectHex[row][col] = canvas (transparent bg)
        this._sizeCanvas();
    }

    _sizeCanvas() {
        // Compute canvas size from map dimensions
        const maxCX = hexCX(MAP_W - 1, 1); // odd row is rightmost
        const maxCY = hexCY(0, MAP_H - 1);
        this.canvas.width = maxCX + HEX_R + MAP_PAD + 4;
        this.canvas.height = maxCY + HEX_R + MAP_PAD + 4;
    }

    async loadSprites() {
        [this.terrainImg, this.monsterImg, this.effectImg] = await Promise.all([
            loadImage('terrain.png'),
            loadImage('monsters.png'),
            loadImage('effects.png'),
        ]);
        this._processTerrainSprites();
        this._processMonsterSprites();
        this._processEffectSprites();
    }

    _makeHexSprite(srcImg, sx, sy, sw, sh) {
        const c = document.createElement('canvas');
        c.width = HEX_R * 2 + 2;
        c.height = HEX_R * 2 + 2;
        const ctx = c.getContext('2d');
        const cx = c.width / 2, cy = c.height / 2;
        ctx.save();
        hexPath(ctx, cx, cy, HEX_R);
        ctx.clip();
        // Draw sprite centered, scaled to fill hex
        const dw = HEX_W + 4, dh = HEX_H;
        ctx.drawImage(srcImg, sx, sy, sw, sh, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.restore();
        return c;
    }

    _makeTransparentHexSprite(srcImg, sx, sy, sw, sh, bgTest) {
        const c = document.createElement('canvas');
        c.width = HEX_R * 2 + 2;
        c.height = HEX_R * 2 + 2;
        const ctx = c.getContext('2d');
        const cx = c.width / 2, cy = c.height / 2;
        ctx.save();
        hexPath(ctx, cx, cy, HEX_R);
        ctx.clip();
        const dw = HEX_W + 4, dh = HEX_H;
        ctx.drawImage(srcImg, sx, sy, sw, sh, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.restore();
        // Remove background pixels
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            if (bgTest(d[i], d[i + 1], d[i + 2])) d[i + 3] = 0;
        }
        ctx.putImageData(imgData, 0, 0);
        return c;
    }

    _processTerrainSprites() {
        this.terrainHex = [];
        for (let t = 0; t < NUM_TERRAIN; t++) {
            const row = TERRAIN_SPRITE_ROW[t];
            const arr = [];
            for (let col = 0; col < SPRITE_COLS; col++) {
                arr.push(this._makeHexSprite(
                    this.terrainImg,
                    col * SPRITE_W, row * SPRITE_H, SPRITE_W, SPRITE_H
                ));
            }
            this.terrainHex.push(arr);
        }
    }

    _makeTransparentSprite(srcImg, sx, sy, sw, sh, bgTest) {
        const c = document.createElement('canvas');
        c.width = sw;
        c.height = sh;
        const ctx = c.getContext('2d');
        ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, sw, sh);
        const imgData = ctx.getImageData(0, 0, sw, sh);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            if (bgTest(d[i], d[i + 1], d[i + 2])) d[i + 3] = 0;
        }
        ctx.putImageData(imgData, 0, 0);
        return c;
    }

    _processMonsterSprites() {
        this.monsterHex = [];
        const isSilver = (r, g, b) => r > 140 && g > 140 && b > 140 &&
            Math.abs(r - g) < 40 && Math.abs(g - b) < 40;
        for (let row = 0; row < 10; row++) {
            const arr = [];
            for (let col = 0; col < SPRITE_COLS; col++) {
                arr.push(this._makeTransparentSprite(
                    this.monsterImg,
                    col * SPRITE_W, row * SPRITE_H, SPRITE_W, SPRITE_H,
                    isSilver
                ));
            }
            this.monsterHex.push(arr);
        }
    }

    _processEffectSprites() {
        // 3 effect types (miss, hit, rest), each with 2 rows × EFFECT_COLS frames
        // effectHex[type] = flat array of all frames for that type
        this.effectHex = [];
        const isWhitish = (r, g, b) => r > 220 && g > 220 && b > 220;
        for (let type = 0; type < 3; type++) {
            const arr = [];
            for (let subRow = 0; subRow < EFFECT_ROWS_PER_TYPE; subRow++) {
                const imgRow = type * EFFECT_ROWS_PER_TYPE + subRow;
                for (let col = 0; col < EFFECT_COLS; col++) {
                    arr.push(this._makeTransparentHexSprite(
                        this.effectImg,
                        col * EFFECT_SPRITE_W, imgRow * EFFECT_SPRITE_H,
                        EFFECT_SPRITE_W, EFFECT_SPRITE_H,
                        isWhitish
                    ));
                }
            }
            this.effectHex.push(arr);
        }
    }

    clear() {
        this.ctx.fillStyle = '#1a1a10';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawHex(col, row, terrainType, variation) {
        const cx = hexCX(col, row), cy = hexCY(col, row);
        const v = variation % SPRITE_COLS;
        const sprite = this.terrainHex[terrainType][v];
        this.ctx.drawImage(sprite, cx - sprite.width / 2, cy - sprite.height / 2);
    }

    _roundRectPath(x, y, w, h, r) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.arcTo(x + w, y, x + w, y + r, r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.arcTo(x, y + h, x, y + h - r, r);
        this.ctx.lineTo(x, y + r);
        this.ctx.arcTo(x, y, x + r, y, r);
        this.ctx.closePath();
    }

    drawMonster(col, row, archetypeIdx, spriteCol, color) {
        const cx = hexCX(col, row), cy = hexCY(col, row);
        const s = SPRITE_W; // counter size = sprite size (32)
        const x = cx - s / 2, y = cy - s / 2;
        const r = 4; // corner radius
        // Colored background fill
        this.ctx.fillStyle = color;
        this._roundRectPath(x, y, s, s, r);
        this.ctx.fill();
        // Clip silhouette to rounded rect
        this.ctx.save();
        this._roundRectPath(x, y, s, s, r);
        this.ctx.clip();
        const sprite = this.monsterHex[archetypeIdx % 10][spriteCol % SPRITE_COLS];
        this.ctx.drawImage(sprite, cx - sprite.width / 2, cy - sprite.height / 2);
        this.ctx.restore();
        // Outline — 1px black, 2px dark gray depth on bottom and right
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this._roundRectPath(x + 0.5, y + 0.5, s - 1, s - 1, r);
        this.ctx.stroke();
        this.ctx.strokeStyle = '#888888';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 2; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + 2 + i, y + s + 1 + i);
            this.ctx.arcTo(x + s + 1 + i, y + s + 1 + i, x + s + 1 + i, y + s - r + 1 + i, r);
            this.ctx.lineTo(x + s + 1 + i, y + 2 + i);
            this.ctx.stroke();
        }
    }

    drawEffect(col, row, effectType, frame) {
        const cx = hexCX(col, row), cy = hexCY(col, row);
        const frames = this.effectHex[effectType % 3];
        const sprite = frames[frame % frames.length];
        this.ctx.drawImage(sprite, cx - sprite.width / 2, cy - sprite.height / 2);
    }

    highlightHex(col, row, color, alpha) {
        const cx = hexCX(col, row), cy = hexCY(col, row);
        const s = SPRITE_W;
        const x = cx - s / 2, y = cy - s / 2;
        this.ctx.save();
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = alpha || 0.3;
        this._roundRectPath(x, y, s, s, 4);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
        this.ctx.restore();
    }

    drawHexOutline(col, row, color, width) {
        const cx = hexCX(col, row), cy = hexCY(col, row);
        const s = SPRITE_W;
        const x = cx - s / 2, y = cy - s / 2;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width || 1;
        this._roundRectPath(x + 0.5, y + 0.5, s - 1, s - 1, 4);
        this.ctx.stroke();
    }

    // Draw the full map grid (terrain only)
    drawMap(hexmap) {
        this.clear();
        for (let r = 0; r < hexmap.h; r++)
            for (let c = 0; c < hexmap.w; c++)
                this.drawHex(c, r, hexmap.get(c, r), hexmap.getVar(c, r));
    }

    // Redraw a single cell (terrain + optionally guy)
    drawCell(hexmap, col, row) {
        this.drawHex(col, row, hexmap.get(col, row), hexmap.getVar(col, row));
    }
}
