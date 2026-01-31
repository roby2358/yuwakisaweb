/*
MIT License

Copyright (c) 2025 Rob Young

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Main Game State and Logic

import {
    TERRAIN, TERRAIN_MOVEMENT, TERRAIN_DEFENSE,
    SETTLEMENT_LEVEL, SETTLEMENT_NAMES, SETTLEMENT_PRODUCTION, SETTLEMENT_INFLUENCE,
    SETTLEMENT_UPGRADE_COST, SETTLEMENT_UPGRADE_LEVELS,
    SETTLEMENT_POPULATION, SETTLEMENT_GROWTH_THRESHOLD, getSettlementGrowth,
    getSettlementFoundCost,
    UNIT_TYPE, UNIT_STATS,
    INSTALLATION_TYPE, INSTALLATION_STATS,
    ERA, ERA_THRESHOLDS,
    STARTING_RESOURCES
} from './config.js';
import { hexKey, parseHexKey, hexDistance, hexNeighbors, hexesInRange, findPath } from './hex.js';
import { generateTerrain, findStartingLocation } from './terrain.js';
import { Production } from './production.js';
import { createShuffledOptions } from './society.js';
import { gaussian } from './utils.js';
import { Rando } from './rando.js';

export class Game {
    constructor(mapRadius = 12) {
        this.mapRadius = mapRadius;
        this.hexes = generateTerrain(mapRadius);
        this.turn = 1;
        this.era = ERA.BARBARIAN;

        this.resources = { ...STARTING_RESOURCES };

        this.society = {
            corruption: 0,
            unrest: 0,
            decadence: 0,
            overextension: 0
        };

        this.settlements = [];
        this.units = [];
        this.enemies = [];

        this.selectedHex = null;
        this.selectedUnit = null;

        // Shuffled society options (refreshed each turn)
        this.shuffledSocietyOptions = createShuffledOptions();

        // Spawn rates by danger point size (1-6)
        this.spawnRates = [4, 3, 3, 2, 2, 1];

        // Stacking limit for military units
        this.maxUnitsPerHex = 2;

        // Max settlement level (0-indexed, so 9 = level 10)
        this.maxSettlementLevel = 9;

        // Initialize starting settlement
        this.initializeStart();
    }

    // ============ Helper Functions ============

    // Get hex at coordinates
    getHex(q, r) {
        return this.hexes.get(hexKey(q, r));
    }

    // Get enemies at a specific location
    getEnemiesAt(q, r) {
        return this.enemies.filter(e => e.q === q && e.r === r);
    }

    // Get friendly units at a specific location
    getUnitsAt(q, r) {
        const hex = this.getHex(q, r);
        if (!hex) return [];
        return hex.units.filter(u => this.units.includes(u));
    }

    // Check if a hex is a valid move/spawn target for enemies
    isValidEnemyMove(q, r, excludeEnemy = null) {
        const hex = this.getHex(q, r);
        if (!hex) return false;
        if (TERRAIN_MOVEMENT[hex.terrain] === Infinity) return false;
        // No stacking with other enemies
        if (this.enemies.some(e => e !== excludeEnemy && e.q === q && e.r === r)) return false;
        // Cannot move onto units, settlements, or installations
        if (this.units.some(u => u.q === q && u.r === r)) return false;
        if (this.settlements.some(s => s.q === q && s.r === r)) return false;
        if (hex.installation) return false;
        return true;
    }

    // Check if player can afford a cost
    canAfford(cost) {
        if (cost.gold && this.resources.gold < cost.gold) return false;
        if (cost.materials && this.resources.materials < cost.materials) return false;
        return true;
    }

    // Spend resources
    spend(cost) {
        if (cost.gold) this.resources.gold -= cost.gold;
        if (cost.materials) this.resources.materials -= cost.materials;
    }

    // Calculate combat damage with scaling and Gaussian randomization
    // Damage scales with attack relative to defense, randomized around expected value
    calculateDamage(attack, defense) {
        // Base expected damage scales with attack ratio: attack^2 / (attack + defense)
        // When attack = defense, expected = attack/2
        // When attack >> defense, expected approaches attack
        // When attack << defense, expected approaches 0
        const expectedDamage = (attack * attack) / (attack + defense);

        // Gaussian randomization: stddev = 25% of expected, min 1
        const stddev = Math.max(1, expectedDamage * 0.25);
        const randomizedDamage = expectedDamage + Rando.gaussian() * stddev;

        // Floor and ensure minimum 0
        return Math.max(0, Math.floor(randomizedDamage));
    }

    // Get spawn rate for a danger point size
    getSpawnRate(size) {
        return this.spawnRates[size - 1] || 1;
    }

    // Find nearest entity matching predicate
    findNearest(fromQ, fromR, predicate) {
        let nearest = null;
        let nearestDist = Infinity;

        for (const [key, hex] of this.hexes) {
            if (predicate(hex)) {
                const dist = hexDistance(fromQ, fromR, hex.q, hex.r);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = { q: hex.q, r: hex.r };
                }
            }
        }
        return nearest;
    }

    // Find nearest settlement
    findNearestSettlement(fromQ, fromR) {
        return this.findNearest(fromQ, fromR, hex => hex.settlement);
    }

    // Calculate income per turn (gold and materials)
    calculateIncome() {
        return new Production(this).getIncome();
    }

    // Remove unit from game
    removeUnit(unit) {
        const hex = this.getHex(unit.q, unit.r);
        if (hex) {
            hex.units = hex.units.filter(u => u.id !== unit.id);
        }
        this.units = this.units.filter(u => u.id !== unit.id);
    }

    // Check if hex can accept another unit (stacking limit)
    canStackUnit(q, r) {
        return this.getUnitsAt(q, r).length < this.maxUnitsPerHex;
    }

    // Get settlement defense bonus (scales from 2 at level 1 to 4 at level 10)
    getSettlementDefense(settlement) {
        if (!settlement) return 0;
        // Defense scales: 2 + (tier * 2/9), giving 2.0 to 4.0
        return Math.floor(2 + (settlement.tier * 2 / 9));
    }

    // ============ End Helper Functions ============

    initializeStart() {
        const startHex = findStartingLocation(this.hexes, this.mapRadius);
        if (startHex) {
            this.createSettlement(startHex.q, startHex.r, SETTLEMENT_LEVEL.CAMP);
            // Control initial territory
            this.updateControlledTerritory();
        }
    }

    // Settlement Management
    createSettlement(q, r, tier = SETTLEMENT_LEVEL.CAMP) {
        const hex = this.getHex(q, r);
        if (!hex || hex.settlement) return null;

        const settlement = {
            id: Date.now() + Math.random(),
            q, r,
            tier,
            growthPoints: 0
        };

        hex.settlement = settlement;
        this.settlements.push(settlement);
        this.updateControlledTerritory();
        return settlement;
    }

    // Check if settlement can be manually upgraded (only at threshold levels)
    canUpgradeSettlement(settlement) {
        // Already at max level
        if (settlement.tier >= this.maxSettlementLevel) return false;

        // Can only manually upgrade at threshold levels
        if (!SETTLEMENT_UPGRADE_LEVELS.includes(settlement.tier)) return false;

        const nextLevel = settlement.tier + 1;
        const cost = SETTLEMENT_UPGRADE_COST[nextLevel];

        if (!cost || !this.canAfford(cost)) return false;

        // Check dominance shadow cap
        const maxLevel = this.getMaxTierAt(settlement.q, settlement.r);
        if (nextLevel > maxLevel) return false;

        return true;
    }

    upgradeSettlement(settlement) {
        if (!this.canUpgradeSettlement(settlement)) return false;

        const nextLevel = settlement.tier + 1;
        this.spend(SETTLEMENT_UPGRADE_COST[nextLevel]);
        settlement.tier = nextLevel;
        settlement.growthPoints = 0;
        this.updateControlledTerritory();
        return true;
    }

    // Check if a settlement can found a new settlement
    canFoundSettlement(settlement) {
        // Must be at least tier 1 (so it can go down to tier 0)
        if (settlement.tier < 1) return false;

        // Check cost based on current era
        const cost = getSettlementFoundCost(this.era);
        if (!this.canAfford(cost)) return false;

        // Check if there's a valid location to place the new settlement
        const targetHex = this.findBestFoundingLocation(settlement);
        if (!targetHex) return false;

        return true;
    }

    // Find the best hex for founding a new settlement from a source
    findBestFoundingLocation(sourceSettlement) {
        let bestHex = null;
        let bestScore = 0;

        for (const [key, hex] of this.hexes) {
            const score = this.calculateSpawnScore(hex);
            if (score > bestScore) {
                bestScore = score;
                bestHex = hex;
            }
        }

        return bestHex;
    }

    // Found a new settlement from an existing one
    foundSettlement(sourceSettlement) {
        if (!this.canFoundSettlement(sourceSettlement)) return null;

        const cost = getSettlementFoundCost(this.era);
        const targetHex = this.findBestFoundingLocation(sourceSettlement);

        if (!targetHex) return null;

        // Spend resources
        this.spend(cost);

        // Reduce source settlement tier by 1
        sourceSettlement.tier--;
        sourceSettlement.growthPoints = 0;

        // Create new settlement at tier 0 (Camp)
        const newSettlement = this.createSettlement(targetHex.q, targetHex.r, SETTLEMENT_LEVEL.CAMP);

        this.updateControlledTerritory();
        return newSettlement;
    }

    // Check if settlement can auto-advance (not at a threshold that requires manual upgrade)
    canAutoAdvance(settlement) {
        if (settlement.tier >= this.maxSettlementLevel) return false;
        if (SETTLEMENT_UPGRADE_LEVELS.includes(settlement.tier)) return false;

        // Check dominance shadow cap
        const maxLevel = this.getMaxTierAt(settlement.q, settlement.r);
        if (settlement.tier + 1 > maxLevel) return false;

        return true;
    }

    // Population Influence System
    calculateInfluenceAt(q, r) {
        let totalInfluence = 0;

        for (const settlement of this.settlements) {
            const dist = hexDistance(q, r, settlement.q, settlement.r);
            const { strength, radius } = SETTLEMENT_INFLUENCE[settlement.tier];

            if (dist <= radius) {
                // Gaussian falloff (sigma = radius/2)
                totalInfluence += strength * gaussian(dist, radius / 2);
            }
        }

        return totalInfluence;
    }

    // Dominance shadow - larger settlements cap growth of nearby smaller ones
    getMaxTierAt(q, r) {
        let maxAllowed = this.maxSettlementLevel; // Default: no cap

        for (const settlement of this.settlements) {
            if (settlement.q === q && settlement.r === r) continue;

            const dist = hexDistance(q, r, settlement.q, settlement.r);
            const { radius } = SETTLEMENT_INFLUENCE[settlement.tier];

            // Within dominance shadow?
            if (dist <= radius) {
                // Capped one tier below the dominant settlement
                const cap = Math.max(0, settlement.tier - 1);
                maxAllowed = Math.min(maxAllowed, cap);
            }
        }

        return maxAllowed;
    }

    // Unit Management
    canBuildUnit(settlement, unitType) {
        if (!settlement) return false;
        if (!this.canAfford(UNIT_STATS[unitType].cost)) return false;
        // Check stacking limit
        if (!this.canStackUnit(settlement.q, settlement.r)) return false;
        return true;
    }

    buildUnit(settlement, unitType) {
        if (!this.canBuildUnit(settlement, unitType)) return null;

        const stats = UNIT_STATS[unitType];
        this.spend(stats.cost);

        const unit = {
            id: Date.now() + Math.random(),
            type: unitType,
            q: settlement.q,
            r: settlement.r,
            health: stats.health,
            maxHealth: stats.health,
            movesLeft: stats.speed
        };

        const hex = this.getHex(settlement.q, settlement.r);
        hex.units.push(unit);
        this.units.push(unit);

        return unit;
    }

    canMoveUnit(unit, toQ, toR) {
        if (unit.movesLeft <= 0) return false;

        const toHex = this.getHex(toQ, toR);
        if (!toHex) return false;

        const moveCost = TERRAIN_MOVEMENT[toHex.terrain];
        if (moveCost === Infinity) return false;

        // Check if adjacent
        if (hexDistance(unit.q, unit.r, toQ, toR) !== 1) return false;

        if (unit.movesLeft < moveCost) return false;

        // Can't move onto enemy units (must attack instead)
        if (this.getEnemiesAt(toQ, toR).length > 0) return false;

        // Check stacking limit
        if (!this.canStackUnit(toQ, toR)) return false;

        return true;
    }

    moveUnit(unit, toQ, toR) {
        if (!this.canMoveUnit(unit, toQ, toR)) return false;

        const fromHex = this.getHex(unit.q, unit.r);
        const toHex = this.getHex(toQ, toR);
        const moveCost = TERRAIN_MOVEMENT[toHex.terrain];

        // Remove from old hex
        fromHex.units = fromHex.units.filter(u => u.id !== unit.id);

        // Move to new hex
        unit.q = toQ;
        unit.r = toR;
        unit.movesLeft -= moveCost;
        toHex.units.push(unit);

        // Deselect unit if it has no moves left
        if (unit.movesLeft <= 0 && this.selectedUnit === unit) {
            this.selectedUnit = null;
        }

        this.updateControlledTerritory();
        return true;
    }

    getValidMoves(unit) {
        const moves = [];
        const neighbors = hexNeighbors(unit.q, unit.r);

        for (const n of neighbors) {
            if (this.canMoveUnit(unit, n.q, n.r)) {
                moves.push(n);
            }
        }

        return moves;
    }

    // Combat
    canAttack(unit, targetQ, targetR) {
        if (unit.movesLeft <= 0) return false;
        if (hexDistance(unit.q, unit.r, targetQ, targetR) !== 1) return false;
        return this.getEnemiesAt(targetQ, targetR).length > 0;
    }

    attack(unit, targetQ, targetR) {
        if (!this.canAttack(unit, targetQ, targetR)) return null;

        const targetHex = this.getHex(targetQ, targetR);
        const enemiesAt = this.getEnemiesAt(targetQ, targetR);
        if (enemiesAt.length === 0) return null;

        const enemy = enemiesAt[0];
        const unitStats = UNIT_STATS[unit.type];

        // Calculate damage (attack vs defense + terrain)
        const terrainDef = TERRAIN_DEFENSE[targetHex.terrain];
        const damage = this.calculateDamage(unitStats.attack, enemy.defense + terrainDef);

        enemy.health -= damage;
        unit.movesLeft = 0;

        // Deselect unit if it has no moves left
        if (unit.movesLeft <= 0 && this.selectedUnit === unit) {
            this.selectedUnit = null;
        }

        const result = { damage, killed: false };

        if (enemy.health <= 0) {
            this.enemies = this.enemies.filter(e => e.id !== enemy.id);
            result.killed = true;

            // Loot: 1-4 gold and 1-4 materials
            const goldLoot = Rando.int(1, 4);
            const materialsLoot = Rando.int(1, 4);
            this.resources.gold += goldLoot;
            this.resources.materials += materialsLoot;
            result.loot = { gold: goldLoot, materials: materialsLoot };

            // Move unit into the hex if empty
            if (this.getEnemiesAt(targetQ, targetR).length === 0) {
                const fromHex = this.getHex(unit.q, unit.r);
                fromHex.units = fromHex.units.filter(u => u.id !== unit.id);
                unit.q = targetQ;
                unit.r = targetR;
                targetHex.units.push(unit);
            }
        } else {
            // Counter-attack (unit gets settlement/installation defense bonus)
            const unitHex = this.getHex(unit.q, unit.r);
            const structureDef = this.getSettlementDefense(unitHex?.settlement) +
                                 (unitHex?.installation?.defense || 0);
            // Cavalry has 5 defense when attacking (strong charge, needs support when defending)
            const baseDefense = unit.type === UNIT_TYPE.CAVALRY ? 5 : unitStats.defense;
            const counterDamage = this.calculateDamage(enemy.attack, baseDefense + structureDef);
            unit.health -= counterDamage;
            result.counterDamage = counterDamage;

            if (unit.health <= 0) {
                this.removeUnit(unit);
                result.unitKilled = true;

                // Increase unrest from military losses
                this.society.unrest = Math.min(100, this.society.unrest + 2);
            }
        }

        this.updateControlledTerritory();
        return result;
    }

    // Installation Management
    canBuildInstallation(hex, type) {
        if (!hex.dangerPoint) return false;
        if (hex.installation) return false;

        if (!this.canAfford(INSTALLATION_STATS[type].cost)) return false;

        // Must have a unit present, no enemies
        if (this.getUnitsAt(hex.q, hex.r).length === 0) return false;
        if (this.getEnemiesAt(hex.q, hex.r).length > 0) return false;

        return true;
    }

    buildInstallation(hex, type) {
        if (!this.canBuildInstallation(hex, type)) return false;

        const stats = INSTALLATION_STATS[type];
        this.spend(stats.cost);

        hex.installation = {
            type,
            defense: stats.defense
        };

        // Neutralize danger point
        hex.dangerPoint = null;
        this.updateControlledTerritory();
        return true;
    }

    // Territory Control
    updateControlledTerritory() {
        // Reset all
        for (const [key, hex] of this.hexes) {
            hex.controlled = false;
        }

        // Mark hexes around settlements and units as controlled
        for (const settlement of this.settlements) {
            const { radius } = SETTLEMENT_INFLUENCE[settlement.tier];
            const nearbyHexes = hexesInRange(settlement.q, settlement.r, radius);
            for (const h of nearbyHexes) {
                const hex = this.getHex(h.q, h.r);
                if (hex && hex.terrain !== TERRAIN.WATER) {
                    hex.controlled = true;
                }
            }
        }

        // Units also control adjacent hexes
        for (const unit of this.units) {
            const hex = this.getHex(unit.q, unit.r);
            if (hex) hex.controlled = true;

            for (const n of hexNeighbors(unit.q, unit.r)) {
                const nHex = this.getHex(n.q, n.r);
                if (nHex && nHex.terrain !== TERRAIN.WATER) {
                    nHex.controlled = true;
                }
            }
        }
    }

    getControlledHexCount() {
        let count = 0;
        for (const [key, hex] of this.hexes) {
            if (hex.controlled) count++;
        }
        return count;
    }

    // Count hexes within settlement influence (not unit adjacency)
    getInfluencedHexCount() {
        let count = 0;
        for (const [key, hex] of this.hexes) {
            if (hex.terrain === TERRAIN.WATER) continue;
            const influence = this.calculateInfluenceAt(hex.q, hex.r);
            if (influence > 0) count++;
        }
        return count;
    }

    // Turn Processing
    endTurn() {
        // 1. Heal units and reset moves
        for (const unit of this.units) {
            const stats = UNIT_STATS[unit.type];

            // Healing: 0% if no moves left, 20% if has moves left, 30% if in settlement/installation
            const hex = this.getHex(unit.q, unit.r);
            const hasMovesLeft = unit.movesLeft > 0;
            const inStructure = hex && (hex.settlement || hex.installation);

            let healPercent = 0; // No healing if used all movement or attacked
            if (hasMovesLeft) {
                healPercent = inStructure ? 0.3 : 0.2;
            }

            if (healPercent > 0) {
                const healAmount = Math.ceil(unit.maxHealth * healPercent);
                unit.health = Math.min(unit.maxHealth, unit.health + healAmount);
            }

            // Reset for next turn
            unit.movesLeft = stats.speed;
        }

        // Sort units within each hex: cavalry > heavy_infantry > infantry > worker, then by HP desc
        const unitTypePriority = {
            [UNIT_TYPE.CAVALRY]: 0,
            [UNIT_TYPE.HEAVY_INFANTRY]: 1,
            [UNIT_TYPE.INFANTRY]: 2,
            [UNIT_TYPE.WORKER]: 3
        };
        for (const [key, hex] of this.hexes) {
            if (hex.units.length > 1) {
                hex.units.sort((a, b) => {
                    const typeDiff = unitTypePriority[a.type] - unitTypePriority[b.type];
                    if (typeDiff !== 0) return typeDiff;
                    return b.health - a.health; // Higher HP first
                });
            }
        }

        // 2. Process danger points occupied by military units
        this.processDangerPointOccupation();

        // 3. Enemy spawning
        this.processEnemySpawns();

        // 4. Enemy movement and attacks
        this.processEnemyTurn();

        // 5. Resource production
        this.processProduction();

        // 6. Settlement growth
        this.processSettlementGrowth();

        // 7. Spontaneous settlement spawning
        this.processSettlementSpawning();

        // 8. Update society parameters
        this.updateSocietyParams();

        // 9. Check era transitions
        this.checkEraTransition();

        // 10. Check for collapse
        this.checkCollapse();

        // 11. Deselect unit at turn end (don't auto-select next turn)
        this.selectedUnit = null;

        // 12. Shuffle society options for next turn
        this.shuffledSocietyOptions = createShuffledOptions();

        // 13. Select largest settlement for next turn (without auto-selecting units)
        if (this.settlements.length > 0) {
            const maxTier = Math.max(...this.settlements.map(s => s.tier));
            const largest = this.settlements.filter(s => s.tier === maxTier);
            const selected = largest[Math.floor(Math.random() * largest.length)];
            this.selectedHex = this.getHex(selected.q, selected.r);
        }

        this.turn++;
        return true;
    }

    processDangerPointOccupation() {
        for (const [key, hex] of this.hexes) {
            if (!hex.dangerPoint) continue;

            // Check if a friendly military unit occupies this danger point
            const hasUnit = this.units.some(u => u.q === hex.q && u.r === hex.r);
            if (hasUnit) {
                // Roll a die (1-6), reduce strength if roll > size
                // This means size 6 danger points can only be removed with installations
                const roll = 1 + Math.floor(Math.random() * 6);
                if (roll > hex.dangerPoint.strength) {
                    hex.dangerPoint.strength--;

                    // If strength reaches 0, remove the danger point
                    if (hex.dangerPoint.strength <= 0) {
                        hex.dangerPoint = null;
                    }
                }
            }
        }
    }

    processEnemySpawns() {
        for (const [key, hex] of this.hexes) {
            if (!hex.dangerPoint) continue;

            hex.dangerPoint.turnsUntilSpawn--;

            if (hex.dangerPoint.turnsUntilSpawn <= 0) {
                // Find valid adjacent hexes to spawn enemies (reuse enemy move validation)
                const neighbors = hexNeighbors(hex.q, hex.r);
                const validSpawns = neighbors.filter(n => this.isValidEnemyMove(n.q, n.r));

                // Spawn 1 enemy on a random adjacent hex (strength affects rate, not count)
                if (validSpawns.length > 0) {
                    const spawnHex = validSpawns[Math.floor(Math.random() * validSpawns.length)];
                    this.enemies.push({
                        id: Date.now() + Math.random(),
                        q: spawnHex.q,
                        r: spawnHex.r,
                        attack: 5,
                        defense: 1,
                        health: 8,
                        maxHealth: 8
                    });
                }

                hex.dangerPoint.turnsUntilSpawn = this.getSpawnRate(hex.dangerPoint.strength);
            }
        }
    }

    processEnemyTurn() {
        for (const enemy of this.enemies) {
            // First, attack any adjacent targets
            if (this.tryEnemyAttack(enemy)) continue;

            // Movement: always move 1 space
            // 1/3 toward resource, 1/3 toward settlement, 1/3 random
            const roll = Math.random();

            if (roll < 1/3) {
                // Move toward nearest resource
                const target = this.findNearest(enemy.q, enemy.r, hex => hex.resource);
                this.moveEnemyToward(enemy, target);
            } else if (roll < 2/3) {
                // Move toward nearest settlement
                const target = this.findNearestSettlement(enemy.q, enemy.r);
                this.moveEnemyToward(enemy, target);
            } else {
                // Random movement
                this.moveEnemyRandom(enemy);
            }
        }
    }

    // Try to attack adjacent targets, returns true if attacked
    tryEnemyAttack(enemy) {
        const adjacentHexes = hexNeighbors(enemy.q, enemy.r);

        // Find all adjacent units
        const adjacentUnits = this.units.filter(u =>
            adjacentHexes.some(h => h.q === u.q && h.r === u.r)
        );

        // Attack in priority order: heavy_infantry, infantry, cavalry
        const attackOrder = [UNIT_TYPE.HEAVY_INFANTRY, UNIT_TYPE.INFANTRY, UNIT_TYPE.CAVALRY];
        for (const unitType of attackOrder) {
            const targets = adjacentUnits.filter(u => u.type === unitType);
            if (targets.length > 0) {
                const target = Rando.choice(targets);
                this.enemyAttack(enemy, { q: target.q, r: target.r, isUnit: true, unit: target });
                return true;
            }
        }

        // If no units, attack adjacent settlement
        for (const settlement of this.settlements) {
            if (hexDistance(enemy.q, enemy.r, settlement.q, settlement.r) === 1) {
                this.enemyAttack(enemy, { q: settlement.q, r: settlement.r, isSettlement: true });
                return true;
            }
        }

        // If no settlements, attack adjacent undefended installation
        for (const n of adjacentHexes) {
            const hex = this.getHex(n.q, n.r);
            if (hex && hex.installation) {
                const defenders = this.getUnitsAt(n.q, n.r);
                if (defenders.length === 0) {
                    this.enemyAttackInstallation(enemy, hex);
                    return true;
                }
            }
        }

        return false;
    }

    // Enemy attacks an undefended installation - both are destroyed, creates danger point
    enemyAttackInstallation(enemy, hex) {
        // Destroy the installation
        hex.installation = null;

        // Create a danger point with random size 1-6
        const dangerSize = Rando.int(1, 6);
        const initialCountdown = Rando.int(1, this.getSpawnRate(dangerSize));
        hex.dangerPoint = {
            strength: dangerSize,
            turnsUntilSpawn: initialCountdown
        };

        // Remove the enemy
        this.enemies = this.enemies.filter(e => e.id !== enemy.id);

        // Increase unrest from losing the installation
        this.society.unrest = Math.min(100, this.society.unrest + 5);
    }

    // Get valid move destinations for an enemy
    getValidEnemyMoves(enemy) {
        return hexNeighbors(enemy.q, enemy.r).filter(n => this.isValidEnemyMove(n.q, n.r, enemy));
    }

    // Move enemy toward a target
    moveEnemyToward(enemy, target) {
        if (!target) return;

        const validMoves = this.getValidEnemyMoves(enemy);
        let bestMove = null;
        let bestDist = Infinity;

        for (const n of validMoves) {
            const dist = hexDistance(n.q, n.r, target.q, target.r);
            if (dist < bestDist) {
                bestDist = dist;
                bestMove = n;
            }
        }

        // Only move if it gets us closer
        if (bestMove && bestDist < hexDistance(enemy.q, enemy.r, target.q, target.r)) {
            enemy.q = bestMove.q;
            enemy.r = bestMove.r;
        }
    }

    // Move enemy to a random valid hex
    moveEnemyRandom(enemy) {
        const validMoves = this.getValidEnemyMoves(enemy);
        const randomMove = Rando.choice(validMoves);
        if (randomMove) {
            enemy.q = randomMove.q;
            enemy.r = randomMove.r;
        }
    }

    enemyAttack(enemy, target) {
        if (target.isUnit) {
            // Use specific unit if provided, otherwise find one at location
            const unit = target.unit || this.units.find(u => u.q === target.q && u.r === target.r);
            if (unit) {
                const unitStats = UNIT_STATS[unit.type];

                // Unit gets settlement/installation defense bonus
                const unitHex = this.getHex(unit.q, unit.r);
                const structureDef = this.getSettlementDefense(unitHex?.settlement) +
                                     (unitHex?.installation?.defense || 0);
                const damage = this.calculateDamage(enemy.attack, unitStats.defense + structureDef);
                unit.health -= damage;

                // Counter-attack from unit to enemy
                const counterDamage = this.calculateDamage(unitStats.attack, enemy.defense);
                enemy.health -= counterDamage;

                // Check if enemy died from counter-attack
                if (enemy.health <= 0) {
                    this.enemies = this.enemies.filter(e => e.id !== enemy.id);
                }

                if (unit.health <= 0) {
                    this.removeUnit(unit);
                    this.society.unrest = Math.min(100, this.society.unrest + 3);
                }
            }
        } else if (target.isSettlement) {
            const settlement = this.settlements.find(s => s.q === target.q && s.r === target.r);
            if (settlement) {
                // Damage settlement - increase unrest significantly
                this.society.unrest = Math.min(100, this.society.unrest + 5);

                // Small chance to damage undefended settlement
                const defenders = this.getUnitsAt(settlement.q, settlement.r);
                if (defenders.length === 0 && Math.random() < 0.3) {
                    if (settlement.tier > SETTLEMENT_LEVEL.CAMP) {
                        settlement.tier--;
                    } else if (this.settlements.length > 1) {
                        this.destroySettlement(settlement);
                        this.society.unrest = Math.min(100, this.society.unrest + 10);
                    }
                }
            }
        }
    }

    // Remove a settlement from the game
    destroySettlement(settlement) {
        const hex = this.getHex(settlement.q, settlement.r);
        if (hex) hex.settlement = null;
        this.settlements = this.settlements.filter(s => s.id !== settlement.id);
    }

    processProduction() {
        new Production(this).apply();
    }

    // Calculate total population from all settlements
    getPopulation() {
        let population = 0;
        for (const settlement of this.settlements) {
            population += SETTLEMENT_POPULATION[settlement.tier];
        }
        return population;
    }

    // Get growth threshold for a settlement tier
    getGrowthThreshold(tier) {
        return SETTLEMENT_GROWTH_THRESHOLD[tier] || 100;
    }

    processSettlementGrowth() {
        // Each settlement grows based on its tier (polynomial growth vs exponential threshold)
        for (const settlement of this.settlements) {
            const baseGrowth = getSettlementGrowth(settlement.tier);
            // Gaussian multiplier: mean 1.0, stddev 0.33 (±33% at 1 stddev)
            const gaussianMult = Math.max(0.1, 1 + Rando.gaussian() * 0.33);
            // Decadence bonus: 25% increase at 100 decadence (growth through excess)
            const decadenceMult = 1 + (this.society.decadence / 100) * 0.25;
            const growth = Math.floor(baseGrowth * gaussianMult * decadenceMult);
            settlement.growthPoints += growth;

            // Get threshold for current tier
            const threshold = this.getGrowthThreshold(settlement.tier);

            // Auto-advance if growth reaches threshold and not at a manual upgrade threshold
            while (settlement.growthPoints >= threshold && this.canAutoAdvance(settlement)) {
                settlement.tier++;
                settlement.growthPoints -= threshold;
                this.updateControlledTerritory();
            }
        }

        // Overflow from capped settlements (at max level or at upgrade threshold)
        for (const settlement of this.settlements) {
            const maxLevel = this.getMaxTierAt(settlement.q, settlement.r);
            const atCap = settlement.tier >= maxLevel ||
                          settlement.tier >= this.maxSettlementLevel ||
                          SETTLEMENT_UPGRADE_LEVELS.includes(settlement.tier);

            const threshold = this.getGrowthThreshold(settlement.tier);
            const halfThreshold = Math.floor(threshold / 2);

            if (atCap && settlement.growthPoints > halfThreshold) {
                const overflow = settlement.growthPoints - halfThreshold;
                settlement.growthPoints = halfThreshold;

                // Find nearest settlement with room to grow
                let nearest = null;
                let nearestDist = Infinity;

                for (const other of this.settlements) {
                    if (other.id === settlement.id) continue;
                    const otherThreshold = this.getGrowthThreshold(other.tier);
                    if (this.canAutoAdvance(other) || other.growthPoints < otherThreshold) {
                        const dist = hexDistance(settlement.q, settlement.r, other.q, other.r);
                        if (dist < nearestDist) {
                            nearestDist = dist;
                            nearest = other;
                        }
                    }
                }

                if (nearest) {
                    nearest.growthPoints += overflow;
                }
            }
        }
    }

    // Settlement spawn scoring parameters (all in one place for easy tuning)
    static SPAWN_CONFIG = {
        sigmaAttract: 4,        // Gaussian attraction stddev
        sigmaRepel: 1.1,        // Gaussian repulsion stddev
        repelStrength: 5,       // Repulsion multiplier (higher = stronger dead zone)
        lambdaDecay: {          // Exponential decay length by era (higher = farther reach)
            Barbarian: 0.5,
            Kingdom: 1,
            Empire: 4
        },
        resourceMultiplier: 8,  // Score multiplier per adjacent resource
        minScore: 0.001         // Minimum score threshold
    };

    // Calculate settlement spawn score for a single hex
    calculateSpawnScore(hex) {
        if (hex.settlement || hex.dangerPoint || hex.resource) return 0;
        if (hex.terrain !== TERRAIN.PLAINS && hex.terrain !== TERRAIN.HILLS) return 0;

        const cfg = Game.SPAWN_CONFIG;

        // Calculate attraction and repulsion from all settlements
        let attraction = 0;
        let repulsion = 0;
        let minDist = Infinity;

        for (const settlement of this.settlements) {
            const dist = hexDistance(hex.q, hex.r, settlement.q, settlement.r);
            const strength = settlement.tier + 1;
            minDist = Math.min(minDist, dist);

            // Gaussian attraction (1 stddev at sigmaAttract hexes)
            attraction += strength * gaussian(dist, cfg.sigmaAttract);

            // Gaussian repulsion (1 stddev at sigmaRepel hexes)
            repulsion += strength * cfg.repelStrength * gaussian(dist, cfg.sigmaRepel);
        }

        // Combine: attraction * (1 - repulsion), clamped to positive
        let score = attraction * Math.max(0, 1 - repulsion);

        // Apply exponential decay based on distance to nearest settlement (era-dependent)
        const lambdaDecay = cfg.lambdaDecay[this.era] || 0.5;
        score *= Math.exp(-minDist / lambdaDecay);

        // Resource adjacency bonus
        const neighbors = hexNeighbors(hex.q, hex.r);
        const adjacentResources = neighbors.filter(n => {
            const nHex = this.getHex(n.q, n.r);
            return nHex && nHex.resource;
        }).length;

        if (adjacentResources > 0) {
            score *= Math.pow(cfg.resourceMultiplier, adjacentResources);
        }

        // Apply minimum threshold
        if (score < cfg.minScore) return 0;

        return score;
    }

    // Get spawn scores for all hexes, normalized to 0-1 probabilities
    getSpawnProbabilities() {
        const scores = new Map();
        let totalScore = 0;

        for (const [key, hex] of this.hexes) {
            const score = this.calculateSpawnScore(hex);
            scores.set(key, score);
            totalScore += score;
        }

        // Normalize to probabilities
        const probabilities = new Map();
        for (const [key, score] of scores) {
            probabilities.set(key, totalScore > 0 ? score / totalScore : 0);
        }

        return probabilities;
    }

    processSettlementSpawning() {
        // Spawn chance based on unrest: 10% base + 0.5% per unrest point
        const spawnChance = 0.10 + (this.society.unrest / 200);
        if (Math.random() >= spawnChance) return;

        // Score all eligible hexes
        const candidates = [];

        for (const [key, hex] of this.hexes) {
            const score = this.calculateSpawnScore(hex);
            if (score > 0) {
                candidates.push({ hex, score });
            }
        }

        if (candidates.length === 0) return;

        // Weighted random selection by score
        const totalWeight = candidates.reduce((sum, c) => sum + c.score, 0);
        let roll = Math.random() * totalWeight;

        for (const c of candidates) {
            roll -= c.score;
            if (roll <= 0) {
                this.createSettlement(c.hex.q, c.hex.r, SETTLEMENT_LEVEL.CAMP);

                // Settlement spawning effects:
                // - Halve unrest (pressure released)
                this.society.unrest /= 2;
                // - Increase overextension by 25% (more territory to manage)
                this.society.overextension *= 1.25;
                this.society.overextension = Math.min(100, this.society.overextension);

                break;
            }
        }
    }

    updateSocietyParams() {
        const population = this.getPopulation();

        // Corruption: increases with gold income and settlements (unchanged)
        const goldIncome = this.settlements.reduce((sum, s) => sum + SETTLEMENT_PRODUCTION[s.tier].gold, 0);
        this.society.corruption = Math.min(100, this.society.corruption + goldIncome * 0.01 + this.settlements.length * 0.1);

        // Unrest: varies each turn, trending slightly positive
        // Range: -1 to +2 base (average +0.5) plus small population factor
        const unrestChange = (Math.random() * 3 - 1) + population * 0.02;
        this.society.unrest = Math.max(0, Math.min(100, this.society.unrest + unrestChange));

        // Decadence: scales with era at ratio 1:2:4 (Barbarian:Kingdom:Empire)
        const decadenceMultiplier = this.era === ERA.EMPIRE ? 4 : this.era === ERA.KINGDOM ? 2 : 1;
        const decadenceChange = 0.5 * decadenceMultiplier;
        this.society.decadence = Math.min(100, this.society.decadence + decadenceChange);

        // Overextension: +0.025 per influenced hex (round up), no decay
        const influencedHexCount = this.getInfluencedHexCount();
        const overextIncrease = Math.ceil(influencedHexCount * 0.025);
        this.society.overextension = Math.min(100, this.society.overextension + overextIncrease);

        // Unrest can cause revolts
        if (this.society.unrest > 75) {
            for (const settlement of this.settlements) {
                if (Math.random() < 0.05 && this.settlements.length > 1) {
                    // Settlement revolts - becomes neutral
                    this.destroySettlement(settlement);
                }
            }
        }
    }

    checkEraTransition() {
        const settlementCount = this.settlements.length;

        if (this.era === ERA.BARBARIAN) {
            if (settlementCount >= ERA_THRESHOLDS[ERA.KINGDOM].settlements) {
                this.era = ERA.KINGDOM;
            }
        } else if (this.era === ERA.KINGDOM) {
            if (settlementCount >= ERA_THRESHOLDS[ERA.EMPIRE].settlements) {
                this.era = ERA.EMPIRE;
            }
        }
    }

    checkCollapse() {
        // Collapse if two society params hit 100
        const critical = [
            this.society.corruption >= 100,
            this.society.unrest >= 100,
            this.society.decadence >= 100,
            this.society.overextension >= 100
        ].filter(x => x).length;

        if (critical >= 2) {
            this.triggerCollapse();
        }
    }

    triggerCollapse() {
        // Reset to barbarian era with single settlement
        this.era = ERA.BARBARIAN;
        this.society = { corruption: 0, unrest: 0, decadence: 0, overextension: 0 };

        if (this.settlements.length > 0) {
            // Find smallest settlement (random if tie)
            const minTier = Math.min(...this.settlements.map(s => s.tier));
            const smallest = this.settlements.filter(s => s.tier === minTier);
            const keeper = Rando.choice(smallest);

            // Convert other settlements to danger points
            for (const s of this.settlements) {
                if (s.id === keeper.id) continue;

                const hex = this.getHex(s.q, s.r);
                if (hex) {
                    // Danger point strength scales with settlement level (1-5 for levels 0-9)
                    const dangerStrength = Math.floor(s.tier / 2) + 1;
                    const maxSpawnTime = this.getSpawnRate(dangerStrength);
                    // Randomize initial countdown so they don't all spawn together
                    const initialCountdown = Rando.int(1, maxSpawnTime);
                    hex.dangerPoint = {
                        strength: dangerStrength,
                        turnsUntilSpawn: initialCountdown
                    };
                    hex.settlement = null;
                }
            }

            // Reset keeper to level 0 (Camp)
            keeper.tier = 0;
            keeper.growthPoints = 0;
            this.settlements = [keeper];
        }

        // Remove all units
        for (const unit of this.units) {
            const hex = this.getHex(unit.q, unit.r);
            if (hex) hex.units = [];
        }
        this.units = [];

        // Reset resources
        this.resources = { ...STARTING_RESOURCES };

        this.updateControlledTerritory();
    }

    // Selection helpers
    selectHex(q, r) {
        this.selectedHex = this.getHex(q, r) || null;
        this.selectedUnit = null;

        // Auto-select a unit with moves remaining, priority: cavalry > infantry > heavy infantry
        const friendlyUnits = this.selectedHex ? this.getUnitsAt(q, r) : [];
        const unitsWithMoves = friendlyUnits.filter(u => u.movesLeft > 0);

        if (unitsWithMoves.length > 0) {
            const selectionOrder = [UNIT_TYPE.CAVALRY, UNIT_TYPE.INFANTRY, UNIT_TYPE.HEAVY_INFANTRY];
            for (const unitType of selectionOrder) {
                const unit = unitsWithMoves.find(u => u.type === unitType);
                if (unit) {
                    this.selectedUnit = unit;
                    break;
                }
            }
        }
    }

    selectUnit(unit) {
        // Never select a unit with no moves left
        if (unit && unit.movesLeft > 0) {
            this.selectedUnit = unit;
        }
    }

    clearSelection() {
        this.selectedHex = null;
        this.selectedUnit = null;
    }
}
