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
    UNIT_TYPE, UNIT_STATS, ENEMY_SPAWN_WEIGHTS,
    INSTALLATION_TYPE, INSTALLATION_STATS, INSTALLATION_TIER,
    ERA, ERA_THRESHOLDS,
    STARTING_RESOURCES, DANGER_SPAWN_RATES
} from './config.js';
import { hexKey, parseHexKey, hexDistance, hexNeighbors, hexesInRange, findPath, bfsHexes } from './hex.js';
import { populateTerrain, findStartingLocation } from './terrain.js';
import { Production } from './production.js';
import { createShuffledOptions } from './society.js';
import { gaussian } from './utils.js';
import { Rando } from './rando.js';
import { Collapse } from './collapse.js';

export class Game {
    constructor(mapRadius, difficulty, hexes) {
        this.mapRadius = mapRadius;
        this.difficulty = difficulty;
        this.hexes = hexes;
        this.accessibleKeys = populateTerrain(this.hexes, mapRadius, difficulty.dangerSum, difficulty.maxDangerLevel);
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

        // Stacking limit for military units
        this.maxUnitsPerHex = 2;

        // Max settlement level (0-indexed, so 9 = level 10)
        this.maxSettlementLevel = 9;

        // Combat report for end-of-turn enemy attacks
        this.combatReport = [];

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
    isValidEnemyMove(q, r, excludeEnemy) {
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

    // Shared attack logic: attacker's attack vs unit's defense + structure defense
    // Applies damage, returns amount dealt. Callers handle death, reporting, unrest.
    strikeUnit(attack, unit) {
        const unitStats = UNIT_STATS[unit.type];
        const structureDef = this.getStructureDefenseAt(unit.q, unit.r);
        const damage = this.calculateDamage(attack, unitStats.defense + structureDef);
        unit.health -= damage;
        return damage;
    }

    // Get spawn rate for a danger point size
    getSpawnRate(size) {
        return DANGER_SPAWN_RATES[size - 1];
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

    // Get combined structure defense at a location (settlement + installation)
    getStructureDefenseAt(q, r) {
        const hex = this.getHex(q, r);
        if (!hex) return 0;
        return this.getSettlementDefense(hex.settlement) + (hex.installation?.defense || 0);
    }

    // Generate random loot (gold and materials) using 2d6 per resource, with optional multiplier
    generateLoot(multiplier) {
        return {
            gold: (Rando.int(1, 6) + Rando.int(1, 6)) * multiplier,
            materials: (Rando.int(1, 6) + Rando.int(1, 6)) * multiplier
        };
    }

    // Add loot to player resources
    collectLoot(loot) {
        this.resources.gold += loot.gold;
        this.resources.materials += loot.materials;
    }

    // Increase a society parameter, clamping to 0-100
    adjustSociety(param, amount) {
        this.society[param] = Math.max(0, Math.min(100, this.society[param] + amount));
    }

    // Create a danger point at a hex
    createDangerPoint(hex, strength) {
        const maxSpawnTime = this.getSpawnRate(strength);
        hex.dangerPoint = {
            strength,
            turnsUntilSpawn: Rando.int(1, maxSpawnTime)
        };
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
    createSettlement(q, r, tier) {
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

    getValidMoves(unit) {
        if (unit.movesLeft <= 0) return new Map();

        const startHex = this.getHex(unit.q, unit.r);
        if (!startHex) return new Map();

        const reachable = bfsHexes(startHex, this.hexes, hex => {
            if (this.getEnemiesAt(hex.q, hex.r).length > 0) return Infinity;
            if (!this.canStackUnit(hex.q, hex.r)) return Infinity;
            return TERRAIN_MOVEMENT[hex.terrain] ?? Infinity;
        }, unit.movesLeft);

        reachable.delete(hexKey(unit.q, unit.r));
        return reachable;
    }

    canMoveUnit(unit, toQ, toR) {
        const reachable = this.getValidMoves(unit);
        return reachable.has(hexKey(toQ, toR));
    }

    moveUnit(unit, toQ, toR) {
        const reachable = this.getValidMoves(unit);
        const key = hexKey(toQ, toR);
        const cost = reachable.get(key);
        if (cost === undefined) return false;

        const fromHex = this.getHex(unit.q, unit.r);
        const toHex = this.getHex(toQ, toR);

        // Remove from old hex
        fromHex.units = fromHex.units.filter(u => u.id !== unit.id);

        // Move to new hex
        unit.q = toQ;
        unit.r = toR;
        unit.movesLeft -= cost;
        toHex.units.push(unit);

        this.updateControlledTerritory();
        return true;
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

        if (this.selectedUnit === unit) {
            this.selectedUnit = null;
        }

        const result = { damage, killed: false };

        if (enemy.health <= 0) {
            this.removeEnemy(enemy);
            result.killed = true;
            result.loot = this.generateLoot(1);
            this.collectLoot(result.loot);
            this.moveUnitToHex(unit, targetHex);
        } else {
            result.counterDamage = this.processCounterAttack(enemy, unit, unitStats);
            if (unit.health <= 0) {
                this.removeUnit(unit);
                result.unitKilled = true;
                this.adjustSociety('unrest', 2);
            }
        }

        this.updateControlledTerritory();
        return result;
    }

    // Process counter-attack from enemy to unit, returns damage dealt
    processCounterAttack(enemy, unit, unitStats) {
        const structureDef = this.getStructureDefenseAt(unit.q, unit.r);
        // Cavalry has 5 defense when attacking (strong charge, needs support when defending)
        const baseDefense = unit.type === UNIT_TYPE.CAVALRY ? 5 : unitStats.defense;
        const counterDamage = this.calculateDamage(enemy.attack, baseDefense + structureDef);
        unit.health -= counterDamage;
        return counterDamage;
    }

    // Move unit to a target hex (used after combat)
    moveUnitToHex(unit, targetHex) {
        const fromHex = this.getHex(unit.q, unit.r);
        fromHex.units = fromHex.units.filter(u => u.id !== unit.id);
        unit.q = targetHex.q;
        unit.r = targetHex.r;
        targetHex.units.push(unit);
    }

    // Remove enemy from game
    removeEnemy(enemy) {
        this.enemies = this.enemies.filter(e => e.id !== enemy.id);
    }

    // Installation Management
    canBuildInstallation(hex, type) {
        if (hex.dangerPoint) return false;

        // Allow upgrade if new type has higher tier than existing
        if (hex.installation) {
            if (INSTALLATION_TIER[type] <= INSTALLATION_TIER[hex.installation.type]) return false;
        }

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

        this.updateControlledTerritory();
        return true;
    }

    canTearDownInstallation(hex) {
        if (!hex.installation) return false;
        if (this.getUnitsAt(hex.q, hex.r).length === 0) return false;
        if (this.getEnemiesAt(hex.q, hex.r).length > 0) return false;
        return true;
    }

    tearDownInstallation(hex) {
        if (!this.canTearDownInstallation(hex)) return false;
        hex.installation = null;
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
        this.combatReport = [];
        this.refreshUnits();
        this.sortUnitsInHexes();
        this.processDangerPointOccupation();
        this.processEnemySpawns();
        this.processEnemyTurn();
        this.processProduction();
        this.processSettlementGrowth();
        this.processSettlementSpawning();
        this.processWildSpawns();
        this.updateSocietyParams();
        this.checkEraTransition();
        this.checkCollapse();

        this.selectedUnit = null;
        this.shuffledSocietyOptions = createShuffledOptions();
        this.selectLargestSettlement();

        this.turn++;
        return true;
    }

    // Heal units and reset movement points
    refreshUnits() {
        for (const unit of this.units) {
            const stats = UNIT_STATS[unit.type];
            const hex = this.getHex(unit.q, unit.r);
            const hasMovesLeft = unit.movesLeft > 0;
            const inStructure = hex && (hex.settlement || hex.installation);

            // Healing: 0% if no moves left, 20% if has moves left, 30% if in settlement/installation
            if (hasMovesLeft) {
                const healPercent = inStructure ? 0.3 : 0.2;
                const healAmount = Math.ceil(unit.maxHealth * healPercent);
                unit.health = Math.min(unit.maxHealth, unit.health + healAmount);
            }

            unit.movesLeft = stats.speed;
        }
    }

    // Sort units within each hex by type priority, then by HP
    sortUnitsInHexes() {
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
                    return b.health - a.health;
                });
            }
        }
    }

    // Select the largest settlement for the next turn
    selectLargestSettlement() {
        if (this.settlements.length === 0) return;

        const maxTier = Math.max(...this.settlements.map(s => s.tier));
        const largest = this.settlements.filter(s => s.tier === maxTier);
        const selected = Rando.choice(largest);
        this.selectedHex = this.getHex(selected.q, selected.r);
    }

    // Get enemy type for danger point attack based on strength
    getDangerPointAttackType(strength) {
        if (strength <= 2) return UNIT_TYPE.ENEMY_SMALL;
        if (strength <= 4) return UNIT_TYPE.ENEMY_MEDIUM;
        if (strength === 5) return UNIT_TYPE.ENEMY_LARGE;
        return UNIT_TYPE.ENEMY_MONSTER;
    }

    processDangerPointOccupation() {
        for (const [key, hex] of this.hexes) {
            if (!hex.dangerPoint) continue;

            const occupants = this.getUnitsAt(hex.q, hex.r);
            if (occupants.length === 0) continue;

            // Danger point attacks with strength based on its size
            const dpType = this.getDangerPointAttackType(hex.dangerPoint.strength);
            const dpStats = UNIT_STATS[dpType];
            const target = occupants[0];
            this.strikeUnit(dpStats.attack, target);

            this.combatReport.push({ q: hex.q, r: hex.r, unitKilled: target.health <= 0 });

            if (target.health <= 0) {
                this.removeUnit(target);
                this.adjustSociety('unrest', 3);
                continue;
            }

            // Roll a die (1-6), reduce strength if roll > size
            // This means size 6 danger points can only be removed with installations
            const roll = 1 + Math.floor(Math.random() * 6);
            if (roll > hex.dangerPoint.strength) {
                const prevStrength = hex.dangerPoint.strength;
                hex.dangerPoint.strength--;

                // Reward scales with strength before reduction
                // Destroying (1->0) gives special 10x bonus
                if (hex.dangerPoint.strength <= 0) {
                    hex.dangerPoint = null;
                    this.collectLoot(this.generateLoot(10));
                } else {
                    this.collectLoot(this.generateLoot(prevStrength));
                }
            }
        }
    }

    isValidSpawnHex(q, r) {
        const hex = this.getHex(q, r);
        if (!hex) return false;
        if (TERRAIN_MOVEMENT[hex.terrain] === Infinity) return false;
        if (this.enemies.some(e => e.q === q && e.r === r)) return false;
        if (this.settlements.some(s => s.q === q && s.r === r)) return false;
        return true;
    }

    processEnemySpawns() {
        for (const [key, hex] of this.hexes) {
            if (!hex.dangerPoint) continue;
            hex.dangerPoint.turnsUntilSpawn -= Rando.int(1, 6) / 3.5;
            if (hex.dangerPoint.turnsUntilSpawn > 0) continue;

            this.spawnFromDangerPoint(hex);
            hex.dangerPoint.turnsUntilSpawn = this.getSpawnRate(hex.dangerPoint.strength);
        }
    }

    // Attempt to spawn an enemy from a danger point
    spawnFromDangerPoint(hex) {
        const neighbors = hexNeighbors(hex.q, hex.r);
        const validSpawns = neighbors.filter(n => this.isValidSpawnHex(n.q, n.r));
        if (validSpawns.length === 0) return;

        const spawnHex = Rando.choice(validSpawns);
        const enemyType = this.randomEnemyType();
        const defenders = this.getUnitsAt(spawnHex.q, spawnHex.r);

        if (defenders.length === 0) {
            this.spawnEnemy(spawnHex.q, spawnHex.r, enemyType);
            return;
        }

        this.resolveSpawnCombat(spawnHex, enemyType, defenders[0]);
    }

    // Resolve combat when an enemy spawns onto a hex with a friendly unit
    resolveSpawnCombat(spawnHex, enemyType, unit) {
        const stats = UNIT_STATS[enemyType];
        this.strikeUnit(stats.attack, unit);

        // Counter-attack from unit to spawning enemy
        const unitStats = UNIT_STATS[unit.type];
        const counterDamage = this.calculateDamage(unitStats.attack, stats.defense);
        const attackerSurvives = counterDamage < stats.health;
        const unitKilled = unit.health <= 0;

        if (unitKilled) {
            this.removeUnit(unit);
            this.adjustSociety('unrest', 3);
        }

        // Enemy materializes only if it killed the unit and survived
        if (unitKilled && attackerSurvives) {
            const enemy = this.spawnEnemy(spawnHex.q, spawnHex.r, enemyType);
            enemy.health = stats.health - counterDamage;
        }

        this.combatReport.push({ q: spawnHex.q, r: spawnHex.r, unitKilled });
    }

    spawnEnemy(q, r, type) {
        const stats = UNIT_STATS[type];
        const enemy = {
            id: Date.now() + Math.random(),
            q, r, type,
            purpose: this.randomEnemyPurpose(),
            attack: stats.attack,
            defense: stats.defense,
            health: stats.health,
            maxHealth: stats.health
        };
        this.enemies.push(enemy);
        return enemy;
    }

    randomEnemyType() {
        return Rando.weighted(ENEMY_SPAWN_WEIGHTS);
    }

    randomEnemyPurpose() {
        const roll = Math.random();
        if (roll < 0.5) return 'random';
        if (roll < 0.8) return 'resource';
        return 'settlement';
    }

    processEnemyTurn() {
        for (const enemy of this.enemies) {
            // First, attack any adjacent targets
            if (this.tryEnemyAttack(enemy)) continue;

            // Movement: always move 1 space, direction based on purpose
            if (enemy.purpose === 'resource') {
                const target = this.findNearest(enemy.q, enemy.r, hex => hex.resource);
                this.moveEnemyToward(enemy, target);
            } else if (enemy.purpose === 'settlement') {
                const target = this.findNearestSettlement(enemy.q, enemy.r);
                this.moveEnemyToward(enemy, target);
            } else {
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
        const attackOrder = [UNIT_TYPE.HEAVY_INFANTRY, UNIT_TYPE.INFANTRY, UNIT_TYPE.CAVALRY, UNIT_TYPE.WORKER];
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
        this.combatReport.push({ q: hex.q, r: hex.r, unitKilled: false });
        hex.installation = null;
        this.createDangerPoint(hex, Rando.int(1, 6));
        this.removeEnemy(enemy);
        this.adjustSociety('unrest', 5);
    }

    // Get valid move destinations for an enemy
    getValidEnemyMoves(enemy) {
        return hexNeighbors(enemy.q, enemy.r).filter(n => this.isValidEnemyMove(n.q, n.r, enemy));
    }

    // Move enemy toward a target
    moveEnemyToward(enemy, target) {
        if (!target) {
            this.moveEnemyRandom(enemy);
            return;
        }

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

        // Only move if it gets us closer, otherwise move randomly
        if (bestMove && bestDist < hexDistance(enemy.q, enemy.r, target.q, target.r)) {
            enemy.q = bestMove.q;
            enemy.r = bestMove.r;
        } else {
            this.moveEnemyRandom(enemy);
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
            this.enemyAttackUnit(enemy, target);
        } else if (target.isSettlement) {
            this.enemyAttackSettlement(enemy, target);
        }
    }

    // Enemy attacks a unit
    enemyAttackUnit(enemy, target) {
        const unit = target.unit || this.units.find(u => u.q === target.q && u.r === target.r);
        if (!unit) return;

        this.strikeUnit(enemy.attack, unit);

        // Counter-attack from unit to enemy
        const unitStats = UNIT_STATS[unit.type];
        const counterDamage = this.calculateDamage(unitStats.attack, enemy.defense);
        enemy.health -= counterDamage;

        if (enemy.health <= 0) {
            this.combatReport.push({ q: enemy.q, r: enemy.r, type: 'enemyKilled' });
            this.removeEnemy(enemy);
        }

        const unitKilled = unit.health <= 0;
        this.combatReport.push({ q: target.q, r: target.r, unitKilled });

        if (unitKilled) {
            this.removeUnit(unit);
            this.adjustSociety('unrest', 3);
        }
    }

    // Enemy attacks a settlement
    enemyAttackSettlement(enemy, target) {
        const settlement = this.settlements.find(s => s.q === target.q && s.r === target.r);
        if (!settlement) return;

        this.combatReport.push({ q: target.q, r: target.r, unitKilled: false });
        this.adjustSociety('unrest', 5);

        // Small chance to damage undefended settlement
        const defenders = this.getUnitsAt(settlement.q, settlement.r);
        if (defenders.length === 0 && Math.random() < 0.3) {
            if (settlement.tier > SETTLEMENT_LEVEL.CAMP) {
                settlement.tier--;
            } else if (this.settlements.length > 1) {
                this.destroySettlement(settlement);
                this.adjustSociety('unrest', 10);
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

        this.redistributeGrowthOverflow();
    }

    // Overflow from capped settlements redistributes to nearest settlement with room to grow
    redistributeGrowthOverflow() {
        for (const settlement of this.settlements) {
            const overflow = this.calculateOverflow(settlement);
            if (overflow <= 0) continue;

            const halfThreshold = Math.floor(this.getGrowthThreshold(settlement.tier) / 2);
            settlement.growthPoints = halfThreshold;

            const recipient = this.findNearestGrowableSettlement(settlement);
            if (recipient) {
                recipient.growthPoints += overflow;
            }
        }
    }

    // Calculate how much growth overflows from a capped settlement (0 if not capped)
    calculateOverflow(settlement) {
        const maxLevel = this.getMaxTierAt(settlement.q, settlement.r);
        const atCap = settlement.tier >= maxLevel ||
                      settlement.tier >= this.maxSettlementLevel ||
                      SETTLEMENT_UPGRADE_LEVELS.includes(settlement.tier);
        if (!atCap) return 0;

        const halfThreshold = Math.floor(this.getGrowthThreshold(settlement.tier) / 2);
        if (settlement.growthPoints <= halfThreshold) return 0;

        return settlement.growthPoints - halfThreshold;
    }

    // Find nearest settlement that can still grow
    findNearestGrowableSettlement(source) {
        const coords = this.findNearest(source.q, source.r, hex => {
            if (!hex.settlement) return false;
            if (hex.settlement.id === source.id) return false;
            const threshold = this.getGrowthThreshold(hex.settlement.tier);
            return this.canAutoAdvance(hex.settlement) || hex.settlement.growthPoints < threshold;
        });
        if (!coords) return null;
        return this.getHex(coords.q, coords.r).settlement;
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
        if (!this.accessibleKeys.has(hexKey(hex.q, hex.r))) return 0;

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
        const weighted = candidates.map(c => ({ item: c.hex, weight: c.score }));
        const chosen = Rando.weighted(weighted);
        if (!chosen) return;

        this.createSettlement(chosen.q, chosen.r, SETTLEMENT_LEVEL.CAMP);

        // Settlement spawning effects:
        // - Halve unrest (pressure released)
        this.society.unrest /= 2;
        // - Increase overextension by 25% (more territory to manage)
        this.society.overextension *= 1.25;
        this.society.overextension = Math.min(100, this.society.overextension);
    }

    processWildSpawns() {
        // Sum current danger point strengths
        let totalStrength = 0;
        for (const [key, hex] of this.hexes) {
            if (hex.dangerPoint) totalStrength += hex.dangerPoint.strength;
        }

        const baseChance = (this.difficulty.dangerSum - totalStrength) * 0.001 * (this.society.decadence / 30) * this.difficulty.wildSpawnMultiplier;
        if (baseChance <= 0) return;

        // Random enemy unit spawn (10× base chance) with new danger point
        if (Math.random() < baseChance * 10) {
            const hex = this.pickWeightedSpawnHex();
            if (hex) {
                this.spawnEnemy(hex.q, hex.r, this.randomEnemyType());
                this.createDangerPoint(hex, Rando.int(1, 5));
                this.combatReport.push({ q: hex.q, r: hex.r, type: 'monsterSpawn' });
            }
        }

        // Monster spawn (base chance)
        if (Math.random() < baseChance) {
            const hex = this.pickWeightedSpawnHex();
            if (hex) {
                this.spawnEnemy(hex.q, hex.r, UNIT_TYPE.ENEMY_MONSTER);
                this.combatReport.push({ q: hex.q, r: hex.r, type: 'monsterSpawn' });
            }
        }
    }

    pickWeightedSpawnHex() {
        const candidates = [];
        for (const [key, hex] of this.hexes) {
            const score = this.calculateSpawnScore(hex);
            if (score > 0) candidates.push({ item: hex, weight: score });
        }
        return Rando.weighted(candidates);
    }

    updateSocietyParams() {
        this.updateCorruption();
        this.updateUnrest();
        this.updateDecadence();
        this.updateOverextension();
        this.processRevolts();
    }

    updateCorruption() {
        const goldIncome = this.settlements.reduce((sum, s) => sum + SETTLEMENT_PRODUCTION[s.tier].gold, 0);
        this.adjustSociety('corruption', goldIncome * 0.01 + this.settlements.length * 0.1);
    }

    updateUnrest() {
        // Range: -1 to +2 base (average +0.5) plus small population factor
        // Scales with era at ratio 1:2:4 (Barbarian:Kingdom:Empire)
        const population = this.getPopulation();
        const multiplier = this.era === ERA.EMPIRE ? 4 : this.era === ERA.KINGDOM ? 2 : 1;
        const unrestChange = ((Math.random() * 3 - 1) + population * 0.02) * multiplier;
        this.adjustSociety('unrest', unrestChange);
    }

    updateDecadence() {
        // Scales with era at ratio 1:2:4 (Barbarian:Kingdom:Empire)
        const multiplier = this.era === ERA.EMPIRE ? 4 : this.era === ERA.KINGDOM ? 2 : 1;
        this.adjustSociety('decadence', 0.5 * multiplier);
    }

    updateOverextension() {
        // +0.025 per influenced hex (round up), no decay
        const influencedHexCount = this.getInfluencedHexCount();
        this.adjustSociety('overextension', Math.ceil(influencedHexCount * 0.025));
    }

    processRevolts() {
        if (this.society.unrest <= 75) return;

        // Copy array to avoid mutation during iteration
        for (const settlement of [...this.settlements]) {
            if (Math.random() < 0.05 && this.settlements.length > 1) {
                this.destroySettlement(settlement);
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
        const collapse = new Collapse(this);
        if (collapse.shouldCollapse()) {
            collapse.execute();
        }
    }

    // Selection helpers
    selectHex(q, r) {
        this.selectedHex = this.getHex(q, r) || null;
        this.selectedUnit = null;
    }

    selectUnit(unit) {
        if (unit && unit.movesLeft > 0) {
            this.selectedUnit = unit;
        }
    }

    clearSelection() {
        this.selectedHex = null;
        this.selectedUnit = null;
    }
}
