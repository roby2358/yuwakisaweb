// Main Entry Point

import { Game } from './game.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { hexKey } from './hex.js';
import { ERA_INFO, COLLAPSE_INFO } from './config.js';
import {
    getRealmStateDescription,
    getCurrentImpacts,
    getAvailableOptions,
    formatEffect,
    formatCost
} from './society.js';

class App {
    constructor() {
        this.game = new Game(12); // Map radius of 12
        this.canvas = document.getElementById('game-canvas');
        this.renderer = new Renderer(this.canvas, this.game);
        this.ui = new UI(this.game);

        // Pending confirmation data
        this.pendingConfirmation = null;

        this.setupEventListeners();
        this.update();

        // Start render loop for animations
        this.animate();
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

        // Action buttons (delegated)
        document.getElementById('actions-content').addEventListener('click', (e) => {
            const btn = e.target.closest('.action-btn');
            if (btn && !btn.disabled) {
                this.handleAction(btn);
            }
        });

        // Welcome modal
        document.getElementById('welcome-start-btn').addEventListener('click', () => this.hideWelcomeModal());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close any open modal, otherwise clear selection
                const eraModal = document.getElementById('era-modal');
                const confirmModal = document.getElementById('confirm-modal');
                const societyModal = document.getElementById('society-modal');
                const welcomeModal = document.getElementById('welcome-modal');
                if (!welcomeModal.classList.contains('hidden')) {
                    this.hideWelcomeModal();
                } else if (!confirmModal.classList.contains('hidden')) {
                    this.hideConfirmModal();
                } else if (!societyModal.classList.contains('hidden')) {
                    this.hideSocietyModal();
                } else if (!eraModal.classList.contains('hidden')) {
                    this.hideEraModal();
                } else {
                    this.game.clearSelection();
                    this.update();
                }
            } else if (e.key === 'Enter' || e.key === ' ') {
                // Don't end turn if modal is open
                const eraModal = document.getElementById('era-modal');
                const confirmModal = document.getElementById('confirm-modal');
                const societyModal = document.getElementById('society-modal');
                const welcomeModal = document.getElementById('welcome-modal');
                if (eraModal.classList.contains('hidden') && confirmModal.classList.contains('hidden') && societyModal.classList.contains('hidden') && welcomeModal.classList.contains('hidden')) {
                    this.handleEndTurn();
                }
            }
        });
    }

    handleCanvasClick(e) {
        const { q, r } = this.renderer.screenToHex(e.clientX, e.clientY);
        const clickedHex = this.game.hexes.get(hexKey(q, r));

        if (!clickedHex) return;

        const selectedUnit = this.game.selectedUnit;

        // If clicking on the selected unit's hex, deselect the unit
        if (selectedUnit && selectedUnit.q === q && selectedUnit.r === r) {
            this.game.selectedUnit = null;
            this.update();
            return;
        }

        // If we have a unit selected, try to move or attack
        if (selectedUnit) {
            // Check if clicking on an enemy to attack
            const enemiesAt = this.game.enemies.filter(en => en.q === q && en.r === r);
            if (enemiesAt.length > 0 && this.game.canAttack(selectedUnit, q, r)) {
                const result = this.game.attack(selectedUnit, q, r);
                if (result) {
                    if (result.killed) {
                        this.ui.showNotification(`Enemy destroyed! Dealt ${result.damage} damage.`);
                    } else {
                        this.ui.showNotification(`Dealt ${result.damage} damage, took ${result.counterDamage} in return.`);
                    }
                    if (result.unitKilled) {
                        this.ui.showNotification('Your unit was destroyed!');
                    }
                }
                this.update();
                return;
            }

            // Check if clicking on a valid move
            if (this.game.canMoveUnit(selectedUnit, q, r)) {
                this.game.moveUnit(selectedUnit, q, r);
                this.game.selectHex(q, r);
                // Keep unit selected only if it has moves left
                if (selectedUnit.movesLeft > 0) {
                    this.game.selectUnit(selectedUnit);
                }
                this.update();
                return;
            }
        }

        // Otherwise, select the hex
        this.game.selectHex(q, r);

        // If there are friendly units here, select the first one with moves left
        if (clickedHex.units.length > 0) {
            const friendlyUnits = clickedHex.units.filter(u => this.game.units.includes(u));
            const unitWithMoves = friendlyUnits.find(u => u.movesLeft > 0);
            if (unitWithMoves) {
                this.game.selectUnit(unitWithMoves);
            }
        }

        this.update();
    }

    handleAction(btn) {
        const action = btn.dataset.action;
        const hex = this.game.selectedHex;

        switch (action) {
            case 'upgrade':
                if (hex && hex.settlement) {
                    if (this.game.upgradeSettlement(hex.settlement)) {
                        this.ui.showNotification(`Settlement upgraded!`);
                    }
                }
                break;

            case 'build-unit':
                if (hex && hex.settlement) {
                    const unitType = btn.dataset.unit;
                    const unit = this.game.buildUnit(hex.settlement, unitType);
                    if (unit) {
                        this.ui.showNotification(`${unitType} recruited!`);
                    }
                }
                break;

            case 'build-settlement':
                if (hex) {
                    // Check if this would destroy a settlement
                    if (this.game.buildSettlementNeedsConfirmation(hex.q, hex.r)) {
                        const cost = this.game.getSettlementPopCost();
                        this.showConfirmModal(
                            'Destroy Settlement?',
                            `Building a new settlement will destroy your <strong>${cost.name}</strong> at (${cost.settlement.q}, ${cost.settlement.r}).<br><br>Are you sure you want to proceed?`,
                            { action: 'build-settlement', q: hex.q, r: hex.r, victim: cost.settlement }
                        );
                    } else if (this.game.buildSettlement(hex.q, hex.r)) {
                        this.ui.showNotification('Settlement founded!');
                    }
                }
                break;

            case 'build-installation':
                if (hex) {
                    const type = btn.dataset.installation;
                    if (this.game.buildInstallation(hex, type)) {
                        this.ui.showNotification(`${type} built! Danger neutralized.`);
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

        this.update();
    }

    update() {
        this.ui.update();
        this.renderer.render();
    }

    animate() {
        // Re-render for animations (danger point pulse, etc.)
        this.renderer.render();
        requestAnimationFrame(() => this.animate());
    }

    showEraModal() {
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
        html += `<p>Population: <span class="highlight">${this.game.getPopulation()}</span></p>`;
        html += `<p>Controlled Hexes: <span class="highlight">${this.game.getControlledHexCount()}</span></p>`;

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

        const data = this.pendingConfirmation;
        this.hideConfirmModal();

        // Handle the confirmed action
        switch (data.action) {
            case 'build-settlement':
                if (this.game.buildSettlement(data.q, data.r, data.victim)) {
                    this.ui.showNotification('Settlement founded! Previous settlement destroyed.');
                }
                break;
        }

        this.update();
    }

    showSocietyModal() {
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
        const options = getAvailableOptions(this.game.resources, this.game.society, this.game.shuffledSocietyOptions);
        this.currentSocietyOptions = options; // Store for handling clicks

        if (options.length > 0) {
            let optionsHtml = '<h3>Available Actions</h3>';
            for (let i = 0; i < options.length; i++) {
                const opt = options[i];
                const costStr = formatCost(opt.costs);
                const effectsHtml = this.formatEffectsHtml(opt.effects);
                // Use gain class if getting resources (negative costs)
                const isGain = opt.costs[0] < 0 || opt.costs[1] < 0;
                const costClass = isGain ? 'society-option-gain' : 'society-option-cost';

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

        // Apply costs
        this.game.resources.gold -= option.costs[0];
        this.game.resources.materials -= option.costs[1];

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
        this.ui.showNotification(`${option.name} enacted!`);
        this.update();
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
