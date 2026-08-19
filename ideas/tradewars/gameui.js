// Canvas rendering, DOM HUD, camera, and input handling.
const GameUI = (function () {
    const A = GameArtifacts;
    const { OUTCOME, PHASE, CARAVAN_MP, MAX_UNREST, VICTORY_INFLUENCE } = A;
    const {
        HEX_SIZE, COUNTER_SIZE, TERRAIN_COLORS, TERRAIN_NAMES,
        CARAVAN_COLOR, CROWN_MARKET_COLOR, TRADING_POST_COLOR, createRaiderPalette
    } = GameDisplayArtifacts;
    const DRAG_THRESHOLD = 4;

    class GameUI {
        constructor(engine, canvas) {
            this.engine = engine;
            this.state = engine.state;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.sound = new GameSound();
            this.panX = 0;
            this.panY = 0;
            this.panning = false;
            this.dragCandidate = false;
            this.suppressNextClick = false;
            this.panStartX = 0;
            this.panStartY = 0;
            this.panOrigX = 0;
            this.panOrigY = 0;
            this.selection = null;
            this.overlay = null;
            this.hoveredHex = null;
            this.raiderPalette = [];
        }

        start() {
            this.attach();
            this.newGame();
        }

        newGame() {
            this.engine.newGame();
            this.raiderPalette = createRaiderPalette(this.state.seed);
            this.selection = null;
            this.hoveredHex = null;
            this.centerOn(this.state.caravan);
            this.showOverlay('intro');
            this.resize();
        }

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.render();
        }

        hexToScreen(q, r) {
            const point = new Hex(q, r).toPixel();
            return { x: point.x + this.panX, y: point.y + this.panY };
        }

        screenToHex(x, y) {
            return Hex.fromPixel(x - this.panX, y - this.panY);
        }

        centerOn(hex) {
            const point = new Hex(hex.q, hex.r).toPixel();
            this.panX = this.canvas.width / 2 - point.x;
            this.panY = this.canvas.height / 2 - point.y;
        }

        selectCaravan() {
            this.selection = {
                reachable: this.engine.computeReachable(),
                forceTargets: this.engine.computeForceTargets()
            };
        }

        deselect() {
            this.selection = null;
        }

        commitMove(q, r) {
            const result = this.engine.moveCaravan(q, r);
            if (!result.ok) return this.render();
            if (result.won) {
                this.sound.fanfare();
                this.deselect();
                this.showOverlay('victory');
            } else if (result.endedTurn) {
                this.sound.endTurn();
                this.deselect();
                if (this.state.outcome === OUTCOME.DEFEAT) this.showOverlay('defeat');
            } else {
                this.sound.step();
                this.selectCaravan();
            }
            this.render();
        }

        commitForce(q, r) {
            const result = this.engine.useForceAgainstRaider(q, r);
            if (!result.ok) this.state.statusMessage = result.reason;
            else this.sound.step();
            this.deselect();
            if (this.state.outcome === OUTCOME.DEFEAT) this.showOverlay('defeat');
            this.render();
        }

        openContracts() {
            if (!this.engine.marketAt(this.state.caravan) || this.state.outcome) return;
            this.deselect();
            this.showOverlay('contracts');
            this.render();
        }

        fulfillContract(contractId) {
            const result = this.engine.fulfillContract(contractId);
            if (!result.ok) this.state.statusMessage = result.reason;
            else this.sound.fanfare();
            if (result.won) this.showOverlay('victory');
            this.render();
        }

        closeContracts() {
            if (this.overlay !== 'contracts') return;
            this.overlay = null;
            this.syncOverlayDom();
            this.render();
        }

        buySupplies() {
            const result = this.engine.buySupplies();
            if (!result.ok) this.state.statusMessage = result.reason;
            else this.sound.step();
            this.render();
        }

        primaryAction() {
            if (this.overlay || this.state.phase !== PHASE.CARAVAN) return;
            const result = this.engine.endTurn();
            if (!result.ok) return;
            this.sound.endTurn();
            this.deselect();
            if (result.lost) this.showOverlay('defeat');
            this.render();
        }

        showOverlay(name) {
            this.overlay = name;
            this.syncOverlayDom();
        }

        dismissOverlay() {
            if (this.overlay !== 'intro') return;
            this.sound.fanfare();
            this.overlay = null;
            this.syncOverlayDom();
            this.render();
        }

        syncOverlayDom() {
            document.getElementById('intro-panel').classList.toggle('hidden', this.overlay !== 'intro');
            document.getElementById('contract-panel').classList.toggle('hidden', this.overlay !== 'contracts');
        }

        render() {
            const ctx = this.ctx;
            const s = this.state;
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.drawTerrain();
            this.drawMarkets();
            this.drawHighlights();
            this.drawRaiders();
            this.drawCaravan();
            if (this.overlay === 'victory') this.drawTerminalOverlay('TRADE PREVAILS', `The league prospered in ${s.turn} turns.`);
            if (this.overlay === 'defeat') this.drawTerminalOverlay('EXPEDITION LOST', s.statusMessage);
            this.updateHUD();
        }

        drawTerrain() {
            const ctx = this.ctx;
            for (const [, hex] of this.state.hexes) {
                const { x, y } = this.hexToScreen(hex.q, hex.r);
                if (x < -HEX_SIZE * 2 || x > this.canvas.width + HEX_SIZE * 2 ||
                    y < -HEX_SIZE * 2 || y > this.canvas.height + HEX_SIZE * 2) continue;
                drawHexPath(ctx, x, y, HEX_SIZE);
                ctx.fillStyle = TERRAIN_COLORS[hex.terrain] || '#555';
                ctx.fill();
                ctx.strokeStyle = '#00000044';
                ctx.lineWidth = 1;
                ctx.stroke();
                if (hex.depleted) {
                    ctx.fillStyle = 'rgba(20, 20, 20, 0.48)';
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        drawMarkets() {
            for (const market of this.state.tradingPosts) this.drawMapMarker(market, TRADING_POST_COLOR, market.label);
            this.drawMapMarker(this.state.crownMarket, CROWN_MARKET_COLOR, this.state.crownMarket.label);
        }

        drawMapMarker(position, color, label) {
            const ctx = this.ctx;
            const { x, y } = this.hexToScreen(position.q, position.r);
            drawHexPath(ctx, x, y, HEX_SIZE - 3);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x, y + 1);
        }

        drawHighlights() {
            if (!this.selection) return;
            const ctx = this.ctx;
            for (const key of this.selection.reachable.keys()) {
                const hex = Hex.fromKey(key);
                const point = this.hexToScreen(hex.q, hex.r);
                drawHexPath(ctx, point.x, point.y, HEX_SIZE);
                ctx.fillStyle = 'rgba(255, 230, 70, 0.30)';
                ctx.fill();
            }
            for (const key of this.selection.forceTargets) {
                const hex = Hex.fromKey(key);
                const point = this.hexToScreen(hex.q, hex.r);
                drawHexPath(ctx, point.x, point.y, HEX_SIZE);
                ctx.fillStyle = 'rgba(255, 45, 35, 0.45)';
                ctx.fill();
            }
        }

        drawRaiders() {
            const s = this.state;
            for (const raider of s.raiders) {
                const point = this.hexToScreen(raider.q, raider.r);
                const color = this.raiderPalette[(raider.id - 1) % this.raiderPalette.length];
                this.drawCounter(point.x, point.y, color, raider.label);
            }
        }

        drawCaravan() {
            const s = this.state;
            const point = this.hexToScreen(s.caravan.q, s.caravan.r);
            this.drawCounter(point.x, point.y, CARAVAN_COLOR, s.caravan.label);
            if (!this.selection) return;
            const size = COUNTER_SIZE + 4;
            this.roundRect(point.x - size / 2, point.y - size / 2, size, size, 6);
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        drawTerminalOverlay(title, subtitle) {
            const ctx = this.ctx;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 44px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(title, this.canvas.width / 2, this.canvas.height / 2 - 28);
            ctx.font = '18px monospace';
            ctx.fillText(subtitle, this.canvas.width / 2, this.canvas.height / 2 + 22);
        }

        roundRect(x, y, width, height, radius) {
            const ctx = this.ctx;
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.arcTo(x + width, y, x + width, y + radius, radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
            ctx.lineTo(x + radius, y + height);
            ctx.arcTo(x, y + height, x, y + height - radius, radius);
            ctx.lineTo(x, y + radius);
            ctx.arcTo(x, y, x + radius, y, radius);
            ctx.closePath();
        }

        contrastText(color) {
            const red = parseInt(color.slice(1, 3), 16) / 255;
            const green = parseInt(color.slice(3, 5), 16) / 255;
            const blue = parseInt(color.slice(5, 7), 16) / 255;
            return 0.2126 * red + 0.7152 * green + 0.0722 * blue > 0.4 ? '#000' : '#fff';
        }

        drawCounter(centerX, centerY, color, label) {
            const ctx = this.ctx;
            const size = COUNTER_SIZE;
            const x = centerX - size / 2;
            const y = centerY - size / 2;
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                ctx.moveTo(x + 4 + i, y + size + 1 + i);
                ctx.arcTo(x + size + 1 + i, y + size + 1 + i, x + size + 1 + i, y + 5 + i, 4);
                ctx.lineTo(x + size + 1 + i, y + 4 + i);
                ctx.stroke();
            }
            this.roundRect(x, y, size, size, 4);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.stroke();
            ctx.fillStyle = this.contrastText(color);
            ctx.font = `bold ${Math.floor(size * 0.55)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, centerX, centerY + 1);
        }

        updateHUD() {
            const s = this.state;
            const cargo = s.caravan?.cargo || { provisions: 0, timber: 0, ore: 0, coin: 0 };
            document.getElementById('turn-info').textContent = `Turn ${s.turn}`;
            document.getElementById('mp-info').textContent = `MP ${s.mp}/${CARAVAN_MP}`;
            document.getElementById('cargo-info').textContent = `Food ${cargo.provisions} · Wood ${cargo.timber} · Ore ${cargo.ore} · Credits ${cargo.coin}`;
            const influencePct = Math.min(100, Math.round(s.influence / VICTORY_INFLUENCE * 100));
            document.getElementById('progress-fill').style.width = `${influencePct}%`;
            document.getElementById('influence-info').textContent = `${s.influence}/${VICTORY_INFLUENCE}`;
            document.getElementById('unrest-info').textContent = `Unrest ${s.unrest}/${MAX_UNREST}`;
            document.getElementById('event-log').textContent = s.statusMessage;

            const market = s.caravan && this.engine.marketAt(s.caravan);
            document.getElementById('contract').disabled = !market || Boolean(s.outcome);
            document.getElementById('supplies').disabled = !market || Boolean(s.outcome);
            for (const button of document.querySelectorAll('[data-contract-id]')) {
                const contract = A.CONTRACTS.find(candidate => candidate.id === button.dataset.contractId);
                button.disabled = Boolean(s.outcome) || !cargo.canAfford(contract.cost);
            }
            const hovered = this.hoveredHex && s.hexes.get(Hex.key(this.hoveredHex.q, this.hoveredHex.r));
            const hoverText = hovered
                ? `${TERRAIN_NAMES[hovered.terrain] || '?'}${hovered.depleted ? ' · depleted' : ''}`
                : '';
            document.getElementById('hover-info').textContent = hoverText;
            document.getElementById('hud-hover').classList.toggle('hidden', !hoverText);
        }

        attach() {
            this.canvas.addEventListener('mousedown', event => this.onMouseDown(event));
            this.canvas.addEventListener('mousemove', event => this.onMouseMove(event));
            this.canvas.addEventListener('click', event => this.onClick(event));
            window.addEventListener('mouseup', event => this.onMouseUp(event));
            this.canvas.addEventListener('contextmenu', event => event.preventDefault());
            window.addEventListener('resize', () => this.resize());
            window.addEventListener('keydown', event => this.onKeyDown(event));
            document.getElementById('end-turn').addEventListener('click', () => this.primaryAction());
            document.getElementById('new-game').addEventListener('click', () => this.newGame());
            document.getElementById('contract').addEventListener('click', () => this.openContracts());
            for (const button of document.querySelectorAll('[data-contract-id]')) {
                button.addEventListener('click', () => this.fulfillContract(button.dataset.contractId));
            }
            document.getElementById('contract-done').addEventListener('click', () => this.closeContracts());
            document.getElementById('supplies').addEventListener('click', () => this.buySupplies());
            document.getElementById('begin-btn').addEventListener('click', () => this.dismissOverlay());
        }

        onMouseDown(event) {
            if (event.button === 2) {
                event.preventDefault();
                return;
            }
            if (event.button !== 0) return;
            this.dragCandidate = true;
            this.panning = false;
            this.suppressNextClick = false;
            this.panStartX = event.clientX;
            this.panStartY = event.clientY;
            this.panOrigX = this.panX;
            this.panOrigY = this.panY;
            event.preventDefault();
        }

        handleBoardClick(x, y) {
            const s = this.state;
            if (this.overlay) return this.dismissOverlay();
            if (s.outcome || s.phase !== PHASE.CARAVAN) return;
            const hex = this.screenToHex(x, y);
            const key = Hex.key(hex.q, hex.r);
            if (!this.selection) {
                if (key === s.caravan.key()) this.selectCaravan();
            } else if (key === s.caravan.key()) {
                this.deselect();
            } else if (this.selection.forceTargets.has(key)) {
                return this.commitForce(hex.q, hex.r);
            } else if (this.selection.reachable.has(key)) {
                return this.commitMove(hex.q, hex.r);
            } else {
                this.deselect();
            }
            this.render();
        }

        onClick(event) {
            if (this.suppressNextClick) {
                this.suppressNextClick = false;
                return;
            }
            this.handleBoardClick(event.clientX, event.clientY);
        }

        onMouseMove(event) {
            if (this.dragCandidate && !this.panning) {
                const dx = event.clientX - this.panStartX;
                const dy = event.clientY - this.panStartY;
                if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) this.panning = true;
            }
            if (this.panning) {
                this.panX = this.panOrigX + event.clientX - this.panStartX;
                this.panY = this.panOrigY + event.clientY - this.panStartY;
                return this.render();
            }
            const hex = this.screenToHex(event.clientX, event.clientY);
            const next = this.state.hexes.has(Hex.key(hex.q, hex.r)) ? { q: hex.q, r: hex.r } : null;
            if (next?.q === this.hoveredHex?.q && next?.r === this.hoveredHex?.r) return;
            this.hoveredHex = next;
            this.updateHUD();
        }

        onMouseUp(event) {
            if (event.button !== 0 || !this.dragCandidate) return;
            const wasPanning = this.panning;
            this.dragCandidate = false;
            this.panning = false;
            this.suppressNextClick = wasPanning;
        }

        onKeyDown(event) {
            if (this.overlay === 'intro' && (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape')) {
                event.preventDefault();
                return this.dismissOverlay();
            }
            if (event.key === 'Escape') {
                this.deselect();
                return this.render();
            }
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                this.primaryAction();
            }
        }
    }

    return GameUI;
})();
