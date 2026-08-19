// Caravans & Conquest domain types layered on the generic Piece foundation.
const GameDomain = (function () {
    const { RESOURCE } = GameArtifacts;
    const RESOURCE_NAMES = Object.values(RESOURCE);

    class ResourceStock {
        constructor(amounts) {
            for (const resource of RESOURCE_NAMES) this[resource] = amounts[resource];
        }

        canAfford(cost) {
            return Object.entries(cost).every(([resource, amount]) => this[resource] >= amount);
        }

        amount(resource) {
            return this[resource];
        }

        spend(cost) {
            if (!this.canAfford(cost)) return false;
            for (const [resource, amount] of Object.entries(cost)) this[resource] -= amount;
            return true;
        }

        gain(reward) {
            for (const [resource, amount] of Object.entries(reward)) this[resource] += amount;
        }
    }

    class Caravan extends Piece {
        constructor(q, r, cargo) {
            super(q, r, null, 'C');
            this.cargo = cargo;
        }
    }

    class Market extends Piece {
        constructor(q, r, isCrownMarket) {
            super(q, r, null, isCrownMarket ? '★' : 'M');
            this.isCrownMarket = isCrownMarket;
        }
    }

    class Raider extends Piece {
        constructor(id, q, r) {
            super(q, r, null, 'R');
            this.id = id;
        }
    }

    return { ResourceStock, Caravan, Market, Raider };
})();
