// UI Management

import {
    TERRAIN, SETTLEMENT_NAMES, SETTLEMENT_LEVEL, SETTLEMENT_UPGRADE_COST,
    SETTLEMENT_UPGRADE_LEVELS, SETTLEMENT_GROWTH_THRESHOLD,
    getSettlementFoundCost,
    UNIT_TYPE, UNIT_STATS, INSTALLATION_STATS, INSTALLATION_TIER, RESOURCE_TYPE
} from './config.js';
import { clamp } from './utils.js';

export class UI {
    constructor(game) {
        this.game = game;

        // Cache DOM elements
        this.goldDisplay = document.querySelector('#gold-display .resource-value');
        this.populationDisplay = document.querySelector('#population-display .resource-value');
        this.materialsDisplay = document.querySelector('#materials-display .resource-value');

        this.turnDisplay = document.getElementById('turn-display');
        this.eraBtn = document.getElementById('era-btn');
        this.notification = document.getElementById('notification');

        this.infoContent = document.getElementById('info-content');
        this.actionsContent = document.getElementById('actions-content');

        this.corruptionBar = document.getElementById('corruption-bar');
        this.unrestBar = document.getElementById('unrest-bar');
        this.decadenceBar = document.getElementById('decadence-bar');
        this.overextensionBar = document.getElementById('overextension-bar');

        this.endTurnBtn = document.getElementById('end-turn-btn');
    }

    update() {
        this.updateResources();
        this.updateStatus();
        this.updateSociety();
        this.updateInfo();
        this.updateActions();
    }

    updateResources() {
        this.goldDisplay.textContent = this.game.resources.gold;
        this.populationDisplay.textContent = this.game.getPopulation();
        this.materialsDisplay.textContent = this.game.resources.materials;
    }

    updateStatus() {
        this.turnDisplay.textContent = `Turn: ${this.game.turn}`;
        this.eraBtn.textContent = `Era: ${this.game.era}`;
    }

    updateSociety() {
        this.corruptionBar.style.width = `${this.game.society.corruption}%`;
        this.unrestBar.style.width = `${this.game.society.unrest}%`;
        this.decadenceBar.style.width = `${this.game.society.decadence}%`;
        this.overextensionBar.style.width = `${this.game.society.overextension}%`;

        // Color gradient from yellow (0%) to red (100%)
        this.corruptionBar.style.backgroundColor = this.getBarColor(this.game.society.corruption);
        this.unrestBar.style.backgroundColor = this.getBarColor(this.game.society.unrest);
        this.decadenceBar.style.backgroundColor = this.getBarColor(this.game.society.decadence);
        this.overextensionBar.style.backgroundColor = this.getBarColor(this.game.society.overextension);
    }

    // Interpolate from yellow (0%) to red (100%)
    getBarColor(value) {
        const pct = clamp(value, 0, 100) / 100;
        // Yellow: rgb(255, 215, 0) -> Red: rgb(255, 0, 0)
        const g = Math.round(215 * (1 - pct));
        return `rgb(255, ${g}, 0)`;
    }


    updateInfo() {
        const hex = this.game.selectedHex;

        // Always show income at top
        const income = this.game.calculateIncome();
        let html = `<p><span class="label">Income:</span> <span style="color: var(--gold)">+${income.gold}g</span> <span style="color: var(--materials)">+${income.materials}m</span></p>`;
        html += '<hr style="border-color: var(--bg-light); margin: 0.4rem 0;">';

        if (!hex) {
            html += '<p>Click a hex to select</p>';
            this.infoContent.innerHTML = html;
            return;
        }

        // Terrain
        html += `<p><span class="label">Terrain:</span> <span class="hex-info-terrain">${hex.terrain}</span></p>`;

        // Coordinates
        html += `<p><span class="label">Position:</span> (${hex.q}, ${hex.r})</p>`;

        // Controlled status
        html += `<p><span class="label">Controlled:</span> ${hex.controlled ? 'Yes' : 'No'}</p>`;

        // Resource
        if (hex.resource) {
            const hasWorker = hex.units.some(u => this.game.units.includes(u) && u.type === UNIT_TYPE.WORKER);
            const mult = hasWorker ? ' (x2 Worker)' : '';
            const resourceName = {
                [RESOURCE_TYPE.FOREST]: `Forest (+${hasWorker ? 2 : 1} materials${mult})`,
                [RESOURCE_TYPE.QUARRY]: `Quarry (+${hasWorker ? 4 : 2} materials${mult})`,
                [RESOURCE_TYPE.GOLD_DEPOSIT]: `Gold Deposit (+${hasWorker ? 4 : 2} gold${mult})`
            }[hex.resource];
            html += `<p><span class="label">Resource:</span> <span class="hex-info-resource">${resourceName}</span></p>`;
        }

        // Danger point
        if (hex.dangerPoint) {
            html += `<p><span class="label hex-info-danger">Danger Point</span></p>`;
            html += `<p class="hex-info-danger">Spawns in ${hex.dangerPoint.turnsUntilSpawn} turns</p>`;
            html += `<p class="hex-info-danger">Strength: ${hex.dangerPoint.strength}</p>`;
        }

        // Installation
        if (hex.installation) {
            html += `<p><span class="label">Installation:</span> ${hex.installation.type}</p>`;
            html += `<p><span class="label">Defense bonus:</span> +${hex.installation.defense}</p>`;
        }

        // Settlement
        if (hex.settlement) {
            const s = hex.settlement;
            const settlementDef = this.game.getSettlementDefense(s);
            html += `<hr style="border-color: var(--bg-light); margin: 0.5rem 0;">`;
            html += `<p><span class="label">Settlement:</span> <span class="hex-info-settlement">${SETTLEMENT_NAMES[s.tier]} (Lv ${s.tier + 1})</span></p>`;
            html += `<p><span class="label">Defense:</span> +${settlementDef}</p>`;
            const threshold = SETTLEMENT_GROWTH_THRESHOLD[s.tier] || 100;
            const growthPct = Math.floor((s.growthPoints / threshold) * 100);
            html += `<p><span class="label">Growth:</span> ${growthPct}%</p>`;

            const maxLevel = this.game.getMaxTierAt(s.q, s.r);
            if (maxLevel < this.game.maxSettlementLevel) {
                html += `<p><span class="label">Max level:</span> ${SETTLEMENT_NAMES[maxLevel]} (shadowed)</p>`;
            }
        }

        // Units
        const friendlyUnits = hex.units.filter(u => this.game.units.includes(u));
        if (friendlyUnits.length > 0) {
            html += `<hr style="border-color: var(--bg-light); margin: 0.5rem 0;">`;
            html += `<p><span class="label">Units:</span></p>`;
            for (const unit of friendlyUnits) {
                const stats = UNIT_STATS[unit.type];
                const isSelected = this.game.selectedUnit === unit;
                const btnClass = isSelected ? 'action-btn unit-selected' : 'action-btn';
                const typeDisplay = isSelected ? `<strong>${unit.type}</strong>` : unit.type;
                html += `<button class="${btnClass}" data-action="select-unit" data-unit-id="${unit.id}">
                    ${typeDisplay}
                    <span class="cost">HP: ${unit.health}/${stats.health} | Moves: ${unit.movesLeft}</span>
                </button>`;
            }
            const atStackLimit = !this.game.canStackUnit(hex.q, hex.r);
            if (atStackLimit) {
                html += `<p style="margin-top: 0.3rem; color: var(--danger); font-size: 0.85rem;">Stacking limit reached (${this.game.maxUnitsPerHex} units max)</p>`;
            }
        }

        // Enemies
        const enemies = this.game.getEnemiesAt(hex.q, hex.r);
        if (enemies.length > 0) {
            html += `<hr style="border-color: var(--bg-light); margin: 0.5rem 0;">`;
            html += `<p><span class="label hex-info-danger">Enemies:</span> ${enemies.length}</p>`;
            for (const enemy of enemies) {
                html += `<p class="hex-info-danger">HP: ${enemy.health}/${enemy.maxHealth}</p>`;
            }
        }

        // Influence
        const influence = this.game.calculateInfluenceAt(hex.q, hex.r);
        if (influence > 0) {
            html += `<p><span class="label">Influence:</span> ${influence.toFixed(1)}</p>`;
        }

        this.infoContent.innerHTML = html;
    }

    updateActions() {
        const hex = this.game.selectedHex;

        if (!hex) {
            this.actionsContent.innerHTML = '<p style="color: var(--text-dim);">Select a hex</p>';
            return;
        }

        let html = '';
        html += this.renderSettlementActions(hex);
        html += this.renderInstallationActions(hex);

        this.actionsContent.innerHTML = html || '<p style="color: var(--text-dim);">No actions available</p>';
    }

    renderSettlementActions(hex) {
        const settlement = hex.settlement || this.game.settlements.find(s => s.q === hex.q && s.r === hex.r);
        if (!settlement) return '';

        // Ensure hex.settlement is set (in case it wasn't)
        if (!hex.settlement) hex.settlement = settlement;

        let html = '';
        html += this.renderUpgradeButton(settlement);
        html += this.renderFoundButton(settlement);
        html += this.renderBuildUnitButtons(settlement);
        return html;
    }

    renderUpgradeButton(settlement) {
        if (SETTLEMENT_UPGRADE_LEVELS.includes(settlement.tier)) {
            const nextLevel = settlement.tier + 1;
            const cost = SETTLEMENT_UPGRADE_COST[nextLevel];
            if (!cost) return '';
            const canUpgrade = this.game.canUpgradeSettlement(settlement);
            return `<button class="action-btn" data-action="upgrade" ${canUpgrade ? '' : 'disabled'}>
                Upgrade to ${SETTLEMENT_NAMES[nextLevel]}
                <span class="cost">${cost.gold}g, ${cost.materials}m</span>
            </button>`;
        }

        if (settlement.tier >= this.game.maxSettlementLevel) return '';

        // Show growth progress for auto-advancing settlements
        const threshold = SETTLEMENT_GROWTH_THRESHOLD[settlement.tier] || 100;
        const growthPct = Math.floor((settlement.growthPoints / threshold) * 100);
        return `<p style="margin-bottom: 0.5rem; color: var(--text-dim); font-size: 0.85rem;">Growth: ${growthPct}% to ${SETTLEMENT_NAMES[settlement.tier + 1]}</p>`;
    }

    renderFoundButton(settlement) {
        if (settlement.tier < 1) return '';
        const foundCost = getSettlementFoundCost(this.game.era);
        const canFound = this.game.canFoundSettlement(settlement);
        return `<button class="action-btn" data-action="found-settlement" ${canFound ? '' : 'disabled'}>
            Found Settlement
            <span class="cost">${foundCost.gold}g, ${foundCost.materials}m | -1 tier</span>
        </button>`;
    }

    renderBuildUnitButtons(settlement) {
        if (!this.game.canStackUnit(settlement.q, settlement.r)) {
            return `<p style="margin-top: 0.5rem; color: var(--text-dim); font-size: 0.85rem;">Build Units: at stacking limit</p>`;
        }

        const unitTypes = [
            { type: UNIT_TYPE.WORKER, label: 'Worker' },
            { type: UNIT_TYPE.INFANTRY, label: 'Infantry' },
            { type: UNIT_TYPE.HEAVY_INFANTRY, label: 'Heavy Infantry' },
            { type: UNIT_TYPE.CAVALRY, label: 'Cavalry' }
        ];

        let html = `<p style="margin-top: 0.5rem; color: var(--text-dim); font-size: 0.85rem;">Build Units:</p>`;
        for (const { type, label } of unitTypes) {
            const stats = UNIT_STATS[type];
            const canBuild = this.game.canBuildUnit(settlement, type);
            html += `<button class="action-btn" data-action="build-unit" data-unit="${type}" ${canBuild ? '' : 'disabled'}>
                ${label}
                <span class="cost">${stats.cost.gold}g, ${stats.cost.materials}m | A:${stats.attack} D:${stats.defense} S:${stats.speed}</span>
            </button>`;
        }
        return html;
    }

    renderInstallationActions(hex) {
        const friendlyUnits = hex.units.filter(u => this.game.units.includes(u));
        const hasEnemies = this.game.getEnemiesAt(hex.q, hex.r).length > 0;
        if (friendlyUnits.length === 0 || hasEnemies || hex.dangerPoint) return '';

        let html = '';
        const currentTier = hex.installation ? INSTALLATION_TIER[hex.installation.type] : -1;
        const buildableTypes = Object.entries(INSTALLATION_STATS).filter(
            ([type]) => INSTALLATION_TIER[type] > currentTier
        );

        if (buildableTypes.length > 0) {
            const label = hex.installation ? 'Upgrade Installation:' : 'Build Installation:';
            html += `<p style="margin-top: 0.5rem; color: var(--text-dim); font-size: 0.85rem;">${label}</p>`;

            for (const [type, stats] of buildableTypes) {
                const canBuild = this.game.canBuildInstallation(hex, type);
                html += `<button class="action-btn" data-action="build-installation" data-installation="${type}" ${canBuild ? '' : 'disabled'}>
                    ${type}
                    <span class="cost">${stats.cost.gold}g, ${stats.cost.materials}m | Def: +${stats.defense}</span>
                </button>`;
            }
        }

        if (hex.installation) {
            html += `<button class="action-btn" data-action="tear-down-installation">
                Tear Down ${hex.installation.type}
                <span class="cost">No refund</span>
            </button>`;
        }

        return html;
    }

    showNotification(message, duration) {
        this.notification.textContent = message;
        setTimeout(() => {
            if (this.notification.textContent === message) {
                this.notification.textContent = '';
            }
        }, duration);
    }

}
