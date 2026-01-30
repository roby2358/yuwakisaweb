// Production Calculation

import { SETTLEMENT_PRODUCTION, RESOURCE_PRODUCTION, UNIT_TYPE } from './config.js';

/**
 * Calculates resource production for a game state.
 * Handles settlement output, resource hex output, worker bonuses, and society modifiers.
 */
export class Production {
    constructor(game) {
        this.game = game;
    }

    /**
     * Calculate raw production before society modifiers.
     * @returns {{ gold: number, materials: number }}
     */
    calculateRaw() {
        let gold = 0;
        let materials = 0;

        // Settlement production
        for (const settlement of this.game.settlements) {
            const prod = SETTLEMENT_PRODUCTION[settlement.tier];
            gold += prod.gold;
            materials += prod.materials;
        }

        // Resource hex production
        for (const [key, hex] of this.game.hexes) {
            if (!hex.controlled || !hex.resource) continue;

            const prod = RESOURCE_PRODUCTION[hex.resource];
            const multiplier = this.getWorkerMultiplier(hex);

            if (prod.gold) gold += prod.gold * multiplier;
            if (prod.materials) materials += prod.materials * multiplier;
        }

        return { gold, materials };
    }

    /**
     * Check if a hex has a worker and return the production multiplier.
     * @param {Object} hex - The hex to check
     * @returns {number} - 2 if worker present, 1 otherwise
     */
    getWorkerMultiplier(hex) {
        const hasWorker = hex.units.some(u =>
            this.game.units.includes(u) && u.type === UNIT_TYPE.WORKER
        );
        return hasWorker ? 2 : 1;
    }

    /**
     * Apply society modifiers (corruption, decadence) to raw production.
     * @param {{ gold: number, materials: number }} raw
     * @returns {{ gold: number, materials: number }}
     */
    applyModifiers(raw) {
        let { gold, materials } = raw;

        // Corruption reduces gold income
        const corruptionMult = 1 - this.game.society.corruption / 100;
        gold = Math.floor(gold * corruptionMult);

        // Decadence reduces all production (half the percentage)
        const decadenceMult = 1 - this.game.society.decadence / 200;
        gold = Math.floor(gold * decadenceMult);
        materials = Math.floor(materials * decadenceMult);

        return { gold, materials };
    }

    /**
     * Calculate final production after all modifiers.
     * @returns {{ gold: number, materials: number }}
     */
    calculate() {
        const raw = this.calculateRaw();
        return this.applyModifiers(raw);
    }

    /**
     * Get income summary for UI display.
     * @returns {{ gold: number, materials: number }}
     */
    getIncome() {
        return this.calculate();
    }

    /**
     * Apply production to game resources.
     * @returns {{ gold: number, materials: number }}
     */
    apply() {
        const production = this.calculate();

        this.game.resources.gold += production.gold;
        this.game.resources.materials += production.materials;

        return production;
    }
}
