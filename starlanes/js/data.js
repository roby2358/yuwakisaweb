// STARLANE — static content tables. Everything here is a template/parameter set.
'use strict';

var GOODS = {
  food:  { name: 'Rations',     base: 20  },
  ore:   { name: 'Ore',         base: 35  },
  med:   { name: 'Medicine',    base: 80  },
  mach:  { name: 'Machinery',   base: 120 },
  elec:  { name: 'Electronics', base: 170 },
  lux:   { name: 'Luxuries',    base: 240 },
  spice: { name: 'Void Spice',  base: 320, illegal: true }
};
var GOOD_IDS = Object.keys(GOODS);

// Economy roles: price multiplier (<1 = producer, >1 = consumer) and stock capacity.
var ECONOMIES = {
  agri: {
    name: 'Agricultural',
    mods: { food: [0.5, 150], lux: [0.75, 60], mach: [1.5, 60], elec: [1.4, 50], med: [1.25, 60] }
  },
  mining: {
    name: 'Mining',
    mods: { ore: [0.5, 150], food: [1.5, 70], med: [1.4, 60], mach: [1.35, 60] }
  },
  industrial: {
    name: 'Industrial',
    mods: { mach: [0.6, 110], ore: [1.5, 80], food: [1.3, 70], elec: [1.3, 60] }
  },
  tech: {
    name: 'High-Tech',
    mods: { elec: [0.6, 90], med: [0.6, 90], food: [1.35, 70], lux: [1.3, 60], ore: [1.2, 50] }
  }
};
var DEFAULT_MOD = [1.0, 45]; // goods a system neither produces nor consumes heavily
var TRADE_IMPACT = 0.25;     // how hard one full stock-cap of trading moves the price

var FACTIONS = {
  guild:     { name: 'Merchant Guild',   color: '#5aa7ff', security: 0.9 },
  colonies:  { name: 'Free Colonies',    color: '#7ee081', security: 0.5 },
  syndicate: { name: 'Crimson Syndicate', color: '#ff6b6b', security: 0.2 }
};

var PIRATE_BANDS = ['Rustknife gang', 'Black Halo raiders', 'the Vulture Pack',
  'Kessler\'s Own', 'the Red Meridian', 'Howler corsairs'];

var REP_TIERS = [
  { min: -100, name: 'Hostile'   },
  { min: -50,  name: 'Unfriendly'},
  { min: -10,  name: 'Neutral'   },
  { min: 20,   name: 'Friendly'  },
  { min: 50,   name: 'Trusted'   },
  { min: 80,   name: 'Revered'   }
];

// Market events — all one template: price multipliers, danger delta, duration range.
var EVENTS = {
  famine:   { name: 'Famine',          mult: { food: 2.2 },            danger: 0,    dur: [5, 10], news: 'crops failed; rations are gold' },
  plague:   { name: 'Plague Outbreak', mult: { med: 2.5 },             danger: 0,    dur: [5, 10], news: 'quarantine zones beg for medicine' },
  strike:   { name: 'Miners\' Strike', mult: { ore: 1.9, mach: 1.5 },  danger: 0,    dur: [4, 8],  news: 'the pits are silent; ore stockpiles dwindle' },
  boom:     { name: 'Trade Boom',      mult: { elec: 1.5, lux: 1.5 },  danger: 0,    dur: [4, 8],  news: 'new money is spending fast' },
  festival: { name: 'Star Festival',   mult: { lux: 2.0, food: 1.3 },  danger: 0,    dur: [3, 6],  news: 'the whole system is celebrating' },
  blockade: { name: 'Pirate Blockade', mult: { food: 1.4, med: 1.4, mach: 1.3 }, danger: 0.3, dur: [4, 9], news: 'raiders squeeze the shipping lanes' }
};

var HULLS = {
  rustbucket: { name: 'Sparrow "Rustbucket"', cargo: 25,  fuel: 30, speed: 1,   cannons: 1, cost: 1500 },
  mule:       { name: 'Mule Freighter',       cargo: 60,  fuel: 40, speed: 1,   cannons: 1, cost: 8000 },
  lighter:    { name: 'Pelican Lighter',      cargo: 70,  fuel: 40, speed: 1,   cannons: 0, cost: 9500 },
  zephyr:     { name: 'Zephyr Runner',        cargo: 35,  fuel: 55, speed: 2,   cannons: 0, cost: 11000 },
  falcon:     { name: 'Falcon Courier',       cargo: 35,  fuel: 55, speed: 2,   cannons: 1, cost: 14000 },
  gunboat:    { name: 'Hornet Gunboat',       cargo: 15,  fuel: 55, speed: 2,   cannons: 4, cost: 22000 },
  galleon:    { name: 'Galleon Hauler',       cargo: 100, fuel: 60, speed: 1.2, cannons: 4, cost: 46000 },
  leviathan:  { name: 'Leviathan Hauler',     cargo: 140, fuel: 60, speed: 1.2, cannons: 2, cost: 48000 },
  manowar:    { name: 'Basilisk Man-o\'-War', cargo: 30,  fuel: 60, speed: 1.5, cannons: 6, cost: 72000 }
};

var UPGRADES = {
  cargo:   { name: 'Cargo Pods',    desc: '+8 cargo space',            delta: 8,   max: 3, base: 1200 },
  fuel:    { name: 'Fuel Tanks',    desc: '+10 max fuel',              delta: 10,  max: 3, base: 900  },
  engine:  { name: 'Engine Tuning', desc: '+0.5 speed (faster trips)', delta: 0.5, max: 2, base: 3200 },
  weapons: { name: 'Pulse Cannons', desc: '+1 weapons (fight odds)',   delta: 1,   max: 4, base: 2500 },
  scanner: { name: 'Deep Scanner',  desc: '+1 scanner (charts further, dodges scans)', delta: 1, max: 3, base: 2000 }
};

// Legacy perks — permanent across galaxies once bought. All one template.
var PERKS = {
  inheritance: { name: 'Inheritance',      desc: '+1,500 starting credits per rank', cost: 3, max: 5 },
  contacts:    { name: 'Old Contacts',     desc: '+15 starting rep with all factions per rank', cost: 4, max: 3 },
  drives:      { name: 'Efficient Drives', desc: '-10% fuel burn per rank', cost: 5, max: 3 },
  holds:       { name: 'Smugglers\' Holds', desc: '+8 starting cargo per rank', cost: 4, max: 3 },
  charts:      { name: 'Old Star Charts',  desc: 'Charts reach +8 further per rank', cost: 3, max: 2 },
  nerve:       { name: 'Smuggler\'s Nerve', desc: '-15% customs scan odds per rank', cost: 4, max: 2 }
};

var TITLES = [
  { min: 0,       name: 'Deckhand' },
  { min: 2000,    name: 'Trader' },
  { min: 10000,   name: 'Merchant' },
  { min: 50000,   name: 'Broker' },
  { min: 200000,  name: 'Magnate' },
  { min: 1000000, name: 'Tycoon' }
];

var SYSTEM_NAMES = [
  'Hearth', 'Vega Prime', 'Chara', 'Altair', 'Deneb Landing', 'Kessel', 'Mira',
  'Procyon', 'Rigel Gate', 'Sable', 'Thule', 'Ursa Minor', 'Wolf 359', 'Yandel',
  'Zenith', 'Ashfall', 'Bellerophon', 'Cinder', 'Duskmar', 'Eventide', 'Farhaven',
  'Gloomport', 'Halcyon', 'Ironmoor', 'Junction', 'Krait', 'Lorelei', 'Meridian',
  'Nadir', 'Oberon Reach', 'Palisade', 'Quorra', 'Redlane', 'Solace', 'Tantalus',
  'Umbra', 'Vantage', 'Wrayth', 'Xenia', 'Yonder'
];

var CAPTAIN_NAMES = [
  'Ash Corvin', 'Ryn Okafor', 'Juno Halliday', 'Cass Verde', 'Milo Renn',
  'Vex Aldrin', 'Sol Marek', 'Ida Voss', 'Bram Ostler', 'Tycho Lane'
];
