// Main Entry Point

import { Game } from './game.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { hexKey } from './hex.js';
import { ERA_INFO, ERA_MULTIPLIER, COLLAPSE_INFO, DIFFICULTY } from './config.js';
import { generateTerrain } from './terrain.js';
import {
    getRealmStateDescription,
    getCurrentImpacts,
    getAvailableOptions,
    formatEffect,
    formatCost
} from './society.js';

// Modal IDs in priority order for escape handling
const MODAL_IDS = ['welcome-modal', 'confirm-modal', 'society-modal', 'era-modal'];

// Minimal game-like object for rendering terrain before the real game starts
function createTerrainPreview(hexes) {
    return {
        hexes,
        settlements: [],
        units: [],
        enemies: [],
        selectedHex: null,
        selectedUnit: null,
        getSpawnProbabilities() { return new Map(); },
        getHex(q, r) { return hexes.get(hexKey(q, r)); },
        getValidMoves() { return new Set(); },
        canAttack() { return false; }
    };
}

class App {
    constructor() {
        this.game = null;
        this.canvas = document.getElementById('game-canvas');
        this.ui = null;

        // Pending confirmation data
        this.pendingConfirmation = null;

        // Combat reporting mode
        this.reportingMode = false;

        // Generate terrain and show it behind the welcome modal
        this.mapRadius = 12;
        this.previewHexes = generateTerrain(this.mapRadius);
        this.renderer = new Renderer(this.canvas, createTerrainPreview(this.previewHexes));
        this.renderer.render();
        this.animate();

        this.setupEventListeners();
    }

    startGame(difficultyKey) {
        const difficulty = DIFFICULTY[difficultyKey];
        this.game = new Game(this.mapRadius, difficulty, this.previewHexes);
        this.previewHexes = null;
        this.renderer.game = this.game;
        this.ui = new UI(this.game);
        this.hideWelcomeModal();
        this.update();
    }

    // Check if any modal is currently open
    isModalOpen() {
        return MODAL_IDS.some(id => !document.getElementById(id).classList.contains('hidden'));
    }

    // Close the topmost open modal, returns true if a modal was closed
    closeTopModal() {
        const hideActions = {
            'welcome-modal': () => this.hideWelcomeModal(),
            'confirm-modal': () => this.hideConfirmModal(),
            'society-modal': () => this.hideSocietyModal(),
            'era-modal': () => this.hideEraModal()
        };

        for (const id of MODAL_IDS) {
            if (!document.getElementById(id).classList.contains('hidden')) {
                hideActions[id]();
                return true;
            }
        }
        return false;
    }

    setupEventListeners() {
        // Canvas click - hex selection and movement
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // End turn button
        document.getElementById('end-turn-btn').addEventListener('click', () => this.handleEndTurn());

        // Era button - show info modal
        document.getElementById('era-btn').addEventListener('click', () => this.showEraModal());

        // Modal close button
        document.querySelector('#era-modal .modal-close').addEventListener('click', () => this.hideEraModal());

        // Click outside modal to close
        document.getElementById('era-modal').addEventListener('click', (e) => {
            if (e.target.id === 'era-modal') {
                this.hideEraModal();
            }
        });

        // Confirmation modal buttons
        document.getElementById('confirm-ok-btn').addEventListener('click', () => this.handleConfirmOk());
        document.getElementById('confirm-cancel-btn').addEventListener('click', () => this.hideConfirmModal());
        document.getElementById('confirm-modal').addEventListener('click', (e) => {
            if (e.target.id === 'confirm-modal') {
                this.hideConfirmModal();
            }
        });

        // Society panel and modal
        document.getElementById('society-panel').addEventListener('click', () => this.showSocietyModal());
        document.getElementById('society-panel').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.showSocietyModal();
            }
        });
        document.querySelector('#society-modal .modal-close').addEventListener('click', () => this.hideSocietyModal());
        document.getElementById('society-modal').addEventListener('click', (e) => {
            if (e.target.id === 'society-modal') {
                this.hideSocietyModal();
            }
        });
        document.getElementById('society-modal-options').addEventListener('click', (e) => {
            const option = e.target.closest('.society-option');
            if (option) {
                this.handleSocietyOption(option);
            }
        });

        // Action buttons (delegated from both panels)
        const handleActionClick = (e) => {
            const btn = e.target.closest('.action-btn');
            if (btn && !btn.disabled) {
                this.handleAction(btn);
            }
        };
        document.getElementById('actions-content').addEventListener('click', handleActionClick);
        document.getElementById('info-content').addEventListener('click', handleActionClick);

        // Difficulty buttons on welcome modal
        for (const btn of document.querySelectorAll('.difficulty-btn')) {
            btn.addEventListener('click', () => this.startGame(btn.dataset.difficulty));
        }

        // Population map toggle
        document.getElementById('population-map-btn').addEventListener('click', () => this.togglePopulationMap());

        // Dynamics document
        document.getElementById('dynamics-btn').addEventListener('click', () => window.open('DYNAMICS.md', '_blank'));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.reportingMode) {
                this.dismissCombatReport();
                return;
            }

            if (e.key === 'Escape') {
                // Close any open modal, otherwise clear selection
                if (!this.closeTopModal() && this.game) {
                    this.game.clearSelection();
                    this.update();
                }
            } else if (e.key === 'Enter' || e.key === ' ') {
                // Only end turn if no modal is open
                if (!this.isModalOpen()) {
                    this.handleEndTurn();
                }
            }
        });
    }

    // Select the next friendly unit with moves on this hex after `afterUnit`.
    // If afterUnit is null, selects the first. If none remain, clears selection.
    selectNextUnit(hex, afterUnit) {
        const friendly = hex.units.filter(u => this.game.units.includes(u) && u.movesLeft > 0);
        if (friendly.length === 0) return;

        if (!afterUnit) {
            this.game.selectUnit(friendly[0]);
            return;
        }

        const idx = friendly.indexOf(afterUnit);
        const next = friendly[idx + 1];
        if (next) {
            this.game.selectUnit(next);
        }
    }

    handleCanvasClick(e) {
        if (!this.game) return;
        if (this.reportingMode) {
            this.dismissCombatReport();
            return;
        }

        const { q, r } = this.renderer.screenToHex(e.clientX, e.clientY);
        const clickedHex = this.game.hexes.get(hexKey(q, r));

        if (!clickedHex) return;

        const selectedUnit = this.game.selectedUnit;

        // If we have a unit selected, try to attack, move, or cycle
        if (selectedUnit) {
            // Clicking selected unit's hex: cycle to next unit with moves
            if (selectedUnit.q === q && selectedUnit.r === r) {
                this.game.selectedUnit = null;
                this.selectNextUnit(clickedHex, selectedUnit);
                this.update();
                return;
            }

            // Check if clicking on an enemy to attack
            const enemiesAt = this.game.enemies.filter(en => en.q === q && en.r === r);
            if (enemiesAt.length > 0 && this.game.canAttack(selectedUnit, q, r)) {
                const result = this.game.attack(selectedUnit, q, r);
                if (result) {
                    if (result.killed) {
                        this.ui.showNotification(`Enemy destroyed! Dealt ${result.damage} damage.`, 3000);
                    } else {
                        this.ui.showNotification(`Dealt ${result.damage} damage, took ${result.counterDamage} in return.`, 3000);
                    }
                    if (result.unitKilled) {
                        this.ui.showNotification('Your unit was destroyed!', 3000);
                    }
                }
                this.update();
                return;
            }

            // Check if clicking on a valid move
            if (this.game.canMoveUnit(selectedUnit, q, r)) {
                this.game.moveUnit(selectedUnit, q, r);
                this.game.selectedHex = this.game.getHex(q, r);
                this.game.selectedUnit = null;
                this.update();
                return;
            }
        }

        // Clicking a hex with no action: select hex and first movable unit
        this.game.selectHex(q, r);
        this.game.selectedUnit = null;
        this.selectNextUnit(clickedHex, null);

        this.update();
    }

    handleAction(btn) {
        if (!this.game) return;
        const action = btn.dataset.action;
        const hex = this.game.selectedHex;

        switch (action) {
            case 'upgrade':
                if (hex && hex.settlement) {
                    if (this.game.upgradeSettlement(hex.settlement)) {
                        this.ui.showNotification(`Settlement upgraded!`, 3000);
                    }
                }
                break;

            case 'build-unit':
                if (hex && hex.settlement) {
                    const unitType = btn.dataset.unit;
                    const unit = this.game.buildUnit(hex.settlement, unitType);
                    if (unit) {
                        this.ui.showNotification(`${unitType} recruited!`, 3000);
                    }
                }
                break;

            case 'build-installation':
                if (hex) {
                    const type = btn.dataset.installation;
                    const hadExisting = !!hex.installation;
                    if (this.game.buildInstallation(hex, type)) {
                        this.ui.showNotification(hadExisting ? `Upgraded to ${type}!` : `${type} built!`, 3000);
                    }
                }
                break;

            case 'tear-down-installation':
                if (hex) {
                    if (this.game.tearDownInstallation(hex)) {
                        this.ui.showNotification('Installation torn down.', 3000);
                    }
                }
                break;

            case 'found-settlement':
                if (hex && hex.settlement) {
                    const newSettlement = this.game.foundSettlement(hex.settlement);
                    if (newSettlement) {
                        this.ui.showNotification(`New settlement founded at (${newSettlement.q}, ${newSettlement.r})!`, 3000);
                    }
                }
                break;

            case 'select-unit':
                if (hex) {
                    const unitId = parseFloat(btn.dataset.unitId);
                    const unit = this.game.units.find(u => u.id === unitId);
                    if (unit) {
                        this.game.selectUnit(unit);
                    }
                }
                break;
        }

        this.update();
    }

    handleEndTurn() {
        if (!this.game) return;
        if (this.reportingMode) {
            this.dismissCombatReport();
            return;
        }

        const previousEra = this.game.era;
        this.game.endTurn();

        // Check for era change
        if (this.game.era !== previousEra) {
            this.ui.showNotification(`Era changed to ${this.game.era}!`, 5000);
        }

        // Check for collapse (era would reset to Barbarian with turn 1-ish state)
        if (previousEra !== 'Barbarian' && this.game.era === 'Barbarian' && this.game.settlements.length === 1) {
            this.ui.showNotification('Your civilization has collapsed! Starting anew...', 5000);
        }

        // Enter combat reporting mode if there were enemy attacks
        if (this.game.combatReport.length > 0) {
            this.reportingMode = true;
            this.renderer.combatReport = this.game.combatReport;
            document.getElementById('end-turn-btn').textContent = 'Continue';
            this.update();
            return;
        }

        this.update();
    }

    dismissCombatReport() {
        this.reportingMode = false;
        this.renderer.combatReport = null;
        document.getElementById('end-turn-btn').textContent = 'End Turn';
        this.update();
    }

    update() {
        if (!this.game) return;
        this.ui.update();
        this.renderer.render();
    }

    animate() {
        // Re-render for animations (danger point pulse, etc.)
        this.renderer.render();
        requestAnimationFrame(() => this.animate());
    }

    showEraModal() {
        if (!this.game) return;
        const era = this.game.era;
        const info = ERA_INFO[era];

        const title = document.getElementById('era-modal-title');
        const body = document.getElementById('era-modal-body');

        title.textContent = `Era: ${era}`;

        let html = `<p>${info.description}</p>`;

        // Current effects
        html += '<h3>Effects</h3><ul>';
        for (const effect of info.effects) {
            html += `<li>${effect}</li>`;
        }
        html += '</ul>';

        // Current status
        html += '<h3>Current Status</h3>';
        html += `<p>Settlements: <span class="highlight">${this.game.settlements.length}</span></p>`;

        // Advancement criteria
        if (info.advance) {
            html += `<h3>Advance to ${info.advance.nextEra}</h3><ul>`;
            for (const req of info.advance.requirements) {
                html += `<li>${req}</li>`;
            }
            html += '</ul>';
        } else {
            html += '<h3>Final Era</h3>';
            html += '<p>This is the highest era. Focus on maintaining stability.</p>';
        }

        // Collapse info
        html += '<h3 class="danger">Collapse</h3>';
        html += `<p>${COLLAPSE_INFO.description}</p>`;
        html += '<ul>';
        for (const param of COLLAPSE_INFO.parameters) {
            html += `<li><strong>${param.name}:</strong> ${param.effect}</li>`;
        }
        html += '</ul>';
        html += `<p class="danger">${COLLAPSE_INFO.consequence}</p>`;

        body.innerHTML = html;
        document.getElementById('era-modal').classList.remove('hidden');
    }

    hideEraModal() {
        document.getElementById('era-modal').classList.add('hidden');
    }

    showConfirmModal(title, message, data) {
        this.pendingConfirmation = data;
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-body').innerHTML = message;
        document.getElementById('confirm-modal').classList.remove('hidden');
    }

    hideConfirmModal() {
        this.pendingConfirmation = null;
        document.getElementById('confirm-modal').classList.add('hidden');
    }

    handleConfirmOk() {
        if (!this.pendingConfirmation) {
            this.hideConfirmModal();
            return;
        }

        this.hideConfirmModal();
        this.update();
    }

    showSocietyModal() {
        if (!this.game) return;
        const stateEl = document.getElementById('society-modal-state');
        const impactsEl = document.getElementById('society-modal-impacts');
        const optionsEl = document.getElementById('society-modal-options');

        // Show realm state description
        const stateDesc = getRealmStateDescription(this.game.society, this.game.era);
        stateEl.innerHTML = `<p>${stateDesc}</p>`;

        // Show current impacts
        const impacts = getCurrentImpacts(this.game.society);
        if (impacts.length > 0) {
            let impactsHtml = '<h3>Current Effects</h3>';
            for (const impact of impacts) {
                const highClass = impact.value >= 50 ? ' society-impact-high' : '';
                impactsHtml += `
                    <div class="society-impact${highClass}">
                        <div>
                            <span class="society-impact-label">${impact.param}:</span>
                            <span class="society-impact-value">${impact.value}%</span>
                            <div class="society-impact-effect">${impact.effect}</div>
                        </div>
                    </div>`;
            }
            impactsEl.innerHTML = impactsHtml;
        } else {
            impactsEl.innerHTML = '<p style="color: var(--success); margin-bottom: var(--space-md);">The realm is in perfect balance.</p>';
        }

        // Show available options from pre-shuffled list
        const eraMult = ERA_MULTIPLIER[this.game.era];
        const options = getAvailableOptions(this.game.resources, this.game.society, this.game.shuffledSocietyOptions, eraMult);
        this.currentSocietyOptions = options; // Store for handling clicks

        if (options.length > 0) {
            let optionsHtml = '<h3>Available Actions</h3>';
            for (let i = 0; i < options.length; i++) {
                const opt = options[i];
                const costStr = formatCost(opt.costs, eraMult);
                const effectsHtml = this.formatEffectsHtml(opt.effects);
                // Color cost: green for gains, red for heavy costs (>=50 scaled), gold otherwise
                const scaledGold = opt.costs[0] * eraMult;
                const scaledMaterials = opt.costs[1] * eraMult;
                const isGain = scaledGold < 0 || scaledMaterials < 0;
                const isHeavy = scaledGold >= 50 || scaledMaterials >= 50;
                const costClass = isGain ? 'society-option-gain' : isHeavy ? 'society-option-heavy' : 'society-option-cost';

                optionsHtml += `
                    <div class="society-option" data-option-index="${i}">
                        <div class="society-option-name">${opt.name}</div>
                        <div class="society-option-desc">${opt.description}</div>
                        <div class="society-option-details">
                            <span class="${costClass}">${costStr}</span>
                            <span class="society-option-effects">${effectsHtml}</span>
                        </div>
                    </div>`;
            }
            optionsEl.innerHTML = optionsHtml;
        } else {
            optionsEl.innerHTML = '<div class="society-no-options">No actions available. Build up your treasury or wait for conditions to change.</div>';
        }

        document.getElementById('society-modal').classList.remove('hidden');
    }

    hideSocietyModal() {
        document.getElementById('society-modal').classList.add('hidden');
        this.currentSocietyOptions = null;
    }

    hideWelcomeModal() {
        document.getElementById('welcome-modal').classList.add('hidden');
    }

    togglePopulationMap() {
        if (!this.game) return;
        const mode = this.renderer.toggleMapMode();
        const btn = document.getElementById('population-map-btn');
        btn.classList.toggle('active', mode === 'population');
    }

    formatEffectsHtml(effects) {
        const labels = ['Corr', 'Unr', 'Dec', 'Over'];
        const parts = [];

        for (let i = 0; i < 4; i++) {
            if (effects[i] !== 0) {
                const sign = effects[i] > 0 ? '+' : '';
                const cls = effects[i] < 0 ? 'positive' : 'negative';
                parts.push(`<span class="${cls}">${sign}${effects[i]}% ${labels[i]}</span>`);
            }
        }

        return parts.join(' ');
    }

    handleSocietyOption(optionEl) {
        const index = parseInt(optionEl.dataset.optionIndex);
        const option = this.currentSocietyOptions?.[index];

        if (!option) return;

        // Remove used option from shuffled list so next opening shows different options
        const optionIndex = this.game.shuffledSocietyOptions.findIndex(o => o.name === option.name);
        if (optionIndex !== -1) {
            this.game.shuffledSocietyOptions.splice(optionIndex, 1);
        }

        // Apply costs scaled by era multiplier (1/2/4)
        const eraMult = ERA_MULTIPLIER[this.game.era];
        this.game.resources.gold -= option.costs[0] * eraMult;
        this.game.resources.materials -= option.costs[1] * eraMult;

        // Apply effects as percentage changes (+20 means *1.2, -30 means *0.7)
        const [corr, unr, dec, over] = option.effects;
        const applyPct = (current, pct) => {
            const multiplier = 1 + pct / 100;
            return Math.max(0, Math.min(100, current * multiplier));
        };
        this.game.society.corruption = applyPct(this.game.society.corruption, corr);
        this.game.society.unrest = applyPct(this.game.society.unrest, unr);
        this.game.society.decadence = applyPct(this.game.society.decadence, dec);
        this.game.society.overextension = applyPct(this.game.society.overextension, over);

        this.hideSocietyModal();
        this.ui.showNotification(`${option.name} enacted!`, 3000);
        this.update();
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
