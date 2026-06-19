// unit.js — a single combat unit. Concrete data object built from an ARCHETYPES entry
// (config.js). The four cannon types, the knight, and the foundry are all the same struct
// with different parameters; the only behavioural forks are capability checks (isKnight,
// isFoundry, canFire) keyed on `kind`, kept here so the rest of the code asks capabilities
// rather than re-testing the discriminator. (DYNAMICS.md §6, §12.)
// Classic script: depends on config.js (ARCHETYPES, KIND, TERRAIN, HILL_RANGE_BONUS).

class Unit {
    constructor(props) {
        Object.assign(this, props);
    }

    // Build a fresh unit of `archetypeKey` for `owner` at (q, r) with a unique id.
    static create(archetypeKey, owner, q, r, id) {
        const a = ARCHETYPES[archetypeKey];
        return new Unit({
            id, owner, q, r,
            archetype: archetypeKey,
            kind: a.kind,
            label: a.label,
            name: a.name,
            power: a.power,
            range: a.range,
            mp: a.mp,
            mpLeft: a.mp,
            hp: a.hp,
            hpMax: a.hp,
            damage: a.damage,
            shieldType: a.shieldType,
            shield: a.shield,
            shieldLeft: a.shield,
            upkeep: a.upkeep,
            cost: a.cost,
            ignites: a.ignites,
            siege: a.siege,
            hasFired: false,
            disabled: false,
            fortified: false,   // an Engineer that dug in as an immobile Field Shield
            capturingBy: null   // owner currently sieging this unit, or null
        });
    }

    isFoundry() { return this.kind === KIND.FOUNDRY; }
    isKnight() { return this.kind === KIND.KNIGHT; }
    isEngineer() { return this.kind === KIND.ENGINEER; }
    isPlatform() { return this.kind === KIND.PLATFORM; }
    alive() { return this.hp > 0; }

    // A weapon that can shoot at all (the Foundry cannot).
    canFire() { return this.range > 0 && this.power > 0; }

    // Can perform the disable/capture siege action (Engineers and Knights).
    canSiege() { return this.siege; }

    // Can board a target whose shields are still up. Only the Knight's phase shield carries it
    // through live fire; the unarmored Engineer must wait until the shield is beaten down first.
    breachesShields() { return this.isKnight(); }

    // Whether standing on/near a resource hex claims it for this faction. Knights are aristocrats
    // — they won't be bothered holding ground, so they project no control over gold or quarries.
    holdsGround() { return !this.isKnight(); }

    // Firing range, including the high-ground bonus when standing on hills.
    effectiveRange(homeTerrain) {
        return this.range + (homeTerrain === TERRAIN.HILLS ? HILL_RANGE_BONUS : 0);
    }
}
