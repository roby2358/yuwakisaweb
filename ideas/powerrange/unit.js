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
            indirect: a.indirect,
            hasFired: false,
            disabled: false,
            capturingBy: null   // owner currently sieging this unit, or null
        });
    }

    isFoundry() { return this.kind === KIND.FOUNDRY; }
    isKnight() { return this.kind === KIND.KNIGHT; }
    isPlatform() { return this.kind === KIND.PLATFORM; }
    alive() { return this.hp > 0; }

    // A weapon that can shoot at all (the Foundry cannot).
    canFire() { return this.range > 0 && this.power > 0; }

    // Can perform the disable/capture siege action (the Knight).
    canSiege() { return this.siege; }

    // Lobs over terrain — fire ignores line of sight (the Bombard's exclusive exception).
    firesIndirect() { return this.indirect; }

    // Whether this unit's firepower projects resource control and supply. Only precision
    // direct-fire platforms (Railgun, Laser, Plasma) hold ground. Knights are aloof aristocrats;
    // Bombards (indirect) and Incendiaries (area denial) are too blunt to garrison territory —
    // they can shell a hex but not own it or carry a supply line through it.
    holdsGround() { return this.isPlatform() && !this.indirect && !this.ignites; }

    // Firing range, including the high-ground bonus when standing on hills.
    effectiveRange(homeTerrain) {
        return this.range + (homeTerrain === TERRAIN.HILLS ? HILL_RANGE_BONUS : 0);
    }
}
