// Collapse Logic - handles civilization collapse mechanics

import { ERA, STARTING_RESOURCES } from './config.js';
import { Rando } from './rando.js';

export class Collapse {
    constructor(game) {
        this.game = game;
    }

    // Check if collapse conditions are met (two society params at 100)
    shouldCollapse() {
        const society = this.game.society;
        const critical = [
            society.corruption >= 100,
            society.unrest >= 100,
            society.decadence >= 100,
            society.overextension >= 100
        ].filter(x => x).length;

        return critical >= 2;
    }

    // Execute the collapse
    execute() {
        this.game.era = ERA.BARBARIAN;
        this.resetSociety();

        if (this.game.settlements.length > 0) {
            const keeper = this.findSmallestSettlement();
            this.convertSettlementsToDangerPoints(keeper);
            this.resetSettlement(keeper);
            this.game.settlements = [keeper];
        }

        this.removeAllUnits();
        this.game.resources = { ...STARTING_RESOURCES };
        this.game.updateControlledTerritory();
    }

    resetSociety() {
        this.game.society = { corruption: 0, unrest: 0, decadence: 0, overextension: 0 };
    }

    findSmallestSettlement() {
        const settlements = this.game.settlements;
        const minTier = Math.min(...settlements.map(s => s.tier));
        const smallest = settlements.filter(s => s.tier === minTier);
        return Rando.choice(smallest);
    }

    resetSettlement(settlement) {
        settlement.tier = 0;
        settlement.growthPoints = 0;
    }

    // Convert all settlements except keeper to danger points with random strength distribution
    convertSettlementsToDangerPoints(keeper) {
        const dangerHexes = [];

        for (const s of this.game.settlements) {
            if (s.id === keeper.id) continue;

            const hex = this.game.getHex(s.q, s.r);
            if (hex) {
                hex.dangerPoint = { strength: 0, turnsUntilSpawn: 1 };
                hex.settlement = null;
                dangerHexes.push(hex);
            }
        }

        this.distributeStrengthPoints(dangerHexes, 15);
        this.finalizeDangerPoints(dangerHexes);
    }

    // Randomly distribute strength points among danger point hexes
    distributeStrengthPoints(dangerHexes, points) {
        for (let i = 0; i < points && dangerHexes.length > 0; i++) {
            const hex = Rando.choice(dangerHexes);
            hex.dangerPoint.strength++;
        }
    }

    // Remove strength-0 danger points and set spawn timers for the rest
    finalizeDangerPoints(dangerHexes) {
        for (const hex of dangerHexes) {
            if (hex.dangerPoint.strength === 0) {
                hex.dangerPoint = null;
            } else {
                const maxSpawnTime = this.game.getSpawnRate(hex.dangerPoint.strength);
                hex.dangerPoint.turnsUntilSpawn = Rando.int(1, maxSpawnTime);
            }
        }
    }

    removeAllUnits() {
        for (const unit of this.game.units) {
            const hex = this.game.getHex(unit.q, unit.r);
            if (hex) hex.units = [];
        }
        this.game.units = [];
    }
}
