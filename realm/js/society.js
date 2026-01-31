// Society Management Options
// Each option has:
// - name: Display name
// - description: Flavor text
// - costs: [gold, materials] - resources consumed
// - effects: [corruption, unrest, decadence, overextension] - changes to society params

import { Rando } from './rando.js';

// Category 1: Trade one condition for another (no resource cost)
export const TRADE_OPTIONS = [
    {
        name: "Royal Guards Crack Down",
        description: "The guards root out corrupt officials, but their methods breed resentment.",
        costs: [0, 0],
        effects: [-20, 30, 0, 0]
    },
    {
        name: "Host a Bacchanalia",
        description: "A festival of indulgence calms the masses but encourages excess.",
        costs: [0, 0],
        effects: [0, -20, 30, 0]
    },
    {
        name: "Bread and Circuses",
        description: "Entertainment distracts from grievances but promotes decadence.",
        costs: [0, 0],
        effects: [0, -15, 20, 0]
    },
    {
        name: "Military Parade",
        description: "A show of force reassures citizens but stretches supply lines.",
        costs: [0, 0],
        effects: [0, -15, 0, 20]
    },
    {
        name: "Public Executions",
        description: "Harsh justice deters corruption but terrifies the populace.",
        costs: [0, 0],
        effects: [-25, 35, 0, 0]
    },
    {
        name: "Declare Martial Law",
        description: "Military rule restores order but overextends your forces.",
        costs: [0, 0],
        effects: [0, -30, 0, 25]
    },
    {
        name: "Courtly Reforms",
        description: "Curtailing noble privileges reduces decadence but invites bribery.",
        costs: [0, 0],
        effects: [20, 0, -15, 0]
    },
    {
        name: "Austerity Measures",
        description: "Cutting excess spending reduces decadence but angers citizens.",
        costs: [0, 0],
        effects: [0, 25, -20, 0]
    },
    {
        name: "Consolidate Borders",
        description: "Pulling back from distant lands reduces overextension but causes unrest.",
        costs: [0, 0],
        effects: [0, 15, 0, -25]
    },
    {
        name: "Provincial Autonomy",
        description: "Delegating power reduces strain but enables local corruption.",
        costs: [0, 0],
        effects: [25, 0, 0, -20]
    },
    {
        name: "Purge the Bureaucracy",
        description: "Dismissing corrupt officials strains administration.",
        costs: [0, 0],
        effects: [-25, 0, 0, 20]
    },
    {
        name: "Royal Wedding",
        description: "A grand celebration lifts spirits but encourages excess.",
        costs: [0, 0],
        effects: [0, -15, 15, 0]
    },
    {
        name: "Sumptuary Laws",
        description: "Restricting luxury goods reduces decadence but frustrates merchants.",
        costs: [0, 0],
        effects: [0, 15, -20, 0]
    },
    {
        name: "Tax Amnesty",
        description: "Forgiving debts calms the people but encourages future evasion.",
        costs: [0, 0],
        effects: [25, -20, 0, 0]
    },
    {
        name: "Forced Labor Camps",
        description: "Conscript labor eases territorial strain but breeds resentment.",
        costs: [0, 0],
        effects: [0, 30, 0, -15]
    },
    {
        name: "Noble Privileges",
        description: "Granting favors to lords calms unrest but invites corruption.",
        costs: [0, 0],
        effects: [20, -15, 0, 0]
    },
    {
        name: "Military Conscription",
        description: "Drafting soldiers reduces overextension but angers families.",
        costs: [0, 0],
        effects: [0, 30, 0, -20]
    },
    {
        name: "Religious Festival",
        description: "Sacred celebrations ease tensions but encourage indulgence.",
        costs: [0, 0],
        effects: [0, -15, 15, 0]
    },
    {
        name: "Redistribute Wealth",
        description: "Taking from the rich pleases the poor but creates new corruption.",
        costs: [0, 0],
        effects: [0, -20, 0, 0]  // Just reduces unrest, balanced by being free
    },
    {
        name: "Expand Bureaucracy",
        description: "More officials manage territory better but take their cut.",
        costs: [0, 0],
        effects: [20, 0, 0, -15]
    }
];

// Category 2: Pay gold to improve (with side effects)
export const PAY_OPTIONS = [
    {
        name: "Hire Civil Administrators",
        description: "Trained officials manage territories, but some will skim funds.",
        costs: [5, 0],
        effects: [5, 0, 0, -10]
    },
    {
        name: "Public Support Campaign",
        description: "Propaganda calms the masses but requires extended presence.",
        costs: [10, 0],
        effects: [0, -20, 0, 10]
    },
    {
        name: "Bribe Officials",
        description: "Payoffs smooth administration but set a bad example.",
        costs: [8, 0],
        effects: [0, 0, 10, -15]
    },
    {
        name: "Hire Mercenaries",
        description: "Foreign soldiers maintain order but extend commitments.",
        costs: [12, 0],
        effects: [0, -15, 0, 10]
    },
    {
        name: "Sponsor Artists",
        description: "Patronage redirects excess into culture, though some funds vanish.",
        costs: [6, 0],
        effects: [5, 0, -10, 0]
    },
    {
        name: "Fund Schools",
        description: "Education reduces discontent but creates ambitious officials.",
        costs: [8, 0],
        effects: [5, -15, 0, 0]
    },
    {
        name: "Road Maintenance",
        description: "Better roads ease travel but disrupt local communities.",
        costs: [5, 0],
        effects: [0, 5, 0, -10]
    },
    {
        name: "Harbor Improvements",
        description: "Port upgrades ease logistics, though contracts attract corruption.",
        costs: [10, 0],
        effects: [5, 0, 0, -15]
    },
    {
        name: "Establish Granaries",
        description: "Food reserves calm unrest but require territorial commitment.",
        costs: [7, 0],
        effects: [0, -15, 0, 5]
    },
    {
        name: "Train Local Militia",
        description: "Armed citizens reduce unrest but require coordination.",
        costs: [8, 0],
        effects: [0, -10, 0, 10]
    },
    {
        name: "Diplomatic Missions",
        description: "Envoys reduce border tensions but indulge in luxuries.",
        costs: [12, 0],
        effects: [0, 0, 10, -15]
    },
    {
        name: "Reform Tax Collection",
        description: "Efficient collection reduces corruption but angers taxpayers.",
        costs: [6, 0],
        effects: [-15, 10, 0, 0]
    },
    {
        name: "Establish Courts",
        description: "Justice reduces corruption but creates resentment among criminals.",
        costs: [10, 0],
        effects: [-20, 10, 0, 0]
    },
    {
        name: "Subsidize Merchants",
        description: "Trade support reduces corruption but encourages luxury goods.",
        costs: [8, 0],
        effects: [-10, 0, 10, 0]
    },
    {
        name: "Public Health Initiative",
        description: "Medicine calms unrest but officials enjoy the benefits.",
        costs: [7, 0],
        effects: [0, -15, 5, 0]
    },
    {
        name: "Border Fortifications",
        description: "Defenses reduce overextension but require garrison discontent.",
        costs: [15, 0],
        effects: [0, 5, 0, -20]
    },
    {
        name: "Secret Police",
        description: "Spies suppress unrest but become corrupt themselves.",
        costs: [10, 0],
        effects: [15, -20, 0, 0]
    },
    {
        name: "Appease Nobility",
        description: "Gifts to lords reduce their excess but encourage graft.",
        costs: [12, 0],
        effects: [10, 0, -15, 0]
    },
    {
        name: "Census and Survey",
        description: "Better records ease administration but create new officials.",
        costs: [5, 0],
        effects: [10, 0, 0, -10]
    },
    {
        name: "Emergency Relief",
        description: "Aid calms crises but requires extended presence.",
        costs: [8, 0],
        effects: [0, -20, 0, 5]
    }
];

// Category 3: Public works (pay gold + materials)
export const PUBLIC_WORKS_OPTIONS = [
    {
        name: "Build a Temple",
        description: "Sacred spaces reduce decadence but displace residents.",
        costs: [2, 10],
        effects: [0, 10, -20, 0]
    },
    {
        name: "Build a Courthouse",
        description: "Centers of justice reduce corruption but create resentment.",
        costs: [4, 20],
        effects: [-25, 10, 0, 0]
    },
    {
        name: "Build an Amphitheater",
        description: "Entertainment reduces unrest but encourages excess.",
        costs: [5, 15],
        effects: [0, -20, 10, 0]
    },
    {
        name: "Build Aqueducts",
        description: "Clean water calms citizens but extends infrastructure.",
        costs: [6, 25],
        effects: [0, -15, 0, 5]
    },
    {
        name: "Build City Walls",
        description: "Fortifications reduce overextension but alarm neighbors.",
        costs: [8, 30],
        effects: [0, 5, 0, -20]
    },
    {
        name: "Build a Palace Wing",
        description: "Royal grandeur reduces decadence through focus, but invites graft.",
        costs: [10, 35],
        effects: [15, 0, -25, 0]
    },
    {
        name: "Build Public Baths",
        description: "Bathing facilities calm citizens but encourage luxury.",
        costs: [4, 15],
        effects: [0, -15, 10, 0]
    },
    {
        name: "Build a Monument",
        description: "Grand structures channel excess but officials take their cut.",
        costs: [3, 20],
        effects: [5, 0, -15, 0]
    },
    {
        name: "Build a Granary",
        description: "Food storage calms unrest but requires more territory.",
        costs: [3, 12],
        effects: [0, -15, 0, 5]
    },
    {
        name: "Build Barracks",
        description: "Military housing eases logistics but alarms citizens.",
        costs: [5, 18],
        effects: [0, 10, 0, -15]
    },
    {
        name: "Build a Marketplace",
        description: "Trade centers reduce corruption but extend commitments.",
        costs: [4, 15],
        effects: [-10, 0, 0, 10]
    },
    {
        name: "Build a Library",
        description: "Knowledge reduces decadence but creates ambitious scholars.",
        costs: [6, 20],
        effects: [5, 0, -15, 0]
    },
    {
        name: "Build an Arena",
        description: "Gladiatorial games distract citizens but encourage excess.",
        costs: [7, 25],
        effects: [0, -25, 15, 0]
    },
    {
        name: "Build a Shrine",
        description: "Small temples reduce decadence but cause minor disputes.",
        costs: [2, 8],
        effects: [0, 5, -10, 0]
    },
    {
        name: "Build a Watchtower",
        description: "Observation posts ease patrols but worry locals.",
        costs: [3, 10],
        effects: [0, 5, 0, -10]
    },
    {
        name: "Build Gardens",
        description: "Beauty reduces decadence but officials claim credit.",
        costs: [4, 12],
        effects: [5, 0, -15, 0]
    },
    {
        name: "Build a Treasury",
        description: "Secure vaults reduce corruption but enable decadence.",
        costs: [8, 25],
        effects: [-20, 0, 10, 0]
    },
    {
        name: "Build a Hospital",
        description: "Healing reduces unrest but creates entitled officials.",
        costs: [5, 18],
        effects: [5, -20, 0, 0]
    },
    {
        name: "Build an Academy",
        description: "Education reduces corruption but spreads decadent ideas.",
        costs: [7, 22],
        effects: [-15, 0, 10, 0]
    },
    {
        name: "Build a Harbor",
        description: "Port facilities ease logistics but invite corruption.",
        costs: [6, 20],
        effects: [10, 0, 0, -15]
    }
];

// Category 4: Cash in - gain resources by accepting society problems (requires stat > 20)
export const CASHIN_OPTIONS = [
    {
        name: "Accept Gift from Wealthy Merchant",
        description: "A merchant offers gold in exchange for looking the other way.",
        costs: [-5, 0],
        effects: [20, 0, 0, 0],
        requires: 'corruption'
    },
    {
        name: "Sell Government Positions",
        description: "Offices go to the highest bidder, filling your coffers.",
        costs: [-10, 0],
        effects: [35, 0, 0, 0],
        requires: 'corruption'
    },
    {
        name: "Auction Tax Collection Rights",
        description: "Private collectors pay handsomely for the privilege.",
        costs: [-20, 0],
        effects: [50, 0, 0, 0],
        requires: 'corruption'
    },
    {
        name: "Confiscate Rebel Properties",
        description: "Seize the holdings of those who oppose you.",
        costs: [-10, 0],
        effects: [0, 30, 0, 0],
        requires: 'unrest'
    },
    {
        name: "Enforce Emergency Taxation",
        description: "Desperate times call for desperate measures.",
        costs: [-20, 0],
        effects: [0, 45, 0, 0],
        requires: 'unrest'
    },
    {
        name: "Raid Temple Treasuries",
        description: "The gods will understand... hopefully.",
        costs: [-5, 0],
        effects: [0, 25, 0, 0],
        requires: 'unrest'
    },
    {
        name: "Host Lavish Tournament",
        description: "Nobles pay dearly for the honor of competing.",
        costs: [-10, 0],
        effects: [0, 0, 30, 0],
        requires: 'decadence'
    },
    {
        name: "Sell Royal Favors",
        description: "Titles and privileges for those who can afford them.",
        costs: [-20, 0],
        effects: [0, 0, 45, 0],
        requires: 'decadence'
    },
    {
        name: "License Vice Dens",
        description: "Gambling houses and pleasure palaces pay their dues.",
        costs: [-5, 0],
        effects: [0, 0, 25, 0],
        requires: 'decadence'
    },
    {
        name: "Demand Tribute from Frontiers",
        description: "Distant provinces must prove their loyalty with gold.",
        costs: [-10, 0],
        effects: [0, 0, 0, 30],
        requires: 'overextension'
    },
    {
        name: "Exploit Border Resources",
        description: "Strip the frontier lands of their wealth.",
        costs: [-20, 0],
        effects: [0, 0, 0, 45],
        requires: 'overextension'
    },
    {
        name: "Accept Tribal Tribute",
        description: "A border tribe offers materials for protection.",
        costs: [0, -10],
        effects: [0, 0, 0, 25],
        requires: 'overextension'
    },
    {
        name: "Hire Corrupt Contractors",
        description: "They cut corners, but deliver materials cheap.",
        costs: [0, -20],
        effects: [30, 0, 0, 0],
        requires: 'corruption'
    },
    {
        name: "Accept Embezzled Supplies",
        description: "Don't ask where these building materials came from.",
        costs: [0, -30],
        effects: [45, 0, 0, 0],
        requires: 'corruption'
    },
    {
        name: "Conscript Labor Gangs",
        description: "Force the discontented to build for the realm.",
        costs: [0, -20],
        effects: [0, 35, 0, 0],
        requires: 'unrest'
    },
    {
        name: "Demolish Sacred Groves",
        description: "Ancient forests become building materials.",
        costs: [0, -30],
        effects: [0, 40, 0, 0],
        requires: 'unrest'
    },
    {
        name: "Repurpose Festival Decorations",
        description: "Last year's excess becomes this year's materials.",
        costs: [0, -10],
        effects: [0, 0, 20, 0],
        requires: 'decadence'
    },
    {
        name: "Salvage Abandoned Pleasure Gardens",
        description: "Tear down monuments to excess for practical use.",
        costs: [0, -20],
        effects: [0, 0, 30, 0],
        requires: 'decadence'
    },
    {
        name: "Strip Frontier Fortifications",
        description: "Pull back defenses for their valuable materials.",
        costs: [0, -30],
        effects: [0, 0, 0, 40],
        requires: 'overextension'
    },
    {
        name: "Absorb Migrant Craftsmen",
        description: "Refugees bring skills and supplies, but strain borders.",
        costs: [0, -10],
        effects: [0, 0, 0, 25],
        requires: 'overextension'
    }
];

// Get realm state description based on society values
export function getRealmStateDescription(society, era) {
    const { corruption, unrest, decadence, overextension } = society;

    // Find the highest concern
    const concerns = [
        { name: 'corruption', value: corruption },
        { name: 'unrest', value: unrest },
        { name: 'decadence', value: decadence },
        { name: 'overextension', value: overextension }
    ].sort((a, b) => b.value - a.value);

    const highest = concerns[0];
    const second = concerns[1];

    // Count critical parameters
    const critical = concerns.filter(c => c.value >= 75).length;
    const high = concerns.filter(c => c.value >= 50).length;

    if (critical >= 2) {
        return `The realm teeters on the brink of collapse. ${getParamPhrase(highest.name)} and ${getParamPhrase(second.name)} threaten to tear the kingdom apart. Immediate action is required.`;
    } else if (critical === 1) {
        return `Dark clouds gather over the realm. ${capitalizeFirst(getParamPhrase(highest.name))} has reached dangerous levels. Without intervention, collapse may be inevitable.`;
    } else if (high >= 2) {
        return `The realm faces significant challenges. ${capitalizeFirst(getParamPhrase(highest.name))} and ${getParamPhrase(second.name)} trouble the council. Wise governance is needed.`;
    } else if (high === 1) {
        return `Though mostly stable, the realm struggles with ${getParamPhrase(highest.name)}. The situation bears watching.`;
    } else if (highest.value >= 25) {
        return `The realm prospers under ${era} rule. Minor concerns about ${getParamPhrase(highest.name)} exist, but nothing threatening.`;
    } else {
        return `The realm flourishes. Citizens are content, the treasury secure, and the borders well-managed. A golden age beckons.`;
    }
}

function getParamPhrase(param) {
    const phrases = {
        corruption: 'corruption among officials',
        unrest: 'unrest among the populace',
        decadence: 'decadence in the courts',
        overextension: 'overextension of the realm'
    };
    return phrases[param];
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Get current impacts description
export function getCurrentImpacts(society) {
    const impacts = [];

    if (society.corruption > 0) {
        impacts.push({
            param: 'Corruption',
            value: Math.round(society.corruption),
            effect: `Gold yield reduced by ${Math.round(society.corruption / 4)}%`
        });
    }

    if (society.unrest > 0) {
        let effect = 'Slightly elevated tensions';
        if (society.unrest > 75) {
            effect = 'Settlements may revolt! (5% chance per settlement)';
        } else if (society.unrest > 50) {
            effect = 'Growing discontent threatens stability';
        } else if (society.unrest > 25) {
            effect = 'Citizens grumble but remain loyal';
        }
        impacts.push({
            param: 'Unrest',
            value: Math.round(society.unrest),
            effect
        });
    }

    if (society.decadence > 0) {
        impacts.push({
            param: 'Decadence',
            value: Math.round(society.decadence),
            effect: `All production reduced by ${Math.round(society.decadence / 2)}%`
        });
    }

    if (society.overextension > 0) {
        impacts.push({
            param: 'Overextension',
            value: Math.round(society.overextension),
            effect: 'Territories strain administrative capacity'
        });
    }

    return impacts;
}

// Create a shuffled list of all options (called at turn start)
export function createShuffledOptions() {
    const all = [
        ...TRADE_OPTIONS.map(o => ({ ...o, category: 'trade' })),
        ...PAY_OPTIONS.map(o => ({ ...o, category: 'pay' })),
        ...PUBLIC_WORKS_OPTIONS.map(o => ({ ...o, category: 'works' })),
        ...CASHIN_OPTIONS.map(o => ({ ...o, category: 'cashin' }))
    ];
    return Rando.shuffle(all);
}

// Get available options from pre-shuffled list (first 3 valid ones)
export function getAvailableOptions(resources, society, shuffledOptions) {
    const available = [];

    // Helper to check affordability (negative costs mean gains, always affordable)
    const canAfford = (costs) => {
        return resources.gold >= Math.max(0, costs[0]) && resources.materials >= Math.max(0, costs[1]);
    };

    // Helper to check if option is useful (at least one negative effect applies)
    const isUseful = (effects) => {
        const [corr, unr, dec, over] = effects;
        return (corr < 0 && society.corruption > 0) ||
               (unr < 0 && society.unrest > 0) ||
               (dec < 0 && society.decadence > 0) ||
               (over < 0 && society.overextension > 0);
    };

    // Helper to check if cashin option requirements are met (stat must be > 20)
    const canCashIn = (option) => {
        if (!option.requires) return true;
        return society[option.requires] > 20;
    };

    // Pick first 3 valid options from the shuffled list
    for (const option of shuffledOptions) {
        if (!canAfford(option.costs)) continue;

        // Cashin options have different validity check
        if (option.category === 'cashin') {
            if (canCashIn(option)) {
                available.push(option);
            }
        } else if (isUseful(option.effects)) {
            available.push(option);
        }

        if (available.length >= 3) break;
    }

    return available;
}

// Format effect for display
export function formatEffect(effects) {
    const labels = ['Corruption', 'Unrest', 'Decadence', 'Overextension'];
    const parts = [];

    for (let i = 0; i < 4; i++) {
        if (effects[i] !== 0) {
            const sign = effects[i] > 0 ? '+' : '';
            parts.push(`${sign}${effects[i]}% ${labels[i]}`);
        }
    }

    return parts.join(', ');
}

// Format cost for display (negative costs are gains)
export function formatCost(costs) {
    const parts = [];
    if (costs[0] > 0) parts.push(`-${costs[0]} gold`);
    else if (costs[0] < 0) parts.push(`+${-costs[0]} gold`);
    if (costs[1] > 0) parts.push(`-${costs[1]} materials`);
    else if (costs[1] < 0) parts.push(`+${-costs[1]} materials`);
    return parts.length > 0 ? parts.join(', ') : 'Free';
}
