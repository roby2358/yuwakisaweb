// victory.js — score tracking and final breakdown

export class Victory {
    constructor() {
        this.enemiesDefeated = 0;
        this.guardiansDefeated = 0;
        this.garrisonsCompleted = 0;
        this.garrisonKills = 0;
        this.distanceTraveled = 0;
        this.damageDealt = 0;
        this.damageTaken = 0;
        this.nearDeathMoments = 0;
        this.hexesRestored = 0;
        this.settlementsRestored = 0;
        this.ruinsExplored = 0;
        this.goldCollected = 0;
        this.breachesSealed = 0;
    }

    score() {
        let total = 0;
        for (const [k, w] of Object.entries(Victory.WEIGHTS)) {
            total += (this[k] || 0) * w;
        }
        return Math.round(total);
    }

    breakdown() {
        return Object.entries(Victory.LABELS).map(([k, label]) => ({
            key: k,
            label,
            value: this[k] || 0,
            points: Math.round((this[k] || 0) * (Victory.WEIGHTS[k] || 0))
        }));
    }

    toJSON() { return { ...this }; }

    static fromJSON(data) {
        const v = new Victory();
        if (data) Object.assign(v, data);
        return v;
    }
}

Victory.WEIGHTS = {
    enemiesDefeated: 0.13,
    guardiansDefeated: 6,
    garrisonsCompleted: 25,
    garrisonKills: 1,
    distanceTraveled: 0.03,
    damageDealt: 0.004,
    damageTaken: -0.013,
    nearDeathMoments: 100,
    hexesRestored: 0.075,
    settlementsRestored: 3,
    ruinsExplored: 6.5,
    goldCollected: 0.017,
    breachesSealed: 14,
};

Victory.LABELS = {
    enemiesDefeated: 'Enemies Defeated',
    guardiansDefeated: 'Guardians Slain',
    garrisonsCompleted: 'Garrisons Built',
    garrisonKills: 'Garrison Kills',
    distanceTraveled: 'Hexes Traveled',
    damageDealt: 'Damage Dealt',
    damageTaken: 'Damage Taken',
    nearDeathMoments: 'Near-Death Moments',
    hexesRestored: 'Hexes Restored',
    settlementsRestored: 'Settlements Restored',
    ruinsExplored: 'Ruins Explored',
    goldCollected: 'Gold Collected',
    breachesSealed: 'Breaches Sealed',
};
