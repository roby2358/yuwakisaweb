// Canvas Rendering

import { HEX_SIZE, TERRAIN_COLORS, RESOURCE_COLORS, SETTLEMENT_COLORS, UNIT_COLORS, UNIT_TYPE, SETTLEMENT_GROWTH_THRESHOLD } from './config.js';
import { hexToPixel, drawHexPath, hexNeighbors } from './hex.js';

export class Renderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;

        this.offsetX = 0;
        this.offsetY = 0;

        // Map view mode: 'terrain' or 'population'
        this.mapMode = 'terrain';

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    toggleMapMode() {
        this.mapMode = this.mapMode === 'terrain' ? 'population' : 'terrain';
        this.render();
        return this.mapMode;
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth - 220; // Account for side panel
        this.canvas.height = container.clientHeight;

        // Center the map
        this.offsetX = this.canvas.width / 2;
        this.offsetY = this.canvas.height / 2;

        this.render();
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.mapMode === 'population') {
            this.renderPopulationMap();
            return;
        }

        // Draw all hexes
        for (const [key, hex] of this.game.hexes) {
            this.drawHex(hex);
        }

        // Draw grid lines
        for (const [key, hex] of this.game.hexes) {
            this.drawHexBorder(hex);
        }

        // Draw resources
        for (const [key, hex] of this.game.hexes) {
            if (hex.resource) {
                this.drawResource(hex);
            }
        }

        // Draw danger points
        for (const [key, hex] of this.game.hexes) {
            if (hex.dangerPoint) {
                this.drawDangerPoint(hex);
            }
        }

        // Draw installations
        for (const [key, hex] of this.game.hexes) {
            if (hex.installation) {
                this.drawInstallation(hex);
            }
        }

        // Draw settlements
        for (const settlement of this.game.settlements) {
            this.drawSettlement(settlement);
        }

        // Draw units
        for (const unit of this.game.units) {
            this.drawUnit(unit, false);
        }

        // Draw enemies
        for (const enemy of this.game.enemies) {
            this.drawEnemy(enemy);
        }

        // Draw selection highlight
        if (this.game.selectedHex) {
            this.drawSelection(this.game.selectedHex);
        }

        // Draw valid moves for selected unit
        if (this.game.selectedUnit) {
            this.drawValidMoves(this.game.selectedUnit);
        }

        // Draw controlled territory overlay
        this.drawControlledOverlay();
    }

    renderPopulationMap() {
        const ctx = this.ctx;
        const probabilities = this.game.getSpawnProbabilities();

        // Find max probability for scaling
        let maxProb = 0;
        for (const prob of probabilities.values()) {
            if (prob > maxProb) maxProb = prob;
        }

        // Draw all hexes with grayscale based on spawn probability
        for (const [key, hex] of this.game.hexes) {
            const { x, y } = this.getHexCenter(hex.q, hex.r);
            const prob = probabilities.get(key) || 0;

            // Use logarithmic scale so the gradient is visible
            // log(1 + x) / log(1 + max) gives 0-1 range with better spread
            let brightness = 0;
            if (maxProb > 0 && prob > 0) {
                const logProb = Math.log(1 + prob * 100);
                const logMax = Math.log(1 + maxProb * 100);
                brightness = Math.floor((logProb / logMax) * 255);
            }

            drawHexPath(ctx, x, y, HEX_SIZE);
            ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
            ctx.fill();
        }

        // Draw grid lines
        for (const [key, hex] of this.game.hexes) {
            this.drawHexBorder(hex);
        }

        // Draw settlements (so you can see where they are)
        for (const settlement of this.game.settlements) {
            this.drawSettlement(settlement);
        }

        // Draw resources (helpful context)
        for (const [key, hex] of this.game.hexes) {
            if (hex.resource) {
                this.drawResource(hex);
            }
        }
    }

    getHexCenter(q, r) {
        const { x, y } = hexToPixel(q, r);
        return {
            x: x + this.offsetX,
            y: y + this.offsetY
        };
    }

    // Draw a health bar at the specified position
    drawHealthBar(x, y, width, healthPercent, color = null) {
        const ctx = this.ctx;
        ctx.fillStyle = '#333';
        ctx.fillRect(x - width / 2, y, width, 3);
        ctx.fillStyle = color || (healthPercent > 0.5 ? '#4caf50' : healthPercent > 0.25 ? '#ff9800' : '#f44336');
        ctx.fillRect(x - width / 2, y, width * healthPercent, 3);
    }

    drawHex(hex) {
        const ctx = this.ctx;
        const { x, y } = this.getHexCenter(hex.q, hex.r);

        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.fillStyle = TERRAIN_COLORS[hex.terrain];
        ctx.fill();
    }

    drawHexBorder(hex) {
        const ctx = this.ctx;
        const { x, y } = this.getHexCenter(hex.q, hex.r);

        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawControlledOverlay() {
        const ctx = this.ctx;

        for (const [key, hex] of this.game.hexes) {
            if (hex.controlled) {
                const { x, y } = this.getHexCenter(hex.q, hex.r);
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fill();
            }
        }
    }

    drawResource(hex) {
        const ctx = this.ctx;
        const { x, y } = this.getHexCenter(hex.q, hex.r);
        const resourceY = y - HEX_SIZE * 0.3;

        // White highlight ring for controlled resources
        if (hex.controlled) {
            ctx.beginPath();
            ctx.arc(x, resourceY, 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fill();
        }

        // Resource dot
        ctx.beginPath();
        ctx.arc(x, resourceY, 6, 0, Math.PI * 2);
        ctx.fillStyle = RESOURCE_COLORS[hex.resource];
        ctx.fill();
        ctx.strokeStyle = hex.controlled ? '#fff' : '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawDangerPoint(hex) {
        const ctx = this.ctx;
        const { x, y } = this.getHexCenter(hex.q, hex.r);
        const danger = hex.dangerPoint;

        // Pulsing danger indicator
        const pulse = 0.8 + Math.sin(Date.now() / 500) * 0.2;

        // Draw pentagon
        const radius = HEX_SIZE * 0.4;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5);
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();

        ctx.fillStyle = `rgba(255, 82, 82, ${pulse})`;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Danger size (strength)
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(danger.strength, x, y);

        // Spawn progress bar
        const spawnRates = [4, 3, 3, 2, 2, 1];
        const maxSpawnTime = spawnRates[danger.strength - 1] || 1;
        const spawnProgress = (maxSpawnTime - danger.turnsUntilSpawn) / maxSpawnTime;
        const barWidth = HEX_SIZE * 0.8;
        const barY = y + HEX_SIZE * 0.4;

        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(x - barWidth / 2, barY, barWidth, 3);
        // Progress (off-white to distinguish from health bars)
        ctx.fillStyle = '#e8e0d5';
        ctx.fillRect(x - barWidth / 2, barY, barWidth * spawnProgress, 3);
    }

    drawInstallation(hex) {
        const ctx = this.ctx;
        const { x, y } = this.getHexCenter(hex.q, hex.r);

        // Draw fort symbol
        const size = HEX_SIZE * 0.4;
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(x - size, y - size * 0.5, size * 2, size);

        // Battlements
        ctx.fillRect(x - size, y - size, size * 0.4, size * 0.5);
        ctx.fillRect(x - size * 0.2, y - size, size * 0.4, size * 0.5);
        ctx.fillRect(x + size * 0.6, y - size, size * 0.4, size * 0.5);

        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - size, y - size * 0.5, size * 2, size);
    }

    drawSettlement(settlement) {
        const ctx = this.ctx;
        const { x, y } = this.getHexCenter(settlement.q, settlement.r);

        const color = SETTLEMENT_COLORS[settlement.tier];
        // Size scales from 0.2 (level 1) to 0.52 (level 10)
        const size = HEX_SIZE * (0.2 + settlement.tier * 0.035);

        // Draw square settlement
        ctx.fillStyle = color;
        ctx.fillRect(x - size, y - size, size * 2, size * 2);

        // Border - brighter for higher level settlements
        ctx.strokeStyle = settlement.tier >= 6 ? '#fff' : '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - size, y - size, size * 2, size * 2);

        // Level counter inside (1-10)
        ctx.fillStyle = settlement.tier >= 5 ? '#fff' : '#000';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(settlement.tier + 1, x, y);

        // Growth progress bar
        const barWidth = Math.max(size * 2, HEX_SIZE * 0.6);
        const barY = y + size + 2;
        const threshold = SETTLEMENT_GROWTH_THRESHOLD[settlement.tier] || 100;
        const progress = Math.min(1, settlement.growthPoints / threshold);

        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(x - barWidth / 2, barY, barWidth, 3);
        // Progress (green)
        if (progress > 0) {
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(x - barWidth / 2, barY, barWidth * progress, 3);
        }
    }

    drawUnit(unit, isEnemy = false) {
        const ctx = this.ctx;
        const hex = this.game.getHex(unit.q, unit.r);
        const { x, y } = this.getHexCenter(unit.q, unit.r);

        // Offset if multiple units/settlement
        const units = hex.units;
        const index = units.indexOf(unit);
        const unitOffsetX = (index - (units.length - 1) / 2) * 14;

        const color = isEnemy ? '#ff5252' : UNIT_COLORS[unit.type];
        const width = 8;
        const height = 14;

        // Unit rectangle (vertical orientation)
        const ux = x + unitOffsetX - width / 2;
        const uy = y + HEX_SIZE * 0.15 - height / 2;

        // Draw unit symbol based on type
        if (unit.type === UNIT_TYPE.HEAVY_INFANTRY) {
            // Half left black, right color (vertically split)
            ctx.fillStyle = '#000';
            ctx.fillRect(ux, uy, width / 2, height);
            ctx.fillStyle = color;
            ctx.fillRect(ux + width / 2, uy, width / 2, height);
        } else if (unit.type === UNIT_TYPE.WORKER) {
            // Top half color, bottom half black
            ctx.fillStyle = color;
            ctx.fillRect(ux, uy, width, height / 2);
            ctx.fillStyle = '#000';
            ctx.fillRect(ux, uy + height / 2, width, height / 2);
        } else {
            // Infantry and Cavalry: full color background first
            ctx.fillStyle = color;
            ctx.fillRect(ux, uy, width, height);
        }

        // Draw markings on top
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        if (unit.type === UNIT_TYPE.INFANTRY) {
            // Single diagonal from lower left to upper right
            ctx.beginPath();
            ctx.moveTo(ux, uy + height);
            ctx.lineTo(ux + width, uy);
            ctx.stroke();
        } else if (unit.type === UNIT_TYPE.CAVALRY) {
            // X from corner to corner
            ctx.beginPath();
            ctx.moveTo(ux, uy);
            ctx.lineTo(ux + width, uy + height);
            ctx.moveTo(ux + width, uy);
            ctx.lineTo(ux, uy + height);
            ctx.stroke();
        }

        // Border
        ctx.strokeStyle = this.game.selectedUnit === unit ? '#fff' : '#000';
        ctx.lineWidth = this.game.selectedUnit === unit ? 3 : 1;
        ctx.strokeRect(ux, uy, width, height);

        // Health bar
        this.drawHealthBar(x + unitOffsetX, uy + height + 3, width + 4, unit.health / unit.maxHealth);

        // Movement indicator - white dot in center if has moves
        if (!isEnemy && unit.movesLeft > 0) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x + unitOffsetX, uy + height / 2, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawEnemy(enemy) {
        const ctx = this.ctx;
        const { x, y } = this.getHexCenter(enemy.q, enemy.r);

        const size = 8;

        // Inverted triangle: flat base at top, point at bottom
        ctx.beginPath();
        ctx.moveTo(x - size, y - size);      // top left
        ctx.lineTo(x + size, y - size);      // top right
        ctx.lineTo(x, y + size);             // bottom point
        ctx.closePath();

        ctx.fillStyle = '#ff5252';
        ctx.fill();
        ctx.strokeStyle = '#b71c1c';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Health bar
        this.drawHealthBar(x, y + size + 3, size * 2, enemy.health / enemy.maxHealth, '#f44336');
    }

    drawSelection(hex) {
        const ctx = this.ctx;
        const { x, y } = this.getHexCenter(hex.q, hex.r);

        drawHexPath(ctx, x, y, HEX_SIZE);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Draw a hex highlight for valid moves or attack targets
    drawHexHighlight(q, r, fillColor, strokeColor) {
        const ctx = this.ctx;
        const { x, y } = this.getHexCenter(q, r);

        drawHexPath(ctx, x, y, HEX_SIZE * 0.8);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawValidMoves(unit) {
        const validMoves = this.game.getValidMoves(unit);

        // Highlight valid move destinations
        for (const move of validMoves) {
            this.drawHexHighlight(move.q, move.r, 'rgba(76, 175, 80, 0.3)', 'rgba(76, 175, 80, 0.8)');
        }

        // Highlight attack targets
        for (const n of hexNeighbors(unit.q, unit.r)) {
            if (this.game.canAttack(unit, n.q, n.r)) {
                this.drawHexHighlight(n.q, n.r, 'rgba(244, 67, 54, 0.3)', 'rgba(244, 67, 54, 0.8)');
            }
        }
    }

    // Convert screen coordinates to hex
    screenToHex(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = screenX - rect.left - this.offsetX;
        const y = screenY - rect.top - this.offsetY;

        // Reverse of hexToPixel
        const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / HEX_SIZE;
        const r = (2 / 3 * y) / HEX_SIZE;

        // Round to nearest hex
        const s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);

        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }

        return { q: rq, r: rr };
    }
}
